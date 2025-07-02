/**
 * Smart Filesystem MCP - Move File Tool
 * ファイル移動/リネーム/バックアップツール
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SafetyController } from '../core/safety-controller.js';
import { SAFETY_LIMITS } from '../utils/constants.js';
import type { 
  MoveFileParams,
  MoveFileResult
} from '../core/types.js';

/**
 * ファイル移動メインツール
 */
export async function moveFile(
  params: MoveFileParams,
  safety: SafetyController
): Promise<MoveFileResult> {
  try {
    // パラメータ検証
    if (!params.source) {
      throw new Error('Source path is required');
    }
    
    if (!params.destination) {
      throw new Error('Destination path is required');
    }
    
    // パスの正規化
    const sourcePath = path.normalize(params.source);
    const destPath = path.normalize(params.destination);
    
    // 同じパスチェック
    if (sourcePath === destPath) {
      throw new Error('Source and destination paths are the same');
    }
    
    // ソースファイルの存在確認とアクセスチェック
    const sourceCheck = await safety.validateFileAccess(sourcePath);
    if (!sourceCheck.safe) {
      throw new Error(`Source file access denied: ${sourceCheck.reason}`);
    }
    
    // ソースファイルの情報取得
    let sourceStats;
    try {
      sourceStats = await fs.stat(sourcePath);
      if (!sourceStats.isFile()) {
        throw new Error('Source is not a file');
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error('Source file does not exist');
      }
      throw error;
    }
    
    // ファイルサイズチェック
    if (sourceStats.size > SAFETY_LIMITS.MOVE_MAX_FILE_SIZE) {
      throw new Error(
        `File too large to move (${(sourceStats.size / 1024 / 1024).toFixed(2)}MB > ${SAFETY_LIMITS.MOVE_MAX_FILE_SIZE / 1024 / 1024}MB)`
      );
    }
    
    // 宛先ディレクトリのアクセスチェック
    const destDir = path.dirname(destPath);
    const destDirCheck = await safety.validateDirectoryAccess(destDir);
    if (!destDirCheck.safe) {
      throw new Error(`Destination directory access denied: ${destDirCheck.reason}`);
    }
    
    // 宛先ファイルの存在確認
    let destExists = false;
    let destStats;
    try {
      destStats = await fs.stat(destPath);
      destExists = true;
      
      if (!params.overwrite_existing) {
        // 上書き警告を返す
        return {
          status: 'warning',
          operation_info: {
            source: sourcePath,
            destination: destPath,
            operation_type: getOperationType(sourcePath, destPath),
            size_bytes: sourceStats.size
          },
          issue_details: {
            reason: 'Destination file already exists',
            existing_file_info: {
              size_bytes: destStats.size,
              last_modified: destStats.mtime.toISOString()
            }
          },
          alternatives: {
            suggestions: [
              'Use overwrite_existing=true if replacement is intended',
              'Choose different destination filename',
              'Use read_file to check existing content first',
              `Consider backup: move_file("${params.destination}", "${params.destination}.bak")`
            ]
          }
        };
      }
    } catch {
      // 宛先ファイルが存在しない（正常）
      destExists = false;
    }
    
    // 宛先ディレクトリが存在しない場合は作成
    await fs.mkdir(destDir, { recursive: true });
    
    // タイムアウト付きで移動実行
    const movePromise = performMove(sourcePath, destPath);
    await safety.enforceTimeout(movePromise, SAFETY_LIMITS.MOVE_TIMEOUT, 'File move');
    
    // 成功レスポンス
    return {
      status: 'success',
      operation_info: {
        source: sourcePath,
        destination: destPath,
        operation_type: getOperationType(sourcePath, destPath),
        size_bytes: sourceStats.size
      }
    };
    
  } catch (error) {
    // エラーレスポンス
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      status: 'error',
      operation_info: {
        source: params.source,
        destination: params.destination,
        operation_type: getOperationType(params.source, params.destination),
        size_bytes: 0
      },
      issue_details: {
        reason: errorMessage
      },
      alternatives: {
        suggestions: getErrorSuggestions(errorMessage)
      }
    };
  }
}

/**
 * ファイル移動の実行
 */
async function performMove(sourcePath: string, destPath: string): Promise<void> {
  try {
    // まずrenameを試す（同一ファイルシステム内で高速）
    await fs.rename(sourcePath, destPath);
  } catch (error) {
    // クロスデバイスエラーの場合はコピー＆削除
    if ((error as any).code === 'EXDEV') {
      await fs.copyFile(sourcePath, destPath);
      await fs.unlink(sourcePath);
    } else {
      throw error;
    }
  }
}

/**
 * 操作タイプの判定
 */
function getOperationType(sourcePath: string, destPath: string): 'move' | 'rename' | 'backup' {
  const sourceDir = path.dirname(sourcePath);
  const destDir = path.dirname(destPath);
  const sourceBase = path.basename(sourcePath);
  const destBase = path.basename(destPath);
  
  // バックアップパターンの検出
  if (destBase.includes('.bak') || destBase.includes('.backup') || 
      destBase.includes('.old') || destBase.match(/\.\d{8}/)) {
    return 'backup';
  }
  
  // 同じディレクトリ内 = リネーム
  if (sourceDir === destDir) {
    return 'rename';
  }
  
  // 異なるディレクトリ = 移動
  return 'move';
}

/**
 * エラーに基づく提案生成
 */
function getErrorSuggestions(errorMessage: string): string[] {
  const suggestions: string[] = [];
  
  if (errorMessage.includes('EACCES') || errorMessage.includes('Permission denied')) {
    suggestions.push(
      'Check file permissions for both source and destination',
      'Ensure the source file is not locked',
      'Verify write permissions in destination directory',
      'Close any programs that may be using the file'
    );
  } else if (errorMessage.includes('ENOENT') || errorMessage.includes('does not exist')) {
    suggestions.push(
      'Verify the source file path exists',
      'Use list_directory to check available files',
      'Check for typos in the file paths',
      'Ensure the file hasn\'t been moved already'
    );
  } else if (errorMessage.includes('ENOSPC')) {
    suggestions.push(
      'Free up disk space on the destination drive',
      'Move to a different drive with more space',
      'Delete unnecessary files first',
      'Consider compressing the file before moving'
    );
  } else if (errorMessage.includes('too large')) {
    suggestions.push(
      'Split the file into smaller parts',
      'Use compression before moving',
      'Copy the file manually using system tools',
      'Increase the move size limit if appropriate'
    );
  } else if (errorMessage.includes('same')) {
    suggestions.push(
      'Provide different source and destination paths',
      'Check if paths resolve to the same location',
      'Use a different destination filename'
    );
  } else if (errorMessage.includes('already exists')) {
    suggestions.push(
      'Set overwrite_existing=true to replace the file',
      'Choose a different destination filename',
      'Move the existing file first',
      'Check the existing file content with read_file'
    );
  } else {
    suggestions.push(
      'Check both source and destination paths',
      'Verify you have appropriate permissions',
      'Ensure paths are not too long',
      'Try moving to a different location first'
    );
  }
  
  return suggestions;
}
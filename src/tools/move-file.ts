/**
 * Smart Filesystem MCP - Move File Tool
 * ファイル移動/リネーム/バックアップツール
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PathLike } from 'fs';
import { SafetyController } from '../core/safety-controller.js';
import { SAFETY_LIMITS } from '../utils/constants.js';
import type { 
  MoveFileParams
} from '../core/types.js';
import { createUnifiedError, createUnifiedErrorFromException, ErrorCodes, UnifiedError, validatePath } from '../utils/unified-error-handler.js';

/**
 * Move file success response
 */
interface MoveFileSuccess {
  success: true;
  status: 'success';
  operation_info: {
    source: string;
    destination: string;
    operation_type: 'move' | 'rename' | 'backup';
    size_bytes: number;
  };
}

/**
 * ファイル移動メインツール（LLM最適化版）
 */
export async function moveFile(
  params: MoveFileParams,
  safety: SafetyController
): Promise<MoveFileSuccess | UnifiedError> {
  
  try {
    // ソースパスバリデーション
    const sourceValidation = validatePath(params.source);
    if (!sourceValidation.valid) {
      return createUnifiedError(
        ErrorCodes.MISSING_PATH,
        'move_file',
        { source: params.source, destination: params.destination },
        sourceValidation.error?.includes('empty') ? 'ソースファイルパスが指定されていません' : 'ソースパスが不正です'
      );
    }
    
    // 先パスバリデーション
    const destValidation = validatePath(params.destination);
    if (!destValidation.valid) {
      return createUnifiedError(
        ErrorCodes.MISSING_PATH,
        'move_file',
        { source: params.source, destination: params.destination },
        destValidation.error?.includes('empty') ? '先ファイルパスが指定されていません' : '先パスが不正です'
      );
    }
    
    // オリジナルパスを保持
    const originalSource = params.source;
    const originalDest = params.destination;
    
    // パスの正規化（内部処理用）
    const sourcePath = path.normalize(params.source);
    const destPath = path.normalize(params.destination);
    
    // 同じパスチェック
    if (sourcePath === destPath) {
      return createUnifiedError(
        ErrorCodes.INVALID_PATH,
        'move_file',
        { source: params.source, destination: params.destination },
        'ソースと先が同じファイルです'
      );
    }
    
    // ソースファイルの存在確認とアクセスチェック
    const sourceCheck = await safety.validateFileAccess(sourcePath, 'read');
    if (!sourceCheck.safe) {
      return createUnifiedError(
        ErrorCodes.ACCESS_DENIED,
        'move_file',
        { source: params.source, destination: params.destination },
        `ソースファイルへのアクセスが拒否されました: ${sourceCheck.reason}`
      );
    }
    
    // ソースファイルの情報取得
    let sourceStats;
    try {
      sourceStats = await fs.stat(sourcePath);
      if (!sourceStats.isFile()) {
        return createUnifiedError(
          ErrorCodes.OPERATION_FAILED,
          'move_file',
          { source: params.source, destination: params.destination },
          'ソースはファイルではありません'
        );
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return createUnifiedError(
          ErrorCodes.FILE_NOT_FOUND,
          'move_file',
          { source: params.source, destination: params.destination },
          'ソースファイルが存在しません'
        );
      }
      return createUnifiedErrorFromException(error, 'move_file', params.source);
    }
    
    // ファイルサイズチェック
    if (sourceStats.size > SAFETY_LIMITS.MOVE_MAX_FILE_SIZE) {
      return createUnifiedError(
        ErrorCodes.FILE_TOO_LARGE,
        'move_file',
        { 
          source: params.source, 
          destination: params.destination,
          actual_size: sourceStats.size,
          max_size: SAFETY_LIMITS.MOVE_MAX_FILE_SIZE
        },
        `ファイルサイズが大きすぎます（${(sourceStats.size / 1024 / 1024).toFixed(2)}MB > ${SAFETY_LIMITS.MOVE_MAX_FILE_SIZE / 1024 / 1024}MB）`
      );
    }
    
    // 宛先ディレクトリのアクセスチェック
    const destDir = path.dirname(destPath);
    const destDirCheck = await safety.validateDirectoryAccess(destDir);
    if (!destDirCheck.safe) {
      return createUnifiedError(
        ErrorCodes.ACCESS_DENIED,
        'move_file',
        { source: params.source, destination: params.destination },
        `先ディレクトリへのアクセスが拒否されました: ${destDirCheck.reason}`
      );
    }
    
    // 宛先ファイルの存在確認
    try {
      await fs.stat(destPath as PathLike);
      
      if (!params.overwrite_existing) {
        return createUnifiedError(
          ErrorCodes.DESTINATION_EXISTS,
          'move_file',
          { source: params.source, destination: params.destination },
          '宛先ファイルが既に存在します'
        );
      }
    } catch (error) {
      // 宛先ファイルが存在しない（正常）
      if ((error as any).code === 'ENOENT') {
        // ファイルが存在しない場合は何もしない
      } else {
        return createUnifiedError(
          ErrorCodes.ACCESS_DENIED,
          'move_file',
          { source: params.source, destination: params.destination },
          '宛先パスにアクセスできません'
        );
      }
    }
    
    // 宛先ディレクトリが存在しない場合は作成
    await fs.mkdir(destDir, { recursive: true });
    
    // タイムアウト付きで移動実行
    const movePromise = performMove(sourcePath, destPath);
    await safety.enforceTimeout(movePromise, SAFETY_LIMITS.MOVE_TIMEOUT, 'File move');
    
    // 成功レスポンス
    return {
      success: true,
      status: 'success',
      operation_info: {
        source: originalSource,
        destination: originalDest,
        operation_type: getOperationType(sourcePath, destPath),
        size_bytes: sourceStats.size
      }
    };
    
  } catch (error) {
    return createUnifiedErrorFromException(error, 'move_file', params.source);
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


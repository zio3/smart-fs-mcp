/**
 * Smart Filesystem MCP - Move Directory Tool
 * ディレクトリ移動・リネームツール
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getSecurityController } from '../core/security-controller-v2.js';
// import { SAFETY_LIMITS } from '../utils/constants.js';

/**
 * ディレクトリ移動パラメータ
 */
export interface MoveDirectoryParams {
  /** 移動元ディレクトリパス */
  source: string;
  /** 移動先ディレクトリパス */
  destination: string;
  /** 既存ディレクトリを上書き */
  overwrite_existing?: boolean;
  /** プレビューのみ実行 */
  dry_run?: boolean;
}

/**
 * ディレクトリ移動結果
 */
export interface MoveDirectoryResult {
  /** 操作ステータス */
  status: 'success' | 'warning' | 'error';
  /** 操作情報 */
  operation_info?: {
    source: string;
    destination: string;
    resolved_source: string;
    resolved_destination: string;
    operation_type: 'move' | 'rename' | 'backup';
    total_files: number;
    total_directories: number;
    total_size_bytes: number;
    operation_time_ms: number;
  };
  /** プレビュー情報（dry_run時） */
  preview?: {
    source_info: {
      total_files: number;
      total_directories: number;
      total_size_bytes: number;
      estimated_time_ms: number;
    };
    destination_exists: boolean;
    will_overwrite: boolean;
    operation_type: 'move' | 'rename' | 'backup';
  };
  /** 問題詳細 */
  issue_details?: {
    reason: string;
    existing_destination_info?: {
      total_files: number;
      total_size_bytes: number;
      last_modified: string;
    };
  };
  /** 代替手段 */
  alternatives?: {
    suggestions: string[];
  };
}

/**
 * 操作タイプを判定する
 */
function determineOperationType(source: string, destination: string): 'move' | 'rename' | 'backup' {
  const sourceDir = path.dirname(source);
  const destDir = path.dirname(destination);
  // const sourceName = path.basename(source);
  const destName = path.basename(destination);
  
  // 同じディレクトリ内での操作
  if (sourceDir === destDir) {
    return 'rename';
  }
  
  // バックアップパターンの検出
  if (destName.includes('backup') || destName.includes('.bak') || destName.includes('.old')) {
    return 'backup';
  }
  
  return 'move';
}

/**
 * ディレクトリサイズを計算する
 */
async function calculateDirectorySize(dirPath: string): Promise<{
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
}> {
  let totalFiles = 0;
  let totalDirectories = 0;
  let totalSize = 0;
  
  const scanDirectory = async (currentPath: string): Promise<void> => {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);
        
        if (entry.isFile()) {
          totalFiles++;
          try {
            const stats = await fs.stat(entryPath);
            totalSize += stats.size;
          } catch {
            // Ignore stat errors for individual files
          }
        } else if (entry.isDirectory()) {
          totalDirectories++;
          await scanDirectory(entryPath);
        }
      }
    } catch {
      // Ignore directory access errors
    }
  };
  
  await scanDirectory(dirPath);
  
  return { totalFiles, totalDirectories, totalSize };
}

/**
 * 移動時間を推定する
 */
function estimateMoveTime(totalFiles: number, totalSize: number): number {
  // ファイル数ベース（1ファイルあたり2ms）とサイズベース（1MBあたり10ms）の大きい方
  const fileBasedTime = totalFiles * 2;
  const sizeBasedTime = (totalSize / (1024 * 1024)) * 10;
  return Math.max(fileBasedTime, sizeBasedTime);
}

/**
 * プレビューを実行する
 */
async function previewMove(
  sourcePath: string,
  destinationPath: string,
  overwriteExisting: boolean
): Promise<MoveDirectoryResult> {
  try {
    // ソース情報取得
    const sourceStats = await fs.stat(sourcePath);
    if (!sourceStats.isDirectory()) {
      throw new Error('Source is not a directory');
    }
    
    const sourceInfo = await calculateDirectorySize(sourcePath);
    const operationType = determineOperationType(sourcePath, destinationPath);
    
    // 移動先存在チェック
    let destinationExists = false;
    try {
      await fs.stat(destinationPath);
      destinationExists = true;
    } catch {
      // Destination doesn't exist - this is fine
    }
    
    const willOverwrite = destinationExists && overwriteExisting;
    
    return {
      status: destinationExists && !overwriteExisting ? 'warning' : 'success',
      preview: {
        source_info: {
          total_files: sourceInfo.totalFiles,
          total_directories: sourceInfo.totalDirectories,
          total_size_bytes: sourceInfo.totalSize,
          estimated_time_ms: estimateMoveTime(sourceInfo.totalFiles, sourceInfo.totalSize)
        },
        destination_exists: destinationExists,
        will_overwrite: willOverwrite,
        operation_type: operationType
      },
      issue_details: destinationExists && !overwriteExisting ? {
        reason: 'Destination directory already exists',
        existing_destination_info: {
          total_files: 0, // Could be calculated if needed
          total_size_bytes: 0,
          last_modified: new Date().toISOString()
        }
      } : undefined,
      alternatives: destinationExists && !overwriteExisting ? {
        suggestions: [
          'Use overwrite_existing=true to overwrite the destination',
          'Choose a different destination path',
          'Move to a subdirectory within the destination',
          'Backup the existing destination first'
        ]
      } : undefined
    };
    
  } catch (error) {
    return {
      status: 'error',
      alternatives: {
        suggestions: [
          `Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'Check that source directory exists and is accessible',
          'Verify permissions on source directory'
        ]
      }
    };
  }
}

/**
 * 実際の移動を実行する
 */
async function executeMove(
  sourcePath: string,
  destinationPath: string,
  overwriteExisting: boolean,
  originalSource?: string,
  originalDest?: string
): Promise<MoveDirectoryResult> {
  const startTime = Date.now();
  
  try {
    // ソース情報取得
    const sourceInfo = await calculateDirectorySize(sourcePath);
    const operationType = determineOperationType(sourcePath, destinationPath);
    
    // 移動先存在チェック
    let destinationExists = false;
    try {
      await fs.stat(destinationPath);
      destinationExists = true;
    } catch {
      // Destination doesn't exist
    }
    
    if (destinationExists && !overwriteExisting) {
      return {
        status: 'error',
        issue_details: {
          reason: 'Destination directory already exists and overwrite is not enabled'
        },
        alternatives: {
          suggestions: [
            'Use overwrite_existing=true to overwrite the destination',
            'Choose a different destination path',
            'Use dry_run=true to preview the operation first'
          ]
        }
      };
    }
    
    // 移動先の親ディレクトリを作成
    const destParent = path.dirname(destinationPath);
    try {
      await fs.mkdir(destParent, { recursive: true });
    } catch {
      // Parent directory creation failed - might already exist
    }
    
    // 既存の移動先を削除（overwrite_existing=trueの場合）
    if (destinationExists && overwriteExisting) {
      await fs.rm(destinationPath, { recursive: true, force: true });
    }
    
    // 実際の移動実行
    await fs.rename(sourcePath, destinationPath);
    
    const endTime = Date.now();
    
    return {
      status: 'success',
      operation_info: {
        source: originalSource || sourcePath,
        destination: originalDest || destinationPath,
        resolved_source: sourcePath,
        resolved_destination: destinationPath,
        operation_type: operationType,
        total_files: sourceInfo.totalFiles,
        total_directories: sourceInfo.totalDirectories,
        total_size_bytes: sourceInfo.totalSize,
        operation_time_ms: endTime - startTime
      }
    };
    
  } catch (error) {
    const endTime = Date.now();
    
    return {
      status: 'error',
      operation_info: {
        source: originalSource || sourcePath,
        destination: originalDest || destinationPath,
        resolved_source: sourcePath,
        resolved_destination: destinationPath,
        operation_type: 'move',
        total_files: 0,
        total_directories: 0,
        total_size_bytes: 0,
        operation_time_ms: endTime - startTime
      },
      alternatives: {
        suggestions: [
          `Move failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'Check that source directory exists and is accessible',
          'Verify permissions on both source and destination',
          'Ensure destination parent directory is writable',
          'Try using a different destination path'
        ]
      }
    };
  }
}

/**
 * ディレクトリを移動する
 */
export async function moveDirectory(params: MoveDirectoryParams): Promise<MoveDirectoryResult> {
  const { 
    source: sourcePath, 
    destination: destinationPath, 
    overwrite_existing = false, 
    dry_run = false 
  } = params;
  
  const security = getSecurityController();
  
  try {
    // セキュリティチェック（ソース）
    const sourceValidation = security.validateSecurePath(sourcePath);
    if (!sourceValidation.allowed) {
      throw new Error(`Source access denied: ${sourceValidation.reason}`);
    }
    
    // セキュリティチェック（移動先）
    const destValidation = security.validateSecurePath(destinationPath);
    if (!destValidation.allowed) {
      throw new Error(`Destination access denied: ${destValidation.reason}`);
    }
    
    const resolvedSource = sourceValidation.resolved_path;
    const resolvedDestination = destValidation.resolved_path;
    
    if (dry_run) {
      return await previewMove(resolvedSource, resolvedDestination, overwrite_existing);
    } else {
      return await executeMove(resolvedSource, resolvedDestination, overwrite_existing, sourcePath, destinationPath);
    }
    
  } catch (error) {
    return {
      status: 'error',
      alternatives: {
        suggestions: [
          `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'Check directory permissions and try again',
          'Use dry_run=true to preview the operation first',
          'Verify both source and destination paths are accessible'
        ]
      }
    };
  }
}

/**
 * ディレクトリ移動のヘルパー関数（エラーをthrow）
 */
export async function moveDirectoryOrThrow(params: MoveDirectoryParams): Promise<MoveDirectoryResult> {
  const result = await moveDirectory(params);
  
  if (result.status === 'error') {
    const errorMessage = result.alternatives?.suggestions?.join('; ') || 'Failed to move directory';
    throw new Error(errorMessage);
  }
  
  return result;
}
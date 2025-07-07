/**
 * Smart Filesystem MCP - Delete Directory Tool (Simplified)
 * ディレクトリ削除ツール（dry_runプレビュー機能付き・簡素化版）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getSecurityController } from '../core/security-controller-v2.js';
import { DeleteErrorBuilder } from '../core/delete-error-builder.js';
import { createUnifiedError, ErrorCodes } from '../utils/unified-error-handler.js';
import type { 
  DeleteDirectoryParams
} from '../types/delete-operations.js';
import type { DeleteSuccess } from '../core/types.js';
import type { UnifiedError } from '../utils/unified-error-handler.js';

export type UnifiedDeleteResponse = DeleteSuccess | UnifiedError;


/**
 * 簡素化されたプレビュー機能
 * - 重要度評価は削除
 * - 基本的なファイル・ディレクトリ情報のみ返す
 */
async function previewDeletion(
  dirPath: string, 
  recursive: boolean
): Promise<{ fileCount: number; dirCount: number; isEmpty: boolean }> {
  let totalFiles = 0;
  let totalDirs = 0;
  
  const scanDirectory = async (currentPath: string): Promise<void> => {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);
        
        if (entry.isFile()) {
          totalFiles++;
        } else if (entry.isDirectory()) {
          totalDirs++;
          if (recursive) {
            await scanDirectory(entryPath);
          }
        }
      }
    } catch {
      // ディレクトリアクセスエラーは無視
    }
  };
  
  await scanDirectory(dirPath);
  
  return {
    fileCount: totalFiles,
    dirCount: totalDirs,
    isEmpty: totalFiles === 0 && totalDirs === 0
  };
}

/**
 * 実際の削除を実行する
 */
async function executeDeletion(
  dirPath: string, 
  recursive: boolean, 
  force: boolean
): Promise<{ success: boolean; error?: Error }> {
  
  const deleteRecursive = async (currentPath: string): Promise<void> => {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      
      if (entry.isFile()) {
        try {
          // 読み取り専用ファイルの処理
          if (force) {
            try {
              await fs.chmod(entryPath, 0o666);
            } catch {
              // Ignore chmod errors
            }
          }
          
          await fs.unlink(entryPath);
        } catch (error) {
          // ファイル削除エラーは記録して続行
          console.warn(`Failed to delete file: ${entryPath}`, error);
        }
        
      } else if (entry.isDirectory() && recursive) {
        await deleteRecursive(entryPath);
        try {
          await fs.rmdir(entryPath);
        } catch (error) {
          console.warn(`Failed to delete directory: ${entryPath}`, error);
        }
      }
    }
  };
  
  try {
    if (recursive) {
      await deleteRecursive(dirPath);
    }
    
    // 最後にメインディレクトリを削除
    await fs.rmdir(dirPath);
    
    return {
      success: true
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/**
 * ディレクトリを削除する（簡素化版・統一レスポンス）
 * - 成功時は { success: true } のみ
 * - dry_runは維持（ディレクトリは影響範囲が大きいため）
 * - 複雑な分析機能は排除
 */
export async function deleteDirectory(
  params: DeleteDirectoryParams
): Promise<UnifiedDeleteResponse> {
  const { 
    path: targetPath, 
    recursive = false, 
    force = false, 
    dry_run = false 
  } = params;
  
  try {
    // 絶対パスチェック
    if (!path.isAbsolute(targetPath)) {
      return createUnifiedError(
        ErrorCodes.PATH_NOT_ABSOLUTE,
        'delete_directory',
        {
          path: targetPath,
          target_type: 'directory',
          exists: false
        },
        `絶対パス指定が必要です: '${targetPath}' は相対パスです`,
        [`絶対パス「${path.resolve(targetPath)}」で再実行してください`]
      );
    }
    
    // セキュリティチェック
    const security = getSecurityController();
    const validation = security.validateSecurePath(targetPath);
    if (!validation.allowed) {
      return DeleteErrorBuilder.buildPermissionError(targetPath, 'directory');
    }
    
    const resolvedPath = validation.resolved_path;
    
    // 基本的な存在チェック
    let stats;
    try {
      stats = await fs.stat(resolvedPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return DeleteErrorBuilder.buildNotFoundError(targetPath, 'directory');
      }
      throw error;
    }
    
    // ファイルチェック
    if (!stats.isDirectory()) {
      return DeleteErrorBuilder.buildInvalidTargetError(targetPath, 'directory', 'file');
    }
    
    // dry_run処理（簡素化版）
    if (dry_run) {
      const preview = await previewDeletion(resolvedPath, recursive);
      
      // プレビュー結果に基づくレスポンス
      if (!recursive && !preview.isEmpty) {
        return createUnifiedError(
          ErrorCodes.DIRECTORY_NOT_EMPTY,
          'delete_directory',
          {
            path: targetPath,
            target_type: 'directory',
            exists: true,
            file_count: preview.fileCount,
            directory_count: preview.dirCount
          },
          `ディレクトリが空ではありません（${preview.fileCount}ファイル、${preview.dirCount}ディレクトリ）。dry_runモードで確認しました。`,
          [
            '再帰的削除で実行してください（全内容を削除）',
            'ディレクトリ内容を詳細確認してください'
          ]
        );
      }
      
      // dry_run成功（実際の削除は行わない）
      return { success: true };
    }
    
    // 空でないチェック（非再帰時）
    if (!recursive) {
      try {
        const entries = await fs.readdir(resolvedPath);
        if (entries.length > 0) {
          return DeleteErrorBuilder.buildNotEmptyError(targetPath);
        }
      } catch (error: any) {
        if (error.code === 'EACCES' || error.code === 'EPERM') {
          return DeleteErrorBuilder.buildPermissionError(targetPath, 'directory');
        }
        throw error;
      }
    }
    
    // 削除実行
    const result = await executeDeletion(resolvedPath, recursive, force);
    
    if (result.success) {
      return { success: true };
    } else {
      // エラー処理
      const error = result.error;
      const errorMsg = error?.message || 'ディレクトリ削除に失敗しました';
      
      if (errorMsg.includes('not be empty') || errorMsg.includes('ENOTEMPTY')) {
        return DeleteErrorBuilder.buildNotEmptyError(targetPath);
      } else if (errorMsg.includes('in use') || errorMsg.includes('EBUSY')) {
        return DeleteErrorBuilder.buildInUseError(targetPath, 'directory');
      } else if (errorMsg.includes('permission') || errorMsg.includes('EACCES') || errorMsg.includes('EPERM')) {
        return DeleteErrorBuilder.buildPermissionError(targetPath, 'directory');
      } else {
        return DeleteErrorBuilder.buildUnknownError(
          targetPath,
          'directory', 
          error || new Error(errorMsg)
        );
      }
    }
    
  } catch (error: any) {
    // 予期しないエラー
    return DeleteErrorBuilder.buildUnknownError(
      targetPath,
      'directory',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}



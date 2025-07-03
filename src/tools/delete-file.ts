/**
 * Smart Filesystem MCP - Delete File Tool (Simplified)
 * ファイル削除ツール（極限までシンプル化）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getSecurityController } from '../core/security-controller-v2.js';
import { DeleteErrorBuilder } from '../core/delete-error-builder.js';
import type { DeleteFileParams, UnifiedDeleteResponse } from '../core/types.js';

/**
 * ファイルを削除する（簡素化版）
 * - 成功時は { success: true } のみ返す
 * - 失敗時は建設的な解決策を提示
 * - 複雑な分析機能は排除
 */
export async function deleteFile(params: DeleteFileParams): Promise<UnifiedDeleteResponse> {
  const { path: targetPath, force = false } = params;
  
  try {
    // 絶対パスチェック
    if (!path.isAbsolute(targetPath)) {
      return {
        success: false,
        failedInfo: {
          reason: 'invalid_target',
          message: `絶対パス指定が必要です: '${targetPath}' は相対パスです`,
          target_info: {
            path: targetPath,
            type: 'file',
            exists: false
          },
          solutions: [
            {
              method: 'delete_file',
              params: { path: path.resolve(targetPath) },
              description: `絶対パス「${path.resolve(targetPath)}」で再実行`
            }
          ]
        }
      };
    }
    
    // セキュリティチェック
    const security = getSecurityController();
    const validation = security.validateSecurePath(targetPath);
    if (!validation.allowed) {
      return DeleteErrorBuilder.buildPermissionError(targetPath, 'file');
    }
    
    const resolvedPath = validation.resolved_path;
    
    // 基本的な存在チェック
    let stats;
    try {
      stats = await fs.stat(resolvedPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return DeleteErrorBuilder.buildNotFoundError(targetPath, 'file');
      }
      throw error;
    }
    
    // ディレクトリチェック
    if (stats.isDirectory()) {
      return DeleteErrorBuilder.buildInvalidTargetError(targetPath, 'file', 'directory');
    }
    
    // 削除実行
    try {
      await fs.unlink(resolvedPath);
    } catch (error: any) {
      // エラー種別による分岐
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        if (force) {
          // 強制削除の試行
          try {
            await fs.chmod(resolvedPath, 0o666);
            await fs.unlink(resolvedPath);
          } catch {
            return DeleteErrorBuilder.buildPermissionError(targetPath, 'file');
          }
        } else {
          // 読み取り専用チェック
          const isReadOnly = (stats.mode & parseInt('200', 8)) === 0;
          if (isReadOnly) {
            return DeleteErrorBuilder.buildReadOnlyError(targetPath, 'file');
          }
          return DeleteErrorBuilder.buildPermissionError(targetPath, 'file');
        }
      } else if (error.code === 'EBUSY' || error.code === 'EMFILE') {
        return DeleteErrorBuilder.buildInUseError(targetPath, 'file');
      } else {
        throw error;
      }
    }
    
    // 成功レスポンス（シンプル）
    return {
      success: true
    };
    
  } catch (error: any) {
    // 予期しないエラー
    return DeleteErrorBuilder.buildUnknownError(
      targetPath, 
      'file', 
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * 統一化されたファイル削除（新しいエントリーポイント）
 */
export async function deleteFileUnified(params: DeleteFileParams): Promise<UnifiedDeleteResponse> {
  return deleteFile(params);
}

/**
 * ファイル削除のヘルパー関数（エラーをthrow）
 */
export async function deleteFileOrThrow(params: DeleteFileParams): Promise<UnifiedDeleteResponse> {
  const result = await deleteFile(params);
  
  if (!result.success) {
    const errorMessage = result.failedInfo?.message || 'Failed to delete file';
    throw new Error(errorMessage);
  }
  
  return result;
}
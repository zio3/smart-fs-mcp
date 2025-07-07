/**
 * Smart Filesystem MCP - File Info Tool
 * ファイル情報取得ツール（軽量版）
 */

import * as fs from 'fs/promises';
import { getSecurityController } from '../core/security-controller-v2.js';
import { FileAnalyzer } from '../core/file-analyzer.js';
import { createUnifiedError, createUnifiedErrorFromException, ErrorCodes, UnifiedError, validatePath } from '../utils/unified-error-handler.js';
import type { StandardFileInfo } from '../core/types.js';

/**
 * file_infoパラメータ
 */
export interface FileInfoParams {
  path: string;
}

/**
 * 成功レスポンス形式 (統一版)
 */
interface FileInfoSuccess {
  success: true;
  path: string;
  resolved_path: string;
  exists: boolean;
  type: 'file' | 'directory' | 'symlink' | 'other';
  file_info: StandardFileInfo;
}

/**
 * 統一レスポンス形式
 */
export type FileInfoUnifiedResponse = FileInfoSuccess | UnifiedError;

// バイナリ判定機能はFileAnalyzerに移行しました

/**
 * ファイル情報を取得（統一版）
 */
export async function fileInfo(
  params: FileInfoParams,
  analyzer: FileAnalyzer = new FileAnalyzer()
): Promise<FileInfoUnifiedResponse> {
  const { path: targetPath } = params;
  
  // パスバリデーション
  const pathValidation = validatePath(targetPath);
  if (!pathValidation.valid) {
    return createUnifiedError(
      ErrorCodes.MISSING_PATH,
      'file_info',
      {},
      pathValidation.error?.includes('empty') ? 'ファイルパスが指定されていません' : '不正なパス形式です'
    );
  }
  
  const security = getSecurityController();
  
  // ファイルの存在確認を先に行う
  try {
    await fs.access(targetPath, fs.constants.F_OK);
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return createUnifiedError(ErrorCodes.FILE_NOT_FOUND, 'file_info', { path: targetPath });
    }
  }
  
  // セキュリティチェック
  const validation = await security.validateAccess(targetPath, 'read');
  if (!validation.allowed) {
    return createUnifiedError(
      ErrorCodes.ACCESS_DENIED,
      'file_info',
      { path: targetPath },
      `アクセスが拒否されました: ${validation.reason || 'Access denied'}`
    );
  }
  
  const resolvedPath = validation.resolved_path;
  
  try {
    // ファイル/ディレクトリの統計情報を取得
    const stats = await fs.stat(resolvedPath);
    
    // タイプ判定
    let type: 'file' | 'directory' | 'symlink' | 'other';
    if (stats.isDirectory()) {
      type = 'directory';
    } else if (stats.isFile()) {
      type = 'file';
    } else if (stats.isSymbolicLink()) {
      type = 'symlink';
    } else {
      type = 'other';
    }
    
    // ファイルの場合は統一ファイル情報を生成
    if (type === 'file') {
      const standardFileInfo = await analyzer.generateStandardFileInfo(resolvedPath, stats);
      
      return {
        success: true,
        path: targetPath,
        resolved_path: resolvedPath,
        exists: true,
        type,
        file_info: standardFileInfo
      };
    }
    
    // ディレクトリやその他の場合は簡易情報
    const simpleFileInfo: StandardFileInfo = {
      size_bytes: stats.size,
      is_binary: false,
      file_type: 'binary',
      modified: stats.mtime.toISOString(),
      created: stats.birthtime.toISOString(),
      accessed: stats.atime.toISOString(),
      permissions: {
        readable: !!(stats.mode & 0o444),
        writable: !!(stats.mode & 0o222),
        executable: !!(stats.mode & 0o111),
        mode: '0' + (stats.mode & parseInt('777', 8)).toString(8)
      }
    };
    
    return {
      success: true,
      path: targetPath,
      resolved_path: resolvedPath,
      exists: true,
      type,
      file_info: simpleFileInfo
    };
    
  } catch (error) {
    // エラーハンドリング
    return createUnifiedErrorFromException(error, 'file_info', targetPath);
  }
}
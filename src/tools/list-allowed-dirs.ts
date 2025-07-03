/**
 * Smart Filesystem MCP - List Allowed Dirs Tool
 * 許可ディレクトリ一覧表示ツール
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getSecurityController } from '../core/security-controller-v2.js';
// import type { FileEncoding } from '../core/types.js';

/**
 * 許可ディレクトリ情報
 */
export interface AllowedDirectoryInfo {
  original_path: string;
  resolved_path: string;
  exists: boolean;
  accessible: boolean;
  permissions: {
    readable: boolean;
    writable: boolean;
  };
  stats?: {
    size_info: string;
    file_count: number;
    last_modified: string;
  };
}

/**
 * list_allowed_dirs結果
 */
export interface ListAllowedDirsResult {
  allowed_directories: AllowedDirectoryInfo[];
  platform_info: {
    os: string;
    case_sensitive: boolean;
    path_separator: string;
    resolved_cwd: string;
  };
  security_info: {
    total_directories: number;
    accessible_directories: number;
    read_only_directories: number;
  };
}

/**
 * 許可ディレクトリ一覧を取得
 */
export async function listAllowedDirs(): Promise<ListAllowedDirsResult> {
  const security = getSecurityController();
  const allowedDirs = security.getAllowedDirectories();
  const resolvedDirs = security.getResolvedAllowedDirectories();
  
  const directoryInfos: AllowedDirectoryInfo[] = [];
  
  // 各許可ディレクトリの情報を収集
  for (let i = 0; i < allowedDirs.length; i++) {
    const originalPath = allowedDirs[i];
    const resolvedPath = resolvedDirs[i];
    
    const info: AllowedDirectoryInfo = {
      original_path: originalPath || '',
      resolved_path: resolvedPath || '',
      exists: false,
      accessible: false,
      permissions: {
        readable: false,
        writable: false
      }
    };
    
    try {
      // 存在確認
      const stats = await fs.stat(resolvedPath || '');
      
      if (stats.isDirectory()) {
        info.exists = true;
        
        // アクセス権限チェック
        try {
          await fs.access(resolvedPath || '', fs.constants.R_OK);
          info.permissions.readable = true;
          info.accessible = true;
        } catch {
          // 読み取り権限なし
        }
        
        try {
          await fs.access(resolvedPath || '', fs.constants.W_OK);
          info.permissions.writable = true;
        } catch {
          // 書き込み権限なし
        }
        
        // 統計情報を収集（アクセス可能な場合のみ）
        if (info.accessible) {
          try {
            const files = await fs.readdir(resolvedPath || '');
            files.filter(async (file) => {
              try {
                const filePath = path.join(resolvedPath || '', file);
                const fileStat = await fs.stat(filePath);
                return fileStat.isFile();
              } catch {
                return false;
              }
            }).length;
            
            info.stats = {
              size_info: 'Directory',
              file_count: files.length,
              last_modified: stats.mtime.toISOString()
            };
          } catch (error) {
            // ディレクトリ内容の読み取りに失敗
            info.stats = {
              size_info: 'Directory (contents not accessible)',
              file_count: 0,
              last_modified: stats.mtime.toISOString()
            };
          }
        }
      } else {
        // ディレクトリではない
        info.exists = true;
        info.accessible = false;
      }
    } catch (error) {
      // ディレクトリが存在しないか、statでエラー
      if (error instanceof Error && error.message.includes('ENOENT')) {
        info.exists = false;
      }
    }
    
    directoryInfos.push(info);
  }
  
  // プラットフォーム情報
  const platformInfo = {
    os: process.platform,
    case_sensitive: process.platform !== 'win32' && process.platform !== 'darwin',
    path_separator: path.sep,
    resolved_cwd: process.cwd()
  };
  
  // セキュリティ統計
  const accessibleDirs = directoryInfos.filter(d => d.accessible);
  const readOnlyDirs = directoryInfos.filter(
    d => d.permissions.readable && !d.permissions.writable
  );
  
  const securityInfo = {
    total_directories: directoryInfos.length,
    accessible_directories: accessibleDirs.length,
    read_only_directories: readOnlyDirs.length
  };
  
  return {
    allowed_directories: directoryInfos,
    platform_info: platformInfo,
    security_info: securityInfo
  };
}
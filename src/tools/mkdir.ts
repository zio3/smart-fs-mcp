/**
 * Smart Filesystem MCP - Mkdir Tool
 * ディレクトリ作成ツール（改良版）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getSecurityController } from '../core/security-controller-v2.js';
import { createUnifiedError, type UnifiedError, ErrorCodes } from '../utils/unified-error-handler.js';

/**
 * mkdirパラメータ
 */
export interface MkdirParams {
  path: string;
  recursive?: boolean;
  mode?: string;
}

/**
 * mkdir結果
 */
export interface MkdirSuccessResult {
  success: true;
  status: 'success' | 'warning';
  directory_info: {
    path: string;
    resolved_path: string;
    created_new: boolean;
    parent_directories_created: string[];
    final_permissions: string;
  };
  warnings?: string[];
}

export type MkdirResult = MkdirSuccessResult | UnifiedError;

/**
 * ディレクトリを作成
 */
export async function mkdir(params: MkdirParams): Promise<MkdirResult> {
  const { path: targetPath, recursive = true, mode = '0755' } = params;
  const security = getSecurityController();
  
  // パラメータバリデーション
  if (!targetPath || typeof targetPath !== 'string') {
    return createUnifiedError(ErrorCodes.MISSING_PATH, 'パスが指定されていません');
  }
  
  // セキュリティチェック
  const validation = security.validateSecurePath(targetPath);
  if (!validation.allowed) {
    return createUnifiedError(ErrorCodes.ACCESS_DENIED, validation.reason || 'このパスへのアクセスは許可されていません', {
      attempted_path: targetPath,
      allowed_directories: security.getAllowedDirectories()
    });
  }
  
  const resolvedPath = validation.resolved_path;
  const parentDirsCreated: string[] = [];
  let createdNew = false;
  const warnings: string[] = [];
  
  try {
    // 既存チェック
    let exists = false;
    let existingStats: any = null;
    
    try {
      existingStats = await fs.stat(resolvedPath);
      exists = true;
    } catch (error) {
      // ファイルが存在しない（正常）
    }
    
    if (exists) {
      if (!existingStats.isDirectory()) {
        throw new Error('Path exists but is not a directory');
      }
      // 既存ディレクトリの場合は警告
      warnings.push('Directory already exists');
    } else {
      // 親ディレクトリの作成が必要かチェック
      if (recursive) {
        // 親ディレクトリを再帰的に作成
        const parentPath = path.dirname(resolvedPath);
        
        // 親ディレクトリが許可範囲内かチェック
        if (!security.isPathAllowed(parentPath)) {
          throw new Error('Parent directory outside allowed directories');
        }
        
        // 作成が必要な親ディレクトリをすべて特定
        const dirsToCreate: string[] = [];
        let currentPath = resolvedPath;
        
        while (currentPath !== path.dirname(currentPath)) {
          try {
            await fs.stat(currentPath);
            break; // 存在するディレクトリが見つかった
          } catch {
            dirsToCreate.unshift(currentPath);
            currentPath = path.dirname(currentPath);
          }
        }
        
        // 親ディレクトリから順に作成
        for (const dirPath of dirsToCreate) {
          if (dirPath !== resolvedPath) {
            // セキュリティチェック
            if (!security.isPathAllowed(dirPath)) {
              throw new Error(`Cannot create parent directory outside allowed paths: ${dirPath}`);
            }
            
            try {
              await fs.mkdir(dirPath, { mode: parseInt(mode, 8) });
              parentDirsCreated.push(dirPath);
            } catch (error) {
              // 並行処理で既に作成されている場合は無視
              if (error instanceof Error && !error.message.includes('EEXIST')) {
                throw error;
              }
            }
          }
        }
      }
      
      // ターゲットディレクトリを作成
      try {
        await fs.mkdir(resolvedPath, { 
          mode: parseInt(mode, 8),
          recursive: false // 親は既に作成済み
        });
        createdNew = true;
      } catch (error) {
        if (error instanceof Error && error.message.includes('EEXIST')) {
          // 並行処理で作成された場合
          warnings.push('Directory was created by another process');
        } else {
          throw error;
        }
      }
    }
    
    // 権限設定（Unix系のみ、新規作成時のみ）
    if (process.platform !== 'win32' && createdNew) {
      try {
        await fs.chmod(resolvedPath, parseInt(mode, 8));
      } catch (error) {
        warnings.push(`Failed to set permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Windows環境での権限設定に関する警告
    if (process.platform === 'win32' && mode !== '0755') {
      warnings.push('Custom permissions are not fully supported on Windows');
    }
    
    const result: MkdirSuccessResult = {
      success: true,
      status: warnings.length > 0 ? 'warning' : 'success',
      directory_info: {
        path: targetPath,
        resolved_path: resolvedPath,
        created_new: createdNew,
        parent_directories_created: parentDirsCreated,
        final_permissions: mode
      },
      warnings: warnings.length > 0 ? warnings : undefined
    };
    
    return result;
    
  } catch (error) {
    // エラーレスポンス
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // エラーコードの決定
    let errorCode: keyof typeof ErrorCodes = 'OPERATION_FAILED';
    if (errorMessage.includes('EEXIST')) {
      errorCode = 'DESTINATION_EXISTS';
    } else if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
      errorCode = 'FILE_NOT_FOUND';
    } else if (errorMessage.includes('EACCES') || errorMessage.includes('permission') || errorMessage.includes('access')) {
      errorCode = 'ACCESS_DENIED';
    } else if (errorMessage.includes('invalid') || errorMessage.includes('illegal')) {
      errorCode = 'INVALID_PATH';
    }
    
    // 一部の親ディレクトリは作成された可能性がある
    const additionalInfo: any = {
      attempted_path: targetPath,
      resolved_path: resolvedPath
    };
    
    if (parentDirsCreated.length > 0) {
      additionalInfo.partial_success = {
        parent_directories_created: parentDirsCreated,
        created_count: parentDirsCreated.length
      };
    }
    
    return createUnifiedError(ErrorCodes[errorCode], errorMessage, additionalInfo);
  }
}

/**
 * ディレクトリ作成のヘルパー関数（エラーをthrow）
 */
export async function mkdirOrThrow(params: MkdirParams): Promise<MkdirSuccessResult> {
  const result = await mkdir(params);
  
  if (!result.success) {
    const errorMessage = result.error.message || 'Failed to create directory';
    throw new Error(errorMessage);
  }
  
  return result;
}
/**
 * Smart Filesystem MCP - Delete File Tool
 * ファイル削除ツール（安全性重視）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getSecurityController } from '../core/security-controller-v2.js';
import { CRITICAL_FILE_PATTERNS } from '../utils/constants.js';
import type { DeleteFileParams, DeleteFileResult, FileImportance } from '../types/delete-operations.js';

/**
 * ファイルの重要度を評価する
 */
function assessFileImportance(filePath: string): FileImportance {
  const fileName = path.basename(filePath).toLowerCase();
  
  // Critical files check (exact match)
  if (CRITICAL_FILE_PATTERNS.CRITICAL_FILES.some(critical => 
    critical.toLowerCase() === fileName
  )) {
    return 'critical';
  }
  
  // Important patterns check (regex match)
  if (CRITICAL_FILE_PATTERNS.IMPORTANT_PATTERNS.some(pattern => 
    pattern.test(fileName)
  )) {
    return 'important';
  }
  
  return 'normal';
}

/**
 * ファイルの基本情報を取得する
 */
async function getFileBasicInfo(filePath: string) {
  try {
    const stats = await fs.stat(filePath);
    const mode = stats.mode;
    
    // Check if file is read-only (simplified check)
    const isReadOnly = process.platform === 'win32' 
      ? false // Windows read-only check is complex
      : (mode & parseInt('200', 8)) === 0; // Unix: owner write permission
    
    return {
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      isReadOnly,
      exists: true
    };
  } catch (error) {
    return {
      size: 0,
      lastModified: new Date().toISOString(),
      isReadOnly: false,
      exists: false
    };
  }
}

/**
 * 安全性情報を生成する
 */
function generateSafetyInfo(importance: FileImportance, filePath: string) {
  if (importance === 'normal') {
    return undefined;
  }
  
  const fileName = path.basename(filePath);
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  if (importance === 'critical') {
    warnings.push(`Critical file deleted: ${fileName}`);
    
    if (fileName === 'package.json') {
      warnings.push('This may break your project configuration');
      suggestions.push('Use move_file to create backup first');
      suggestions.push('Check git status to ensure file is tracked');
    } else if (fileName.startsWith('.env')) {
      warnings.push('Environment configuration file deleted');
      suggestions.push('Ensure you have backup of environment variables');
    } else if (fileName === 'README.md') {
      warnings.push('Project documentation file deleted');
      suggestions.push('Consider editing instead of deleting');
    } else {
      warnings.push('This file is essential for project functionality');
      suggestions.push('Consider creating backup before deletion');
    }
  } else if (importance === 'important') {
    warnings.push(`Important file deleted: ${fileName}`);
    
    if (fileName.includes('config')) {
      warnings.push('Configuration file deleted');
      suggestions.push('Ensure configuration can be recreated');
    } else if (fileName.includes('.key') || fileName.includes('.cert')) {
      warnings.push('Security credential file deleted');
      suggestions.push('Ensure you have secure backup of credentials');
    } else {
      warnings.push('This file may be important for project functionality');
    }
  }
  
  // Common suggestions
  suggestions.push('Verify you have recent project backup');
  suggestions.push('Check git status to see if file was tracked');
  
  return {
    file_importance: importance,
    backup_recommended: true,
    warnings
  };
}

/**
 * 削除エラーハンドリング
 */
function handleDeletionError(error: any, filePath: string): DeleteFileResult {
  const errorCode = error.code;
  const suggestions: string[] = [];
  
  if (errorCode === 'ENOENT') {
    return {
      status: 'error',
      deleted_file: {
        path: filePath,
        resolved_path: filePath,
        size_bytes: 0,
        last_modified: new Date().toISOString(),
        was_readonly: false
      },
      alternatives: {
        suggestions: [
          'File does not exist or has already been deleted',
          'Verify the path is correct',
          'Check for typos in the file path'
        ]
      }
    };
  }
  
  if (errorCode === 'EACCES' || errorCode === 'EPERM') {
    suggestions.push('Check file permissions');
    suggestions.push('Use force=true for readonly files');
    if (process.platform !== 'win32') {
      suggestions.push('Run with elevated privileges if necessary');
    }
    
    return {
      status: 'error',
      deleted_file: {
        path: filePath,
        resolved_path: filePath,
        size_bytes: 0,
        last_modified: new Date().toISOString(),
        was_readonly: true
      },
      alternatives: {
        suggestions
      }
    };
  }
  
  if (errorCode === 'EBUSY') {
    suggestions.push('File is currently in use by another process');
    suggestions.push('Close any applications using this file');
    suggestions.push('Try again after a few moments');
    
    return {
      status: 'error',
      deleted_file: {
        path: filePath,
        resolved_path: filePath,
        size_bytes: 0,
        last_modified: new Date().toISOString(),
        was_readonly: false
      },
      alternatives: {
        suggestions
      }
    };
  }
  
  // Generic error
  return {
    status: 'error',
    deleted_file: {
      path: filePath,
      resolved_path: filePath,
      size_bytes: 0,
      last_modified: new Date().toISOString(),
      was_readonly: false
    },
    alternatives: {
      suggestions: [
        `Deletion failed: ${error.message}`,
        'Verify file is not in use by another process',
        'Check disk space and permissions'
      ]
    }
  };
}

/**
 * ファイルを削除する
 */
export async function deleteFile(params: DeleteFileParams): Promise<DeleteFileResult> {
  const { path: targetPath, force = false } = params;
  const security = getSecurityController();
  
  try {
    // セキュリティチェック
    const validation = security.validateSecurePath(targetPath);
    if (!validation.allowed) {
      throw new Error(validation.reason || 'Access denied');
    }
    
    const resolvedPath = validation.resolved_path;
    
    // ファイル情報取得
    const fileInfo = await getFileBasicInfo(resolvedPath);
    if (!fileInfo.exists) {
      return handleDeletionError({ code: 'ENOENT' }, targetPath);
    }
    
    // 重要度評価
    const importance = assessFileImportance(resolvedPath);
    
    // 読み取り専用ファイルのチェック
    if (fileInfo.isReadOnly && !force) {
      return {
        status: 'error',
        deleted_file: {
          path: targetPath,
          resolved_path: resolvedPath,
          size_bytes: fileInfo.size,
          last_modified: fileInfo.lastModified,
          was_readonly: true
        },
        alternatives: {
          suggestions: [
            'File is read-only and cannot be deleted',
            'Use force=true to delete read-only files',
            'Check if file should remain read-only for protection'
          ]
        }
      };
    }
    
    // 実際にファイルを削除
    if (fileInfo.isReadOnly && force) {
      // 読み取り専用属性を一時的に解除（Windows）
      if (process.platform === 'win32') {
        try {
          await fs.chmod(resolvedPath, 0o666);
        } catch {
          // Ignore chmod errors on Windows
        }
      }
    }
    
    await fs.unlink(resolvedPath);
    
    // 成功レスポンス
    const safetyInfo = generateSafetyInfo(importance, resolvedPath);
    const status = safetyInfo ? 'warning' : 'success';
    
    const result: DeleteFileResult = {
      status,
      deleted_file: {
        path: targetPath,
        resolved_path: resolvedPath,
        size_bytes: fileInfo.size,
        last_modified: fileInfo.lastModified,
        was_readonly: fileInfo.isReadOnly
      }
    };
    
    if (safetyInfo) {
      result.safety_info = safetyInfo;
      
      // 重要ファイルの場合は代替案も提供
      if (importance === 'critical') {
        result.alternatives = {
          suggestions: [
            'Consider using version control to track this deletion',
            'Ensure you can recreate this file if needed',
            'Document why this file was deleted'
          ]
        };
      }
    }
    
    return result;
    
  } catch (error) {
    return handleDeletionError(error, targetPath);
  }
}

/**
 * ファイル削除のヘルパー関数（エラーをthrow）
 */
export async function deleteFileOrThrow(params: DeleteFileParams): Promise<DeleteFileResult> {
  const result = await deleteFile(params);
  
  if (result.status === 'error') {
    const errorMessage = result.alternatives?.suggestions?.join('; ') || 'Failed to delete file';
    throw new Error(errorMessage);
  }
  
  return result;
}
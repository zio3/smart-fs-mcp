/**
 * Smart Filesystem MCP - Unified Delete Error Builder
 * Simplified error response generation for file/directory deletion
 */

import * as path from 'path';
import type { DeleteFailure } from './types.js';

export class DeleteErrorBuilder {
  /**
   * Build not found error response
   */
  static async buildNotFoundError(targetPath: string, type: 'file' | 'directory'): Promise<DeleteFailure> {
    const parentDir = path.dirname(targetPath);
    const baseName = path.basename(targetPath);
    
    return {
      success: false,
      failedInfo: {
        reason: 'not_found',
        message: `${type === 'file' ? 'ファイル' : 'ディレクトリ'}が見つかりません: ${targetPath}`,
        target_info: {
          path: targetPath,
          type,
          exists: false
        },
        solutions: [
          {
            method: 'list_directory',
            params: { path: parentDir },
            description: '親ディレクトリの内容を確認'
          },
          {
            method: 'search_content',
            params: { 
              file_pattern: baseName,
              directory: parentDir 
            },
            description: '類似ファイル名を検索'
          }
        ]
      }
    };
  }
  
  /**
   * Build permission denied error response
   */
  static async buildPermissionError(targetPath: string, type: 'file' | 'directory'): Promise<DeleteFailure> {
    return {
      success: false,
      failedInfo: {
        reason: 'permission_denied',
        message: `削除権限がありません: ${targetPath}`,
        target_info: {
          path: targetPath,
          type,
          exists: true
        },
        solutions: [
          {
            method: `delete_${type}`,
            params: { path: targetPath, force: true },
            description: '強制削除を実行（注意：読み取り専用属性を無視）'
          },
          {
            method: 'file_info',
            params: { path: targetPath },
            description: 'ファイル権限の詳細を確認'
          }
        ]
      }
    };
  }
  
  /**
   * Build file/directory in use error response
   */
  static async buildInUseError(targetPath: string, type: 'file' | 'directory'): Promise<DeleteFailure> {
    return {
      success: false,
      failedInfo: {
        reason: 'in_use',
        message: `${type === 'file' ? 'ファイル' : 'ディレクトリ'}が他のプロセスで使用中です: ${targetPath}`,
        target_info: {
          path: targetPath,
          type,
          exists: true
        },
        solutions: [
          {
            method: `delete_${type}`,
            params: { path: targetPath, force: true },
            description: '強制削除を試行（リスク：データ破損の可能性）'
          },
          {
            method: 'file_info',
            params: { path: targetPath },
            description: 'ファイル状態の詳細確認'
          }
        ]
      }
    };
  }
  
  /**
   * Build directory not empty error response
   */
  static async buildNotEmptyError(targetPath: string): Promise<DeleteFailure> {
    return {
      success: false,
      failedInfo: {
        reason: 'not_empty',
        message: `ディレクトリが空ではありません: ${targetPath}`,
        target_info: {
          path: targetPath,
          type: 'directory',
          exists: true
        },
        solutions: [
          {
            method: 'delete_directory',
            params: { path: targetPath, recursive: true },
            description: '再帰的に削除（内容すべて削除）'
          },
          {
            method: 'list_directory',
            params: { path: targetPath },
            description: 'ディレクトリ内容を確認してから個別削除'
          }
        ]
      }
    };
  }
  
  /**
   * Build read-only error response
   */
  static async buildReadOnlyError(targetPath: string, type: 'file' | 'directory'): Promise<DeleteFailure> {
    return {
      success: false,
      failedInfo: {
        reason: 'read_only',
        message: `${type === 'file' ? 'ファイル' : 'ディレクトリ'}は読み取り専用です: ${targetPath}`,
        target_info: {
          path: targetPath,
          type,
          exists: true
        },
        solutions: [
          {
            method: `delete_${type}`,
            params: { path: targetPath, force: true },
            description: '強制削除（読み取り専用属性を解除して削除）'
          },
          {
            method: 'file_info',
            params: { path: targetPath },
            description: '属性の詳細を確認'
          }
        ]
      }
    };
  }
  
  /**
   * Build invalid target error response
   */
  static async buildInvalidTargetError(
    targetPath: string, 
    expectedType: 'file' | 'directory',
    actualType: 'file' | 'directory'
  ): Promise<DeleteFailure> {
    return {
      success: false,
      failedInfo: {
        reason: 'invalid_target',
        message: `${expectedType === 'file' ? 'ファイル' : 'ディレクトリ'}削除に${actualType === 'file' ? 'ファイル' : 'ディレクトリ'}パスが指定されました`,
        target_info: {
          path: targetPath,
          type: actualType,
          exists: true
        },
        solutions: [
          {
            method: `delete_${actualType}`,
            params: actualType === 'directory' 
              ? { path: targetPath, recursive: false }
              : { path: targetPath },
            description: `${actualType === 'file' ? 'ファイル' : 'ディレクトリ'}削除として実行`
          }
        ]
      }
    };
  }
  
  /**
   * Build unknown error response
   */
  static async buildUnknownError(
    targetPath: string, 
    type: 'file' | 'directory',
    error: Error
  ): Promise<DeleteFailure> {
    return {
      success: false,
      failedInfo: {
        reason: 'unknown_error',
        message: `削除中にエラーが発生しました: ${error.message}`,
        target_info: { 
          path: targetPath, 
          type, 
          exists: false 
        },
        solutions: [
          {
            method: 'file_info',
            params: { path: targetPath },
            description: `${type === 'file' ? 'ファイル' : 'ディレクトリ'}状態を確認`
          }
        ]
      }
    };
  }
}
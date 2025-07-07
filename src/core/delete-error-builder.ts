/**
 * Smart Filesystem MCP - Unified Delete Error Builder
 * Simplified error response generation for file/directory deletion
 */

import { createUnifiedError, ErrorCodes } from '../utils/unified-error-handler.js';
import type { UnifiedError } from '../utils/unified-error-handler.js';

export class DeleteErrorBuilder {
  /**
   * Build not found error response
   */
  static buildNotFoundError(targetPath: string, type: 'file' | 'directory'): UnifiedError {
    return createUnifiedError(
      ErrorCodes.FILE_NOT_FOUND,
      `delete_${type}`,
      {
        path: targetPath,
        target_type: type,
        exists: false
      },
      `${type === 'file' ? 'ファイル' : 'ディレクトリ'}が見つかりません: ${targetPath}`,
      [
        '親ディレクトリの内容を確認してください',
        '類似ファイル名を検索してください'
      ]
    );
  }
  
  /**
   * Build permission denied error response
   */
  static buildPermissionError(targetPath: string, type: 'file' | 'directory'): UnifiedError {
    return createUnifiedError(
      ErrorCodes.ACCESS_DENIED,
      `delete_${type}`,
      {
        path: targetPath,
        target_type: type,
        exists: true
      },
      `削除権限がありません: ${targetPath}`,
      [
        '強制削除を実行してください（注意：読み取り専用属性を無視）',
        'ファイル権限の詳細を確認してください'
      ]
    );
  }
  
  /**
   * Build file/directory in use error response
   */
  static buildInUseError(targetPath: string, type: 'file' | 'directory'): UnifiedError {
    return createUnifiedError(
      ErrorCodes.OPERATION_FAILED,
      `delete_${type}`,
      {
        path: targetPath,
        target_type: type,
        exists: true,
        reason: 'in_use'
      },
      `${type === 'file' ? 'ファイル' : 'ディレクトリ'}が他のプロセスで使用中です: ${targetPath}`,
      [
        '強制削除を試行してください（リスク：データ破損の可能性）',
        'ファイル状態の詳細を確認してください'
      ]
    );
  }
  
  /**
   * Build directory not empty error response
   */
  static buildNotEmptyError(targetPath: string): UnifiedError {
    return createUnifiedError(
      ErrorCodes.DIRECTORY_NOT_EMPTY,
      'delete_directory',
      {
        path: targetPath,
        target_type: 'directory',
        exists: true
      },
      `ディレクトリが空ではありません: ${targetPath}`,
      [
        '再帰的に削除してください（内容すべて削除）',
        'ディレクトリ内容を確認してから個別削除してください'
      ]
    );
  }
  
  /**
   * Build read-only error response
   */
  static buildReadOnlyError(targetPath: string, type: 'file' | 'directory'): UnifiedError {
    return createUnifiedError(
      ErrorCodes.ACCESS_DENIED,
      `delete_${type}`,
      {
        path: targetPath,
        target_type: type,
        exists: true,
        reason: 'read_only'
      },
      `${type === 'file' ? 'ファイル' : 'ディレクトリ'}は読み取り専用です: ${targetPath}`,
      [
        '強制削除（読み取り専用属性を解除して削除）',
        '属性の詳細を確認してください'
      ]
    );
  }
  
  /**
   * Build invalid target error response
   */
  static buildInvalidTargetError(
    targetPath: string, 
    expectedType: 'file' | 'directory',
    actualType: 'file' | 'directory'
  ): UnifiedError {
    return createUnifiedError(
      ErrorCodes.INVALID_PARAMETER,
      `delete_${expectedType}`,
      {
        path: targetPath,
        expected_type: expectedType,
        actual_type: actualType,
        exists: true
      },
      `${expectedType === 'file' ? 'ファイル' : 'ディレクトリ'}削除に${actualType === 'file' ? 'ファイル' : 'ディレクトリ'}パスが指定されました`,
      [
        `${actualType === 'file' ? 'ファイル' : 'ディレクトリ'}削除として実行してください`
      ]
    );
  }
  
  /**
   * Build unknown error response
   */
  static buildUnknownError(
    targetPath: string, 
    type: 'file' | 'directory',
    error: Error
  ): UnifiedError {
    return createUnifiedError(
      ErrorCodes.OPERATION_FAILED,
      `delete_${type}`,
      {
        path: targetPath,
        target_type: type,
        exists: false,
        error_message: error.message
      },
      `削除中にエラーが発生しました: ${error.message}`,
      [
        `${type === 'file' ? 'ファイル' : 'ディレクトリ'}状態を確認してください`
      ]
    );
  }
}
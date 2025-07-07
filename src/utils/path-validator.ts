/**
 * Smart Filesystem MCP - Path Validation Utility
 * 絶対パス限定バリデーション（セキュリティ強化）
 */

import * as path from 'path';
import { createUnifiedError, ErrorCodes } from './unified-error-handler.js';
import type { UnifiedError } from './unified-error-handler.js';

/**
 * パス検証エラーレスポンス
 * @deprecated Use UnifiedError instead
 */
export interface PathValidationError {
  success: false;
  failedInfo: {
    reason: 'path_not_absolute';
    message: string;
    provided_path: string;
    absolute_path: string;
    solutions: any[];
  };
}

/**
 * 絶対パス検証結果
 */
export interface PathValidationResult {
  isValid: boolean;
  absolutePath: string;
  error?: UnifiedError;
}

/**
 * 絶対パス検証（BREAKING CHANGE: 相対パス完全拒否）
 */
export function validateAbsolutePath(inputPath: string, operation: string = 'operation'): PathValidationResult {
  // 空パスチェック
  if (!inputPath || inputPath.trim() === '') {
    const error = createUnifiedError(
      ErrorCodes.MISSING_PATH,
      operation,
      {
        provided_path: inputPath,
        absolute_path: process.cwd()
      },
      'パスが空です。絶対パスを指定してください。',
      [
        `絶対パス「${process.cwd()}」を使用`,
        '有効な絶対パスを指定してください'
      ]
    );
    return {
      isValid: false,
      absolutePath: process.cwd(),
      error
    };
  }

  const trimmedPath = inputPath.trim();
  
  // 絶対パスチェック
  if (!path.isAbsolute(trimmedPath)) {
    const absolutePath = path.resolve(trimmedPath);
    const error = createUnifiedError(
      ErrorCodes.PATH_NOT_ABSOLUTE,
      operation,
      {
        provided_path: trimmedPath,
        absolute_path: absolutePath
      },
      '相対パスは受け付けません。絶対パスを使用してください。',
      [
        `絶対パス「${absolutePath}」で再実行`,
        '現在のディレクトリから絶対パスを確認'
      ]
    );
    
    return {
      isValid: false,
      absolutePath,
      error
    };
  }

  // 正規化（冗長な . や .. を解決）
  const normalizedPath = path.normalize(trimmedPath);
  
  return {
    isValid: true,
    absolutePath: normalizedPath
  };
}

/**
 * 複数パス一括検証
 */
export function validateMultiplePaths(paths: string[], operation: string = 'operation'): {
  isValid: boolean;
  validatedPaths: string[];
  errors: UnifiedError[];
} {
  const validatedPaths: string[] = [];
  const errors: UnifiedError[] = [];
  
  for (const inputPath of paths) {
    const result = validateAbsolutePath(inputPath, operation);
    if (result.isValid) {
      validatedPaths.push(result.absolutePath);
    } else if (result.error) {
      errors.push(result.error);
    }
  }
  
  return {
    isValid: errors.length === 0,
    validatedPaths,
    errors
  };
}

/**
 * パス検証ヘルパー（Express Middleware用）
 */
export function createPathValidationResponse(inputPath: string, operation: string): UnifiedError | null {
  const result = validateAbsolutePath(inputPath, operation);
  return result.error || null;
}

/**
 * レガシーエラー形式への変換（後方互換性のため一時的に保持）
 * @deprecated Will be removed in next major version
 */
export function createLegacyPathError(error: UnifiedError): PathValidationError {
  return {
    success: false,
    failedInfo: {
      reason: 'path_not_absolute',
      message: error.error.message,
      provided_path: error.error.details.provided_path || '',
      absolute_path: error.error.details.absolute_path || process.cwd(),
      solutions: error.error.suggestions.map(suggestion => ({
        method: error.error.details.operation,
        params: { path: error.error.details.absolute_path || process.cwd() },
        description: suggestion,
        priority: 'high' as const
      }))
    }
  };
}
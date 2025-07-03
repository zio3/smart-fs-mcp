/**
 * Smart Filesystem MCP - Path Validation Utility
 * 絶対パス限定バリデーション（セキュリティ強化）
 */

import * as path from 'path';
import type { PrioritizedSolution } from '../core/types.js';

/**
 * パス検証エラーレスポンス
 */
export interface PathValidationError {
  success: false;
  failedInfo: {
    reason: 'path_not_absolute';
    message: string;
    provided_path: string;
    absolute_path: string;
    solutions: PrioritizedSolution[];
  };
}

/**
 * 絶対パス検証結果
 */
export interface PathValidationResult {
  isValid: boolean;
  absolutePath: string;
  error?: PathValidationError;
}

/**
 * 絶対パス検証（BREAKING CHANGE: 相対パス完全拒否）
 */
export function validateAbsolutePath(inputPath: string, operation: string = 'operation'): PathValidationResult {
  // 空パスチェック
  if (!inputPath || inputPath.trim() === '') {
    const error: PathValidationError = {
      success: false,
      failedInfo: {
        reason: 'path_not_absolute',
        message: 'パスが空です。絶対パスを指定してください。',
        provided_path: inputPath,
        absolute_path: process.cwd(),
        solutions: [
          {
            method: operation,
            params: { path: process.cwd() },
            description: '現在のディレクトリを使用',
            priority: 'high'
          }
        ]
      }
    };
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
    const error: PathValidationError = {
      success: false,
      failedInfo: {
        reason: 'path_not_absolute',
        message: `相対パスは受け付けません。絶対パスを使用してください。（BREAKING CHANGE）`,
        provided_path: trimmedPath,
        absolute_path: absolutePath,
        solutions: [
          {
            method: operation,
            params: { path: absolutePath },
            description: `絶対パス「${absolutePath}」で再実行`,
            priority: 'high'
          },
          {
            method: 'list_directory',
            params: { path: process.cwd() },
            description: '現在のディレクトリから絶対パスを確認',
            priority: 'medium'
          }
        ]
      }
    };
    
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
  errors: PathValidationError[];
} {
  const validatedPaths: string[] = [];
  const errors: PathValidationError[] = [];
  
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
export function createPathValidationResponse(inputPath: string, operation: string): PathValidationError | null {
  const result = validateAbsolutePath(inputPath, operation);
  return result.error || null;
}
/**
 * Smart Filesystem MCP - Security Controller V2
 * 基盤セキュリティ機能（公式FileSystemMCP準拠）
 */

import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * セキュリティ検証結果
 */
export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  resolved_path: string;
}

/**
 * セキュリティエラー
 */
export class SecurityError extends Error {
  constructor(message: string, public readonly attemptedPath?: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * セキュリティコントローラー V2
 * 許可ディレクトリ制限とパストラバーサル防止
 */
export class SecurityControllerV2 {
  private allowedDirectories: string[] = [];
  private resolvedAllowedDirs: string[] = [];
  
  constructor() {
    // 起動時引数から許可ディレクトリを取得
    const args = process.argv.slice(2);
    if (args.length > 0) {
      this.allowedDirectories = args;
      this.resolvedAllowedDirs = args.map(dir => path.resolve(dir));
    } else {
      // デフォルト: カレントディレクトリのみ許可
      this.allowedDirectories = [process.cwd()];
      this.resolvedAllowedDirs = [process.cwd()];
    }
  }
  
  /**
   * 許可ディレクトリのリストを取得
   */
  getAllowedDirectories(): string[] {
    return [...this.allowedDirectories];
  }
  
  /**
   * 解決済み許可ディレクトリのリストを取得
   */
  getResolvedAllowedDirectories(): string[] {
    return [...this.resolvedAllowedDirs];
  }
  
  /**
   * パスが許可されているかチェック
   */
  isPathAllowed(targetPath: string): boolean {
    try {
      const resolvedPath = path.resolve(targetPath);
      
      return this.resolvedAllowedDirs.some(allowedDir => {
        // Windows環境では大文字小文字を無視
        if (process.platform === 'win32') {
          const resolvedLower = resolvedPath.toLowerCase();
          const allowedLower = allowedDir.toLowerCase();
          
          // 同じディレクトリか、サブディレクトリかをチェック
          return resolvedLower === allowedLower ||
                 resolvedLower.startsWith(allowedLower + path.sep);
        } else {
          // Unix系は大文字小文字を区別
          return resolvedPath === allowedDir ||
                 resolvedPath.startsWith(allowedDir + path.sep);
        }
      });
    } catch {
      return false;
    }
  }
  
  /**
   * セキュアなパス検証
   */
  validateSecurePath(inputPath: string): ValidationResult {
    try {
      // パストラバーサル攻撃チェック
      if (inputPath.includes('..')) {
        return {
          allowed: false,
          reason: 'Path traversal attempt detected (contains "..")',
          resolved_path: ''
        };
      }
      
      // null文字チェック
      if (inputPath.includes('\0')) {
        return {
          allowed: false,
          reason: 'Invalid path: contains null character',
          resolved_path: ''
        };
      }
      
      // パスを解決
      const resolvedPath = path.resolve(inputPath);
      
      // 許可ディレクトリチェック
      if (!this.isPathAllowed(resolvedPath)) {
        return {
          allowed: false,
          reason: `Access denied: path outside allowed directories`,
          resolved_path: resolvedPath
        };
      }
      
      return {
        allowed: true,
        resolved_path: resolvedPath
      };
    } catch (error) {
      return {
        allowed: false,
        reason: `Invalid path: ${error instanceof Error ? error.message : 'Unknown error'}`,
        resolved_path: ''
      };
    }
  }
  
  /**
   * アクセス検証（操作タイプ別）
   */
  async validateAccess(
    targetPath: string, 
    operation: 'read' | 'write' | 'delete' | 'create'
  ): Promise<ValidationResult> {
    // まずパス検証
    const pathValidation = this.validateSecurePath(targetPath);
    if (!pathValidation.allowed) {
      return pathValidation;
    }
    
    const resolvedPath = pathValidation.resolved_path;
    
    try {
      // ファイル/ディレクトリの存在確認
      const stats = await fs.stat(resolvedPath).catch(() => null);
      
      if (operation === 'read' && !stats) {
        return {
          allowed: false,
          reason: 'File or directory not found',
          resolved_path: resolvedPath
        };
      }
      
      if (operation === 'create' && stats) {
        return {
          allowed: false,
          reason: 'Path already exists',
          resolved_path: resolvedPath
        };
      }
      
      // 書き込み操作の場合、親ディレクトリの書き込み権限もチェック
      if (operation === 'write' || operation === 'create' || operation === 'delete') {
        const parentDir = path.dirname(resolvedPath);
        if (!this.isPathAllowed(parentDir)) {
          return {
            allowed: false,
            reason: 'Parent directory outside allowed directories',
            resolved_path: resolvedPath
          };
        }
      }
      
      return {
        allowed: true,
        resolved_path: resolvedPath
      };
    } catch (error) {
      return {
        allowed: false,
        reason: `Access validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        resolved_path: resolvedPath
      };
    }
  }
  
  /**
   * セキュア実行ラッパー
   */
  async executeWithSecurity<T>(
    targetPath: string,
    operation: 'read' | 'write' | 'delete' | 'create',
    callback: (validatedPath: string) => Promise<T>
  ): Promise<T> {
    const validation = await this.validateAccess(targetPath, operation);
    
    if (!validation.allowed) {
      throw new SecurityError(
        validation.reason || 'Access denied',
        targetPath
      );
    }
    
    return await callback(validation.resolved_path);
  }
  
  /**
   * エラーレスポンス生成
   */
  createSecurityErrorResponse(error: SecurityError | Error, attemptedPath?: string): any {
    const isSecurityError = error instanceof SecurityError;
    
    return {
      error: isSecurityError ? 'Access denied' : 'Security validation failed',
      reason: error.message,
      allowed_directories: this.allowedDirectories,
      attempted_path: attemptedPath || (isSecurityError ? error.attemptedPath : undefined),
      suggestion: 'Use list_allowed_directories to see accessible paths'
    };
  }
}

// シングルトンインスタンス
let securityInstance: SecurityControllerV2 | null = null;

/**
 * SecurityControllerのインスタンスを取得
 */
export function getSecurityController(): SecurityControllerV2 {
  if (!securityInstance) {
    securityInstance = new SecurityControllerV2();
  }
  return securityInstance;
}

/**
 * セキュリティコントローラーを初期化（テスト用）
 */
export function initializeSecurityController(allowedDirs?: string[]): SecurityControllerV2 {
  if (allowedDirs) {
    // テスト用: process.argvを一時的に変更
    const originalArgv = process.argv;
    process.argv = [process.argv[0] || '', process.argv[1] || '', ...allowedDirs];
    securityInstance = new SecurityControllerV2();
    process.argv = originalArgv;
  } else {
    securityInstance = new SecurityControllerV2();
  }
  return securityInstance;
}
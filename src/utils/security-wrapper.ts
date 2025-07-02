/**
 * Smart Filesystem MCP - Security Wrapper
 * セキュリティチェックを既存ツールに統合するためのヘルパー
 */

import { getSecurityController } from '../core/security-controller-v2.js';
import { SafetyController } from '../core/safety-controller.js';
import { FileAnalyzer } from '../core/file-analyzer.js';
import type { 
  ReadFileParams,
  ReadFileForceParams,
  ListDirectoryParams,
  SearchContentParams,
  WriteFileParams,
  EditFileParams,
  MoveFileParams
} from '../core/types.js';

/**
 * 読み取り操作用セキュリティラッパー
 */
export async function withReadSecurity<T>(
  params: { path: string },
  operation: (validatedPath: string, safety: SafetyController, analyzer: FileAnalyzer) => Promise<T>,
  safety: SafetyController,
  analyzer: FileAnalyzer
): Promise<T> {
  const security = getSecurityController();
  
  return security.executeWithSecurity(
    params.path,
    'read',
    async (validatedPath) => {
      // 検証済みパスで元の関数を実行
      const modifiedParams = { ...params, path: validatedPath };
      return operation(validatedPath, safety, analyzer);
    }
  );
}

/**
 * 書き込み操作用セキュリティラッパー
 */
export async function withWriteSecurity<T>(
  params: { path: string } | { source: string; destination: string },
  operation: (validatedParams: any, safety: SafetyController, analyzer?: FileAnalyzer) => Promise<T>,
  safety: SafetyController,
  analyzer?: FileAnalyzer
): Promise<T> {
  const security = getSecurityController();
  
  // move_fileの場合は両方のパスをチェック
  if ('source' in params && 'destination' in params) {
    // sourceの読み取り権限チェック
    await security.validateAccess(params.source, 'read');
    
    // destinationの書き込み権限チェック
    return security.executeWithSecurity(
      params.destination,
      'write',
      async (validatedDest) => {
        const validatedSource = await security.validateAccess(params.source, 'read')
          .then(v => v.resolved_path);
        
        const modifiedParams = {
          ...params,
          source: validatedSource,
          destination: validatedDest
        };
        
        return analyzer ? 
          operation(modifiedParams, safety, analyzer) :
          operation(modifiedParams, safety);
      }
    );
  }
  
  // 通常の書き込み操作
  return security.executeWithSecurity(
    params.path,
    'write',
    async (validatedPath) => {
      const modifiedParams = { ...params, path: validatedPath };
      return analyzer ? 
        operation(modifiedParams, safety, analyzer) :
        operation(modifiedParams, safety);
    }
  );
}

/**
 * ディレクトリ操作用セキュリティラッパー
 */
export async function withDirectorySecurity<T>(
  params: ListDirectoryParams | SearchContentParams,
  operation: (validatedParams: any, safety: SafetyController) => Promise<T>,
  safety: SafetyController
): Promise<T> {
  const security = getSecurityController();
  
  // SearchContentParamsの場合
  if ('directory' in params) {
    const targetDir = params.directory || process.cwd();
    
    return security.executeWithSecurity(
      targetDir,
      'read',
      async (validatedPath) => {
        const modifiedParams = { ...params, directory: validatedPath };
        return operation(modifiedParams, safety);
      }
    );
  }
  
  // ListDirectoryParamsの場合
  return security.executeWithSecurity(
    params.path,
    'read',
    async (validatedPath) => {
      const modifiedParams = { ...params, path: validatedPath };
      return operation(modifiedParams, safety);
    }
  );
}

/**
 * エラーレスポンスにセキュリティ情報を追加
 */
export function enhanceErrorWithSecurity(error: Error, attemptedPath?: string): Error {
  const security = getSecurityController();
  
  // SecurityErrorの場合は専用のレスポンスを生成
  if (error.name === 'SecurityError') {
    const securityResponse = security.createSecurityErrorResponse(error, attemptedPath);
    const enhancedError = new Error(JSON.stringify(securityResponse, null, 2));
    enhancedError.name = 'SecurityError';
    return enhancedError;
  }
  
  return error;
}
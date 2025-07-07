/**
 * Smart Filesystem MCP API - Unified Error Handler
 * Centralized error handling middleware using failedInfo format
 */

import { Request, Response, NextFunction } from 'express';
import type { PrioritizedSolution } from '../../core/types.js';

/**
 * Unified error response format (matching MCP tools)
 * @deprecated Use UnifiedError from unified-error-handler instead
 */
export interface UnifiedErrorResponse {
  success: false;
  failedInfo: {
    reason: string;
    message: string;
    solutions: PrioritizedSolution[];
    error_code?: string;
    details?: unknown;
  };
}

/**
 * HTTP status codes for different error types
 */
const ERROR_STATUS_MAP: Record<string, number> = {
  // File system errors
  ENOENT: 404,
  EACCES: 403,
  EPERM: 403,
  EISDIR: 400,
  ENOTDIR: 400,
  EEXIST: 409,
  ENOTEMPTY: 409,
  EMFILE: 429,
  ENFILE: 429,
  ENOSPC: 507,
  
  // Application errors
  VALIDATION_ERROR: 400,
  SAFETY_VIOLATION: 400,
  SIZE_EXCEEDED: 413,
  TOKEN_LIMIT_EXCEEDED: 413,
  BINARY_FILE_DETECTED: 415,
  TIMEOUT: 408,
  RATE_LIMITED: 429,
  
  // Security errors
  SecurityError: 403,
  PATH_TRAVERSAL: 403,
  ACCESS_DENIED: 403,
  
  // Generic errors
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500
};

/**
 * Map error codes to failedInfo reasons
 */
function mapErrorToReason(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'unknown_error';
  }

  const err = error as Record<string, any>;
  
  if (err.code === 'ENOENT') return 'not_found';
  if (err.code === 'EACCES' || err.code === 'EPERM') return 'permission_denied';
  if (err.code === 'VALIDATION_ERROR' || err.name === 'ValidationError') return 'validation_error';
  if (err.code === 'SIZE_EXCEEDED') return 'size_exceeded';
  if (err.code === 'BINARY_FILE_DETECTED') return 'binary_file';
  if (err.name === 'SecurityError') return 'permission_denied';
  
  return 'unknown_error';
}

/**
 * Map legacy error reasons to unified error codes
 */
function mapErrorCodeToUnified(reason: string): string {
  const reasonMap: Record<string, string> = {
    'not_found': 'file_not_found',
    'permission_denied': 'access_denied',
    'validation_error': 'invalid_parameter',
    'size_exceeded': 'file_too_large',
    'binary_file': 'invalid_file_type',
    'unknown_error': 'operation_failed'
  };
  
  return reasonMap[reason] || 'operation_failed';
}

/**
 * Generate LLM-optimized solutions based on error type
 */
function generateErrorSolutions(error: unknown, req: Request): PrioritizedSolution[] {
  const solutions: PrioritizedSolution[] = [];
  
  if (typeof error !== 'object' || error === null) {
    solutions.push({
      method: 'check_documentation',
      params: { url: '/api-docs' },
      description: 'APIドキュメントでエラーの詳細を確認',
      priority: 'high'
    });
    return solutions;
  }

  const err = error as Record<string, any>;

  if (err.code === 'ENOENT') {
    solutions.push(
      {
        method: 'list_directory',
        params: { path: '/' },
        description: 'ファイルやディレクトリの存在を確認',
        priority: 'high'
      },
      {
        method: 'file_info',
        params: { path: req.query.path || req.body?.path || '/tmp/example.txt' },
        description: 'パスの詳細情報を取得',
        priority: 'medium'
      }
    );
  } else if (err.code === 'EACCES' || err.code === 'EPERM') {
    solutions.push(
      {
        method: 'file_info',
        params: { path: req.query.path || req.body?.path || '/tmp/example.txt' },
        description: 'ファイルの権限情報を確認',
        priority: 'high'
      },
      {
        method: 'list_allowed_dirs',
        params: {},
        description: 'アクセス可能なディレクトリを確認',
        priority: 'medium'
      }
    );
  } else if (err.code === 'EISDIR') {
    solutions.push({
      method: 'list_directory',
      params: { path: req.query.path || req.body?.path || '/tmp' },
      description: 'ディレクトリ操作用のAPIを使用',
      priority: 'high'
    });
  } else if (err.code === 'ENOTDIR') {
    solutions.push({
      method: 'file_info',
      params: { path: req.query.path || req.body?.path || '/tmp/example.txt' },
      description: 'ファイル操作用のAPIを使用',
      priority: 'high'
    });
  } else if (err.code === 'EEXIST') {
    const path = req.query.path || req.body?.path || req.body?.destination;
    solutions.push(
      {
        method: req.method === 'POST' && req.path.includes('files') ? 'write_file' : 'mkdir',
        params: { 
          path, 
          ...(req.method === 'POST' && req.path.includes('files') ? { overwrite: true } : {})
        },
        description: '既存ファイルを上書きして実行',
        priority: 'high'
      },
      {
        method: 'file_info',
        params: { path },
        description: '既存ファイルの情報を確認',
        priority: 'medium'
      }
    );
  } else if (typeof err.message === 'string' && err.message.includes('Size exceeded')) {
    solutions.push(
      {
        method: 'read_file',
        params: { 
          path: req.query.path || req.body?.path || '/tmp/example.txt',
          force: true
        },
        description: '制限を無視して強制読み取り',
        priority: 'high'
      },
      {
        method: 'search_content',
        params: { 
          file_pattern: 'target_file',
          content_pattern: 'function.*|class.*|export.*'
        },
        description: '特定パターンのみ検索',
        priority: 'medium'
      }
    );
  } else if (typeof err.message === 'string' && err.message.includes('Binary file')) {
    solutions.push(
      {
        method: 'file_info',
        params: { path: req.query.path || req.body?.path || '/tmp/example.bin' },
        description: 'バイナリファイルのメタデータを取得',
        priority: 'high'
      }
    );
  } else if (err.name === 'SecurityError') {
    solutions.push(
      {
        method: 'list_allowed_dirs',
        params: {},
        description: 'アクセス可能なディレクトリ一覧を確認',
        priority: 'high'
      },
      {
        method: 'check_documentation',
        params: { url: '/api-docs' },
        description: 'セキュリティ制限についてドキュメントを確認',
        priority: 'medium'
      }
    );
  }
  
  // Generic fallback solution
  if (solutions.length === 0) {
    solutions.push({
      method: 'check_documentation',
      params: { url: '/api-docs' },
      description: 'SwaggerUIでAPIの詳細を確認',
      priority: 'high'
    });
  }

  return solutions;
}

/**
 * Main error handling middleware (BREAKING CHANGE: failedInfo format only)
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log error for debugging
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] Error in ${req.method} ${req.path}:`, {
    requestId,
    error: (error instanceof Error) ? error.message : String(error),
    stack: (error instanceof Error) ? error.stack : undefined,
    code: (error instanceof Error && 'code' in error) ? (error as any).code : undefined,
    name: (error instanceof Error) ? error.name : undefined
  });

  // Determine HTTP status code
  let statusCode = 500;
  
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, any>;
    if (err.code && ERROR_STATUS_MAP[err.code]) {
      statusCode = ERROR_STATUS_MAP[err.code] || 500;
    } else if (err.name && ERROR_STATUS_MAP[err.name]) {
      statusCode = ERROR_STATUS_MAP[err.name] || 500;
    } else if (err.status) {
      statusCode = err.status;
    } else if (err.name === 'ValidationError') {
      // Handle ValidationError from validator middleware
      statusCode = 400;
    }
  }

  // Generate appropriate error message
  let message = (error instanceof Error) ? error.message : 'An unexpected error occurred';
  
  // Don't expose internal errors in production
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal server error';
  }

  // Map to unified reason
  const reason = mapErrorToReason(error);

  // Generate LLM-optimized solutions
  const solutions = generateErrorSolutions(error, req);

  // Create unified error response (統一エラー形式に移行)
  const errorResponse = {
    success: false,
    error: {
      code: mapErrorCodeToUnified(reason),
      message,
      details: {
        operation: req.path,
        method: req.method,
        ...(req.query.path && { path: req.query.path }),
        ...(req.body?.path && { path: req.body.path })
      },
      suggestions: solutions.map(s => s.description)
    }
  };

  // Send unified error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a standardized error response (for manual error creation)
 * @deprecated Use createUnifiedError from unified-error-handler instead
 */
export function createUnifiedErrorResponse(
  reason: string,
  message: string,
  solutions: PrioritizedSolution[] = [],
  errorCode?: string
): UnifiedErrorResponse {
  return {
    success: false,
    failedInfo: {
      reason,
      message,
      solutions,
      ...(errorCode && { error_code: errorCode })
    }
  };
}
/**
 * Smart Filesystem MCP API - Error Handler
 * Centralized error handling middleware for Express API
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    suggestions?: string[];
    details?: any;
  };
  meta: {
    timestamp: string;
    version: string;
    requestId?: string;
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
 * Generate error suggestions based on error type
 */
function generateErrorSuggestions(error: any): string[] {
  const suggestions: string[] = [];
  
  if (error.code === 'ENOENT') {
    suggestions.push('Verify the file or directory path exists');
    suggestions.push('Check for typos in the path');
    suggestions.push('Use absolute paths to avoid confusion');
  } else if (error.code === 'EACCES' || error.code === 'EPERM') {
    suggestions.push('Check file permissions');
    suggestions.push('Ensure the file is not locked by another process');
    suggestions.push('Try using force=true for read-only files');
  } else if (error.code === 'EISDIR') {
    suggestions.push('Use directory operations for directories');
    suggestions.push('Check that the path points to a file, not a directory');
  } else if (error.code === 'ENOTDIR') {
    suggestions.push('Use file operations for files');
    suggestions.push('Check that the path points to a directory, not a file');
  } else if (error.code === 'EEXIST') {
    suggestions.push('File or directory already exists');
    suggestions.push('Use overwrite=true to replace existing files');
    suggestions.push('Choose a different destination path');
  } else if (error.message.includes('Size exceeded')) {
    suggestions.push('Use read_file_force with acknowledge_risk=true');
    suggestions.push('Increase the maxSize parameter');
    suggestions.push('Process the file in smaller chunks');
  } else if (error.message.includes('Binary file')) {
    suggestions.push('This file contains binary data');
    suggestions.push('Use file_info to get metadata instead');
    suggestions.push('Consider if this file should be read as text');
  } else if (error.name === 'SecurityError') {
    suggestions.push('Path is outside allowed directories');
    suggestions.push('Use list_allowed_dirs to see accessible paths');
    suggestions.push('Check the server configuration');
  }
  
  // Generic suggestions
  suggestions.push('Check the API documentation at /api-docs');
  suggestions.push('Verify the request parameters and format');
  
  return suggestions;
}

/**
 * Main error handling middleware
 */
export function errorHandler(
  error: any,
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
    error: error.message,
    stack: error.stack,
    code: error.code,
    name: error.name
  });

  // Determine HTTP status code
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  
  if (error.code && ERROR_STATUS_MAP[error.code]) {
    statusCode = ERROR_STATUS_MAP[error.code];
    errorCode = error.code;
  } else if (error.name && ERROR_STATUS_MAP[error.name]) {
    statusCode = ERROR_STATUS_MAP[error.name];
    errorCode = error.name;
  } else if (error.status) {
    statusCode = error.status;
    errorCode = `HTTP_${statusCode}`;
  }

  // Generate appropriate error message
  let message = error.message || 'An unexpected error occurred';
  
  // Don't expose internal errors in production
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal server error';
  }

  // Generate suggestions
  const suggestions = generateErrorSuggestions(error);

  // Create standardized error response
  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      suggestions,
      ...(process.env.NODE_ENV === 'development' && {
        details: {
          stack: error.stack,
          originalError: error.toString()
        }
      })
    },
    meta: {
      timestamp,
      version: '1.0.0',
      requestId
    }
  };

  // Send error response
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
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  meta?: Record<string, any>
): {
  success: true;
  data: T;
  message?: string;
  meta: {
    timestamp: string;
    version: string;
    [key: string]: any;
  };
} {
  return {
    success: true,
    data,
    ...(message && { message }),
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      ...meta
    }
  };
}
/**
 * Smart Filesystem MCP - Smart Read File Tool
 * Simple-first approach: returns content directly or detailed error info
 */

import * as fs from 'fs/promises';
import { SafetyController } from '../core/safety-controller.js';
import { FileAnalyzer } from '../core/file-analyzer.js';
import { SAFETY_LIMITS } from '../utils/constants.js';
import type { 
  ReadFileParams, 
  SimpleReadFileSuccess
} from '../core/types.js';
import { createUnifiedError, createUnifiedErrorFromException, ErrorCodes, UnifiedError, validatePath } from '../utils/unified-error-handler.js';


/**
 * Smart file reading - returns content directly or detailed error info
 */
export async function readFile(
  params: ReadFileParams,
  safety: SafetyController,
  _analyzer: FileAnalyzer
): Promise<SimpleReadFileSuccess | UnifiedError> {
  try {
    // パスバリデーション
    const pathValidation = validatePath(params.path);
    if (!pathValidation.valid) {
      return createUnifiedError(
        ErrorCodes.MISSING_PATH,
        'read_file',
        {},
        pathValidation.error?.includes('empty') ? 'ファイルパスが指定されていません' : '不正なパス形式です'
      );
    }
    
    // Check file existence first
    const stats = await fs.stat(params.path);
    const fileSizeKB = Math.round(stats.size / 1024);
    
    // Apply new KB-based size limits
    if (fileSizeKB > SAFETY_LIMITS.NORMAL_READ_LIMIT_KB) {
      // Size exceeded - return error without preview for security
      return createUnifiedError(
        ErrorCodes.FILE_TOO_LARGE,
        'read_file',
        { 
          path: params.path,
          size_kb: fileSizeKB,
          limit_kb: SAFETY_LIMITS.NORMAL_READ_LIMIT_KB
        },
        `ファイルサイズ（${fileSizeKB} KB）が制限（${SAFETY_LIMITS.NORMAL_READ_LIMIT_KB} KB）を超えています`
      );
    }

    // Check other safety constraints
    const accessCheck = await safety.validateFileAccess(params.path, 'read');
    
    if (accessCheck.safe) {
      // Success: return content only
      const content = await fs.readFile(params.path, (params.encoding || 'utf8') as BufferEncoding);
      return {
        success: true,
        content
      };
    }
    
    // Other safety failures
    return createUnifiedError(
      ErrorCodes.ACCESS_DENIED,
      'read_file',
      { path: params.path },
      `ファイルアクセスが拒否されました: ${accessCheck.reason || 'Access denied'}`
    );
    
  } catch (error) {
    return createUnifiedErrorFromException(error, 'read_file', params.path);
  }
}


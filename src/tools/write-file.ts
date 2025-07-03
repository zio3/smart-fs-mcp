/**
 * Smart Filesystem MCP - Write File Tool (LLM-Optimized)
 * Unified with other APIs: absolute path required, simplified responses
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SafetyController } from '../core/safety-controller.js';
import { SAFETY_LIMITS } from '../utils/constants.js';
import type { 
  WriteFileParams,
  WriteFileSuccess
} from '../core/types.js';
import { createUnifiedError, createUnifiedErrorFromException, ErrorCodes, UnifiedError, validatePath } from '../utils/unified-error-handler.js';

/**
 * Write file with LLM-optimized unified response pattern
 */
export async function writeFile(
  params: WriteFileParams,
  safety: SafetyController
): Promise<WriteFileSuccess | UnifiedError> {
  try {
    // パスバリデーション
    const pathValidation = validatePath(params.path);
    if (!pathValidation.valid) {
      return createUnifiedError(
        ErrorCodes.MISSING_PATH,
        'write_file',
        {},
        pathValidation.error?.includes('empty') ? 'ファイルパスが指定されていません' : '不正なパス形式です'
      );
    }

    // 絶対パスチェック
    if (!path.isAbsolute(params.path)) {
      return createUnifiedError(
        ErrorCodes.PATH_NOT_ABSOLUTE,
        'write_file',
        { path: params.path }
      );
    }

    // Content validation
    if (params.content === undefined || params.content === null) {
      return createUnifiedError(
        ErrorCodes.OPERATION_FAILED,
        'write_file',
        { path: params.path },
        'コンテンツが指定されていません'
      );
    }

    // Content size validation (before any filesystem operations)
    const contentSize = Buffer.byteLength(params.content, 'utf8');
    const maxSize = SAFETY_LIMITS.WRITE_MAX_SIZE || (10 * 1024 * 1024); // 10MB default
    
    if (contentSize > maxSize) {
      return createUnifiedError(
        ErrorCodes.CONTENT_TOO_LARGE,
        'write_file',
        { 
          path: params.path,
          actual_size: contentSize,
          max_size: maxSize
        }
      );
    }

    // 4. Directory and file existence checks
    const dirPath = path.dirname(params.path);
    
    // Directory access validation
    const dirCheck = await safety.validateDirectoryAccess(dirPath);
    if (!dirCheck.safe) {
      return createUnifiedError(
        ErrorCodes.ACCESS_DENIED,
        'write_file',
        { path: params.path },
        `ディレクトリアクセスが拒否されました: ${dirCheck.reason}`
      );
    }
    
    // Check if file already exists
    let fileExists = false;
    let existingSize = 0;
    
    try {
      const stats = await fs.stat(params.path);
      if (stats.isFile()) {
        fileExists = true;
        existingSize = stats.size;
      }
    } catch {
      // File doesn't exist, which is fine
    }
    
    // 5. File exists warning (optional - could be made required based on requirements)
    if (fileExists && existingSize > 0) {
      // For now, we'll proceed with overwrite but this could be made a failure pattern
      // if overwrite protection is desired
    }

    // 6. Directory creation (with error handling)
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      return createUnifiedErrorFromException(error, 'write_file', params.path);
    }

    // 7. File write operation (with permission error handling)
    try {
      const encoding = (params.encoding || 'utf8') as BufferEncoding;
      await fs.writeFile(params.path, params.content, encoding);
      
      // Success: return simplified response with bytes written
      const bytesWritten = Buffer.byteLength(params.content, encoding);
      return { success: true, bytes_written: bytesWritten };
      
    } catch (error) {
      
      return createUnifiedErrorFromException(error, 'write_file', params.path);
    }
    
  } catch (error) {
    return createUnifiedErrorFromException(error, 'write_file', params.path);
  }
}


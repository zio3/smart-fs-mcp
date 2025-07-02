/**
 * Smart Filesystem MCP - Safety Controller
 * Core safety control system for all file operations
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { SAFETY_LIMITS, FILE_CLASSIFICATION, BINARY_SIGNATURES, ERROR_MESSAGES } from '../utils/constants.js';
import { 
  isPathSafe, 
  getFileTypeFromExtension, 
  isBinaryContent, 
  timeout,
  safeFileStats,
  formatBytes 
} from '../utils/helpers.js';
import type { SafetyResult, SafetyViolationType, FileInfo } from './types.js';

/**
 * Safety Controller class - enforces all safety rules
 */
export class SafetyController {
  private operationTimeouts: Map<string, number>;
  private sizeLimits: Map<string, number>;

  constructor() {
    // Initialize operation-specific timeouts
    this.operationTimeouts = new Map([
      ['read', SAFETY_LIMITS.MAX_FILE_READ_TIME],
      ['scan', SAFETY_LIMITS.MAX_DIRECTORY_SCAN_TIME],
      ['analyze', SAFETY_LIMITS.MAX_FILE_READ_TIME],
      ['peek', SAFETY_LIMITS.MAX_FILE_READ_TIME / 2], // Peek should be faster
    ]);

    // Initialize operation-specific size limits
    this.sizeLimits = new Map([
      ['read', SAFETY_LIMITS.MAX_FILE_SIZE],
      ['peek', SAFETY_LIMITS.MAX_PREVIEW_SIZE],
      ['inline', SAFETY_LIMITS.MAX_INLINE_SIZE],
      ['scan', SAFETY_LIMITS.MAX_FILE_SIZE], // For individual files in scan
    ]);
  }

  /**
   * Validate file access for a specific operation
   */
  async validateFileAccess(filePath: string, operation: string): Promise<SafetyResult> {
    try {
      // Step 1: Path safety check
      if (!isPathSafe(filePath)) {
        return {
          safe: false,
          reason: 'Path contains directory traversal patterns',
          violationType: 'PATH_TRAVERSAL',
          suggestions: ['Use absolute paths without ".." or "./" patterns']
        };
      }

      // Step 2: Check file exists and get stats
      const statsResult = await safeFileStats(filePath);
      if (!statsResult.success || !statsResult.data) {
        return {
          safe: false,
          reason: `File not found or inaccessible: ${filePath}`,
          violationType: 'FILE_NOT_FOUND',
          suggestions: ['Verify the file path is correct', 'Check file permissions']
        };
      }

      const stats = statsResult.data;

      // Step 3: Ensure it's a file, not a directory
      if (stats.isDirectory()) {
        return {
          safe: false,
          reason: 'Path points to a directory, not a file',
          violationType: 'INVALID_PATH',
          suggestions: ['Use scan_directory for directory operations']
        };
      }

      // Step 4: Check file size limits
      const sizeLimit = this.sizeLimits.get(operation) || SAFETY_LIMITS.MAX_FILE_SIZE;
      if (!this.checkSizeLimits(stats.size, operation)) {
        return {
          safe: false,
          reason: `File size (${formatBytes(stats.size)}) exceeds limit for ${operation} operation (${formatBytes(sizeLimit)})`,
          violationType: 'SIZE_EXCEEDED',
          details: {
            fileSize: stats.size,
            sizeLimit: sizeLimit
          },
          suggestions: [
            'Use peek_file to preview the file instead',
            'Consider processing the file in chunks',
            'Check if this is the correct file'
          ]
        };
      }

      // Step 5: Check file type safety
      const fileType = getFileTypeFromExtension(filePath);
      
      // Read first bytes to check for binary content
      let isBinary = false;
      if (fileType.category === 'binary' || fileType.category === 'unknown') {
        try {
          const handle = await fs.open(filePath, 'r');
          const buffer = Buffer.alloc(Math.min(8192, stats.size));
          await handle.read(buffer, 0, buffer.length, 0);
          await handle.close();
          
          isBinary = isBinaryContent(buffer);
        } catch {
          // If we can't read, assume it's not safe
          isBinary = true;
        }
      }

      if (isBinary || !fileType.readable) {
        return {
          safe: false,
          reason: `File appears to be binary or non-readable: ${fileType.category} file`,
          violationType: 'BINARY_FILE',
          details: {
            fileType: fileType.category
          },
          suggestions: [
            'Binary files cannot be read as text',
            'Consider using a specialized tool for this file type'
          ]
        };
      }

      // Step 6: Check for executable files
      const ext = path.extname(filePath).toLowerCase();
      const executableExtensions = ['.exe', '.dll', '.so', '.dylib', '.app', '.deb', '.rpm'];
      if (executableExtensions.includes(ext)) {
        return {
          safe: false,
          reason: 'Executable files are not allowed for safety reasons',
          violationType: 'EXECUTABLE_FILE',
          details: {
            fileType: ext
          },
          suggestions: ['Executable files cannot be safely processed']
        };
      }

      // Step 7: Check read permissions
      try {
        await fs.access(filePath, fs.constants.R_OK);
      } catch {
        return {
          safe: false,
          reason: 'No read permission for file',
          violationType: 'PERMISSION_DENIED',
          suggestions: ['Check file permissions', 'Run with appropriate privileges']
        };
      }

      // All checks passed
      return {
        safe: true,
        details: {
          fileSize: stats.size,
          fileType: fileType.category
        }
      };

    } catch (error) {
      // Unexpected error
      return {
        safe: false,
        reason: `Unexpected error during validation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        violationType: 'UNKNOWN_ERROR',
        suggestions: ['Check if file path is valid', 'Verify file system is accessible']
      };
    }
  }

  /**
   * Check if size is within limits for operation
   */
  checkSizeLimits(size: number, operation: string): boolean {
    const limit = this.sizeLimits.get(operation) || SAFETY_LIMITS.MAX_FILE_SIZE;
    return size <= limit;
  }

  /**
   * Enforce timeout on an async operation
   */
  async enforceTimeout<T>(
    promise: Promise<T>, 
    timeoutMs?: number, 
    operation: string = 'Operation'
  ): Promise<T> {
    const actualTimeout = timeoutMs || this.operationTimeouts.get(operation.toLowerCase()) || SAFETY_LIMITS.MAX_OPERATION_TIME;
    
    try {
      return await timeout(promise, actualTimeout, operation);
    } catch (error) {
      if (error instanceof Error && error.message.includes('timed out')) {
        throw new Error(
          ERROR_MESSAGES.OPERATION_TIMEOUT
            .replace('{timeout}', actualTimeout.toString())
        );
      }
      throw error;
    }
  }

  /**
   * Check if file type is safe based on path and content
   */
  async isFileTypeSafe(filePath: string, content?: Buffer): Promise<boolean> {
    // First check by extension
    const fileType = getFileTypeFromExtension(filePath);
    
    // Known unsafe types
    if (fileType.category === 'binary' || fileType.category === 'media' || fileType.category === 'office') {
      return false;
    }
    
    // If content provided, do binary check
    if (content) {
      return !isBinaryContent(content);
    }
    
    // For unknown types, check content
    if (fileType.category === 'unknown') {
      try {
        const stats = await fs.stat(filePath);
        if (stats.size === 0) return true; // Empty files are safe
        
        // Read first 8KB to check
        const handle = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(Math.min(8192, stats.size));
        await handle.read(buffer, 0, buffer.length, 0);
        await handle.close();
        
        return !isBinaryContent(buffer);
      } catch {
        // If we can't check, assume unsafe
        return false;
      }
    }
    
    return true;
  }

  /**
   * Validate directory access for scanning
   */
  async validateDirectoryAccess(dirPath: string): Promise<SafetyResult> {
    try {
      // Path safety check
      if (!isPathSafe(dirPath)) {
        return {
          safe: false,
          reason: 'Path contains directory traversal patterns',
          violationType: 'PATH_TRAVERSAL',
          suggestions: ['Use absolute paths without ".." or "./" patterns']
        };
      }

      // Check if exists and is directory
      const statsResult = await safeFileStats(dirPath);
      if (!statsResult.success || !statsResult.data) {
        return {
          safe: false,
          reason: `Directory not found: ${dirPath}`,
          violationType: 'DIRECTORY_NOT_FOUND',
          suggestions: ['Verify the directory path is correct']
        };
      }

      const stats = statsResult.data;
      if (!stats.isDirectory()) {
        return {
          safe: false,
          reason: 'Path is not a directory',
          violationType: 'INVALID_PATH',
          suggestions: ['Use peek_file for file operations']
        };
      }

      // Check read permissions
      try {
        await fs.access(dirPath, fs.constants.R_OK);
      } catch {
        return {
          safe: false,
          reason: 'No read permission for directory',
          violationType: 'PERMISSION_DENIED',
          suggestions: ['Check directory permissions', 'Run with appropriate privileges']
        };
      }

      return { safe: true };

    } catch (error) {
      return {
        safe: false,
        reason: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        violationType: 'UNKNOWN_ERROR',
        suggestions: ['Check if directory path is valid']
      };
    }
  }

  /**
   * Get timeout for specific operation
   */
  getOperationTimeout(operation: string): number {
    return this.operationTimeouts.get(operation.toLowerCase()) || SAFETY_LIMITS.MAX_OPERATION_TIME;
  }

  /**
   * Get size limit for specific operation
   */
  getSizeLimit(operation: string): number {
    return this.sizeLimits.get(operation.toLowerCase()) || SAFETY_LIMITS.MAX_FILE_SIZE;
  }

  /**
   * Check if token estimate is within safe limits
   */
  isWithinTokenLimit(estimatedTokens: number, strict: boolean = false): SafetyResult {
    const limit = strict ? SAFETY_LIMITS.SAFE_TOKEN_ESTIMATE : SAFETY_LIMITS.MAX_TOKEN_ESTIMATE;
    
    if (estimatedTokens <= limit) {
      return { safe: true };
    }
    
    return {
      safe: false,
      reason: `Estimated tokens (${estimatedTokens.toLocaleString()}) exceeds ${strict ? 'recommended' : 'maximum'} limit (${limit.toLocaleString()})`,
      violationType: 'TOKEN_LIMIT_EXCEEDED',
      details: {
        estimatedTokens,
        tokenLimit: limit
      },
      suggestions: [
        'Use peek_file to preview content',
        'Consider processing in smaller chunks',
        'Filter to specific file types or patterns'
      ]
    };
  }

  /**
   * Validate batch operation (multiple files)
   */
  validateBatchOperation(fileCount: number, totalSize: number): SafetyResult {
    if (fileCount > SAFETY_LIMITS.MAX_DIRECTORY_SCAN) {
      return {
        safe: false,
        reason: `Too many files (${fileCount}) exceeds limit (${SAFETY_LIMITS.MAX_DIRECTORY_SCAN})`,
        violationType: 'SIZE_EXCEEDED',
        suggestions: [
          'Use more specific filters',
          'Scan subdirectories separately',
          'Increase max_files parameter if needed'
        ]
      };
    }
    
    if (totalSize > SAFETY_LIMITS.MAX_FILE_SIZE * 10) { // 10MB total for batch
      return {
        safe: false,
        reason: `Total size (${formatBytes(totalSize)}) too large for batch operation`,
        violationType: 'SIZE_EXCEEDED',
        details: {
          fileSize: totalSize,
          sizeLimit: SAFETY_LIMITS.MAX_FILE_SIZE * 10
        },
        suggestions: [
          'Process files individually',
          'Filter to smaller files only'
        ]
      };
    }
    
    return { safe: true };
  }
}
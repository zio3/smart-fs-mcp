/**
 * Smart Filesystem MCP - Helper Functions
 * Utility functions used throughout the project
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { SAFETY_LIMITS, FILE_CLASSIFICATION, BINARY_SIGNATURES, BOM_PATTERNS, TOKEN_ESTIMATION } from './constants.js';
import type { FileType, FileEncoding, OperationResult } from '../core/types.js';

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

/**
 * Format duration to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Check if path is safe (no directory traversal)
 */
export function isPathSafe(targetPath: string, basePath?: string): boolean {
  const normalized = path.normalize(targetPath);
  const resolved = path.resolve(targetPath);
  
  // Check for directory traversal attempts
  if (normalized.includes('..') || normalized.includes('./')) {
    return false;
  }
  
  // If base path provided, ensure target is within it
  if (basePath) {
    const baseResolved = path.resolve(basePath);
    return resolved.startsWith(baseResolved);
  }
  
  return true;
}

/**
 * Get file type from extension
 */
export function getFileTypeFromExtension(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase();
  
  // Check each category
  for (const [category, config] of Object.entries(FILE_CLASSIFICATION)) {
    if (config.extensions.includes(ext)) {
      return {
        category: config.category as any,
        specificType: ext.substring(1), // Remove the dot
        readable: config.readable,
        confidence: 'high'
      };
    }
  }
  
  // Unknown file type
  return {
    category: 'unknown',
    specificType: ext ? ext.substring(1) : 'no-extension',
    readable: true, // Assume readable unless proven otherwise
    confidence: 'low'
  };
}

/**
 * Detect BOM and return encoding
 */
export function detectBOM(buffer: Buffer): FileEncoding | null {
  // Check UTF-32 first (4 bytes)
  if (buffer.length >= 4) {
    if (buffer.compare(BOM_PATTERNS.UTF32_LE, 0, 4, 0, 4) === 0) return 'utf32le';
    if (buffer.compare(BOM_PATTERNS.UTF32_BE, 0, 4, 0, 4) === 0) return 'utf32be';
  }
  
  // Check UTF-8 (3 bytes)
  if (buffer.length >= 3) {
    if (buffer.compare(BOM_PATTERNS.UTF8, 0, 3, 0, 3) === 0) return 'utf8';
  }
  
  // Check UTF-16 (2 bytes)
  if (buffer.length >= 2) {
    if (buffer.compare(BOM_PATTERNS.UTF16_LE, 0, 2, 0, 2) === 0) return 'utf16le';
    if (buffer.compare(BOM_PATTERNS.UTF16_BE, 0, 2, 0, 2) === 0) return 'utf16be';
  }
  
  return null;
}

/**
 * Check if buffer contains binary data
 */
export function isBinaryContent(buffer: Buffer, bytesToCheck: number = 8192): boolean {
  const checkLength = Math.min(buffer.length, bytesToCheck);
  
  // Check for known binary signatures
  for (const [, signature] of Object.entries(BINARY_SIGNATURES)) {
    if (buffer.length >= signature.length) {
      if (buffer.compare(signature, 0, signature.length, 0, signature.length) === 0) {
        return true;
      }
    }
  }
  
  // Check for null bytes or high number of non-printable characters
  let nonPrintableCount = 0;
  let nullCount = 0;
  
  for (let i = 0; i < checkLength; i++) {
    const byte = buffer[i];
    
    if (byte === 0) {
      nullCount++;
      // Even one null byte is a strong indicator of binary
      if (nullCount > 0) return true;
    }
    
    // Count non-printable characters (excluding common whitespace)
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      nonPrintableCount++;
    }
  }
  
  // If more than 30% non-printable, likely binary
  const nonPrintableRatio = nonPrintableCount / checkLength;
  return nonPrintableRatio > 0.3;
}

/**
 * Estimate token count for text content
 */
export function estimateTokenCount(text: string, fileType?: FileType): number {
  // Basic estimation: 1 token ≈ 4 characters
  let baseTokens = Math.ceil(text.length / TOKEN_ESTIMATION.CHARS_PER_TOKEN);
  
  // Apply file type multiplier if provided
  if (fileType && fileType.category in TOKEN_ESTIMATION.FILE_TYPE_MULTIPLIERS) {
    const multiplier = TOKEN_ESTIMATION.FILE_TYPE_MULTIPLIERS[fileType.category as keyof typeof TOKEN_ESTIMATION.FILE_TYPE_MULTIPLIERS];
    baseTokens = Math.ceil(baseTokens * multiplier);
  }
  
  return baseTokens;
}

/**
 * Create a timeout promise
 */
export function timeout<T>(promise: Promise<T>, ms: number, operation: string = 'Operation'): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${ms}ms`));
    }, ms);
    
    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Batch process items with concurrency limit
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = SAFETY_LIMITS.MAX_FILES_PER_BATCH
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Safe file stats wrapper
 */
export async function safeFileStats(filePath: string): Promise<OperationResult<fs.Stats>> {
  try {
    const stats = await fs.stat(filePath);
    return { success: true, data: stats };
  } catch (error) {
    return {
      success: false,
      error: {
        type: 'FILE_NOT_FOUND',
        message: `Cannot access file: ${filePath}`,
        filePath,
        attemptedOperation: 'stat',
        originalError: error as Error
      }
    };
  }
}

/**
 * Truncate string with ellipsis
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Sanitize path for display
 */
export function sanitizePath(filePath: string, maxLength?: number): string {
  // Normalize separators
  let sanitized = filePath.replace(/\\/g, '/');
  
  // Remove sensitive patterns
  sanitized = sanitized.replace(/\/\.(git|env|ssh|aws|azure)\//gi, '/.../');
  
  // Truncate if needed
  if (maxLength && sanitized.length > maxLength) {
    const fileName = path.basename(sanitized);
    const dirPath = path.dirname(sanitized);
    const availableLength = maxLength - fileName.length - 4; // 4 for ".../"
    
    if (availableLength > 0) {
      sanitized = `...${dirPath.slice(-availableLength)}/${fileName}`;
    } else {
      sanitized = truncateString(fileName, maxLength);
    }
  }
  
  return sanitized;
}

/**
 * Calculate performance grade based on metrics
 */
export function calculatePerformanceGrade(
  filesPerSecond: number,
  memoryUsageMB: number,
  responseTimeMs: number
): 'A' | 'B' | 'C' | 'D' | 'F' {
  let score = 0;
  
  // Files per second scoring (0-40 points)
  if (filesPerSecond >= 1000) score += 40;
  else if (filesPerSecond >= 500) score += 30;
  else if (filesPerSecond >= 100) score += 20;
  else if (filesPerSecond >= 50) score += 10;
  
  // Memory usage scoring (0-30 points)
  if (memoryUsageMB <= 50) score += 30;
  else if (memoryUsageMB <= 100) score += 20;
  else if (memoryUsageMB <= 200) score += 10;
  
  // Response time scoring (0-30 points)
  if (responseTimeMs <= 100) score += 30;
  else if (responseTimeMs <= 500) score += 20;
  else if (responseTimeMs <= 1000) score += 10;
  
  // Convert to grade
  if (score >= 90) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

/**
 * Deep freeze object to prevent modifications
 */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.freeze(obj);
  
  Object.getOwnPropertyNames(obj).forEach(prop => {
    const value = (obj as any)[prop];
    if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
      deepFreeze(value);
    }
  });
  
  return obj;
}

/**
 * Create error response object
 */
export function createErrorResponse(
  type: string,
  message: string,
  details?: Record<string, any>
): OperationResult<never> {
  return {
    success: false,
    error: {
      type: type as any,
      message,
      attemptedOperation: details?.operation || 'unknown',
      ...details
    }
  };
}

/**
 * Memory usage helper
 */
export function getMemoryUsageMB(): number {
  const usage = process.memoryUsage();
  return Math.round(usage.heapUsed / 1024 / 1024);
}
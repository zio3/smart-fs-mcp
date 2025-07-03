/**
 * Shared File Status Checker Utility
 * Common file status checking for LLM-optimized responses
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { FileStatusInfo } from '../../core/types.js';

/**
 * Get comprehensive file status information for failure responses
 */
export async function getFileStatusInfo(filePath: string): Promise<FileStatusInfo> {
  try {
    const stats = await fs.stat(filePath);
    
    // Try to read content for preview (safely)
    let contentPreview: string[] | undefined;
    try {
      // Only read first 1KB for preview to avoid memory issues
      const content = await fs.readFile(filePath, { encoding: 'utf8', flag: 'r' });
      const lines = content.split('\n').slice(0, 5); // First 5 lines only
      contentPreview = lines.map(line => 
        line.length > 100 ? line.substring(0, 100) + '...' : line
      );
    } catch {
      // Content reading failed - file might be binary or permission denied
      contentPreview = ['<Unable to read file content>'];
    }
    
    // Check permissions
    let readable = false;
    let writable = false;
    
    try {
      await fs.access(filePath, fs.constants.R_OK);
      readable = true;
    } catch {
      // Read permission denied
    }
    
    try {
      await fs.access(filePath, fs.constants.W_OK);
      writable = true;
    } catch {
      // Write permission denied
    }

    return {
      path: filePath,
      exists: true,
      readable,
      writable,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      content_preview: contentPreview
    };
    
  } catch (error) {
    // File doesn't exist or other error
    return {
      path: filePath,
      exists: false,
      readable: false,
      writable: false
    };
  }
}

/**
 * Check if a file exists and is accessible
 */
export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size safely
 */
export async function getFileSizeIfExists(filePath: string): Promise<number | undefined> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    return undefined;
  }
}

/**
 * Calculate age difference between two files
 */
export async function calculateAgeDifference(file1: string, file2: string): Promise<string | undefined> {
  try {
    const [stats1, stats2] = await Promise.all([
      fs.stat(file1),
      fs.stat(file2)
    ]);
    
    const diffMs = stats2.mtime.getTime() - stats1.mtime.getTime();
    const diffDays = Math.abs(diffMs) / (1000 * 60 * 60 * 24);
    
    if (diffDays < 1) {
      return `${Math.round(diffMs / (1000 * 60 * 60))} hours ${diffMs > 0 ? 'newer' : 'older'}`;
    } else if (diffDays < 30) {
      return `${Math.round(diffDays)} days ${diffMs > 0 ? 'newer' : 'older'}`;
    } else {
      return `${Math.round(diffDays / 30)} months ${diffMs > 0 ? 'newer' : 'older'}`;
    }
  } catch {
    return undefined;
  }
}

/**
 * Generate alternative file names for conflict resolution
 */
export function generateAlternativeNames(originalPath: string): string[] {
  const ext = path.extname(originalPath);
  const basename = path.basename(originalPath, ext);
  const dirname = path.dirname(originalPath);
  
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const timeString = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
  
  return [
    path.join(dirname, `${basename}-backup${ext}`),
    path.join(dirname, `${basename}-${timestamp}${ext}`),
    path.join(dirname, `${basename}-${timestamp}-${timeString}${ext}`),
    path.join(dirname, `${basename}-new${ext}`),
    path.join(dirname, `${basename}-v2${ext}`),
    path.join(dirname, `${basename}-copy${ext}`)
  ];
}

/**
 * Detect similar patterns in file content (for edit operations)
 */
export function detectSimilarPatterns(content: string, failedPattern: string): string[] {
  // Generate pattern variations
  const variants = [
    failedPattern.replace(/const\s+/g, ''),           // Remove 'const '
    failedPattern.replace(/const\s+/g, 'let '),      // Replace 'const' with 'let'
    failedPattern.replace(/const\s+/g, 'var '),      // Replace 'const' with 'var'
    failedPattern.replace(/\s*=\s*/g, ' : '),         // Replace ' = ' with ' : '
    failedPattern.replace(/\s*=\s*/g, ': '),          // Replace ' = ' with ': '
    failedPattern.toLowerCase(),                       // Lowercase version
    failedPattern.replace(/[A-Z]/g, c => c.toLowerCase()), // camelCase to lowercase
    failedPattern.replace(/_/g, ''),                   // Remove underscores
    failedPattern.replace(/-/g, '_'),                  // Dash to underscore
    failedPattern.replace(/_/g, '-'),                  // Underscore to dash
  ];
  
  // Find patterns that actually exist in the content
  const foundPatterns = variants.filter(pattern => 
    pattern !== failedPattern && content.includes(pattern)
  );
  
  // Remove duplicates and return top 3
  return [...new Set(foundPatterns)].slice(0, 3);
}

/**
 * Extract relevant context around a pattern match
 */
export function extractContextAroundPattern(content: string, pattern: string, contextLines = 2): string[] {
  const lines = content.split('\n');
  const matchingLines: number[] = [];
  
  // Find lines containing the pattern
  lines.forEach((line, index) => {
    if (line.includes(pattern)) {
      matchingLines.push(index);
    }
  });
  
  if (matchingLines.length === 0) {
    return [];
  }
  
  // Get context around first match
  const firstMatch = matchingLines[0];
  if (firstMatch === undefined) {
    return [];
  }
  const startLine = Math.max(0, firstMatch - contextLines);
  const endLine = Math.min(lines.length - 1, firstMatch + contextLines);
  
  return lines.slice(startLine, endLine + 1);
}
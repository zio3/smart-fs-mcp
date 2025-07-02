/**
 * Smart Filesystem MCP - Smart Read File Tool
 * Simple-first approach: returns content directly or detailed error info
 */

import * as fs from 'fs/promises';
import * as readline from 'readline';
import { createReadStream } from 'fs';
import { SafetyController } from '../core/safety-controller.js';
import { FileAnalyzer } from '../core/file-analyzer.js';
import { SAFETY_LIMITS } from '../utils/constants.js';
import { formatBytes, estimateTokenCount } from '../utils/helpers.js';
import type { 
  ReadFileParams, 
  ReadFileResult,
  ReadFileSuccess,
  ReadFileLimited
} from '../core/types.js';

/**
 * Smart file reading - returns content directly or detailed error info
 */
export async function readFile(
  params: ReadFileParams,
  safety: SafetyController,
  analyzer: FileAnalyzer
): Promise<ReadFileResult> {
  try {
    // Quick safety check
    const accessCheck = await safety.validateFileAccess(params.path, 'read');
    
    // If safe, just read and return content
    if (accessCheck.safe) {
      const content = await fs.readFile(params.path, params.encoding || 'utf8');
      return {
        status: 'success',
        content
      };
    }
    
    // Not safe - provide detailed information
    return await buildLimitedResponse(
      params.path,
      accessCheck,
      analyzer,
      params.encoding || 'utf8'
    );
    
  } catch (error) {
    // Handle unexpected errors
    if (error instanceof Error && error.message.includes('ENOENT')) {
      return buildErrorResponse('permission_denied', `File not found: ${params.path}`, params.path);
    }
    
    return buildErrorResponse(
      'permission_denied',
      error instanceof Error ? error.message : 'Unknown error',
      params.path
    );
  }
}

/**
 * Build detailed response when file read is limited
 */
async function buildLimitedResponse(
  filePath: string,
  safetyResult: any,
  analyzer: FileAnalyzer,
  encoding: string
): Promise<ReadFileLimited> {
  // Get file analysis
  const analysis = await analyzer.analyzeFile(filePath);
  
  // Determine status based on violation type
  let status: ReadFileLimited['status'];
  if (safetyResult.violationType === 'SIZE_EXCEEDED') {
    status = 'size_exceeded';
  } else if (safetyResult.violationType === 'BINARY_FILE') {
    status = 'binary_detected';
  } else {
    status = 'permission_denied';
  }
  
  // Get preview content
  const preview = await getPreviewContent(filePath, encoding, analysis.isBinary);
  
  // Generate content summary
  const contentSummary = generateContentSummary(analysis, preview.first_lines);
  
  // Build response
  return {
    status,
    file_info: {
      size_bytes: analysis.size,
      estimated_tokens: analysis.estimatedTokens || 0,
      type: mapFileType(analysis.fileType.category),
      safe_to_read: false
    },
    preview: {
      first_lines: preview.first_lines,
      last_lines: preview.last_lines,
      truncated_at_line: preview.truncated_at_line,
      total_lines_estimated: preview.total_lines_estimated,
      content_summary: contentSummary
    },
    issue_details: {
      reason: safetyResult.reason || 'Unknown issue',
      limit_exceeded: safetyResult.violationType || 'UNKNOWN',
      current_vs_limit: formatLimitComparison(safetyResult)
    },
    alternatives: {
      force_read_available: status === 'size_exceeded' && analysis.size < 50 * 1024 * 1024, // 50MB hard limit
      suggestions: generateSuggestions(status, analysis)
    }
  };
}

/**
 * Get preview content from file
 */
async function getPreviewContent(
  filePath: string,
  encoding: string,
  isBinary: boolean
): Promise<{
  first_lines: string[];
  last_lines?: string[];
  truncated_at_line: number;
  total_lines_estimated: number;
}> {
  if (isBinary) {
    return {
      first_lines: ['[Binary file - content preview not available]'],
      last_lines: undefined,
      truncated_at_line: 0,
      total_lines_estimated: 0
    };
  }
  
  const firstLines: string[] = [];
  const lastLines: string[] = [];
  let lineCount = 0;
  const maxPreviewLines = 20;
  const maxTailLines = 5;
  
  try {
    const rl = readline.createInterface({
      input: createReadStream(filePath, { encoding: encoding as BufferEncoding }),
      crlfDelay: Infinity
    });
    
    for await (const line of rl) {
      lineCount++;
      
      // Collect first lines
      if (firstLines.length < maxPreviewLines) {
        firstLines.push(line.length > 200 ? line.substring(0, 200) + '...' : line);
      }
      
      // Keep track of last lines
      lastLines.push(line.length > 200 ? line.substring(0, 200) + '...' : line);
      if (lastLines.length > maxTailLines) {
        lastLines.shift();
      }
      
      // Stop if we've read enough
      if (lineCount > 10000) break;
    }
    
    return {
      first_lines: firstLines,
      last_lines: lineCount > maxPreviewLines ? lastLines : undefined,
      truncated_at_line: Math.min(lineCount, maxPreviewLines),
      total_lines_estimated: lineCount
    };
    
  } catch (error) {
    return {
      first_lines: [`[Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}]`],
      last_lines: undefined,
      truncated_at_line: 0,
      total_lines_estimated: 0
    };
  }
}

/**
 * Generate content summary based on analysis and preview
 */
function generateContentSummary(analysis: any, previewLines: string[]): string {
  const parts: string[] = [];
  
  // Add language/type info
  if (analysis.detectedLanguage) {
    parts.push(analysis.detectedLanguage);
  } else if (analysis.fileType.category !== 'unknown') {
    parts.push(analysis.fileType.category);
  }
  
  // Add specific characteristics
  const preview = previewLines.join('\n');
  if (preview.includes('import React')) {
    parts.push('React component');
  } else if (preview.includes('export class') || preview.includes('export default class')) {
    parts.push('class definition');
  } else if (preview.includes('CREATE TABLE') || preview.includes('INSERT INTO')) {
    parts.push('SQL script');
  } else if (preview.includes('{') && preview.includes('}') && analysis.extension === '.json') {
    parts.push('JSON data');
  } else if (preview.includes('#!/')) {
    parts.push('executable script');
  }
  
  // Add file characteristics
  if (analysis.warnings?.includes('Large file')) {
    parts.push('large file');
  }
  
  return parts.length > 0 ? parts.join(', ') : 'text file';
}

/**
 * Map file category to simplified type
 */
function mapFileType(category: string): 'text' | 'code' | 'binary' | 'data' | 'config' {
  switch (category) {
    case 'code':
      return 'code';
    case 'config':
      return 'config';
    case 'data':
      return 'data';
    case 'binary':
    case 'media':
    case 'office':
      return 'binary';
    default:
      return 'text';
  }
}

/**
 * Format limit comparison for display
 */
function formatLimitComparison(safetyResult: any): string {
  if (safetyResult.details?.fileSize && safetyResult.details?.sizeLimit) {
    return `${formatBytes(safetyResult.details.fileSize)} vs ${formatBytes(safetyResult.details.sizeLimit)}`;
  }
  
  if (safetyResult.details?.estimatedTokens && safetyResult.details?.tokenLimit) {
    return `~${safetyResult.details.estimatedTokens.toLocaleString()} tokens vs ${safetyResult.details.tokenLimit.toLocaleString()} limit`;
  }
  
  return 'Limit exceeded';
}

/**
 * Generate suggestions based on the issue
 */
function generateSuggestions(status: ReadFileLimited['status'], analysis: any): string[] {
  const suggestions: string[] = [];
  
  switch (status) {
    case 'size_exceeded':
      suggestions.push('Use force_read_file with acknowledge_risk=true to read anyway');
      if (analysis.fileType.category === 'data') {
        suggestions.push('Consider processing the file in chunks');
        suggestions.push('Use data analysis tools instead of reading the entire file');
      }
      if (analysis.fileType.category === 'code') {
        suggestions.push('Search for specific functions or classes instead');
        suggestions.push('Use grep to find relevant sections');
      }
      break;
      
    case 'binary_detected':
      suggestions.push('This appears to be a binary file and cannot be read as text');
      suggestions.push('Use appropriate tools for the file type');
      if (analysis.extension === '.pdf') {
        suggestions.push('Consider using a PDF extraction tool');
      } else if (['.png', '.jpg', '.jpeg', '.gif'].includes(analysis.extension)) {
        suggestions.push('This is an image file - use image processing tools');
      }
      break;
      
    case 'permission_denied':
      suggestions.push('Check file permissions');
      suggestions.push('Verify the file path is correct');
      suggestions.push('Ensure the file exists and is accessible');
      break;
  }
  
  return suggestions;
}

/**
 * Build error response for unexpected errors
 */
function buildErrorResponse(
  status: ReadFileLimited['status'],
  reason: string,
  filePath: string
): ReadFileLimited {
  return {
    status,
    file_info: {
      size_bytes: 0,
      estimated_tokens: 0,
      type: 'text',
      safe_to_read: false
    },
    preview: {
      first_lines: [],
      truncated_at_line: 0,
      total_lines_estimated: 0,
      content_summary: 'Unable to analyze'
    },
    issue_details: {
      reason,
      limit_exceeded: 'ERROR',
      current_vs_limit: 'N/A'
    },
    alternatives: {
      force_read_available: false,
      suggestions: [
        'Verify the file path is correct',
        'Check if the file exists',
        'Ensure you have read permissions'
      ]
    }
  };
}
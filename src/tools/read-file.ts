/**
 * Smart Filesystem MCP - Smart Read File Tool
 * Simple-first approach: returns content directly or detailed error info
 */

import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as readline from 'readline';
import { SafetyController } from '../core/safety-controller.js';
import { FileAnalyzer } from '../core/file-analyzer.js';
import { SAFETY_LIMITS } from '../utils/constants.js';
import type { 
  ReadFileParams, 
  SimpleReadFileSuccess,
  PartialReadFileInfo,
  StandardFileInfo
} from '../core/types.js';
import { createUnifiedError, createUnifiedErrorFromException, ErrorCodes, UnifiedError, validatePath } from '../utils/unified-error-handler.js';


/**
 * Count lines in a file efficiently
 */
async function countLines(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    const rl = readline.createInterface({
      input: createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });
    
    rl.on('line', () => {
      lineCount++;
    });
    
    rl.on('close', () => {
      resolve(lineCount);
    });
    
    rl.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Read specific line range from file
 */
async function readLineRange(
  filePath: string,
  startLine: number,
  endLine: number,
  encoding: BufferEncoding = 'utf8'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    let currentLine = 0;
    
    const rl = readline.createInterface({
      input: createReadStream(filePath, { encoding }),
      crlfDelay: Infinity
    });
    
    rl.on('line', (line) => {
      currentLine++;
      
      if (currentLine >= startLine && currentLine <= endLine) {
        lines.push(line);
      }
      
      if (currentLine >= endLine) {
        rl.close();
      }
    });
    
    rl.on('close', () => {
      resolve(lines.join('\n'));
    });
    
    rl.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Smart file reading - returns content directly or detailed error info
 */
export async function readFile(
  params: ReadFileParams,
  safety: SafetyController,
  analyzer: FileAnalyzer
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
    
    // Validate line parameters
    if (params.start_line !== undefined && params.start_line < 1) {
      return createUnifiedError(
        ErrorCodes.INVALID_PARAMETER,
        'read_file',
        { start_line: params.start_line },
        '開始行番号は1以上である必要があります'
      );
    }
    
    if (params.end_line !== undefined && params.end_line < 1) {
      return createUnifiedError(
        ErrorCodes.INVALID_PARAMETER,
        'read_file',
        { end_line: params.end_line },
        '終了行番号は1以上である必要があります'
      );
    }
    
    if (params.start_line !== undefined && params.end_line !== undefined && 
        params.start_line > params.end_line) {
      return createUnifiedError(
        ErrorCodes.INVALID_PARAMETER,
        'read_file',
        { start_line: params.start_line, end_line: params.end_line },
        '開始行番号は終了行番号以下である必要があります'
      );
    }
    
    // For partial reads, we need to count lines first
    const isPartialRead = params.start_line !== undefined || params.end_line !== undefined;
    let totalLines = 0;
    let effectiveStartLine = params.start_line || 1;
    let effectiveEndLine = params.end_line;
    
    if (isPartialRead) {
      // Count total lines for partial reads
      try {
        totalLines = await countLines(params.path);
        
        // Adjust end line if not specified
        if (!effectiveEndLine) {
          effectiveEndLine = totalLines;
        }
        
        // Check if line ranges are valid
        if (effectiveStartLine > totalLines) {
          return createUnifiedError(
            ErrorCodes.INVALID_PARAMETER,
            'read_file',
            { 
              start_line: effectiveStartLine,
              total_lines: totalLines
            },
            `開始行番号（${effectiveStartLine}）がファイルの総行数（${totalLines}）を超えています`
          );
        }
        
        if (effectiveEndLine > totalLines) {
          // Adjust to actual total lines
          effectiveEndLine = totalLines;
        }
      } catch (error) {
        return createUnifiedErrorFromException(error, 'read_file', params.path);
      }
    }
    
    // For full file reads, apply size limit
    if (!isPartialRead && fileSizeKB > SAFETY_LIMITS.NORMAL_READ_LIMIT_KB) {
      // Get file analysis for better error info
      const analysis = await analyzer.analyzeFile(params.path);
      const estimatedLines = totalLines || analysis.preview?.lines.length || 0;
      
      // Size exceeded - return error with partial read suggestions
      return createUnifiedError(
        ErrorCodes.FILE_TOO_LARGE,
        'read_file',
        { 
          path: params.path,
          size_kb: fileSizeKB,
          limit_kb: SAFETY_LIMITS.NORMAL_READ_LIMIT_KB,
          total_lines: estimatedLines,
          file_info: {
            total_lines: estimatedLines,
            size_bytes: stats.size,
            estimated_tokens: analysis.estimatedTokens
          },
          preview: analysis.preview,
          alternatives: {
            partial_read_available: true,
            suggestions: [
              'Use start_line and end_line parameters to read specific sections',
              `Example: start_line=1, end_line=500 (reads first 500 lines)`,
              `Example: start_line=${Math.floor(estimatedLines/2)}, end_line=${Math.floor(estimatedLines/2) + 500} (reads middle section)`,
              'Use search_content to find specific patterns and locate target sections',
              'Use search_content with content_pattern to identify relevant line numbers first',
              'Combine search_content + read_file with line ranges for efficient targeted reading'
            ]
          }
        },
        `ファイルサイズ（${fileSizeKB} KB）が制限（${SAFETY_LIMITS.NORMAL_READ_LIMIT_KB} KB）を超えています`
      );
    }

    // Check other safety constraints
    const accessCheck = await safety.validateFileAccess(params.path, 'read');
    
    if (accessCheck.safe) {
      try {
        let content: string;
        let fileInfo: PartialReadFileInfo | undefined;
        
        if (isPartialRead) {
          // Partial read
          content = await readLineRange(
            params.path,
            effectiveStartLine,
            effectiveEndLine!,
            (params.encoding || 'utf8') as BufferEncoding
          );
          
          fileInfo = {
            total_lines: totalLines,
            returned_lines: effectiveEndLine! - effectiveStartLine + 1,
            line_range: {
              start: effectiveStartLine,
              end: effectiveEndLine!
            }
          };
        } else {
          // Full file read
          content = await fs.readFile(params.path, (params.encoding || 'utf8') as BufferEncoding);
          
          // Count lines for full read if we have content
          if (content) {
            const lineCount = content.split('\n').length;
            fileInfo = {
              total_lines: lineCount,
              returned_lines: lineCount,
              line_range: {
                start: 1,
                end: lineCount
              }
            };
          }
        }
        
        // Generate standard file info
        const standardFileInfo = await analyzer.generateStandardFileInfo(params.path, stats);
        
        // Ensure we always have partial read info
        const partialInfo: PartialReadFileInfo = fileInfo || {
          total_lines: standardFileInfo.total_lines || 0,
          returned_lines: standardFileInfo.total_lines || 0,
          line_range: {
            start: 1,
            end: standardFileInfo.total_lines || 0
          }
        };
        
        // Combine standard file info with partial read info
        const combinedFileInfo: StandardFileInfo & PartialReadFileInfo = {
          ...standardFileInfo,
          ...partialInfo
        };
        
        return {
          success: true,
          content,
          file_info: combinedFileInfo
        };
      } catch (error) {
        return createUnifiedErrorFromException(error, 'read_file', params.path);
      }
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


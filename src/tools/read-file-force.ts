/**
 * Smart Filesystem MCP - Read File Force Tool
 * Allows reading files that exceed normal limits with explicit acknowledgment
 */

import * as fs from 'fs/promises';
import { SafetyController } from '../core/safety-controller.js';
import { FileAnalyzer } from '../core/file-analyzer.js';
import { SAFETY_LIMITS } from '../utils/constants.js';
import { formatBytes } from '../utils/helpers.js';
import type { 
  ReadFileForceParams, 
  ReadFileResult,
  ReadFileSuccess,
  ReadFileLimited
} from '../core/types.js';

/**
 * Force read file with relaxed limits
 */
export async function readFileForce(
  params: ReadFileForceParams,
  safety: SafetyController,
  analyzer: FileAnalyzer
): Promise<ReadFileResult> {
  // Validate acknowledgment
  if (!params.acknowledge_risk) {
    return {
      status: 'permission_denied',
      file_info: {
        size_bytes: 0,
        estimated_tokens: 0,
        type: 'text',
        safe_to_read: false
      },
      preview: {
        first_lines: ['Risk acknowledgment required'],
        truncated_at_line: 0,
        total_lines_estimated: 0,
        content_summary: 'Risk not acknowledged'
      },
      issue_details: {
        reason: 'Must set acknowledge_risk=true to force read files',
        limit_exceeded: 'ACKNOWLEDGMENT_REQUIRED',
        current_vs_limit: 'N/A'
      },
      alternatives: {
        force_read_available: false,
        suggestions: [
          'Set acknowledge_risk=true to proceed',
          'Understand that large files may consume significant tokens',
          'Consider using regular read_file first to see the issue'
        ]
      }
    };
  }
  
  try {
    // Get file stats
    const stats = await fs.stat(params.path);
    
    // Check against absolute maximum (default 50MB)
    const maxSizeMB = params.max_size_mb || 50;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (stats.size > maxSizeBytes) {
      return {
        status: 'size_exceeded',
        file_info: {
          size_bytes: stats.size,
          estimated_tokens: Math.ceil(stats.size / 4),
          type: 'text',
          safe_to_read: false
        },
        preview: {
          first_lines: [`File size ${formatBytes(stats.size)} exceeds force read limit`],
          truncated_at_line: 0,
          total_lines_estimated: 0,
          content_summary: 'File too large even for force read'
        },
        issue_details: {
          reason: `File exceeds maximum force read size of ${maxSizeMB}MB`,
          limit_exceeded: 'FORCE_READ_MAX_SIZE',
          current_vs_limit: `${formatBytes(stats.size)} vs ${formatBytes(maxSizeBytes)}`
        },
        alternatives: {
          force_read_available: false,
          suggestions: [
            `Maximum force read size is ${maxSizeMB}MB`,
            'Consider processing the file in chunks',
            'Use external tools to split or filter the file first'
          ]
        }
      };
    }
    
    // Quick analysis to check if binary
    const analysis = await analyzer.analyzeFile(params.path);
    
    if (analysis.isBinary) {
      return {
        status: 'binary_detected',
        file_info: {
          size_bytes: stats.size,
          estimated_tokens: 0,
          type: 'binary',
          safe_to_read: false
        },
        preview: {
          first_lines: ['Cannot force read binary files'],
          truncated_at_line: 0,
          total_lines_estimated: 0,
          content_summary: 'Binary file'
        },
        issue_details: {
          reason: 'Binary files cannot be read as text, even with force read',
          limit_exceeded: 'BINARY_FILE',
          current_vs_limit: 'N/A'
        },
        alternatives: {
          force_read_available: false,
          suggestions: [
            'Binary files cannot be converted to text',
            'Use appropriate tools for this file type',
            `File type detected: ${analysis.fileType.category}`
          ]
        }
      };
    }
    
    // Warn about token usage
    const estimatedTokens = analysis.estimatedTokens || Math.ceil(stats.size / 4);
    if (estimatedTokens > 100000) {
      console.error(`WARNING: Force reading file with ~${estimatedTokens.toLocaleString()} estimated tokens`);
    }
    
    // Proceed with force read
    const content = await safety.enforceTimeout(
      fs.readFile(params.path, params.encoding || 'utf8'),
      30000, // 30 second timeout for large files
      'Force read file'
    );
    
    return {
      status: 'success',
      content
    };
    
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      status: 'permission_denied',
      file_info: {
        size_bytes: 0,
        estimated_tokens: 0,
        type: 'text',
        safe_to_read: false
      },
      preview: {
        first_lines: [`Error during force read: ${errorMessage}`],
        truncated_at_line: 0,
        total_lines_estimated: 0,
        content_summary: 'Read failed'
      },
      issue_details: {
        reason: errorMessage,
        limit_exceeded: 'ERROR',
        current_vs_limit: 'N/A'
      },
      alternatives: {
        force_read_available: false,
        suggestions: [
          'Check if the file exists',
          'Verify you have read permissions',
          'Ensure the file path is correct'
        ]
      }
    };
  }
}
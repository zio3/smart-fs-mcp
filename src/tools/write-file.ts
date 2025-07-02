/**
 * Smart Filesystem MCP - Write File Tool
 * ファイル書き込みツール（LLMフレンドリー）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Buffer } from 'buffer';
import { SafetyController } from '../core/safety-controller.js';
import { SAFETY_LIMITS, TOKEN_ESTIMATION } from '../utils/constants.js';
import { estimateTokenCount } from '../utils/helpers.js';
import type { 
  WriteFileParams,
  WriteFileResult,
  FileEncoding
} from '../core/types.js';

/**
 * ファイル書き込みメインツール
 */
export async function writeFile(
  params: WriteFileParams,
  safety: SafetyController
): Promise<WriteFileResult> {
  try {
    // パラメータ検証
    if (!params.path) {
      throw new Error('File path is required');
    }
    
    if (params.content === undefined || params.content === null) {
      throw new Error('Content is required');
    }
    
    // パスの正規化
    const normalizedPath = path.normalize(params.path);
    
    // ディレクトリアクセスチェック
    const dirPath = path.dirname(normalizedPath);
    const dirCheck = await safety.validateDirectoryAccess(dirPath);
    if (!dirCheck.safe) {
      throw new Error(`Directory access denied: ${dirCheck.reason}`);
    }
    
    // 既存ファイルチェック
    let fileExists = false;
    let existingSize = 0;
    
    try {
      const stats = await fs.stat(normalizedPath);
      fileExists = stats.isFile();
      existingSize = stats.size;
    } catch {
      // ファイルが存在しない場合は新規作成
      fileExists = false;
    }
    
    // コンテンツサイズチェック
    const encoding = normalizeEncoding(params.encoding || 'utf8');
    const contentBuffer = Buffer.from(params.content, encoding as BufferEncoding);
    const contentSize = contentBuffer.length;
    
    // サイズ制限チェック
    if (contentSize > SAFETY_LIMITS.WRITE_MAX_SIZE) {
      throw new Error(
        `Content size (${(contentSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${SAFETY_LIMITS.WRITE_MAX_SIZE / 1024 / 1024}MB)`
      );
    }
    
    // ディスク容量チェック（可能な場合）
    if (SAFETY_LIMITS.DISK_SPACE_CHECK) {
      // TODO: ディスク容量チェックの実装
      // Node.jsでは標準的な方法がないため、今回はスキップ
    }
    
    // ディレクトリが存在しない場合は作成
    await fs.mkdir(dirPath, { recursive: true });
    
    // ファイル書き込み
    await fs.writeFile(normalizedPath, params.content, encoding as BufferEncoding);
    
    // トークン推定
    const estimatedTokens = estimateTokenCount(params.content);
    
    // 結果生成
    const result: WriteFileResult = {
      status: 'success',
      file_info: {
        path: normalizedPath,
        size_bytes: contentSize,
        created_new: !fileExists,
        estimated_tokens: estimatedTokens
      }
    };
    
    // 大容量警告
    if (contentSize >= SAFETY_LIMITS.WRITE_WARNING_SIZE) {
      result.status = 'warning';
      result.issue_details = {
        reason: 'Large file write detected',
        risk_level: contentSize >= 5 * 1024 * 1024 ? 'high' : 'medium',
        size_warning: {
          size_mb: contentSize / 1024 / 1024,
          recommendation: 'Consider splitting into smaller files for better performance'
        }
      };
      result.alternatives = {
        suggestions: [
          'Split data into multiple smaller files',
          'Use streaming write for very large content',
          'Consider database storage for large datasets',
          'Compress data before writing if appropriate'
        ]
      };
    }
    
    // 既存ファイル上書き時の情報
    if (fileExists && existingSize > 0) {
      if (!result.warnings) {
        result.warnings = [];
      }
      result.warnings.push(
        `Overwrote existing file (previous size: ${(existingSize / 1024).toFixed(2)}KB)`
      );
    }
    
    return result;
    
  } catch (error) {
    // エラーレスポンス
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      status: 'error',
      file_info: {
        path: params.path,
        size_bytes: 0,
        created_new: false,
        estimated_tokens: 0
      },
      issue_details: {
        reason: errorMessage,
        risk_level: 'high'
      },
      alternatives: {
        suggestions: getErrorSuggestions(errorMessage)
      },
      warnings: [errorMessage]
    };
  }
}

/**
 * エンコーディングの正規化
 */
function normalizeEncoding(encoding: FileEncoding): string {
  const encodingMap: Record<string, string> = {
    'utf8': 'utf8',
    'utf16le': 'utf16le',
    'utf16be': 'utf16le', // Node.jsはutf16beを直接サポートしていない
    'utf32le': 'utf16le', // Node.jsはutf32を直接サポートしていない
    'utf32be': 'utf16le',
    'ascii': 'ascii',
    'latin1': 'latin1',
    'shift_jis': 'utf8', // 変換が必要
    'euc-jp': 'utf8',
    'gb2312': 'utf8',
    'unknown': 'utf8'
  };
  
  return encodingMap[encoding] || 'utf8';
}

/**
 * エラーに基づく提案生成
 */
function getErrorSuggestions(errorMessage: string): string[] {
  const suggestions: string[] = [];
  
  if (errorMessage.includes('EACCES') || errorMessage.includes('Permission denied')) {
    suggestions.push(
      'Check file permissions',
      'Run with appropriate privileges',
      'Verify the directory is writable',
      'Use a different directory with write permissions'
    );
  } else if (errorMessage.includes('ENOENT')) {
    suggestions.push(
      'Verify the directory path exists',
      'Create parent directories first',
      'Check for typos in the path',
      'Use absolute path instead of relative path'
    );
  } else if (errorMessage.includes('ENOSPC')) {
    suggestions.push(
      'Free up disk space',
      'Write to a different drive',
      'Reduce file size',
      'Clean up temporary files'
    );
  } else if (errorMessage.includes('exceeds maximum')) {
    suggestions.push(
      'Split content into multiple files',
      'Compress content before writing',
      'Use a streaming approach',
      'Store in a database instead'
    );
  } else {
    suggestions.push(
      'Check the file path syntax',
      'Verify you have write permissions',
      'Ensure the path is not too long',
      'Try writing to a different location'
    );
  }
  
  return suggestions;
}
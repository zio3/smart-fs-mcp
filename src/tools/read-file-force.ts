/**
 * Smart Filesystem MCP - Read File Force Tool
 * Allows reading files that exceed normal limits with explicit acknowledgment
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SafetyController } from '../core/safety-controller.js';
import { FileAnalyzer } from '../core/file-analyzer.js';
// import { formatBytes } from '../utils/helpers.js'; // Removed - using KB units now
import { SAFETY_LIMITS } from '../utils/constants.js';
import type { 
  ReadFileForceParams, 
  SimpleReadFileSuccess
} from '../core/types.js';
import { createUnifiedError, createUnifiedErrorFromException, ErrorCodes, UnifiedError, validatePath } from '../utils/unified-error-handler.js';

/**
 * Force read file with relaxed limits
 */
export async function readFileForce(
  params: ReadFileForceParams,
  safety: SafetyController,
  analyzer: FileAnalyzer
): Promise<SimpleReadFileSuccess | UnifiedError> {
  // パスバリデーション
  const pathValidation = validatePath(params.path);
  if (!pathValidation.valid) {
    return createUnifiedError(
      ErrorCodes.MISSING_PATH,
      'read_file_force',
      {},
      pathValidation.error?.includes('empty') ? 'ファイルパスが指定されていません' : '不正なパス形式です'
    );
  }
  
  // 絶対パスチェック
  if (!path.isAbsolute(params.path)) {
    return createUnifiedError(
      ErrorCodes.PATH_NOT_ABSOLUTE,
      'read_file_force',
      { path: params.path }
    );
  }

  // Validate acknowledgment
  if (!params.acknowledge_risk) {
    return createUnifiedError(
      ErrorCodes.ACCESS_DENIED,
      'read_file_force',
      { path: params.path },
      'acknowledge_risk=trueの設定が必要です。大きなファイルは大量のトークンを消費する可能性があります。',
      ['リスクを承認してacknowledge_risk=trueで再実行してください']
    );
  }
  
  try {
    // Get file stats
    const stats = await fs.stat(params.path);
    
    // Check against KB-based force read limit
    const fileSizeKB = Math.round(stats.size / 1024);
    
    if (fileSizeKB > SAFETY_LIMITS.FORCE_READ_LIMIT_KB) {
      return createUnifiedError(
        ErrorCodes.FILE_TOO_LARGE,
        'read_file_force',
        { 
          path: params.path,
          size_kb: fileSizeKB,
          limit_kb: SAFETY_LIMITS.FORCE_READ_LIMIT_KB
        },
        `ファイルサイズ（${fileSizeKB} KB）が強制読み取り制限（${SAFETY_LIMITS.FORCE_READ_LIMIT_KB} KB）を超えています`
      );
    }
    
    // Quick analysis to check if binary
    const analysis = await analyzer.analyzeFile(params.path);
    
    if (analysis.isBinary) {
      return createUnifiedError(
        ErrorCodes.OPERATION_FAILED,
        'read_file_force',
        { path: params.path },
        'バイナリファイルはテキストとして読み取れません（強制読み取りでも不可）'
      );
    }
    
    // Warn about token usage
    const estimatedTokens = analysis.estimatedTokens || Math.ceil(stats.size / 4);
    if (estimatedTokens > 100000) {
      console.error(`WARNING: Force reading file with ~${estimatedTokens.toLocaleString()} estimated tokens`);
    }
    
    // Proceed with force read
    const content = await safety.enforceTimeout(
      fs.readFile(params.path, { encoding: (params.encoding || 'utf8') as BufferEncoding }),
      30000, // 30 second timeout for large files
      'Force read file'
    );
    
    return {
      success: true,
      content: content.toString()
    };
    
  } catch (error) {
    return createUnifiedErrorFromException(error, 'read_file_force', params.path);
  }
}
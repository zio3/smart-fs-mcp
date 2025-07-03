/**
 * Smart Filesystem MCP - Search Files Tool
 * grep的な高機能検索ツール（LLMフレンドリー）
 */

import * as path from 'path';
import { SafetyController } from '../core/safety-controller.js';
import { validateRegexPattern } from '../utils/regex-validator.js';
// import { formatBytes } from '../utils/helpers.js';
import { 
  searchByFileName, 
  searchByContent, 
  searchBoth,
  // calculateRelevanceScore 
} from '../core/search-engine.js';
import type { SearchEngineOptions } from '../core/search-engine.js';
import type { 
  SearchContentParams,
  SearchContentSuccess,
  SearchMatch
} from '../core/types.js';
import { createUnifiedError, createUnifiedErrorFromException, ErrorCodes, UnifiedError, validatePath } from '../utils/unified-error-handler.js';

/**
 * 検索制限値
 */
const SEARCH_LIMITS = {
  MAX_FILES_TO_SCAN: 10000,
  MAX_PATTERN_LENGTH: 1000,
  MAX_FILE_SIZE_CONTENT: 10 * 1024 * 1024,
  REGEX_TIMEOUT_MS: 1000,
  TOTAL_SEARCH_TIMEOUT: 30000,
  MAX_RESULTS: 500
};


/**
 * ファイル検索メインツール - Simple format (default)
 */
export async function searchContent(
  params: SearchContentParams,
  safety: SafetyController
): Promise<SearchContentSuccess | UnifiedError> {
  try {
    // ディレクトリパスバリデーション（必須）
    if (!params.directory) {
      return createUnifiedError(
        ErrorCodes.MISSING_PATH,
        'search_content',
        {},
        '検索ディレクトリが指定されていません'
      );
    }
    
    const dirValidation = validatePath(params.directory);
    if (!dirValidation.valid) {
      return createUnifiedError(
        ErrorCodes.INVALID_PATH,
        'search_content',
        { directory: params.directory },
        dirValidation.error?.includes('empty') ? '検索ディレクトリが指定されていません' : '不正なパス形式です'
      );
    }
    
    // 絶対パスチェック
    if (!path.isAbsolute(params.directory)) {
      return createUnifiedError(
        ErrorCodes.PATH_NOT_ABSOLUTE,
        'search_content',
        { directory: params.directory }
      );
    }

    // パラメータ検証
    const validationError = validateParams(params);
    if (validationError) {
      return createUnifiedError(
        ErrorCodes.INVALID_REGEX,
        'search_content',
        {},
        validationError
      );
    }
    
    // デフォルト値設定
    const directory = params.directory; // 必須なのでデフォルトなし
    const recursive = params.recursive ?? true;
    const maxDepth = params.max_depth ?? 10;
    const maxFiles = Math.min(params.max_files ?? 100, SEARCH_LIMITS.MAX_RESULTS);
    const excludeDirs = Array.isArray(params.exclude_dirs) 
      ? params.exclude_dirs 
      : ['node_modules', '.git', 'dist', 'build', '.next'];
    
    // ディレクトリアクセスチェック
    const accessCheck = await safety.validateDirectoryAccess(directory);
    if (!accessCheck.safe) {
      return createUnifiedError(
        ErrorCodes.ACCESS_DENIED,
        'search_content',
        { directory },
        `アクセスが拒否されました: ${accessCheck.reason}`
      );
    }
    
    // 検索実行
    const searchType = determineSearchType(params.file_pattern, params.content_pattern);
    const searchOptions: SearchEngineOptions = {
      recursive,
      maxDepth,
      extensions: params.extensions,
      excludeExtensions: params.exclude_extensions,
      excludeDirs,
      caseSensitive: params.case_sensitive ?? false,
      wholeWord: params.whole_word ?? false,
      maxFiles,
      maxMatchesPerFile: params.max_matches_per_file ?? 10
    };
    
    let results: any[];
    try {
      results = await executeSearch(
        directory,
        params.file_pattern,
        params.content_pattern,
        searchType,
        searchOptions
      );
    } catch (searchError) {
      return createUnifiedErrorFromException(searchError, 'search_content', directory);
    }
    
    // No matches found
    if (results.length === 0) {
      return createUnifiedError(
        ErrorCodes.PATTERN_NOT_FOUND,
        'search_content',
        { pattern: params.file_pattern || params.content_pattern },
        '一致するファイルが見つかりませんでした'
      );
    }
    
    // Convert to simple matches
    const matches = await convertToSimpleMatches(results);
    
    return {
      success: true,
      matches,
      search_type: searchType,
      search_stats: {
        files_scanned: results.length,
        files_with_matches: matches.length,
        total_matches: matches.reduce((sum, m) => sum + m.matchCount, 0)
      }
    };
    
  } catch (error) {
    return createUnifiedErrorFromException(error, 'search_content', params.directory);
  }
}

/**
 * パラメータ検証
 */
function validateParams(params: SearchContentParams): string | null {
  // 必須チェック
  if (!params.file_pattern && !params.content_pattern) {
    return 'No search patterns specified';
  }
  
  // 正規表現検証
  if (params.file_pattern) {
    const validation = validateRegexPattern(params.file_pattern);
    if (!validation.valid) {
      return `Invalid file pattern: ${validation.error}`;
    }
  }
  
  if (params.content_pattern) {
    const validation = validateRegexPattern(params.content_pattern);
    if (!validation.valid) {
      return `Invalid content pattern: ${validation.error}`;
    }
  }
  
  return null;
}

/**
 * 検索タイプの判定
 */
function determineSearchType(filePattern?: string, contentPattern?: string): string {
  if (filePattern && contentPattern) return 'both';
  if (filePattern) return 'filename';
  if (contentPattern) return 'content';
  return 'unknown';
}

/**
 * 検索実行
 */
async function executeSearch(
  directory: string,
  filePattern: string | undefined,
  contentPattern: string | undefined,
  searchType: string,
  options: any
): Promise<any[]> {
  switch (searchType) {
    case 'filename':
      return searchByFileName(directory, filePattern!, options);
    case 'content':
      return searchByContent(directory, contentPattern!, options);
    case 'both':
      return searchBoth(directory, filePattern || null, contentPattern || null, options);
    default:
      return [];
  }
}


import * as fs from 'fs/promises';


/**
 * Convert search results to simple matches
 */
async function convertToSimpleMatches(results: any[]): Promise<SearchMatch[]> {
  const matches: SearchMatch[] = [];
  
  for (const result of results) {
    // Get file size
    let fileSize = result.file_size_bytes || 0;
    if (fileSize === 0) {
      try {
        const stats = await fs.stat(result.file_path);
        fileSize = stats.size;
      } catch {
        // Ignore stat errors
      }
    }
    
    // Extract content keywords
    const contents = extractContentKeywords(result);
    
    // Calculate match count
    const matchCount = (result.filename_matches || 0) + (result.content_matches || 0);
    
    matches.push({
      file: result.file_path,
      matchCount,
      fileSize,
      contents
    });
  }
  
  return matches;
}

/**
 * Extract keywords from search results with deduplication
 */
function extractContentKeywords(result: any): string[] {
  const keywords = new Set<string>();
  
  // Priority 1: Use matchedStrings if available (これが正確なマッチ文字列)
  if (result.matchedStrings && Array.isArray(result.matchedStrings)) {
    // matchedStringsから重複を除去して返す
    for (const matchStr of result.matchedStrings) {
      if (matchStr && typeof matchStr === 'string') {
        keywords.add(matchStr);
      }
    }
    return Array.from(keywords);
  }
  
  // Fallback: Extract from match context if matchedStrings not available
  const maxKeywords = 5;
  let totalFound = 0;
  
  if (result.match_context && Array.isArray(result.match_context)) {
    for (const context of result.match_context) {
      // Extract function names
      const funcMatches = context.match(/(?:function|const|let|var)\s+(\w+)/g);
      if (funcMatches) {
        for (const match of funcMatches) {
          const name = match.replace(/(?:function|const|let|var)\s+/, '');
          if (!keywords.has(name)) {
            totalFound++;
            if (keywords.size < maxKeywords) {
              keywords.add(name);
            }
          }
        }
      }
      
      // Extract class names
      const classMatches = context.match(/(?:class|interface)\s+(\w+)/g);
      if (classMatches) {
        for (const match of classMatches) {
          const name = match.replace(/(?:class|interface)\s+/, '');
          if (!keywords.has(name)) {
            totalFound++;
            if (keywords.size < maxKeywords) {
              keywords.add(name);
            }
          }
        }
      }
      
      // Extract export names
      const exportMatches = context.match(/export\s+(?:default\s+)?(?:function|class|const|let|var)?\s*(\w+)/g);
      if (exportMatches) {
        for (const match of exportMatches) {
          const parts = match.split(/\s+/);
          const name = parts[parts.length - 1];
          if (name && /^\w+$/.test(name) && !keywords.has(name)) {
            totalFound++;
            if (keywords.size < maxKeywords) {
              keywords.add(name);
            }
          }
        }
      }
    }
  }
  
  // Extract from content preview if no keywords found
  if (keywords.size === 0 && result.content_preview) {
    const preview = result.content_preview;
    
    // Simple identifier extraction
    const identifiers = preview.match(/\b[A-Z][a-zA-Z0-9]*\b/g);
    if (identifiers) {
      for (const id of identifiers) {
        if (!keywords.has(id)) {
          totalFound++;
          if (keywords.size < maxKeywords) {
            keywords.add(id);
          }
        }
      }
    }
  }
  
  const keywordArray = Array.from(keywords);
  
  // Add "+N more" if there are more keywords than the limit
  if (totalFound > maxKeywords) {
    keywordArray.push(`+${totalFound - maxKeywords} more`);
  }
  
  return keywordArray;
}



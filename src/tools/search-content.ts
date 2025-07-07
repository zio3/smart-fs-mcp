/**
 * Smart Filesystem MCP - Search Files Tool
 * grep的な高機能検索ツール（LLMフレンドリー）
 */

import * as path from 'path';
import * as fs from 'fs/promises';
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
  SearchMatch,
  LineMatch,
  RefinementSuggestion
} from '../core/types.js';
import { createUnifiedError, createUnifiedErrorFromException, ErrorCodes, UnifiedError, validatePath } from '../utils/unified-error-handler.js';
import { getDefaultExcludeDirs } from '../core/exclude-dirs.js';

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
 * 表示制限とオプション
 */
const DISPLAY_LIMIT = 50;
const ENABLE_REFINEMENT_SUGGESTIONS = true;

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
        ErrorCodes.INVALID_PARAMETER,
        'search_content',
        {
          valid_combinations: [
            'file_pattern のみ',
            'content_pattern のみ', 
            'extensions のみ',
            'file_pattern + content_pattern',
            'file_pattern + extensions',
            'content_pattern + extensions'
          ]
        },
        validationError
      );
    }
    
    // デフォルト値設定
    const directory = params.directory; // 必須なのでデフォルトなし
    const recursive = params.recursive ?? true;
    const maxDepth = params.max_depth ?? 10;
    const maxFiles = Math.min(params.max_files ?? 100, SEARCH_LIMITS.MAX_RESULTS);
    
    // 除外ディレクトリの決定
    let excludeDirs: readonly string[];
    if (params.exclude_dirs) {
      // 明示的な指定がある場合は優先
      excludeDirs = params.exclude_dirs;
    } else {
      // デフォルト除外を使用
      const defaultExclude = getDefaultExcludeDirs(params.userDefaultExcludeDirs ?? true);
      excludeDirs = defaultExclude.dirs;
    }
    
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
    const searchType = determineSearchType(params.file_pattern, params.content_pattern, params.extensions);
    const searchOptions: SearchEngineOptions = {
      recursive,
      maxDepth,
      extensions: params.extensions,
      excludeExtensions: params.exclude_extensions,
      excludeDirs: [...excludeDirs], // Convert readonly array to mutable array
      caseSensitive: params.case_sensitive ?? false,
      wholeWord: params.whole_word ?? false,
      maxFiles,
      maxMatchesPerFile: DISPLAY_LIMIT,  // 固定値を使用
      // Note: Binary file filtering is handled in search-engine.ts
    };
    
    let searchResult: any;
    try {
      searchResult = await executeSearch(
        directory,
        params.file_pattern,
        params.content_pattern,
        searchType,
        searchOptions
      );
    } catch (searchError) {
      return createUnifiedErrorFromException(searchError, 'search_content', directory);
    }
    
    // Extract results from new format
    const results = searchResult.matches || [];
    const filesScanned = searchResult.filesScanned || 0;
    const binarySkipped = searchResult.binarySkipped || 0;
    const directoriesSkipped = searchResult.directoriesSkipped || 0;
    const encounteredExcludes = searchResult.encounteredExcludes || [];
    
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
    
    // Determine exclude source
    let excludeSource: 'user_default' | 'minimal' | 'custom';
    if (params.exclude_dirs) {
      excludeSource = 'custom';
    } else if (params.userDefaultExcludeDirs ?? true) {
      excludeSource = 'user_default';
    } else {
      excludeSource = 'minimal';
    }

    // 総マッチ数を計算
    const totalMatches = matches.reduce((sum, m) => sum + m.matchCount, 0);
    
    // 表示されるマッチ数（最大DISPLAY_LIMIT件）
    const displayedMatches = Math.min(matches.length, DISPLAY_LIMIT);
    const truncatedMatches = matches.slice(0, DISPLAY_LIMIT);
    
    const searchStats: any = {
      files_scanned: filesScanned,
      files_with_matches: matches.length,
      total_matches: totalMatches,
      displayed_matches: displayedMatches,
      is_truncated: matches.length > DISPLAY_LIMIT
    };
    
    // バイナリファイルスキップ数を含める
    if (binarySkipped > 0) {
      searchStats.binary_files_skipped = binarySkipped;
    }
    
    // ディレクトリスキップ数を含める
    if (directoriesSkipped > 0) {
      searchStats.directories_skipped = directoriesSkipped;
    }
    
    // 警告メッセージの収集
    const warnings: string[] = [];
    if (params.extensions && params.extensions.length === 0) {
      warnings.push('空の拡張子配列: 拡張子なしファイルのみ検索します');
    }

    const result: SearchContentSuccess = {
      success: true,
      matches: truncatedMatches,  // DISPLAY_LIMIT件に制限
      search_type: searchType,
      search_stats: searchStats,
      exclude_info: {
        excluded_dirs_used: [...excludeDirs],
        excluded_dirs_found: encounteredExcludes,
        exclude_source: excludeSource
      }
    };
    
    // 警告がある場合のみ追加
    if (warnings.length > 0) {
      result.warnings = warnings;
    }
    
    // 絞り込み提案を追加
    if (ENABLE_REFINEMENT_SUGGESTIONS) {
      const refinementSuggestions = generateRefinementSuggestions(matches.length, params);
      if (refinementSuggestions) {
        result.refinement_suggestions = refinementSuggestions;
      }
    }
    
    return result;
    
  } catch (error) {
    return createUnifiedErrorFromException(error, 'search_content', params.directory);
  }
}

/**
 * パラメータ検証
 */
function validateParams(params: SearchContentParams): string | null {
  // 必須チェック - file_pattern、content_pattern、extensionsのいずれかが必要
  if (!params.file_pattern && !params.content_pattern && !params.extensions) {
    return '検索パラメータが不足しています。file_pattern、content_pattern、またはextensionsのいずれかを指定してください';
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
function determineSearchType(filePattern?: string, contentPattern?: string, extensions?: string[]): string {
  if (filePattern && contentPattern) return 'both';
  if (filePattern) return 'filename';
  if (contentPattern) return 'content';
  if (extensions && extensions.length > 0) return 'extensions';
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
): Promise<any> {
  switch (searchType) {
    case 'filename':
      return searchByFileName(directory, filePattern!, options);
    case 'content':
      return searchByContent(directory, contentPattern!, options);
    case 'both':
      return searchBoth(directory, filePattern || null, contentPattern || null, options);
    case 'extensions':
      // extensionsのみの場合は、全ファイル名を対象に検索（ワイルドカードパターン）
      return searchByFileName(directory, '.*', options);
    default:
      return { matches: [], filesScanned: 0, binarySkipped: 0, directoriesSkipped: 0, encounteredExcludes: [] };
  }
}

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
    
    // Calculate match count
    const matchCount = (result.filename_matches || 0) + (result.content_matches || 0);
    
    // Basic match info
    const match: SearchMatch = {
      file: result.file_path,
      matchCount,
      fileSize
    };
    
    // Always add detailed lines info if available
    if (result.lineMatches) {
      match.lines = formatLineMatches(result.lineMatches);
    }
    
    matches.push(match);
  }
  
  return matches;
}

/**
 * Format line matches with limit
 */
function formatLineMatches(lineMatches: Array<{ content: string; lineNo: number }>): (LineMatch | string)[] {
  const maxLines = DISPLAY_LIMIT;
  const lines: (LineMatch | string)[] = [];
  
  // Add up to DISPLAY_LIMIT lines
  for (let i = 0; i < Math.min(lineMatches.length, maxLines); i++) {
    const match = lineMatches[i];
    if (match) {
      lines.push(match);
    }
  }
  
  // No "+N more" - just truncate at DISPLAY_LIMIT
  
  return lines;
}

/**
 * 絞り込み提案を生成
 */
function generateRefinementSuggestions(
  totalMatches: number,
  currentParams: SearchContentParams
): RefinementSuggestion | undefined {
  
  if (totalMatches <= DISPLAY_LIMIT) {
    return undefined;
  }

  const suggestions: string[] = [];
  
  // ファイルパターン提案
  if (!currentParams.file_pattern) {
    suggestions.push("file_pattern を追加 (例: '*.ts' でTypeScriptファイルのみ)");
  }
  
  // 拡張子提案  
  if (!currentParams.extensions || currentParams.extensions.length === 0) {
    suggestions.push("extensions を指定 (例: ['.ts', '.js'] で特定ファイル型のみ)");
  }
  
  // ディレクトリ絞り込み提案
  if (currentParams.directory && currentParams.directory.includes('/')) {
    const parts = currentParams.directory.split('/');
    if (parts.length > 2) {
      suggestions.push("directory をより具体的に (例: '" + currentParams.directory + "/src' でsrcディレクトリのみ)");
    }
  }
  
  // パターン具体化提案
  if (currentParams.content_pattern && !currentParams.content_pattern.includes('\\b')) {
    suggestions.push("content_pattern を具体化 (例: '\\\\b" + currentParams.content_pattern + "\\\\b' で完全一致)");
  }

  return {
    message: `${totalMatches}件中${DISPLAY_LIMIT}件を表示しています。より具体的な結果を得るには:`,
    options: suggestions,
    current_filters: {
      directory: currentParams.directory || '',
      file_pattern: currentParams.file_pattern,
      content_pattern: currentParams.content_pattern,
      extensions: currentParams.extensions
    }
  };
}



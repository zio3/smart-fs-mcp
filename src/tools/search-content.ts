/**
 * Smart Filesystem MCP - Search Files Tool
 * grep的な高機能検索ツール（LLMフレンドリー）
 */

import { SafetyController } from '../core/safety-controller.js';
import { validateRegexPattern } from '../utils/regex-validator.js';
import { formatBytes } from '../utils/helpers.js';
import { 
  searchByFileName, 
  searchByContent, 
  searchBoth,
  calculateRelevanceScore 
} from '../core/search-engine.js';
import type { 
  SearchFilesParams,
  SearchFilesResponse,
  SearchInfo,
  SearchResult,
  SearchSummary
} from '../core/types.js';

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
 * 一般的な使用例
 */
const COMMON_EXAMPLES = [
  {
    description: '関数定義を探す',
    params: {
      content_pattern: 'function fetchUser|const fetchUser|fetchUser.*=',
      extensions: ['.js', '.ts']
    }
  },
  {
    description: 'テストファイルを探す',
    params: {
      file_pattern: '.*\\.(test|spec)\\.',
      extensions: ['.js', '.ts']
    }
  },
  {
    description: '設定ファイルを探す',
    params: {
      file_pattern: 'config|settings',
      extensions: ['.json', '.yaml', '.env']
    }
  },
  {
    description: 'TODOコメントを探す',
    params: {
      content_pattern: 'TODO|FIXME|HACK|XXX',
      extensions: ['.js', '.ts', '.py', '.java']
    }
  }
];

/**
 * ファイル検索メインツール
 */
export async function searchContent(
  params: SearchContentParams,
  safety: SafetyController
): Promise<SearchContentResponse> {
  const startTime = Date.now();
  const warnings: string[] = [];
  
  try {
    // パラメータ検証
    const validationError = validateParams(params);
    if (validationError) {
      return createErrorResponse(validationError);
    }
    
    // デフォルト値設定
    const directory = params.directory || './';
    const recursive = params.recursive ?? true;
    const maxDepth = params.max_depth ?? 10;
    const maxFiles = Math.min(params.max_files ?? 100, SEARCH_LIMITS.MAX_RESULTS);
    const maxMatchesPerFile = params.max_matches_per_file ?? 50;
    const excludeDirs = params.exclude_dirs ?? ['node_modules', '.git', 'dist', 'build', '.next'];
    
    // 検索タイプの判定
    const searchType = determineSearchType(params.file_pattern, params.content_pattern);
    const pattern = params.file_pattern || params.content_pattern || '';
    
    // ディレクトリアクセスチェック
    const accessCheck = await safety.validateDirectoryAccess(directory);
    if (!accessCheck.safe) {
      return createErrorResponse(`Directory access denied: ${accessCheck.reason}`);
    }
    
    // 検索オプション設定
    const searchOptions = {
      caseSensitive: params.case_sensitive ?? false,
      wholeWord: params.whole_word ?? false,
      maxDepth,
      maxFiles,
      maxMatchesPerFile,
      excludeDirs,
      extensions: params.extensions,
      excludeExtensions: params.exclude_extensions,
      recursive
    };
    
    // タイムアウト付きで検索実行
    const searchPromise = executeSearch(
      directory,
      params.file_pattern,
      params.content_pattern,
      searchType,
      searchOptions
    );
    
    const results = await safety.enforceTimeout(
      searchPromise,
      SEARCH_LIMITS.TOTAL_SEARCH_TIMEOUT,
      'File search'
    );
    
    // 結果が多すぎる場合の警告
    if (results.length >= maxFiles) {
      warnings.push(`Search limited to ${maxFiles} results. Use more specific patterns or filters.`);
    }
    
    // サマリー生成
    const summary = generateSummary(results);
    
    // 検索情報
    const searchInfo: SearchInfo = {
      pattern,
      search_type: searchType,
      directory,
      total_files_scanned: 0, // エンジンから取得できない場合は概算
      search_time_ms: Date.now() - startTime
    };
    
    return {
      search_info: searchInfo,
      results,
      summary,
      status: warnings.length > 0 ? 'partial' : 'success',
      warnings: warnings.length > 0 ? warnings : undefined
    };
    
  } catch (error) {
    // タイムアウトエラー
    if (error instanceof Error && error.message.includes('timed out')) {
      return {
        search_info: {
          pattern: params.file_pattern || params.content_pattern || '',
          search_type: 'unknown',
          directory: params.directory || './',
          total_files_scanned: 0,
          search_time_ms: SEARCH_LIMITS.TOTAL_SEARCH_TIMEOUT
        },
        results: [],
        summary: {
          total_matches: 0,
          files_with_matches: 0
        },
        status: 'error',
        warnings: ['Search timed out after 30 seconds. Try using more specific patterns.']
      };
    }
    
    return createErrorResponse(error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * パラメータ検証
 */
function validateParams(params: SearchFilesParams): string | null {
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
): Promise<SearchResult[]> {
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

/**
 * サマリー生成
 */
function generateSummary(results: SearchResult[]): SearchSummary {
  let totalMatches = 0;
  let largestFile = 0;
  let mostMatches: { file_path: string; match_count: number } | undefined;
  let maxMatchCount = 0;
  
  for (const result of results) {
    const matchCount = (result.filename_matches || 0) + (result.content_matches || 0);
    totalMatches += matchCount;
    
    if (result.file_size_bytes > largestFile) {
      largestFile = result.file_size_bytes;
    }
    
    if (matchCount > maxMatchCount) {
      maxMatchCount = matchCount;
      mostMatches = {
        file_path: result.file_path,
        match_count: matchCount
      };
    }
  }
  
  // 次のアクション提案生成
  const nextActions = generateNextActions(results);
  
  return {
    total_matches: totalMatches,
    files_with_matches: results.length,
    largest_file_mb: largestFile > 0 ? largestFile / (1024 * 1024) : undefined,
    most_matches: mostMatches,
    next_actions: nextActions.length > 0 ? nextActions : undefined
  };
}

/**
 * 次のアクション提案生成
 */
function generateNextActions(results: SearchResult[]): string[] {
  const actions: string[] = [];
  
  if (results.length === 0) {
    return ['Try different search patterns or check file extensions filter'];
  }
  
  // 最も多くマッチしたファイル
  if (results.length > 0) {
    const topResult = results[0];
    const matchCount = (topResult.content_matches || 0) + (topResult.filename_matches || 0);
    
    if (matchCount > 10) {
      actions.push(`High matches in ${topResult.file_path} → read_file('${topResult.file_path}')`);
    } else if (results.length === 1) {
      actions.push(`Found in ${topResult.file_path} → read_file('${topResult.file_path}')`);
    }
  }
  
  // 大容量ファイルの警告
  const largeFiles = results.filter(r => r.file_size_bytes > 1024 * 1024);
  if (largeFiles.length > 0) {
    actions.push('Large files detected → use force_read_file() if needed');
  }
  
  // 設定ファイル発見
  const configFiles = results.filter(r => /config|setting/i.test(r.file_path));
  if (configFiles.length > 0) {
    actions.push('Config files found → read_file() to check settings');
  }
  
  // テストファイル発見
  const testFiles = results.filter(r => /test|spec/i.test(r.file_path));
  if (testFiles.length > 0) {
    actions.push('Test files found → check usage examples and test cases');
  }
  
  // パターンが広すぎる場合
  if (results.length > 50) {
    actions.push('Too many results → narrow search with more specific patterns or extensions');
  }
  
  // 複数のディレクトリに分散している場合
  const directories = new Set(results.map(r => path.dirname(r.file_path)));
  if (directories.size > 5) {
    actions.push('Results spread across many directories → consider searching specific directories');
  }
  
  return actions;
}

/**
 * エラーレスポンス生成
 */
function createErrorResponse(errorMessage: string): SearchFilesResponse {
  const isNoPattern = errorMessage.includes('No search patterns');
  
  const response: SearchFilesResponse = {
    search_info: {
      pattern: '',
      search_type: 'unknown',
      directory: './',
      total_files_scanned: 0,
      search_time_ms: 0
    },
    results: [],
    summary: {
      total_matches: 0,
      files_with_matches: 0
    },
    status: 'error',
    warnings: [errorMessage]
  };
  
  // パターン未指定の場合は使用例を提供
  if (isNoPattern) {
    const examples = {
      error: errorMessage,
      suggestion: 'Specify either file_pattern or content_pattern (or both)',
      common_examples: COMMON_EXAMPLES
    };
    response.warnings = [JSON.stringify(examples, null, 2)];
  }
  
  return response;
}

// path モジュールのインポート
import * as path from 'path';
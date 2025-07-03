/**
 * Smart Filesystem MCP - Search Engine Core
 * ファイル検索エンジンのコア実装
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream } from 'fs';
import * as readline from 'readline';
import { 
  createSearchRegex, 
  createFilePathRegex
  // executeRegexWithTimeout,
  // findMatchesWithContext 
} from '../utils/regex-validator.js';
// import { isBinaryContent } from '../utils/helpers.js';
// Note: Using any for search results since we removed legacy SearchResult type

/**
 * バイナリファイル拡張子
 */
const BINARY_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
]);

/**
 * ファイル重要度ルール
 */
const FILE_IMPORTANCE_RULES = {
  high: [
    /^src\/index\./,
    /^src\/main\./,
    /^package\.json$/,
    /.*config.*/,
    /^README\./
  ],
  medium: [
    /^src\//,
    /^lib\//,
    /^components\//
  ],
  low: [
    /^node_modules\//,
    /^dist\//,
    /.*\.min\./,
    /^test\//,
    /^spec\//
  ]
};

/**
 * 検索エンジンオプション
 */
export interface SearchEngineOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  maxDepth: number;
  maxFiles: number;
  maxMatchesPerFile: number;
  excludeDirs: string[];
  extensions?: string[];
  excludeExtensions?: string[];
  recursive: boolean;
}

/**
 * ファイル名検索
 */
export async function searchByFileName(
  rootDir: string,
  pattern: string,
  options: SearchEngineOptions
): Promise<any[]> {
  const results: any[] = [];
  const regex = createFilePathRegex(pattern, options.caseSensitive);
  const scannedCount = { value: 0 };
  
  await scanDirectory(
    rootDir,
    regex,
    null,
    results,
    options,
    0,
    scannedCount,
    'filename'
  );
  
  return results;
}

/**
 * ファイル内容検索
 */
export async function searchByContent(
  rootDir: string,
  pattern: string,
  options: SearchEngineOptions
): Promise<any[]> {
  const results: any[] = [];
  const regex = createSearchRegex(pattern, options.caseSensitive, options.wholeWord);
  const scannedCount = { value: 0 };
  
  await scanDirectory(
    rootDir,
    null,
    regex,
    results,
    options,
    0,
    scannedCount,
    'content'
  );
  
  return results;
}

/**
 * 統合検索（ファイル名と内容の両方）
 */
export async function searchBoth(
  rootDir: string,
  filePattern: string | null,
  contentPattern: string | null,
  options: SearchEngineOptions
): Promise<any[]> {
  const results: any[] = [];
  const fileRegex = filePattern ? createFilePathRegex(filePattern, options.caseSensitive) : null;
  const contentRegex = contentPattern ? createSearchRegex(contentPattern, options.caseSensitive, options.wholeWord) : null;
  const scannedCount = { value: 0 };
  
  await scanDirectory(
    rootDir,
    fileRegex,
    contentRegex,
    results,
    options,
    0,
    scannedCount,
    'both'
  );
  
  return results;
}

/**
 * ディレクトリをスキャンして検索
 */
async function scanDirectory(
  dirPath: string,
  fileRegex: RegExp | null,
  contentRegex: RegExp | null,
  results: any[],
  options: SearchEngineOptions,
  depth: number,
  scannedCount: { value: number },
  searchType: 'filename' | 'content' | 'both'
): Promise<void> {
  // 深度チェック
  if (!options.recursive && depth > 0) return;
  if (depth > options.maxDepth) return;
  
  // 結果数チェック
  if (results.length >= options.maxFiles) return;
  
  // 除外ディレクトリチェック
  const dirName = path.basename(dirPath);
  if (options.excludeDirs && Array.isArray(options.excludeDirs) && options.excludeDirs.includes(dirName)) return;
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (results.length >= options.maxFiles) break;
      
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await scanDirectory(
          fullPath,
          fileRegex,
          contentRegex,
          results,
          options,
          depth + 1,
          scannedCount,
          searchType
        );
      } else if (entry.isFile()) {
        scannedCount.value++;
        
        // 拡張子フィルタ
        if (!shouldIncludeFile(entry.name, options)) continue;
        
        // バイナリファイルチェック
        if (isBinaryFile(entry.name)) continue;
        
        // ファイル検索実行
        const result = await searchFile(
          fullPath,
          fileRegex,
          contentRegex,
          options,
          searchType
        );
        
        if (result) {
          results.push(result);
        }
      }
    }
  } catch (error) {
    // アクセスエラーは無視して続行
  }
}

/**
 * 個別ファイルの検索
 */
async function searchFile(
  filePath: string,
  fileRegex: RegExp | null,
  contentRegex: RegExp | null,
  options: SearchEngineOptions,
  _searchType: 'filename' | 'content' | 'both'
): Promise<any | null> {
  try {
    const stats = await fs.stat(filePath);
    
    // 10MBを超えるファイルの内容検索はスキップ
    if (contentRegex && stats.size > 10 * 1024 * 1024) {
      return null;
    }
    
    let filenameMatches = 0;
    let contentMatches = 0;
    let contentPreview: string | undefined;
    let matchContext: string[] | undefined;
    
    // ファイル名検索
    if (fileRegex) {
      const matches = filePath.match(fileRegex);
      filenameMatches = matches ? matches.length : 0;
    }
    
    // 内容検索
    let matchedStrings: string[] | undefined;
    if (contentRegex) {
      const contentResult = await searchFileContent(filePath, contentRegex, options.maxMatchesPerFile);
      contentMatches = contentResult.matchCount;
      contentPreview = contentResult.preview;
      matchContext = contentResult.context;
      matchedStrings = contentResult.matchedStrings;
    }
    
    // 結果がない場合はnull
    if (filenameMatches === 0 && contentMatches === 0) {
      return null;
    }
    
    return {
      file_path: filePath,
      file_size_bytes: stats.size,
      filename_matches: filenameMatches > 0 ? filenameMatches : undefined,
      content_matches: contentMatches > 0 ? contentMatches : undefined,
      last_modified: stats.mtime.toISOString(),
      content_preview: contentPreview,
      match_context: matchContext,
      matchedStrings: matchedStrings
    };
    
  } catch (error) {
    return null;
  }
}

/**
 * マッチした部分を含む単語全体を抽出
 */
function extractWordContainingMatch(line: string, matchIndex: number, matchLength: number): string {
  // 日本語文字の正規表現
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF]/;
  
  // マッチ開始位置と終了位置
  const matchStart = matchIndex;
  const matchEnd = matchIndex + matchLength;
  
  // 単語の構成文字かどうかを判定
  function isWordChar(char: string | undefined): boolean {
    if (!char) return false;
    return /\w/.test(char) || japaneseRegex.test(char) || char === '-';
  }
  
  // 単語の開始位置を探す
  let wordStart = matchStart;
  while (wordStart > 0) {
    const prevChar = line[wordStart - 1];
    const currentChar = line[wordStart];
    
    // 前の文字が単語構成文字で、現在の文字も単語構成文字なら継続
    if (isWordChar(prevChar) && isWordChar(currentChar)) {
      wordStart--;
    } else {
      break;
    }
  }
  
  // 単語の終了位置を探す
  let wordEnd = matchEnd;
  while (wordEnd < line.length) {
    const currentChar = line[wordEnd];
    
    // 現在の文字が単語構成文字なら継続
    if (isWordChar(currentChar)) {
      wordEnd++;
    } else {
      break;
    }
  }
  
  // 抽出した単語
  let word = line.substring(wordStart, wordEnd);
  
  // 長すぎる場合は省略（最大50文字）
  const maxLength = 50;
  if (word.length > maxLength) {
    // マッチ部分を中心に前後を省略
    const relativeMatchStart = matchStart - wordStart;
    const relativeMatchEnd = matchEnd - wordStart;
    
    // マッチ部分の前後10文字ずつを確保
    const contextBefore = 10;
    const contextAfter = 10;
    
    const truncateStart = Math.max(0, relativeMatchStart - contextBefore);
    const truncateEnd = Math.min(word.length, relativeMatchEnd + contextAfter);
    
    if (truncateStart > 0 || truncateEnd < word.length) {
      word = (truncateStart > 0 ? '...' : '') + 
             word.substring(truncateStart, truncateEnd) + 
             (truncateEnd < word.length ? '...' : '');
    }
  }
  
  return word;
}

/**
 * ファイル内容の検索
 */
async function searchFileContent(
  filePath: string,
  regex: RegExp,
  maxMatches: number
): Promise<{ matchCount: number; preview?: string; context?: string[]; matchedStrings?: string[] }> {
  return new Promise((resolve) => {
    let matchCount = 0;
    let preview: string | undefined;
    const contextLines: string[] = [];
    const matchedStrings: string[] = [];
    const lines: string[] = [];
    let lineNumber = 0;
    
    const rl = readline.createInterface({
      input: createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });
    
    rl.on('line', (line) => {
      lineNumber++;
      lines.push(line);
      
      // メモリ節約のため、3行以上は保持しない
      if (lines.length > 3) {
        lines.shift();
      }
      
      // 実際のマッチ文字列を取得（単語単位で）
      const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
      const matches = line.matchAll(globalRegex);
      let hasMatch = false;
      
      for (const match of matches) {
        if (match[0] && match.index !== undefined) {
          hasMatch = true;
          matchCount++;
          
          // マッチした部分を含む単語全体を抽出
          const wordMatch = extractWordContainingMatch(line, match.index, match[0].length);
          matchedStrings.push(wordMatch);
          
          // 最初のマッチをプレビューとして保存
          if (!preview) {
            preview = line.length > 100 ? line.substring(0, 100) + '...' : line;
          }
        }
        
        if (matchCount >= maxMatches) {
          break;
        }
      }
      
      if (hasMatch) {
        // コンテキストを保存（最大3セット）
        if (contextLines.length < 9) { // 3セット × 3行
          const startIdx = Math.max(0, lines.length - 3);
          for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i];
            if (line !== undefined) contextLines.push(line);
          }
        }
      }
      
      if (matchCount >= maxMatches) {
        rl.close();
      }
    });
    
    rl.on('close', () => {
      resolve({
        matchCount,
        preview,
        context: contextLines.length > 0 ? contextLines.slice(0, 9) : undefined,
        matchedStrings: matchedStrings.length > 0 ? matchedStrings : undefined
      });
    });
    
    rl.on('error', () => {
      resolve({ matchCount: 0 });
    });
  });
}

/**
 * ファイルを含めるかどうかの判定
 */
function shouldIncludeFile(fileName: string, options: SearchEngineOptions): boolean {
  const ext = path.extname(fileName).toLowerCase();
  
  // 除外拡張子チェック
  if (options.excludeExtensions && options.excludeExtensions.includes(ext)) {
    return false;
  }
  
  // 対象拡張子が指定されている場合
  if (options.extensions && options.extensions.length > 0) {
    // 拡張子リストに含まれているかチェック（ドット付き・なし両対応）
    return options.extensions.some(e => {
      const targetExt = e.startsWith('.') ? e : `.${e}`;
      return ext === targetExt;
    });
  }
  
  return true;
}

/**
 * バイナリファイルかどうかの判定
 */
function isBinaryFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * ファイル重要度スコアの計算
 */
export function calculateRelevanceScore(
  filePath: string,
  filenameMatches: number,
  contentMatches: number,
  lastModified: Date
): number {
  let score = 0;
  
  // マッチ数によるスコア（最大50点）
  const totalMatches = filenameMatches + contentMatches;
  score += Math.min(totalMatches * 10, 50);
  
  // ファイル重要度によるスコア（最大30点）
  score += getImportancePoints(filePath);
  
  // 更新日時によるスコア（最大20点）
  score += getRecencyPoints(lastModified);
  
  return Math.min(score, 100);
}

/**
 * ファイルパスから重要度ポイントを取得
 */
function getImportancePoints(filePath: string): number {
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  // 高重要度
  for (const pattern of FILE_IMPORTANCE_RULES.high) {
    if (pattern.test(normalizedPath)) return 30;
  }
  
  // 中重要度
  for (const pattern of FILE_IMPORTANCE_RULES.medium) {
    if (pattern.test(normalizedPath)) return 20;
  }
  
  // 低重要度
  for (const pattern of FILE_IMPORTANCE_RULES.low) {
    if (pattern.test(normalizedPath)) return 5;
  }
  
  return 10; // デフォルト
}

/**
 * 更新日時から新しさポイントを取得
 */
function getRecencyPoints(lastModified: Date): number {
  const now = new Date();
  const diffDays = (now.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
  
  if (diffDays < 1) return 20;      // 今日
  if (diffDays < 7) return 15;      // 今週
  if (diffDays < 30) return 10;     // 今月
  if (diffDays < 365) return 5;     // 今年
  return 0;
}
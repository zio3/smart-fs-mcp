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
import { KNOWN_BINARY_EXTENSIONS, BINARY_DIRECTORIES } from '../utils/constants.js';
import { isBinaryContent } from '../utils/helpers.js';
import type { ExcludedDirectoryInfo } from './types.js';
// Note: Using any for search results since we removed legacy SearchResult type

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
 * 除外ディレクトリの理由マッピング
 */
const EXCLUDE_REASONS: Record<string, ExcludedDirectoryInfo['reason']> = {
  'node_modules': 'performance',
  '.git': 'security',
  'dist': 'performance',
  'build': 'performance',
  'out': 'performance',
  '.next': 'performance',
  'coverage': 'user_default',
  '__tests__': 'user_default',
  'test': 'user_default',
  '.nyc_output': 'user_default',
  'tmp': 'user_default',
  'temp': 'user_default',
  '.vs': 'performance',
  '.vscode': 'user_default',
  'bin': 'performance',
  'obj': 'performance',
  '__pycache__': 'performance'
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
): Promise<any> {
  const results: any[] = [];
  const encounteredExcludes: ExcludedDirectoryInfo[] = [];
  const directoriesSkipped = { value: 0 };
  
  // ファイル名検索では通常の正規表現を使用（パス区切り文字の正規化は不要）
  const flags = options.caseSensitive ? 'g' : 'gi';
  const regex = new RegExp(pattern, flags);
  const scannedCount = { value: 0 };
  const binarySkippedCount = { value: 0 };
  
  await scanDirectory(
    rootDir,
    regex,
    null,
    results,
    options,
    0,
    scannedCount,
    binarySkippedCount,
    'filename',
    rootDir,
    encounteredExcludes,
    directoriesSkipped
  );
  
  return {
    matches: results,
    filesScanned: scannedCount.value,
    binarySkipped: binarySkippedCount.value,
    directoriesSkipped: directoriesSkipped.value,
    encounteredExcludes
  };
}

/**
 * ファイル内容検索
 */
export async function searchByContent(
  rootDir: string,
  pattern: string,
  options: SearchEngineOptions
): Promise<any> {
  const results: any[] = [];
  const encounteredExcludes: ExcludedDirectoryInfo[] = [];
  const directoriesSkipped = { value: 0 };
  
  const regex = createSearchRegex(pattern, options.caseSensitive, options.wholeWord);
  const scannedCount = { value: 0 };
  const binarySkippedCount = { value: 0 };
  
  await scanDirectory(
    rootDir,
    null,
    regex,
    results,
    options,
    0,
    scannedCount,
    binarySkippedCount,
    'content',
    rootDir,
    encounteredExcludes,
    directoriesSkipped
  );
  
  return {
    matches: results,
    filesScanned: scannedCount.value,
    binarySkipped: binarySkippedCount.value,
    directoriesSkipped: directoriesSkipped.value,
    encounteredExcludes
  };
}

/**
 * 統合検索（ファイル名と内容の両方）
 */
export async function searchBoth(
  rootDir: string,
  filePattern: string | null,
  contentPattern: string | null,
  options: SearchEngineOptions
): Promise<any> {
  const results: any[] = [];
  const encounteredExcludes: ExcludedDirectoryInfo[] = [];
  const directoriesSkipped = { value: 0 };
  
  const fileRegex = filePattern ? createFilePathRegex(filePattern, options.caseSensitive) : null;
  const contentRegex = contentPattern ? createSearchRegex(contentPattern, options.caseSensitive, options.wholeWord) : null;
  const scannedCount = { value: 0 };
  const binarySkippedCount = { value: 0 };
  
  await scanDirectory(
    rootDir,
    fileRegex,
    contentRegex,
    results,
    options,
    0,
    scannedCount,
    binarySkippedCount,
    'both',
    rootDir,
    encounteredExcludes,
    directoriesSkipped
  );
  
  return {
    matches: results,
    filesScanned: scannedCount.value,
    binarySkipped: binarySkippedCount.value,
    directoriesSkipped: directoriesSkipped.value,
    encounteredExcludes
  };
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
  binarySkippedCount: { value: number },
  searchType: 'filename' | 'content' | 'both',
  rootDir?: string,
  encounteredExcludes?: ExcludedDirectoryInfo[],
  directoriesSkipped?: { value: number }
): Promise<void> {
  // 深度チェック
  if (!options.recursive && depth > 0) return;
  if (depth > options.maxDepth) return;
  
  // 結果数チェック
  if (results.length >= options.maxFiles) return;
  
  // 除外ディレクトリチェック
  const dirName = path.basename(dirPath);
  if (options.excludeDirs && Array.isArray(options.excludeDirs) && options.excludeDirs.includes(dirName)) {
    // 除外情報を記録
    if (encounteredExcludes && rootDir) {
      const relativePath = path.relative(rootDir, dirPath);
      const reason = EXCLUDE_REASONS[dirName] || 'user_specified';
      
      // 重複チェック
      if (!encounteredExcludes.some(e => e.path === relativePath)) {
        encounteredExcludes.push({
          path: relativePath,
          reason,
          note: reason === 'user_specified' ? 'Excluded by user configuration' : undefined
        });
      }
    }
    
    if (directoriesSkipped) {
      directoriesSkipped.value++;
    }
    
    return;
  }
  
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
          binarySkippedCount,
          searchType,
          rootDir,
          encounteredExcludes,
          directoriesSkipped
        );
      } else if (entry.isFile()) {
        scannedCount.value++;
        
        // 拡張子フィルタ
        if (!shouldIncludeFile(entry.name, options)) continue;
        
        // バイナリファイルチェック（フルパスを使用）
        if (isBinaryFile(fullPath)) {
          binarySkippedCount.value++;
          continue;
        }
        
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
  searchType: 'filename' | 'content' | 'both'
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
      // ファイル名のみを抽出してマッチング
      const fileName = path.basename(filePath);
      const matches = fileName.match(fileRegex);
      filenameMatches = matches ? 1 : 0; // ファイル名マッチは0か1のみ
      
      // デバッグ用（本番では削除）
      // console.log('File pattern:', fileRegex.source, 'Test file:', fileName, 'Match result:', matches !== null);
    }
    
    // 内容検索
    let matchedStrings: string[] | undefined;
    let lineMatches: Array<{ content: string; lineNo: number }> | undefined;
    if (contentRegex) {
      const contentResult = await searchFileContent(filePath, contentRegex, options.maxMatchesPerFile);
      contentMatches = contentResult.matchCount;
      contentPreview = contentResult.preview;
      matchContext = contentResult.context;
      matchedStrings = contentResult.matchedStrings;
      lineMatches = contentResult.lineMatches;
    }
    
    // 結果がない場合はnull
    // ただし、ファイル名検索のみの場合はファイル名マッチのみを確認
    if (searchType === 'filename' && filenameMatches === 0) {
      return null;
    } else if (searchType === 'content' && contentMatches === 0) {
      return null;
    } else if (searchType === 'both' && filenameMatches === 0 && contentMatches === 0) {
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
      matchedStrings: matchedStrings,
      lineMatches: lineMatches
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
): Promise<{ matchCount: number; preview?: string; context?: string[]; matchedStrings?: string[]; lineMatches?: Array<{ content: string; lineNo: number }> }> {
  return new Promise((resolve) => {
    let matchCount = 0;
    let preview: string | undefined;
    const contextLines: string[] = [];
    const matchedStrings: string[] = [];
    const lineMatches: Array<{ content: string; lineNo: number }> = [];
    const lines: string[] = [];
    let lineNumber = 0;
    let binaryDetected = false;
    let firstFewLines = '';
    
    const rl = readline.createInterface({
      input: createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });
    
    rl.on('line', (line) => {
      // 最初の数行でバイナリチェック
      if (lineNumber < 5) {
        firstFewLines += line + '\n';
        if (isBinaryContent(Buffer.from(firstFewLines))) {
          binaryDetected = true;
          rl.close();
          return;
        }
      }
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
      
      // 行番号付きでマッチ情報を記録
      if (hasMatch) {
        lineMatches.push({
          content: line.trim(),
          lineNo: lineNumber
        });
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
      // バイナリファイルが検出された場合は空の結果を返す
      if (binaryDetected) {
        resolve({ matchCount: 0 });
        return;
      }
      
      resolve({
        matchCount,
        preview,
        context: contextLines.length > 0 ? contextLines.slice(0, 9) : undefined,
        matchedStrings: matchedStrings.length > 0 ? matchedStrings : undefined,
        lineMatches: lineMatches.length > 0 ? lineMatches : undefined
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
  if (options.extensions) {
    // 空配列の場合は拡張子なしファイルのみを対象とする
    if (options.extensions.length === 0) {
      return ext === '';
    }
    // 拡張子リストに含まれているかチェック（ドット付き・なし両対応）
    return options.extensions.some(e => {
      const targetExt = e.startsWith('.') ? e : `.${e}`;
      return ext === targetExt;
    });
  }
  
  return true;
}

/**
 * バイナリファイルかどうかの判定（拡張版）
 */
function isBinaryFile(filePath: string): boolean {
  // 拡張子による判定
  const ext = path.extname(filePath).toLowerCase();
  if (KNOWN_BINARY_EXTENSIONS.has(ext)) {
    return true;
  }
  
  // ディレクトリによる判定
  const parts = filePath.split(path.sep);
  return parts.some(part => BINARY_DIRECTORIES.has(part));
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
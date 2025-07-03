/**
 * Smart Filesystem MCP - Enhanced List Directory Tool (LLM-Optimized)
 * Breaking changes: absolute paths required, cross-platform support, enhanced analysis
 * Optimized for LLM consumption with configurable limits and detailed metadata
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { SafetyController } from '../core/safety-controller.js';
import type { 
  EnhancedListDirectoryParams,
  LLMDirectorySuccess,
  EnhancedFileInfo,
  EnhancedSubdirectoryInfo
} from '../core/types.js';
import { createUnifiedError, createUnifiedErrorFromException, ErrorCodes, UnifiedError, validatePath } from '../utils/unified-error-handler.js';

/**
 * LLM最適化制限値
 */
const LLM_LIMITS = {
  DEFAULT_MAX_FILES: 50,           // デフォルトファイル表示数
  DEFAULT_MAX_DIRS: 20,            // デフォルトディレクトリ表示数
  MAX_FILES_ALLOWED: 200,          // 最大ファイル表示数
  MAX_DIRS_ALLOWED: 50,            // 最大ディレクトリ表示数
  OPERATION_TIMEOUT: 8000,         // 8秒タイムアウト
  TOO_MANY_FILES_THRESHOLD: 200    // "多すぎる"警告しきい値
};

/**
 * Cross-platform absolute path validation
 */
function isAbsolutePath(p: string): boolean {
  // Unix/Linux absolute path
  if (p.startsWith('/')) return true;
  
  // Windows absolute path (C:\ or C:/)
  if (/^[A-Za-z]:[/\\]/.test(p)) return true;
  
  return false;
}

/**
 * Normalize Windows paths to forward slashes for consistency
 */
function normalizeAbsolutePath(p: string): string {
  // Convert Windows backslashes to forward slashes
  return p.replace(/\\/g, '/');
}

/**
 * Check if file/directory is hidden
 */
function isHidden(name: string): boolean {
  return name.startsWith('.');
}

/**
 * LLM最適化ディレクトリリスト（絶対パス必須、クロスプラットフォーム対応）
 */
export async function listDirectory(
  params: EnhancedListDirectoryParams,
  safety: SafetyController
): Promise<LLMDirectorySuccess | UnifiedError> {
  try {
    // パスバリデーション
    const pathValidation = validatePath(params.path);
    if (!pathValidation.valid) {
      return createUnifiedError(
        ErrorCodes.MISSING_PATH,
        'list_directory',
        {},
        pathValidation.error?.includes('empty') ? 'ディレクトリパスが指定されていません' : '不正なパス形式です'
      );
    }

    // 絶対パスチェック（Breaking change, cross-platform）
    if (!isAbsolutePath(params.path)) {
      return createUnifiedError(
        ErrorCodes.PATH_NOT_ABSOLUTE,
        'list_directory',
        { path: params.path }
      );
    }
    
    // オリジナルパスを保持
    const originalPath = params.path;
    // パスを正規化（内部処理用）
    const normalizedPath = normalizeAbsolutePath(params.path);
    
    // ディレクトリアクセス権限チェック
    const accessCheck = await safety.validateDirectoryAccess(normalizedPath);
    if (!accessCheck.safe) {
      return createUnifiedError(
        ErrorCodes.ACCESS_DENIED,
        'list_directory',
        { path: params.path },
        `アクセスが拒否されました: ${accessCheck.reason}`
      );
    }
    
    // ディレクトリ存在チェック
    try {
      const stats = await fs.stat(normalizedPath);
      if (!stats.isDirectory()) {
        return createUnifiedError(
          ErrorCodes.FILE_NOT_FOUND,
          'list_directory',
          { path: params.path },
          '指定されたパスはディレクトリではありません'
        );
      }
    } catch {
      return createUnifiedError(
        ErrorCodes.FILE_NOT_FOUND,
        'list_directory',
        { path: params.path },
        '指定されたディレクトリが見つかりません'
      );
    }
    
    // デフォルト値設定
    const maxFiles = Math.min(
      params.max_files || LLM_LIMITS.DEFAULT_MAX_FILES,
      LLM_LIMITS.MAX_FILES_ALLOWED
    );
    const maxDirs = Math.min(
      params.max_directories || LLM_LIMITS.DEFAULT_MAX_DIRS,
      LLM_LIMITS.MAX_DIRS_ALLOWED
    );
    const includeHidden = params.include_hidden !== false; // デフォルトtrue
    
    // タイムアウト制御付きで実行
    return await safety.enforceTimeout(
      scanDirectoryLLMOptimized({
        ...params,
        path: normalizedPath,
        originalPath: originalPath, // オリジナルパスを追加
        max_files: maxFiles,
        max_directories: maxDirs,
        include_hidden: includeHidden
      }),
      LLM_LIMITS.OPERATION_TIMEOUT,
      'List directory'
    );
    
  } catch (error) {
    return createUnifiedErrorFromException(error, 'list_directory', params.path);
  }
}

/**
 * LLM最適化ディレクトリスキャン
 */
async function scanDirectoryLLMOptimized(
  params: EnhancedListDirectoryParams & { 
    max_files: number; 
    max_directories: number; 
    include_hidden: boolean;
    originalPath?: string; // オリジナルパスを追加
  }
): Promise<LLMDirectorySuccess | UnifiedError> {
  const files: EnhancedFileInfo[] = [];
  const directories: EnhancedSubdirectoryInfo[] = [];
  let totalSize = 0;
  let totalFilesFound = 0;
  let hiddenFilesExcluded = 0;
  let hiddenDirsExcluded = 0;
  
  // ファイル種別分析用
  const fileTypeStats = new Map<string, number>();
  let hiddenFileCount = 0;
  
  try {
    // ディレクトリエントリを読み込み
    const entries = await fs.readdir(params.path, { withFileTypes: true });
    
    // エントリを処理
    for (const entry of entries) {
      const fullPath = path.join(params.path, entry.name);
      const hidden = isHidden(entry.name);
      
      try {
        const stats = await fs.stat(fullPath);
        
        if (entry.isFile()) {
          totalFilesFound++;
          
          // 隠しファイルカウント
          if (hidden) {
            hiddenFileCount++;
            if (!params.include_hidden) {
              hiddenFilesExcluded++;
              continue;
            }
          }
          
          // 拡張子取得と統計
          const ext = path.extname(entry.name).slice(1).toLowerCase();
          if (ext) {
            fileTypeStats.set(ext, (fileTypeStats.get(ext) || 0) + 1);
          }
          
          // 拡張子フィルタ適用
          if (params.extensions && !matchesExtensions(entry.name, params.extensions)) {
            continue;
          }
          
          // ファイル数制限
          if (files.length < params.max_files) {
            files.push({
              name: entry.name,
              size: stats.size,
              ext: ext || undefined,
              modified: stats.mtime.toISOString(),
              hidden
            });
            
            totalSize += stats.size;
          }
          
        } else if (entry.isDirectory()) {
          // 隠しディレクトリ処理
          if (hidden && !params.include_hidden) {
            hiddenDirsExcluded++;
            continue;
          }
          
          // ディレクトリ除外フィルタ適用
          if (params.exclude_dirs && params.exclude_dirs.includes(entry.name)) {
            continue;
          }
          
          // ディレクトリ数制限
          if (directories.length < params.max_directories) {
            const subdirInfo = await getEnhancedSubdirectoryInfo(
              fullPath, 
              entry.name, 
              stats,
              hidden
            );
            if (subdirInfo) {
              directories.push(subdirInfo);
            }
          }
        }
      } catch {
        // 個別エラーは無視して続行
      }
    }
    
    // 多すぎるファイルの場合は統一エラー形式で返す
    if (totalFilesFound > LLM_LIMITS.TOO_MANY_FILES_THRESHOLD) {
      return createUnifiedError(
        ErrorCodes.OPERATION_FAILED,
        'list_directory',
        { 
          path: params.path,
          file_count: totalFilesFound,
          max_files: params.max_files || LLM_LIMITS.DEFAULT_MAX_FILES
        },
        `ファイル数が多すぎます（${totalFilesFound}件）。拡張子やディレクトリで絞り込んでください`
      );
    }
    
    // 成功レスポンス
    return {
      success: true,
      path: params.originalPath || params.path, // オリジナルパスを優先
      files,
      directories,
      summary: {
        file_count: files.length,
        directory_count: directories.length,
        total_size: totalSize,
        limited: files.length >= params.max_files,
        additional_files: totalFilesFound > files.length ? totalFilesFound - files.length : undefined,
        hidden_excluded: hiddenFilesExcluded + hiddenDirsExcluded > 0 
          ? hiddenFilesExcluded + hiddenDirsExcluded 
          : undefined
      }
    };
    
  } catch (error) {
    return createUnifiedErrorFromException(error, 'list_directory', params.path);
  }
}

/**
 * 拡張子マッチング（ドット付き・なし両対応）
 */
function matchesExtensions(fileName: string, extensions: string[]): boolean {
  const fileExt = path.extname(fileName).toLowerCase();
  
  return extensions.some(ext => {
    const targetExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    return fileExt === targetExt;
  });
}

/**
 * 拡張サブディレクトリ情報取得（directory_count追加）
 */
async function getEnhancedSubdirectoryInfo(
  subdirPath: string,
  name: string,
  stats: any,
  hidden: boolean
): Promise<EnhancedSubdirectoryInfo | null> {
  try {
    let fileCount = 0;
    let directoryCount = 0;
    
    // サブディレクトリの内容をカウント（深度1まで）
    const entries = await fs.readdir(subdirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile()) {
        fileCount++;
      } else if (entry.isDirectory()) {
        directoryCount++;
      }
    }
    
    return {
      name,
      files: fileCount,
      directories: directoryCount,
      modified: stats.mtime.toISOString(),
      hidden
    };
    
  } catch {
    // アクセスエラーの場合はnullを返す
    return null;
  }
}


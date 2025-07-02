/**
 * Smart Filesystem MCP - List Directory Tool
 * FileSystemMCPの`list_directory`の置き換えとして機能する拡張版
 * ローカルファイルの詳細情報とサブディレクトリの要約情報を効率的に提供
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { SafetyController } from '../core/safety-controller.js';
import { getFileTypeFromExtension } from '../utils/helpers.js';
import type { 
  ListDirectoryParams,
  ListDirectoryResponse,
  FileInfo,
  SubdirectoryInfo,
  DirectorySummary
} from '../core/types.js';

/**
 * 制限値定義
 */
const LIMITS = {
  MAX_FILES_WARNING: 1000,         // 警告しきい値
  MAX_SUBDIRS_TO_SCAN: 500,        // サブディレクトリスキャン上限
  OPERATION_TIMEOUT: 10000,        // 10秒タイムアウト
  MAX_FILE_SIZE_DISPLAY: 1024 * 1024 * 1024  // 1GB表示上限
};

/**
 * ディレクトリの内容を一覧表示（拡張版）
 */
export async function listDirectory(
  params: ListDirectoryParams,
  safety: SafetyController
): Promise<ListDirectoryResponse> {
  const startTime = Date.now();
  const warnings: string[] = [];
  
  // デフォルト値設定
  const includeHidden = params.include_hidden ?? false;
  const sortBy = params.sort_by ?? 'name';
  const sortOrder = params.sort_order ?? 'asc';
  
  // ディレクトリアクセス権限チェック
  const accessCheck = await safety.validateDirectoryAccess(params.path);
  if (!accessCheck.safe) {
    return {
      directory: params.path,
      files: [],
      subdirectories: [],
      summary: {
        total_files: 0,
        total_subdirectories: 0,
        total_size_bytes: 0
      },
      status: 'error',
      warnings: [`Directory access denied: ${accessCheck.reason}`]
    };
  }
  
  try {
    // タイムアウト制御付きで実行
    const result = await safety.enforceTimeout(
      scanDirectoryWithDetails(params.path, includeHidden, sortBy, sortOrder, warnings),
      LIMITS.OPERATION_TIMEOUT,
      'List directory'
    );
    
    // 大量ファイル警告
    if (result.files.length > LIMITS.MAX_FILES_WARNING) {
      warnings.push(`Large directory detected: ${result.files.length} files (warning threshold: ${LIMITS.MAX_FILES_WARNING})`);
    }
    
    return {
      ...result,
      status: warnings.length > 0 ? 'partial' : 'success',
      warnings: warnings.length > 0 ? warnings : undefined
    };
    
  } catch (error) {
    // タイムアウトエラー
    if (error instanceof Error && error.message.includes('timed out')) {
      return {
        directory: params.path,
        files: [],
        subdirectories: [],
        summary: {
          total_files: 0,
          total_subdirectories: 0,
          total_size_bytes: 0
        },
        status: 'partial',
        warnings: ['Operation timed out after 10 seconds']
      };
    }
    
    // その他のエラー
    return {
      directory: params.path,
      files: [],
      subdirectories: [],
      summary: {
        total_files: 0,
        total_subdirectories: 0,
        total_size_bytes: 0
      },
      status: 'error',
      warnings: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * ディレクトリスキャン実装
 */
async function scanDirectoryWithDetails(
  dirPath: string,
  includeHidden: boolean,
  sortBy: 'name' | 'size' | 'modified',
  sortOrder: 'asc' | 'desc',
  warnings: string[]
): Promise<Omit<ListDirectoryResponse, 'status' | 'warnings'>> {
  const files: FileInfo[] = [];
  const subdirectories: SubdirectoryInfo[] = [];
  let totalSize = 0;
  let largestFile: { name: string; size_bytes: number } | undefined;
  
  try {
    // ディレクトリエントリを読み込み
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    // 各エントリを処理
    const processPromises = entries.map(async (entry) => {
      // 隠しファイルのフィルタリング
      if (!includeHidden && entry.name.startsWith('.')) {
        return;
      }
      
      const fullPath = path.join(dirPath, entry.name);
      
      try {
        const stats = await fs.stat(fullPath);
        
        if (entry.isFile()) {
          // ファイル情報を収集
          const fileInfo: FileInfo = {
            name: entry.name,
            size_bytes: stats.size,
            type: 'file',
            last_modified: stats.mtime.toISOString(),
            extension: path.extname(entry.name).toLowerCase() || undefined
          };
          
          files.push(fileInfo);
          totalSize += stats.size;
          
          // 最大ファイルを追跡
          if (!largestFile || stats.size > largestFile.size_bytes) {
            largestFile = {
              name: entry.name,
              size_bytes: stats.size
            };
          }
          
        } else if (entry.isDirectory()) {
          // サブディレクトリの要約情報を取得
          const subdirInfo = await getSubdirectoryInfo(fullPath, entry.name, stats, warnings);
          if (subdirInfo) {
            subdirectories.push(subdirInfo);
          }
        }
      } catch (error) {
        // 個別ファイル/ディレクトリのエラーは警告として記録
        warnings.push(`Permission denied: ${entry.name}`);
      }
    });
    
    // 並列処理実行
    await Promise.allSettled(processPromises);
    
    // ソート処理
    sortEntries(files, subdirectories, sortBy, sortOrder);
    
    return {
      directory: dirPath,
      files,
      subdirectories,
      summary: {
        total_files: files.length,
        total_subdirectories: subdirectories.length,
        total_size_bytes: totalSize,
        largest_file: largestFile
      }
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * サブディレクトリの要約情報を取得
 */
async function getSubdirectoryInfo(
  subdirPath: string,
  name: string,
  stats: fs.Stats,
  warnings: string[]
): Promise<SubdirectoryInfo | null> {
  try {
    let fileCount = 0;
    let folderCount = 0;
    
    // サブディレクトリの内容をカウント（深度1まで）
    const entries = await fs.readdir(subdirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile()) {
        fileCount++;
      } else if (entry.isDirectory()) {
        folderCount++;
      }
    }
    
    return {
      name,
      file_count: fileCount,
      folder_count: folderCount,
      type: 'directory',
      last_modified: stats.mtime.toISOString()
    };
    
  } catch (error) {
    // サブディレクトリアクセスエラー
    warnings.push(`Cannot access subdirectory: ${name}`);
    return null;
  }
}

/**
 * エントリのソート処理
 */
function sortEntries(
  files: FileInfo[],
  subdirectories: SubdirectoryInfo[],
  sortBy: 'name' | 'size' | 'modified',
  sortOrder: 'asc' | 'desc'
): void {
  const multiplier = sortOrder === 'asc' ? 1 : -1;
  
  // ファイルのソート
  files.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name) * multiplier;
      case 'size':
        return (a.size_bytes - b.size_bytes) * multiplier;
      case 'modified':
        return (new Date(a.last_modified).getTime() - new Date(b.last_modified).getTime()) * multiplier;
    }
  });
  
  // サブディレクトリのソート（名前順のみ）
  subdirectories.sort((a, b) => {
    if (sortBy === 'modified') {
      return (new Date(a.last_modified).getTime() - new Date(b.last_modified).getTime()) * multiplier;
    }
    return a.name.localeCompare(b.name) * multiplier;
  });
}
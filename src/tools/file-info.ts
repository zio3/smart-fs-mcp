/**
 * Smart Filesystem MCP - File Info Tool
 * ファイル情報取得ツール（拡張版）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getSecurityController } from '../core/security-controller-v2.js';
import { FileAnalyzer } from '../core/file-analyzer.js';
import { SAFETY_LIMITS } from '../utils/constants.js';
import type { FileAnalysis } from '../core/types.js';

/**
 * file_infoパラメータ
 */
export interface FileInfoParams {
  path: string;
  include_analysis?: boolean;
}

/**
 * ファイル分析情報
 */
export interface FileAnalysisInfo {
  is_binary: boolean;
  encoding: string;
  estimated_tokens: number;
  file_type: 'text' | 'code' | 'config' | 'data' | 'binary';
  syntax_language?: string;
  line_count?: number;
  char_count?: number;
  safe_to_read: boolean;
}

/**
 * ディレクトリ情報
 */
export interface DirectoryInfo {
  file_count: number;
  subdirectory_count: number;
  total_size_estimate: number;
}

/**
 * file_info結果
 */
export interface FileInfoResult {
  path: string;
  resolved_path: string;
  exists: boolean;
  type: 'file' | 'directory' | 'symlink' | 'other';
  
  // 基本情報
  size: number;
  created: string;
  modified: string;
  accessed: string;
  permissions: {
    readable: boolean;
    writable: boolean;
    executable: boolean;
    mode: string;
  };
  
  // 拡張分析情報
  file_analysis?: FileAnalysisInfo;
  
  // ディレクトリ情報
  directory_info?: DirectoryInfo;
}

/**
 * 言語検出
 */
function detectSyntaxLanguage(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.sql': 'sql',
    '.sh': 'bash',
    '.bash': 'bash',
    '.ps1': 'powershell',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.r': 'r',
    '.m': 'matlab',
    '.lua': 'lua',
    '.pl': 'perl',
    '.xml': 'xml',
    '.vue': 'vue',
    '.svelte': 'svelte'
  };
  return languageMap[ext];
}

/**
 * ファイルタイプ検出
 */
function detectFileType(filePath: string, analysis: FileAnalysis): 'text' | 'code' | 'config' | 'data' | 'binary' {
  if (analysis.isBinary) return 'binary';
  
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();
  
  // 設定ファイル
  const configExts = ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config', '.env'];
  const configNames = ['package.json', 'tsconfig.json', '.gitignore', '.eslintrc', 'dockerfile', 'makefile'];
  if (configExts.includes(ext) || configNames.includes(basename)) {
    return 'config';
  }
  
  // コードファイル
  if (detectSyntaxLanguage(filePath)) {
    return 'code';
  }
  
  // データファイル
  const dataExts = ['.csv', '.tsv', '.xml', '.sql'];
  if (dataExts.includes(ext)) {
    return 'data';
  }
  
  return 'text';
}

/**
 * ファイル情報を取得
 */
export async function fileInfo(
  params: FileInfoParams,
  analyzer: FileAnalyzer
): Promise<FileInfoResult> {
  const { path: targetPath, include_analysis = true } = params;
  const security = getSecurityController();
  
  // セキュリティチェック
  const validation = await security.validateAccess(targetPath, 'read');
  if (!validation.allowed) {
    throw new Error(validation.reason || 'Access denied');
  }
  
  const resolvedPath = validation.resolved_path;
  
  try {
    // ファイル/ディレクトリの統計情報を取得
    const stats = await fs.stat(resolvedPath);
    const lstat = await fs.lstat(resolvedPath);
    
    // 基本タイプ判定
    let type: 'file' | 'directory' | 'symlink' | 'other';
    if (lstat.isSymbolicLink()) {
      type = 'symlink';
    } else if (stats.isDirectory()) {
      type = 'directory';
    } else if (stats.isFile()) {
      type = 'file';
    } else {
      type = 'other';
    }
    
    // 権限チェック
    const permissions = {
      readable: false,
      writable: false,
      executable: false,
      mode: '0000'
    };
    
    try {
      await fs.access(resolvedPath, fs.constants.R_OK);
      permissions.readable = true;
    } catch {}
    
    try {
      await fs.access(resolvedPath, fs.constants.W_OK);
      permissions.writable = true;
    } catch {}
    
    try {
      await fs.access(resolvedPath, fs.constants.X_OK);
      permissions.executable = true;
    } catch {}
    
    // Unix形式の権限（Windowsでは擬似的）
    if (process.platform !== 'win32') {
      permissions.mode = '0' + (stats.mode & parseInt('777', 8)).toString(8);
    } else {
      // Windows: 擬似的な権限表現
      const r = permissions.readable ? 4 : 0;
      const w = permissions.writable ? 2 : 0;
      const x = permissions.executable ? 1 : 0;
      permissions.mode = `0${r + w + x}${r + w + x}${r + w + x}`;
    }
    
    // 基本結果
    const result: FileInfoResult = {
      path: targetPath,
      resolved_path: resolvedPath,
      exists: true,
      type,
      size: stats.size,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      accessed: stats.atime.toISOString(),
      permissions
    };
    
    // ファイル分析（ファイルの場合のみ）
    if (type === 'file' && include_analysis) {
      try {
        const analysis = await analyzer.analyzeFile(resolvedPath);
        
        result.file_analysis = {
          is_binary: analysis.isBinary,
          encoding: analysis.encoding || 'unknown',
          estimated_tokens: analysis.estimatedTokens || 0,
          file_type: detectFileType(resolvedPath, analysis),
          syntax_language: detectSyntaxLanguage(resolvedPath),
          line_count: analysis.preview?.lines.length,
          char_count: stats.size, // バイト数を文字数として近似
          safe_to_read: analysis.isSafeToRead && 
                       analysis.estimatedTokens < SAFETY_LIMITS.MAX_TOKEN_ESTIMATE
        };
      } catch (error) {
        // 分析エラーの場合は基本情報のみ返す
        result.file_analysis = {
          is_binary: true,
          encoding: 'unknown',
          estimated_tokens: 0,
          file_type: 'binary',
          safe_to_read: false
        };
      }
    }
    
    // ディレクトリ情報（ディレクトリの場合のみ）
    if (type === 'directory') {
      try {
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        let fileCount = 0;
        let subdirectoryCount = 0;
        let totalSize = 0;
        
        for (const entry of entries) {
          if (entry.isFile()) {
            fileCount++;
            try {
              const filePath = path.join(resolvedPath, entry.name);
              const fileStats = await fs.stat(filePath);
              totalSize += fileStats.size;
            } catch {}
          } else if (entry.isDirectory()) {
            subdirectoryCount++;
          }
        }
        
        result.directory_info = {
          file_count: fileCount,
          subdirectory_count: subdirectoryCount,
          total_size_estimate: totalSize
        };
      } catch (error) {
        // ディレクトリ読み取りエラー
        result.directory_info = {
          file_count: 0,
          subdirectory_count: 0,
          total_size_estimate: 0
        };
      }
    }
    
    return result;
    
  } catch (error) {
    // ファイルが存在しない場合
    if (error instanceof Error && error.message.includes('ENOENT')) {
      return {
        path: targetPath,
        resolved_path: resolvedPath,
        exists: false,
        type: 'other',
        size: 0,
        created: '',
        modified: '',
        accessed: '',
        permissions: {
          readable: false,
          writable: false,
          executable: false,
          mode: '0000'
        }
      };
    }
    
    throw error;
  }
}
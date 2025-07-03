/**
 * Smart Filesystem MCP - File Info Tool
 * ファイル情報取得ツール（軽量版）
 */

import * as fs from 'fs/promises';
import type { Stats } from 'fs';
import * as path from 'path';
import { getSecurityController } from '../core/security-controller-v2.js';
import { createUnifiedError, createUnifiedErrorFromException, ErrorCodes, UnifiedError, validatePath } from '../utils/unified-error-handler.js';

/**
 * file_infoパラメータ
 */
export interface FileInfoParams {
  path: string;
}

/**
 * 成功レスポンス形式 (軽量版)
 */
interface FileInfoSuccess {
  success: true;
  exists: boolean;
  type: 'file' | 'directory' | 'unknown';
  size: number;
  is_binary: boolean;
  modified: string;
}

/**
 * 統一レスポンス形式
 */
export type FileInfoUnifiedResponse = FileInfoSuccess | UnifiedError;

/**
 * バイナリファイルの拡張子リスト
 */
const BINARY_EXTENSIONS = new Set([
  // 画像
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp', '.svg', '.tiff', '.heic',
  // 動画
  '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg',
  // 音声
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.opus',
  // アーカイブ
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.xz', '.z',
  // 実行ファイル
  '.exe', '.dll', '.so', '.dylib', '.app', '.deb', '.rpm', '.dmg', '.pkg', '.msi',
  // ドキュメント
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
  // その他バイナリ
  '.bin', '.dat', '.db', '.sqlite', '.class', '.pyc', '.pyo', '.wasm', '.o'
]);

/**
 * 高速バイナリ判定
 * 拡張子ベースで判定し、不明な場合のみファイル内容をチェック
 */
async function isBinaryFile(filePath: string, stats: Stats): Promise<boolean> {
  const ext = path.extname(filePath).toLowerCase();
  
  // 拡張子で判定
  if (BINARY_EXTENSIONS.has(ext)) {
    return true;
  }
  
  // テキストファイルの拡張子
  const textExtensions = [
    '.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.json', '.xml', '.html', '.css',
    '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php',
    '.yaml', '.yml', '.toml', '.ini', '.conf', '.sh', '.bash', '.ps1', '.bat',
    '.sql', '.r', '.m', '.lua', '.pl', '.swift', '.kt', '.scala', '.clj', '.elm'
  ];
  
  if (textExtensions.includes(ext)) {
    return false;
  }
  
  // 拡張子が不明な場合、ファイルの先頭部分をチェック
  if (stats.size === 0) {
    return false; // 空ファイルはテキスト扱い
  }
  
  try {
    // 最初の512バイトのみ読み取り
    const handle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(512, stats.size));
      await handle.read(buffer, 0, buffer.length, 0);
      
      // NULL文字や制御文字の存在でバイナリ判定
      for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i];
        // NULL文字または印刷不可能な制御文字（改行、タブ、キャリッジリターンを除く）
        if (byte !== undefined && (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13))) {
          return true;
        }
      }
      return false;
    } finally {
      await handle.close();
    }
  } catch {
    // 読み取りエラーの場合は安全側に倒してバイナリ扱い
    return true;
  }
}

/**
 * ファイル情報を取得（軽量版）
 */
export async function fileInfo(params: FileInfoParams): Promise<FileInfoUnifiedResponse> {
  const { path: targetPath } = params;
  
  // パスバリデーション
  const pathValidation = validatePath(targetPath);
  if (!pathValidation.valid) {
    return createUnifiedError(
      ErrorCodes.MISSING_PATH,
      'file_info',
      {},
      pathValidation.error?.includes('empty') ? 'ファイルパスが指定されていません' : '不正なパス形式です'
    );
  }
  
  const security = getSecurityController();
  
  // ファイルの存在確認を先に行う
  try {
    await fs.access(targetPath, fs.constants.F_OK);
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return createUnifiedError(ErrorCodes.FILE_NOT_FOUND, 'file_info', { path: targetPath });
    }
  }
  
  // セキュリティチェック
  const validation = await security.validateAccess(targetPath, 'read');
  if (!validation.allowed) {
    return createUnifiedError(
      ErrorCodes.ACCESS_DENIED,
      'file_info',
      { path: targetPath },
      `アクセスが拒否されました: ${validation.reason || 'Access denied'}`
    );
  }
  
  const resolvedPath = validation.resolved_path;
  
  try {
    // ファイル/ディレクトリの統計情報を取得
    const stats = await fs.stat(resolvedPath);
    
    // タイプ判定
    let type: 'file' | 'directory' | 'unknown';
    if (stats.isDirectory()) {
      type = 'directory';
    } else if (stats.isFile()) {
      type = 'file';
    } else {
      type = 'unknown';
    }
    
    // バイナリ判定（ファイルの場合のみ）
    let isBinary = false;
    if (type === 'file') {
      isBinary = await isBinaryFile(resolvedPath, stats);
    }
    
    // 軽量レスポンス
    return {
      success: true,
      exists: true,
      type,
      size: stats.size,
      is_binary: isBinary,
      modified: stats.mtime.toISOString()
    };
    
  } catch (error) {
    // エラーハンドリング
    return createUnifiedErrorFromException(error, 'file_info', targetPath);
  }
}
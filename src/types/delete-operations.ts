/**
 * Smart Filesystem MCP - Delete Operations Type Definitions
 * 削除操作の型定義
 */

/**
 * ファイル削除パラメータ
 */
export interface DeleteFileParams {
  /** 削除対象ファイルパス */
  path: string;
  /** 読み取り専用でも削除 (default: false) */
  force?: boolean;
}

/**
 * ファイル削除結果
 */
export interface DeleteFileResult {
  /** 操作ステータス */
  status: 'success' | 'warning' | 'error';
  /** 削除されたファイル情報 */
  deleted_file: {
    path: string;
    resolved_path: string;
    size_bytes: number;
    last_modified: string;
    was_readonly: boolean;
  };
  /** 安全性情報 */
  safety_info?: {
    file_importance: 'critical' | 'important' | 'normal';
    backup_recommended: boolean;
    warnings: string[];
  };
  /** 代替手段の提案 */
  alternatives?: {
    suggestions: string[];
  };
}

/**
 * ディレクトリ削除パラメータ
 */
export interface DeleteDirectoryParams {
  /** 削除対象ディレクトリパス */
  path: string;
  /** 中身も削除 (default: false) */
  recursive?: boolean;
  /** 強制削除 (default: false) */
  force?: boolean;
  /** プレビューのみ (default: false) */
  dry_run?: boolean;
  /** プレビュー最大ファイル数 (default: 10) */
  max_preview_files?: number;
}

/**
 * ファイルプレビュー情報
 */
export interface FilePreview {
  path: string;
  size_bytes: number;
  type: 'file';
  last_modified: string;
  importance: 'critical' | 'important' | 'normal';
}

/**
 * ディレクトリプレビュー情報
 */
export interface DirectoryPreview {
  path: string;
  file_count: number;
  subdirectory_count: number;
  type: 'directory';
  estimated_size_bytes: number;
}

/**
 * ディレクトリ削除結果
 */
export interface DeleteDirectoryResult {
  /** 操作ステータス */
  status: 'success' | 'warning' | 'error';
  /** 操作サマリー（実際の削除時） */
  operation_summary?: {
    deleted_files: number;
    deleted_directories: number;
    total_size_bytes: number;
    operation_time_ms: number;
  };
  /** プレビュー情報（dry_run時） */
  preview?: {
    total_files: number;
    total_directories: number;
    total_size_bytes: number;
    estimated_time_ms: number;
    files_to_delete: FilePreview[];
    directories_to_delete: DirectoryPreview[];
    critical_files_found: string[];
    truncated: boolean;
  };
  /** 安全性警告 */
  safety_warnings?: {
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    warnings: string[];
    recommendations: string[];
  };
  /** 代替手段の提案 */
  alternatives?: {
    safer_approaches: string[];
    suggestions: string[];
  };
}

/**
 * ファイル重要度
 */
export type FileImportance = 'critical' | 'important' | 'normal';

/**
 * 削除リスクレベル
 */
export type DeletionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * ディレクトリ情報
 */
export interface DirectoryInfo {
  fileCount: number;
  subdirCount: number;
  totalSize: number;
}
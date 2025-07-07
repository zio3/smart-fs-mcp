/**
 * Smart Filesystem MCP - Exclude Directories Configuration
 * デフォルト除外ディレクトリの定義と管理
 */

/**
 * ユーザーフレンドリーなデフォルト除外ディレクトリ
 * 開発者向けに最適化された除外設定
 */
export const USER_DEFAULT_EXCLUDE_DIRS = [
  "node_modules",
  ".git", 
  "dist",
  "build",
  "out",
  ".next", 
  "coverage",
  "__tests__",
  "test",
  ".nyc_output",
  "tmp",
  "temp"
] as const;

/**
 * 最小限の除外ディレクトリ
 * セキュリティ上必要な最小限の除外設定
 */
export const MINIMAL_EXCLUDE_DIRS = [
  "node_modules",
  ".git"
] as const;

/**
 * デフォルト除外ディレクトリを取得するユーティリティ関数
 */
export function getDefaultExcludeDirs(userDefault: boolean = true): {
  dirs: readonly string[];
  type: 'user_default' | 'minimal';
} {
  if (userDefault) {
    return {
      dirs: USER_DEFAULT_EXCLUDE_DIRS,
      type: 'user_default'
    };
  } else {
    return {
      dirs: MINIMAL_EXCLUDE_DIRS, 
      type: 'minimal'
    };
  }
}
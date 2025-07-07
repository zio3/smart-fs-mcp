/**
 * Smart Filesystem MCP - Get Default Exclude Directories Tool
 * デフォルト除外ディレクトリ一覧を取得するツール
 */

import { getDefaultExcludeDirs as getExcludeDirs } from '../core/exclude-dirs.js';

/**
 * Tool parameters for get_default_exclude_dirs
 */
export interface GetDefaultExcludeDirsParams {
  /** Use user-friendly default exclude directories (default: true) */
  userDefaultExcludeDirs?: boolean;
}

/**
 * Get default exclude directories result
 */
export interface GetDefaultExcludeDirsResult {
  success: true;
  excludeDirs: readonly string[];
  type: 'user_default' | 'minimal';
  description: string;
}

/**
 * Get default exclude directories tool
 */
export async function getDefaultExcludeDirs(
  params: GetDefaultExcludeDirsParams = {}
): Promise<GetDefaultExcludeDirsResult> {
  const userDefault = params.userDefaultExcludeDirs ?? true;
  const result = getExcludeDirs(userDefault);
  
  return {
    success: true,
    excludeDirs: result.dirs,
    type: result.type,
    description: result.type === 'user_default' 
      ? '開発者向けに最適化された除外ディレクトリ一覧' 
      : 'セキュリティ上必要な最小限の除外ディレクトリ'
  };
}
/**
 * Smart Filesystem MCP - Delete Directory Tool
 * ディレクトリ削除ツール（dry_runプレビュー機能付き）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getSecurityController } from '../core/security-controller-v2.js';
import { CRITICAL_FILE_PATTERNS, SAFETY_LIMITS } from '../utils/constants.js';
import type { 
  DeleteDirectoryParams, 
  DeleteDirectoryResult, 
  FilePreview, 
  DirectoryPreview,
  FileImportance,
  DeletionRiskLevel,
  DirectoryInfo
} from '../types/delete-operations.js';

/**
 * ファイルの重要度を評価する
 */
function assessFileImportance(filePath: string): FileImportance {
  const fileName = path.basename(filePath).toLowerCase();
  
  // Critical files check (exact match)
  if (CRITICAL_FILE_PATTERNS.CRITICAL_FILES.some(critical => 
    critical.toLowerCase() === fileName
  )) {
    return 'critical';
  }
  
  // Important patterns check (regex match)
  if (CRITICAL_FILE_PATTERNS.IMPORTANT_PATTERNS.some(pattern => 
    pattern.test(fileName)
  )) {
    return 'important';
  }
  
  return 'normal';
}

/**
 * 削除リスクレベルを評価する
 */
function assessDeletionRisk(fileCount: number, totalSize: number, criticalCount: number): DeletionRiskLevel {
  if (criticalCount > 0) return 'critical';
  if (fileCount > 1000 || totalSize > 100 * 1024 * 1024) return 'high';  // 1000ファイル or 100MB
  if (fileCount > 100 || totalSize > 10 * 1024 * 1024) return 'medium';   // 100ファイル or 10MB
  return 'low';
}

/**
 * 削除時間を推定する
 */
function estimateDeletionTime(fileCount: number): number {
  return fileCount * SAFETY_LIMITS.DELETE_TIME_PER_FILE;
}

/**
 * ディレクトリ情報を取得する
 */
async function getDirectoryInfo(dirPath: string): Promise<DirectoryInfo> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let fileCount = 0;
    let subdirCount = 0;
    let totalSize = 0;
    
    for (const entry of entries) {
      if (entry.isFile()) {
        fileCount++;
        try {
          const stats = await fs.stat(path.join(dirPath, entry.name));
          totalSize += stats.size;
        } catch {
          // Ignore stat errors for individual files
        }
      } else if (entry.isDirectory()) {
        subdirCount++;
      }
    }
    
    return { fileCount, subdirCount, totalSize };
  } catch (error) {
    return { fileCount: 0, subdirCount: 0, totalSize: 0 };
  }
}

/**
 * 安全性警告を生成する
 */
function generateSafetyWarnings(
  riskLevel: DeletionRiskLevel, 
  totalFiles: number, 
  totalSize: number, 
  criticalFiles: string[]
) {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  if (riskLevel === 'critical') {
    warnings.push(`Critical files found: ${criticalFiles.length} files`);
    criticalFiles.slice(0, 3).forEach(file => {
      warnings.push(`  - ${path.basename(file)}`);
    });
    if (criticalFiles.length > 3) {
      warnings.push(`  - ... and ${criticalFiles.length - 3} more critical files`);
    }
    
    recommendations.push('Review each critical file before deletion');
    recommendations.push('Consider backing up critical files first');
    recommendations.push('Use selective deletion instead of bulk deletion');
  }
  
  if (riskLevel === 'high' || totalFiles > 500) {
    warnings.push(`Large deletion: ${totalFiles} files (${Math.round(totalSize / 1024 / 1024)}MB total)`);
    warnings.push(`Deletion will take approximately ${Math.round(estimateDeletionTime(totalFiles) / 1000)} seconds`);
    
    // Check for node_modules pattern
    if (totalFiles > 1000) {
      warnings.push('This appears to be a large dependency directory (like node_modules)');
      recommendations.push('Use package manager commands (npm clean, yarn clean) if applicable');
      recommendations.push('Ensure you have package-lock.json for reproducible builds');
    }
  }
  
  if (riskLevel === 'medium') {
    warnings.push(`Moderate deletion: ${totalFiles} files`);
    recommendations.push('Review the file list before proceeding');
  }
  
  // Common recommendations
  recommendations.push('Use dry_run=false only after reviewing the preview');
  recommendations.push('Ensure no important files are mixed in the directory');
  recommendations.push('Check git status to verify no tracked files are included');
  
  return {
    risk_level: riskLevel,
    warnings,
    recommendations
  };
}

/**
 * 代替手段を生成する
 */
function generateAlternatives(riskLevel: DeletionRiskLevel) {
  const saferApproaches: string[] = [];
  const suggestions: string[] = [];
  
  if (riskLevel === 'critical' || riskLevel === 'high') {
    saferApproaches.push('Move directory to trash/backup location first');
    saferApproaches.push('Delete in smaller batches for better control');
    saferApproaches.push('Use selective file deletion instead of bulk deletion');
    
    suggestions.push('Create full backup before deletion');
    suggestions.push('Use git status to check for tracked files');
    suggestions.push('Consider archiving instead of deleting');
  } else {
    saferApproaches.push('Use package manager commands if this is a dependency directory');
    saferApproaches.push('Move to a backup location first');
    
    suggestions.push('Review the dry run output carefully');
    suggestions.push('Ensure directory can be recreated if needed');
  }
  
  return {
    safer_approaches: saferApproaches,
    suggestions
  };
}

/**
 * プレビュー機能を実行する
 */
async function previewDeletion(
  dirPath: string, 
  recursive: boolean, 
  maxFiles: number
): Promise<DeleteDirectoryResult> {
  const filesToDelete: FilePreview[] = [];
  const dirsToDelete: DirectoryPreview[] = [];
  const criticalFiles: string[] = [];
  let totalFiles = 0;
  let totalDirs = 0;
  let totalSize = 0;
  
  const scanDirectory = async (currentPath: string, depth: number = 0): Promise<void> => {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);
        
        if (entry.isFile()) {
          totalFiles++;
          try {
            const stats = await fs.stat(entryPath);
            totalSize += stats.size;
            
            const importance = assessFileImportance(entryPath);
            if (importance === 'critical') {
              criticalFiles.push(entryPath);
            }
            
            // プレビュー表示上限まで収集
            if (filesToDelete.length < maxFiles) {
              filesToDelete.push({
                path: entryPath,
                size_bytes: stats.size,
                type: 'file',
                last_modified: stats.mtime.toISOString(),
                importance
              });
            }
          } catch (error) {
            // ファイル情報取得エラーは無視して続行
          }
          
        } else if (entry.isDirectory() && recursive) {
          totalDirs++;
          
          // サブディレクトリ情報収集
          const subDirInfo = await getDirectoryInfo(entryPath);
          
          if (dirsToDelete.length < 5) { // 最大5ディレクトリ表示
            dirsToDelete.push({
              path: entryPath,
              file_count: subDirInfo.fileCount,
              subdirectory_count: subDirInfo.subdirCount,
              type: 'directory',
              estimated_size_bytes: subDirInfo.totalSize
            });
          }
          
          // 再帰的にスキャン
          await scanDirectory(entryPath, depth + 1);
        }
      }
    } catch (error) {
      // ディレクトリアクセスエラーは無視して続行
    }
  };
  
  await scanDirectory(dirPath);
  
  // リスク評価
  const riskLevel = assessDeletionRisk(totalFiles, totalSize, criticalFiles.length);
  
  return {
    status: riskLevel === 'critical' ? 'warning' : 'success',
    preview: {
      total_files: totalFiles,
      total_directories: totalDirs,
      total_size_bytes: totalSize,
      estimated_time_ms: estimateDeletionTime(totalFiles),
      files_to_delete: filesToDelete,
      directories_to_delete: dirsToDelete,
      critical_files_found: criticalFiles,
      truncated: filesToDelete.length >= maxFiles
    },
    safety_warnings: generateSafetyWarnings(riskLevel, totalFiles, totalSize, criticalFiles),
    alternatives: generateAlternatives(riskLevel)
  };
}

/**
 * 実際の削除を実行する
 */
async function executeDeletion(
  dirPath: string, 
  recursive: boolean, 
  force: boolean
): Promise<DeleteDirectoryResult> {
  const startTime = Date.now();
  let deletedFiles = 0;
  let deletedDirs = 0;
  let totalSize = 0;
  
  const deleteRecursive = async (currentPath: string): Promise<void> => {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      
      if (entry.isFile()) {
        try {
          const stats = await fs.stat(entryPath);
          totalSize += stats.size;
          
          // 読み取り専用ファイルの処理
          if (force) {
            try {
              await fs.chmod(entryPath, 0o666);
            } catch {
              // Ignore chmod errors
            }
          }
          
          await fs.unlink(entryPath);
          deletedFiles++;
        } catch (error) {
          // ファイル削除エラーは記録して続行
          console.warn(`Failed to delete file: ${entryPath}`, error);
        }
        
      } else if (entry.isDirectory() && recursive) {
        await deleteRecursive(entryPath);
        try {
          await fs.rmdir(entryPath);
          deletedDirs++;
        } catch (error) {
          console.warn(`Failed to delete directory: ${entryPath}`, error);
        }
      }
    }
  };
  
  try {
    if (recursive) {
      await deleteRecursive(dirPath);
    }
    
    // 最後にメインディレクトリを削除
    await fs.rmdir(dirPath);
    deletedDirs++;
    
    const endTime = Date.now();
    
    return {
      status: 'success',
      operation_summary: {
        deleted_files: deletedFiles,
        deleted_directories: deletedDirs,
        total_size_bytes: totalSize,
        operation_time_ms: endTime - startTime
      }
    };
    
  } catch (error) {
    const endTime = Date.now();
    
    return {
      status: 'error',
      operation_summary: {
        deleted_files: deletedFiles,
        deleted_directories: deletedDirs,
        total_size_bytes: totalSize,
        operation_time_ms: endTime - startTime
      },
      alternatives: {
        safer_approaches: [
          'Directory may not be empty - use recursive=true',
          'Some files may be in use - close applications and retry',
          'Check permissions and try with force=true'
        ],
        suggestions: [
          `Deletion error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'Partial deletion may have occurred',
          'Check remaining files manually'
        ]
      }
    };
  }
}

/**
 * ディレクトリを削除する
 */
export async function deleteDirectory(params: DeleteDirectoryParams): Promise<DeleteDirectoryResult> {
  const { 
    path: targetPath, 
    recursive = false, 
    force = false, 
    dry_run = false, 
    max_preview_files = SAFETY_LIMITS.DELETE_MAX_PREVIEW_FILES 
  } = params;
  
  const security = getSecurityController();
  
  try {
    // セキュリティチェック
    const validation = security.validateSecurePath(targetPath);
    if (!validation.allowed) {
      throw new Error(validation.reason || 'Access denied');
    }
    
    const resolvedPath = validation.resolved_path;
    
    // ディレクトリ存在チェック
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        throw new Error('Path is not a directory');
      }
    } catch (error) {
      return {
        status: 'error',
        alternatives: {
          safer_approaches: [],
          suggestions: [
            'Directory does not exist or is not accessible',
            'Verify the path is correct',
            'Check directory permissions'
          ]
        }
      };
    }
    
    if (dry_run) {
      return await previewDeletion(resolvedPath, recursive, max_preview_files);
    } else {
      return await executeDeletion(resolvedPath, recursive, force);
    }
    
  } catch (error) {
    return {
      status: 'error',
      alternatives: {
        safer_approaches: [],
        suggestions: [
          `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'Check directory permissions and try again',
          'Use dry_run=true to preview the operation first'
        ]
      }
    };
  }
}

/**
 * ディレクトリ削除のヘルパー関数（エラーをthrow）
 */
export async function deleteDirectoryOrThrow(params: DeleteDirectoryParams): Promise<DeleteDirectoryResult> {
  const result = await deleteDirectory(params);
  
  if (result.status === 'error') {
    const errorMessage = result.alternatives?.suggestions?.join('; ') || 'Failed to delete directory';
    throw new Error(errorMessage);
  }
  
  return result;
}
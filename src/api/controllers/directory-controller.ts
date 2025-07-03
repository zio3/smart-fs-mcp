/**
 * Smart Filesystem MCP API - Directory Controller
 * HTTP controllers for directory operations
 */

import { Request, Response } from 'express';
import * as path from 'path';
import { SafetyController } from '../../core/safety-controller.js';
import { listDirectory } from '../../tools/list-directory.js';
import { mkdir } from '../../tools/mkdir.js';
import { deleteDirectory } from '../../tools/delete-directory.js';
import { moveDirectory } from '../../tools/move-directory.js';
import { asyncHandler } from '../middleware/error-handler.js';
// import { sanitizePath } from '../middleware/validator.js'; // No longer needed - using path validator
import { validateAbsolutePath } from '../../utils/path-validator.js';
import type { EnhancedListDirectoryParams } from '../../core/types.js';
import type { MkdirParams } from '../../tools/mkdir.js';
import type { DeleteDirectoryParams } from '../../types/delete-operations.js';
import type { MoveDirectoryParams } from '../../tools/move-directory.js';

// Initialize services
const safety = new SafetyController();

/**
 * GET /api/directories/list
 * List directory contents (LLM-optimized with breaking changes)
 */
export const listDirectoryContents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const inputPath = req.query.path as string;
  
  // Absolute path validation (BREAKING CHANGE)
  const pathValidation = validateAbsolutePath(inputPath, 'list_directory');
  if (!pathValidation.isValid && pathValidation.error) {
    res.status(400).json(pathValidation.error);
    return;
  }
  
  // Parse extensions (can be comma-separated string or array)
  let extensions: string[] | undefined;
  if (req.query.extensions) {
    if (typeof req.query.extensions === 'string') {
      extensions = req.query.extensions.split(',').map(ext => ext.trim());
    } else if (Array.isArray(req.query.extensions)) {
      extensions = req.query.extensions as string[];
    }
  }
  
  // Parse exclude_dirs (can be comma-separated string or array)
  let exclude_dirs: string[] | undefined;
  if (req.query.exclude_dirs) {
    if (typeof req.query.exclude_dirs === 'string') {
      exclude_dirs = req.query.exclude_dirs.split(',').map(dir => dir.trim());
    } else if (Array.isArray(req.query.exclude_dirs)) {
      exclude_dirs = req.query.exclude_dirs as string[];
    }
  }
  
  // Parse include_hidden (boolean)
  let include_hidden: boolean | undefined;
  if (req.query.include_hidden !== undefined) {
    include_hidden = req.query.include_hidden === 'true';
  }
  
  // Parse max_files (number)
  let max_files: number | undefined;
  if (req.query.max_files) {
    max_files = parseInt(req.query.max_files as string, 10);
    if (isNaN(max_files)) max_files = undefined;
  }
  
  // Parse max_directories (number)
  let max_directories: number | undefined;
  if (req.query.max_directories) {
    max_directories = parseInt(req.query.max_directories as string, 10);
    if (isNaN(max_directories)) max_directories = undefined;
  }

  const params: EnhancedListDirectoryParams = {
    path: pathValidation.absolutePath,
    ...(extensions && { extensions }),
    ...(exclude_dirs && { exclude_dirs }),
    ...(include_hidden !== undefined && { include_hidden }),
    ...(max_files && { max_files }),
    ...(max_directories && { max_directories })
  };

  const result = await listDirectory(params, safety);

  // Always return simple format (no backward compatibility)
  res.json(result);
});

/**
 * POST /api/directories
 * Create a new directory (LLM-optimized: auto-creates parent directories)
 */
export const createDirectory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { path: rawPath, mode } = req.body;
  
  // Absolute path validation (BREAKING CHANGE)
  const pathValidation = validateAbsolutePath(rawPath, 'mkdir');
  if (!pathValidation.isValid && pathValidation.error) {
    res.status(400).json(pathValidation.error);
    return;
  }

  const params: MkdirParams = {
    path: pathValidation.absolutePath,
    recursive: true, // Always true for LLM optimization
    ...(mode && { mode })
  };

  const result = await mkdir(params);

  // LLM-optimized response: simple success
  if (result.status === 'success' || result.status === 'warning') {
    res.json({ success: true });
  } else {
    // Error case - return detailed failure info
    res.status(400).json({
      success: false,
      failedInfo: {
        reason: 'directory_creation_failed',
        message: result.warnings?.join('; ') || 'Failed to create directory',
        solutions: [
          {
            method: 'mkdir',
            params: { path: params.path, mode: '0755' },
            description: 'Retry with default permissions',
            priority: 'high' as 'high'
          },
          {
            method: 'list_directory',
            params: { path: path.dirname(params.path) },
            description: 'Check parent directory status',
            priority: 'medium' as 'medium'
          }
        ]
      }
    });
  }
});

/**
 * DELETE /api/directories
 * Delete a directory with unified LLM-optimized response
 */
export const deleteDirectorySafely = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const inputPath = req.query.path as string || req.body.path;
  
  // Absolute path validation (BREAKING CHANGE)
  const pathValidation = validateAbsolutePath(inputPath, 'delete_directory');
  if (!pathValidation.isValid && pathValidation.error) {
    res.status(400).json(pathValidation.error);
    return;
  }
  const recursive = req.query.recursive === 'true' || req.body.recursive === true;
  const force = req.query.force === 'true' || req.body.force === true;
  const dryRun = req.query.dry_run === 'true' || req.body.dry_run === true;
  const maxPreviewFiles = req.query.max_preview_files 
    ? parseInt(req.query.max_preview_files as string, 10) 
    : req.body.max_preview_files;

  const params: DeleteDirectoryParams = {
    path: pathValidation.absolutePath,
    ...(recursive !== undefined && { recursive }),
    ...(force !== undefined && { force }),
    ...(dryRun !== undefined && { dry_run: dryRun }),
    ...(maxPreviewFiles && { max_preview_files: maxPreviewFiles })
  };

  const result = await deleteDirectory(params);

  // Handle LLM-optimized response format
  if (result.success) {
    // Simplified success response
    res.json({ success: true });
  } else {
    // Return failure response directly (LLM-optimized format)
    res.status(400).json(result);
  }
});

/**
 * POST /api/directories/move
 * Move or rename a directory (LLM-optimized)
 */
export const moveDirectoryLocation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { source: rawSource, destination: rawDestination, overwrite_existing, dry_run } = req.body;
  
  // Absolute path validation for source (BREAKING CHANGE)
  const sourceValidation = validateAbsolutePath(rawSource, 'move_directory');
  if (!sourceValidation.isValid && sourceValidation.error) {
    res.status(400).json(sourceValidation.error);
    return;
  }
  
  // Absolute path validation for destination (BREAKING CHANGE)
  const destValidation = validateAbsolutePath(rawDestination, 'move_directory');
  if (!destValidation.isValid && destValidation.error) {
    res.status(400).json(destValidation.error);
    return;
  }

  const params: MoveDirectoryParams = {
    source: sourceValidation.absolutePath,
    destination: destValidation.absolutePath,
    ...(overwrite_existing !== undefined && { overwrite_existing }),
    ...(dry_run !== undefined && { dry_run })
  };

  const result = await moveDirectory(params);

  // LLM最適化: 通常移動は成功のみ、Dry Runは詳細情報提供
  if (result.status === 'success' || result.status === 'warning') {
    if (dry_run) {
      // Dry Run: LLMが移動内容を把握するため詳細情報を提供
      res.json({
        success: true,
        dry_run: true,
        source: params.source,
        destination: params.destination,
        ...(result.preview && {
          operation_type: result.preview.operation_type,
          destination_exists: result.preview.destination_exists,
          will_overwrite: result.preview.will_overwrite,
          total_files: result.preview.source_info.total_files,
          total_directories: result.preview.source_info.total_directories
        })
      });
    } else {
      // 実際の移動: シンプル成功
      res.json({ success: true });
    }
  } else {
    // Error case - return detailed failure info
    res.status(400).json({
      success: false,
      failedInfo: {
        reason: 'directory_move_failed',
        message: result.issue_details?.reason || 'Failed to move directory',
        source: params.source,
        destination: params.destination,
        solutions: [
          {
            method: 'move_directory',
            params: { source: params.source, destination: params.destination, overwrite_existing: true },
            description: 'Retry with overwrite enabled',
            priority: 'high' as 'high'
          },
          {
            method: 'list_directory',
            params: { path: params.source },
            description: 'Check source directory exists',
            priority: 'medium' as 'medium'
          },
          {
            method: 'list_directory',
            params: { path: path.dirname(params.destination) },
            description: 'Check destination parent directory',
            priority: 'medium' as 'medium'
          }
        ]
      }
    });
  }
});
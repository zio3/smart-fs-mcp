/**
 * Smart Filesystem MCP API - Directory Controller
 * HTTP controllers for directory operations
 */

import { Request, Response } from 'express';
import { SafetyController } from '../../core/safety-controller.js';
import { listDirectory } from '../../tools/list-directory.js';
import { mkdir } from '../../tools/mkdir.js';
import { deleteDirectory } from '../../tools/delete-directory.js';
import { moveDirectory } from '../../tools/move-directory.js';
import { createSuccessResponse, asyncHandler } from '../middleware/error-handler.js';
import { sanitizePath } from '../middleware/validator.js';
import type { ListDirectoryParams } from '../../core/types.js';
import type { MkdirParams } from '../../tools/mkdir.js';
import type { DeleteDirectoryParams } from '../../types/delete-operations.js';
import type { MoveDirectoryParams } from '../../tools/move-directory.js';

// Initialize services
const safety = new SafetyController();

/**
 * GET /api/directories/list
 * List directory contents with details
 */
export const listDirectoryContents = asyncHandler(async (req: Request, res: Response) => {
  const path = sanitizePath(req.query.path as string);
  const includeHidden = req.query.include_hidden === 'true';
  const sortBy = req.query.sort_by as string;
  const sortOrder = req.query.sort_order as string;

  const params: ListDirectoryParams = {
    path,
    ...(includeHidden !== undefined && { include_hidden: includeHidden }),
    ...(sortBy && { sort_by: sortBy as any }),
    ...(sortOrder && { sort_order: sortOrder as any })
  };

  const result = await listDirectory(params, safety);

  res.json(createSuccessResponse(result, 'Directory contents retrieved successfully', {
    operation: 'list_directory',
    path: params.path,
    total_files: result.summary.total_files,
    total_subdirectories: result.summary.total_subdirectories
  }));
});

/**
 * POST /api/directories
 * Create a new directory
 */
export const createDirectory = asyncHandler(async (req: Request, res: Response) => {
  const { path: rawPath, recursive, mode } = req.body;
  const path = sanitizePath(rawPath);

  const params: MkdirParams = {
    path,
    ...(recursive !== undefined && { recursive }),
    ...(mode && { mode })
  };

  const result = await mkdir(params);

  res.json(createSuccessResponse(result, 'Directory created successfully', {
    operation: 'mkdir',
    path: params.path,
    created_new: result.directory_info.created_new,
    parents_created: result.directory_info.parent_directories_created.length
  }));
});

/**
 * DELETE /api/directories
 * Delete a directory with optional preview
 */
export const deleteDirectorySafely = asyncHandler(async (req: Request, res: Response) => {
  const path = sanitizePath(req.query.path as string || req.body.path);
  const recursive = req.query.recursive === 'true' || req.body.recursive === true;
  const force = req.query.force === 'true' || req.body.force === true;
  const dryRun = req.query.dry_run === 'true' || req.body.dry_run === true;
  const maxPreviewFiles = req.query.max_preview_files 
    ? parseInt(req.query.max_preview_files as string, 10) 
    : req.body.max_preview_files;

  const params: DeleteDirectoryParams = {
    path,
    ...(recursive !== undefined && { recursive }),
    ...(force !== undefined && { force }),
    ...(dryRun !== undefined && { dry_run: dryRun }),
    ...(maxPreviewFiles && { max_preview_files: maxPreviewFiles })
  };

  const result = await deleteDirectory(params);

  const message = dryRun 
    ? 'Directory deletion preview generated' 
    : 'Directory deleted successfully';

  res.json(createSuccessResponse(result, message, {
    operation: 'delete_directory',
    path: params.path,
    dry_run: !!dryRun,
    recursive: !!recursive,
    ...(result.preview && {
      total_files: result.preview.total_files,
      total_size_bytes: result.preview.total_size_bytes,
      risk_level: result.safety_warnings?.risk_level
    }),
    ...(result.operation_summary && {
      deleted_files: result.operation_summary.deleted_files,
      deleted_directories: result.operation_summary.deleted_directories,
      operation_time_ms: result.operation_summary.operation_time_ms
    })
  }));
});

/**
 * POST /api/directories/move
 * Move or rename a directory
 */
export const moveDirectoryLocation = asyncHandler(async (req: Request, res: Response) => {
  const { source: rawSource, destination: rawDestination, overwrite_existing, dry_run } = req.body;
  const source = sanitizePath(rawSource);
  const destination = sanitizePath(rawDestination);

  const params: MoveDirectoryParams = {
    source,
    destination,
    ...(overwrite_existing !== undefined && { overwrite_existing }),
    ...(dry_run !== undefined && { dry_run })
  };

  const result = await moveDirectory(params);

  const message = dry_run 
    ? 'Directory move preview generated' 
    : 'Directory moved successfully';

  res.json(createSuccessResponse(result, message, {
    operation: 'move_directory',
    source: params.source,
    destination: params.destination,
    dry_run: !!dry_run,
    ...(result.preview && {
      operation_type: result.preview.operation_type,
      destination_exists: result.preview.destination_exists,
      will_overwrite: result.preview.will_overwrite
    }),
    ...(result.operation_info && {
      operation_type: result.operation_info.operation_type,
      total_files: result.operation_info.total_files,
      total_directories: result.operation_info.total_directories,
      operation_time_ms: result.operation_info.operation_time_ms
    })
  }));
});
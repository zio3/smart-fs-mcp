/**
 * Smart Filesystem MCP API - File Controller
 * HTTP controllers for file operations
 */

import { Request, Response } from 'express';
import { SafetyController } from '../../core/safety-controller.js';
import { FileAnalyzer } from '../../core/file-analyzer.js';
import { readFile } from '../../tools/read-file.js';
import { readFileForce } from '../../tools/read-file-force.js';
import { writeFile } from '../../tools/write-file.js';
import { editFile } from '../../tools/edit-file.js';
import { moveFile } from '../../tools/move-file.js';
import { deleteFile } from '../../tools/delete-file.js';
import { fileInfo } from '../../tools/file-info.js';
import { createSuccessResponse, asyncHandler } from '../middleware/error-handler.js';
import { sanitizePath } from '../middleware/validator.js';
import type { 
  ReadFileParams, 
  ReadFileForceParams, 
  WriteFileParams, 
  EditFileParams, 
  MoveFileParams 
} from '../../core/types.js';
import type { DeleteFileParams } from '../../types/delete-operations.js';
import type { FileInfoParams } from '../../tools/file-info.js';

// Initialize services
const safety = new SafetyController();
const analyzer = new FileAnalyzer();

/**
 * GET /api/files/info
 * Get detailed file information
 */
export const getFileInfo = asyncHandler(async (req: Request, res: Response) => {
  const path = sanitizePath(req.query.path as string);
  const includeAnalysis = req.query.include_analysis !== 'false';

  const params: FileInfoParams = {
    path,
    include_analysis: includeAnalysis
  };

  const result = await fileInfo(params, analyzer);

  res.json(createSuccessResponse(result, 'File information retrieved successfully', {
    operation: 'file_info',
    path: result.path
  }));
});

/**
 * GET /api/files/content
 * Read file content with safety checks
 */
export const getFileContent = asyncHandler(async (req: Request, res: Response) => {
  const path = sanitizePath(req.query.path as string);
  const encoding = req.query.encoding as string;

  const params: ReadFileParams = {
    path,
    ...(encoding && { encoding: encoding as any })
  };

  const result = await readFile(params, safety, analyzer);

  res.json(createSuccessResponse(result, 'File content retrieved successfully', {
    operation: 'read_file',
    path: params.path,
    status: result.status
  }));
});

/**
 * GET /api/files/content/force
 * Force read file content bypassing normal limits
 */
export const getFileContentForce = asyncHandler(async (req: Request, res: Response) => {
  const path = sanitizePath(req.query.path as string);
  const encoding = req.query.encoding as string;
  const maxSizeMb = req.query.max_size_mb ? parseInt(req.query.max_size_mb as string, 10) : undefined;

  const params: ReadFileForceParams = {
    path,
    acknowledge_risk: true, // API automatically acknowledges risk
    ...(encoding && { encoding: encoding as any }),
    ...(maxSizeMb && { max_size_mb: maxSizeMb })
  };

  const result = await readFileForce(params, safety, analyzer);

  res.json(createSuccessResponse(result, 'File content retrieved with force read', {
    operation: 'read_file_force',
    path: params.path,
    max_size_mb: params.max_size_mb
  }));
});

/**
 * POST /api/files/content
 * Write content to a file
 */
export const writeFileContent = asyncHandler(async (req: Request, res: Response) => {
  const { path: rawPath, content, encoding } = req.body;
  const path = sanitizePath(rawPath);

  const params: WriteFileParams = {
    path,
    content,
    ...(encoding && { encoding })
  };

  const result = await writeFile(params, safety);

  res.json(createSuccessResponse(result, 'File written successfully', {
    operation: 'write_file',
    path: params.path,
    size_bytes: result.file_info.size_bytes
  }));
});

/**
 * PUT /api/files/edit
 * Edit file using literal or regex replacements
 */
export const editFileContent = asyncHandler(async (req: Request, res: Response) => {
  const { path: rawPath, edits, dry_run, preserve_formatting } = req.body;
  const path = sanitizePath(rawPath);

  // Convert simple edits format to full edit operations
  const processedEdits = Array.isArray(edits) ? edits.map((edit: any) => {
    if (edit.oldText && edit.newText) {
      return {
        type: 'literal',
        old_text: edit.oldText,
        new_text: edit.newText
      };
    }
    return edit;
  }) : edits;

  const params: EditFileParams = {
    path,
    edits: processedEdits,
    ...(dry_run !== undefined && { dry_run }),
    ...(preserve_formatting !== undefined && { preserve_formatting })
  };

  const result = await editFile(params, safety, analyzer);

  res.json(createSuccessResponse(result, 
    dry_run ? 'File edit preview generated' : 'File edited successfully', {
    operation: 'edit_file',
    path: params.path,
    dry_run: !!dry_run,
    edits_count: params.edits.length
  }));
});

/**
 * POST /api/files/move
 * Move or rename a file
 */
export const moveFileLocation = asyncHandler(async (req: Request, res: Response) => {
  const { source: rawSource, destination: rawDestination, overwrite_existing } = req.body;
  const source = sanitizePath(rawSource);
  const destination = sanitizePath(rawDestination);

  const params: MoveFileParams = {
    source,
    destination,
    ...(overwrite_existing !== undefined && { overwrite_existing })
  };

  const result = await moveFile(params, safety);

  res.json(createSuccessResponse(result, 'File moved successfully', {
    operation: 'move_file',
    source: params.source,
    destination: params.destination,
    operation_type: result.operation_info.operation_type
  }));
});

/**
 * DELETE /api/files
 * Delete a file with safety checks
 */
export const deleteFileSafely = asyncHandler(async (req: Request, res: Response) => {
  const path = sanitizePath(req.query.path as string || req.body.path);
  const force = req.query.force === 'true' || req.body.force === true;

  const params: DeleteFileParams = {
    path,
    ...(force && { force })
  };

  const result = await deleteFile(params);

  res.json(createSuccessResponse(result, 'File deleted successfully', {
    operation: 'delete_file',
    path: params.path,
    was_readonly: result.deleted_file.was_readonly,
    importance: result.safety_info?.file_importance || 'normal'
  }));
});
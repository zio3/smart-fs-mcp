/**
 * Smart Filesystem MCP API - File Controller
 * HTTP controllers for file operations
 */

import { Request, Response } from 'express';
import { SafetyController } from '../../core/safety-controller.js';
import { FileAnalyzer } from '../../core/file-analyzer.js';
import { readFile } from '../../tools/read-file.js';
import { writeFile } from '../../tools/write-file.js';
import { editFile } from '../../tools/edit-file.js';
import { moveFile } from '../../tools/move-file.js';
import { deleteFile } from '../../tools/delete-file.js';
import { fileInfo } from '../../tools/file-info.js';
import { asyncHandler } from '../middleware/error-handler.js';
// import { sanitizePath } from '../middleware/validator.js'; // No longer needed - using path validator
import { validateAbsolutePath } from '../../utils/path-validator.js';
import type { 
  ReadFileParams, 
  WriteFileParams, 
  EditFileParams, 
  MoveFileParams,
  DeleteFileParams
} from '../../core/types.js';
import type { FileInfoParams } from '../../tools/file-info.js';

// Initialize services
const safety = new SafetyController();
const analyzer = new FileAnalyzer();

/**
 * GET /api/files/info
 * Get detailed file information
 */
export const getFileInfo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const inputPath = req.query.path as string;
  
  // Absolute path validation (BREAKING CHANGE)
  const pathValidation = validateAbsolutePath(inputPath, 'file_info');
  if (!pathValidation.isValid && pathValidation.error) {
    res.status(400).json(pathValidation.error);
    return;
  }

  const params: FileInfoParams = {
    path: pathValidation.absolutePath
  };

  const result = await fileInfo(params);

  // Handle unified response format - fileInfo already returns the correct format
  res.json(result);
});

/**
 * GET /api/files/content
 * Read file content with unified force parameter (LLM cognitive load reduction)
 */
export const getFileContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const inputPath = req.query.path as string;
  // force parameter removed - no longer supported
  const encoding = req.query.encoding as string;
  const startLine = req.query.start_line ? parseInt(req.query.start_line as string, 10) : undefined;
  const endLine = req.query.end_line ? parseInt(req.query.end_line as string, 10) : undefined;
  
  // Absolute path validation (BREAKING CHANGE)
  const pathValidation = validateAbsolutePath(inputPath, 'read_file');
  if (!pathValidation.isValid && pathValidation.error) {
    res.status(400).json(pathValidation.error);
    return;
  }

  try {
    // Try normal read first (20KB limit)
    const normalParams: ReadFileParams = {
      path: pathValidation.absolutePath,
      ...(encoding && { encoding: encoding as any }),
      ...(startLine !== undefined && { start_line: startLine }),
      ...(endLine !== undefined && { end_line: endLine })
    };

    const normalResult = await readFile(normalParams, safety, analyzer);
    
    // If normal read succeeds, return result
    if (normalResult.success) {
      res.json(normalResult);
      return;
    }

    // If size exceeded, always return error regardless of force flag
    // Force read functionality has been removed for security

    // If size exceeded but force=false, return the error as-is (already has suggestions)
    if (!normalResult.success && 'error' in normalResult && normalResult.error.code === 'file_too_large') {
      res.json(normalResult);
      return;
    }

    // Other errors
    res.status(400).json(normalResult);
    return;

  } catch (error) {
    res.status(500).json({
      success: false,
      failedInfo: {
        reason: 'unknown_error',
        message: 'Unexpected error occurred',
        solutions: []
      }
    });
    return;
  }
});

// getFileContentForce removed - unified into getFileContent with force parameter

/**
 * POST /api/files/content
 * Write content to a file (LLM-optimized)
 */
export const writeFileContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { path: rawPath, content, encoding } = req.body;
  
  // Absolute path validation (BREAKING CHANGE)
  const pathValidation = validateAbsolutePath(rawPath, 'write_file');
  if (!pathValidation.isValid && pathValidation.error) {
    res.status(400).json(pathValidation.error);
    return;
  }

  const params: WriteFileParams = {
    path: pathValidation.absolutePath,
    content,
    ...(encoding && { encoding })
  };

  const result = await writeFile(params, safety);

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
 * PUT /api/files/edit
 * Edit file using literal or regex replacements (LLM-optimized)
 */
export const editFileContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { path: rawPath, edits, dry_run, preserve_formatting } = req.body;
  
  // Absolute path validation (BREAKING CHANGE)
  const pathValidation = validateAbsolutePath(rawPath, 'edit_file');
  if (!pathValidation.isValid && pathValidation.error) {
    res.status(400).json(pathValidation.error);
    return;
  }

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
    path: pathValidation.absolutePath,
    edits: processedEdits,
    dry_run: dry_run,
    preserve_formatting: preserve_formatting
  };

  const result = await editFile(params, safety, analyzer);

  // Handle LLM-optimized response format
  if (result.success) {
    // Return success data directly
    res.json({
      success: true,
      file_path: params.path,
      edits_applied: result.edit_summary?.successful_edits || 0,
      dry_run: params.dry_run,
      ...(result.diff_output && { diff_output: result.diff_output }),
      ...(result.edit_summary && { 
        changes_summary: `${result.edit_summary.successful_edits} edits applied`
      })
    });
  } else {
    // Return failure response directly (LLM-optimized format)
    res.status(400).json(result);
  }
});

/**
 * POST /api/files/move
 * Move or rename a file (LLM-optimized)
 */
export const moveFileLocation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { source: rawSource, destination: rawDestination, overwrite_existing } = req.body;
  
  // Absolute path validation for source (BREAKING CHANGE)
  const sourceValidation = validateAbsolutePath(rawSource, 'move_file');
  if (!sourceValidation.isValid && sourceValidation.error) {
    res.status(400).json(sourceValidation.error);
    return;
  }
  
  // Absolute path validation for destination (BREAKING CHANGE)
  const destValidation = validateAbsolutePath(rawDestination, 'move_file');
  if (!destValidation.isValid && destValidation.error) {
    res.status(400).json(destValidation.error);
    return;
  }

  const params: MoveFileParams = {
    source: sourceValidation.absolutePath,
    destination: destValidation.absolutePath,
    ...(overwrite_existing !== undefined && { overwrite_existing })
  };

  const result = await moveFile(params, safety);

  // Handle LLM-optimized response format
  if (result.success) {
    // Return success data directly
    res.json({
      success: true,
      source_path: params.source,
      destination_path: params.destination,
      operation_type: result.operation_info?.operation_type || 'move',
      file_size: result.operation_info?.size_bytes || 0,
      overwritten_existing: result.operation_info?.operation_type === 'move' && 
                           result.operation_info?.destination?.includes('overwrite')
    });
  } else {
    // Return failure response directly (LLM-optimized format)
    res.status(400).json(result);
  }
});

/**
 * DELETE /api/files
 * Delete a file with safety checks (LLM-optimized)
 */
export const deleteFileSafely = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const inputPath = req.query.path as string || req.body.path;
  
  // Absolute path validation (BREAKING CHANGE)
  const pathValidation = validateAbsolutePath(inputPath, 'delete_file');
  if (!pathValidation.isValid && pathValidation.error) {
    res.status(400).json(pathValidation.error);
    return;
  }
  
  const force = req.query.force === 'true' || req.body.force === true;

  const params: DeleteFileParams = {
    path: pathValidation.absolutePath,
    ...(force && { force })
  };

  const result = await deleteFile(params);

  // Handle LLM-optimized response format
  if (result.success) {
    // Simplified success response
    res.json({ success: true });
  } else {
    // Return failure response directly (LLM-optimized format)
    res.status(400).json(result);
  }
});
/**
 * Smart Filesystem MCP API - Search Controller
 * HTTP controllers for search operations
 */

import { Request, Response } from 'express';
import { SafetyController } from '../../core/safety-controller.js';
import { searchContent } from '../../tools/search-content.js';
import { createSuccessResponse, asyncHandler } from '../middleware/error-handler.js';
import { sanitizePath } from '../middleware/validator.js';
import type { SearchContentParams } from '../../core/types.js';

// Initialize services
const safety = new SafetyController();

/**
 * POST /api/search/content
 * Search for files by name or content using regex patterns
 */
export const searchFileContent = asyncHandler(async (req: Request, res: Response) => {
  const {
    file_pattern,
    content_pattern,
    directory: rawDirectory,
    recursive,
    max_depth,
    extensions,
    exclude_extensions,
    exclude_dirs,
    case_sensitive,
    whole_word,
    max_files,
    max_matches_per_file
  } = req.body;

  // Sanitize directory path if provided
  const directory = rawDirectory ? sanitizePath(rawDirectory) : undefined;

  const params: SearchContentParams = {
    ...(file_pattern && { file_pattern }),
    ...(content_pattern && { content_pattern }),
    ...(directory && { directory }),
    ...(recursive !== undefined && { recursive }),
    ...(max_depth && { max_depth }),
    ...(extensions && { extensions }),
    ...(exclude_extensions && { exclude_extensions }),
    ...(exclude_dirs && { exclude_dirs }),
    ...(case_sensitive !== undefined && { case_sensitive }),
    ...(whole_word !== undefined && { whole_word }),
    ...(max_files && { max_files }),
    ...(max_matches_per_file && { max_matches_per_file })
  };

  const result = await searchContent(params, safety);

  res.json(createSuccessResponse(result, 'Search completed successfully', {
    operation: 'search_content',
    search_type: file_pattern ? (content_pattern ? 'both' : 'filename') : 'content',
    total_files_scanned: result.search_info.total_files_scanned,
    total_matches: result.summary.total_matches,
    files_with_matches: result.summary.files_with_matches,
    search_time_ms: result.search_info.search_time_ms
  }));
});

/**
 * GET /api/search/content
 * Simple search via query parameters (for quick testing)
 */
export const searchFileContentSimple = asyncHandler(async (req: Request, res: Response) => {
  const filePattern = req.query.file_pattern as string;
  const contentPattern = req.query.content_pattern as string;
  const directory = req.query.directory ? sanitizePath(req.query.directory as string) : undefined;
  const extensions = req.query.extensions 
    ? (req.query.extensions as string).split(',').map(ext => ext.trim())
    : undefined;
  const maxFiles = req.query.max_files ? parseInt(req.query.max_files as string, 10) : undefined;

  const params: SearchContentParams = {
    ...(filePattern && { file_pattern: filePattern }),
    ...(contentPattern && { content_pattern: contentPattern }),
    ...(directory && { directory }),
    ...(extensions && { extensions }),
    ...(maxFiles && { max_files: maxFiles })
  };

  const result = await searchContent(params, safety);

  res.json(createSuccessResponse(result, 'Search completed successfully', {
    operation: 'search_content_simple',
    search_type: filePattern ? (contentPattern ? 'both' : 'filename') : 'content',
    total_files_scanned: result.search_info.total_files_scanned,
    total_matches: result.summary.total_matches,
    files_with_matches: result.summary.files_with_matches,
    search_time_ms: result.search_info.search_time_ms
  }));
});
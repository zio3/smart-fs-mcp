/**
 * Smart Filesystem MCP API - Search Controller
 * HTTP controllers for search operations
 */

import { Request, Response } from 'express';
import { SafetyController } from '../../core/safety-controller.js';
import { searchContent } from '../../tools/search-content.js';
import { asyncHandler } from '../middleware/error-handler.js';
// import { sanitizePath } from '../middleware/validator.js'; // No longer needed - using path validator
import { validateAbsolutePath } from '../../utils/path-validator.js';
import type { SearchContentParams } from '../../core/types.js';

// Initialize services
const safety = new SafetyController();

/**
 * POST /api/search/content
 * Search for files by name or content using regex patterns
 */
export const searchFileContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

  // Absolute path validation for directory (BREAKING CHANGE)
  let directory: string | undefined;
  if (rawDirectory) {
    const pathValidation = validateAbsolutePath(rawDirectory, 'search_content');
    if (!pathValidation.isValid && pathValidation.error) {
      res.status(400).json(pathValidation.error);
      return;
    }
    directory = pathValidation.absolutePath;
  }

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

  // Always return simple format (no backward compatibility)
  const result = await searchContent(params, safety);
  res.json(result);
});

/**
 * GET /api/search/content
 * Simple search via query parameters (for quick testing)
 */
export const searchFileContentSimple = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const filePattern = req.query.file_pattern as string;
  const contentPattern = req.query.content_pattern as string;
  let directory: string | undefined;
  if (req.query.directory) {
    const pathValidation = validateAbsolutePath(req.query.directory as string, 'search_content');
    if (!pathValidation.isValid && pathValidation.error) {
      res.status(400).json(pathValidation.error);
      return;
    }
    directory = pathValidation.absolutePath;
  }
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

  // Always return simple format (no backward compatibility)
  const result = await searchContent(params, safety);
  res.json(result);
});
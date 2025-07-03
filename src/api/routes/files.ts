/**
 * Smart Filesystem MCP API - File Routes
 * Express routes for file operations
 */

import { Router } from 'express';
import {
  getFileInfo,
  getFileContent,
  // getFileContentForce, // Removed - unified into getFileContent with force parameter
  writeFileContent,
  editFileContent,
  moveFileLocation,
  deleteFileSafely
} from '../controllers/file-controller.js';
import { validate, commonRules } from '../middleware/validator.js';
import { parseQueryParameters } from '../middleware/query-parser.js';

const router = Router();

// Apply query parameter parsing to all routes
router.use(parseQueryParameters);

/**
 * GET /info - Get file information
 */
router.get('/info', 
  validate([
    commonRules.filePath(true),
    commonRules.boolean('include_analysis', false)
  ]),
  getFileInfo
);

/**
 * GET /content - Read file content with unified force parameter (LLM cognitive load reduction)
 */
router.get('/content',
  validate([
    commonRules.absoluteFilePath(true), // BREAKING: Absolute path required
    commonRules.encoding(),
    commonRules.boolean('force', false) // Unified force parameter for cognitive load reduction
  ]),
  getFileContent
);

/**
 * POST /content - Write file content (absolute path required)
 */
router.post('/content',
  validate([
    commonRules.absoluteFilePath(true), // BREAKING: Absolute path required
    commonRules.content(true),
    commonRules.encoding()
  ]),
  writeFileContent
);

/**
 * PUT /edit - Edit file content (LLM-optimized with breaking changes)
 */
router.put('/edit',
  validate([
    commonRules.absoluteFilePath(true), // BREAKING: Absolute path required
    {
      field: 'edits',
      required: true,
      type: 'array',
      minLength: 1,
      maxLength: 100
    },
    commonRules.boolean('dry_run', false),
    commonRules.boolean('preserve_formatting', false)
  ]),
  editFileContent
);

/**
 * POST /move - Move file (LLM-optimized with breaking changes)
 */
router.post('/move',
  validate([
    ...commonRules.absoluteSourceAndDestination(), // BREAKING: Absolute paths required
    commonRules.boolean('overwrite_existing', false)
  ]),
  moveFileLocation
);

/**
 * DELETE / - Delete file (LLM-optimized with breaking changes)
 */
router.delete('/',
  validate([
    commonRules.absoluteFilePath(true), // BREAKING: Absolute path required
    commonRules.boolean('force', false)
  ]),
  deleteFileSafely
);

export { router as fileRoutes };
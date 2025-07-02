/**
 * Smart Filesystem MCP API - File Routes
 * Express routes for file operations
 */

import { Router } from 'express';
import {
  getFileInfo,
  getFileContent,
  getFileContentForce,
  writeFileContent,
  editFileContent,
  moveFileLocation,
  deleteFileSafely
} from '../controllers/file-controller.js';
import { validate, commonRules } from '../middleware/validator.js';

const router = Router();

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
 * GET /content - Read file content
 */
router.get('/content',
  validate([
    commonRules.filePath(true),
    commonRules.encoding()
  ]),
  getFileContent
);

/**
 * GET /content/force - Force read file content
 */
router.get('/content/force',
  validate([
    commonRules.filePath(true),
    commonRules.encoding(),
    {
      field: 'max_size_mb',
      required: false,
      type: 'number',
      min: 1,
      max: 100
    }
  ]),
  getFileContentForce
);

/**
 * POST /content - Write file content
 */
router.post('/content',
  validate([
    commonRules.filePath(true),
    commonRules.content(true),
    commonRules.encoding()
  ]),
  writeFileContent
);

/**
 * PUT /edit - Edit file content
 */
router.put('/edit',
  validate([
    commonRules.filePath(true),
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
 * POST /move - Move file
 */
router.post('/move',
  validate([
    ...commonRules.sourceAndDestination(),
    commonRules.boolean('overwrite_existing', false)
  ]),
  moveFileLocation
);

/**
 * DELETE / - Delete file
 */
router.delete('/',
  validate([
    commonRules.filePath(true),
    commonRules.boolean('force', false)
  ]),
  deleteFileSafely
);

export { router as fileRoutes };
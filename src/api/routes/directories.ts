/**
 * Smart Filesystem MCP API - Directory Routes
 * Express routes for directory operations
 */

import { Router } from 'express';
import {
  listDirectoryContents,
  createDirectory,
  deleteDirectorySafely,
  moveDirectoryLocation
} from '../controllers/directory-controller.js';
import { validate, commonRules } from '../middleware/validator.js';

const router = Router();

/**
 * GET /list - List directory contents
 */
router.get('/list',
  validate([
    commonRules.filePath(true),
    commonRules.boolean('include_hidden', false),
    {
      field: 'sort_by',
      required: false,
      type: 'string',
      pattern: /^(name|size|modified)$/
    },
    {
      field: 'sort_order',
      required: false,
      type: 'string',
      pattern: /^(asc|desc)$/
    }
  ]),
  listDirectoryContents
);

/**
 * POST / - Create directory
 */
router.post('/',
  validate([
    commonRules.filePath(true),
    commonRules.boolean('recursive', false),
    {
      field: 'mode',
      required: false,
      type: 'string',
      pattern: /^[0-7]{3,4}$/,
      custom: (value: string) => {
        if (!value) return null;
        const num = parseInt(value, 8);
        if (isNaN(num) || num < 0 || num > 0o7777) {
          return 'Mode must be a valid octal number (e.g., "0755")';
        }
        return null;
      }
    }
  ]),
  createDirectory
);

/**
 * DELETE / - Delete directory
 */
router.delete('/',
  validate([
    commonRules.filePath(true),
    commonRules.boolean('recursive', false),
    commonRules.boolean('force', false),
    commonRules.boolean('dry_run', false),
    commonRules.positiveInteger('max_preview_files', false, 50)
  ]),
  deleteDirectorySafely
);

/**
 * POST /move - Move directory
 */
router.post('/move',
  validate([
    ...commonRules.sourceAndDestination(),
    commonRules.boolean('overwrite_existing', false),
    commonRules.boolean('dry_run', false)
  ]),
  moveDirectoryLocation
);

export { router as directoryRoutes };
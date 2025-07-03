/**
 * Smart Filesystem MCP API - Directory Routes
 * Express routes for directory operations
 */

import { Router } from 'express';
import * as path from 'path';
import {
  listDirectoryContents,
  createDirectory,
  deleteDirectorySafely,
  moveDirectoryLocation
} from '../controllers/directory-controller.js';
import { validate, commonRules } from '../middleware/validator.js';
import { parseQueryParameters } from '../middleware/query-parser.js';

const router = Router();

// Apply query parameter parsing to all routes
router.use(parseQueryParameters);

/**
 * GET /list - List directory contents (LLM-optimized)
 * Requires absolute path, supports extensions and exclude_dirs filters
 */
router.get('/list',
  validate([
    {
      field: 'path',
      required: true,
      type: 'string',
      custom: (value: string) => {
        if (!value) return 'Path is required';
        // Cross-platform absolute path check
        const isAbsolute = value.startsWith('/') || /^[A-Za-z]:[/\\]/.test(value);
        if (!isAbsolute) {
          return 'Path must be absolute (breaking change: relative paths no longer supported)';
        }
        return null;
      }
    },
    {
      field: 'extensions',
      required: false,
      type: 'array',
      custom: (value: string[] | string) => {
        if (!value) return null;
        const extensions = Array.isArray(value) ? value : [value];
        for (const ext of extensions) {
          if (typeof ext !== 'string' || (!ext.startsWith('.') && !ext.match(/^[a-zA-Z0-9]+$/))) {
            return 'Extensions must be strings like "js" or ".js"';
          }
        }
        return null;
      }
    },
    {
      field: 'exclude_dirs',
      required: false,
      type: 'array',
      custom: (value: string[] | string) => {
        if (!value) return null;
        const dirs = Array.isArray(value) ? value : [value];
        for (const dir of dirs) {
          if (typeof dir !== 'string' || dir.trim().length === 0) {
            return 'Exclude directories must be non-empty strings';
          }
        }
        return null;
      }
    },
    {
      field: 'include_hidden',
      required: false,
      type: 'boolean'
    },
    {
      field: 'max_files',
      required: false,
      type: 'number',
      custom: (value: string | number) => {
        if (value === undefined || value === null) return null;
        const num = typeof value === 'string' ? parseInt(value, 10) : value;
        if (isNaN(num) || num < 1 || num > 200) {
          return 'max_files must be between 1 and 200';
        }
        return null;
      }
    },
    {
      field: 'max_directories',
      required: false,
      type: 'number',
      custom: (value: string | number) => {
        if (value === undefined || value === null) return null;
        const num = typeof value === 'string' ? parseInt(value, 10) : value;
        if (isNaN(num) || num < 1 || num > 50) {
          return 'max_directories must be between 1 and 50';
        }
        return null;
      }
    }
  ]),
  listDirectoryContents
);

/**
 * POST / - Create directory (LLM-optimized: auto-creates parent directories)
 */
router.post('/',
  validate([
    commonRules.filePath(true),
    // recursive parameter removed - always true for LLM optimization
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
 * DELETE / - Delete directory (requires absolute path)
 */
router.delete('/',
  validate([
    {
      field: 'path',
      required: true,
      type: 'string',
      custom: (value: string) => {
        if (!value) return 'Path is required';
        if (!path.isAbsolute(value)) {
          return 'Path must be absolute (breaking change: relative paths no longer supported)';
        }
        return null;
      }
    },
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
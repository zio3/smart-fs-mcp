/**
 * Smart Filesystem MCP API - Search Routes
 * Express routes for search operations
 */

import { Router } from 'express';
import {
  searchFileContent,
  searchFileContentSimple
} from '../controllers/search-controller.js';
import { validate, commonRules } from '../middleware/validator.js';

const router = Router();

/**
 * POST /content - Search file content (full featured)
 */
router.post('/content',
  validate([
    {
      field: 'file_pattern',
      required: false,
      type: 'string',
      minLength: 1,
      maxLength: 1000,
      custom: (value: string) => {
        if (!value) return null;
        try {
          new RegExp(value);
          return null;
        } catch (error) {
          return 'file_pattern must be a valid regular expression';
        }
      }
    },
    {
      field: 'content_pattern',
      required: false,
      type: 'string',
      minLength: 1,
      maxLength: 1000,
      custom: (value: string) => {
        if (!value) return null;
        try {
          new RegExp(value);
          return null;
        } catch (error) {
          return 'content_pattern must be a valid regular expression';
        }
      }
    },
    {
      field: 'directory',
      required: false,
      type: 'string',
      minLength: 1,
      maxLength: 2000,
      custom: (value: string) => {
        if (!value) return null;
        if (value.includes('\0')) return 'Directory path cannot contain null bytes';
        return null;
      }
    },
    commonRules.boolean('recursive', false),
    commonRules.positiveInteger('max_depth', false, 20),
    commonRules.fileExtensions(),
    {
      field: 'exclude_extensions',
      required: false,
      type: 'array',
      maxLength: 50,
      custom: (value: string[]) => {
        if (!Array.isArray(value)) return null;
        for (const ext of value) {
          if (typeof ext !== 'string') return 'All exclude_extensions must be strings';
          if (!ext.startsWith('.')) return 'Extensions must start with a dot';
        }
        return null;
      }
    },
    {
      field: 'exclude_dirs',
      required: false,
      type: 'array',
      maxLength: 20,
      custom: (value: string[]) => {
        if (!Array.isArray(value)) return null;
        for (const dir of value) {
          if (typeof dir !== 'string') return 'All exclude_dirs must be strings';
        }
        return null;
      }
    },
    commonRules.boolean('case_sensitive', false),
    commonRules.boolean('whole_word', false),
    commonRules.positiveInteger('max_files', false, 1000),
    commonRules.positiveInteger('max_matches_per_file', false, 100)
  ]),
  searchFileContent
);

/**
 * GET /content - Simple search via query parameters
 */
router.get('/content',
  validate([
    {
      field: 'file_pattern',
      required: false,
      type: 'string',
      maxLength: 1000,
      custom: (value: string) => {
        if (!value) return null;
        try {
          new RegExp(value);
          return null;
        } catch (error) {
          return 'file_pattern must be a valid regular expression';
        }
      }
    },
    {
      field: 'content_pattern',
      required: false,
      type: 'string',
      maxLength: 1000,
      custom: (value: string) => {
        if (!value) return null;
        try {
          new RegExp(value);
          return null;
        } catch (error) {
          return 'content_pattern must be a valid regular expression';
        }
      }
    },
    {
      field: 'directory',
      required: false,
      type: 'string',
      maxLength: 2000
    },
    {
      field: 'extensions',
      required: false,
      type: 'string',
      maxLength: 200,
      custom: (value: string) => {
        if (!value) return null;
        const exts = value.split(',');
        for (const ext of exts) {
          const trimmed = ext.trim();
          if (trimmed && !trimmed.startsWith('.')) {
            return 'Extensions must start with a dot (e.g., ".js,.ts")';
          }
        }
        return null;
      }
    },
    commonRules.positiveInteger('max_files', false, 1000)
  ]),
  searchFileContentSimple
);

export { router as searchRoutes };
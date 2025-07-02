/**
 * Smart Filesystem MCP API - Routes Index
 * Main router that combines all API routes
 */

import { Router } from 'express';
import { fileRoutes } from './files.js';
import { directoryRoutes } from './directories.js';
import { searchRoutes } from './search.js';

const router = Router();

// Mount route modules
router.use('/files', fileRoutes);
router.use('/directories', directoryRoutes);
router.use('/search', searchRoutes);

// API root endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Smart Filesystem MCP API',
      version: '1.0.0',
      endpoints: {
        files: {
          info: 'GET /api/files/info?path=<path>',
          content: 'GET /api/files/content?path=<path>',
          content_force: 'GET /api/files/content/force?path=<path>',
          write: 'POST /api/files/content',
          edit: 'PUT /api/files/edit',
          move: 'POST /api/files/move',
          delete: 'DELETE /api/files?path=<path>'
        },
        directories: {
          list: 'GET /api/directories/list?path=<path>',
          create: 'POST /api/directories',
          delete: 'DELETE /api/directories?path=<path>',
          move: 'POST /api/directories/move'
        },
        search: {
          content: 'POST /api/search/content',
          content_simple: 'GET /api/search/content?content_pattern=<pattern>'
        }
      },
      documentation: '/api-docs',
      health_check: '/health'
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  });
});

export { router as apiRoutes };
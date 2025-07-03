/**
 * Smart Filesystem MCP API - Routes Index
 * Main router that combines all API routes
 */

import { Router } from 'express';
import { fileRoutes } from './files.js';
import { directoryRoutes } from './directories.js';
import { searchRoutes } from './search.js';
import { openApiSpec } from '../schemas/openapi.js';

const router = Router();

// Mount route modules
router.use('/files', fileRoutes);
router.use('/directories', directoryRoutes);
router.use('/search', searchRoutes);

// API root endpoint (LLM-optimized)
router.get('/', (_req, res) => {
  res.json({
    name: 'Smart Filesystem MCP API',
    version: '1.0.0',
    description: 'LLM-optimized filesystem operations with comprehensive safety controls',
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
    health_check: '/health',
    openapi_spec: '/api/openapi.json'
  });
});

// OpenAPI specification endpoints
router.get('/openapi.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(openApiSpec);
});

// Swagger compatibility endpoint
router.get('/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(openApiSpec);
});

export { router as apiRoutes };
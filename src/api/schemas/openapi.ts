/**
 * Smart Filesystem MCP API - OpenAPI Schema
 * Complete OpenAPI 3.0 specification for the REST API
 */

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Smart Filesystem MCP API',
    version: '1.0.0',
    description: `
LLM-optimized filesystem operations with comprehensive safety controls.

This API provides HTTP access to all Smart Filesystem MCP tools, allowing
browser testing via SwaggerUI and CURL-based testing for development.

## Features

- **Complete CRUD Operations**: Create, Read, Update, Delete files and directories
- **Safety Controls**: File size limits, binary detection, path traversal prevention
- **Dry-run Preview**: Preview dangerous operations before execution
- **Smart Error Handling**: Constructive error messages with suggestions
- **Security**: Localhost-only access with directory restrictions

## Usage Examples

### File Operations
- Read file: \`GET /api/files/content?path=./package.json\`
- Write file: \`POST /api/files/content\` with JSON body
- Edit file: \`PUT /api/files/edit\` with edit operations

### Directory Operations  
- List directory: \`GET /api/directories/list?path=./src\`
- Create directory: \`POST /api/directories\` with path
- Delete with preview: \`DELETE /api/directories?path=./temp&dry_run=true\`

### Search Operations
- Search content: \`POST /api/search/content\` with patterns
- Quick search: \`GET /api/search/content?content_pattern=TODO\`
    `,
    contact: {
      name: 'Smart Filesystem MCP',
      url: 'https://github.com/anthropics/smart-fs-mcp'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server (localhost only)'
    }
  ],
  tags: [
    {
      name: 'Files',
      description: 'File operations (read, write, edit, move, delete)'
    },
    {
      name: 'Directories', 
      description: 'Directory operations (list, create, delete, move)'
    },
    {
      name: 'Search',
      description: 'Content and filename search operations'
    },
    {
      name: 'System',
      description: 'Health checks and system information'
    }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Check if the API server is running properly',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' }
              }
            }
          }
        }
      }
    },
    '/api': {
      get: {
        tags: ['System'],
        summary: 'API information',
        description: 'Get API endpoints and documentation links',
        responses: {
          '200': {
            description: 'API information',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' }
              }
            }
          }
        }
      }
    },
    '/api/files/info': {
      get: {
        tags: ['Files'],
        summary: 'Get file information',
        description: 'Retrieve detailed metadata about a file or directory',
        parameters: [
          {
            name: 'path',
            in: 'query',
            required: true,
            description: 'File or directory path',
            schema: { type: 'string', example: './package.json' }
          },
          {
            name: 'include_analysis',
            in: 'query',
            required: false,
            description: 'Include detailed file analysis',
            schema: { type: 'boolean', default: true }
          }
        ],
        responses: {
          '200': {
            description: 'File information retrieved',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '400': { $ref: '#/components/responses/BadRequest' }
        }
      }
    },
    '/api/files/content': {
      get: {
        tags: ['Files'],
        summary: 'Read file content',
        description: 'Read file content with automatic safety checks and limits',
        parameters: [
          {
            name: 'path',
            in: 'query',
            required: true,
            description: 'File path to read',
            schema: { type: 'string', example: './README.md' }
          },
          {
            name: 'encoding',
            in: 'query',
            required: false,
            description: 'Text encoding',
            schema: { 
              type: 'string', 
              enum: ['utf8', 'utf16le', 'utf16be', 'latin1', 'ascii'],
              default: 'utf8'
            }
          }
        ],
        responses: {
          '200': {
            description: 'File content or safety information',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' },
          '413': { $ref: '#/components/responses/PayloadTooLarge' },
          '415': { $ref: '#/components/responses/UnsupportedMediaType' }
        }
      },
      post: {
        tags: ['Files'],
        summary: 'Write file content',
        description: 'Write content to a file (creates new or overwrites existing)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['path', 'content'],
                properties: {
                  path: {
                    type: 'string',
                    description: 'File path to write',
                    example: './test.txt'
                  },
                  content: {
                    type: 'string',
                    description: 'Content to write',
                    example: 'Hello World!'
                  },
                  encoding: {
                    type: 'string',
                    enum: ['utf8', 'utf16le', 'utf16be', 'latin1', 'ascii'],
                    default: 'utf8'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'File written successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' }
              }
            }
          },
          '413': { $ref: '#/components/responses/PayloadTooLarge' },
          '403': { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    '/api/files/content/force': {
      get: {
        tags: ['Files'],
        summary: 'Force read file content',
        description: 'Read file content bypassing normal size limits (use with caution)',
        parameters: [
          {
            name: 'path',
            in: 'query',
            required: true,
            description: 'File path to read',
            schema: { type: 'string' }
          },
          {
            name: 'max_size_mb',
            in: 'query',
            required: false,
            description: 'Maximum file size in MB',
            schema: { type: 'number', minimum: 1, maximum: 100, default: 50 }
          },
          {
            name: 'encoding',
            in: 'query',
            required: false,
            schema: { 
              type: 'string', 
              enum: ['utf8', 'utf16le', 'utf16be', 'latin1', 'ascii']
            }
          }
        ],
        responses: {
          '200': { $ref: '#/components/responses/Success' },
          '404': { $ref: '#/components/responses/NotFound' },
          '413': { $ref: '#/components/responses/PayloadTooLarge' }
        }
      }
    },
    '/api/files/edit': {
      put: {
        tags: ['Files'],
        summary: 'Edit file content',
        description: 'Edit file using literal or regex replacements with optional preview',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['path', 'edits'],
                properties: {
                  path: { type: 'string', example: './config.js' },
                  edits: {
                    type: 'array',
                    items: {
                      oneOf: [
                        {
                          type: 'object',
                          properties: {
                            oldText: { type: 'string' },
                            newText: { type: 'string' }
                          }
                        },
                        {
                          type: 'object',
                          properties: {
                            type: { type: 'string', enum: ['literal', 'regex'] },
                            old_text: { type: 'string' },
                            new_text: { type: 'string' },
                            pattern: { type: 'string' },
                            replacement: { type: 'string' },
                            flags: { type: 'string' }
                          }
                        }
                      ]
                    }
                  },
                  dry_run: { type: 'boolean', default: false },
                  preserve_formatting: { type: 'boolean', default: true }
                }
              }
            }
          }
        },
        responses: {
          '200': { $ref: '#/components/responses/Success' },
          '404': { $ref: '#/components/responses/NotFound' },
          '400': { $ref: '#/components/responses/BadRequest' }
        }
      }
    },
    '/api/files/move': {
      post: {
        tags: ['Files'],
        summary: 'Move or rename file',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['source', 'destination'],
                properties: {
                  source: { type: 'string', example: './old-name.txt' },
                  destination: { type: 'string', example: './new-name.txt' },
                  overwrite_existing: { type: 'boolean', default: false }
                }
              }
            }
          }
        },
        responses: {
          '200': { $ref: '#/components/responses/Success' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { $ref: '#/components/responses/Conflict' }
        }
      }
    },
    '/api/files': {
      delete: {
        tags: ['Files'],
        summary: 'Delete file',
        description: 'Delete a file with safety checks and importance assessment',
        parameters: [
          {
            name: 'path',
            in: 'query',
            required: true,
            description: 'File path to delete',
            schema: { type: 'string' }
          },
          {
            name: 'force',
            in: 'query',
            required: false,
            description: 'Force deletion of read-only files',
            schema: { type: 'boolean', default: false }
          }
        ],
        responses: {
          '200': { $ref: '#/components/responses/Success' },
          '404': { $ref: '#/components/responses/NotFound' },
          '403': { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    '/api/directories/list': {
      get: {
        tags: ['Directories'],
        summary: 'List directory contents',
        parameters: [
          {
            name: 'path',
            in: 'query',
            required: true,
            description: 'Directory path to list',
            schema: { type: 'string', example: './src' }
          },
          {
            name: 'include_hidden',
            in: 'query',
            required: false,
            schema: { type: 'boolean', default: false }
          },
          {
            name: 'sort_by',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['name', 'size', 'modified'], default: 'name' }
          },
          {
            name: 'sort_order',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' }
          }
        ],
        responses: {
          '200': { $ref: '#/components/responses/Success' },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/api/directories': {
      post: {
        tags: ['Directories'],
        summary: 'Create directory',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['path'],
                properties: {
                  path: { type: 'string', example: './new-folder' },
                  recursive: { type: 'boolean', default: true },
                  mode: { type: 'string', pattern: '^[0-7]{3,4}$', example: '0755' }
                }
              }
            }
          }
        },
        responses: {
          '200': { $ref: '#/components/responses/Success' },
          '409': { $ref: '#/components/responses/Conflict' }
        }
      },
      delete: {
        tags: ['Directories'],
        summary: 'Delete directory',
        description: 'Delete directory with optional dry-run preview for safety',
        parameters: [
          {
            name: 'path',
            in: 'query',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'recursive',
            in: 'query',
            required: false,
            schema: { type: 'boolean', default: false }
          },
          {
            name: 'force',
            in: 'query',
            required: false,
            schema: { type: 'boolean', default: false }
          },
          {
            name: 'dry_run',
            in: 'query',
            required: false,
            description: 'Preview deletion without executing',
            schema: { type: 'boolean', default: false }
          },
          {
            name: 'max_preview_files',
            in: 'query',
            required: false,
            schema: { type: 'number', minimum: 1, maximum: 50, default: 10 }
          }
        ],
        responses: {
          '200': { $ref: '#/components/responses/Success' },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/api/directories/move': {
      post: {
        tags: ['Directories'],
        summary: 'Move or rename directory',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['source', 'destination'],
                properties: {
                  source: { type: 'string' },
                  destination: { type: 'string' },
                  overwrite_existing: { type: 'boolean', default: false },
                  dry_run: { type: 'boolean', default: false }
                }
              }
            }
          }
        },
        responses: {
          '200': { $ref: '#/components/responses/Success' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { $ref: '#/components/responses/Conflict' }
        }
      }
    },
    '/api/search/content': {
      post: {
        tags: ['Search'],
        summary: 'Search file content',
        description: 'Search for files by name patterns or content using regex',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  file_pattern: { type: 'string', description: 'Regex pattern for filenames' },
                  content_pattern: { type: 'string', description: 'Regex pattern for file contents' },
                  directory: { type: 'string', default: './' },
                  recursive: { type: 'boolean', default: true },
                  max_depth: { type: 'number', default: 10 },
                  extensions: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['.js', '.ts', '.json']
                  },
                  exclude_dirs: {
                    type: 'array',
                    items: { type: 'string' },
                    default: ['node_modules', '.git']
                  },
                  case_sensitive: { type: 'boolean', default: false },
                  whole_word: { type: 'boolean', default: false },
                  max_files: { type: 'number', default: 100 },
                  max_matches_per_file: { type: 'number', default: 50 }
                },
                anyOf: [
                  { required: ['file_pattern'] },
                  { required: ['content_pattern'] }
                ]
              }
            }
          }
        },
        responses: {
          '200': { $ref: '#/components/responses/Success' },
          '400': { $ref: '#/components/responses/BadRequest' }
        }
      },
      get: {
        tags: ['Search'],
        summary: 'Simple content search',
        description: 'Quick search via query parameters',
        parameters: [
          {
            name: 'file_pattern',
            in: 'query',
            schema: { type: 'string' }
          },
          {
            name: 'content_pattern',
            in: 'query',
            schema: { type: 'string' }
          },
          {
            name: 'directory',
            in: 'query',
            schema: { type: 'string', default: './' }
          },
          {
            name: 'extensions',
            in: 'query',
            schema: { type: 'string', description: 'Comma-separated list: .js,.ts' }
          },
          {
            name: 'max_files',
            in: 'query',
            schema: { type: 'number', default: 100 }
          }
        ],
        responses: {
          '200': { $ref: '#/components/responses/Success' }
        }
      }
    }
  },
  components: {
    schemas: {
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          message: { type: 'string' },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              version: { type: 'string', example: '1.0.0' }
            }
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              suggestions: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              version: { type: 'string' },
              requestId: { type: 'string' }
            }
          }
        }
      }
    },
    responses: {
      Success: {
        description: 'Successful operation',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SuccessResponse' }
          }
        }
      },
      BadRequest: {
        description: 'Invalid request parameters',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      NotFound: {
        description: 'File or directory not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      Forbidden: {
        description: 'Access denied or security violation',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      Conflict: {
        description: 'Resource already exists or conflicting operation',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      PayloadTooLarge: {
        description: 'File or content too large',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      UnsupportedMediaType: {
        description: 'Binary file or unsupported format',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      }
    }
  }
} as const;
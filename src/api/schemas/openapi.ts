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
        description: 'Check if the API server is running properly with system metrics',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['healthy'],
                      description: 'Server health status'
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                      description: 'Current server time'
                    },
                    version: {
                      type: 'string',
                      description: 'API version'
                    },
                    uptime: {
                      type: 'number',
                      description: 'Server uptime in seconds'
                    },
                    memory: {
                      type: 'object',
                      properties: {
                        used_mb: {
                          type: 'number',
                          description: 'Memory used in megabytes'
                        },
                        total_mb: {
                          type: 'number',
                          description: 'Total memory allocated in megabytes'
                        }
                      },
                      required: ['used_mb', 'total_mb']
                    }
                  },
                  required: ['status', 'timestamp', 'version', 'uptime', 'memory']
                }
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
                schema: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'API name'
                    },
                    version: {
                      type: 'string',
                      description: 'API version'
                    },
                    description: {
                      type: 'string',
                      description: 'API description'
                    },
                    endpoints: {
                      type: 'object',
                      properties: {
                        files: {
                          type: 'object',
                          description: 'File operation endpoints',
                          additionalProperties: { type: 'string' }
                        },
                        directories: {
                          type: 'object',
                          description: 'Directory operation endpoints',
                          additionalProperties: { type: 'string' }
                        },
                        search: {
                          type: 'object',
                          description: 'Search operation endpoints',
                          additionalProperties: { type: 'string' }
                        }
                      },
                      required: ['files', 'directories', 'search']
                    },
                    documentation: {
                      type: 'string',
                      description: 'Documentation URL'
                    },
                    health_check: {
                      type: 'string',
                      description: 'Health check endpoint'
                    },
                    openapi_spec: {
                      type: 'string',
                      description: 'OpenAPI specification URL'
                    }
                  },
                  required: ['name', 'version', 'description', 'endpoints', 'documentation', 'health_check', 'openapi_spec']
                }
              }
            }
          }
        }
      }
    },
    '/api/files/info': {
      get: {
        tags: ['Files'],
        summary: 'Get file information (LLM-optimized)',
        description: 'Retrieve detailed metadata about a file or directory with LLM-optimized response format (data at top level)',
        parameters: [
          { $ref: '#/components/parameters/AbsolutePath' },
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
                schema: {
                  oneOf: [
                    {
                      type: 'object',
                      title: 'Success Response (LLM-optimized)',
                      required: ['success', 'path', 'resolved_path', 'exists', 'type', 'size', 'created', 'modified', 'accessed', 'permissions'],
                      properties: {
                        success: { type: 'boolean', const: true },
                        path: { type: 'string', description: 'File path' },
                        resolved_path: { type: 'string', description: 'Resolved absolute path' },
                        exists: { type: 'boolean', description: 'Whether file exists' },
                        type: { type: 'string', enum: ['file', 'directory', 'symlink', 'other'], description: 'File type' },
                        size: { type: 'number', description: 'File size in bytes' },
                        created: { type: 'string', format: 'date-time', description: 'Creation time' },
                        modified: { type: 'string', format: 'date-time', description: 'Last modified time' },
                        accessed: { type: 'string', format: 'date-time', description: 'Last accessed time' },
                        permissions: {
                          type: 'object',
                          properties: {
                            readable: { type: 'boolean' },
                            writable: { type: 'boolean' },
                            executable: { type: 'boolean' },
                            mode: { type: 'string', pattern: '^[0-7]{4}$' }
                          }
                        },
                        file_analysis: {
                          type: 'object',
                          description: 'Detailed file analysis (if include_analysis=true)',
                          properties: {
                            is_binary: { type: 'boolean' },
                            encoding: { type: 'string' },
                            estimated_tokens: { type: 'number' },
                            file_type: { type: 'string', enum: ['text', 'code', 'config', 'data', 'binary'] },
                            syntax_language: { type: 'string' },
                            line_count: { type: 'number' },
                            char_count: { type: 'number' },
                            safe_to_read: { type: 'boolean' }
                          }
                        },
                        directory_info: {
                          type: 'object',
                          description: 'Directory information (if target is directory)',
                          properties: {
                            file_count: { type: 'number' },
                            subdirectory_count: { type: 'number' },
                            total_size_estimate: { type: 'number' }
                          }
                        }
                      }
                    },
                    {
                      type: 'object',
                      title: 'Failure Response',
                      required: ['success', 'failedInfo'],
                      properties: {
                        success: { type: 'boolean', const: false },
                        failedInfo: {
                          type: 'object',
                          required: ['reason', 'message', 'solutions'],
                          properties: {
                            reason: {
                              type: 'string',
                              enum: ['path_not_absolute', 'not_found', 'permission_denied', 'analysis_failed']
                            },
                            message: { type: 'string' },
                            solutions: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/Solution' }
                            }
                          }
                        }
                      }
                    }
                  ]
                },
                examples: {
                  file_info: {
                    summary: 'ファイル情報取得成功 (LLM-optimized)',
                    value: {
                      success: true,
                      path: '/home/user/project/package.json',
                      resolved_path: '/home/user/project/package.json',
                      exists: true,
                      type: 'file',
                      size: 2290,
                      created: '2024-01-01T00:00:00Z',
                      modified: '2024-01-15T10:30:00Z',
                      accessed: '2024-01-15T12:00:00Z',
                      permissions: {
                        readable: true,
                        writable: true,
                          executable: false,
                          mode: '0644'
                        },
                        file_analysis: {
                          is_binary: false,
                          encoding: 'utf8',
                          estimated_tokens: 450,
                          file_type: 'config',
                          syntax_language: 'json',
                          line_count: 85,
                          char_count: 2290,
                          safe_to_read: true
                        }
                      }
                  },
                  directory_info: {
                    summary: 'ディレクトリ情報取得成功 (LLM-optimized)',
                    value: {
                      success: true,
                      path: '/home/user/project/src',
                      resolved_path: '/home/user/project/src',
                      exists: true,
                      type: 'directory',
                      size: 0,
                      created: '2024-01-01T00:00:00Z',
                      modified: '2024-01-15T09:00:00Z',
                      accessed: '2024-01-15T12:00:00Z',
                      permissions: {
                        readable: true,
                        writable: true,
                        executable: true,
                        mode: '0755'
                      },
                      directory_info: {
                        file_count: 25,
                        subdirectory_count: 5,
                        total_size_estimate: 156789
                      }
                    }
                  },
                  not_found: {
                    summary: 'ファイルが見つからない',
                    value: {
                      success: false,
                      error: {
                        code: 'file_not_found',
                        message: 'ファイルまたはディレクトリが見つかりません',
                        details: {
                          operation: 'read_file',
                          path: '/home/user/project/missing.txt'
                        },
                        suggestions: [
                          '親ディレクトリの内容を確認してください',
                          '類似名のファイルを検索してください'
                        ]
                      }
                    }
                  }
                }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '400': { $ref: '#/components/responses/PathValidationError' }
        }
      }
    },
    '/api/files/content': {
      get: {
        tags: ['Files'],
        summary: 'Read file content with unified force parameter (LLM cognitive load reduction)',
        description: `ファイル内容を読み取ります。行番号指定による部分読み込みが可能です。

**通常モード**
- サイズ制限: 20KB以下
- 制限内なら内容を返す
- サイズ超過時は部分読み込みを提案

**部分読み込みモード**
- start_line/end_lineで範囲指定
- 指定範囲のみ読み取り
- 大容量ファイルの効率的な読み取り

**自動ワークフロー**
1. 通常読み取り試行
2. サイズ超過時は部分読み込み提案
3. search_contentで対象範囲を特定後、部分読み込み`,
        parameters: [
          { $ref: '#/components/parameters/AbsolutePath' },
          {
            name: 'start_line',
            in: 'query',
            required: false,
            description: '読み取り開始行番号（1から開始、未指定時は1）',
            schema: {
              type: 'integer',
              minimum: 1
            }
          },
          {
            name: 'end_line',
            in: 'query',
            required: false,
            description: '読み取り終了行番号（未指定時は最終行まで）',
            schema: {
              type: 'integer',
              minimum: 1
            }
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
          },
        ],
        responses: {
          '200': {
            description: 'File content or safety information',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ReadFileResponse'
                },
                examples: {
                  success: {
                    summary: '読み取り成功（全体）',
                    value: {
                      success: true,
                      content: "console.log('Hello World!');",
                      file_info: {
                        total_lines: 1,
                        returned_lines: 1,
                        line_range: {
                          start: 1,
                          end: 1
                        }
                      }
                    }
                  },
                  partial_success: {
                    summary: '部分読み取り成功',
                    value: {
                      success: true,
                      content: "function processData(data) {\n  // Process logic here\n  return data.map(item => item * 2);\n}",
                      file_info: {
                        total_lines: 150,
                        returned_lines: 4,
                        line_range: {
                          start: 42,
                          end: 45
                        }
                      }
                    }
                  },
                  size_exceeded: {
                    summary: 'サイズ超過（部分読み込み提案）',
                    value: {
                      success: false,
                      failedInfo: {
                        reason: 'file_too_large',
                        message: 'ファイルサイズ（150 KB）が制限（20 KB）を超えています',
                        file_info: {
                          total_lines: 5000,
                          size_bytes: 153600,
                          estimated_tokens: 38400
                        },
                        preview: {
                          lines: [
                            "import React from 'react';",
                            "import { useState, useEffect } from 'react';",
                            "import { API } from './api';"
                          ]
                        },
                        alternatives: {
                          partial_read_available: true,
                          suggestions: [
                            'Use start_line and end_line parameters to read specific sections',
                            'Example: start_line=1, end_line=500 (reads first 500 lines)',
                            'Example: start_line=2500, end_line=3000 (reads middle section)',
                            'Use search_content to find specific patterns and locate target sections',
                            'Use search_content with content_pattern to identify relevant line numbers first',
                            'Combine search_content + read_file with line ranges for efficient targeted reading'
                          ]
                        }
                      }
                    }
                  },
                }
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
                  path: { $ref: '#/components/schemas/AbsolutePathProperty' },
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
    // '/api/files/content/force' endpoint removed - unified into /api/files/content with force parameter
    '/api/files/edit': {
      put: {
        tags: ['Files'],
        summary: 'Edit file content',
        description: `Smart file editing with two approaches:

**Simple Replacement (Recommended for 90% of cases)**
- Use oldText/newText for exact string matches
- Safer and more predictable
- Ideal for configuration changes

**Regex Replacement (Advanced)**
- Use type="regex" with pattern/replacement
- Powerful for multiple similar patterns
- Requires regex knowledge

**Best Practice:**
Start with simple replacement. Use regex only when multiple patterns need unified changes.`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['path', 'edits'],
                properties: {
                  path: { $ref: '#/components/schemas/AbsolutePathProperty' },
                  edits: {
                    type: 'array',
                    description: 'Array of edit operations',
                    items: {
                      oneOf: [
                        {
                          type: 'object',
                          title: 'Simple Text Replacement',
                          description: 'シンプルな文字列置換（推奨方式）',
                          properties: {
                            oldText: { 
                              type: 'string',
                              description: '置換対象の文字列（完全一致）',
                              example: 'const PORT = 3000'
                            },
                            newText: { 
                              type: 'string',
                              description: '置換後の文字列',
                              example: 'const PORT = 8080'
                            }
                          },
                          required: ['oldText', 'newText']
                        },
                        {
                          type: 'object',
                          title: 'Regex Pattern Replacement',
                          description: '正規表現による高度な置換（複数パターン一括処理用）',
                          properties: {
                            type: { 
                              type: 'string', 
                              enum: ['literal', 'regex'],
                              description: '編集タイプ（regex指定）'
                            },
                            old_text: { 
                              type: 'string',
                              description: 'リテラル置換用の古いテキスト'
                            },
                            new_text: { 
                              type: 'string',
                              description: 'リテラル置換用の新しいテキスト'
                            },
                            pattern: { 
                              type: 'string',
                              description: `JavaScript正規表現パターン

⚠️ **重要制限**: JavaScript標準正規表現エンジンを使用
- \\w文字クラス: ASCII文字のみ [a-zA-Z0-9_] 対象
- 日本語文字: \\wではマッチしません
- 日本語対応: [\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF\\w]+ を使用

**パターン例**:
- ASCII文字: function\\w+ 
- 日本語対応: テスト[\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF\\w]+
- 汎用単語: [^\\s]+ (空白以外)`,
                              example: 'const\\s+user\\d+\\s*='
                            },
                            replacement: { 
                              type: 'string',
                              description: '置換文字列（$1, $2等のキャプチャ使用可能）',
                              example: 'const user ='
                            },
                            flags: { 
                              type: 'string',
                              default: 'g',
                              description: '正規表現フラグ',
                              example: 'gi'
                            }
                          }
                        }
                      ]
                    }
                  },
                  dry_run: { type: 'boolean', default: false },
                  preserve_formatting: { type: 'boolean', default: true }
                }
              },
              examples: {
                simple_replacement: {
                  summary: 'シンプル置換（90%のケース）',
                  description: '単純な文字列置換',
                  value: {
                    path: './config.js',
                    edits: [
                      { oldText: 'PORT = 3000', newText: 'PORT = 8080' },
                      { oldText: 'localhost', newText: '0.0.0.0' }
                    ]
                  }
                },
                regex_replacement: {
                  summary: '正規表現置換（複数パターン統一）',
                  description: '類似パターンの一括置換',
                  value: {
                    path: './models.js',
                    edits: [
                      {
                        type: 'regex',
                        pattern: 'const\\s+(user|admin|guest)\\d+\\s*=',
                        replacement: 'const $1 =',
                        flags: 'g'
                      }
                    ]
                  }
                },
                mixed_edits: {
                  summary: '混合編集（シンプル + 正規表現）',
                  description: '状況に応じた編集方式の使い分け',
                  value: {
                    path: './app.js',
                    edits: [
                      { oldText: '// TODO: implement', newText: '// DONE: implemented' },
                      {
                        type: 'regex',
                        pattern: '\\s*console\\.log\\([^)]*\\);?',
                        replacement: '',
                        flags: 'g'
                      }
                    ],
                    dry_run: true
                  }
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
                  source: { $ref: '#/components/schemas/AbsolutePathProperty' },
                  destination: { $ref: '#/components/schemas/AbsolutePathProperty' },
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
        summary: 'Delete file (LLM-optimized)',
        description: `
**BREAKING CHANGE**: Now requires absolute paths and returns unified response format.

Features:
- **Absolute paths required**: Relative paths will be rejected
- **Unified response**: Simple success or detailed failure with solutions
- **7 failure patterns**: not_found, permission_denied, in_use, read_only, invalid_target, path_not_absolute, unknown_error
- **Force option**: Override read-only protection
- **Actionable solutions**: Every failure includes ready-to-use API calls

Use this for safe file deletion with clear error handling.
        `,
        parameters: [
          { $ref: '#/components/parameters/AbsolutePath' },
          {
            name: 'force',
            in: 'query',
            required: false,
            description: 'Force deletion of read-only files',
            schema: { type: 'boolean', default: false }
          }
        ],
        responses: {
          '200': {
            description: 'File deletion result',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      type: 'object',
                      title: 'Success Response',
                      required: ['success'],
                      properties: {
                        success: { type: 'boolean', const: true }
                      }
                    },
                    {
                      type: 'object',
                      title: 'Failure Response',
                      required: ['success', 'failedInfo'],
                      properties: {
                        success: { type: 'boolean', const: false },
                        failedInfo: {
                          type: 'object',
                          required: ['reason', 'message', 'solutions'],
                          properties: {
                            reason: { 
                              type: 'string',
                              enum: ['not_found', 'permission_denied', 'in_use', 'read_only', 'invalid_target', 'unknown_error']
                            },
                            message: { type: 'string' },
                            target_info: {
                              type: 'object',
                              properties: {
                                path: { type: 'string' },
                                type: { type: 'string', enum: ['file', 'directory'] },
                                exists: { type: 'boolean' }
                              }
                            },
                            solutions: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  method: { type: 'string' },
                                  params: { type: 'object' },
                                  description: { type: 'string' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                },
                examples: {
                  success: {
                    summary: '削除成功',
                    value: {
                      success: true
                    }
                  },
                  not_found: {
                    summary: 'ファイルが見つからない',
                    value: {
                      success: false,
                      failedInfo: {
                        reason: 'not_found',
                        message: 'ファイルが見つかりません: /path/to/missing.txt',
                        target_info: {
                          path: '/path/to/missing.txt',
                          type: 'file',
                          exists: false
                        },
                        solutions: [
                          {
                            method: 'list_directory',
                            params: { path: '/path/to' },
                            description: '親ディレクトリの内容を確認'
                          },
                          {
                            method: 'search_content',
                            params: { 
                              file_pattern: 'missing',
                              directory: '/path/to'
                            },
                            description: '類似ファイル名を検索'
                          }
                        ]
                      }
                    }
                  },
                  read_only: {
                    summary: '読み取り専用ファイル',
                    value: {
                      success: false,
                      failedInfo: {
                        reason: 'read_only',
                        message: 'ファイルは読み取り専用です: /path/to/readonly.txt',
                        target_info: {
                          path: '/path/to/readonly.txt',
                          type: 'file',
                          exists: true
                        },
                        solutions: [
                          {
                            method: 'delete_file',
                            params: { 
                              path: '/path/to/readonly.txt',
                              force: true
                            },
                            description: '強制削除（読み取り専用属性を解除して削除）'
                          },
                          {
                            method: 'file_info',
                            params: { path: '/path/to/readonly.txt' },
                            description: '属性の詳細を確認'
                          }
                        ]
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' }
        }
      }
    },
    '/api/directories/list': {
      get: {
        tags: ['Directories'],
        summary: 'List directory contents (LLM-optimized)',
        description: `
**BREAKING CHANGE**: Absolute paths required with cross-platform support.

**Major Improvements:**
- **Cross-platform paths**: Windows (C:\\path or C:/path) and Unix (/path) supported
- **Configurable limits**: max_files (1-200), max_directories (1-50)
- **Hidden file control**: include_hidden parameter (default: true)
- **Smart error analysis**: File type breakdown and intelligent filtering suggestions
- **Enhanced metadata**: Hidden status for all entries, excluded counts in summary

**Features:**
- **Absolute paths required**: Relative paths rejected with helpful current_directory info
- **File limit**: Default 50 files (configurable up to 200)
- **Enhanced filtering**: Extensions and exclude_dirs support
- **Hidden file control**: Set include_hidden=false to reduce cognitive load
- **Smart failure responses**: Detailed analysis with actionable solutions

Use this for LLM-friendly directory exploration with full control over output.
        `,
        parameters: [
          { $ref: '#/components/parameters/AbsolutePath' },
          {
            name: 'extensions',
            in: 'query',
            required: false,
            description: 'File extensions to include (with or without dots)',
            schema: {
              type: 'array',
              items: { type: 'string' },
              example: ['js', 'ts', '.json']
            },
            examples: {
              javascript_files: {
                summary: 'JavaScript関連ファイル',
                value: ['js', 'ts', 'jsx', 'tsx']
              },
              config_files: {
                summary: '設定ファイル',
                value: ['json', 'yml', 'yaml', 'toml']
              }
            }
          },
          {
            name: 'exclude_dirs',
            in: 'query',
            required: false,
            description: 'Directory names to exclude from listing',
            schema: {
              type: 'array',
              items: { type: 'string' },
              example: ['node_modules', '.git', 'dist']
            },
            examples: {
              common_excludes: {
                summary: '一般的な除外ディレクトリ',
                value: ['node_modules', '.git', 'dist', 'build', '.next']
              },
              development_excludes: {
                summary: '開発時の除外',
                value: ['coverage', '.nyc_output', 'tmp']
              }
            }
          },
          {
            name: 'include_hidden',
            in: 'query',
            required: false,
            description: `隠しファイル・ディレクトリの表示制御
      
**デフォルト: true** (常に隠しファイル表示)

- \`true\`: \`.gitignore\`, \`.vscode/\` 等を含む全ファイル表示
- \`false\`: 隠しファイル除外 (\`.\`で始まるファイル/ディレクトリ)

**LLM認知負荷軽減のため、通常はfalseを推奨**`,
            schema: {
              type: 'boolean',
              default: true
            }
          },
          {
            name: 'max_files',
            in: 'query',
            required: false,
            description: `表示する最大ファイル数 (LLM認知負荷制御)
      
**デフォルト: 50** (LLM最適化)
**範囲: 1-200**

大量ファイル時は \`extensions\` フィルタと併用推奨`,
            schema: {
              type: 'number',
              minimum: 1,
              maximum: 200,
              default: 50
            }
          },
          {
            name: 'max_directories',
            in: 'query',
            required: false,
            description: '表示する最大ディレクトリ数',
            schema: {
              type: 'number',
              minimum: 1,
              maximum: 50,
              default: 20
            }
          }
        ],
        responses: {
          '200': {
            description: 'Directory contents retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      type: 'object',
                      title: 'Success Response',
                      required: ['success', 'path', 'files', 'directories', 'summary'],
                      properties: {
                        success: { type: 'boolean', const: true },
                        path: { type: 'string', description: 'Directory path' },
                        files: {
                          type: 'array',
                          maxItems: 200,
                          items: {
                            type: 'object',
                            required: ['name', 'size', 'modified', 'hidden'],
                            properties: {
                              name: { type: 'string' },
                              size: { type: 'number', description: 'ファイルサイズ (バイト)' },
                              ext: { type: 'string', description: '拡張子 (ドットなし)' },
                              modified: { type: 'string', format: 'date-time' },
                              hidden: { type: 'boolean', description: '隠しファイルかどうか' }
                            }
                          }
                        },
                        directories: {
                          type: 'array',
                          maxItems: 50,
                          items: {
                            type: 'object',
                            required: ['name', 'files', 'directories', 'modified', 'hidden'],
                            properties: {
                              name: { type: 'string' },
                              files: { type: 'number', description: '含まれるファイル数' },
                              directories: { type: 'number', description: '含まれるサブディレクトリ数' },
                              modified: { type: 'string', format: 'date-time' },
                              hidden: { type: 'boolean', description: '隠しディレクトリかどうか' }
                            }
                          }
                        },
                        summary: {
                          type: 'object',
                          required: ['file_count', 'directory_count', 'total_size', 'limited'],
                          properties: {
                            file_count: { type: 'number' },
                            directory_count: { type: 'number' },
                            total_size: { type: 'number', description: '総ファイルサイズ (バイト)' },
                            limited: { type: 'boolean', description: '制限により一部のみ表示' },
                            additional_files: { type: 'number', description: '制限により非表示のファイル数' },
                            hidden_excluded: { type: 'number', description: '隠しファイル除外数' }
                          }
                        }
                      }
                    },
                    {
                      type: 'object',
                      title: 'Failure Response',
                      required: ['success', 'failedInfo'],
                      properties: {
                        success: { type: 'boolean', const: false },
                        failedInfo: {
                          type: 'object',
                          required: ['reason', 'message', 'solutions'],
                          properties: {
                            reason: { 
                              type: 'string',
                              enum: ['path_not_absolute', 'not_found', 'permission_denied', 'too_many_files', 'invalid_path_format']
                            },
                            message: { type: 'string', description: '人間が理解しやすいエラーメッセージ' },
                            current_directory: { type: 'string', description: '現在の作業ディレクトリ (相対パスエラー時)' },
                            solutions: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  method: { type: 'string' },
                                  params: { type: 'object' },
                                  description: { type: 'string' }
                                }
                              },
                              description: '具体的な解決策 (そのまま実行可能なパラメータ付き)'
                            },
                            directory_info: {
                              type: 'object',
                              description: 'ディレクトリ情報 (ファイル過多時の簡易情報)',
                              properties: {
                                total_files: { type: 'number' },
                                suggested_filters: { 
                                  type: 'array',
                                  items: { type: 'string' }
                                }
                              }
                            },
                            directory_analysis: {
                              type: 'object',
                              description: 'ディレクトリの詳細分析 (ファイル過多時)',
                              properties: {
                                total_files: { type: 'number' },
                                file_types: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      ext: { type: 'string' },
                                      count: { type: 'number' },
                                      percentage: { type: 'number' }
                                    }
                                  }
                                },
                                hidden_files: { type: 'number' }
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                },
                examples: {
                  success_windows: {
                    summary: 'Windows成功例',
                    value: {
                      success: true,
                      path: 'C:\\Users\\info\\source\\smart-fs-mcp\\src',
                      files: [
                        {
                          name: 'index.ts',
                          size: 27030,
                          ext: 'ts',
                          modified: '2024-01-15T10:30:00Z',
                          hidden: false
                        }
                      ],
                      directories: [
                        {
                          name: 'tools',
                          files: 15,
                          directories: 0,
                          modified: '2024-01-15T09:15:00Z',
                          hidden: false
                        }
                      ],
                      summary: {
                        file_count: 1,
                        directory_count: 1,
                        total_size: 27030,
                        limited: false,
                        hidden_excluded: 5
                      }
                    }
                  },
                  too_many_files_smart: {
                    summary: 'ファイル過多エラー (スマート提案)',
                    value: {
                      success: false,
                      failedInfo: {
                        reason: 'too_many_files',
                        message: '325ファイル検出 (制限: 50件)',
                        directory_analysis: {
                          total_files: 325,
                          file_types: [
                            { ext: 'ts', count: 45, percentage: 14 },
                            { ext: 'js', count: 38, percentage: 12 },
                            { ext: 'json', count: 12, percentage: 4 },
                            { ext: 'md', count: 8, percentage: 2 }
                          ],
                          hidden_files: 15
                        },
                        solutions: [
                          {
                            method: 'list_directory',
                            params: {
                              path: 'C:\\Users\\info\\source\\smart-fs-mcp\\src',
                              extensions: ['ts', 'js'],
                              max_files: 100
                            },
                            description: 'TypeScript/JavaScriptファイルのみ (83件)'
                          },
                          {
                            method: 'list_directory',
                            params: {
                              path: 'C:\\Users\\info\\source\\smart-fs-mcp\\src',
                              include_hidden: false,
                              max_files: 50
                            },
                            description: '隠しファイル除外で50件表示'
                          },
                          {
                            method: 'search_content',
                            params: {
                              directory: 'C:\\Users\\info\\source\\smart-fs-mcp\\src',
                              file_pattern: '.*\\.(ts|js)$'
                            },
                            description: '特定ファイルを検索で探す'
                          }
                        ]
                      }
                    }
                  },
                  relative_path_error: {
                    summary: '相対パスエラー (改善版)',
                    value: {
                      success: false,
                      failedInfo: {
                        reason: 'path_not_absolute',
                        message: "絶対パス必須: 相対パス './src' は使用できません",
                        current_directory: 'C:\\Users\\info\\source\\smart-fs-mcp',
                        solutions: [
                          {
                            method: 'list_directory',
                            params: {
                              path: 'C:\\Users\\info\\source\\smart-fs-mcp\\src'
                            },
                            description: '現在のディレクトリ基準で絶対パス使用'
                          },
                          {
                            method: 'list_directory',
                            params: {
                              path: 'C:\\Users\\info\\source\\smart-fs-mcp',
                              extensions: ['ts', 'js']
                            },
                            description: 'プロジェクトルートでTypeScriptファイルのみ表示'
                          }
                        ]
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/api/directories': {
      post: {
        tags: ['Directories'],
        summary: 'Create directory (LLM-optimized: auto-creates parent directories)',
        description: `Create a directory with LLM-optimized behavior:
- **Always creates parent directories** (recursive behavior built-in)
- **Success for existing directories** (already usable = success)
- **Simple success response** ({ "success": true })
- **Detailed failure response** (failedInfo with solutions)

LLM focus: "Is the folder now usable?" → Always returns simple success if achievable.
Note: Parent directories are automatically created - no recursive parameter needed.`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['path'],
                properties: {
                  path: { $ref: '#/components/schemas/AbsolutePathProperty' },
                  mode: { 
                    type: 'string', 
                    pattern: '^[0-7]{3,4}$', 
                    example: '0755',
                    description: 'Unix permissions (optional, Windows ignores)'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Directory created or already exists (success)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', const: true }
                  },
                  required: ['success']
                },
                examples: {
                  simple_success: {
                    summary: 'Simple success response',
                    value: { success: true }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Directory creation failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', const: false },
                    failedInfo: {
                      type: 'object',
                      properties: {
                        reason: { 
                          type: 'string',
                          enum: ['directory_creation_failed']
                        },
                        message: { type: 'string' },
                        solutions: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              method: { type: 'string' },
                              params: { type: 'object' },
                              description: { type: 'string' },
                              priority: { 
                                type: 'string',
                                enum: ['high', 'medium', 'low']
                              }
                            }
                          }
                        }
                      },
                      required: ['reason', 'message', 'solutions']
                    }
                  },
                  required: ['success', 'failedInfo']
                }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Directories'],
        summary: 'Delete directory (LLM-optimized)',
        description: `
**BREAKING CHANGE**: Now requires absolute paths and returns unified response format.

Features:
- **Absolute paths required**: Relative paths will be rejected  
- **Unified response**: Simple success or detailed failure with solutions
- **5 failure patterns**: path_not_absolute, directory_not_empty, permission_denied, directory_not_found, directory_in_use
- **Dry-run support**: Preview deletion with same response format
- **Actionable solutions**: Every failure includes ready-to-use API calls

Use this for safe directory deletion with clear error handling.
        `,
        parameters: [
          { $ref: '#/components/parameters/AbsolutePath' },
          {
            name: 'recursive',
            in: 'query',
            required: false,
            description: 'Delete directory and all contents',
            schema: { type: 'boolean', default: false }
          },
          {
            name: 'force',
            in: 'query',
            required: false,
            description: 'Force deletion of read-only files',
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
            description: 'Maximum files to show in preview',
            schema: { type: 'number', minimum: 1, maximum: 50, default: 10 }
          }
        ],
        responses: {
          '200': {
            description: 'Directory deletion result',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      type: 'object',
                      title: 'Success Response',
                      required: ['success'],
                      properties: {
                        success: { type: 'boolean', const: true }
                      }
                    },
                    {
                      type: 'object',
                      title: 'Failure Response',
                      required: ['success', 'failedInfo'],
                      properties: {
                        success: { type: 'boolean', const: false },
                        failedInfo: {
                          type: 'object',
                          properties: {
                            reason: { 
                              type: 'string',
                              enum: ['not_found', 'permission_denied', 'in_use', 'not_empty', 'invalid_target', 'unknown_error']
                            },
                            message: { type: 'string' },
                            provided_path: { type: 'string' },
                            target_path: { type: 'string' },
                            file_count: { type: 'number' },
                            subdirectory_count: { type: 'number' },
                            blocking_process: { type: 'string' },
                            sample_contents: {
                              type: 'array',
                              items: { type: 'string' }
                            },
                            solutions: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  priority: { 
                                    type: 'string',
                                    enum: ['high', 'medium', 'low']
                                  },
                                  method: { type: 'string' },
                                  params: { type: 'object' },
                                  description: { type: 'string' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                },
                examples: {
                  success: {
                    summary: '削除成功',
                    value: {
                      success: true
                    }
                  },
                  invalid_target: {
                    summary: '無効なターゲット（ファイルを指定）',
                    value: {
                      success: false,
                      failedInfo: {
                        reason: 'invalid_target',
                        message: 'ディレクトリ削除にファイルパスが指定されました',
                        target_info: {
                          path: '/path/to/file.txt',
                          type: 'file',
                          exists: true
                        },
                        solutions: [
                          {
                            method: 'delete_file',
                            params: {
                              path: '/path/to/file.txt'
                            },
                            description: 'ファイル削除として実行'
                          }
                        ]
                      }
                    }
                  },
                  not_empty: {
                    summary: 'ディレクトリが空でない',
                    value: {
                      success: false,
                      failedInfo: {
                        reason: 'not_empty',
                        message: 'ディレクトリが空ではありません: /home/user/project/temp',
                        target_info: {
                          path: '/home/user/project/temp',
                          type: 'directory',
                          exists: true
                        },
                        solutions: [
                          {
                            method: 'delete_directory',
                            params: {
                              path: '/home/user/project/temp',
                              recursive: true
                            },
                            description: '再帰的に削除（内容すべて削除）'
                          },
                          {
                            method: 'list_directory',
                            params: {
                              path: '/home/user/project/temp'
                            },
                            description: 'ディレクトリ内容を確認してから個別削除'
                          }
                        ]
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' }
        }
      }
    },
    '/api/directories/move': {
      post: {
        tags: ['Directories'],
        summary: 'Move or rename directory (LLM-optimized)',
        description: `Move or rename a directory with LLM-optimized response format:
- **Actual move**: Returns simple { "success": true }
- **Dry run**: Returns detailed preview information
- **Simple success for completed operations**: Minimizes cognitive load
- **Detailed preview for planning**: Provides necessary decision-making data`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['source', 'destination'],
                properties: {
                  source: { $ref: '#/components/schemas/AbsolutePathProperty' },
                  destination: { $ref: '#/components/schemas/AbsolutePathProperty' },
                  overwrite_existing: { 
                    type: 'boolean', 
                    default: false,
                    description: 'Overwrite if destination exists'
                  },
                  dry_run: { 
                    type: 'boolean', 
                    default: false,
                    description: 'Preview operation without executing'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Directory moved successfully',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      type: 'object',
                      title: 'Simple Success (Actual Move)',
                      properties: {
                        success: { type: 'boolean', const: true }
                      },
                      required: ['success']
                    },
                    {
                      type: 'object',
                      title: 'Detailed Success (Dry Run)',
                      properties: {
                        success: { type: 'boolean', const: true },
                        dry_run: { type: 'boolean', const: true },
                        source: { type: 'string' },
                        destination: { type: 'string' },
                        operation_type: { 
                          type: 'string',
                          enum: ['move', 'rename'],
                          description: 'Type of operation'
                        },
                        total_files: { 
                          type: 'number',
                          description: 'Total files to be moved'
                        },
                        total_directories: { 
                          type: 'number',
                          description: 'Total directories to be moved'
                        },
                        destination_exists: {
                          type: 'boolean',
                          description: 'Whether destination exists'
                        },
                        will_overwrite: {
                          type: 'boolean',
                          description: 'Whether operation will overwrite'
                        }
                      },
                      required: ['success', 'dry_run', 'source', 'destination']
                    }
                  ]
                },
                examples: {
                  move_success: {
                    summary: 'Successful move (simple)',
                    value: {
                      success: true
                    }
                  },
                  dry_run_preview: {
                    summary: 'Dry run preview (detailed)',
                    value: {
                      success: true,
                      dry_run: true,
                      source: './old-dir',
                      destination: './new-dir',
                      operation_type: 'move',
                      destination_exists: false,
                      will_overwrite: false,
                      total_files: 15,
                      total_directories: 3
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Directory move failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', const: false },
                    failedInfo: {
                      type: 'object',
                      properties: {
                        reason: { type: 'string' },
                        message: { type: 'string' },
                        source: { type: 'string' },
                        destination: { type: 'string' },
                        solutions: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              method: { type: 'string' },
                              params: { type: 'object' },
                              description: { type: 'string' },
                              priority: { 
                                type: 'string',
                                enum: ['high', 'medium', 'low']
                              }
                            }
                          }
                        }
                      },
                      required: ['reason', 'message', 'solutions']
                    }
                  },
                  required: ['success', 'failedInfo']
                }
              }
            }
          }
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
                  file_pattern: { 
                    type: 'string', 
                    description: `JavaScript正規表現パターン (ファイル名検索用)

一般的にファイル名はASCII文字が多いため\\wが使用可能
例: .*\\.test\\.ts$ (テストファイル), config\\w*\\.(json|yml)` 
                  },
                  content_pattern: { 
                    type: 'string', 
                    description: `JavaScript正規表現パターン (ファイル内容検索用)

⚠️ **日本語文字の注意**: 
- \\w は ASCII文字のみ ([a-zA-Z0-9_])
- 日本語対応: [\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF\\w]+
- 簡易版: [^\\s]+ (空白以外の文字)

例: TODO|FIXME (英語), テスト[^\\s]+ (日本語)` 
                  },
                  directory: { $ref: '#/components/schemas/AbsolutePathProperty' },
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
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SearchContentResponse'
                },
                examples: {
                  success: {
                    summary: 'TODOコメント検索成功',
                    value: {
                      success: true,
                      matches: [
                        {
                          file: './src/auth.js',
                          matchCount: 3,
                          fileSize: 12480,
                          lines: [
                            { content: '// TODO: Implement proper password hashing', lineNo: 15 },
                            { content: '  // TODO: Add rate limiting for login attempts', lineNo: 42 },
                            { content: '    // TODO: Log security events', lineNo: 67 }
                          ]
                        },
                        {
                          file: './utils/helpers.js',
                          matchCount: 2,
                          fileSize: 3241,
                          lines: [
                            { content: '// TODO: Add timezone support', lineNo: 8 },
                            { content: '  // TODO: Handle malformed JSON gracefully', lineNo: 23 }
                          ]
                        }
                      ],
                      search_type: 'content',
                      search_stats: {
                        files_scanned: 45,
                        files_with_matches: 2,
                        total_matches: 5,
                        detailed_results: 2,
                        simplified_results: 0
                      }
                    }
                  },
                  many_matches: {
                    summary: '多数マッチ（+N more表示）',
                    value: {
                      success: true,
                      matches: [
                        {
                          file: './src/core/search-engine.ts',
                          matchCount: 15,
                          fileSize: 45678,
                          lines: [
                            { content: 'export function searchByFileName(rootDir: string, pattern: string) {', lineNo: 73 },
                            { content: '  const regex = createFilePathRegex(pattern, options.caseSensitive);', lineNo: 75 },
                            { content: 'export async function searchByContent(rootDir: string, pattern: string) {', lineNo: 99 },
                            { content: '  const regex = createSearchRegex(pattern, options.caseSensitive, options.wholeWord);', lineNo: 101 },
                            { content: 'function searchFile(filePath: string, fileRegex: RegExp | null) {', lineNo: 224 },
                            { content: '  if (fileRegex) {', lineNo: 245 },
                            { content: '    const matches = filePath.match(fileRegex);', lineNo: 246 },
                            { content: 'async function searchFileContent(filePath: string, regex: RegExp) {', lineNo: 358 },
                            { content: '      const matches = line.matchAll(globalRegex);', lineNo: 388 },
                            { content: '      for (const match of matches) {', lineNo: 391 },
                            '+5 more'
                          ]
                        }
                      ],
                      search_type: 'content',
                      search_stats: {
                        files_scanned: 150,
                        files_with_matches: 1,
                        total_matches: 15,
                        detailed_results: 1,
                        simplified_results: 0
                      }
                    }
                  },
                  no_matches: {
                    summary: 'マッチなし',
                    value: {
                      success: false,
                      failedInfo: {
                        reason: 'no_matches',
                        message: 'No matches found',
                        solutions: [
                          {
                            method: 'search_content',
                            params: {
                              content_pattern: 'TODO|FIXME|IMPORTANT',
                              directory: './',
                              case_sensitive: false
                            },
                            description: 'より広い検索パターンで再検索'
                          }
                        ]
                      }
                    }
                  }
                }
              }
            }
          },
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
            description: '絶対パス必須（相対パス不可）。Windows・Unix両形式自動対応。',
            schema: {
              type: 'string',
              pattern: '^(/|[A-Za-z]:[/\\\\])',
              example: 'C:/Users/info/source/smart-fs-mcp'
            }
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
          },
        ],
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SearchContentResponse'
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    parameters: {
      AbsolutePath: {
        name: 'path',
        in: 'query',
        required: true,
        description: '絶対パス必須（相対パス不可）。Windows・Unix両形式自動対応。',
        schema: {
          type: 'string',
          pattern: '^(/|[A-Za-z]:[/\\\\])',
          example: 'C:/Users/info/source/smart-fs-mcp'
        },
        examples: {
          windows_forward: {
            summary: 'Windows（推奨）',
            value: 'C:/Users/info/source/smart-fs-mcp'
          },
          windows_backslash: {
            summary: 'Windows（バックスラッシュ）',
            value: 'C:\\Users\\info\\source\\smart-fs-mcp'
          },
          unix: {
            summary: 'Unix/Linux',
            value: '/home/user/project/src'
          }
        }
      }
    },
    schemas: {
      AbsolutePathProperty: {
        type: 'string',
        pattern: '^(/|[A-Za-z]:[/\\\\])',
        description: '絶対パス必須（相対パス不可）。Windows・Unix両形式自動対応。',
        example: 'C:/Users/info/source/smart-fs-mcp'
      },
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
        required: ['success', 'error'],
        properties: {
          success: {
            type: 'boolean',
            enum: [false],
            description: 'Operation failed'
          },
          error: {
            type: 'object',
            required: ['code', 'message', 'details', 'suggestions'],
            properties: {
              code: {
                type: 'string',
                description: 'エラーコード',
                enum: [
                  'missing_path',
                  'path_not_absolute',
                  'invalid_path',
                  'file_not_found',
                  'access_denied',
                  'invalid_parameter',
                  'operation_failed',
                  'pattern_not_found',
                  'directory_not_empty',
                  'unknown_error'
                ]
              },
              message: {
                type: 'string',
                description: '日本語エラーメッセージ'
              },
              details: {
                type: 'object',
                description: 'エラーの詳細情報',
                properties: {
                  operation: {
                    type: 'string',
                    description: '実行された操作'
                  },
                  path: {
                    type: 'string',
                    description: '対象パス'
                  },
                  error_code: {
                    type: 'string',
                    description: 'システムエラーコード（例: ENOENT）'
                  }
                },
                additionalProperties: true
              },
              suggestions: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: '解決策の提案'
              }
            },
            additionalProperties: false
          }
        },
        additionalProperties: false,
        example: {
          success: false,
          error: {
            code: 'file_not_found',
            message: 'ファイルが見つかりません: /path/to/file.txt',
            details: {
              operation: 'read_file',
              path: '/path/to/file.txt',
              error_code: 'ENOENT'
            },
            suggestions: [
              'ファイルパスを確認してください',
              '親ディレクトリの内容を確認してください'
            ]
          }
        }
      },
      // Simple Response Schemas
      ReadFileResponse: {
        oneOf: [
          { $ref: '#/components/schemas/ReadFileSuccess' },
          { $ref: '#/components/schemas/ErrorResponse' }
        ]
      },
      ReadFileSuccess: {
        type: 'object',
        required: ['success', 'content'],
        properties: {
          success: {
            type: 'boolean',
            enum: [true]
          },
          content: {
            type: 'string',
            description: 'ファイルの内容'
          },
          file_info: {
            type: 'object',
            description: 'ファイル情報（行範囲指定時のみ）',
            properties: {
              total_lines: {
                type: 'number',
                description: 'ファイルの総行数'
              },
              returned_lines: {
                type: 'number',
                description: '返された行数'
              },
              line_range: {
                type: 'object',
                properties: {
                  start: { type: 'number' },
                  end: { type: 'number' }
                },
                required: ['start', 'end']
              }
            },
            required: ['total_lines', 'returned_lines', 'line_range']
          }
        },
        additionalProperties: false,
        example: {
          success: true,
          content: "console.log('Hello World!');"
        }
      },
      Solution: {
        type: 'object',
        required: ['method', 'params', 'description'],
        properties: {
          method: {
            type: 'string',
            description: '実行すべきAPI method'
          },
          params: {
            type: 'object',
            description: 'そのまま使用可能なパラメータ',
            additionalProperties: true
          },
          description: {
            type: 'string',
            description: 'LLM向けの説明'
          }
        },
        example: {
          method: 'search_content',
          params: {
            content_pattern: 'TODO|FIXME',
            directory: '/absolute/path/to/project'
          },
          description: '特定のパターンを検索'
        }
      },
      // Simple Search Schemas
      LineMatch: {
        type: 'object',
        required: ['content', 'lineNo'],
        properties: {
          content: {
            type: 'string',
            description: 'マッチした行の内容'
          },
          lineNo: {
            type: 'number',
            description: '行番号（1ベース）'
          }
        },
        example: {
          content: 'function validateUser(username, password) {',
          lineNo: 42
        }
      },
      SearchMatch: {
        type: 'object',
        required: ['file', 'matchCount', 'fileSize'],
        properties: {
          file: {
            type: 'string',
            description: 'ファイルパス'
          },
          matchCount: {
            type: 'number',
            description: 'マッチ数（重要度判断用）'
          },
          fileSize: {
            type: 'number',
            description: 'ファイルサイズ（バイト）'
          },
          lines: {
            type: 'array',
            description: 'マッチした行情報（最大10件、それ以上は"+N more"表示）',
            items: {
              oneOf: [
                { $ref: '#/components/schemas/LineMatch' },
                { type: 'string', pattern: '^\\+\\d+ more$' }
              ]
            },
            maxItems: 11
          }
        },
        example: {
          file: './src/auth.js',
          matchCount: 5,
          fileSize: 12480,
          lines: [
            { content: 'function validateUser(username, password) {', lineNo: 42 },
            { content: '  const user = await UserService.find(username);', lineNo: 43 },
            { content: '  if (!user || !checkPermission(user)) {', lineNo: 44 },
            { content: '    throw new Error("Invalid user");', lineNo: 45 },
            { content: '  return user;', lineNo: 47 }
          ]
        }
      },
      SearchContentResponse: {
        oneOf: [
          { $ref: '#/components/schemas/SearchContentSuccess' },
          { $ref: '#/components/schemas/ErrorResponse' }
        ]
      },
      SearchContentSuccess: {
        type: 'object',
        required: ['success', 'matches', 'search_type', 'search_stats'],
        properties: {
          success: {
            type: 'boolean',
            enum: [true]
          },
          matches: {
            type: 'array',
            items: { $ref: '#/components/schemas/SearchMatch' }
          },
          search_type: {
            type: 'string',
            enum: ['filename', 'content', 'both'],
            description: '検索タイプ'
          },
          search_stats: {
            type: 'object',
            required: ['files_scanned', 'files_with_matches', 'total_matches', 'detailed_results', 'simplified_results'],
            properties: {
              files_scanned: {
                type: 'number',
                description: 'スキャンしたファイル数'
              },
              files_with_matches: {
                type: 'number',
                description: 'マッチが見つかったファイル数'
              },
              total_matches: {
                type: 'number',
                description: '総マッチ数'
              },
              detailed_results: {
                type: 'number',
                description: '詳細結果表示数（最大20）'
              },
              simplified_results: {
                type: 'number',
                description: '簡略結果表示数（21以降）'
              }
            }
          }
        },
        additionalProperties: false
      },
      PathValidationErrorResponse: {
        $ref: '#/components/schemas/ErrorResponse'
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
      PathValidationError: {
        description: 'Path validation error - relative path provided instead of absolute path',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/PathValidationErrorResponse' }
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
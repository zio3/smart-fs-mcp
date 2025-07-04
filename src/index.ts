#!/usr/bin/env node
/**
 * Smart Filesystem MCP - Server Entry Point
 * LLM-optimized filesystem MCP tool with safety controls
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { SafetyController } from './core/safety-controller.js';
import { getSecurityController, SecurityControllerV2 } from './core/security-controller-v2.js';
import { FileAnalyzer } from './core/file-analyzer.js';
import { readFile } from './tools/read-file.js';
import { readFileForce } from './tools/read-file-force.js';
import { listDirectory } from './tools/list-directory.js';
import { searchContent } from './tools/search-content.js';
import { writeFile } from './tools/write-file.js';
import { editFile } from './tools/edit-file.js';
import { moveFile } from './tools/move-file.js';
import { listAllowedDirs } from './tools/list-allowed-dirs.js';
import { fileInfo } from './tools/file-info.js';
import { mkdir } from './tools/mkdir.js';
import { deleteFile } from './tools/delete-file.js';
import { deleteDirectory } from './tools/delete-directory.js';
import { moveDirectory } from './tools/move-directory.js';
// Security wrapper imports removed - tools handle validation internally
import { SAFETY_LIMITS } from './utils/constants.js';
import type {
  ReadFileParams,
  ReadFileForceParams,
  EnhancedListDirectoryParams,
  SearchContentParams,
  WriteFileParams,
  EditFileParams,
  MoveFileParams,
} from './core/types.js';
import type {
  FileInfoParams
} from './tools/file-info.js';
import type {
  MkdirParams
} from './tools/mkdir.js';
import type {
  DeleteFileParams,
  DeleteDirectoryParams
} from './types/delete-operations.js';
import type {
  MoveDirectoryParams
} from './tools/move-directory.js';

/**
 * Smart Filesystem MCP Server
 */
class SmartFilesystemMCP {
  private server: Server;
  private safety: SafetyController;
  private securityV2: SecurityControllerV2;
  private analyzer: FileAnalyzer;

  constructor() {
    this.server = new Server(
      {
        name: 'smart-fs-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.safety = new SafetyController();
    this.securityV2 = getSecurityController();
    this.analyzer = new FileAnalyzer();

    this.setupHandlers();
  }

  /**
   * Setup request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'read_file',
          description: 'Read file contents - returns content directly or detailed error info if limits exceeded',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path to read',
              },
              encoding: {
                type: 'string',
                enum: ['utf8', 'utf16le', 'utf16be', 'latin1', 'ascii'],
                description: 'Text encoding (default: utf8)',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'read_file_force',
          description: 'Force read file that exceeds normal limits (requires risk acknowledgment)',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path to read',
              },
              max_size_mb: {
                type: 'number',
                description: 'Maximum size in MB to allow (default: 50, max: 50)',
                minimum: 1,
                maximum: 50,
              },
              acknowledge_risk: {
                type: 'boolean',
                description: 'Must be true to force read large files',
              },
              encoding: {
                type: 'string',
                enum: ['utf8', 'utf16le', 'utf16be', 'latin1', 'ascii'],
                description: 'Text encoding (default: utf8)',
              },
            },
            required: ['path', 'acknowledge_risk'],
          },
        },
        {
          name: 'list_directory',
          description: 'List directory contents (LLM-optimized, BREAKING: absolute paths required)',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Absolute directory path (BREAKING: relative paths rejected)',
              },
              extensions: {
                type: 'array',
                items: { type: 'string' },
                description: 'File extensions to include (e.g., ["js", "ts", ".json"])',
              },
              exclude_dirs: {
                type: 'array',
                items: { type: 'string' },
                description: 'Directory names to exclude (e.g., ["node_modules", ".git"])',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'search_content',
          description: 'Search for files by name or content using regex patterns (grep-like tool)',
          inputSchema: {
            type: 'object',
            properties: {
              file_pattern: {
                type: 'string',
                description: 'Regex pattern to match file names/paths',
              },
              content_pattern: {
                type: 'string',
                description: 'Regex pattern to search within file contents',
              },
              directory: {
                type: 'string',
                description: 'Starting directory for search (default: current directory)',
              },
              recursive: {
                type: 'boolean',
                description: 'Search recursively in subdirectories (default: true)',
              },
              max_depth: {
                type: 'number',
                description: 'Maximum directory depth to search (default: 10)',
              },
              extensions: {
                type: 'array',
                items: { type: 'string' },
                description: 'File extensions to include (e.g., [".js", ".ts"])',
              },
              exclude_extensions: {
                type: 'array',
                items: { type: 'string' },
                description: 'File extensions to exclude',
              },
              exclude_dirs: {
                type: 'array',
                items: { type: 'string' },
                description: 'Directory names to exclude (default: ["node_modules", ".git"])',
              },
              case_sensitive: {
                type: 'boolean',
                description: 'Case-sensitive search (default: false)',
              },
              whole_word: {
                type: 'boolean',
                description: 'Match whole words only (default: false)',
              },
              max_files: {
                type: 'number',
                description: 'Maximum number of files to return (default: 100, max: 500)',
              },
              max_matches_per_file: {
                type: 'number',
                description: 'Maximum matches per file (default: 50)',
              },
            },
            anyOf: [
              { required: ['file_pattern'] },
              { required: ['content_pattern'] }
            ],
          },
        },
        {
          name: 'write_file',
          description: 'Write content to a file (overwrites existing files)',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path to write',
              },
              content: {
                type: 'string',
                description: 'Content to write to the file',
              },
              encoding: {
                type: 'string',
                enum: ['utf8', 'utf16le', 'utf16be', 'latin1', 'ascii'],
                description: 'Text encoding (default: utf8)',
              },
            },
            required: ['path', 'content'],
          },
        },
        {
          name: 'edit_file',
          description: 'Edit file content using literal or regex replacements',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path to edit',
              },
              edits: {
                type: 'array',
                description: 'Array of edit operations to apply',
                items: {
                  oneOf: [
                    {
                      type: 'object',
                      properties: {
                        type: { const: 'literal' },
                        old_text: { type: 'string', description: 'Exact text to replace' },
                        new_text: { type: 'string', description: 'Replacement text' },
                      },
                      required: ['type', 'old_text', 'new_text'],
                    },
                    {
                      type: 'object',
                      properties: {
                        type: { const: 'regex' },
                        pattern: { type: 'string', description: 'Regex pattern to match' },
                        replacement: { type: 'string', description: 'Replacement string (supports $1, $2, etc.)' },
                        flags: { type: 'string', description: 'Regex flags (default: g)' },
                      },
                      required: ['type', 'pattern', 'replacement'],
                    },
                  ],
                },
              },
              dry_run: {
                type: 'boolean',
                description: 'Preview changes without applying (only useful for regex edits)',
              },
            },
            required: ['path', 'edits'],
          },
        },
        {
          name: 'move_file',
          description: 'Move or rename a file',
          inputSchema: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                description: 'Source file path',
              },
              destination: {
                type: 'string',
                description: 'Destination file path',
              },
              overwrite_existing: {
                type: 'boolean',
                description: 'Overwrite if destination exists (default: false)',
              },
            },
            required: ['source', 'destination'],
          },
        },
        {
          name: 'list_allowed_dirs',
          description: 'List all directories that this server is allowed to access',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'file_info',
          description: 'Get detailed information about a file or directory',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File or directory path',
              },
              include_analysis: {
                type: 'boolean',
                description: 'Include detailed file analysis (default: true)',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'mkdir',
          description: 'Create a new directory with optional parent directories',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Directory path to create',
              },
              recursive: {
                type: 'boolean',
                description: 'Create parent directories if needed (default: true)',
              },
              mode: {
                type: 'string',
                description: 'Unix-style permissions (default: 0755)',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'delete_file',
          description: 'Delete a file with safety checks and importance assessment',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path to delete',
              },
              force: {
                type: 'boolean',
                description: 'Force deletion of read-only files (default: false)',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'delete_directory',
          description: 'Delete a directory with optional dry-run preview and safety checks',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Directory path to delete',
              },
              recursive: {
                type: 'boolean',
                description: 'Delete directory contents recursively (default: false)',
              },
              force: {
                type: 'boolean',
                description: 'Force deletion of read-only files (default: false)',
              },
              dry_run: {
                type: 'boolean',
                description: 'Preview deletion without executing (default: false)',
              },
              max_preview_files: {
                type: 'number',
                description: 'Maximum files to show in preview (default: 10)',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'move_directory',
          description: 'Move or rename a directory with optional preview',
          inputSchema: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                description: 'Source directory path',
              },
              destination: {
                type: 'string',
                description: 'Destination directory path',
              },
              overwrite_existing: {
                type: 'boolean',
                description: 'Overwrite existing destination directory (default: false)',
              },
              dry_run: {
                type: 'boolean',
                description: 'Preview operation without executing (default: false)',
              },
            },
            required: ['source', 'destination'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'read_file':
            return await this.handleReadFile(args as unknown as ReadFileParams);

          case 'read_file_force':
            return await this.handleReadFileForce(args as unknown as ReadFileForceParams);

          case 'list_directory':
            return await this.handleListDirectory(args as unknown as EnhancedListDirectoryParams);

          case 'search_content':
            return await this.handleSearchContent(args as unknown as SearchContentParams);

          case 'write_file':
            return await this.handleWriteFile(args as unknown as WriteFileParams);

          case 'edit_file':
            return await this.handleEditFile(args as unknown as EditFileParams);

          case 'move_file':
            return await this.handleMoveFile(args as unknown as MoveFileParams);

          case 'list_allowed_dirs':
            return await this.handleListAllowedDirs();

          case 'file_info':
            return await this.handleFileInfo(args as unknown as FileInfoParams);

          case 'mkdir':
            return await this.handleMkdir(args as unknown as MkdirParams);

          case 'delete_file':
            return await this.handleDeleteFile(args as unknown as DeleteFileParams);

          case 'delete_directory':
            return await this.handleDeleteDirectory(args as unknown as DeleteDirectoryParams);

          case 'move_directory':
            return await this.handleMoveDirectory(args as unknown as MoveDirectoryParams);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }

        // For unexpected errors not handled by tools, return unified error format
        const unifiedError = {
          success: false,
          error: {
            code: 'operation_failed',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            details: {
              operation: request.params.name
            },
            suggestions: [
              '操作を再試行してください',
              'パラメータを確認してください'
            ]
          }
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(unifiedError, null, 2)
          }]
        };
      }
    });
  }

  /**
   * Handle read_file tool
   */
  private async handleReadFile(params: ReadFileParams): Promise<{ content: any[] }> {
    // パスバリデーションは readFile 内で実施される
    const result = await readFile(params, this.safety, this.analyzer);

    // エラーの場合も正常にレスポンスを返す
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Handle read_file_force tool
   */
  private async handleReadFileForce(params: ReadFileForceParams): Promise<{ content: any[] }> {
    // Remove parameter validation - let tool handle it
    const result = await readFileForce(params, this.safety, this.analyzer);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Handle list_directory tool (LLM-optimized)
   */
  private async handleListDirectory(params: EnhancedListDirectoryParams): Promise<{ content: any[] }> {
    // Remove parameter validation - let tool handle it
    const result = await listDirectory(params, this.safety);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Handle search_content tool
   */
  private async handleSearchContent(params: SearchContentParams): Promise<{ content: any[] }> {
    // Remove parameter validation and old failedInfo handling - let tool handle it
    const result = await searchContent(params, this.safety);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Handle write_file tool
   */
  private async handleWriteFile(params: WriteFileParams): Promise<{ content: any[] }> {
    // Remove parameter validation - let tool handle it
    const result = await writeFile(params, this.safety);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Handle edit_file tool
   */
  private async handleEditFile(params: EditFileParams): Promise<{ content: any[] }> {
    // Remove parameter validation - let tool handle it
    const result = await editFile(params, this.safety, this.analyzer);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Handle move_file tool
   */
  private async handleMoveFile(params: MoveFileParams): Promise<{ content: any[] }> {
    // Remove parameter validation - let tool handle it
    const result = await moveFile(params, this.safety);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Handle list_allowed_dirs tool
   */
  private async handleListAllowedDirs(): Promise<{ content: any[] }> {
    // 実際のデータを取得してJSON文字列として返す
    const result = await listAllowedDirs();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Handle file_info tool
   */
  private async handleFileInfo(params: FileInfoParams): Promise<{ content: any[] }> {
    // Remove parameter validation - let tool handle it
    const result = await fileInfo(params);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Handle mkdir tool
   */
  private async handleMkdir(params: MkdirParams): Promise<{ content: any[] }> {
    // Remove parameter validation - let tool handle it
    const result = await mkdir(params);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Handle delete_file tool
   */
  private async handleDeleteFile(params: DeleteFileParams): Promise<{ content: any[] }> {
    // Remove parameter validation - let tool handle it
    const result = await deleteFile(params);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Handle delete_directory tool
   */
  private async handleDeleteDirectory(params: DeleteDirectoryParams): Promise<{ content: any[] }> {
    // Remove parameter validation - let tool handle it
    const result = await deleteDirectory(params);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Handle move_directory tool
   */
  private async handleMoveDirectory(params: MoveDirectoryParams): Promise<{ content: any[] }> {
    // Remove parameter validation - let tool handle it
    const result = await moveDirectory(params);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Log startup with security info
    const allowedDirs = this.securityV2.getAllowedDirectories();
    console.error('Smart Filesystem MCP Server started');
    console.error(`Safety limits: Max file ${SAFETY_LIMITS.MAX_FILE_SIZE} bytes, Max scan ${SAFETY_LIMITS.MAX_DIRECTORY_SCAN} files`);
    console.error(`Allowed directories: ${allowedDirs.length > 0 ? allowedDirs.join(', ') : 'Current directory only'}`);
  }
}

// Main entry point
async function main() {
  try {
    // Get allowed directories from command line arguments
    const allowedDirs = process.argv.slice(2);

    if (allowedDirs.length === 0) {
      allowedDirs.push(process.cwd());
    }

    // Initialize security controller with allowed directories
    const { initializeSecurityController } = await import('./core/security-controller-v2.js');
    await initializeSecurityController(allowedDirs);

    const server = new SmartFilesystemMCP();
    await server.start();
  } catch (error) {
    console.error('[ERROR] Failed to start server:', error);
    if (error instanceof Error) {
      console.error('[ERROR] Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.error('Server shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Server shutting down');
  process.exit(0);
});

// Start server if run directly
// Handle both Unix and Windows path formats
const scriptPath = process.argv[1];
if (scriptPath) {
  const normalizedPath = scriptPath.replace(/\\/g, '/');
  const isMainModule = import.meta.url === `file://${normalizedPath}` ||
                      import.meta.url === `file:///${normalizedPath}`;

  if (isMainModule) {
    main().catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  }
} else {
  // Fallback: always start if no script path
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
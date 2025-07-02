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
import { withReadSecurity, withWriteSecurity, withDirectorySecurity, enhanceErrorWithSecurity } from './utils/security-wrapper.js';
import { SAFETY_LIMITS } from './utils/constants.js';
import type { 
  ReadFileParams,
  ReadFileForceParams,
  ListDirectoryParams,
  SearchContentParams,
  WriteFileParams,
  EditFileParams,
  MoveFileParams,
  ReadFileResult,
  ListDirectoryResponse,
  SearchContentResponse,
  WriteFileResult,
  EditFileResult,
  MoveFileResult
} from './core/types.js';
import type {
  FileInfoParams,
  FileInfoResult
} from './tools/file-info.js';
import type {
  MkdirParams,
  MkdirResult
} from './tools/mkdir.js';
import type {
  ListAllowedDirsResult
} from './tools/list-allowed-dirs.js';
import type {
  DeleteFileParams,
  DeleteFileResult,
  DeleteDirectoryParams,
  DeleteDirectoryResult
} from './types/delete-operations.js';
import type {
  MoveDirectoryParams,
  MoveDirectoryResult
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
          description: 'List directory contents with file details and subdirectory summaries',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Directory path to list',
              },
              include_hidden: {
                type: 'boolean',
                description: 'Include hidden files (default: false)',
              },
              sort_by: {
                type: 'string',
                enum: ['name', 'size', 'modified'],
                description: 'Sort criteria (default: name)',
              },
              sort_order: {
                type: 'string',
                enum: ['asc', 'desc'],
                description: 'Sort order (default: asc)',
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
            return await this.handleReadFile(args as ReadFileParams);
            
          case 'read_file_force':
            return await this.handleReadFileForce(args as ReadFileForceParams);
          
          case 'list_directory':
            return await this.handleListDirectory(args as ListDirectoryParams);
          
          case 'search_content':
            return await this.handleSearchContent(args as SearchContentParams);
          
          case 'write_file':
            return await this.handleWriteFile(args as WriteFileParams);
          
          case 'edit_file':
            return await this.handleEditFile(args as EditFileParams);
          
          case 'move_file':
            return await this.handleMoveFile(args as MoveFileParams);
          
          case 'list_allowed_dirs':
            return await this.handleListAllowedDirs();
          
          case 'file_info':
            return await this.handleFileInfo(args as FileInfoParams);
          
          case 'mkdir':
            return await this.handleMkdir(args as MkdirParams);
          
          case 'delete_file':
            return await this.handleDeleteFile(args as DeleteFileParams);
          
          case 'delete_directory':
            return await this.handleDeleteDirectory(args as DeleteDirectoryParams);
          
          case 'move_directory':
            return await this.handleMoveDirectory(args as MoveDirectoryParams);
          
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
        
        // Enhance error with security info if applicable
        const enhancedError = enhanceErrorWithSecurity(
          error instanceof Error ? error : new Error('Unknown error occurred')
        );
        
        // Convert to MCP error
        throw new McpError(
          ErrorCode.InternalError,
          enhancedError.message
        );
      }
    });
  }

  /**
   * Handle read_file tool
   */
  private async handleReadFile(params: ReadFileParams): Promise<{ content: ReadFileResult[] }> {
    try {
      if (!params.path) {
        throw new Error('File path is required');
      }
      
      // Apply security check
      const result = await withReadSecurity(
        params,
        async (validatedPath) => {
          const securedParams = { ...params, path: validatedPath };
          return readFile(securedParams, this.safety, this.analyzer);
        },
        this.safety,
        this.analyzer
      );
      
      return {
        content: [result],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Read failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  /**
   * Handle read_file_force tool
   */
  private async handleReadFileForce(params: ReadFileForceParams): Promise<{ content: ReadFileResult[] }> {
    try {
      if (!params.path) {
        throw new Error('File path is required');
      }
      
      // Apply security check
      const result = await withReadSecurity(
        params,
        async (validatedPath) => {
          const securedParams = { ...params, path: validatedPath };
          return readFileForce(securedParams, this.safety, this.analyzer);
        },
        this.safety,
        this.analyzer
      );
      
      return {
        content: [result],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Read force failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle list_directory tool
   */
  private async handleListDirectory(params: ListDirectoryParams): Promise<{ content: ListDirectoryResponse[] }> {
    try {
      if (!params.path) {
        throw new Error('Directory path is required');
      }
      
      // Apply security check
      const result = await withDirectorySecurity(
        params,
        async (securedParams) => listDirectory(securedParams, this.safety),
        this.safety
      );
      
      return {
        content: [result],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `List directory failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle search_content tool
   */
  private async handleSearchContent(params: SearchContentParams): Promise<{ content: SearchContentResponse[] }> {
    try {
      if (!params.file_pattern && !params.content_pattern) {
        throw new Error('Either file_pattern or content_pattern is required');
      }
      
      // Apply security check
      const result = await withDirectorySecurity(
        params,
        async (securedParams) => searchContent(securedParams, this.safety),
        this.safety
      );
      
      return {
        content: [result],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Search content failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle write_file tool
   */
  private async handleWriteFile(params: WriteFileParams): Promise<{ content: WriteFileResult[] }> {
    try {
      if (!params.path) {
        throw new Error('File path is required');
      }
      
      if (params.content === undefined || params.content === null) {
        throw new Error('Content is required');
      }
      
      // Apply security check
      const result = await withWriteSecurity(
        params,
        async (securedParams) => writeFile(securedParams, this.safety),
        this.safety
      );
      
      return {
        content: [result],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Write file failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle edit_file tool
   */
  private async handleEditFile(params: EditFileParams): Promise<{ content: EditFileResult[] }> {
    try {
      if (!params.path) {
        throw new Error('File path is required');
      }
      
      if (!params.edits || params.edits.length === 0) {
        throw new Error('At least one edit operation is required');
      }
      
      // Apply security check
      const result = await withWriteSecurity(
        params,
        async (securedParams) => editFile(securedParams, this.safety, this.analyzer),
        this.safety,
        this.analyzer
      );
      
      return {
        content: [result],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Edit file failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle move_file tool
   */
  private async handleMoveFile(params: MoveFileParams): Promise<{ content: MoveFileResult[] }> {
    try {
      if (!params.source) {
        throw new Error('Source path is required');
      }
      
      if (!params.destination) {
        throw new Error('Destination path is required');
      }
      
      // Apply security check
      const result = await withWriteSecurity(
        params,
        async (securedParams) => moveFile(securedParams, this.safety),
        this.safety
      );
      
      return {
        content: [result],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Move file failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle list_allowed_dirs tool
   */
  private async handleListAllowedDirs(): Promise<{ content: ListAllowedDirsResult[] }> {
    try {
      const result = await listAllowedDirs();
      
      return {
        content: [result],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `List allowed dirs failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle file_info tool
   */
  private async handleFileInfo(params: FileInfoParams): Promise<{ content: FileInfoResult[] }> {
    try {
      if (!params.path) {
        throw new Error('File path is required');
      }
      
      const result = await fileInfo(params, this.analyzer);
      
      return {
        content: [result],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `File info failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle mkdir tool
   */
  private async handleMkdir(params: MkdirParams): Promise<{ content: MkdirResult[] }> {
    try {
      if (!params.path) {
        throw new Error('Directory path is required');
      }
      
      const result = await mkdir(params);
      
      return {
        content: [result],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Mkdir failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle delete_file tool
   */
  private async handleDeleteFile(params: DeleteFileParams): Promise<{ content: DeleteFileResult[] }> {
    try {
      if (!params.path) {
        throw new Error('File path is required');
      }
      
      const result = await deleteFile(params);
      
      return {
        content: [result],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Delete file failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle delete_directory tool
   */
  private async handleDeleteDirectory(params: DeleteDirectoryParams): Promise<{ content: DeleteDirectoryResult[] }> {
    try {
      if (!params.path) {
        throw new Error('Directory path is required');
      }
      
      const result = await deleteDirectory(params);
      
      return {
        content: [result],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Delete directory failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle move_directory tool
   */
  private async handleMoveDirectory(params: MoveDirectoryParams): Promise<{ content: MoveDirectoryResult[] }> {
    try {
      if (!params.source) {
        throw new Error('Source path is required');
      }
      
      if (!params.destination) {
        throw new Error('Destination path is required');
      }
      
      const result = await moveDirectory(params);
      
      return {
        content: [result],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Move directory failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
    const server = new SmartFilesystemMCP();
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
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
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
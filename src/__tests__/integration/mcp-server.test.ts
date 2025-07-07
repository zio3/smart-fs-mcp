/**
 * MCP Server Integration Tests
 * Tests all tools through the MCP server interface
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

describe('MCP Server Integration', () => {
  let server: any;
  let requestId = 1;

  const sendRequest = (method: string, params: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: requestId++,
        method,
        params
      };

      let buffer = '';
      const handler = (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = JSON.parse(line);
              if (response.id === request.id) {
                server.stdout.off('data', handler);
                if (response.error) {
                  reject(new Error(response.error.message));
                } else {
                  resolve(response.result);
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      };

      server.stdout.on('data', handler);
      server.stdin.write(JSON.stringify(request) + '\n');

      // Timeout after 5 seconds
      setTimeout(() => {
        server.stdout.off('data', handler);
        reject(new Error('Request timeout'));
      }, 5000);
    });
  };

  beforeAll(async () => {
    // Start MCP server
    server = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.resolve(__dirname, '../../..')
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Initialize
    await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'test', version: '1.0' }
    });
  });

  afterAll(() => {
    if (server) {
      server.kill();
    }
  });

  describe('read_file tool', () => {
    it('should read small files successfully', async () => {
      const result = await sendRequest('tools/call', {
        name: 'read_file',
        arguments: {
          path: path.resolve(__dirname, '../../../package.json')
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.content).toContain('"name": "@zio3/smart-fs-mcp"');
    });

    it('should handle size exceeded with proper error format', async () => {
      // Create a large test file
      const testFile = path.resolve(__dirname, '../../../test-large.txt');
      await fs.writeFile(testFile, 'x'.repeat(30 * 1024)); // 30KB

      try {
        const result = await sendRequest('tools/call', {
          name: 'read_file',
          arguments: { path: testFile }
        });

        const content = JSON.parse(result.content[0].text);
        expect(content.success).toBe(false);
        expect(content.error.code).toBe('file_too_large');
        expect(content.error.suggestions).toBeDefined();
      } finally {
        await fs.unlink(testFile).catch(() => {});
      }
    });
  });

  describe('search_content tool', () => {
    it('should search by content pattern', async () => {
      const result = await sendRequest('tools/call', {
        name: 'search_content',
        arguments: {
          content_pattern: 'describe',
          directory: path.resolve(__dirname),
          extensions: ['.ts']
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.matches).toBeInstanceOf(Array);
      expect(content.search_type).toBe('content');
    });

    it('should handle errors with unified error format', async () => {
      const result = await sendRequest('tools/call', {
        name: 'search_content',
        arguments: {
          directory: '/nonexistent/path'
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toBeDefined();
      expect(content.error.suggestions).toBeInstanceOf(Array);
    });
  });

  describe('list_directory tool', () => {
    it('should list directory contents', async () => {
      const result = await sendRequest('tools/call', {
        name: 'list_directory',
        arguments: {
          path: path.resolve(__dirname),
          max_files: 5
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.files).toBeInstanceOf(Array);
      expect(content.directories).toBeInstanceOf(Array);
    });

    it('should reject relative paths', async () => {
      const result = await sendRequest('tools/call', {
        name: 'list_directory',
        arguments: {
          path: './relative/path'
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error.code).toBe('path_not_absolute');
    });
  });

  describe('edit_file tool', () => {
    let testFile: string;

    beforeEach(async () => {
      testFile = path.resolve(__dirname, '../../../test-edit.txt');
      await fs.writeFile(testFile, 'Hello World\nThis is a test file\n');
    });

    afterEach(async () => {
      await fs.unlink(testFile).catch(() => {});
    });

    it('should edit file with literal replacement', async () => {
      const result = await sendRequest('tools/call', {
        name: 'edit_file',
        arguments: {
          path: testFile,
          edits: [{
            type: 'literal',
            old_text: 'Hello World',
            new_text: 'Hello Universe'
          }]
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.changes_made).toBe(1);
      expect(content.diff_output).toContain('Hello Universe');
      expect(content.diff_output).not.toContain(testFile); // Path should not be in diff content
    });

    it('should handle pattern not found', async () => {
      const result = await sendRequest('tools/call', {
        name: 'edit_file',
        arguments: {
          path: testFile,
          edits: [{
            type: 'literal',
            old_text: 'Not Found',
            new_text: 'Replacement'
          }]
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error.code).toBe('pattern_not_found');
    });
  });

  describe('write_file tool', () => {
    const testFile = path.resolve(__dirname, '../../../test-write.txt');

    afterEach(async () => {
      await fs.unlink(testFile).catch(() => {});
    });

    it('should write file successfully', async () => {
      const result = await sendRequest('tools/call', {
        name: 'write_file',
        arguments: {
          path: testFile,
          content: 'Test content'
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.bytes_written).toBe(12);

      const fileContent = await fs.readFile(testFile, 'utf8');
      expect(fileContent).toBe('Test content');
    });
  });

  describe('file_info tool', () => {
    it('should get file information', async () => {
      const result = await sendRequest('tools/call', {
        name: 'file_info',
        arguments: {
          path: path.resolve(__dirname, '../../../package.json'),
          include_analysis: true
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.exists).toBe(true);
      expect(content.type).toBe('file');
      expect(content.file_info.size_bytes).toBeGreaterThan(0);
    });

    it('should handle non-existent files', async () => {
      const result = await sendRequest('tools/call', {
        name: 'file_info',
        arguments: {
          path: '/nonexistent/file.txt'
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error.code).toBe('file_not_found');
    });
  });
});
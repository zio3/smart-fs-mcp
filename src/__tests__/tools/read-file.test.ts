// src/__tests__/tools/read-file.test.ts

// 1. モックを最初に設定
jest.mock('fs/promises');
jest.mock('fs');
jest.mock('readline');
jest.mock('../../core/safety-controller.js');
jest.mock('../../core/file-analyzer.js');

// 2. インポート
import { readFile } from '../../tools/read-file.js';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as readline from 'readline';
import { SafetyController } from '../../core/safety-controller.js';
import { FileAnalyzer } from '../../core/file-analyzer.js';
import { jest } from '@jest/globals';

// 3. 型安全なモックの取得
const mockFs = jest.mocked(fs);
const mockReadline = jest.mocked(readline);
const mockSafety = {
  validateFileAccess: jest.fn(),
  checkSizeLimits: jest.fn(),
  enforceTimeout: jest.fn()
} as unknown as jest.Mocked<SafetyController>;
const mockAnalyzer = {
  analyzeFile: jest.fn(),
  generateStandardFileInfo: jest.fn()
} as unknown as jest.Mocked<FileAnalyzer>;

describe('read-file tool', () => {
  beforeEach(() => {
    // 4. 各テストの前にモックをリセット
    jest.clearAllMocks();
    
    // デフォルトの安全チェックは常に成功させる
    mockSafety.validateFileAccess.mockResolvedValue({ safe: true });
  });

  test('should read file successfully', async () => {
    // 5. このテスト専用のモック設定
    mockFs.readFile.mockResolvedValue('test content');
    mockFs.stat.mockResolvedValue({ size: 12, isFile: () => true } as any);
    mockAnalyzer.analyzeFile.mockResolvedValue({ isBinary: false } as any);
    mockAnalyzer.generateStandardFileInfo.mockResolvedValue({
      size_bytes: 12,
      total_lines: 1,
      estimated_tokens: 3,
      is_binary: false,
      encoding: 'utf8',
      file_type: 'text' as const,
      modified: new Date().toISOString(),
      created: new Date().toISOString()
    });
    
    const result = await readFile({ path: '/absolute/path/test.txt' }, mockSafety, mockAnalyzer);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.content).toBe('test content');
      expect(result.file_info).toBeDefined();
      expect(result.file_info.size_bytes).toBe(12);
    }
  });

  test('should return size_exceeded for large files', async () => {
    const largeFileSize = 2 * 1024 * 1024;
    mockFs.readFile.mockResolvedValue('a'.repeat(largeFileSize));
    mockFs.stat.mockResolvedValue({ size: largeFileSize, isFile: () => true } as any);
    mockAnalyzer.analyzeFile.mockResolvedValue({ 
      isBinary: false,
      size: largeFileSize,
      fileType: { category: 'text' },
      extension: '.txt',
      estimatedTokens: largeFileSize / 4
    } as any);
    
    // Make validateFileAccess return false for large files
    mockSafety.validateFileAccess.mockResolvedValue({ 
      safe: false, 
      reason: 'File size exceeds limit',
      violationType: 'SIZE_EXCEEDED',
      details: {
        fileSize: largeFileSize,
        sizeLimit: 1024 * 1024
      }
    });

    const result = await readFile({ path: './large.txt' }, mockSafety, mockAnalyzer);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('file_too_large');
    }
  });

  test('should handle file not found error', async () => {
    const error = new Error("ENOENT: no such file or directory, open './nonexistent.txt'");
    error.message = "ENOENT: no such file or directory, open './nonexistent.txt'";
    mockFs.stat.mockRejectedValue(error);
    mockSafety.validateFileAccess.mockResolvedValue({ safe: true });

    const result = await readFile({ path: './nonexistent.txt' }, mockSafety, mockAnalyzer);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('file_not_found');
    }
  });

  test('should return not_found when file does not exist', async () => {
    const error = new Error("ENOENT: no such file or directory, stat '/absolute/nonexistent.txt'");
    (error as any).code = 'ENOENT';
    mockFs.stat.mockRejectedValue(error);

    const result = await readFile({ path: '/absolute/nonexistent.txt' }, mockSafety, mockAnalyzer);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('file_not_found');
    }
  });

  describe('partial read functionality', () => {
    // Helper to create a mock readline interface
    const createMockReadline = (allLines: string[], _startLine: number = 1, endLine?: number) => {
      const events: { [key: string]: Function[] } = {};
      let currentLine = 0;
      
      const rl = {
        on: jest.fn((event: string, callback: Function) => {
          if (!events[event]) {
            events[event] = [];
          }
          events[event].push(callback);
          
          // Simulate async line reading
          if (event === 'line' && events['line']) {
            setTimeout(() => {
              for (const line of allLines) {
                currentLine++;
                // Emit line event
                events['line']?.forEach(cb => cb(line));
                
                // Check if we should stop
                if (endLine && currentLine >= endLine) {
                  rl.close();
                  break;
                }
              }
              // If no endLine specified, close after all lines
              if (!endLine) {
                rl.close();
              }
            }, 0);
          }
          
          return rl;
        }),
        close: jest.fn(() => {
          // Trigger close event
          if (events['close']) {
            setTimeout(() => {
              events['close']?.forEach(cb => cb());
            }, 0);
          }
        })
      };
      
      return rl;
    };

    beforeEach(() => {
      // Mock readline.createInterface
      const mockCreateReadStream = jest.fn();
      (createReadStream as jest.Mock) = mockCreateReadStream;
    });

    afterEach(() => {
      // Clear all mocks
      jest.clearAllMocks();
    });

    test('should read specific line range', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024, isFile: () => true } as any);
      mockSafety.validateFileAccess.mockResolvedValue({ safe: true });
      
      // Simulate readline for line counting and partial read
      const testLines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1} content`);
      let callCount = 0;
      
      (mockReadline.createInterface as jest.Mock).mockImplementation((_options: any) => {
        callCount++;
        
        // First call is for counting lines, subsequent calls for reading
        if (callCount === 1) {
          // Count lines - emit all lines
          return createMockReadline(testLines);
        } else {
          // Read specific range - but the actual filtering happens in readLineRange
          return createMockReadline(testLines);
        }
      }) as any;
      
      mockAnalyzer.generateStandardFileInfo.mockResolvedValue({
        size_bytes: 1024,
        total_lines: 10,
        estimated_tokens: 100,
        is_binary: false,
        encoding: 'utf8',
        file_type: 'text' as const,
        modified: new Date().toISOString(),
        created: new Date().toISOString()
      });
      
      const result = await readFile(
        { path: '/absolute/path/test.txt', start_line: 3, end_line: 5 },
        mockSafety,
        mockAnalyzer
      );
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.content).toBe('Line 3 content\nLine 4 content\nLine 5 content');
        expect(result.file_info).toEqual(expect.objectContaining({
          total_lines: 10,
          returned_lines: 3,
          line_range: { start: 3, end: 5 }
        }));
      }
    });

    test('should read from start line to end of file', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024, isFile: () => true } as any);
      mockSafety.validateFileAccess.mockResolvedValue({ safe: true });
      
      const testLines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1} content`);
      let callCount = 0;
      
      (mockReadline.createInterface as jest.Mock).mockImplementation((_options: any) => {
        callCount++;
        
        // First call is for counting lines, subsequent calls for reading
        if (callCount === 1) {
          return createMockReadline(testLines);
        } else {
          return createMockReadline(testLines);
        }
      }) as any;
      
      mockAnalyzer.generateStandardFileInfo.mockResolvedValue({
        size_bytes: 1024,
        total_lines: 10,
        estimated_tokens: 100,
        is_binary: false,
        encoding: 'utf8',
        file_type: 'text' as const,
        modified: new Date().toISOString(),
        created: new Date().toISOString()
      });
      
      const result = await readFile(
        { path: '/absolute/path/test.txt', start_line: 8 },
        mockSafety,
        mockAnalyzer
      );
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.content).toBe('Line 8 content\nLine 9 content\nLine 10 content');
        expect(result.file_info).toEqual(expect.objectContaining({
          total_lines: 10,
          returned_lines: 3,
          line_range: { start: 8, end: 10 }
        }));
      }
    });

    test('should return error for invalid line ranges', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024, isFile: () => true } as any);
      
      // Test start_line > end_line
      const result1 = await readFile(
        { path: './test.txt', start_line: 5, end_line: 3 },
        mockSafety,
        mockAnalyzer
      );
      
      expect(result1.success).toBe(false);
      if (!result1.success) {
        expect(result1.error.code).toBe('invalid_parameter');
        expect(result1.error.message).toContain('開始行番号は終了行番号以下');
      }
      
      // Test negative start_line
      const result2 = await readFile(
        { path: './test.txt', start_line: -1 },
        mockSafety,
        mockAnalyzer
      );
      
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.code).toBe('invalid_parameter');
        expect(result2.error.message).toContain('開始行番号は1以上');
      }
    });

    test('should suggest partial read for large files', async () => {
      const largeFileSize = 30 * 1024; // 30KB
      mockFs.stat.mockResolvedValue({ size: largeFileSize, isFile: () => true } as any);
      mockSafety.validateFileAccess.mockResolvedValue({ safe: true });
      mockAnalyzer.analyzeFile.mockResolvedValue({
        estimatedTokens: 5000,
        preview: {
          lines: ['First line', 'Second line', 'Third line'],
          first_lines: 'First line\nSecond line\nThird line',
          content_summary: 'Text file preview'
        }
      } as any);
      
      // Mock readline for counting lines
      (mockReadline.createInterface as jest.Mock).mockImplementation((_options: any) => {
        const testLines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
        return createMockReadline(testLines);
      }) as any;
      
      const result = await readFile({ path: '/absolute/path/large.txt' }, mockSafety, mockAnalyzer);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('file_too_large');
        expect(result.error.details.alternatives?.partial_read_available).toBe(true);
        expect(result.error.details.alternatives?.suggestions).toContain(
          'Use start_line and end_line parameters to read specific sections'
        );
      }
    });

    test('should include file_info for full file reads', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      mockFs.stat.mockResolvedValue({ size: content.length, isFile: () => true } as any);
      mockFs.readFile.mockResolvedValue(content);
      mockSafety.validateFileAccess.mockResolvedValue({ safe: true });
      
      mockAnalyzer.generateStandardFileInfo.mockResolvedValue({
        size_bytes: content.length,
        total_lines: 3,
        estimated_tokens: 6,
        is_binary: false,
        encoding: 'utf8',
        file_type: 'text' as const,
        modified: new Date().toISOString(),
        created: new Date().toISOString()
      });
      
      const result = await readFile({ path: '/absolute/path/test.txt' }, mockSafety, mockAnalyzer);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.content).toBe(content);
        expect(result.file_info).toEqual(expect.objectContaining({
          total_lines: 3,
          returned_lines: 3,
          line_range: { start: 1, end: 3 }
        }));
      }
    });
  });
});

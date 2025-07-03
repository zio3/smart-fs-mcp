// src/__tests__/tools/read-file.test.ts

// 1. モックを最初に設定
jest.mock('fs/promises');
jest.mock('../../core/safety-controller.js');
jest.mock('../../core/file-analyzer.js');

// 2. インポート
import { readFile } from '../../tools/read-file.js';
import * as fs from 'fs/promises';
import { SafetyController } from '../../core/safety-controller.js';
import { FileAnalyzer } from '../../core/file-analyzer.js';
import { jest } from '@jest/globals';

// 3. 型安全なモックの取得
const mockFs = jest.mocked(fs);
const mockSafety = {
  validateFileAccess: jest.fn(),
  checkSizeLimits: jest.fn(),
  enforceTimeout: jest.fn()
} as unknown as jest.Mocked<SafetyController>;
const mockAnalyzer = {
  analyzeFile: jest.fn()
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
    
    const result = await readFile({ path: './test.txt' }, mockSafety, mockAnalyzer);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.content).toBe('test content');
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
});

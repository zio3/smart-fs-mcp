// src/__tests__/tools/write-file.test.ts

jest.mock('fs/promises');
jest.mock('../../core/safety-controller.js');

import { writeFile } from '../../tools/write-file.js';
import * as fs from 'fs/promises';
import { SafetyController } from '../../core/safety-controller.js';
import { jest } from '@jest/globals';
import * as path from 'path';

const mockFs = jest.mocked(fs);
const mockSafety = {
  validateFileAccess: jest.fn(),
  validateDirectoryAccess: jest.fn(),
  checkSizeLimits: jest.fn(),
  enforceTimeout: jest.fn()
} as unknown as jest.Mocked<SafetyController>;

describe('write-file tool (unified)', () => {
  const absolutePath = path.resolve('/test/absolute/path/test.txt');
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockSafety.validateFileAccess.mockResolvedValue({ safe: true });
    mockSafety.validateDirectoryAccess.mockResolvedValue({ safe: true });
  });

  test('should write file successfully with absolute path', async () => {
    mockFs.writeFile.mockResolvedValue();
    mockFs.stat.mockRejectedValue(new Error('ENOENT')); // File doesn't exist yet
    mockFs.mkdir.mockResolvedValue(undefined);

    const result = await writeFile({ 
      path: absolutePath, 
      content: 'hello world' 
    }, mockSafety);

    expect(result.success).toBe(true);
    expect(mockFs.writeFile).toHaveBeenCalledWith(absolutePath, 'hello world', 'utf8');
  });

  test('should reject relative path with appropriate error', async () => {
    const result = await writeFile({ 
      path: './relative-test.txt', 
      content: 'hello world' 
    }, mockSafety);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('path_not_absolute');
      expect(result.error.message).toContain('絶対パスを指定してください');
      expect(result.error.details.path).toBe('./relative-test.txt');
      expect(result.error.suggestions).toHaveLength(2);
      expect(result.error.suggestions[0]).toContain('絶対パス');
    }
  });

  test('should reject content that is too large', async () => {
    const largeContent = 'x'.repeat(15 * 1024 * 1024); // 15MB content
    
    const result = await writeFile({ 
      path: absolutePath, 
      content: largeContent 
    }, mockSafety);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('content_too_large');
      expect(result.error.message).toContain('制限サイズを超えています');
      expect(result.error.suggestions).toHaveLength(2);
    }
  });

  test('should handle permission denied error', async () => {
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.stat.mockRejectedValue(new Error('ENOENT'));
    const permissionError = new Error('EACCES: permission denied');
    mockFs.writeFile.mockRejectedValue(permissionError);

    const result = await writeFile({ 
      path: absolutePath, 
      content: 'hello world' 
    }, mockSafety);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('access_denied');
      expect(result.error.message).toContain('アクセスが拒否されました');
      expect(result.error.suggestions.length).toBeGreaterThan(0);
    }
  });

  test('should handle directory creation failure', async () => {
    mockFs.stat.mockRejectedValue(new Error('ENOENT'));
    const mkdirError = new Error('EACCES: permission denied, mkdir');
    mockFs.mkdir.mockRejectedValue(mkdirError);

    const result = await writeFile({ 
      path: absolutePath, 
      content: 'hello world' 
    }, mockSafety);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('access_denied');
      expect(result.error.message).toContain('アクセスが拒否されました');
      // creation_error is filtered by security sanitization
      expect(result.error.suggestions.length).toBeGreaterThan(0);
    }
  });
});
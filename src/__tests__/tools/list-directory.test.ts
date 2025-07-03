// src/__tests__/tools/list-directory.test.ts

jest.mock('fs/promises');
jest.mock('../../core/safety-controller.js');

import { listDirectory } from '../../tools/list-directory.js';
import * as fs from 'fs/promises';
import { SafetyController } from '../../core/safety-controller.js';
import { jest } from '@jest/globals';

const mockFs = jest.mocked(fs);
const mockSafety = {
  validateFileAccess: jest.fn(),
  validateDirectoryAccess: jest.fn(),
  checkSizeLimits: jest.fn(),
  enforceTimeout: jest.fn()
} as unknown as jest.Mocked<SafetyController>;

describe('list-directory tool (LLM-optimized)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSafety.validateDirectoryAccess.mockResolvedValue({ safe: true });
  });

  test('should list files and directories correctly with absolute path', async () => {
    const mockFiles = [
      { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
      { name: 'sub-dir', isFile: () => false, isDirectory: () => true },
    ];
    mockFs.readdir.mockResolvedValue(mockFiles as any);
    mockFs.stat.mockImplementation(async (path) => {
      if (path.toString() === '/absolute/test/path') {
        // Directory itself should return isDirectory: true
        return { size: 0, mtime: new Date(), ctime: new Date(), atime: new Date(), isDirectory: () => true } as any;
      }
      if (path.toString().endsWith('file1.txt')) {
        return { size: 100, mtime: new Date(), ctime: new Date(), atime: new Date() } as any;
      }
      if (path.toString().endsWith('sub-dir')) {
        return { size: 0, mtime: new Date(), ctime: new Date(), atime: new Date(), isDirectory: () => true } as any;
      }
      throw new Error('File not found');
    });
    
    // Mock readdir for subdirectory
    const subDirFiles = [
      { name: 'subfile.txt', isFile: () => true, isDirectory: () => false }
    ];
    mockFs.readdir.mockImplementation(async (path) => {
      if (path.toString().endsWith('sub-dir')) {
        return subDirFiles as any;
      }
      return mockFiles as any;
    });
    
    // Mock enforceTimeout to return the promise result directly
    mockSafety.enforceTimeout.mockImplementation((promise) => promise);

    const result = await listDirectory({ path: '/absolute/test/path' }, mockSafety);

    expect(result.success).toBe(true);
    if ('files' in result) {
      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.name).toBe('file1.txt');
      expect(result.directories).toHaveLength(1);
      expect(result.directories[0]?.name).toBe('sub-dir');
      expect(result.summary.file_count).toBe(1);
      expect(result.summary.directory_count).toBe(1);
    }
  });

  test('should reject relative paths with breaking change error', async () => {
    const result = await listDirectory({ path: './relative/path' }, mockSafety);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('path_not_absolute');
      expect(result.error.message).toContain('絶対パスを指定してください');
      expect(result.error.suggestions.length).toBeGreaterThan(0);
      expect(result.error.suggestions[0]).toContain('絶対パス');
    }
  });
});
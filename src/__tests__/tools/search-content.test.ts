// src/__tests__/tools/search-content.test.ts

jest.mock('../../core/search-engine.js', () => ({
  searchByContent: jest.fn(),
  searchByFileName: jest.fn(),
  searchBoth: jest.fn(),
}));
jest.mock('../../core/safety-controller.js');

import { searchContent } from '../../tools/search-content.js';
import { SafetyController } from '../../core/safety-controller.js';
import * as searchEngine from '../../core/search-engine.js';
import { jest } from '@jest/globals';
import * as path from 'path';

const mockSearchByContent = jest.mocked(searchEngine.searchByContent);
const mockSearchByFileName = jest.mocked(searchEngine.searchByFileName);
const mockSearchBoth = jest.mocked(searchEngine.searchBoth);
const mockSafety = {
  validateFileAccess: jest.fn(),
  validateDirectoryAccess: jest.fn(),
  checkSizeLimits: jest.fn(),
  enforceTimeout: jest.fn()
} as unknown as jest.Mocked<SafetyController>;

describe('search-content tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSafety.validateDirectoryAccess.mockResolvedValue({ safe: true });
    // Mock enforceTimeout to return the promise result directly
    mockSafety.enforceTimeout.mockImplementation((promise) => promise);
  });

  test('should call searchByContent and return results', async () => {
    const mockSearchResults = [
      { 
        file_path: 'test.txt', 
        content_matches: 1, 
        content_preview: 'hello world', 
        file_size_bytes: 12, 
        last_modified: new Date().toISOString() 
      }
    ];
    mockSearchByContent.mockResolvedValue(mockSearchResults);

    const result = await searchContent({ 
      content_pattern: 'hello',
      directory: path.resolve('/test')
    }, mockSafety);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]?.file).toBe('test.txt');
      expect(result.search_type).toBe('content');
      expect(result.search_stats).toEqual({
        files_scanned: 1,
        files_with_matches: 1,
        total_matches: 1
      });
    }
    expect(mockSearchByContent).toHaveBeenCalledWith(
      path.resolve('/test'),
      'hello',
      expect.objectContaining({
        recursive: true,
        maxDepth: 10,
        caseSensitive: false,
        wholeWord: false
      })
    );
  });

  test('should handle file pattern search', async () => {
    const mockSearchResults = [
      { 
        file_path: '/test/file.test.ts', 
        filename_matches: 1,
        file_size_bytes: 100
      }
    ];
    mockSearchByFileName.mockResolvedValue(mockSearchResults);

    const result = await searchContent({ 
      file_pattern: '.*\\.test\\.ts$',
      directory: path.resolve('/test')
    }, mockSafety);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.search_type).toBe('filename');
      expect(mockSearchByFileName).toHaveBeenCalled();
    }
  });

  test('should handle combined search', async () => {
    const mockSearchResults = [
      { 
        file_path: '/test/test.ts', 
        filename_matches: 1,
        content_matches: 2,
        file_size_bytes: 200
      }
    ];
    mockSearchBoth.mockResolvedValue(mockSearchResults);

    const result = await searchContent({ 
      file_pattern: 'test',
      content_pattern: 'describe',
      directory: path.resolve('/test')
    }, mockSafety);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.search_type).toBe('both');
      expect(result.search_stats?.total_matches).toBe(3); // 1 + 2
      expect(mockSearchBoth).toHaveBeenCalled();
    }
  });

  test('should reject relative paths', async () => {
    const result = await searchContent({ 
      content_pattern: 'test',
      directory: './relative/path'
    }, mockSafety);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('path_not_absolute');
      expect(result.error.suggestions).toBeDefined();
      // Should have suggestions
      expect(result.error.suggestions.length).toBeGreaterThan(0);
    }
  });

  test('should handle no search patterns error', async () => {
    const result = await searchContent({ 
      directory: path.resolve('/test')
    }, mockSafety);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('invalid_regex');
      expect(result.error.message).toContain('No search patterns specified');
    }
  });

  test('should handle access denied', async () => {
    mockSafety.validateDirectoryAccess.mockResolvedValue({ 
      safe: false, 
      reason: 'Outside allowed directories' 
    });

    const result = await searchContent({ 
      content_pattern: 'test',
      directory: path.resolve('/test')
    }, mockSafety);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('access_denied');
    }
  });

  test('should handle no matches found', async () => {
    mockSearchByContent.mockResolvedValue([]);

    const result = await searchContent({ 
      content_pattern: 'nonexistent',
      directory: path.resolve('/test')
    }, mockSafety);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('pattern_not_found');
      expect(result.error.suggestions).toBeDefined();
      expect(result.error.suggestions.length).toBeGreaterThan(0);
    }
  });

  test('should apply proper defaults for optional parameters', async () => {
    mockSearchByContent.mockResolvedValue([]);

    await searchContent({ 
      content_pattern: 'test',
      directory: path.resolve('/test')
    }, mockSafety);

    expect(mockSearchByContent).toHaveBeenCalledWith(
      path.resolve('/test'),
      'test',
      expect.objectContaining({
        recursive: true,
        maxDepth: 10,
        excludeDirs: ['node_modules', '.git', 'dist', 'build', '.next'],
        caseSensitive: false,
        wholeWord: false,
        maxFiles: 100,
        maxMatchesPerFile: 10
      })
    );
  });

  test('should handle custom parameters correctly', async () => {
    mockSearchByContent.mockResolvedValue([]);

    await searchContent({ 
      content_pattern: 'test',
      directory: path.resolve('/test'),
      exclude_dirs: ['custom_dir'],
      case_sensitive: true,
      whole_word: true,
      max_depth: 5,
      max_files: 50,
      max_matches_per_file: 3
    }, mockSafety);

    expect(mockSearchByContent).toHaveBeenCalledWith(
      path.resolve('/test'),
      'test',
      expect.objectContaining({
        excludeDirs: ['custom_dir'],
        caseSensitive: true,
        wholeWord: true,
        maxDepth: 5,
        maxFiles: 50,
        maxMatchesPerFile: 3
      })
    );
  });
});
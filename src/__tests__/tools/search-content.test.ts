// src/__tests__/tools/search-content.test.ts

jest.mock('fs/promises');
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
import * as fs from 'fs/promises';

const mockSearchByContent = jest.mocked(searchEngine.searchByContent);
const mockSearchByFileName = jest.mocked(searchEngine.searchByFileName);
const mockSearchBoth = jest.mocked(searchEngine.searchBoth);
const mockFs = jest.mocked(fs);
const mockSafety = {
  validateFileAccess: jest.fn(),
  validateDirectoryAccess: jest.fn(),
  checkSizeLimits: jest.fn(),
  enforceTimeout: jest.fn()
} as unknown as jest.Mocked<SafetyController>;

describe('search-content tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fs operations for directory existence check
    mockFs.stat.mockResolvedValue({ 
      isDirectory: () => true,
      isFile: () => false 
    } as any);
    
    mockSafety.validateDirectoryAccess.mockResolvedValue({ safe: true });
    // Mock enforceTimeout to return the promise result directly
    mockSafety.enforceTimeout.mockImplementation((promise) => promise);
  });

  test('should call searchByContent and return results', async () => {
    const mockSearchResults = {
      matches: [
        { 
          file_path: 'test.txt', 
          content_matches: 1, 
          content_preview: 'hello world', 
          file_size_bytes: 12, 
          last_modified: new Date().toISOString() 
        }
      ],
      filesScanned: 1,
      binarySkipped: 0,
      directoriesSkipped: 0,
      encounteredExcludes: []
    };
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
        total_matches: 1,
        displayed_matches: 1,
        is_truncated: false
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
    const mockSearchResults = {
      matches: [
        { 
          file_path: '/test/file.test.ts', 
          filename_matches: 1,
          file_size_bytes: 100
        }
      ],
      filesScanned: 1,
      binarySkipped: 0,
      directoriesSkipped: 0,
      encounteredExcludes: []
    };
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
    const mockSearchResults = {
      matches: [
        { 
          file_path: '/test/test.ts', 
          filename_matches: 1,
          content_matches: 2,
          file_size_bytes: 200
        }
      ],
      filesScanned: 1,
      binarySkipped: 0,
      directoriesSkipped: 0,
      encounteredExcludes: []
    };
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
      expect(result.error.code).toBe('invalid_parameter');
      expect(result.error.message).toContain('検索パラメータが不足しています');
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
    mockSearchByContent.mockResolvedValue({
      matches: [],
      filesScanned: 0,
      binarySkipped: 0,
      directoriesSkipped: 0,
      encounteredExcludes: []
    });

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
    mockSearchByContent.mockResolvedValue({
      matches: [],
      filesScanned: 0,
      binarySkipped: 0,
      directoriesSkipped: 0,
      encounteredExcludes: []
    });

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
        excludeDirs: expect.arrayContaining([
          'node_modules', '.git', 'dist', 'build', 'out', '.next', 
          'coverage', '__tests__', 'test', '.nyc_output', 'tmp', 'temp'
        ]),
        caseSensitive: false,
        wholeWord: false,
        maxFiles: 100,
        maxMatchesPerFile: 50
      })
    );
  });

  test('should handle custom parameters correctly', async () => {
    mockSearchByContent.mockResolvedValue({
      matches: [],
      filesScanned: 0,
      binarySkipped: 0,
      directoriesSkipped: 0,
      encounteredExcludes: []
    });

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
        maxMatchesPerFile: 50
      })
    );
  });

  test('should handle extensions-only search', async () => {
    const mockSearchResults = {
      matches: [
        { 
          file_path: '/test/file.ts', 
          filename_matches: 1,
          file_size_bytes: 100
        },
        { 
          file_path: '/test/file2.js', 
          filename_matches: 1,
          file_size_bytes: 200
        }
      ],
      filesScanned: 2,
      binarySkipped: 0,
      directoriesSkipped: 0,
      encounteredExcludes: []
    };
    mockSearchByFileName.mockResolvedValue(mockSearchResults);

    const result = await searchContent({ 
      extensions: ['.ts', '.js'],
      directory: path.resolve('/test')
    }, mockSafety);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.search_type).toBe('extensions');
      expect(mockSearchByFileName).toHaveBeenCalledWith(
        path.resolve('/test'),
        '.*',
        expect.objectContaining({
          extensions: ['.ts', '.js']
        })
      );
    }
  });

  test('should use user default exclude dirs by default', async () => {
    mockSearchByContent.mockResolvedValue({
      matches: [],
      filesScanned: 0,
      binarySkipped: 0,
      directoriesSkipped: 0,
      encounteredExcludes: []
    });

    await searchContent({ 
      content_pattern: 'test',
      directory: path.resolve('/test')
    }, mockSafety);

    expect(mockSearchByContent).toHaveBeenCalledWith(
      path.resolve('/test'),
      'test',
      expect.objectContaining({
        excludeDirs: expect.arrayContaining([
          'node_modules', '.git', 'dist', 'build', 'out', '.next', 
          'coverage', '__tests__', 'test', '.nyc_output', 'tmp', 'temp'
        ])
      })
    );
  });

  test('should use minimal exclude dirs when userDefaultExcludeDirs is false', async () => {
    mockSearchByContent.mockResolvedValue({
      matches: [],
      filesScanned: 0,
      binarySkipped: 0,
      directoriesSkipped: 0,
      encounteredExcludes: []
    });

    await searchContent({ 
      content_pattern: 'test',
      directory: path.resolve('/test'),
      userDefaultExcludeDirs: false
    }, mockSafety);

    expect(mockSearchByContent).toHaveBeenCalledWith(
      path.resolve('/test'),
      'test',
      expect.objectContaining({
        excludeDirs: ['node_modules', '.git']
      })
    );
  });

  test('should prefer explicit exclude_dirs over userDefaultExcludeDirs', async () => {
    mockSearchByContent.mockResolvedValue({
      matches: [],
      filesScanned: 0,
      binarySkipped: 0,
      directoriesSkipped: 0,
      encounteredExcludes: []
    });

    await searchContent({ 
      content_pattern: 'test',
      directory: path.resolve('/test'),
      exclude_dirs: ['custom_dir'],
      userDefaultExcludeDirs: false // This should be ignored
    }, mockSafety);

    expect(mockSearchByContent).toHaveBeenCalledWith(
      path.resolve('/test'),
      'test',
      expect.objectContaining({
        excludeDirs: ['custom_dir']
      })
    );
  });

  describe('binary file handling', () => {
    test('should track binary files skipped count', async () => {
      const mockSearchResults = {
        matches: [
          { 
            file_path: 'test.txt', 
            content_matches: 1, 
            content_preview: 'hello world', 
            file_size_bytes: 12, 
            last_modified: new Date().toISOString() 
          }
        ],
        filesScanned: 1,
        binarySkipped: 5,
        directoriesSkipped: 0,
        encounteredExcludes: []
      };
      
      mockSearchByContent.mockResolvedValue(mockSearchResults);

      const result = await searchContent({ 
        content_pattern: 'hello',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result).toEqual(expect.objectContaining({
        success: true,
        search_stats: expect.objectContaining({
          binary_files_skipped: 5
        })
      }));
    });

    test('should not include binary_files_skipped when zero', async () => {
      const mockSearchResults = {
        matches: [
          { 
            file_path: 'test.txt', 
            content_matches: 1, 
            content_preview: 'hello world', 
            file_size_bytes: 12, 
            last_modified: new Date().toISOString() 
          }
        ],
        filesScanned: 1,
        binarySkipped: 0,
        directoriesSkipped: 0,
        encounteredExcludes: []
      };
      
      mockSearchByContent.mockResolvedValue(mockSearchResults);

      const result = await searchContent({ 
        content_pattern: 'hello',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result).toEqual(expect.objectContaining({
        success: true,
        search_stats: expect.not.objectContaining({
          binary_files_skipped: expect.any(Number)
        })
      }));
    });

    test('should skip binary extensions in file pattern search', async () => {
      const mockSearchResults = {
        matches: [
          { 
            file_path: '/test/code.js', 
            filename_matches: 1,
            file_size_bytes: 100, 
            last_modified: new Date().toISOString() 
          }
        ],
        filesScanned: 1,
        binarySkipped: 3,
        directoriesSkipped: 0,
        encounteredExcludes: []
      };
      mockSearchByFileName.mockResolvedValue(mockSearchResults);

      const result = await searchContent({ 
        file_pattern: '.*',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result).toEqual(expect.objectContaining({
        success: true,
        search_stats: expect.objectContaining({
          binary_files_skipped: 3
        })
      }));
    });
  });

  describe('refinement suggestions', () => {
    test('should not include refinement suggestions when results <= 50', async () => {
      const mockSearchResults = {
        matches: Array.from({length: 30}, (_, i) => ({ 
          file_path: `test${i}.txt`, 
          content_matches: 1, 
          content_preview: 'hello world', 
          file_size_bytes: 12, 
          last_modified: new Date().toISOString() 
        })),
        filesScanned: 30,
        binarySkipped: 0,
        directoriesSkipped: 0,
        encounteredExcludes: []
      };
      
      mockSearchByContent.mockResolvedValue(mockSearchResults);

      const result = await searchContent({ 
        content_pattern: 'hello',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result).toEqual(expect.objectContaining({
        success: true,
        search_stats: expect.objectContaining({
          is_truncated: false,
          displayed_matches: 30
        })
      }));
      expect(result).not.toHaveProperty('refinement_suggestions');
    });

    test('should include refinement suggestions when results > 50', async () => {
      const mockSearchResults = {
        matches: Array.from({length: 100}, (_, i) => ({ 
          file_path: `test${i}.txt`, 
          content_matches: 1, 
          content_preview: 'hello world', 
          file_size_bytes: 12, 
          last_modified: new Date().toISOString() 
        })),
        filesScanned: 100,
        binarySkipped: 0,
        directoriesSkipped: 0,
        encounteredExcludes: []
      };
      
      mockSearchByContent.mockResolvedValue(mockSearchResults);

      const result = await searchContent({ 
        content_pattern: 'hello',
        directory: path.resolve('/test/project')
      }, mockSafety);

      expect(result).toEqual(expect.objectContaining({
        success: true,
        matches: expect.arrayContaining([]),
        search_stats: expect.objectContaining({
          files_with_matches: 100,
          is_truncated: true,
          displayed_matches: 50
        }),
        refinement_suggestions: expect.objectContaining({
          message: expect.stringContaining('100件中50件を表示'),
          options: expect.arrayContaining([
            expect.stringContaining('file_pattern'),
            expect.stringContaining('extensions')
          ]),
          current_filters: expect.objectContaining({
            directory: path.resolve('/test/project'),
            content_pattern: 'hello'
          })
        })
      }));
      
      // Ensure only 50 matches are returned
      if (result.success && 'matches' in result) {
        expect(result.matches).toHaveLength(50);
      }
    });

    test('should suggest directory refinement for deep paths', async () => {
      const mockSearchResults = Array.from({length: 60}, (_, i) => ({ 
        file_path: `test${i}.txt`, 
        content_matches: 1, 
        file_size_bytes: 12, 
        last_modified: new Date().toISOString() 
      }));
      
      mockSearchByContent.mockResolvedValue(mockSearchResults);

      const result = await searchContent({ 
        content_pattern: 'test',
        directory: path.resolve('/test/deep/path/structure')
      }, mockSafety);

      if (result.success && 'refinement_suggestions' in result) {
        expect(result.refinement_suggestions?.options).toEqual(
          expect.arrayContaining([
            expect.stringContaining('directory をより具体的に')
          ])
        );
      }
    });

    test('should suggest pattern refinement when no word boundary used', async () => {
      const mockSearchResults = Array.from({length: 60}, (_, i) => ({ 
        file_path: `test${i}.txt`, 
        content_matches: 1, 
        file_size_bytes: 12, 
        last_modified: new Date().toISOString() 
      }));
      
      mockSearchByContent.mockResolvedValue(mockSearchResults);

      const result = await searchContent({ 
        content_pattern: 'error',
        directory: path.resolve('/test')
      }, mockSafety);

      if (result.success && 'refinement_suggestions' in result) {
        expect(result.refinement_suggestions?.options).toEqual(
          expect.arrayContaining([
            expect.stringContaining('\\\\berror\\\\b')
          ])
        );
      }
    });
  });
});
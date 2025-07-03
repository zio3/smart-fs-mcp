/**
 * Jest Test Setup for Smart Filesystem MCP
 * Global mocks and test utilities
 */

import { jest } from '@jest/globals';
import { SafetyController } from '../core/safety-controller.js';
import { FileAnalyzer } from '../core/file-analyzer.js';

// Increase test timeout for file operations
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidFilePath(): R;
      toHaveValidFileInfo(): R;
      toBeWithinSizeLimit(limit: number): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidFilePath(received: string) {
    const isValid = typeof received === 'string' && 
                   received.length > 0 && 
                   !received.includes('\0');
    
    return {
      message: () => `expected ${received} to be a valid file path`,
      pass: isValid,
    };
  },

  toHaveValidFileInfo(received: any) {
    const hasRequiredFields = received &&
                             typeof received.name === 'string' &&
                             typeof received.size === 'number' &&
                             typeof received.isFile === 'boolean';
    
    return {
      message: () => `expected ${JSON.stringify(received)} to have valid file info structure`,
      pass: hasRequiredFields,
    };
  },

  toBeWithinSizeLimit(received: number, limit: number) {
    const isWithinLimit = received <= limit;
    
    return {
      message: () => `expected ${received} to be within size limit of ${limit}`,
      pass: isWithinLimit,
    };
  },
});

// Test data factories
export class TestDataFactory {
  /**
   * Create mock file stats
   */
  static createMockStats(overrides: Partial<any> = {}) {
    return {
      isFile: () => true,
      isDirectory: () => false,
      isSymbolicLink: () => false,
      size: 1024,
      mtime: new Date('2024-01-01'),
      ctime: new Date('2024-01-01'),
      atime: new Date('2024-01-01'),
      mode: 0o644,
      ...overrides
    };
  }

  /**
   * Create mock directory stats
   */
  static createMockDirStats(overrides: Partial<any> = {}) {
    return {
      isFile: () => false,
      isDirectory: () => true,
      isSymbolicLink: () => false,
      size: 4096,
      mtime: new Date('2024-01-01'),
      ctime: new Date('2024-01-01'),
      atime: new Date('2024-01-01'),
      mode: 0o755,
      ...overrides
    };
  }

  /**
   * Create test file content
   */
  static createTestContent(type: 'small' | 'medium' | 'large' | 'binary' = 'small'): string {
    const contents = {
      small: 'Hello, World!\\nThis is a test file.\\n',
      medium: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\\n'.repeat(50),
      large: 'Large file content line.\\n'.repeat(10000),
      binary: '\\x00\\x01\\x02\\x03\\xFF\\xFE\\xFD'
    };
    
    return contents[type];
  }

  /**
   * Create mock search results
   */
  static createMockSearchResults(count: number = 3) {
    return Array.from({ length: count }, (_, i) => ({
      file_path: `/test/file${i + 1}.txt`,
      file_size_bytes: 1024 + i * 100,
      content_matches: i + 1,
      last_modified: new Date('2024-01-01').toISOString(),
      content_preview: `Match ${i + 1} preview`,
      match_context: [
        `line before match ${i + 1}`,
        `matching line ${i + 1}`,
        `line after match ${i + 1}`
      ]
    }));
  }
}

// Test instance helpers
export class TestInstanceFactory {
  /**
   * Create test safety controller
   */
  static createSafetyController(_allowedDirs: string[] = ['/test']): SafetyController {
    const safety = new SafetyController();
    // TODO: Configure allowed directories when API is available
    return safety;
  }

  /**
   * Create test file analyzer
   */
  static createFileAnalyzer(): FileAnalyzer {
    return new FileAnalyzer();
  }

  /**
   * Create test instances for tools
   */
  static createTestInstances() {
    return {
      safety: this.createSafetyController(),
      analyzer: this.createFileAnalyzer()
    };
  }
}

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Restore console after all tests
afterAll(() => {
  Object.assign(console, originalConsole);
});
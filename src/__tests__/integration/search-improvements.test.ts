/**
 * Integration tests for search improvements
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { searchContent } from '../../tools/search-content.js';
import { SafetyController } from '../../core/safety-controller.js';
import { initializeSecurityController } from '../../core/security-controller-v2.js';

describe('Search Improvements Integration', () => {
  const testDir = path.join(process.cwd(), 'test-search-improvements');
  const safety = new SafetyController();

  beforeAll(async () => {
    // Initialize security controller
    const tmpDir = path.resolve('/tmp');
    initializeSecurityController([tmpDir, testDir]);
    
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    
    // Create some test files
    await fs.writeFile(path.join(testDir, 'test1.ts'), 'export function test1() { return 1; }');
    await fs.writeFile(path.join(testDir, 'test2.ts'), 'export function test2() { return 2; }');
    await fs.writeFile(path.join(testDir, 'data.json'), '{"test": true}');
    
    // Create exclude directory
    await fs.mkdir(path.join(testDir, 'node_modules'), { recursive: true });
    await fs.writeFile(path.join(testDir, 'node_modules', 'test.js'), 'module.exports = {}');
  });

  afterAll(async () => {
    // Clean up
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('file_pattern only search should work', async () => {
    const result = await searchContent({
      file_pattern: '.*\\.ts$',
      directory: testDir
    }, safety);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.search_type).toBe('filename');
      expect(result.matches).toHaveLength(2);
      expect(result.matches.map(m => path.basename(m.file)).sort()).toEqual(['test1.ts', 'test2.ts']);
    }
  });

  test('should track excluded directories', async () => {
    const result = await searchContent({
      content_pattern: 'test',
      directory: testDir
    }, safety);

    expect(result.success).toBe(true);
    if (result.success && result.exclude_info) {
      expect(result.exclude_info.excluded_dirs_found).toBeDefined();
      expect(result.exclude_info.excluded_dirs_found.length).toBeGreaterThan(0);
      
      const nodeModulesExcluded = result.exclude_info.excluded_dirs_found.find(
        (dir: any) => dir.path.includes('node_modules')
      );
      expect(nodeModulesExcluded).toBeDefined();
      expect(nodeModulesExcluded?.reason).toBe('performance');
    }
  });

  test('should show directories skipped count', async () => {
    const result = await searchContent({
      content_pattern: 'test',
      directory: testDir
    }, safety);

    expect(result.success).toBe(true);
    if (result.success && result.search_stats) {
      expect(result.search_stats.directories_skipped).toBeDefined();
      expect(result.search_stats.directories_skipped).toBeGreaterThan(0);
    }
  });
});
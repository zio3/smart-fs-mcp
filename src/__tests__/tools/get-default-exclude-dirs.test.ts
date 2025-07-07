// src/__tests__/tools/get-default-exclude-dirs.test.ts

import { getDefaultExcludeDirs } from '../../tools/get-default-exclude-dirs.js';

describe('get-default-exclude-dirs tool', () => {
  test('should return user default exclude directories by default', async () => {
    const result = await getDefaultExcludeDirs({});

    expect(result.success).toBe(true);
    expect(result.type).toBe('user_default');
    expect(result.description).toBe('開発者向けに最適化された除外ディレクトリ一覧');
    expect(result.excludeDirs).toEqual([
      "node_modules",
      ".git", 
      "dist",
      "build",
      "out",
      ".next", 
      "coverage",
      "__tests__",
      "test",
      ".nyc_output",
      "tmp",
      "temp"
    ]);
  });

  test('should return minimal exclude directories when userDefaultExcludeDirs is false', async () => {
    const result = await getDefaultExcludeDirs({ userDefaultExcludeDirs: false });

    expect(result.success).toBe(true);
    expect(result.type).toBe('minimal');
    expect(result.description).toBe('セキュリティ上必要な最小限の除外ディレクトリ');
    expect(result.excludeDirs).toEqual([
      "node_modules",
      ".git"
    ]);
  });

  test('should handle undefined params', async () => {
    const result = await getDefaultExcludeDirs(undefined as any);

    expect(result.success).toBe(true);
    expect(result.type).toBe('user_default');
  });
});
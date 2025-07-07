/**
 * search_content のマッチ文字列取得テスト
 */

import { searchContent } from '../../tools/search-content.js';
import { SafetyController } from '../../core/safety-controller.js';
import * as searchEngine from '../../core/search-engine.js';
import { jest } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs/promises';

jest.mock('fs/promises');
jest.mock('../../core/search-engine.js', () => ({
  searchByContent: jest.fn(),
  searchByFileName: jest.fn(),
  searchBoth: jest.fn(),
}));
jest.mock('../../core/safety-controller.js');

const mockSearchByContent = jest.mocked(searchEngine.searchByContent);
const mockFs = jest.mocked(fs);
const mockSafety = {
  validateDirectoryAccess: jest.fn(),
  enforceTimeout: jest.fn()
} as unknown as jest.Mocked<SafetyController>;

describe.skip('search-content match string extraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fs operations for directory existence check
    mockFs.stat.mockResolvedValue({ 
      isDirectory: () => true,
      isFile: () => false 
    } as any);
    
    mockSafety.validateDirectoryAccess.mockResolvedValue({ safe: true });
    mockSafety.enforceTimeout.mockImplementation((promise) => promise);
  });

  describe('正確なマッチ文字列の取得', () => {
    test('日本語文字列の正確な取得', async () => {
      const mockResults = {
        matches: [{
          file_path: '/test/test.txt',
          content_matches: 1,
          match_context: ['Line 2: 日本語テスト'],
          // 修正後: 実際のマッチ文字列を含むプロパティ
          matchedStrings: ['日本語'],
          lineMatches: [{ content: 'Line 2: 日本語テスト', lineNo: 2 }]
        }],
        filesScanned: 1,
        binarySkipped: 0,
        directoriesSkipped: 0,
        encounteredExcludes: []
      };
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: '日本語',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.lines).toBeDefined();
        expect(result.matches[0]?.lines?.[0]).toEqual({ content: 'Line 2: 日本語テスト', lineNo: 2 });
      }
    });

    test('英語文字列の正確な取得', async () => {
      const mockResults = {
        matches: [{
          file_path: '/test/test.txt',
          content_matches: 2,
          match_context: ['This is a test file', 'This test is important'],
          matchedStrings: ['This', 'This'],
          lineMatches: [
            { content: 'This is a test file', lineNo: 1 },
            { content: 'This test is important', lineNo: 2 }
          ]
        }],
        filesScanned: 1,
        binarySkipped: 0,
        directoriesSkipped: 0,
        encounteredExcludes: []
      };
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'This',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        // lineMatches が正しく変換されていることを確認
        expect(result.matches[0]?.lines).toBeDefined();
        expect(result.matches[0]?.lines?.[0]).toEqual({ content: 'This is a test file', lineNo: 1 });
        expect(result.matches[0]?.lines?.[1]).toEqual({ content: 'This test is important', lineNo: 2 });
        expect(result.matches[0]?.matchCount).toBe(2);
      }
    });

    test('複数の異なるマッチ文字列', async () => {
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 3,
        match_context: ['test and Testing and TEST'],
        matchedStrings: ['test', 'Testing', 'TEST'],
        lineMatches: [{ content: 'test and Testing and TEST', lineNo: 1 }]
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'test',
        case_sensitive: false,
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.lines).toBeDefined();
        expect(result.matches[0]?.lines?.[0]).toEqual({ content: 'test and Testing and TEST', lineNo: 1 });
        expect(result.matches[0]?.lines?.length).toBe(1);
      }
    });

    test('正規表現パターンでのマッチ', async () => {
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 3,
        match_context: ['Numbers: 123, 456, 789'],
        matchedStrings: ['123', '456', '789'],
        lineMatches: [{ content: 'Numbers: 123, 456, 789', lineNo: 1 }]
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: '\\d+',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.lines).toBeDefined();
        expect(result.matches[0]?.lines?.[0]).toEqual({ content: 'Numbers: 123, 456, 789', lineNo: 1 });
      }
    });

    test('特殊文字のマッチ', async () => {
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 3,
        match_context: ['Special chars: @#$%^&*()'],
        matchedStrings: ['#', '$', '%'],
        lineMatches: [{ content: 'Special chars: @#$%^&*()', lineNo: 1 }]
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: '[#$%]',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.lines).toBeDefined();
        expect(result.matches[0]?.lines?.[0]).toEqual({ content: 'Special chars: @#$%^&*()', lineNo: 1 });
      }
    });

    test('重複文字列の除去', async () => {
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 3,
        match_context: ['Number 123 and 456 and 123 again'],
        matchedStrings: ['123', '456', '123'],
        lineMatches: [{ content: 'Number 123 and 456 and 123 again', lineNo: 1 }]
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: '\\d+',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.lines).toBeDefined();
        expect(result.matches[0]?.lines?.[0]).toEqual({ content: 'Number 123 and 456 and 123 again', lineNo: 1 });
        expect(result.matches[0]?.lines?.length).toBe(1);
        expect(result.matches[0]?.matchCount).toBe(3); // 実際のマッチ数は3
      }
    });
  });

  describe('境界値テスト', () => {
    test('空のマッチ', async () => {
      const mockResults: any[] = [];  // 空の結果配列
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'nonexistent',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(false);
    });

    test('非常に長いマッチ文字列', async () => {
      const longString = 'a'.repeat(1000);
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 1,
        match_context: [`prefix ${longString} suffix`],
        matchedStrings: [longString],
        lineMatches: [{ content: `prefix ${longString} suffix`, lineNo: 1 }]
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'a+',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.lines?.[0]).toEqual({ content: `prefix ${longString} suffix`, lineNo: 1 });
      }
    });
  });

  describe('単語単位抽出の特殊ケース', () => {
    test('関数定義内の部分マッチで関数名全体を取得', async () => {
      const mockResults = [{
        file_path: '/test/test.js',
        content_matches: 1,
        match_context: ['void hogeFunc() { return "gef"; }'],
        matchedStrings: ['hogeFunc'],  // 'gef'にマッチしたが、hogeFuncが抽出される
        lineMatches: [{ content: 'void hogeFunc() { return "gef"; }', lineNo: 1 }]
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'gef',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.lines).toBeDefined();
        expect(result.matches[0]?.lines?.[0]).toEqual({ content: 'void hogeFunc() { return "gef"; }', lineNo: 1 });
      }
    });

    test('ハイフン付き単語の抽出', async () => {
      const mockResults = [{
        file_path: '/test/test.css',
        content_matches: 1,
        match_context: ['void hoge-hage-one aa bb'],
        matchedStrings: ['hoge-hage-one'],  // 'hage'にマッチしたが、全体が抽出される
        lineMatches: [{ content: 'void hoge-hage-one aa bb', lineNo: 1 }]
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'hage',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.lines).toBeDefined();
        expect(result.matches[0]?.lines?.[0]).toEqual({ content: 'void hoge-hage-one aa bb', lineNo: 1 });
      }
    });

    test('長い単語の省略処理', async () => {
      const longWord = 'very' + 'Long'.repeat(20) + 'Word';  // 84文字
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 1,
        match_context: [`prefix ${longWord} suffix`],
        matchedStrings: ['...ongLongLongLongLongWord'],  // 省略された形
        lineMatches: [{ content: `prefix ${longWord} suffix`, lineNo: 1 }]
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'Long',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.lines?.[0]).toBeDefined();
        // Line matches should include the full line
      }
    });

    test('日本語の単語境界', async () => {
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 2,
        match_context: ['これは日本語のテストです。日本語を検索します。'],
        matchedStrings: ['日本語', '日本語'],  // 両方の「日本語」が抽出される
        lineMatches: [{ content: 'これは日本語のテストです。日本語を検索します。', lineNo: 1 }]
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: '日本',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.lines).toBeDefined();
        expect(result.matches[0]?.lines?.[0]).toEqual({ content: 'これは日本語のテストです。日本語を検索します。', lineNo: 1 });
      }
    });
  });

  describe('後方互換性テスト', () => {
    test('matched_stringsプロパティがない場合のフォールバック', async () => {
      // 古い形式のレスポンス（matched_stringsなし）
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 1,
        match_context: ['function testFunction() { return "test"; }'],
        lineMatches: [{ content: 'function testFunction() { return "test"; }', lineNo: 1 }]
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'test',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        // フォールバック動作の確認
        expect(result.matches[0]?.lines).toBeDefined();
        expect(Array.isArray(result.matches[0]?.lines)).toBe(true);
      }
    });
  });

  describe('行番号対応テスト', () => {
    test('50件以下のマッチは全件表示', async () => {
      const lineMatches = [];
      for (let i = 1; i <= 15; i++) {
        lineMatches.push({ content: `Line ${i}: match found here`, lineNo: i });
      }
      
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 15,
        match_context: lineMatches.map(m => m.content),
        matchedStrings: Array(15).fill('match'),
        lineMatches: lineMatches
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'match',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.lines).toBeDefined();
        expect(result.matches[0]?.lines?.length).toBe(15); // All 15 lines are displayed (under 50 limit)
        
        // All lines should be LineMatch objects
        for (let i = 0; i < 15; i++) {
          const line = result.matches[0]?.lines?.[i];
          expect(line).toHaveProperty('content');
          expect(line).toHaveProperty('lineNo');
          expect((line as any).content).toBe(`Line ${i + 1}: match found here`);
          expect((line as any).lineNo).toBe(i + 1);
        }
      }
    });

    test('ファイルサイズが取得できる', async () => {
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 1,
        match_context: ['test content'],
        matchedStrings: ['test'],
        lineMatches: [{ content: 'test content', lineNo: 1 }],
        file_size_bytes: 12345
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'test',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.fileSize).toBe(12345);
      }
    });

    test('詳細結果と簡略結果のカウント', async () => {
      const mockResults = [];
      for (let i = 1; i <= 25; i++) {
        mockResults.push({
          file_path: `/test/file${i}.txt`,
          content_matches: 1,
          match_context: [`Match in file ${i}`],
          matchedStrings: ['match'],
          lineMatches: [{ content: `Match in file ${i}`, lineNo: 1 }]
        });
      }
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'match',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches.length).toBe(25);
        
        // All matches should have lines info (no more simplified results)
        for (let i = 0; i < 25; i++) {
          if (mockResults[i]?.lineMatches) {
            expect(result.matches[i]?.lines).toBeDefined();
          }
        }
      }
    });
  });
});
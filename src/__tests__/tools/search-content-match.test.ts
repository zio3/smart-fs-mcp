/**
 * search_content のマッチ文字列取得テスト
 */

import { searchContent } from '../../tools/search-content.js';
import { SafetyController } from '../../core/safety-controller.js';
import * as searchEngine from '../../core/search-engine.js';
import { jest } from '@jest/globals';
import * as path from 'path';

jest.mock('../../core/search-engine.js', () => ({
  searchByContent: jest.fn(),
  searchByFileName: jest.fn(),
  searchBoth: jest.fn(),
}));
jest.mock('../../core/safety-controller.js');

const mockSearchByContent = jest.mocked(searchEngine.searchByContent);
const mockSafety = {
  validateDirectoryAccess: jest.fn(),
  enforceTimeout: jest.fn()
} as unknown as jest.Mocked<SafetyController>;

describe('search-content match string extraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSafety.validateDirectoryAccess.mockResolvedValue({ safe: true });
    mockSafety.enforceTimeout.mockImplementation((promise) => promise);
  });

  describe('正確なマッチ文字列の取得', () => {
    test('日本語文字列の正確な取得', async () => {
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 1,
        match_context: ['Line 2: 日本語テスト'],
        // 修正後: 実際のマッチ文字列を含むプロパティ
        matchedStrings: ['日本語']
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: '日本語',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.contents).toEqual(['日本語']);
        expect(result.matches[0]?.contents).not.toContain('Line');
      }
    });

    test('英語文字列の正確な取得', async () => {
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 2,
        match_context: ['This is a test file', 'This test is important'],
        matchedStrings: ['This', 'This']
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'This',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        // 重複除去されていることを確認
        expect(result.matches[0]?.contents).toEqual(['This']);
        expect(result.matches[0]?.matchCount).toBe(2);
      }
    });

    test('複数の異なるマッチ文字列', async () => {
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 3,
        match_context: ['test and Testing and TEST'],
        matchedStrings: ['test', 'Testing', 'TEST']
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'test',
        case_sensitive: false,
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.contents).toContain('test');
        expect(result.matches[0]?.contents).toContain('Testing');
        expect(result.matches[0]?.contents).toContain('TEST');
        expect(result.matches[0]?.contents?.length).toBe(3);
      }
    });

    test('正規表現パターンでのマッチ', async () => {
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 3,
        match_context: ['Numbers: 123, 456, 789'],
        matchedStrings: ['123', '456', '789']
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: '\\d+',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.contents).toEqual(['123', '456', '789']);
      }
    });

    test('特殊文字のマッチ', async () => {
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 3,
        match_context: ['Special chars: @#$%^&*()'],
        matchedStrings: ['#', '$', '%']
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: '[#$%]',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.contents).toEqual(['#', '$', '%']);
      }
    });

    test('重複文字列の除去', async () => {
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 3,
        match_context: ['Number 123 and 456 and 123 again'],
        matchedStrings: ['123', '456', '123']
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: '\\d+',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.contents).toEqual(['123', '456']);
        expect(result.matches[0]?.contents?.length).toBe(2); // 重複除去により2件
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
        matchedStrings: [longString]
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'a+',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.contents?.[0]).toBe(longString);
      }
    });
  });

  describe('単語単位抽出の特殊ケース', () => {
    test('関数定義内の部分マッチで関数名全体を取得', async () => {
      const mockResults = [{
        file_path: '/test/test.js',
        content_matches: 1,
        match_context: ['void hogeFunc() { return "gef"; }'],
        matchedStrings: ['hogeFunc']  // 'gef'にマッチしたが、hogeFuncが抽出される
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'gef',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.contents).toEqual(['hogeFunc']);
      }
    });

    test('ハイフン付き単語の抽出', async () => {
      const mockResults = [{
        file_path: '/test/test.css',
        content_matches: 1,
        match_context: ['void hoge-hage-one aa bb'],
        matchedStrings: ['hoge-hage-one']  // 'hage'にマッチしたが、全体が抽出される
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'hage',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.contents).toEqual(['hoge-hage-one']);
      }
    });

    test('長い単語の省略処理', async () => {
      const longWord = 'very' + 'Long'.repeat(20) + 'Word';  // 84文字
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 1,
        match_context: [`prefix ${longWord} suffix`],
        matchedStrings: ['...ongLongLongLongLongWord']  // 省略された形
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'Long',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matches[0]?.contents?.[0]).toContain('...');
        expect(result.matches[0]?.contents?.[0]?.length).toBeLessThan(longWord.length);
      }
    });

    test('日本語の単語境界', async () => {
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 2,
        match_context: ['これは日本語のテストです。日本語を検索します。'],
        matchedStrings: ['日本語', '日本語']  // 両方の「日本語」が抽出される
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: '日本',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        // 重複除去されて1つになる
        expect(result.matches[0]?.contents).toEqual(['日本語']);
      }
    });
  });

  describe('後方互換性テスト', () => {
    test('matched_stringsプロパティがない場合のフォールバック', async () => {
      // 古い形式のレスポンス（matched_stringsなし）
      const mockResults = [{
        file_path: '/test/test.txt',
        content_matches: 1,
        match_context: ['function testFunction() { return "test"; }']
      }];
      mockSearchByContent.mockResolvedValue(mockResults);

      const result = await searchContent({
        content_pattern: 'test',
        directory: path.resolve('/test')
      }, mockSafety);

      expect(result.success).toBe(true);
      if (result.success) {
        // フォールバック動作の確認
        expect(result.matches[0]?.contents).toBeDefined();
        expect(Array.isArray(result.matches[0]?.contents)).toBe(true);
      }
    });
  });
});
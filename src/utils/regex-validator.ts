/**
 * Smart Filesystem MCP - Regex Validator
 * 正規表現の検証とセキュリティチェック
 */

/**
 * 正規表現パターンの最大長
 */
const MAX_PATTERN_LENGTH = 1000;

/**
 * ReDoS（正規表現DoS）攻撃のリスクがあるパターン
 */
// const DANGEROUS_PATTERNS = [
//   /(.*a){x,}\d/,           // 指数的バックトラッキング
//   /([a-zA-Z]+)*$/,         // ネストした量指定子
//   /(a+)+$/,                // 重複した量指定子
//   /(.*){x,}$/,             // 非効率な繰り返し
// ];

/**
 * 正規表現パターンを検証
 */
export function validateRegexPattern(pattern: string): { valid: boolean; error?: string } {
  // 長さチェック
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return {
      valid: false,
      error: `Pattern too long (${pattern.length} chars). Maximum allowed: ${MAX_PATTERN_LENGTH}`
    };
  }

  // 空パターンチェック
  if (!pattern || pattern.trim().length === 0) {
    return {
      valid: false,
      error: 'Pattern cannot be empty'
    };
  }

  // 正規表現として有効かチェック
  try {
    new RegExp(pattern);
  } catch (error) {
    return {
      valid: false,
      error: `Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }

  // ReDoSリスクのあるパターンをチェック
  if (hasReDoSRisk(pattern)) {
    return {
      valid: false,
      error: 'Pattern may cause performance issues (ReDoS risk detected)'
    };
  }

  return { valid: true };
}

/**
 * ReDoSリスクの簡易チェック
 */
function hasReDoSRisk(pattern: string): boolean {
  // 危険なパターンの特徴をチェック
  const riskIndicators = [
    /(\(.*\))\+\+/,          // (グループ)++
    /(\(.*\))\*\*/,          // (グループ)**
    /(\(.*\))\{\d+,\}\+/,    // (グループ){n,}+
    /\.\*.*\.\*/,            // 複数の.*
    /(\[[^\]]+\])\+\+/,      // [文字クラス]++
  ];

  for (const indicator of riskIndicators) {
    if (indicator.test(pattern)) {
      return true;
    }
  }

  // ネストした量指定子のチェック
  const quantifiers = pattern.match(/[*+?{]/g);
  if (quantifiers && quantifiers.length > 5) {
    // 量指定子が多すぎる場合は注意
    return true;
  }

  return false;
}

/**
 * 検索パターンを作成（大文字小文字、単語境界の処理）
 */
export function createSearchRegex(
  pattern: string,
  caseSensitive: boolean = false,
  wholeWord: boolean = false
): RegExp {
  let finalPattern = pattern;

  // 単語境界の追加
  if (wholeWord) {
    finalPattern = `\\b${finalPattern}\\b`;
  }

  // フラグの設定
  const flags = caseSensitive ? 'g' : 'gi';

  return new RegExp(finalPattern, flags);
}

/**
 * ファイルパス用の正規表現を作成（プラットフォーム差異を吸収）
 */
export function createFilePathRegex(pattern: string, caseSensitive: boolean = false): RegExp {
  // Windowsのバックスラッシュをエスケープ
  let normalizedPattern = pattern.replace(/\\/g, '[\\\\/]');
  
  // パス区切り文字を柔軟にマッチ
  normalizedPattern = normalizedPattern.replace(/\//g, '[\\\\/]');

  const flags = caseSensitive ? 'g' : 'gi';
  return new RegExp(normalizedPattern, flags);
}

/**
 * 正規表現実行のタイムアウト付きラッパー
 */
export async function executeRegexWithTimeout(
  regex: RegExp,
  text: string,
  timeoutMs: number = 1000
): Promise<{ matches: RegExpMatchArray | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    // const startTime = Date.now();
    let timedOut = false;

    // タイムアウト設定
    const timer = setTimeout(() => {
      timedOut = true;
      resolve({ matches: null, timedOut: true });
    }, timeoutMs);

    // 非同期で実行
    setImmediate(() => {
      if (!timedOut) {
        try {
          const matches = text.match(regex);
          clearTimeout(timer);
          resolve({ matches, timedOut: false });
        } catch (error) {
          clearTimeout(timer);
          resolve({ matches: null, timedOut: false });
        }
      }
    });
  });
}

/**
 * 行単位でのマッチとコンテキスト取得
 */
export function findMatchesWithContext(
  lines: string[],
  regex: RegExp,
  contextLines: number = 1,
  maxMatches: number = 50
): Array<{ lineNumber: number; line: string; context: string[] }> {
  const results: Array<{ lineNumber: number; line: string; context: string[] }> = [];
  
  for (let i = 0; i < lines.length && results.length < maxMatches; i++) {
    const currentLine = lines[i];
    if (currentLine && regex.test(currentLine)) {
      const context: string[] = [];
      
      // 前のコンテキスト行
      for (let j = Math.max(0, i - contextLines); j < i; j++) {
        const contextLine = lines[j];
        if (contextLine) context.push(contextLine);
      }
      
      // マッチした行
      if (currentLine) context.push(currentLine);
      
      // 後のコンテキスト行
      for (let j = i + 1; j <= Math.min(lines.length - 1, i + contextLines); j++) {
        const contextLine = lines[j];
        if (contextLine) context.push(contextLine);
      }
      
      results.push({
        lineNumber: i + 1,
        line: currentLine || '',
        context
      });
      
      // グローバルフラグをリセット
      regex.lastIndex = 0;
    }
  }
  
  return results;
}

/**
 * エスケープが必要な正規表現特殊文字
 */
const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

/**
 * 文字列を正規表現用にエスケープ
 */
export function escapeRegex(str: string): string {
  return str.replace(REGEX_SPECIAL_CHARS, '\\$&');
}
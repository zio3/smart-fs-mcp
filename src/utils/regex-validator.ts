/**
 * Smart Filesystem MCP - Regex Validator
 * 正規表現の検証とセキュリティチェック
 */

/**
 * 正規表現パターンの最大長
 */
const MAX_PATTERN_LENGTH = 1000;

/**
 * 実用的なコード検索パターンの許可リスト
 */
const SAFE_COMMON_PATTERNS = [
  'function\\s+\\w+\\s*\\([^)]*\\)\\s*\\{',  // JavaScript/TypeScript関数
  'class\\s+\\w+\\s*\\{',                    // クラス定義
  'import\\s+.*\\s+from\\s+["\'].*["\']',    // import文
  'export\\s+(default\\s+)?\\w+',            // export文
  'const\\s+\\w+\\s*=',                      // const宣言
  'let\\s+\\w+\\s*=',                        // let宣言
  'var\\s+\\w+\\s*=',                        // var宣言
  'interface\\s+\\w+\\s*\\{',                // TypeScriptインターフェース
  'type\\s+\\w+\\s*=',                       // TypeScript型定義
  'async\\s+function\\s+\\w+',               // async関数
  '\\bawait\\s+\\w+',                        // await式
];

/**
 * 代替パターンの提案マップ
 */
const PATTERN_SUGGESTIONS: Record<string, string> = {
  'function\\s+\\w+\\s*\\([^)]*\\)\\s*\\{': 'function\\s+\\w+',
  'class\\s+\\w+\\s*extends\\s+\\w+\\s*\\{': 'class\\s+\\w+.*extends',
  'import\\s+\\{[^}]*\\}\\s+from': 'import.*from',
};

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

  // 許可リストのパターンかチェック
  if (isInSafePatternList(pattern)) {
    return { valid: true };
  }

  // ReDoSリスクのあるパターンをチェック
  if (hasReDoSRisk(pattern)) {
    const suggestion = getSuggestionForPattern(pattern);
    return {
      valid: false,
      error: suggestion 
        ? `Pattern may cause performance issues (ReDoS risk detected). Try: ${suggestion}`
        : 'Pattern may cause performance issues (ReDoS risk detected)'
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
 * パターンが許可リストに含まれているかチェック
 */
function isInSafePatternList(pattern: string): boolean {
  return SAFE_COMMON_PATTERNS.includes(pattern);
}

/**
 * パターンに対する代替案を取得
 */
function getSuggestionForPattern(pattern: string): string | undefined {
  // 直接マッチする提案を探す
  if (PATTERN_SUGGESTIONS[pattern]) {
    return PATTERN_SUGGESTIONS[pattern];
  }
  
  // 部分的に似ているパターンの提案を探す
  for (const [risky, safe] of Object.entries(PATTERN_SUGGESTIONS)) {
    if (pattern.includes(risky.substring(0, 10))) {
      return safe;
    }
  }
  
  return undefined;
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
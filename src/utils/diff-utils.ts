/**
 * Smart Filesystem MCP - Diff Utilities
 * Git形式のdiff生成とフォーマット検出
 */

/**
 * インデント情報
 */
export interface IndentInfo {
  style: 'tab' | 'space';
  size: number;
  mixed_indentation: boolean;
}

/**
 * ホワイトスペースオプション
 */
export interface WhitespaceOptions {
  remove_trailing_spaces: boolean;
  normalize_line_endings: boolean;
  preserve_indentation: boolean;
}

/**
 * Hunk情報
 */
interface Hunk {
  oldStart: number;
  oldLength: number;
  newStart: number;
  newLength: number;
  lines: string[];
}

/**
 * LCS (Longest Common Subsequence) を使用した差分検出
 */
function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const lcs: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }
  
  return lcs;
}

/**
 * LCSを使用してdiffを生成
 */
function generateDiffFromLCS(a: string[], b: string[], lcs: number[][]): Array<{type: '+' | '-' | ' ', line: string}> {
  const diff: Array<{type: '+' | '-' | ' ', line: string}> = [];
  let i = a.length;
  let j = b.length;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      diff.unshift({type: ' ', line: a[i - 1]});
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      diff.unshift({type: '+', line: b[j - 1]});
      j--;
    } else if (i > 0) {
      diff.unshift({type: '-', line: a[i - 1]});
      i--;
    }
  }
  
  return diff;
}

/**
 * Git形式のdiffを生成（改善版）
 */
export function generateGitStyleDiff(original: string, modified: string, filename?: string): string {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  // 空ファイルの特殊ケース
  if (originalLines.length === 0 && modifiedLines.length === 0) {
    return '';
  }
  
  // LCSを計算
  const lcs = computeLCS(originalLines, modifiedLines);
  const diff = generateDiffFromLCS(originalLines, modifiedLines, lcs);
  
  // diffをhunkに分割
  const hunks: Hunk[] = [];
  const contextSize = 3;
  let currentHunk: Hunk | null = null;
  
  for (let i = 0; i < diff.length; i++) {
    const line = diff[i];
    
    if (line.type !== ' ') {
      // 変更行の場合
      if (!currentHunk) {
        // 新しいhunkを開始
        const startContext = Math.max(0, i - contextSize);
        currentHunk = {
          oldStart: 0,
          oldLength: 0,
          newStart: 0,
          newLength: 0,
          lines: []
        };
        
        // 前のコンテキストを追加
        for (let j = startContext; j < i; j++) {
          if (diff[j].type === ' ') {
            currentHunk.lines.push(' ' + diff[j].line);
          }
        }
      }
      
      // 現在の行を追加
      currentHunk.lines.push(line.type + line.line);
      
    } else {
      // コンテキスト行の場合
      if (currentHunk) {
        // 後続のコンテキストを追加
        currentHunk.lines.push(' ' + line.line);
        
        // コンテキストが十分になったらhunkを終了
        let contextCount = 0;
        for (let j = currentHunk.lines.length - 1; j >= 0; j--) {
          if (currentHunk.lines[j][0] === ' ') {
            contextCount++;
          } else {
            break;
          }
        }
        
        if (contextCount >= contextSize) {
          // 行番号を計算
          let oldLine = 1;
          let newLine = 1;
          for (let j = 0; j < i - currentHunk.lines.length + 1; j++) {
            if (diff[j].type !== '+') oldLine++;
            if (diff[j].type !== '-') newLine++;
          }
          
          currentHunk.oldStart = oldLine;
          currentHunk.newStart = newLine;
          
          // hunk内の行数を計算
          for (const hunkLine of currentHunk.lines) {
            if (hunkLine[0] !== '+') currentHunk.oldLength++;
            if (hunkLine[0] !== '-') currentHunk.newLength++;
          }
          
          hunks.push(currentHunk);
          currentHunk = null;
        }
      }
    }
  }
  
  // 最後のhunkを処理
  if (currentHunk) {
    // 行番号を計算
    let oldLine = 1;
    let newLine = 1;
    for (let j = 0; j < diff.length - currentHunk.lines.length; j++) {
      if (diff[j].type !== '+') oldLine++;
      if (diff[j].type !== '-') newLine++;
    }
    
    currentHunk.oldStart = oldLine;
    currentHunk.newStart = newLine;
    
    // hunk内の行数を計算
    for (const hunkLine of currentHunk.lines) {
      if (hunkLine[0] !== '+') currentHunk.oldLength++;
      if (hunkLine[0] !== '-') currentHunk.newLength++;
    }
    
    hunks.push(currentHunk);
  }
  
  // diffを組み立て
  if (hunks.length === 0) {
    return '';
  }
  
  const diffHeader = filename ? 
    `--- a/${filename}\n+++ b/${filename}` : 
    '--- original\n+++ modified';
  
  const hunkStrings = hunks.map(hunk => {
    const header = `@@ -${hunk.oldStart},${hunk.oldLength} +${hunk.newStart},${hunk.newLength} @@`;
    return header + '\n' + hunk.lines.join('\n');
  });
  
  return diffHeader + '\n' + hunkStrings.join('\n');
}

/**
 * インデントを検出
 */
export function detectIndentation(content: string): IndentInfo {
  const lines = content.split('\n');
  let spaceCount = 0;
  let tabCount = 0;
  const spaceSizes: Map<number, number> = new Map();
  
  for (const line of lines) {
    if (line.trim() === '') continue;
    
    const leadingWhitespace = line.match(/^[\s\t]+/);
    if (!leadingWhitespace) continue;
    
    const leading = leadingWhitespace[0];
    
    // タブをカウント
    const tabs = (leading.match(/\t/g) || []).length;
    if (tabs > 0) {
      tabCount++;
    }
    
    // スペースをカウント
    const spaces = (leading.match(/ /g) || []).length;
    if (spaces > 0 && tabs === 0) {
      spaceCount++;
      // インデントレベルを推測
      if (spaces % 2 === 0) {
        spaceSizes.set(2, (spaceSizes.get(2) || 0) + 1);
      }
      if (spaces % 4 === 0) {
        spaceSizes.set(4, (spaceSizes.get(4) || 0) + 1);
      }
    }
  }
  
  // 最も一般的なインデントスタイルを判定
  const style = tabCount > spaceCount ? 'tab' : 'space';
  let size = 2; // デフォルト
  
  if (style === 'space') {
    // 最も頻繁に使用されるスペースサイズを検出
    let maxCount = 0;
    for (const [indentSize, count] of spaceSizes) {
      if (count > maxCount) {
        maxCount = count;
        size = indentSize;
      }
    }
  }
  
  return {
    style,
    size,
    mixed_indentation: tabCount > 0 && spaceCount > 0
  };
}

/**
 * ホワイトスペースを正規化
 */
export function normalizeWhitespace(content: string, options: WhitespaceOptions): {
  content: string;
  trailing_removed: number;
} {
  let normalizedContent = content;
  let trailingRemoved = 0;
  
  if (options.remove_trailing_spaces) {
    const lines = normalizedContent.split('\n');
    const processedLines = lines.map(line => {
      const trimmed = line.trimEnd();
      if (trimmed.length < line.length) {
        trailingRemoved++;
      }
      return trimmed;
    });
    normalizedContent = processedLines.join('\n');
  }
  
  if (options.normalize_line_endings) {
    // CRLFをLFに統一
    normalizedContent = normalizedContent.replace(/\r\n/g, '\n');
    // 単独のCRもLFに変換
    normalizedContent = normalizedContent.replace(/\r/g, '\n');
  }
  
  return {
    content: normalizedContent,
    trailing_removed: trailingRemoved
  };
}

/**
 * Git diff形式のパッチを適用
 */
export function applyGitDiff(original: string, diffContent: string): {
  content: string;
  success: boolean;
  hunks_applied: number;
  error?: string;
} {
  try {
    const lines = original.split('\n');
    const diffLines = diffContent.split('\n');
    let diffIndex = 0;
    let hunksApplied = 0;
    
    // diffヘッダーをスキップ
    while (diffIndex < diffLines.length && !diffLines[diffIndex].startsWith('@@')) {
      diffIndex++;
    }
    
    // 各hunkを処理
    while (diffIndex < diffLines.length) {
      if (!diffLines[diffIndex].startsWith('@@')) {
        diffIndex++;
        continue;
      }
      
      // hunkヘッダーを解析
      const hunkHeader = diffLines[diffIndex];
      const match = hunkHeader.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
      if (!match) {
        return {
          content: original,
          success: false,
          hunks_applied: hunksApplied,
          error: 'Invalid hunk header format'
        };
      }
      
      const origStart = parseInt(match[1]) - 1; // 0-indexed
      const origLength = parseInt(match[2]);
      diffIndex++;
      
      // hunk内容を収集
      const removals: number[] = [];
      const additions: string[] = [];
      let contextCount = 0;
      
      while (diffIndex < diffLines.length && diffLines[diffIndex].length > 0) {
        const line = diffLines[diffIndex];
        const prefix = line[0];
        const content = line.substring(1);
        
        if (prefix === '-') {
          removals.push(origStart + contextCount + removals.length);
        } else if (prefix === '+') {
          additions.push(content);
        } else if (prefix === ' ') {
          contextCount++;
        } else if (line.startsWith('@@')) {
          // 次のhunkの開始
          break;
        }
        
        diffIndex++;
      }
      
      // パッチを適用（逆順で削除してインデックスのずれを防ぐ）
      for (let i = removals.length - 1; i >= 0; i--) {
        const lineIndex = removals[i];
        if (lineIndex < lines.length) {
          lines.splice(lineIndex, 1);
        }
      }
      
      // 追加行を挿入
      if (additions.length > 0) {
        const insertIndex = origStart + contextCount;
        lines.splice(insertIndex, 0, ...additions);
      }
      
      hunksApplied++;
    }
    
    return {
      content: lines.join('\n'),
      success: true,
      hunks_applied: hunksApplied
    };
    
  } catch (error) {
    return {
      content: original,
      success: false,
      hunks_applied: 0,
      error: error instanceof Error ? error.message : 'Unknown error applying diff'
    };
  }
}

/**
 * 行末の改行コードを検出
 */
export function detectLineEnding(content: string): 'lf' | 'crlf' | 'mixed' {
  const crlfCount = (content.match(/\r\n/g) || []).length;
  const lfCount = (content.match(/(?<!\r)\n/g) || []).length;
  
  if (crlfCount > 0 && lfCount === 0) {
    return 'crlf';
  } else if (lfCount > 0 && crlfCount === 0) {
    return 'lf';
  } else if (crlfCount > 0 && lfCount > 0) {
    return 'mixed';
  }
  
  // デフォルトはLF
  return 'lf';
}
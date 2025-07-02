/**
 * Smart Filesystem MCP - Edit File Tool
 * ファイル編集ツール（literal/regex/diff対応）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SafetyController } from '../core/safety-controller.js';
import { FileAnalyzer } from '../core/file-analyzer.js';
import { SAFETY_LIMITS } from '../utils/constants.js';
import { validateRegexPattern, executeRegexWithTimeout } from '../utils/regex-validator.js';
import { 
  generateGitStyleDiff,
  detectIndentation,
  normalizeWhitespace,
  applyGitDiff,
  detectLineEnding
} from '../utils/diff-utils.js';
import type { 
  EditFileParams,
  EditFileResult,
  EditDetails,
  EditOperation,
  LiteralEdit,
  RegexEdit,
  DiffEdit,
  FormattingInfo
} from '../core/types.js';

/**
 * ファイル編集メインツール
 */
export async function editFile(
  params: EditFileParams,
  safety: SafetyController,
  analyzer: FileAnalyzer
): Promise<EditFileResult> {
  try {
    // パラメータ検証
    if (!params.path) {
      throw new Error('File path is required');
    }
    
    if (!params.edits || params.edits.length === 0) {
      throw new Error('At least one edit operation is required');
    }
    
    if (params.edits.length > SAFETY_LIMITS.EDIT_MAX_OPERATIONS) {
      throw new Error(`Too many edit operations (${params.edits.length} > ${SAFETY_LIMITS.EDIT_MAX_OPERATIONS})`);
    }
    
    // パスの正規化
    const normalizedPath = path.normalize(params.path);
    
    // ファイルアクセスチェック
    const accessCheck = await safety.validateFileAccess(normalizedPath);
    if (!accessCheck.safe) {
      throw new Error(`File access denied: ${accessCheck.reason}`);
    }
    
    // ファイルサイズチェック
    const stats = await fs.stat(normalizedPath);
    if (stats.size > SAFETY_LIMITS.EDIT_MAX_FILE_SIZE) {
      throw new Error(
        `File too large for editing (${(stats.size / 1024 / 1024).toFixed(2)}MB > ${SAFETY_LIMITS.EDIT_MAX_FILE_SIZE / 1024 / 1024}MB)`
      );
    }
    
    // ファイル内容読み込み
    let content = await fs.readFile(normalizedPath, 'utf8');
    const originalContent = content;
    
    // 編集タイプの統計
    const regexEditCount = params.edits.filter(edit => edit.type === 'regex').length;
    const diffEditCount = params.edits.filter(edit => edit.type === 'diff').length;
    
    // フォーマット検出
    const indentInfo = detectIndentation(originalContent);
    const lineEnding = detectLineEnding(originalContent);
    const preserveFormatting = params.preserve_formatting ?? true;
    
    // 編集実行
    const editDetails: EditDetails[] = [];
    let successfulEdits = 0;
    let failedEdits = 0;
    let hasWarnings = false;
    const warnings: string[] = [];
    let modifiedContent = content;
    
    // 各編集を適用（dry_runでも実行して結果を確認）
    for (let i = 0; i < params.edits.length; i++) {
      const edit = params.edits[i];
      const editResult = await applyEdit(modifiedContent, edit, i);
      
      editDetails.push(editResult.details);
      
      if (editResult.details.status === 'success') {
        successfulEdits++;
        modifiedContent = editResult.newContent;
      } else if (editResult.details.status === 'multiple_matches') {
        hasWarnings = true;
        if (editResult.details.match_count! >= SAFETY_LIMITS.EDIT_WARNING_MATCHES) {
          warnings.push(`Edit ${i}: Large number of matches (${editResult.details.match_count})`);
        }
        successfulEdits++;
        modifiedContent = editResult.newContent;
      } else {
        failedEdits++;
      }
    }
    
    // フォーマット保持とホワイトスペース正規化
    let finalContent = modifiedContent;
    let trailingRemoved = 0;
    
    if (preserveFormatting && modifiedContent !== originalContent) {
      // ホワイトスペース正規化
      const normalizeResult = normalizeWhitespace(modifiedContent, {
        remove_trailing_spaces: true,
        normalize_line_endings: lineEnding !== 'mixed',
        preserve_indentation: true
      });
      finalContent = normalizeResult.content;
      trailingRemoved = normalizeResult.trailing_removed;
    }
    
    // 変更された行数をカウント
    const originalLines = originalContent.split('\n');
    const modifiedLines = finalContent.split('\n');
    const linesChanged = originalLines.filter((line, i) => i >= modifiedLines.length || line !== modifiedLines[i]).length +
                        Math.max(0, modifiedLines.length - originalLines.length);
    
    // diff出力を生成（dry_runまたは変更がある場合）
    let diffOutput: string | undefined;
    if (params.dry_run || finalContent !== originalContent) {
      diffOutput = generateGitStyleDiff(originalContent, finalContent, path.basename(normalizedPath));
    }
    
    // dry_runでない場合はファイルに書き込み
    if (!params.dry_run && finalContent !== originalContent) {
      await fs.writeFile(normalizedPath, finalContent, 'utf8');
    }
    
    // 結果生成
    const result: EditFileResult = {
      status: hasWarnings ? 'warning' : 'success',
      edit_summary: {
        total_edits: params.edits.length,
        successful_edits,
        failed_edits,
        regex_edits_count: regexEditCount,
        diff_edits_count: diffEditCount,
        lines_changed: linesChanged,
        formatting_applied: preserveFormatting && trailingRemoved > 0
      },
      edit_details: editDetails
    };
    
    // diff出力を追加
    if (diffOutput) {
      result.diff_output = diffOutput;
    }
    
    // フォーマット情報を追加
    if (preserveFormatting && finalContent !== originalContent) {
      result.formatting_info = {
        indent_style: indentInfo.style,
        indent_size: indentInfo.size,
        line_ending: lineEnding === 'crlf' ? 'crlf' : 'lf',
        trailing_whitespace_removed: trailingRemoved
      };
    }
    
    // 警告情報の追加
    if (hasWarnings) {
      const problematicEdits = editDetails.filter(
        d => d.status === 'multiple_matches' || d.status === 'failed'
      ).length;
      
      result.issue_details = {
        reason: 'Some edits may have unexpected results',
        problematic_edits: problematicEdits,
        risk_assessment: getRiskAssessment(editDetails)
      };
      
      result.alternatives = {
        safer_approaches: getSaferApproaches(editDetails),
        suggestions: [
          'Review sample_matches to ensure all changes are intended',
          'Use more specific patterns to avoid unintended matches',
          'Consider using literal edits for precise control',
          'Split complex regex patterns into multiple simpler ones'
        ]
      };
    }
    
    return result;
    
  } catch (error) {
    // エラーレスポンス
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      status: 'error',
      edit_summary: {
        total_edits: params.edits?.length || 0,
        successful_edits: 0,
        failed_edits: params.edits?.length || 0,
        regex_edits_count: params.edits?.filter(e => e.type === 'regex').length || 0
      },
      issue_details: {
        reason: errorMessage,
        problematic_edits: params.edits?.length || 0,
        risk_assessment: 'Operation failed'
      },
      alternatives: {
        safer_approaches: [],
        suggestions: getErrorSuggestions(errorMessage)
      }
    };
  }
}

/**
 * 単一の編集操作を適用
 */
async function applyEdit(
  content: string,
  edit: EditOperation,
  editIndex: number
): Promise<{ details: EditDetails; newContent: string }> {
  if (edit.type === 'literal') {
    return applyLiteralEdit(content, edit as LiteralEdit, editIndex);
  } else if (edit.type === 'regex') {
    return applyRegexEdit(content, edit as RegexEdit, editIndex);
  } else if (edit.type === 'diff') {
    return applyDiffEdit(content, edit as DiffEdit, editIndex);
  } else {
    throw new Error(`Unknown edit type: ${(edit as any).type}`);
  }
}

/**
 * リテラル編集の適用
 */
function applyLiteralEdit(
  content: string,
  edit: LiteralEdit,
  editIndex: number
): { details: EditDetails; newContent: string } {
  const occurrences = content.split(edit.old_text).length - 1;
  
  if (occurrences === 0) {
    return {
      details: {
        edit_index: editIndex,
        type: 'literal',
        status: 'no_match',
        old_text_or_pattern: edit.old_text,
        new_text_or_replacement: edit.new_text,
        match_count: 0
      },
      newContent: content
    };
  }
  
  const newContent = content.split(edit.old_text).join(edit.new_text);
  
  return {
    details: {
      edit_index: editIndex,
      type: 'literal',
      status: occurrences > 1 ? 'multiple_matches' : 'success',
      old_text_or_pattern: edit.old_text,
      new_text_or_replacement: edit.new_text,
      match_count: occurrences,
      sample_matches: occurrences > 1 ? getSampleMatches(content, edit.old_text, 3) : undefined
    },
    newContent
  };
}

/**
 * 正規表現編集の適用
 */
async function applyRegexEdit(
  content: string,
  edit: RegexEdit,
  editIndex: number
): Promise<{ details: EditDetails; newContent: string }> {
  // 正規表現パターン検証
  const validation = validateRegexPattern(edit.pattern);
  if (!validation.valid) {
    return {
      details: {
        edit_index: editIndex,
        type: 'regex',
        status: 'failed',
        old_text_or_pattern: edit.pattern,
        new_text_or_replacement: edit.replacement,
        match_count: 0,
        sample_matches: [`Invalid regex: ${validation.error}`]
      },
      newContent: content
    };
  }
  
  try {
    // 正規表現作成
    const flags = edit.flags || 'g';
    const regex = new RegExp(edit.pattern, flags);
    
    // マッチ検索（タイムアウト付き）
    const matchResult = await executeRegexWithTimeout(
      regex,
      content,
      SAFETY_LIMITS.EDIT_REGEX_TIMEOUT
    );
    
    if (matchResult.timedOut) {
      return {
        details: {
          edit_index: editIndex,
          type: 'regex',
          status: 'failed',
          old_text_or_pattern: edit.pattern,
          new_text_or_replacement: edit.replacement,
          match_count: 0,
          sample_matches: ['Regex execution timed out']
        },
        newContent: content
      };
    }
    
    const matches = matchResult.matches;
    if (!matches || matches.length === 0) {
      return {
        details: {
          edit_index: editIndex,
          type: 'regex',
          status: 'no_match',
          old_text_or_pattern: edit.pattern,
          new_text_or_replacement: edit.replacement,
          match_count: 0
        },
        newContent: content
      };
    }
    
    // サンプルマッチ生成
    const sampleMatches = getRegexSampleMatches(content, regex, 3);
    
    // 置換実行
    const newContent = content.replace(regex, edit.replacement);
    
    return {
      details: {
        edit_index: editIndex,
        type: 'regex',
        status: matches.length > 1 ? 'multiple_matches' : 'success',
        old_text_or_pattern: edit.pattern,
        new_text_or_replacement: edit.replacement,
        match_count: matches.length,
        sample_matches: matches.length > 1 ? sampleMatches : undefined
      },
      newContent
    };
    
  } catch (error) {
    return {
      details: {
        edit_index: editIndex,
        type: 'regex',
        status: 'failed',
        old_text_or_pattern: edit.pattern,
        new_text_or_replacement: edit.replacement,
        match_count: 0,
        sample_matches: [`Regex error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      },
      newContent: content
    };
  }
}

/**
 * リテラル編集のサンプルマッチ取得
 */
function getSampleMatches(content: string, searchText: string, maxSamples: number): string[] {
  const samples: string[] = [];
  const lines = content.split('\n');
  let foundCount = 0;
  
  for (let i = 0; i < lines.length && foundCount < maxSamples; i++) {
    if (lines[i].includes(searchText)) {
      samples.push(`Line ${i + 1}: ${lines[i].trim()}`);
      foundCount++;
    }
  }
  
  return samples;
}

/**
 * 正規表現編集のサンプルマッチ取得
 */
function getRegexSampleMatches(content: string, regex: RegExp, maxSamples: number): string[] {
  const samples: string[] = [];
  const lines = content.split('\n');
  let foundCount = 0;
  
  // グローバルフラグを一時的に削除
  const testRegex = new RegExp(regex.source, regex.flags.replace('g', ''));
  
  for (let i = 0; i < lines.length && foundCount < maxSamples; i++) {
    if (testRegex.test(lines[i])) {
      samples.push(`Line ${i + 1}: ${lines[i].trim()}`);
      foundCount++;
    }
  }
  
  return samples;
}

/**
 * リスク評価の生成
 */
function getRiskAssessment(editDetails: EditDetails[]): string {
  const multipleMatchEdits = editDetails.filter(d => d.status === 'multiple_matches');
  const regexEdits = editDetails.filter(d => d.type === 'regex');
  const totalMatches = editDetails.reduce((sum, d) => sum + (d.match_count || 0), 0);
  
  if (multipleMatchEdits.length > 0) {
    const maxMatches = Math.max(...multipleMatchEdits.map(d => d.match_count || 0));
    if (maxMatches > 50) {
      return 'High risk: Large number of replacements may have unintended consequences';
    } else if (maxMatches > 10) {
      return 'Medium risk: Multiple replacements detected, review carefully';
    }
  }
  
  if (regexEdits.length > 3) {
    return 'Medium risk: Multiple regex patterns increase complexity';
  }
  
  if (totalMatches > 100) {
    return 'High risk: Large total number of changes';
  }
  
  return 'Low risk: Changes appear straightforward';
}

/**
 * より安全なアプローチの提案
 */
function getSaferApproaches(editDetails: EditDetails[]): string[] {
  const approaches: string[] = [];
  
  const multipleMatchRegex = editDetails.filter(
    d => d.type === 'regex' && d.status === 'multiple_matches'
  );
  
  if (multipleMatchRegex.length > 0) {
    approaches.push(
      'Add word boundaries (\\b) to regex patterns for exact matches',
      'Use more specific patterns with context (e.g., "^\\s*console\\.log" for line start)',
      'Add negative lookahead/lookbehind to exclude unwanted matches'
    );
  }
  
  const highMatchCounts = editDetails.filter(d => (d.match_count || 0) > 20);
  if (highMatchCounts.length > 0) {
    approaches.push(
      'Split into multiple targeted edits for different contexts',
      'Use search_files first to identify specific locations',
      'Consider manual review for files with many matches'
    );
  }
  
  return approaches;
}

/**
 * エラーに基づく提案生成
 */
function getErrorSuggestions(errorMessage: string): string[] {
  const suggestions: string[] = [];
  
  if (errorMessage.includes('EACCES') || errorMessage.includes('Permission denied')) {
    suggestions.push(
      'Check file permissions',
      'Ensure the file is not locked by another process',
      'Try copying the file first with move_file'
    );
  } else if (errorMessage.includes('ENOENT')) {
    suggestions.push(
      'Verify the file path exists',
      'Use list_directory to check available files',
      'Check for typos in the path'
    );
  } else if (errorMessage.includes('too large')) {
    suggestions.push(
      'Split the file into smaller parts',
      'Use search_files to find specific sections',
      'Consider using a stream-based editor'
    );
  } else if (errorMessage.includes('Invalid regex')) {
    suggestions.push(
      'Escape special regex characters',
      'Test regex pattern separately',
      'Use literal edit for exact string replacement'
    );
  } else if (errorMessage.includes('diff')) {
    suggestions.push(
      'Verify the diff format is correct',
      'Check that the diff matches the current file content',
      'Try using literal or regex edits instead'
    );
  } else {
    suggestions.push(
      'Check the file path and permissions',
      'Verify edit syntax is correct',
      'Try a simpler edit first'
    );
  }
  
  return suggestions;
}

/**
 * Diff編集の適用
 */
function applyDiffEdit(
  content: string,
  edit: DiffEdit,
  editIndex: number
): { details: EditDetails; newContent: string } {
  try {
    // Git diff形式のパッチを適用
    const result = applyGitDiff(content, edit.diff_content);
    
    if (!result.success) {
      return {
        details: {
          edit_index: editIndex,
          type: 'diff',
          status: 'failed',
          old_text_or_pattern: 'diff patch',
          new_text_or_replacement: 'applied changes',
          match_count: 0,
          sample_matches: [`Failed to apply diff: ${result.error}`]
        },
        newContent: content
      };
    }
    
    // ベースバージョンチェック（オプション）
    if (edit.base_version_check && result.content === content) {
      return {
        details: {
          edit_index: editIndex,
          type: 'diff',
          status: 'no_match',
          old_text_or_pattern: 'diff patch',
          new_text_or_replacement: 'no changes',
          match_count: 0,
          sample_matches: ['Diff resulted in no changes']
        },
        newContent: content
      };
    }
    
    return {
      details: {
        edit_index: editIndex,
        type: 'diff',
        status: 'success',
        old_text_or_pattern: 'diff patch',
        new_text_or_replacement: `${result.hunks_applied} hunks applied`,
        match_count: result.hunks_applied,
        diff_hunks: result.hunks_applied
      },
      newContent: result.content
    };
    
  } catch (error) {
    return {
      details: {
        edit_index: editIndex,
        type: 'diff',
        status: 'failed',
        old_text_or_pattern: 'diff patch',
        new_text_or_replacement: 'error',
        match_count: 0,
        sample_matches: [`Diff error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      },
      newContent: content
    };
  }
}
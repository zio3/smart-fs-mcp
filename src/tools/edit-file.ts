/**
 * Smart Filesystem MCP - Edit File Tool
 * ファイル編集ツール（literal/regex/diff対応）
 */

import * as fs from 'fs/promises';
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
  EditDetails,
  EditOperation,
  SimpleEdit,
  LiteralEdit,
  RegexEdit,
  DiffEdit,
  FormattingInfo
} from '../core/types.js';
import { createUnifiedError, createUnifiedErrorFromException, ErrorCodes, UnifiedError } from '../utils/unified-error-handler.js';

/**
 * Edit file success response
 */
interface EditFileSuccess {
  success: true;
  changes_made: number;
  diff_output: string;
  edit_summary: {
    total_edits: number;
    successful_edits: number;
    failed_edits: number;
    lines_changed: number;
  };
  edit_details: EditDetails[];
  formatting_info: FormattingInfo;
  message?: string;
}


/**
 * Edit file response type
 */
type EditFileResponse = EditFileSuccess | UnifiedError;

/**
 * ファイル編集メインツール（LLM最適化版）
 */
export async function editFile(
  params: EditFileParams,
  safety: SafetyController,
  _analyzer?: FileAnalyzer
): Promise<EditFileResponse> {
  const warnings: string[] = [];
  const editDetails: EditDetails[] = [];

  try {
    // パラメータ検証
    if (!params.path) {
      return createUnifiedError(ErrorCodes.INVALID_PATH, 'edit_file', { path: params.path });
    }
    
    if (!params.edits || !Array.isArray(params.edits) || params.edits.length === 0) {
      return createUnifiedError(ErrorCodes.OPERATION_FAILED, 'edit_file', { path: params.path }, 'At least one edit operation is required');
    }
    
    // Check if file exists first
    try {
      await fs.stat(params.path);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return createUnifiedError(ErrorCodes.FILE_NOT_FOUND, 'edit_file', { path: params.path });
      }
    }
    
    // ファイルアクセスチェック
    const accessCheck = await safety.validateFileAccess(params.path, 'read');
    if (!accessCheck.safe) {
      return createUnifiedError(ErrorCodes.ACCESS_DENIED, 'edit_file', { path: params.path }, `ファイルアクセスが拒否されました: ${accessCheck.reason}`);
    }
    
    let content: string;
    try {
      // ファイル読み込み
      content = await fs.readFile(params.path, 'utf8');
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return createUnifiedError(ErrorCodes.FILE_NOT_FOUND, 'edit_file', { path: params.path });
      }
      return createUnifiedError(ErrorCodes.ACCESS_DENIED, 'edit_file', { path: params.path }, 'ファイルを読み取れません');
    }
    
    const originalContent = content;
    
    // フォーマット情報検出
    const formattingInfo: FormattingInfo = {
      indent_style: 'space' as 'tab' | 'space',
      indent_size: 0,
      line_ending: 'lf' as 'lf' | 'crlf',
      trailing_whitespace_removed: 0
    };
    
    let editedContent = content;
    
    // 各編集操作を処理
    const failedPatterns: string[] = [];
    for (let i = 0; i < params.edits.length; i++) {
      const edit = params.edits[i];
      const editResult = await processEdit(
        editedContent,
        edit as EditOperation,
        i,
        params.preserve_formatting ?? true,
        formattingInfo
      );
      
      editedContent = editResult.content;
      editDetails.push(editResult.details);
      
      // パターンが見つからなかった場合を記録
      if (editResult.details.status === 'no_match') {
        const pattern = editResult.details.old_text_or_pattern;
        if (pattern) failedPatterns.push(pattern);
      }
      
      if (editResult.warnings) {
        warnings.push(...editResult.warnings);
      }
    }
    
    // 失敗したパターンがある場合、統一エラー形式で返す
    if (failedPatterns.length > 0) {
      return createUnifiedError(
        ErrorCodes.PATTERN_NOT_FOUND, 
        'edit_file', 
        { 
          path: params.path, 
          patterns_failed: failedPatterns.length 
        },
        `${failedPatterns.length}個のパターンがファイル内で見つかりませんでした`
      );
    }
    
    // フォーマット保持処理
    if (params.preserve_formatting ?? true) {
      // インデント検出と正規化
      const indentInfo = detectIndentation(editedContent);
      formattingInfo.indent_style = (indentInfo as any).type || 'space';
      formattingInfo.indent_size = indentInfo.size;
      
      // 行末検出
      formattingInfo.line_ending = detectLineEnding(editedContent) as 'lf' | 'crlf';
      
      // 行末空白削除
      const normalized = normalizeWhitespace(editedContent, { 
        remove_trailing_spaces: true, 
        normalize_line_endings: false,
        preserve_indentation: true 
      });
      formattingInfo.trailing_whitespace_removed = (normalized as any).trailing_removed || 0;
      editedContent = normalized.content;
    }
    
    // Git形式のdiff生成 (ファイルパスを含めない)
    const diffOutput = generateGitStyleDiff(
      originalContent,
      editedContent
    );
    
    // 変更行数カウント
    const linesChanged = diffOutput.split('\n').filter(line => 
      line.startsWith('+') || line.startsWith('-')
    ).length;
    
    // ドライランモード
    if (params.dry_run) {
      return {
        success: true,
        changes_made: 0, // Dry run doesn't make actual changes
        message: 'Dry run completed - no changes applied',
        diff_output: diffOutput,
        edit_summary: {
          total_edits: params.edits.length,
          successful_edits: editDetails.filter(d => d.status === 'success').length,
          failed_edits: editDetails.filter(d => d.status === 'failed').length,
          lines_changed: linesChanged
        },
        edit_details: editDetails,
        formatting_info: formattingInfo
      };
    }
    
    // 実際のファイル書き込み
    await fs.writeFile(params.path, editedContent, 'utf8');
    
    // 成功レスポンス
    return {
      success: true,
      changes_made: editDetails.filter(d => d.status === 'success').length,
      diff_output: diffOutput,
      edit_summary: {
        total_edits: params.edits.length,
        successful_edits: editDetails.filter(d => d.status === 'success').length,
        failed_edits: editDetails.filter(d => d.status === 'failed').length,
        lines_changed: linesChanged
      },
      edit_details: editDetails,
      formatting_info: formattingInfo
    };
    
  } catch (error) {
    return createUnifiedErrorFromException(error, 'edit_file', params.path);
  }
}


/**
 * 個別の編集操作を処理
 */
async function processEdit(
  content: string,
  edit: EditOperation,
  index: number,
  _preserveFormatting: boolean,
  _formattingInfo: FormattingInfo
): Promise<{
  content: string;
  details: EditDetails;
  warnings?: string[];
}> {
  const warnings: string[] = [];
  
  try {
    // Check for simple format first (recommended)
    if ('oldText' in edit && 'newText' in edit && !('type' in edit)) {
      // Simple format - most common case
      const simpleEdit = edit as SimpleEdit;
      const oldText = simpleEdit.oldText;
      const newText = simpleEdit.newText;
      
      if (!content.includes(oldText)) {
        return {
          content,
          details: {
            edit_index: index,
            type: 'literal',
            old_text_or_pattern: oldText,
            new_text_or_replacement: newText,
            status: 'no_match',
            match_count: 0
          }
        };
      }
      
      // Replace all occurrences
      const matches = content.split(oldText).length - 1;
      const newContent = content.split(oldText).join(newText);
      
      if (matches > 1) {
        warnings.push(`Multiple matches found (${matches}) for text replacement`);
      }
      
      return {
        content: newContent,
        details: {
          edit_index: index,
          type: 'literal',
          old_text_or_pattern: oldText,
          new_text_or_replacement: newText,
          status: 'success',
          match_count: matches
        },
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } else if (edit.type === 'literal') {
      // リテラル置換
      const literalEdit = edit as LiteralEdit;
      const oldText = literalEdit.old_text;
      const newText = literalEdit.new_text;
      
      if (!content.includes(oldText)) {
        return {
          content,
          details: {
            edit_index: index,
            type: 'literal',
            old_text_or_pattern: oldText,
            new_text_or_replacement: newText,
            status: 'no_match',
            match_count: 0
          }
        };
      }
      
      // 全ての出現箇所を置換
      const matches = content.split(oldText).length - 1;
      const newContent = content.split(oldText).join(newText);
      
      if (matches > 1) {
        warnings.push(`Multiple matches found (${matches}) for literal text`);
      }
      
      return {
        content: newContent,
        details: {
          edit_index: index,
          type: 'literal',
          old_text_or_pattern: oldText,
          new_text_or_replacement: newText,
          status: matches > 1 ? 'multiple_matches' : 'success',
          match_count: matches
        },
        warnings
      };
      
    } else if (edit.type === 'regex') {
      // 正規表現置換
      const regexEdit = edit as RegexEdit;
      const pattern = regexEdit.pattern;
      const replacement = regexEdit.replacement;
      const flags = regexEdit.flags || 'g';
      
      // 正規表現検証
      const validation = validateRegexPattern(pattern);
      if (!validation.valid) {
        throw new Error(`Invalid regex pattern: ${validation.error}`);
      }
      
      // ReDoSチェック（簡易的）
      if (pattern.includes('**') || pattern.includes('++')) {
        warnings.push('Pattern may have performance issues');
      }
      
      // 正規表現作成
      const regex = new RegExp(pattern, flags);
      
      // タイムアウト付きで実行
      const result = await executeRegexWithTimeout(
        regex,
        content,
        SAFETY_LIMITS.REGEX_TIMEOUT_MS
      );
      
      if (result.timedOut) {
        throw new Error('Regex execution timed out');
      }
      
      // 置換実行
      const matches = content.match(regex);
      const matchCount = matches ? matches.length : 0;
      const newContent = content.replace(regex, replacement);
      
      return {
        content: newContent,
        details: {
          edit_index: index,
          type: 'regex',
          old_text_or_pattern: pattern,
          new_text_or_replacement: replacement,
          status: matchCount === 0 ? 'no_match' : 
                  matchCount > 10 ? 'multiple_matches' : 'success',
          match_count: matchCount
        },
        warnings
      };
      
    } else if (edit.type === 'diff') {
      // Git形式のdiff適用
      const diffEdit = edit as DiffEdit;
      const diffContent = diffEdit.diff_content;
      
      const result = applyGitDiff(content, diffContent);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to apply diff');
      }
      
      return {
        content: result.content || content,
        details: {
          edit_index: index,
          type: 'diff',
          old_text_or_pattern: 'diff',
          new_text_or_replacement: 'applied',
          status: result.success ? 'success' : 'failed',
          diff_hunks: result.hunks_applied
        },
        warnings
      };
      
    } else {
      throw new Error(`Unknown edit type: ${(edit as any).type}`);
    }
    
  } catch (error) {
    return {
      content,
      details: {
        edit_index: index,
        type: (edit as any).type,
        old_text_or_pattern: '',
        new_text_or_replacement: '',
        status: 'failed'
      }
    };
  }
}
/**
 * Smart Filesystem MCP - Unified Error Handler
 * セキュアで統一されたエラーハンドリング
 */

/**
 * 標準エラーコード
 */
export const ErrorCodes = {
  MISSING_PATH: 'missing_path',
  FILE_NOT_FOUND: 'file_not_found',
  ACCESS_DENIED: 'access_denied',
  INVALID_PATH: 'invalid_path',
  PATTERN_NOT_FOUND: 'pattern_not_found',
  FILE_TOO_LARGE: 'file_too_large',
  INVALID_REGEX: 'invalid_regex',
  OPERATION_FAILED: 'operation_failed',
  PATH_NOT_ABSOLUTE: 'path_not_absolute',
  CONTENT_TOO_LARGE: 'content_too_large',
  DIRECTORY_NOT_EMPTY: 'directory_not_empty',
  DESTINATION_EXISTS: 'destination_exists'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * 統一エラーレスポンス形式
 */
export interface UnifiedError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details: {
      path?: string;
      operation: string;
      [key: string]: any;
    };
    suggestions: string[];
  };
}

/**
 * エラーコードに対する標準メッセージ
 */
const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.MISSING_PATH]: 'ファイルパスが指定されていません',
  [ErrorCodes.FILE_NOT_FOUND]: 'ファイルまたはディレクトリが見つかりません',
  [ErrorCodes.ACCESS_DENIED]: 'アクセスが拒否されました',
  [ErrorCodes.INVALID_PATH]: '不正なパス形式です',
  [ErrorCodes.PATTERN_NOT_FOUND]: '指定されたパターンが見つかりません',
  [ErrorCodes.FILE_TOO_LARGE]: 'ファイルサイズが制限を超えています',
  [ErrorCodes.INVALID_REGEX]: '不正な正規表現です',
  [ErrorCodes.OPERATION_FAILED]: '操作に失敗しました',
  [ErrorCodes.PATH_NOT_ABSOLUTE]: '絶対パスを指定してください',
  [ErrorCodes.CONTENT_TOO_LARGE]: '書き込み内容が制限サイズを超えています',
  [ErrorCodes.DIRECTORY_NOT_EMPTY]: 'ディレクトリが空ではありません',
  [ErrorCodes.DESTINATION_EXISTS]: '宛先ファイルが既に存在します'
};

/**
 * エラーコードに対する標準提案
 */
const ErrorSuggestions: Record<ErrorCode, string[]> = {
  [ErrorCodes.MISSING_PATH]: [
    '有効なファイルパスを指定してください'
  ],
  [ErrorCodes.FILE_NOT_FOUND]: [
    'ファイルパスを確認してください',
    'ファイルが存在するか確認してください'
  ],
  [ErrorCodes.ACCESS_DENIED]: [
    'ファイルの権限を確認してください',
    '管理者権限で実行してください'
  ],
  [ErrorCodes.INVALID_PATH]: [
    'パス形式を確認してください',
    '絶対パスを使用してください'
  ],
  [ErrorCodes.PATTERN_NOT_FOUND]: [
    'パターンの正確性を確認してください',
    'ファイル内容を事前に確認してください'
  ],
  [ErrorCodes.FILE_TOO_LARGE]: [
    'より小さいファイルを選択してください',
    'ファイルを分割してください'
  ],
  [ErrorCodes.INVALID_REGEX]: [
    '正規表現の構文を確認してください',
    'エスケープ文字を確認してください'
  ],
  [ErrorCodes.OPERATION_FAILED]: [
    '操作を再試行してください',
    'エラー詳細を確認してください'
  ],
  [ErrorCodes.PATH_NOT_ABSOLUTE]: [
    '絶対パスを使用してください',
    'path.resolve()を使用してパスを変換してください'
  ],
  [ErrorCodes.CONTENT_TOO_LARGE]: [
    '内容を分割して書き込んでください',
    'より小さなデータを使用してください'
  ],
  [ErrorCodes.DIRECTORY_NOT_EMPTY]: [
    'ディレクトリを空にしてから削除してください',
    '再帰的削除オプションを使用してください'
  ],
  [ErrorCodes.DESTINATION_EXISTS]: [
    '別の宛先を選択してください',
    '上書きオプションを使用してください'
  ]
};

/**
 * セキュリティチェック - 危険な情報を除去
 */
function sanitizeDetails(details: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  // 許可されたフィールドのホワイトリスト
  const allowedFields = [
    'path', 'operation', 'patterns_failed', 'size_limit',
    'actual_size', 'max_size', 'pattern_count', 'file_count',
    'directory_count', 'extension', 'encoding', 'provided_path',
    'creation_error', 'source', 'destination', 'directory',
    'size_kb', 'limit_kb', 'pattern'
  ];
  
  // 危険なフィールドのブラックリスト
  const dangerousFields = [
    'content', 'preview', 'content_preview', 'file_status',
    'operation_context', 'resolved_path', 'permissions',
    'file_analysis', 'suggested_replacements', 'match_context',
    'internal_error', 'stack', 'trace'
  ];
  
  for (const [key, value] of Object.entries(details)) {
    // ブラックリストチェック
    if (dangerousFields.includes(key)) {
      continue;
    }
    
    // ホワイトリストチェック
    if (allowedFields.includes(key)) {
      // 値の型チェック
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}

/**
 * 統一エラーレスポンスを生成
 */
export function createUnifiedError(
  code: ErrorCode,
  operation: string,
  details: Record<string, any> = {},
  customMessage?: string,
  customSuggestions?: string[]
): UnifiedError {
  // セキュリティチェック
  const sanitizedDetails = sanitizeDetails({
    ...details,
    operation
  });
  
  return {
    success: false,
    error: {
      code,
      message: customMessage || ErrorMessages[code],
      details: sanitizedDetails as { operation: string; path?: string; [key: string]: any; },
      suggestions: customSuggestions || ErrorSuggestions[code] || ['操作を再試行してください']
    }
  };
}

/**
 * エラーオブジェクトから統一エラーを生成
 */
export function createUnifiedErrorFromException(
  error: Error | unknown,
  operation: string,
  path?: string
): UnifiedError {
  // エラーメッセージから適切なエラーコードを推測
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = (error as any)?.code;
  
  let code: ErrorCode = ErrorCodes.OPERATION_FAILED;
  let suggestions: string[] | undefined;
  
  // エラーコードまたはメッセージからエラータイプを判定
  if (errorCode === 'ENOENT' || errorMessage.includes('no such file or directory') || errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
    code = ErrorCodes.FILE_NOT_FOUND;
  } else if (errorCode === 'EACCES' || errorCode === 'EPERM' || errorMessage.includes('permission') || errorMessage.includes('access denied')) {
    code = ErrorCodes.ACCESS_DENIED;
  } else if (errorMessage.includes('size') || errorMessage.includes('too large')) {
    code = ErrorCodes.FILE_TOO_LARGE;
  } else if (errorMessage.includes('regex') || errorMessage.includes('pattern')) {
    code = ErrorCodes.INVALID_REGEX;
  } else if (errorMessage.includes('path')) {
    code = ErrorCodes.INVALID_PATH;
  }
  
  // 安全なエラーメッセージを生成
  let safeMessage = ErrorMessages[code];
  
  // 特定のエラーには追加情報を含める（安全な範囲で）
  if (code === ErrorCodes.FILE_NOT_FOUND && path) {
    safeMessage = `${path} が見つかりません`;
  }
  
  return createUnifiedError(
    code,
    operation,
    path ? { path, operation } : { operation },
    safeMessage,
    suggestions
  );
}

/**
 * MCPエラー形式から統一エラーへの変換
 */
export function convertMCPError(mcpError: any, operation: string, path?: string): UnifiedError {
  // MCPエラーメッセージの解析
  const message = mcpError.message || '';
  
  // エラーコードの推測
  let code: ErrorCode = ErrorCodes.OPERATION_FAILED;
  
  if (message.includes('not found')) {
    code = ErrorCodes.FILE_NOT_FOUND;
  } else if (message.includes('permission') || message.includes('access')) {
    code = ErrorCodes.ACCESS_DENIED;
  } else if (message.includes('size')) {
    code = ErrorCodes.FILE_TOO_LARGE;
  }
  
  return createUnifiedError(
    code,
    operation,
    path ? { path } : {},
    undefined,
    undefined
  );
}

/**
 * レガシーfailedInfo形式から統一エラーへの変換
 */
export function convertLegacyError(failedInfo: any, operation: string): UnifiedError {
  // 安全な情報のみ抽出
  const reason = failedInfo.reason || 'unknown';
  const message = failedInfo.message || '';
  const path = failedInfo.path || failedInfo.target_path;
  
  // エラーコードのマッピング
  let code: ErrorCode = ErrorCodes.OPERATION_FAILED;
  
  switch (reason) {
    case 'file_not_found':
    case 'not_found':
      code = ErrorCodes.FILE_NOT_FOUND;
      break;
    case 'permission_denied':
    case 'access_denied':
      code = ErrorCodes.ACCESS_DENIED;
      break;
    case 'invalid_path':
    case 'path_not_absolute':
      code = ErrorCodes.INVALID_PATH;
      break;
    case 'pattern_not_found':
      code = ErrorCodes.PATTERN_NOT_FOUND;
      break;
    case 'size_exceeded':
    case 'file_too_large':
      code = ErrorCodes.FILE_TOO_LARGE;
      break;
    case 'invalid_regex':
      code = ErrorCodes.INVALID_REGEX;
      break;
  }
  
  return createUnifiedError(
    code,
    operation,
    path ? { path } : {},
    message || undefined,
    undefined
  );
}

/**
 * パスバリデーション - 不正文字の検出
 */
export function validatePath(path: string | undefined | null): { valid: boolean; error?: string } {
  // 空チェック
  if (!path || path.trim() === '') {
    return { valid: false, error: 'Path is empty or not provided' };
  }
  
  // 不正文字チェック（Windows/Unix両対応）
  const invalidChars = /[<>|*?"]/;
  if (invalidChars.test(path)) {
    return { valid: false, error: 'Path contains invalid characters: <, >, |, *, ?, "' };
  }
  
  // パス長チェック（Windows MAX_PATH = 260）
  if (path.length > 260) {
    return { valid: false, error: 'Path is too long (max 260 characters)' };
  }
  
  return { valid: true };
}
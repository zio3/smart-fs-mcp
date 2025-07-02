/**
 * Smart Filesystem MCP - Constants Definition
 * Safety limits and file classification constants
 */

/**
 * Safety limits for file operations
 */
export const SAFETY_LIMITS = {
  // File size limits - increased for simple-first approach
  MAX_FILE_SIZE: 1024 * 1024,                    // 1MB default max file size
  MAX_FORCE_READ_SIZE: 50 * 1024 * 1024,         // 50MB absolute maximum
  
  // Directory scan limits - increased for better UX
  MAX_DIRECTORY_SCAN: 10000,                     // Maximum files in directory scan
  DEFAULT_DIRECTORY_SCAN: 1000,                  // Default scan limit
  
  // Operation time limits (milliseconds)
  MAX_OPERATION_TIME: 30000,                     // 30 seconds maximum operation time
  MAX_FILE_READ_TIME: 5000,                      // 5 seconds for single file read
  MAX_DIRECTORY_SCAN_TIME: 20000,                // 20 seconds for directory scan
  
  // Token estimation limits
  MAX_TOKEN_ESTIMATE: 100000,                    // ~400KB of text content
  WARNING_TOKEN_ESTIMATE: 50000,                 // Warning threshold
  
  // Preview limits for error responses
  DEFAULT_PREVIEW_LINES: 20,                     // Lines shown in error preview
  DEFAULT_TAIL_LINES: 5,                         // Tail lines in error preview
  
  // Character limits
  MAX_LINE_LENGTH: 2000,                         // Maximum characters per line
  MAX_PATH_LENGTH: 260,                          // Windows path limit
  
  // Simplified limits
  MAX_DIRECTORY_DEPTH: 1,                        // Non-recursive by default
  MAX_FILES_PER_BATCH: 100,                      // Higher batch size
  MAX_PREVIEW_LINES: 100,                        // For compatibility
  
  // List directory limits
  MAX_FILES_WARNING: 1000,                       // Warning threshold for large directories
  MAX_SUBDIRS_TO_SCAN: 500,                      // Maximum subdirectories to scan
  LIST_OPERATION_TIMEOUT: 10000,                 // 10 seconds for list operation
  MAX_FILE_SIZE_DISPLAY: 1024 * 1024 * 1024,     // 1GB display limit
  
  // Search limits
  MAX_FILES_TO_SCAN: 10000,                      // Maximum files to scan in search
  MAX_PATTERN_LENGTH: 1000,                      // Maximum regex pattern length
  MAX_FILE_SIZE_CONTENT: 10 * 1024 * 1024,       // 10MB max file size for content search
  REGEX_TIMEOUT_MS: 1000,                        // 1 second regex execution timeout
  TOTAL_SEARCH_TIMEOUT: 30000,                   // 30 seconds total search timeout
  MAX_SEARCH_RESULTS: 500,                       // Maximum search results to return
  MAX_MATCHES_PER_FILE: 50,                      // Maximum matches per file
  
  // Write limits
  WRITE_WARNING_SIZE: 1024 * 1024,               // 1MB warning threshold
  WRITE_MAX_SIZE: 10 * 1024 * 1024,              // 10MB maximum write size
  DISK_SPACE_CHECK: true,                        // Enable disk space checking
  
  // Edit limits
  EDIT_MAX_FILE_SIZE: 10 * 1024 * 1024,          // 10MB max file size for editing
  EDIT_MAX_OPERATIONS: 100,                      // Maximum edit operations per request
  EDIT_WARNING_MATCHES: 50,                      // Warning threshold for match count
  EDIT_REGEX_TIMEOUT: 2000,                      // 2 seconds regex timeout
  
  // Move limits
  MOVE_MAX_FILE_SIZE: 100 * 1024 * 1024,         // 100MB max file size for moving
  MOVE_TIMEOUT: 10000,                           // 10 seconds move operation timeout
  
  // Delete limits
  DELETE_MAX_FILES_WARNING: 100,                 // ファイル数警告閾値
  DELETE_MAX_SIZE_WARNING: 10 * 1024 * 1024,     // サイズ警告閾値（10MB）
  DELETE_MAX_PREVIEW_FILES: 20,                  // プレビュー最大表示数
  DELETE_OPERATION_TIMEOUT: 30000,               // 削除タイムアウト（30秒）
  DELETE_TIME_PER_FILE: 5,                       // ファイル1つあたりの削除時間推定（ms）
} as const;

/**
 * Critical file patterns for deletion safety
 */
export const CRITICAL_FILE_PATTERNS = {
  // 重要ファイル名（完全一致）
  CRITICAL_FILES: [
    'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    '.env', '.env.local', '.env.production', '.env.development',
    'config.js', 'config.json', 'config.yaml', 'config.yml',
    'index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts',
    'README.md', 'LICENSE', 'LICENSE.txt', 'CHANGELOG.md',
    'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile',
    '.gitignore', '.gitattributes', 'tsconfig.json', 'webpack.config.js',
    'babel.config.js', '.eslintrc.js', '.eslintrc.json', '.prettierrc'
  ],
  
  // 重要ファイルパターン（正規表現）
  IMPORTANT_PATTERNS: [
    /.*\.config\.(js|ts|json|yaml|yml)$/,         // 設定ファイル
    /.*\.(key|pem|cert|crt|p12|pfx)$/,           // 証明書・キー
    /.*\.backup$/,                               // バックアップファイル
    /.*\.(sql|db|sqlite|sqlite3)$/,              // データベースファイル
    /.*\.lock$/,                                 // ロックファイル
    /^\.env\./,                                  // 環境変数ファイル
    /.*\.secret$/,                               // シークレットファイル
    /Makefile|makefile/,                         // Makeファイル
    /.*\.sh$/,                                   // シェルスクリプト
    /.*\.bat$/,                                  // バッチファイル
    /.*\.ps1$/                                   // PowerShellスクリプト
  ]
} as const;

/**
 * File type classifications by extension
 */
export const FILE_CLASSIFICATION = {
  // Code files
  code: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.rb', '.go', '.rs', '.php', '.swift', '.kt', '.scala', '.r', '.m', '.mm', '.dart', '.lua', '.pl', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1', '.psd1', '.bat', '.cmd'],
    category: 'code',
    readable: true,
    binaryCheck: false,
  },
  
  // Configuration files
  config: {
    extensions: ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config', '.env', '.properties', '.xml', '.plist'],
    category: 'config',
    readable: true,
    binaryCheck: false,
  },
  
  // Documentation files
  docs: {
    extensions: ['.md', '.markdown', '.txt', '.rst', '.adoc', '.tex', '.org'],
    category: 'docs',
    readable: true,
    binaryCheck: false,
  },
  
  // Web files
  web: {
    extensions: ['.html', '.htm', '.css', '.scss', '.sass', '.less', '.styl'],
    category: 'web',
    readable: true,
    binaryCheck: false,
  },
  
  // Data files
  data: {
    extensions: ['.csv', '.tsv', '.sql', '.log'],
    category: 'data',
    readable: true,
    binaryCheck: true, // Large data files need size check
  },
  
  // Binary files (not readable)
  binary: {
    extensions: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg', '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z', '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.db', '.sqlite'],
    category: 'binary',
    readable: false,
    binaryCheck: true,
  },
  
  // Media files
  media: {
    extensions: ['.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ogg', '.wav', '.flac'],
    category: 'media',
    readable: false,
    binaryCheck: true,
  },
  
  // Office documents
  office: {
    extensions: ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'],
    category: 'office',
    readable: false,
    binaryCheck: true,
  },
} as const;

/**
 * BOM (Byte Order Mark) patterns for encoding detection
 */
export const BOM_PATTERNS = {
  UTF8: Buffer.from([0xEF, 0xBB, 0xBF]),
  UTF16_LE: Buffer.from([0xFF, 0xFE]),
  UTF16_BE: Buffer.from([0xFE, 0xFF]),
  UTF32_LE: Buffer.from([0xFF, 0xFE, 0x00, 0x00]),
  UTF32_BE: Buffer.from([0x00, 0x00, 0xFE, 0xFF]),
} as const;

/**
 * Binary file detection patterns (file signatures)
 */
export const BINARY_SIGNATURES = {
  // Executables
  EXE: Buffer.from([0x4D, 0x5A]), // MZ
  ELF: Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // .ELF
  MACHO_32: Buffer.from([0xFE, 0xED, 0xFA, 0xCE]),
  MACHO_64: Buffer.from([0xFE, 0xED, 0xFA, 0xCF]),
  
  // Images
  PNG: Buffer.from([0x89, 0x50, 0x4E, 0x47]),
  JPEG: Buffer.from([0xFF, 0xD8, 0xFF]),
  GIF87: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),
  GIF89: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  BMP: Buffer.from([0x42, 0x4D]),
  
  // Archives
  ZIP: Buffer.from([0x50, 0x4B, 0x03, 0x04]),
  RAR: Buffer.from([0x52, 0x61, 0x72, 0x21]),
  GZIP: Buffer.from([0x1F, 0x8B]),
  TAR: Buffer.from([0x75, 0x73, 0x74, 0x61, 0x72]),
  
  // Documents
  PDF: Buffer.from([0x25, 0x50, 0x44, 0x46]),
  DOCX: Buffer.from([0x50, 0x4B, 0x03, 0x04]), // Same as ZIP
} as const;

/**
 * Error message templates
 */
export const ERROR_MESSAGES = {
  // File access errors
  FILE_NOT_FOUND: 'File not found: {path}',
  DIRECTORY_NOT_FOUND: 'Directory not found: {path}',
  PERMISSION_DENIED: 'Permission denied accessing: {path}',
  
  // Size limit errors
  FILE_TOO_LARGE: 'File size ({size}) exceeds maximum allowed size ({limit})',
  TOKEN_LIMIT_EXCEEDED: 'Estimated tokens ({tokens}) exceeds safe limit ({limit})',
  
  // Safety violations
  BINARY_FILE_DETECTED: 'Binary file detected: {path}',
  UNSAFE_FILE_TYPE: 'Unsafe file type detected: {type}',
  EXECUTABLE_DETECTED: 'Executable file detected: {path}',
  
  // Operation errors
  OPERATION_TIMEOUT: 'Operation timed out after {timeout}ms',
  ENCODING_ERROR: 'Failed to detect file encoding: {path}',
  
  // Scan errors
  TOO_MANY_FILES: 'Directory contains too many files ({count} > {limit})',
  DEPTH_EXCEEDED: 'Maximum directory depth exceeded ({depth} > {limit})',
  
  // General errors
  UNKNOWN_ERROR: 'An unexpected error occurred: {message}',
} as const;

/**
 * Token estimation constants
 */
export const TOKEN_ESTIMATION = {
  // Average characters per token (approximation)
  CHARS_PER_TOKEN: 4,
  
  // Language-specific multipliers
  LANGUAGE_MULTIPLIERS: {
    english: 1.0,
    code: 0.8,      // Code typically has more tokens
    chinese: 2.5,   // CJK characters use more tokens
    japanese: 2.0,
    korean: 2.0,
  },
  
  // File type multipliers
  FILE_TYPE_MULTIPLIERS: {
    code: 1.2,      // More symbols and syntax
    docs: 1.0,      // Standard text
    config: 1.1,    // Structured data
    data: 0.9,      // Repetitive content
  },
} as const;

/**
 * Performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  // File processing speed (files/second)
  EXCELLENT: 1000,
  GOOD: 500,
  ACCEPTABLE: 100,
  POOR: 50,
  
  // Memory usage (MB)
  LOW_MEMORY: 50,
  MEDIUM_MEMORY: 100,
  HIGH_MEMORY: 200,
  
  // Response time (ms)
  FAST_RESPONSE: 100,
  NORMAL_RESPONSE: 500,
  SLOW_RESPONSE: 1000,
} as const;

/**
 * CLI display constants
 */
export const CLI_DISPLAY = {
  // Table column widths
  PATH_WIDTH: 50,
  SIZE_WIDTH: 10,
  TYPE_WIDTH: 12,
  DATE_WIDTH: 20,
  
  // Display limits
  MAX_TABLE_ROWS: 20,
  MAX_ERROR_DISPLAY: 5,
  
  // Colors (using chalk color names)
  COLORS: {
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
  },
} as const;
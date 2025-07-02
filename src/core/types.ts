/**
 * Smart Filesystem MCP - Type Definitions
 * Common types used throughout the project
 */

/**
 * Safety check result interface
 */
export interface SafetyResult {
  /** Whether the operation is safe to proceed */
  safe: boolean;
  
  /** Detailed reason if unsafe */
  reason?: string;
  
  /** Type of safety violation */
  violationType?: SafetyViolationType;
  
  /** Additional context about the safety check */
  details?: {
    fileSize?: number;
    sizeLimit?: number;
    fileType?: string;
    estimatedTokens?: number;
    tokenLimit?: number;
  };
  
  /** Suggestions for alternative actions */
  suggestions?: string[];
}

/**
 * Types of safety violations
 */
export type SafetyViolationType = 
  | 'SIZE_EXCEEDED'
  | 'TOKEN_LIMIT_EXCEEDED'
  | 'BINARY_FILE'
  | 'EXECUTABLE_FILE'
  | 'PERMISSION_DENIED'
  | 'UNSAFE_FILE_TYPE'
  | 'TIMEOUT_RISK'
  | 'PATH_TRAVERSAL';

/**
 * Basic file information
 */
export interface FileInfo {
  /** Absolute file path */
  path: string;
  
  /** File name without path */
  name: string;
  
  /** File size in bytes */
  size: number;
  
  /** Whether it's a directory */
  isDirectory: boolean;
  
  /** Whether it's a file */
  isFile: boolean;
  
  /** Whether it's a symbolic link */
  isSymlink?: boolean;
  
  /** File permissions (readable, writable, executable) */
  permissions?: {
    readable: boolean;
    writable: boolean;
    executable: boolean;
  };
  
  /** Timestamps */
  timestamps: {
    created: Date;
    modified: Date;
    accessed?: Date;
  };
}

/**
 * Extended file analysis result
 */
export interface FileAnalysis extends FileInfo {
  /** Detected file type */
  fileType: FileType;
  
  /** MIME type if detected */
  mimeType?: string;
  
  /** File extension */
  extension: string;
  
  /** Detected encoding */
  encoding?: FileEncoding;
  
  /** Whether the file is binary */
  isBinary: boolean;
  
  /** Whether the file is safe to read */
  isSafeToRead: boolean;
  
  /** Estimated token count */
  estimatedTokens?: number;
  
  /** Language detection (for code files) */
  detectedLanguage?: string;
  
  /** Content preview (first few lines) */
  preview?: {
    lines: string[];
    truncated: boolean;
  };
  
  /** Analysis confidence score (0-100) */
  confidence: number;
  
  /** Any warnings about the file */
  warnings?: string[];
}

/**
 * File type classification
 */
export interface FileType {
  /** Primary category */
  category: 'code' | 'config' | 'docs' | 'web' | 'data' | 'binary' | 'media' | 'office' | 'unknown';
  
  /** Specific type within category */
  specificType?: string;
  
  /** Whether content is readable as text */
  readable: boolean;
  
  /** Confidence level of type detection */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * File encoding types
 */
export type FileEncoding = 
  | 'utf8'
  | 'utf16le'
  | 'utf16be'
  | 'utf32le'
  | 'utf32be'
  | 'ascii'
  | 'latin1'
  | 'shift_jis'
  | 'euc-jp'
  | 'gb2312'
  | 'unknown';

/**
 * Directory scan result
 */
export interface ScanResult {
  /** Scan metadata */
  scanInfo: {
    /** Root directory scanned */
    rootPath: string;
    
    /** Scan start time */
    startTime: Date;
    
    /** Scan end time */
    endTime: Date;
    
    /** Total scan duration in ms */
    duration: number;
    
    /** Number of files found */
    totalFiles: number;
    
    /** Number of directories found */
    totalDirectories: number;
    
    /** Number of files included in results */
    includedFiles: number;
    
    /** Number of files skipped */
    skippedFiles: number;
    
    /** Maximum depth reached */
    maxDepthReached: number;
  };
  
  /** Summary statistics */
  summary: {
    /** Total size of all files */
    totalSize: number;
    
    /** File type breakdown */
    fileTypeBreakdown: Record<string, {
      count: number;
      totalSize: number;
    }>;
    
    /** Largest file */
    largestFile?: {
      path: string;
      size: number;
    };
    
    /** Most recently modified file */
    mostRecentFile?: {
      path: string;
      modified: Date;
    };
    
    /** Estimated total tokens */
    estimatedTotalTokens?: number;
  };
  
  /** Individual file information */
  files: FileAnalysis[];
  
  /** Information about skipped files */
  skippedFiles: SkippedFile[];
  
  /** Any warnings during scan */
  warnings: ScanWarning[];
}

/**
 * Information about skipped files
 */
export interface SkippedFile {
  /** File path */
  path: string;
  
  /** Reason for skipping */
  reason: string;
  
  /** Skip category */
  category: 'size' | 'type' | 'permission' | 'binary' | 'error';
  
  /** Additional details */
  details?: Record<string, any>;
}

/**
 * Scan warning information
 */
export interface ScanWarning {
  /** Warning type */
  type: 'depth_limited' | 'time_limited' | 'count_limited' | 'permission_error' | 'symlink_loop';
  
  /** Human-readable message */
  message: string;
  
  /** Affected path if applicable */
  path?: string;
  
  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Error information structure
 */
export interface ErrorInfo {
  /** Error type */
  type: ErrorType;
  
  /** Human-readable error message */
  message: string;
  
  /** File path if applicable */
  filePath?: string;
  
  /** Operation that was attempted */
  attemptedOperation: string;
  
  /** Safety limit that was exceeded */
  safetyLimitExceeded?: string;
  
  /** Suggestions for resolution */
  suggestions?: string[];
  
  /** Original error if wrapped */
  originalError?: Error;
  
  /** Stack trace for debugging */
  stack?: string;
}

/**
 * Error types
 */
export type ErrorType = 
  | 'SAFETY_VIOLATION'
  | 'FILE_NOT_FOUND'
  | 'DIRECTORY_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'SIZE_EXCEEDED'
  | 'TOKEN_EXCEEDED'
  | 'TIMEOUT'
  | 'ENCODING_ERROR'
  | 'BINARY_FILE'
  | 'INVALID_PATH'
  | 'UNKNOWN_ERROR';

/**
 * Tool parameters for read_file
 */
export interface ReadFileParams {
  /** File path to read */
  path: string;
  
  /** Force specific encoding */
  encoding?: FileEncoding;
}

/**
 * Read file result - Success case
 */
export interface ReadFileSuccess {
  status: 'success';
  content: string;
}

/**
 * Read file result - Limited case
 */
export interface ReadFileLimited {
  status: 'size_exceeded' | 'binary_detected' | 'permission_denied';
  
  /** File information */
  file_info: {
    size_bytes: number;
    estimated_tokens: number;
    type: 'text' | 'code' | 'binary' | 'data' | 'config';
    safe_to_read: boolean;
  };
  
  /** Content preview */
  preview: {
    first_lines: string[];
    last_lines?: string[];
    truncated_at_line: number;
    total_lines_estimated: number;
    content_summary: string;
  };
  
  /** Issue details */
  issue_details: {
    reason: string;
    limit_exceeded: string;
    current_vs_limit: string;
  };
  
  /** Alternative options */
  alternatives: {
    force_read_available: boolean;
    suggestions: string[];
  };
}

/**
 * Read file result union type
 */
export type ReadFileResult = ReadFileSuccess | ReadFileLimited;

/**
 * Tool parameters for read_file_force
 */
export interface ReadFileForceParams {
  /** File path to read */
  path: string;
  
  /** Maximum size in MB to allow */
  max_size_mb?: number;
  
  /** Acknowledge risk */
  acknowledge_risk: boolean;
  
  /** Force specific encoding */
  encoding?: FileEncoding;
}

/**
 * Tool parameters for scan_directory
 */
export interface ScanDirectoryParams {
  /** Directory path to scan */
  path: string;
  
  /** Maximum number of files to return */
  max_files?: number;
  
  /** File types to include */
  file_types?: string[];
  
  /** Pattern to match files */
  pattern?: string;
}

/**
 * Scan directory result - Completed
 */
export interface ScanDirectoryCompleted {
  status: 'completed';
  
  /** Found files */
  files: Array<{
    path: string;
    name: string;
    size_bytes: number;
    type: string;
    modified: Date;
  }>;
  
  /** Summary statistics */
  summary: {
    total_files: number;
    total_size_mb: number;
    file_types: Record<string, number>;
  };
}

/**
 * Scan directory result - Limited
 */
export interface ScanDirectoryLimited {
  status: 'limit_reached';
  
  /** Partial results */
  partial_files: Array<{
    path: string;
    name: string;
    size_bytes: number;
    type: string;
    modified: Date;
  }>;
  
  /** Total files discovered */
  total_discovered: number;
  
  /** Suggestions for filtering */
  suggestions: {
    filter_by_type: Record<string, number>;
    filter_by_date: string[];
    subdivide_directories: string[];
  };
  
  /** Alternative options */
  alternatives: {
    force_scan_available: boolean;
    pattern_suggestions: string[];
  };
}

/**
 * Scan directory result union type
 */
export type ScanDirectoryResult = ScanDirectoryCompleted | ScanDirectoryLimited;

/**
 * List directory parameters
 */
export interface ListDirectoryParams {
  /** Directory path to list */
  path: string;
  
  /** Include hidden files */
  include_hidden?: boolean;
  
  /** Sort by criteria */
  sort_by?: 'name' | 'size' | 'modified';
  
  /** Sort order */
  sort_order?: 'asc' | 'desc';
}

/**
 * File information
 */
export interface FileInfo {
  /** File name */
  name: string;
  
  /** File size in bytes */
  size_bytes: number;
  
  /** Entry type */
  type: 'file';
  
  /** Last modified timestamp */
  last_modified: string;
  
  /** File extension */
  extension?: string;
}

/**
 * Subdirectory information
 */
export interface SubdirectoryInfo {
  /** Directory name */
  name: string;
  
  /** Number of files in directory */
  file_count: number;
  
  /** Number of subdirectories */
  folder_count: number;
  
  /** Entry type */
  type: 'directory';
  
  /** Last modified timestamp */
  last_modified: string;
}

/**
 * Directory summary
 */
export interface DirectorySummary {
  /** Total number of files */
  total_files: number;
  
  /** Total number of subdirectories */
  total_subdirectories: number;
  
  /** Total size in bytes */
  total_size_bytes: number;
  
  /** Largest file info */
  largest_file?: {
    name: string;
    size_bytes: number;
  };
}

/**
 * List directory response
 */
export interface ListDirectoryResponse {
  /** Directory path */
  directory: string;
  
  /** Files in directory */
  files: FileInfo[];
  
  /** Subdirectories */
  subdirectories: SubdirectoryInfo[];
  
  /** Summary statistics */
  summary: DirectorySummary;
  
  /** Operation status */
  status: 'success' | 'partial' | 'error';
  
  /** Warnings if any */
  warnings?: string[];
}

/**
 * Search content parameters
 */
export interface SearchContentParams {
  /** File name/path search pattern (regex) */
  file_pattern?: string;
  
  /** File content search pattern (regex) */
  content_pattern?: string;
  
  /** Search starting directory */
  directory?: string;
  
  /** Recursive search */
  recursive?: boolean;
  
  /** Maximum search depth */
  max_depth?: number;
  
  /** Target extensions */
  extensions?: string[];
  
  /** Exclude extensions */
  exclude_extensions?: string[];
  
  /** Exclude directories */
  exclude_dirs?: string[];
  
  /** Case sensitive search */
  case_sensitive?: boolean;
  
  /** Whole word match */
  whole_word?: boolean;
  
  /** Maximum files to return */
  max_files?: number;
  
  /** Maximum matches per file */
  max_matches_per_file?: number;
}

/**
 * Search info
 */
export interface SearchInfo {
  /** Search pattern */
  pattern: string;
  
  /** Search type */
  search_type: string;
  
  /** Search directory */
  directory: string;
  
  /** Total files scanned */
  total_files_scanned: number;
  
  /** Search time in ms */
  search_time_ms: number;
}

/**
 * Search result for individual file
 */
export interface SearchResult {
  /** File path */
  file_path: string;
  
  /** File size in bytes */
  file_size_bytes: number;
  
  /** Filename matches count */
  filename_matches?: number;
  
  /** Content matches count */
  content_matches?: number;
  
  /** Last modified timestamp */
  last_modified: string;
  
  /** Content preview */
  content_preview?: string;
  
  /** Match context lines */
  match_context?: string[];
}

/**
 * Search summary
 */
export interface SearchSummary {
  /** Total matches found */
  total_matches: number;
  
  /** Files with matches */
  files_with_matches: number;
  
  /** Largest file in MB */
  largest_file_mb?: number;
  
  /** File with most matches */
  most_matches?: {
    file_path: string;
    match_count: number;
  };
  
  /** Next action suggestions */
  next_actions?: string[];
}

/**
 * Search content response
 */
export interface SearchContentResponse {
  /** Search information */
  search_info: SearchInfo;
  
  /** Search results */
  results: SearchResult[];
  
  /** Summary statistics */
  summary: SearchSummary;
  
  /** Operation status */
  status: 'success' | 'partial' | 'error';
  
  /** Warnings if any */
  warnings?: string[];
}

/**
 * Tool parameters for write_file
 */
export interface WriteFileParams {
  /** File path to write */
  path: string;
  
  /** Content to write */
  content: string;
  
  /** Text encoding */
  encoding?: FileEncoding;
}

/**
 * Write file result
 */
export interface WriteFileResult {
  /** Operation status */
  status: 'success' | 'warning' | 'error';
  
  /** File information */
  file_info: {
    path: string;
    size_bytes: number;
    created_new: boolean;
    estimated_tokens: number;
  };
  
  /** Issue details */
  issue_details?: {
    reason: string;
    risk_level: 'low' | 'medium' | 'high';
    size_warning?: {
      size_mb: number;
      recommendation: string;
    };
  };
  
  /** Alternative options */
  alternatives?: {
    suggestions: string[];
  };
  
  /** Warnings */
  warnings?: string[];
}

/**
 * Edit operation types
 */
export interface LiteralEdit {
  type: 'literal';
  old_text: string;
  new_text: string;
}

export interface RegexEdit {
  type: 'regex';
  pattern: string;
  replacement: string;
  flags?: string;
}

export interface DiffEdit {
  type: 'diff';
  diff_content: string;
  base_version_check?: boolean;
}

export type EditOperation = LiteralEdit | RegexEdit | DiffEdit;

/**
 * Tool parameters for edit_file
 */
export interface EditFileParams {
  /** File path to edit */
  path: string;
  
  /** Edit operations */
  edits: EditOperation[];
  
  /** Preview only */
  dry_run?: boolean;
  
  /** Preserve formatting */
  preserve_formatting?: boolean;
}

/**
 * Edit details
 */
export interface EditDetails {
  edit_index: number;
  type: 'literal' | 'regex' | 'diff';
  status: 'success' | 'failed' | 'multiple_matches' | 'no_match' | 'diff_conflict';
  old_text_or_pattern: string;
  new_text_or_replacement: string;
  match_count?: number;
  sample_matches?: string[];
  diff_hunks?: number;
}

/**
 * Formatting info
 */
export interface FormattingInfo {
  indent_style: 'tab' | 'space';
  indent_size: number;
  line_ending: 'lf' | 'crlf';
  trailing_whitespace_removed: number;
}

/**
 * Edit file result
 */
export interface EditFileResult {
  /** Operation status */
  status: 'success' | 'warning' | 'error';
  
  /** Message for dry run */
  message?: string;
  
  /** Edit summary */
  edit_summary: {
    total_edits: number;
    successful_edits?: number;
    failed_edits?: number;
    regex_edits_count: number;
    diff_edits_count?: number;
    lines_changed?: number;
    formatting_applied?: boolean;
  };
  
  /** Git-style diff output */
  diff_output?: string;
  
  /** Edit details */
  edit_details?: EditDetails[];
  
  /** Issue details */
  issue_details?: {
    reason: string;
    problematic_edits: number;
    risk_assessment: string;
  };
  
  /** Alternative options */
  alternatives?: {
    safer_approaches: string[];
    suggestions: string[];
  };
  
  /** Formatting info */
  formatting_info?: FormattingInfo;
}

/**
 * Tool parameters for move_file
 */
export interface MoveFileParams {
  /** Source file path */
  source: string;
  
  /** Destination file path */
  destination: string;
  
  /** Overwrite existing file */
  overwrite_existing?: boolean;
}

/**
 * Move file result
 */
export interface MoveFileResult {
  /** Operation status */
  status: 'success' | 'warning' | 'error';
  
  /** Operation information */
  operation_info: {
    source: string;
    destination: string;
    operation_type: 'move' | 'rename' | 'backup';
    size_bytes: number;
  };
  
  /** Issue details */
  issue_details?: {
    reason: string;
    existing_file_info?: {
      size_bytes: number;
      last_modified: string;
    };
  };
  
  /** Alternative options */
  alternatives?: {
    suggestions: string[];
  };
}

/**
 * Operation result wrapper
 */
export interface OperationResult<T> {
  /** Whether operation succeeded */
  success: boolean;
  
  /** Result data if successful */
  data?: T;
  
  /** Error information if failed */
  error?: ErrorInfo;
  
  /** Performance metrics */
  metrics?: {
    startTime: number;
    endTime: number;
    duration: number;
    memoryUsed?: number;
  };
}

/**
 * CLI-specific types
 */
export namespace CLI {
  export interface CommandOptions {
    verbose?: boolean;
    quiet?: boolean;
    format?: 'json' | 'table' | 'tree';
    output?: string;
    benchmark?: boolean;
  }
  
  export interface BenchmarkResult {
    operation: string;
    totalFiles?: number;
    duration: number;
    filesPerSecond?: number;
    peakMemory: number;
    breakdown?: Record<string, number>;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  }
}
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
  | 'PATH_TRAVERSAL'
  | 'FILE_NOT_FOUND'
  | 'DIRECTORY_NOT_FOUND'
  | 'INVALID_PATH'
  | 'UNKNOWN_ERROR';

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
  permissions: {
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
}

/**
 * File information for directory listing (renamed to avoid conflicts)
 */
export interface DirectoryFileInfo {
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
    size: number;
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
export interface SimpleEdit {
  oldText: string;
  newText: string;
}

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

export type EditOperation = SimpleEdit | LiteralEdit | RegexEdit | DiffEdit;

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
export type OperationResult<T = unknown> = {
  status: 'success' | 'error' | 'warning';
  
  /** Result data if successful */
  data?: T;
  
  /** Error message if failed */
  error?: string;
  
  /** Warnings if any */
  warnings?: string[];
};

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

/**
 * Simplified Read File Response Types
 * Simple success/failure structure for LLM-friendly responses
 */

/**
 * Solution for resolving file read failures
 */
export interface Solution {
  /** API method name */
  method: string;
  
  /** Ready-to-use parameters */
  params: Record<string, any>;
  
  /** LLM-friendly description */
  description: string;
}

/**
 * Simple successful file read response
 */
export interface SimpleReadFileSuccess {
  success: true;
  content: string;
}



/**
 * Simple read file response type
 */
export type SimpleReadFileResponse = SimpleReadFileSuccess | import('../utils/unified-error-handler.js').UnifiedError;

/**
 * Simple Search Content Types
 */

/**
 * Search match information
 */
export interface SearchMatch {
  /** File path */
  file: string;
  
  /** Number of matches in the file */
  matchCount: number;
  
  /** File size in bytes */
  fileSize: number;
  
  /** Extracted content keywords (deduplicated) */
  contents: string[];
}

/**
 * Successful search response
 */
export interface SearchContentSuccess {
  success: true;
  matches: SearchMatch[];
  search_type: string;
  search_stats: {
    files_scanned: number;
    files_with_matches: number;
    total_matches: number;
  };
}

/**
 * Failed search response
 */
export interface SearchContentFailure {
  success: false;
  failedInfo: {
    reason: string;
    message: string;
    solutions: Solution[];
  };
}

/**
 * Simple search content response type
 */
export type SimpleSearchContentResponse = SearchContentSuccess | SearchContentFailure;

/**
 * Enhanced Directory List API Types (LLM-Optimized)
 */

/**
 * Enhanced directory listing parameters (absolute path required)
 */
export interface EnhancedListDirectoryParams {
  /** Absolute directory path (required) */
  path: string;
  
  /** File extensions to include */
  extensions?: string[];
  
  /** Directory names to exclude */
  exclude_dirs?: string[];
  
  /** Include hidden files (default: true) */
  include_hidden?: boolean;
  
  /** Maximum files to display (default: 50, max: 200) */
  max_files?: number;
  
  /** Maximum directories to display (default: 20, max: 50) */
  max_directories?: number;
}

/**
 * Enhanced file info with optimization for LLMs
 */
export interface EnhancedFileInfo {
  /** File name */
  name: string;
  
  /** File size in bytes */
  size: number;
  
  /** File extension (without dot) */
  ext?: string;
  
  /** Last modified timestamp (ISO string) */
  modified: string;
  
  /** Whether file is hidden */
  hidden: boolean;
}

/**
 * Enhanced subdirectory info with directory count
 */
export interface EnhancedSubdirectoryInfo {
  /** Directory name */
  name: string;
  
  /** Number of files */
  files: number;
  
  /** Number of directories */
  directories: number;
  
  /** Last modified timestamp (ISO string) */
  modified: string;
  
  /** Whether directory is hidden */
  hidden: boolean;
}

/**
 * LLM-optimized directory response (success)
 */
export interface LLMDirectorySuccess {
  success: true;
  
  /** Directory path */
  path: string;
  
  /** Files (limited to 50 max) */
  files: EnhancedFileInfo[];
  
  /** Subdirectories */
  directories: EnhancedSubdirectoryInfo[];
  
  /** Summary counts */
  summary: {
    /** Total files shown */
    file_count: number;
    
    /** Total directories shown */
    directory_count: number;
    
    /** Total size of shown files */
    total_size: number;
    
    /** Whether results were limited */
    limited?: boolean;
    
    /** Additional files not shown */
    additional_files?: number;
    
    /** Hidden files excluded */
    hidden_excluded?: number;
  };
}

/**
 * LLM-optimized directory response (failure)
 */
export interface LLMDirectoryFailure {
  success: false;
  failedInfo: {
    reason: 'path_not_absolute' | 'not_found' | 'permission_denied' | 'too_many_files' | 'invalid_path_format';
    message: string;
    solutions: Solution[];
    current_directory?: string;
    directory_info?: {
      total_files?: number;
      suggested_filters?: string[];
    };
    directory_analysis?: {
      total_files: number;
      file_types: Array<{
        ext: string;
        count: number;
        percentage: number;
      }>;
      hidden_files: number;
    };
  };
}

/**
 * LLM-optimized directory response type
 */
export type LLMOptimizedDirectoryResponse = LLMDirectorySuccess | LLMDirectoryFailure;

/**
 * Unified File Operations LLM Optimization Types
 * Breaking changes: complete replacement of existing error response formats
 */

/**
 * File operation failure reasons
 */
export type FileOperationFailureReason = 
  | "file_not_found"
  | "permission_denied" 
  | "pattern_not_found"      // edit専用
  | "destination_exists"     // move専用
  | "readonly_file"          // delete専用
  | "file_in_use"           // delete専用  
  | "path_not_absolute"     // 共通
  | "invalid_path"
  | "operation_failed";

/**
 * File status information for failure responses
 */
export interface FileStatusInfo {
  /** File path */
  path: string;
  
  /** Whether file exists */
  exists: boolean;
  
  /** Whether file is readable */
  readable?: boolean;
  
  /** Whether file is writable */
  writable?: boolean;
  
  /** File size in bytes */
  size?: number;
  
  /** Last modified timestamp (ISO string) */
  modified?: string;
  
  /** First few lines of content for preview */
  content_preview?: string[];
}

/**
 * Operation context for providing specific failure details
 */
export interface OperationContext {
  /** Type of operation that failed */
  operation_type: "edit" | "move" | "delete";
  
  /** Target file path */
  target_file: string;
  
  /** Search patterns (edit operations) */
  search_patterns?: string[];
  
  /** Destination path (move operations) */
  destination_path?: string;
  
  /** Conflict information */
  conflicts?: ConflictInfo[];
}

/**
 * Conflict information for move operations
 */
export interface ConflictInfo {
  /** Type of conflict */
  type: "file_exists" | "permission_denied" | "invalid_destination";
  
  /** Conflicting path */
  path: string;
  
  /** Size difference in bytes */
  size_difference?: number;
  
  /** Age difference description */
  age_difference?: string;
  
  /** Additional conflict details */
  details?: string;
}

/**
 * Solution with priority for failure recovery
 */
export interface PrioritizedSolution extends Solution {
  /** Solution priority */
  priority: "high" | "medium" | "low";
}

/**
 * Operation preview for complex operations
 */
export interface OperationPreview {
  /** Preview of what will happen */
  description: string;
  
  /** Files that will be affected */
  affected_files: string[];
  
  /** Estimated operation size */
  estimated_changes: number;
  
  /** Warnings about the operation */
  warnings?: string[];
}

/**
 * Unified LLM-optimized file operation response
 */
export interface LLMOptimizedFileOperationResponse {
  /** Operation success status */
  success: boolean;
  
  /** Success data (varies by operation) */
  data?: any;
  
  /** Failure information with actionable solutions */
  failedInfo?: {
    /** Failure reason category */
    reason: FileOperationFailureReason;
    
    /** Human-readable error message */
    message: string;
    
    /** File status information */
    file_status?: FileStatusInfo;
    
    /** Operation context and details */
    operation_context?: OperationContext;
    
    /** Actionable solutions with priorities */
    solutions: PrioritizedSolution[];
    
    /** Operation preview (for complex cases) */
    preview?: OperationPreview;
  };
}

/**
 * Edit operation success response data
 */
export interface EditOperationSuccess {
  /** File path that was edited */
  file_path: string;
  
  /** Number of successful edits */
  edits_applied: number;
  
  /** Git-style diff of changes */
  diff_output?: string;
  
  /** File size after editing */
  new_file_size: number;
  
  /** Brief summary of changes */
  changes_summary: string;
}

/**
 * Move operation success response data
 */
export interface MoveOperationSuccess {
  /** Original file path */
  source_path: string;
  
  /** New file path */
  destination_path: string;
  
  /** Operation type performed */
  operation_type: "move" | "rename" | "copy";
  
  /** File size */
  file_size: number;
  
  /** Whether any existing file was overwritten */
  overwritten_existing: boolean;
}

/**
 * Delete file parameters (LLM-optimized)
 */
export interface DeleteFileParams {
  /** File path to delete (must be absolute) */
  path: string;
  
  /** Force deletion of read-only files */
  force?: boolean;
}

/**
 * Delete operation simplified success response
 */
export interface DeleteOperationSuccess {
  /** Always true for successful deletions */
  success: true;
}

/**
 * WriteFile API LLM-Optimized Types
 */

/**
 * WriteFile failure reasons
 */
export type WriteFileFailureReason = 
  | "path_not_absolute"
  | "directory_creation_failed" 
  | "permission_denied"
  | "file_exists_warning"
  | "content_too_large"
  | "operation_failed";

/**
 * WriteFile success response (simplified)
 */
export interface WriteFileSuccess {
  /** Always true for successful writes */
  success: true;
  /** Number of bytes written */
  bytes_written: number;
}

/**
 * WriteFile failure response with actionable solutions
 */
export interface WriteFileFailure {
  success: false;
  failedInfo: {
    /** Failure reason category */
    reason: WriteFileFailureReason;
    
    /** Human-readable error message */
    message: string;
    
    /** Provided path that caused the error */
    provided_path?: string;
    
    /** Missing directory that couldn't be created */
    missing_directory?: string;
    
    /** Directory creation error details */
    creation_error?: string;
    
    /** Target path for permission errors */
    target_path?: string;
    
    /** Existing file information */
    existing_file?: string;
    
    /** Existing file size */
    existing_size?: number;
    
    /** Content size that exceeded limits */
    content_size?: number;
    
    /** Maximum allowed size */
    max_size?: number;
    
    /** Actionable solutions with priorities */
    solutions: PrioritizedSolution[];
  };
}

/**
 * WriteFile unified response type
 */
export type WriteFileUnifiedResponse = WriteFileSuccess | WriteFileFailure;

/**
 * Directory Delete API LLM-Optimized Types
 */

/**
 * Directory Delete failure reasons
 */
export type DirectoryDeleteFailureReason = 
  | "path_not_absolute"
  | "directory_not_empty"
  | "permission_denied"
  | "directory_not_found"
  | "directory_in_use"
  | "operation_failed";

/**
 * Directory Delete success response (simplified)
 */
export interface DirectoryDeleteSuccess {
  /** Always true for successful deletions */
  success: true;
}

/**
 * Directory Delete failure response with actionable solutions
 */
export interface DirectoryDeleteFailure {
  success: false;
  failedInfo: {
    /** Failure reason category */
    reason: DirectoryDeleteFailureReason;
    
    /** Human-readable error message */
    message: string;
    
    /** Provided path that caused the error */
    provided_path?: string;
    
    /** Number of files in directory (for not_empty) */
    file_count?: number;
    
    /** Number of subdirectories (for not_empty) */
    subdirectory_count?: number;
    
    /** Target path for permission errors */
    target_path?: string;
    
    /** Process or application using the directory */
    blocking_process?: string;
    
    /** Sample of files/dirs preventing deletion */
    sample_contents?: string[];
    
    /** Actionable solutions with priorities */
    solutions: PrioritizedSolution[];
  };
}

/**
 * Directory Delete unified response type
 */
export type DirectoryDeleteUnifiedResponse = DirectoryDeleteSuccess | DirectoryDeleteFailure;

/**
 * Unified Delete API Types (Simplified)
 * Common response structure for both file and directory deletion
 */

/**
 * Delete success response (simplified)
 */
export interface DeleteSuccess {
  /** Always true for successful deletions */
  success: true;
}

/**
 * Delete failure reasons
 */
export type DeleteFailureReason = 
  | 'not_found'
  | 'permission_denied'
  | 'in_use'
  | 'not_empty'
  | 'read_only'
  | 'invalid_target'
  | 'unknown_error';

/**
 * Target information for delete operations
 */
export interface DeleteTargetInfo {
  /** Path of the target */
  path: string;
  /** Type of target */
  type: 'file' | 'directory';
  /** Whether target exists */
  exists: boolean;
}

/**
 * Delete failure response with actionable solutions
 */
export interface DeleteFailure {
  success: false;
  failedInfo: {
    /** Failure reason category */
    reason: DeleteFailureReason;
    
    /** Human-readable error message */
    message: string;
    
    /** Target information (minimal) */
    target_info?: DeleteTargetInfo;
    
    /** Actionable solutions with executable parameters */
    solutions: Solution[];
  };
}

/**
 * Unified delete response type
 */
export type UnifiedDeleteResponse = DeleteSuccess | DeleteFailure;

/**
 * Subset of fs/promises for dependency injection
 */
export interface FileSystemPromises extends Pick<typeof import('fs/promises'), 'stat' | 'open' | 'access' | 'constants'> {}
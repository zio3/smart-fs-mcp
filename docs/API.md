# Smart Filesystem MCP - API Reference

## MCP Tools Detailed Reference

### read_file

The primary tool - just read files without ceremony. Now supports partial reads with line ranges.

**Parameters:**
- `path` (required): File path to read
- `encoding`: Text encoding (default: utf8)
- `start_line`: Start line number (1-based, inclusive)
- `end_line`: End line number (1-based, inclusive)

**Response patterns:**
```json
// Success - full file read
{
  "success": true,
  "content": "file contents here...",
  "file_info": {
    "total_lines": 100,
    "returned_lines": 100,
    "line_range": { "start": 1, "end": 100 }
  }
}

// Success - partial read
{
  "success": true,
  "content": "lines 50-75 content...",
  "file_info": {
    "total_lines": 500,
    "returned_lines": 26,
    "line_range": { "start": 50, "end": 75 }
  }
}

// Limit exceeded - partial read suggestions
{
  "success": false,
  "error": {
    "code": "file_too_large",
    "message": "ファイルサイズ（150 KB）が制限（20 KB）を超えています",
    "details": {
      "file_info": {
        "total_lines": 5000,
        "size_bytes": 153600,
        "estimated_tokens": 38400
      },
      "alternatives": {
        "partial_read_available": true,
        "suggestions": [
          "Use start_line and end_line parameters to read specific sections",
          "Example: start_line=1, end_line=500 (reads first 500 lines)",
          "Example: start_line=2500, end_line=3000 (reads middle section)"
        ]
      }
    }
  }
}
```

**Usage examples:**
```javascript
// Read entire file
{ "path": "/path/to/file.txt" }

// Read lines 100-200
{ "path": "/path/to/file.txt", "start_line": 100, "end_line": 200 }

// Read from line 50 to end
{ "path": "/path/to/file.txt", "start_line": 50 }

// Read first 100 lines
{ "path": "/path/to/file.txt", "end_line": 100 }
```

### list_directory

List directory contents with file details and subdirectory summaries.

**Parameters:**
- `path` (required): Directory to list
- `include_hidden`: Include hidden files (default: false)
- `sort_by`: Sort criteria - name/size/modified (default: name)
- `sort_order`: Sort order - asc/desc (default: asc)

**Response format:**
```json
{
  "directory": "/project/src",
  "files": [
    {
      "name": "index.js",
      "size_bytes": 1520,
      "type": "file",
      "last_modified": "2024-07-02T10:30:15Z",
      "extension": ".js"
    }
  ],
  "subdirectories": [
    {
      "name": "components",
      "file_count": 15,
      "folder_count": 3,
      "type": "directory",
      "last_modified": "2024-07-02T09:45:30Z"
    }
  ],
  "summary": {
    "total_files": 2,
    "total_subdirectories": 2,
    "total_size_bytes": 1860,
    "largest_file": {
      "name": "index.js",
      "size_bytes": 1520
    }
  },
  "status": "success"
}
```

### search_content

Powerful grep-like search tool for finding files by name or content using regex patterns.

**Parameters:**
- `file_pattern`: Regex pattern to match file names/paths
- `content_pattern`: Regex pattern to search within file contents
- `extensions`: File extensions to include (e.g., [".js", ".ts"])
- `directory`: Starting directory for search (required)
- `recursive`: Search recursively (default: true)
- `max_depth`: Maximum directory depth (default: 10)
- `exclude_dirs`: Directories to exclude (overrides defaults)
- `userDefaultExcludeDirs`: Use user-friendly default excludes (default: true)
- `case_sensitive`: Case-sensitive search (default: false)
- `whole_word`: Match whole words only (default: false)
- `max_files`: Maximum results to return (default: 100, max: 500)
- `max_matches_per_file`: Maximum matches per file (default: 10)

**Note:** At least one of `file_pattern`, `content_pattern`, or `extensions` must be specified.

**Response format:**
```json
{
  "search_info": {
    "pattern": "TODO|FIXME",
    "search_type": "content",
    "total_files_scanned": 150,
    "search_time_ms": 234
  },
  "results": [{
    "file_path": "src/index.ts",
    "file_size_bytes": 1520,
    "content_matches": 3,
    "last_modified": "2024-07-02T10:30:15Z",
    "content_preview": "// TODO: Add error handling",
    "match_context": ["line before", "matching line", "line after"]
  }],
  "summary": {
    "total_matches": 15,
    "files_with_matches": 8,
    "next_actions": ["High matches in src/index.ts → read_file('src/index.ts')"]
  },
  "status": "success"
}
```

### write_file

Write content to a file with smart size warnings and LLM-friendly error handling.

**Parameters:**
- `path` (required): File path to write
- `content` (required): Content to write to the file
- `encoding`: Text encoding (default: utf8)

**Features:**
- Overwrites existing files without prompting (Git-first approach)
- Warns for files over 1MB, blocks over 10MB
- Creates parent directories automatically
- Token estimation for LLM awareness

### edit_file

Edit files with two approaches: simple string replacement or regex patterns.

**Parameters:**
- `path` (required): File to edit
- `edits` (required): Array of edit operations
- `dry_run`: Preview changes without applying (default: false)
- `preserve_formatting`: Preserve indentation and remove trailing spaces (default: true)

**Edit operations:**
```javascript
// Simple format (NEW - Recommended)
{ oldText: 'console.log', newText: 'logger.info' }

// Literal edit (legacy format)
{ type: 'literal', old_text: 'console.log', new_text: 'logger.info' }

// Regex edit
{ type: 'regex', pattern: 'TODO:\\s*(.+)$', replacement: 'DONE: $1', flags: 'gm' }

// Diff edit (Git-style patch)
{ type: 'diff', diff_content: '--- a/file.js\n+++ b/file.js\n@@ -1,3 +1,3 @@\n-old line\n+new line', base_version_check: true }
```

**Response includes:**
- `diff_output`: Git-style unified diff of all changes
- `formatting_info`: Detected indent style, size, line endings
- `lines_changed`: Total number of lines modified

### move_file

Move, rename, or backup files with safety checks.

**Parameters:**
- `source` (required): Source file path
- `destination` (required): Destination file path
- `overwrite_existing`: Allow overwriting existing files (default: false)

### delete_file

Delete a file with safety checks and importance assessment.

**Parameters:**
- `path` (required): File path to delete
- `force`: Force deletion of read-only files (default: false)

**Response patterns:**
```json
// Success with warnings for critical files
{
  "status": "warning",
  "deleted_file": {
    "path": "package.json",
    "size_bytes": 2840,
    "was_readonly": false
  },
  "safety_info": {
    "file_importance": "critical",
    "backup_recommended": true,
    "warnings": ["Critical file deleted: package.json"]
  },
  "alternatives": {
    "suggestions": ["Use move_file to create backup first"]
  }
}
```

### delete_directory

Delete a directory with optional dry-run preview and comprehensive safety checks.

**Parameters:**
- `path` (required): Directory path to delete
- `recursive`: Delete directory contents recursively (default: false)
- `force`: Force deletion of read-only files (default: false)
- `dry_run`: Preview deletion without executing (default: false)
- `max_preview_files`: Maximum files to show in preview (default: 10)

**Dry-run response:**
```json
{
  "status": "warning",
  "preview": {
    "total_files": 2847,
    "total_directories": 156,
    "total_size_bytes": 125829120,
    "estimated_time_ms": 14235,
    "files_to_delete": [
      {
        "path": "node_modules/react/package.json",
        "importance": "important",
        "size_bytes": 1520
      }
    ],
    "critical_files_found": [],
    "truncated": true
  },
  "safety_warnings": {
    "risk_level": "high",
    "warnings": ["Large deletion: 2847 files (120MB total)"],
    "recommendations": ["Use 'npm install' to restore if needed"]
  }
}
```

### move_directory

Move or rename a directory with optional preview and safety checks.

**Parameters:**
- `source` (required): Source directory path
- `destination` (required): Destination directory path
- `overwrite_existing`: Overwrite existing destination directory (default: false)
- `dry_run`: Preview operation without executing (default: false)

### list_allowed_dirs

List all directories the server is allowed to access.

**Parameters:** None

### file_info

Get detailed information about a file or directory.

**Parameters:**
- `path` (required): File or directory path
- `include_analysis`: Include detailed file analysis (default: true)

### mkdir

Create a directory with automatic parent directory creation.

**Parameters:**
- `path` (required): Directory path to create
- `recursive`: Create parent directories if needed (default: true)
- `mode`: Unix-style permissions (default: "0755")

### get_default_exclude_dirs

Get the default exclude directories for search operations.

**Parameters:**
- `userDefaultExcludeDirs`: Use user-friendly defaults (default: true)

**Response format:**
```json
{
  "success": true,
  "excludeDirs": ["node_modules", ".git", "dist", ...],
  "type": "user_default",
  "description": "開発者向けに最適化された除外ディレクトリ一覧"
}
```

**Types:**
- `user_default`: Comprehensive list optimized for development (default)
- `minimal`: Only essential exclusions (node_modules, .git)

## REST API Reference

**Base URL:** `http://localhost:3000/api`

### File Operations

#### GET /files/info
Get file information
- Query params: `path` (required)

#### GET /files/content
Read file content
- Query params: `path` (required), `encoding` (optional)

#### POST /files/content
Write file content
- Body: `{ path, content, encoding? }`

#### PUT /files/edit
Edit file content
- Body: `{ path, edits, dry_run?, preserve_formatting? }`

#### POST /files/move
Move or rename file
- Body: `{ source, destination, overwrite_existing? }`

#### DELETE /files
Delete a file
- Query params: `path` (required), `force` (optional)

### Directory Operations

#### GET /directories/list
List directory contents
- Query params: `path` (required), `include_hidden?`, `sort_by?`, `sort_order?`

#### POST /directories
Create directory
- Body: `{ path, recursive?, mode? }`

#### DELETE /directories
Delete directory
- Query params: `path` (required), `recursive?`, `force?`, `dry_run?`

#### POST /directories/move
Move or rename directory
- Body: `{ source, destination, overwrite_existing?, dry_run? }`

### Search Operations

#### POST /search/content
Search for files by name or content
- Body: `{ file_pattern?, content_pattern?, directory?, recursive?, max_depth?, extensions?, exclude_dirs?, case_sensitive?, whole_word?, max_files? }`

#### GET /search/content
Search with query parameters
- Query params: Same as POST body parameters

### System Operations

#### GET /allowed-dirs
List allowed directories

#### GET /health
Health check endpoint

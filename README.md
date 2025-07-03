# Smart Filesystem MCP (Simple-First Edition)

A **simple-first** Model Context Protocol (MCP) server that provides LLM-optimized filesystem operations with **complete CRUD support**. Most operations complete with a single command - complexity only appears when you hit limits or perform dangerous operations.

## 🎯 Design Philosophy: Simple First

- **One-step operations**: `read_file` just works for most files
- **Smart error handling**: Detailed info + alternatives only when limits are exceeded  
- **Progressive disclosure**: Start simple, add detail only when needed
- **Minimal friction**: No preview → analyze → read chains
- **Safety-first deletions**: `delete_directory` requires dry-run preview for large operations
- **Stateless design**: All path parameters require absolute paths

### 🏗️ Stateless Architecture

**Absolute Path Requirement** - All file and directory operations require absolute paths:
- ❌ Relative paths (`./file.txt`, `../parent/`) are rejected
- ✅ Absolute paths (`/home/user/file.txt`, `C:\Users\file.txt`) are required
- 🎯 **Eliminates hidden state dependency** on startup directory (`process.cwd()`)
- 🔍 **Enables predictable behavior** - same path always refers to same file
- 🤖 **LLM-optimized** - removes external state that LLMs cannot access
- 🐛 **Simplifies debugging** - logs and errors show exact file locations

## 🔧 Complete Filesystem Operations

**Create:** `write_file`, `mkdir`  
**Read:** `read_file`, `read_file_force`, `list_directory`, `search_content`, `file_info`  
**Update:** `edit_file`, `move_file`, `move_directory`  
**Delete:** `delete_file`, `delete_directory` (with dry-run safety)

## 🌐 REST API Mode

**NEW:** HTTP API server with SwaggerUI for browser-based testing and CURL access.

```bash
# Start API server
npm run api:dev

# Access SwaggerUI
http://localhost:3000/api-docs

# Test with CURL (note: absolute paths required)
curl "http://localhost:3000/api/files/info?path=/absolute/path/to/package.json"
```

**Benefits:**
- **Claude Desktop**: Test via browser and CURL
- **Pre-MCP Debugging**: Validate tools before MCP registration  
- **SwaggerUI**: Interactive API documentation
- **Localhost Only**: Secure 127.0.0.1 binding

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/smart-fs-mcp.git
cd smart-fs-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Running as MCP Server

```bash
# Run with default security (current directory only)
npm start

# Run with specific allowed directories
node dist/index.js /Users/username/projects /Users/username/documents

# Run in development mode
npm run dev /path/to/allowed/dir1 /path/to/allowed/dir2
```

### Running as REST API Server

```bash
# Development server with auto-reload
npm run api:dev

# Production build and start
npm run api:build
npm run api:start

# With custom allowed directories
ALLOWED_DIRS="/Users/username/projects,/Users/username/documents" npm run api:dev
```

**API Endpoints:**
- **SwaggerUI**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health
- **API Root**: http://localhost:3000/api

### Simple Usage Examples

```bash
# Just read a file - it works!
read_file("package.json")
# → Returns content directly

# Large file? Get helpful info instead of an error
read_file("large-log-file.log")  
# → Returns preview + suggestions + force option

# Need the large file anyway?
read_file_force("large-log-file.log", acknowledge_risk=true)
# → Returns full content
```

### REST API Examples

```bash
# File Operations
curl "http://localhost:3000/api/files/info?path=./package.json"

curl "http://localhost:3000/api/files/content?path=./README.md"

curl -X POST http://localhost:3000/api/files/content \
  -H "Content-Type: application/json" \
  -d '{"path": "./test.txt", "content": "Hello World"}'

curl -X PUT http://localhost:3000/api/files/edit \
  -H "Content-Type: application/json" \
  -d '{"path": "./config.js", "edits": [{"oldText": "console.log", "newText": "logger.info"}], "dry_run": true}'

# Directory Operations
curl "http://localhost:3000/api/directories/list?path=./src&include_hidden=true"

curl -X POST http://localhost:3000/api/directories \
  -H "Content-Type: application/json" \
  -d '{"path": "./new-folder"}'

curl -X DELETE "http://localhost:3000/api/directories?path=./temp&recursive=true&dry_run=true"

# Search Operations
curl -X POST http://localhost:3000/api/search/content \
  -H "Content-Type: application/json" \
  -d '{"content_pattern": "TODO|FIXME", "directory": "./src", "extensions": [".js", ".ts"]}'

curl "http://localhost:3000/api/search/content?content_pattern=SafetyController&directory=./src"
```

## 🔧 MCP Tools

### read_file

The primary tool - just read files without ceremony.

**Parameters:**
- `path` (required): File path to read
- `encoding`: Text encoding (default: utf8)

**Response patterns:**
```json
// Success - you get the content
{
  "status": "success",
  "content": "file contents here..."
}

// Limit exceeded - you get helpful info
{
  "status": "size_exceeded",
  "file_info": { "size_bytes": 2097152, "estimated_tokens": 524288 },
  "preview": { 
    "first_lines": ["line 1", "line 2", "..."],
    "content_summary": "Large log file"
  },
  "alternatives": {
    "force_read_available": true,
    "suggestions": ["Use read_file_force to read anyway", "..."]
  }
}
```

### read_file_force

When you really need that large file.

**Parameters:**
- `path` (required): File path to read
- `acknowledge_risk` (required): Must be true
- `max_size_mb`: Maximum size to allow (default: 50MB)
- `encoding`: Text encoding (default: utf8)

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
- `directory`: Starting directory for search (default: current)
- `recursive`: Search recursively (default: true)
- `max_depth`: Maximum directory depth (default: 10)
- `extensions`: File extensions to include (e.g., [".js", ".ts"])
- `exclude_dirs`: Directories to exclude (default: ["node_modules", ".git"])
- `case_sensitive`: Case-sensitive search (default: false)
- `whole_word`: Match whole words only (default: false)
- `max_files`: Maximum results to return (default: 100, max: 500)

**Example usage:**
```javascript
// Find all TypeScript files
search_content({ file_pattern: ".*\\.ts$", directory: "./src" })

// Search for TODO comments
search_content({ content_pattern: "TODO|FIXME", extensions: [".js", ".ts"] })

// Find function definitions
search_content({ 
  content_pattern: "function fetchUser|const fetchUser", 
  extensions: [".js", ".ts"],
  case_sensitive: true
})
```

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

**Example usage:**
```javascript
// Simple write
write_file({ path: "config.json", content: '{"debug": true}' })

// Large content warning
write_file({ path: "data.json", content: largeJsonData })
// → Returns warning with size info and suggestions
```

### edit_file - Smart Replacement

Edit files with two approaches: simple string replacement (recommended for 90% of cases) or regex patterns for complex patterns.

**Parameters:**
- `path` (required): File to edit
- `edits` (required): Array of edit operations
- `dry_run`: Preview changes without applying (default: false)
- `preserve_formatting`: Preserve indentation and remove trailing spaces (default: true)

#### 🔧 Simple Replacement (Recommended for 90% of cases)
```javascript
{
  path: "./config.js",
  edits: [
    { oldText: "PORT = 3000", newText: "PORT = 8080" },
    { oldText: "localhost", newText: "0.0.0.0" }
  ]
}
```

**Use when:**
- Exact string matches
- Simple configuration changes
- One-to-one replacements

#### 🎯 Regex Replacement (For complex patterns)
```javascript
{
  path: "./models.js", 
  edits: [
    {
      type: "regex",
      pattern: "const\\s+user\\d+\\s*=",
      replacement: "const user =",
      flags: "g"
    }
  ]
}
```

**Use when:**
- Multiple similar patterns need unified replacement
- Whitespace normalization
- Numbered variable renaming
- Comment format changes

#### 🔄 Mixed Editing
You can combine both approaches in a single request for optimal efficiency.

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

**Smart features:**
- Git-style unified diff output for all edit types in dry_run mode
- Automatic indentation detection and preservation
- Trailing whitespace removal
- Multiple match warnings with sample locations
- ReDoS protection with regex timeout
- Risk assessment for large-scale changes
- LCS-based diff generation for accurate change detection

**Example usage:**
```javascript
// Simple replacement (RECOMMENDED)
edit_file({
  path: "app.js",
  edits: [
    { oldText: 'var', newText: 'const' },
    { oldText: 'require(', newText: 'import(' }
  ]
})

// Preview changes before applying
edit_file({
  path: "config.js",
  edits: [
    { oldText: "PORT = 3000", newText: "PORT = 8080" }
  ],
  dry_run: true
})
// → Shows unified diff preview

// Regex for complex patterns
edit_file({
  path: "src/index.js",
  edits: [
    { type: 'regex', pattern: 'console\\.log\\(', replacement: 'logger.debug(' }
  ],
  dry_run: true
})
// → Shows match count, samples, and unified diff

// Mixed editing
edit_file({
  path: "app.js",
  edits: [
    { oldText: "// TODO: implement", newText: "// DONE: implemented" },
    { type: 'regex', pattern: '\\s*console\\.log\\([^)]*\\);?', replacement: '', flags: 'g' }
  ]
})
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

**Features:**
- Detects operation type (move/rename/backup)
- Warns before overwriting existing files
- Cross-device move support
- Size limit: 100MB

**Example usage:**
```javascript
// Rename file
move_file({ source: "old-name.js", destination: "new-name.js" })

// Backup before editing
move_file({ 
  source: "config.json", 
  destination: "backup/config.json.bak" 
})

// Move with overwrite
move_file({ 
  source: "temp/data.json", 
  destination: "data/data.json",
  overwrite_existing: true
})
```

### list_allowed_dirs

List all directories the server is allowed to access.

**Parameters:** None

**Response includes:**
- List of allowed directories with access status
- Platform information (OS, case sensitivity)
- Security summary (accessible, read-only directories)

**Example usage:**
```javascript
list_allowed_dirs()
// → Returns allowed directories, their status, and platform info
```

### file_info

Get detailed information about a file or directory.

**Parameters:**
- `path` (required): File or directory path
- `include_analysis`: Include detailed file analysis (default: true)

**Features:**
- Basic stats (size, dates, permissions)
- File type detection and language identification
- Token estimation for LLM safety
- Directory content summary

**Example usage:**
```javascript
// Get full file info
file_info({ path: "src/index.js" })

// Skip detailed analysis for faster response
file_info({ path: "large-file.bin", include_analysis: false })
```

### mkdir

Create a directory with automatic parent directory creation.

**Parameters:**
- `path` (required): Directory path to create
- `recursive`: Create parent directories if needed (default: true)
- `mode`: Unix-style permissions (default: "0755")

**Features:**
- Creates parent directories automatically
- Reports which directories were created
- Platform-aware permissions handling

**Example usage:**
```javascript
// Create nested directories
mkdir({ path: "project/src/components/ui" })

// Create single directory only
mkdir({ path: "temp", recursive: false })

// With custom permissions (Unix only)
mkdir({ path: "secure", mode: "0700" })
```

### delete_file

Delete a file with safety checks and importance assessment.

**Parameters:**
- `path` (required): File path to delete
- `force`: Force deletion of read-only files (default: false)

**Features:**
- Critical file detection (package.json, .env files, etc.)
- Important file pattern matching (config files, certificates, etc.)
- Read-only file handling
- Comprehensive safety warnings
- Constructive error messages with alternatives

**Example usage:**
```javascript
// Delete normal file
delete_file({ path: "temp/cache.txt" })

// Force delete read-only file
delete_file({ path: "readonly.txt", force: true })

// Critical file deletion (shows warnings)
delete_file({ path: "package.json" })
```

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

**Features:**
- **Dry-run preview** with file listing and risk assessment
- Critical file detection in subdirectories
- Deletion time estimation
- Risk level assessment (low/medium/high/critical)
- Smart suggestions for safer approaches
- Progress tracking for large deletions

**Example usage:**
```javascript
// Preview deletion first (recommended)
delete_directory({ path: "node_modules", recursive: true, dry_run: true })

// Execute deletion after preview
delete_directory({ path: "node_modules", recursive: true })

// Delete empty directory
delete_directory({ path: "empty-folder" })
```

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

**Features:**
- Operation type detection (move/rename/backup)
- Directory size calculation and time estimation
- Overwrite protection with preview
- Cross-device move support
- Comprehensive error handling

**Example usage:**
```javascript
// Preview directory move
move_directory({ 
  source: "old-project", 
  destination: "new-project", 
  dry_run: true 
})

// Rename directory in same location
move_directory({ source: "temp", destination: "temporary" })

// Move to different location with overwrite
move_directory({ 
  source: "project", 
  destination: "backup/project.old",
  overwrite_existing: true
})
```

## 🛡️ Safety Features

### Security Model (FileSystem MCP Compatible)
- **Allowed Directory Restriction**: Server can only access explicitly allowed directories
- **Path Traversal Prevention**: Blocks `../` and other escape attempts
- **Windows Case-Insensitive Support**: Proper security on Windows filesystems
- **Secure by Default**: Only current directory accessible without configuration

### Smart Limits
- Default file size: 1MB (automatic preview if exceeded)
- Force read max: 50MB (hard limit)
- Directory listing: 1000 files warning threshold
- Operation timeout: 10 seconds for directory listing
- Clear feedback when limits are hit

### What Makes It "Smart"
- Binary file detection with helpful file type info
- Token estimation to prevent LLM overload
- Content preview in error responses
- Contextual suggestions based on file type

### Security Configuration
```bash
# Start server with allowed directories
node dist/index.js /home/user/projects /home/user/documents

# Security error example
{
  "error": "Access denied",
  "reason": "Path outside allowed directories",
  "allowed_directories": ["/home/user/projects", "/home/user/documents"],
  "attempted_path": "/etc/passwd",
  "suggestion": "Use list_allowed_dirs to see accessible paths"
}
```

## 🏗️ Architecture

```
src/
├── core/
│   ├── safety-controller.ts  # Safety validation
│   ├── file-analyzer.ts      # File analysis
│   ├── search-engine.ts      # Search engine core
│   └── types.ts             # TypeScript types
├── tools/
│   ├── read-file.ts         # Smart file reading
│   ├── read-file-force.ts   # Force reading
│   ├── list-directory.ts    # Directory listing
│   ├── search-content.ts    # Grep-like search
│   ├── write-file.ts        # File writing
│   ├── edit-file.ts         # File editing
│   ├── move-file.ts         # File moving/renaming
│   ├── delete-file.ts       # File deletion with safety
│   ├── delete-directory.ts  # Directory deletion with preview
│   ├── move-directory.ts    # Directory moving/renaming
│   ├── list-allowed-dirs.ts # Allowed directories
│   ├── file-info.ts         # File information
│   └── mkdir.ts             # Directory creation
├── utils/
│   ├── regex-validator.ts   # Regex validation & ReDoS protection
│   └── helpers.ts           # Utility functions
└── index.ts                 # MCP server
```

## 🧪 CLI Testing

```bash
# Test file reading
npm run cli read package.json

# Test large file handling
npm run cli read /var/log/system.log

# Test directory listing  
npm run cli list ./src --hidden --sort size

# Test file search
npm run cli search -f ".*\\.ts$" ./src                    # Find TypeScript files
npm run cli search -c "TODO|FIXME" --extensions .js .ts   # Find TODOs
npm run cli search -c "function.*Error" -s -w             # Case-sensitive whole-word

# Test file write
npm run cli write test.txt -c "Hello World"               # Write with content option
echo "Hello World" | npm run cli write test.txt           # Write from stdin

# Test file edit
npm run cli edit config.js -l "console.log,logger.info" --dry-run  # Simple replacement
npm run cli edit test.js -l "PORT = 3000,PORT = 8080"              # Config change
npm run cli edit app.js -l "localhost,0.0.0.0" -l "var,const"      # Multiple replacements
npm run cli edit test.js -r "TODO.*$,DONE" -d                      # Preview regex edit
npm run cli edit app.js -f patch.diff                               # Apply diff from file
cat changes.diff | npm run cli edit app.js -f -                    # Apply diff from stdin
npm run cli edit code.js -l "var,const" -p false                   # Disable formatting

# Test file move
npm run cli move old-name.js new-name.js                  # Rename file
npm run cli move important.js backup/important.js.bak -o  # Backup with overwrite

# Test security features
npm run cli list-allowed                                   # Show allowed directories
npm run cli info src/index.js                            # Get detailed file info
npm run cli mkdir new/deep/directory                       # Create nested directories
npm run cli delete temp/cache.txt                         # Delete a file
npm run cli delete readonly.txt --force                   # Force delete read-only file
npm run cli rmdir node_modules --recursive --dry-run      # Preview directory deletion
npm run cli rmdir empty-dir                               # Delete empty directory
npm run cli movedir old-folder new-folder                 # Move/rename directory
npm run cli movedir project backup/project.old --overwrite # Move with overwrite
npm run cli security-test /etc/passwd                      # Test security (should fail)

# Run with custom allowed directories
npm run cli /path/to/allowed/dir1 /path/to/allowed/dir2 list-allowed
```

## 📋 Common Patterns

### Reading Code Files
```javascript
// Just try to read it
read_file("src/large-component.tsx")

// If too large, you'll get:
// - First 20 lines preview
// - File size and token estimate  
// - "React TypeScript component" summary
// - Suggestion to search for specific functions
```

### Handling Large Logs
```javascript
// First attempt
read_file("/var/log/app.log")

// Returns preview + size info
// If you need it all:
read_file_force("/var/log/app.log", acknowledge_risk=true)
```

### Exploring Directories
```javascript
// List directory with details
list_directory("./src")

// Include hidden files and sort by size
list_directory("./src", include_hidden=true, sort_by="size", sort_order="desc")
```

## 🤝 Contributing

1. Keep the simple-first philosophy
2. Don't add steps that could be automatic
3. Test with real-world file sizes
4. Make error messages helpful, not preachy

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Why Simple-First?

Traditional MCP tools often require multiple steps: check → analyze → preview → read. This tool recognizes that most of the time, you just want to read the file. Complexity should only appear when actually needed, not as a precaution.
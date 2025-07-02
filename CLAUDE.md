# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart Filesystem MCP is a **simple-first** Model Context Protocol (MCP) server that provides LLM-optimized filesystem operations. The key design principle is to minimize the number of operations needed - most tasks should complete with a single `read_file` command.

## Key Design Philosophy: Simple First

1. **Basic operations work like normal**: `read_file` returns content directly when safe
2. **Smart error handling**: Only provides detailed information when limits are exceeded
3. **One-step workflow**: No need for preview/analyze/read chains
4. **Progressive disclosure**: Detailed info and alternatives only when needed

## Key Development Commands

```bash
# Install dependencies
npm install

# Build the TypeScript project
npm run build

# Run in development mode
npm run dev

# Run type checking
npm run typecheck

# Run linting
npm run lint

# CLI testing commands
npm run cli list <directory>    # Test directory listing
npm run cli read <file>         # Test file reading
npm run cli search [directory]  # Test search functionality
```

## Architecture Overview

### Core Components

1. **SafetyController** (`src/core/safety-controller.ts`)
   - Validates operations before execution
   - Enforces size and timeout limits
   - Key methods: `validateFileAccess()`, `enforceTimeout()`

2. **FileAnalyzer** (`src/core/file-analyzer.ts`)
   - Analyzes files for type, encoding, and token count
   - Used primarily for error responses
   - Key methods: `analyzeFile()`, `detectFileType()`

3. **MCP Tools** (Simple-first approach)
   - `read_file`: Smart file reading with automatic fallback to detailed errors
   - `force_read_file`: Override limits with explicit acknowledgment
   - `list_directory`: Directory listing with file details and subdirectory summaries
   - `search_files`: Grep-like search for files by name or content using regex patterns
   - `write_file`: Write content to files with automatic directory creation
   - `edit_file`: Edit files using literal or regex replacements with preview
   - `move_file`: Move, rename, or backup files with overwrite protection

### Tool Usage Patterns

#### read_file - The Primary Tool

```typescript
// Success case - returns content directly
{
  "tool": "read_file",
  "arguments": { "path": "./small-file.txt" }
}
// Response: { "status": "success", "content": "file contents..." }

// Limit exceeded - returns detailed info
{
  "tool": "read_file", 
  "arguments": { "path": "./large-file.log" }
}
// Response: {
//   "status": "size_exceeded",
//   "file_info": { size, tokens, type },
//   "preview": { first_lines, content_summary },
//   "alternatives": { force_read_available, suggestions }
// }
```

#### force_read_file - When You Need It

```typescript
// After seeing size_exceeded, force read if needed
{
  "tool": "force_read_file",
  "arguments": { 
    "path": "./large-file.log",
    "acknowledge_risk": true
  }
}
```

#### search_files - Powerful Search

```typescript
// Find files by name
{
  "tool": "search_files",
  "arguments": { 
    "file_pattern": ".*\\.test\\.ts$",
    "directory": "./src"
  }
}

// Search content with regex
{
  "tool": "search_files",
  "arguments": {
    "content_pattern": "TODO|FIXME|HACK",
    "extensions": [".js", ".ts"]
  }
}

// Combined search
{
  "tool": "search_files",
  "arguments": {
    "file_pattern": "config",
    "content_pattern": "database.*url",
    "case_sensitive": true
  }
}
```

### Key Safety Limits

- Default file size: 1MB (returns preview if exceeded)
- Force read maximum: 50MB
- Search timeout: 30 seconds
- Maximum search results: 500 files
- Regex pattern length: 1000 characters 
- Directory scan default: 1000 files
- Token warning: 50,000 tokens
- Operation timeouts: 5-30 seconds

## Development Guidelines

### Adding New Features

1. Maintain the simple-first philosophy
2. Default to returning results directly
3. Only add complexity when limits are hit
4. Provide actionable alternatives in error responses

### Error Response Structure

When limits are exceeded, provide:
- Clear reason for the limitation
- File/directory metadata
- Preview of content (if applicable)  
- Specific suggestions for next steps
- Available force options

### Testing Approach

```bash
# Test successful read
npm run cli read package.json

# Test large file handling
npm run cli read large-file.log

# Test directory listing
npm run cli list ./src --hidden --sort size
```

## Common Workflows

### Reading Files

1. Always try `read_file` first
2. If size exceeded, check the preview in the response
3. Use `force_read_file` only if you need the full content

### Listing Directories

1. Use `list_directory` to get files and subdirectory summaries
2. Includes file sizes, modification dates, and subdirectory counts
3. Warnings provided for large directories (>1000 files)
4. Sort options available: name, size, or modified date

### Handling Binary Files

- `read_file` will detect and report binary files
- Provides file type information in the error response
- Suggests appropriate tools for the file type

## Important Notes

- The project uses ES modules (`"type": "module"`)
- All imports must include `.js` extension
- Simple operations should complete in one step
- Complex workflows are discouraged - keep it simple
- Cross-platform paths are handled automatically
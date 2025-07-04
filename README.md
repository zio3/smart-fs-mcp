# Smart Filesystem MCP (Simple-First Edition)

[![npm version](https://badge.fury.io/js/@zio3%2Fsmart-fs-mcp.svg)](https://www.npmjs.com/package/@zio3/smart-fs-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@zio3/smart-fs-mcp.svg)](https://nodejs.org)

A **simple-first** Model Context Protocol (MCP) server that provides LLM-optimized filesystem operations with **complete CRUD support**. Designed to be used with Claude Desktop or other MCP-compatible clients. Most operations complete with a single command - complexity only appears when you hit limits or perform dangerous operations.

## 🎯 Key Features

- **One-step operations**: `read_file` just works for most files
- **Smart error handling**: Detailed info + alternatives only when limits are exceeded
- **Safety-first**: Sandboxed directory access, dry-run previews for deletions
- **LLM-optimized**: Token estimation, content previews, and helpful suggestions
- **Complete CRUD**: Create, Read, Update, Delete for both files and directories
- **REST API Mode**: SwaggerUI for browser-based testing and CURL access

## 📋 Requirements

- Node.js >= 18.0.0
- Operating System: Windows, macOS, Linux
- For MCP integration: Claude Desktop or compatible MCP client

## 🚀 Quick Start

### Using with Claude Desktop

You have two options:

1. **Use directly with npx** (recommended - no installation required)
2. **Install globally** (if you prefer)

```bash
# Option 2: Global installation
npm install -g @zio3/smart-fs-mcp
```

### Configure Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

#### Option 1: Use with npx (no installation required)
```json
{
  "mcpServers": {
    "smart-fs-mcp": {
      "command": "npx",
      "args": ["@zio3/smart-fs-mcp", "/path/to/allowed/dir1", "/path/to/allowed/dir2"]
    }
  }
}
```

#### Option 2: Use with global installation
```json
{
  "mcpServers": {
    "smart-fs-mcp": {
      "command": "smart-fs-mcp",
      "args": ["/path/to/allowed/dir1", "/path/to/allowed/dir2"]
    }
  }
}
```

### Manual Testing

```bash
# Test the MCP server directly
smart-fs-mcp                                    # Current directory only
smart-fs-mcp /path/to/dir1 /path/to/dir2       # Specific directories
```

### Development & Debugging

#### Local Development
```bash
# Clone and install dependencies
git clone https://github.com/zio3/smart-fs-mcp.git
cd smart-fs-mcp
npm install

# Run in development mode
npm run dev /path/to/allowed/dir1
```

#### REST API Mode (for testing without MCP)
```bash
# Start API server
npm run api:dev

# Access SwaggerUI at http://localhost:3000/api-docs
```

This is useful for testing the tools before using them in Claude Desktop.

## 🔧 Available Tools

### File Operations
- `read_file` - Read files with automatic size handling
- `read_file_force` - Force read large files (up to 50MB)
- `write_file` - Write content with parent directory creation
- `edit_file` - Smart text replacement or regex editing
- `move_file` - Move, rename, or backup files
- `delete_file` - Delete with safety checks

### Directory Operations
- `list_directory` - List contents with details
- `mkdir` - Create directories recursively
- `move_directory` - Move or rename directories
- `delete_directory` - Delete with dry-run preview

### Search & Info
- `search_content` - Grep-like search with regex support
- `file_info` - Detailed file/directory information
- `list_allowed_dirs` - Show accessible directories

## 🛡️ Safety Features

- **Sandboxed Access**: Only explicitly allowed directories are accessible
- **Path Traversal Protection**: Blocks `../` and other escape attempts
- **Size Limits**: 1MB default, 50MB force-read maximum
- **Critical File Detection**: Warnings for important files (package.json, .env, etc.)
- **Dry-Run Previews**: Preview deletions before execution

## 📖 Documentation

- [API Reference](docs/API.md) - Detailed tool specifications and REST API
- [CLI Guide](docs/CLI.md) - Command-line usage examples

## 🤝 Contributing

1. Keep the simple-first philosophy
2. Don't add steps that could be automatic
3. Test with real-world file sizes
4. Make error messages helpful, not preachy

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Why Simple-First?

Traditional MCP tools often require multiple steps: check → analyze → preview → read. This tool recognizes that most of the time, you just want to read the file. Complexity should only appear when actually needed, not as a precaution.

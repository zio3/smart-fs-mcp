# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-07-04

### Added
- Initial release of smart-fs-mcp
- LLM-optimized filesystem operations with MCP protocol
- Safety controls and token usage optimization
- Unified error handling with Japanese messages
- Support for file reading, writing, editing, searching, and directory operations
- CLI interface for testing and development
- REST API server mode with Swagger documentation
- Comprehensive test suite

### Security
- Path traversal attack prevention
- File size limitations with configurable overrides
- Operation timeouts
- Sandboxed directory access control

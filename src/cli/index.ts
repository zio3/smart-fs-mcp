#!/usr/bin/env node
/**
 * Smart Filesystem MCP - CLI Test Interface
 * Command-line interface for testing MCP tools
 */

import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import chalk from 'chalk';
import * as path from 'path';
import { SafetyController } from '../core/safety-controller.js';
import { FileAnalyzer } from '../core/file-analyzer.js';
import { listDirectory } from '../tools/list-directory.js';
import { readFile } from '../tools/read-file.js';
import { searchContent } from '../tools/search-content.js';
import { writeFile } from '../tools/write-file.js';
// import { editFile } from '../tools/edit-file.js'; // Disabled
import { moveFile } from '../tools/move-file.js';
import { listAllowedDirs } from '../tools/list-allowed-dirs.js';
import { fileInfo } from '../tools/file-info.js';
import { mkdir } from '../tools/mkdir.js';
import { deleteFile } from '../tools/delete-file.js';
import { deleteDirectory } from '../tools/delete-directory.js';
import { moveDirectory } from '../tools/move-directory.js';
import { getDefaultExcludeDirs } from '../tools/get-default-exclude-dirs.js';
import { initializeSecurityController } from '../core/security-controller-v2.js';
import { formatBytes, formatDuration } from '../utils/helpers.js';

// Command definitions
const mainDefinitions = [
  { name: 'command', defaultOption: true },
  { name: 'help', alias: 'h', type: Boolean, description: 'Show help' },
  { name: 'version', alias: 'v', type: Boolean, description: 'Show version' },
];

const listDefinitions = [
  { name: 'path', defaultOption: true, description: 'Directory to list (must be absolute path)' },
  { name: 'extensions', alias: 'e', type: String, description: 'File extensions to include (comma-separated: js,ts,json)' },
  { name: 'exclude-dirs', alias: 'x', type: String, description: 'Directory names to exclude (comma-separated: node_modules,.git)' },
  { name: '__verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
  { name: 'format', type: String, description: 'Output format (table|json)' },
];

const readDefinitions = [
  { name: 'path', defaultOption: true, description: 'File to read' },
  { name: 'encoding', type: String, description: 'Text encoding' },
  { name: 'start-line', alias: 's', type: Number, description: 'Start line number (1-based, inclusive)' },
  { name: 'end-line', alias: 'e', type: Number, description: 'End line number (1-based, inclusive)' },
  { name: '__verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const searchDefinitions = [
  { name: 'file-pattern', alias: 'f', type: String, description: 'File name pattern (regex)' },
  { name: 'content-pattern', alias: 'c', type: String, description: 'Content pattern (regex)' },
  { name: 'directory', defaultOption: true, description: 'Directory to search' },
  { name: 'extensions', alias: 'e', type: String, description: 'File extensions (comma-separated)' },
  { name: 'exclude-dirs', alias: 'x', type: String, description: 'Directories to exclude' },
  { name: 'case-sensitive', type: Boolean, description: 'Case sensitive search' },
  { name: 'whole-word', type: Boolean, description: 'Whole word matching' },
  { name: 'max-files', type: Number, description: 'Maximum files to scan' },
  { name: 'user-default-exclude', type: Boolean, description: 'Use user default exclude dirs (default: true)' },
  { name: 'no-user-default-exclude', type: Boolean, description: 'Use minimal exclude dirs only' },
  { name: '__verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const writeDefinitions = [
  { name: 'path', defaultOption: true, description: 'File to write' },
  { name: 'content', alias: 'c', type: String, description: 'Content to write' },
  { name: 'stdin', type: Boolean, description: 'Read content from stdin' },
  { name: 'encoding', type: String, description: 'Text encoding' },
  { name: '__verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const editDefinitions = [
  { name: 'path', defaultOption: true, description: 'File to edit' },
  { name: 'old', type: String, description: 'Text to replace' },
  { name: 'new', type: String, description: 'Replacement text' },
  { name: 'diff', type: String, description: 'Apply diff patch (file or string)' },
  { name: 'pattern', type: String, description: 'Regex pattern' },
  { name: 'replacement', type: String, description: 'Regex replacement' },
  { name: 'flags', type: String, description: 'Regex flags' },
  { name: 'dry-run', type: Boolean, description: 'Preview changes only' },
  { name: '__verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const moveDefinitions = [
  { name: 'source', defaultOption: true, description: 'Source file path' },
  { name: 'destination', type: String, description: 'Destination path' },
  { name: 'overwrite', type: Boolean, description: 'Overwrite existing file' },
  { name: '__verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const fileInfoDefinitions = [
  { name: 'path', defaultOption: true, description: 'File or directory path' },
  { name: 'no-analysis', type: Boolean, description: 'Skip file analysis' },
  { name: '__verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const mkdirDefinitions = [
  { name: 'path', defaultOption: true, description: 'Directory path to create' },
  { name: 'no-recursive', type: Boolean, description: 'Do not create parent directories' },
  { name: 'mode', type: String, description: 'Directory permissions' },
  { name: '__verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const deleteDefinitions = [
  { name: 'path', defaultOption: true, description: 'File to delete' },
  { name: 'force', type: Boolean, description: 'Force delete without confirmation' },
  { name: '__verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const deleteDirDefinitions = [
  { name: 'path', defaultOption: true, description: 'Directory to delete' },
  { name: 'dry-run', type: Boolean, description: 'Preview files to be deleted' },
  { name: 'exclude-patterns', type: String, description: 'Patterns to exclude (comma-separated)' },
  { name: '__verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const moveDirDefinitions = [
  { name: 'source', defaultOption: true, description: 'Source directory path' },
  { name: 'destination', type: String, description: 'Destination path' },
  { name: 'merge', type: Boolean, description: 'Merge with existing directory' },
  { name: '__verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const getDefaultExcludeDirsDefinitions = [
  { name: 'minimal', type: Boolean, description: 'Show minimal exclude directories only' },
  { name: '__verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

// Initialize services
const safety = new SafetyController();
const analyzer = new FileAnalyzer();

// Initialize security controller BEFORE using it
await initializeSecurityController();

/**
 * Show help information
 */
function showHelp() {
  const sections = [
    {
      header: 'Smart Filesystem MCP CLI',
      content: 'Test interface for MCP filesystem tools',
    },
    {
      header: 'Commands',
      content: [
        { name: 'list <dir>', summary: 'List directory contents' },
        { name: 'read <file>', summary: 'Read file content (supports partial read with --start-line and --end-line)' },
        { name: 'search [dir]', summary: 'Search files by pattern or content' },
        { name: 'write <file>', summary: 'Write content to file' },
        { name: 'edit <file>', summary: 'Edit file content' },
        { name: 'move <source> <dest>', summary: 'Move or rename file' },
        { name: 'test-all [path]', summary: 'Run all test operations' },
        { name: 'allowed-dirs', summary: 'List allowed directories' },
        { name: 'file-info <path>', summary: 'Get detailed file information' },
        { name: 'mkdir <path>', summary: 'Create directory' },
        { name: 'delete <file>', summary: 'Delete a file' },
        { name: 'rmdir <dir>', summary: 'Delete a directory' },
        { name: 'movedir <source> <dest>', summary: 'Move a directory' },
        { name: 'get-default-exclude-dirs', summary: 'Get default exclude directories for search' },
        { name: 'security-test', summary: 'Test security validation' },
        { name: 'help', summary: 'Show this help' },
      ],
    },
    {
      header: 'Examples',
      content: [
        { name: chalk.gray('# List directory'), example: chalk.yellow('npm run cli list ./src') },
        { name: chalk.gray('# Search for TODO comments'), example: chalk.yellow('npm run cli search -c "TODO" ./src') },
        { name: chalk.gray('# Read a file'), example: chalk.yellow('npm run cli read package.json') },
        { name: chalk.gray('# Read specific lines'), example: chalk.yellow('npm run cli read large.log --start-line 100 --end-line 200') },
        { name: chalk.gray('# Get file info'), example: chalk.yellow('npm run cli file-info README.md') },
      ],
    },
  ];

  console.log(commandLineUsage(sections));
}

/**
 * Main entry point
 */
async function main() {
  const mainOptions = commandLineArgs(mainDefinitions, { partial: true, stopAtFirstUnknown: true });
  
  if (mainOptions.help || !mainOptions.command) {
    showHelp();
    process.exit(0);
  }

  if (mainOptions.version) {
    console.log('1.0.0');
    process.exit(0);
  }

  const argv = mainOptions._unknown || [];

  try {
    switch (mainOptions.command) {
      case 'list':
        await handleList(argv);
        break;
      case 'read':
        await handleRead(argv);
        break;
      case 'search':
        await handleSearch(argv);
        break;
      case 'write':
        await handleWrite(argv);
        break;
      case 'edit':
        await handleEdit(argv);
        break;
      case 'move':
        await handleMove(argv);
        break;
      case 'test-all':
        await handleTestAll(argv);
        break;
      case 'allowed-dirs':
        await handleAllowedDirs();
        break;
      case 'file-info':
        await handleFileInfo(argv);
        break;
      case 'mkdir':
        await handleMkdir(argv);
        break;
      case 'delete':
        await handleDelete(argv);
        break;
      case 'rmdir':
        await handleDeleteDir(argv);
        break;
      case 'movedir':
        await handleMovedir(argv);
        break;
      case 'get-default-exclude-dirs':
        await handleGetDefaultExcludeDirs(argv);
        break;
      case 'security-test':
        await handleSecurityTest(argv);
        break;
      default:
        console.error(chalk.red(`Unknown command: ${mainOptions.command}`));
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Handle list command
 */
async function handleList(argv: string[]) {
  const options = commandLineArgs(listDefinitions, { argv });
  
  if (!options.path) {
    console.error(chalk.red('Error: Directory path required'));
    process.exit(1);
  }

  console.log(chalk.blue('📁 Directory List:'), options.path);
  console.log('═'.repeat(50));

  const params = {
    path: path.resolve(options.path), // Convert to absolute path
    // Note: include_hidden, sort_by, sort_order removed (breaking changes)
    ...(options.extensions && { extensions: options.extensions.split(',') }),
    ...(options['exclude-dirs'] && { exclude_dirs: options['exclude-dirs'].split(',') })
  };

  const startTime = Date.now();
  const result = await listDirectory(params, safety);
  const duration = Date.now() - startTime;

  // Display results
  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    displayListResults(result, options.__verbose || false);
  }

  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
}

/**
 * Handle read command
 */
async function handleRead(argv: string[]) {
  const options = commandLineArgs(readDefinitions, { argv });
  
  if (!options.path) {
    console.error(chalk.red('Error: File path required'));
    process.exit(1);
  }

  console.log(chalk.blue('📄 File Read:'), options.path);
  if (options['start-line'] || options['end-line']) {
    console.log(chalk.gray('  Line range:'), 
      options['start-line'] ? `${options['start-line']}` : '1',
      '-',
      options['end-line'] ? `${options['end-line']}` : 'end'
    );
  }
  console.log('═'.repeat(50));

  const params = {
    path: options.path,
    ...(options['start-line'] && { start_line: options['start-line'] }),
    ...(options['end-line'] && { end_line: options['end-line'] })
  };

  const result = await readFile(params, safety, analyzer);
  
  if (result.success) {
    console.log(result.content);
    if (result.file_info && options.__verbose) {
      console.log(chalk.gray('\n--- File Info ---'));
      console.log(chalk.gray(`Total lines: ${result.file_info.total_lines}`));
      console.log(chalk.gray(`Returned lines: ${result.file_info.returned_lines}`));
      console.log(chalk.gray(`Line range: ${result.file_info.line_range.start}-${result.file_info.line_range.end}`));
    }
  } else {
    displayReadError(result as any, options.__verbose || false);
  }
}

/**
 * Handle search command
 */
async function handleSearch(argv: string[]) {
  const options = commandLineArgs(searchDefinitions, { argv });
  
  if (!options['file-pattern'] && !options['content-pattern'] && !options.extensions) {
    console.error(chalk.red('Error: At least one search criteria required (--file-pattern, --content-pattern, or --extensions)'));
    process.exit(1);
  }

  const directory = options.directory || '.';

  console.log(chalk.blue('🔍 Search:'), directory);
  if (options['file-pattern']) console.log('  File pattern:', options['file-pattern']);
  if (options['content-pattern']) console.log('  Content pattern:', options['content-pattern']);
  console.log('═'.repeat(50));

  // Determine userDefaultExcludeDirs setting
  let userDefaultExcludeDirs = true; // default
  if (options['no-user-default-exclude']) {
    userDefaultExcludeDirs = false;
  } else if (options['user-default-exclude']) {
    userDefaultExcludeDirs = true;
  }

  const params = {
    ...(options['file-pattern'] && { file_pattern: options['file-pattern'] }),
    ...(options['content-pattern'] && { content_pattern: options['content-pattern'] }),
    directory: path.resolve(directory), // Convert to absolute path
    ...(options.extensions && { extensions: options.extensions.split(',') }),
    ...(options['exclude-dirs'] && { exclude_dirs: options['exclude-dirs'].split(',') }),
    ...(options['case-sensitive'] && { case_sensitive: true }),
    ...(options['whole-word'] && { whole_word: true }),
    ...(options['max-files'] && { max_files: options['max-files'] }),
    userDefaultExcludeDirs
  };

  const startTime = Date.now();
  const result = await searchContent(params, safety);
  const duration = Date.now() - startTime;

  if (result.success && 'matches' in result) {
    console.log(chalk.green(`\n✓ Found ${result.matches.length} matching files`));
    displaySearchResults(result, options.__verbose || false);
  } else if (!result.success) {
    console.log(chalk.red('\n❌ Search failed:'));
    console.log(`  Code: ${result.error.code}`);
    console.log(`  Message: ${result.error.message}`);
    if (result.error.suggestions && result.error.suggestions.length > 0) {
      console.log(chalk.yellow('\n💡 Try:'));
      result.error.suggestions.forEach((suggestion, i) => {
        console.log(`  ${i + 1}. ${suggestion}`);
      });
    }
  }

  console.log(chalk.gray(`\n🔍 Search Info:`));
  if ('search_type' in result) {
    console.log(`  Type: ${result.search_type}`);
  }
  if ('search_stats' in result) {
    console.log(`  Files scanned: ${result.search_stats.files_scanned}`);
    console.log(`  Files with matches: ${result.search_stats.files_with_matches}`);
    console.log(`  Total matches: ${result.search_stats.total_matches}`);
    if (result.search_stats.binary_files_skipped) {
      console.log(`  Binary files skipped: ${result.search_stats.binary_files_skipped}`);
    }
    if (result.search_stats.directories_skipped) {
      console.log(`  Directories skipped: ${result.search_stats.directories_skipped}`);
    }
  }
  if ('exclude_info' in result && result.exclude_info) {
    console.log(chalk.gray(`\n📁 Exclude Info:`));
    console.log(`  Exclude source: ${result.exclude_info.exclude_source}`);
    if (result.exclude_info.excluded_dirs_used.length > 0) {
      console.log(`  Excluded dirs: ${result.exclude_info.excluded_dirs_used.join(', ')}`);
    }
    if (result.exclude_info.excluded_dirs_found && result.exclude_info.excluded_dirs_found.length > 0) {
      console.log(chalk.gray(`\n📂 Encountered excluded directories:`));
      result.exclude_info.excluded_dirs_found.forEach((dir: any) => {
        const reasonMap: Record<string, string> = {
          'user_default': 'ユーザーデフォルト',
          'performance': 'パフォーマンス',
          'security': 'セキュリティ',
          'user_specified': 'ユーザー指定',
          'minimal_required': '最小限必須'
        };
        const reason = reasonMap[dir.reason] || dir.reason;
        console.log(`  ${dir.path} (${reason})`);
      });
    }
  }
  
  // 絞り込み提案を表示
  if ('refinement_suggestions' in result && result.refinement_suggestions) {
    console.log(chalk.yellow(`\n🔍 絞り込み提案:`));
    console.log(chalk.yellow(result.refinement_suggestions.message));
    result.refinement_suggestions.options.forEach((option, i) => {
      console.log(chalk.gray(`  ${i + 1}. ${option}`));
    });
  }

  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
}

/**
 * Handle write command
 */
async function handleWrite(argv: string[]) {
  const options = commandLineArgs(writeDefinitions, { argv });
  
  if (!options.path) {
    console.error(chalk.red('Error: File path required'));
    process.exit(1);
  }

  let content: string;
  
  if (options.stdin) {
    // Read from stdin
    content = await readStdin();
  } else if (options.content) {
    content = options.content;
  } else {
    console.error(chalk.red('Error: Content required (use --content or --stdin)'));
    process.exit(1);
  }

  console.log(chalk.blue('✍️  Write File:'), options.path);
  console.log('═'.repeat(50));

  const params = {
    path: options.path,
    content,
    ...(options.encoding && { encoding: options.encoding })
  };

  const startTime = Date.now();
  const result = await writeFile(params, safety);
  const duration = Date.now() - startTime;

  if (result.success) {
    console.log(chalk.green('\n✓ File written successfully'));
    if ('bytes_written' in result) {
      console.log(`  Bytes written: ${result.bytes_written}`);
    }
  } else {
    console.log(chalk.red('\n❌ Write failed:'));
    console.log(`  Code: ${result.error.code}`);
    console.log(`  Message: ${result.error.message}`);
  }

  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
}

/**
 * Handle edit command
 */
async function handleEdit(argv: string[]) {
  const options = commandLineArgs(editDefinitions, { argv });
  
  if (!options.path) {
    console.error(chalk.red('Error: File path required'));
    process.exit(1);
  }

  console.log(chalk.blue('✏️  Edit File:'), options.path);
  console.log('═'.repeat(50));

  const edits: any[] = [];

  // Simple literal replacement
  if (options.old && options.new) {
    edits.push({
      type: 'literal',
      old_text: options.old,
      new_text: options.new
    });
  }

  // Regex replacement
  if (options.pattern && options.replacement !== undefined) {
    edits.push({
      type: 'regex',
      pattern: options.pattern,
      replacement: options.replacement,
      flags: options.flags || 'g'
    });
  }

  // Diff patch
  if (options.diff) {
    let diffContent: string;
    if (options.diff.includes('\n') || options.diff.startsWith('---')) {
      // Direct diff content
      diffContent = options.diff;
    } else {
      // Read from file
      try {
        const fs = await import('fs/promises');
        diffContent = await fs.readFile(options.diff, 'utf8');
      } catch (error) {
        console.error(chalk.red(`Error reading diff file: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    }
    
    edits.push({
      type: 'diff',
      diff_content: diffContent,
      base_version_check: true
    });
  }

  // TEMPORARY: editFile disabled - show error message
  console.error(chalk.red('Edit functionality temporarily disabled during build fix'));
  process.exit(1);
}

/**
 * Handle move command
 */
async function handleMove(argv: string[]) {
  const options = commandLineArgs(moveDefinitions, { argv, stopAtFirstUnknown: true });
  const remainingArgs = argv.slice(argv.indexOf(options.source) + 1);
  
  if (!options.source) {
    console.error(chalk.red('Error: Source path required'));
    process.exit(1);
  }

  const destination = options.destination || remainingArgs[0];
  if (!destination) {
    console.error(chalk.red('Error: Destination path required'));
    process.exit(1);
  }

  console.log(chalk.blue('📦 Move File:'));
  console.log(chalk.gray('  From:'), options.source);
  console.log(chalk.gray('  To:'), destination);
  if (options.overwrite) {
    console.log(chalk.yellow('  Mode: Overwrite enabled'));
  }
  console.log('═'.repeat(50));

  const params = {
    source: options.source,
    destination,
    overwrite_existing: options.overwrite
  };

  const startTime = Date.now();
  const result = await moveFile(params, safety);
  const duration = Date.now() - startTime;

  // Display results
  displayMoveResult(result, options.__verbose || false);
  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
}

/**
 * Handle test-all command
 */
async function handleTestAll(argv: string[]) {
  const testPath = argv[0] || '.';
  
  console.log(chalk.green('🧪 Running all tests on:'), testPath);
  console.log('═'.repeat(50));

  // Test list
  console.log(chalk.yellow('\n📁 Testing directory list...'));
  try {
    const listResult = await listDirectory({ path: path.resolve(testPath) }, safety);
    if (listResult.success) {
      console.log(chalk.green('✓'), `Found ${listResult.summary.file_count} files, ${listResult.summary.directory_count} directories`);
    } else {
      console.log(chalk.yellow('⚠'), `List failed: ${listResult.error.code} - ${listResult.error.message}`);
    }
  } catch (error) {
    console.log(chalk.red('✗'), 'List failed:', error);
  }

  // Test read on package.json
  console.log(chalk.yellow('\n📄 Testing file read...'));
  try {
    const readResult = await readFile({ path: 'package.json' }, safety, analyzer);
    if (readResult.success) {
      console.log(chalk.green('✓'), `Read package.json: ${readResult.content.length} characters`);
    } else {
      const errorCode = 'error' in readResult ? readResult.error.code : 'unknown';
      console.log(chalk.yellow('⚠'), `Read limited: ${errorCode}`);
    }
  } catch (error) {
    console.log(chalk.red('✗'), 'Read failed:', error);
  }

  console.log(chalk.green('\n✅ All tests completed'));
}

/**
 * Handle allowed-dirs command
 */
async function handleAllowedDirs() {
  console.log(chalk.blue('🔒 Allowed Directories:'));
  console.log('═'.repeat(50));

  const result = await listAllowedDirs();
  
  // Since the method now returns properly typed response (not wrapped in "data")
  if (!result.allowed_directories) {
    console.log(chalk.yellow('No allowed directories configured'));
    return;
  }

  for (const dir of result.allowed_directories) {
    console.log(`\n📁 ${chalk.green(dir.original_path)}`);
    if (dir.exists) {
      console.log(`     Readable: ${dir.permissions.readable}`);
      console.log(`     Writable: ${dir.permissions.writable}`);
      if (dir.stats) {
        console.log(`     Files: ${dir.stats.file_count}`);
        console.log(`     Modified: ${new Date(dir.stats.last_modified).toLocaleDateString()}`);
      }
    }
  }
}

/**
 * Handle file-info command (軽量版対応)
 */
async function handleFileInfo(argv: string[]) {
  const options = commandLineArgs(fileInfoDefinitions, { argv });
  
  if (!options.path) {
    console.error(chalk.red('Error: File path required'));
    process.exit(1);
  }

  console.log(chalk.blue('ℹ️  File Info:'), options.path);
  console.log('═'.repeat(50));

  const params = {
    path: options.path
  };

  const startTime = Date.now();
  const result = await fileInfo(params);
  const duration = Date.now() - startTime;

  // Check if successful response
  if (!result.success) {
    console.log(chalk.red('\n❌ Failed to get file info:'));
    if ('error' in result) {
      console.log(`  Code: ${result.error.code}`);
      console.log(`  Message: ${result.error.message}`);
      if (result.error.suggestions.length > 0) {
        console.log(chalk.yellow('\n💡 Suggestions:'));
        result.error.suggestions.forEach((sug: string, i: number) => {
          console.log(`  ${i + 1}. ${sug}`);
        });
      }
    }
    return;
  }

  // Basic info (軽量版)
  console.log(chalk.yellow('\n📊 Basic Info:'));
  console.log(`  Exists: ${result.exists}`);
  console.log(`  Type: ${result.type}`);
  console.log(`  Size: ${formatBytes(result.file_info.size_bytes)}`);
  console.log(`  Binary: ${result.file_info.is_binary}`);
  console.log(`  Modified: ${new Date(result.file_info.modified).toLocaleString()}`);
  
  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
}

/**
 * Handle mkdir command
 */
async function handleMkdir(argv: string[]) {
  const options = commandLineArgs(mkdirDefinitions, { argv });
  
  if (!options.path) {
    console.error(chalk.red('Error: Directory path required'));
    process.exit(1);
  }

  console.log(chalk.blue('📁 Create Directory:'), options.path);
  console.log('═'.repeat(50));

  const params = {
    path: options.path,
    recursive: !options['no-recursive'],
    mode: options.mode
  };

  const startTime = Date.now();
  const result = await mkdir(params);
  const duration = Date.now() - startTime;

  // Display result
  if (!result.success) {
    console.log(chalk.red('\n❌ Failed to create directory'));
    console.log(chalk.red(`Error: ${result.error.message}`));
  } else {
    console.log(chalk.green(`\n✓ Directory ${result.status}:`), result.directory_info.path);
    if (result.directory_info.final_permissions) {
      console.log(`  Permissions: ${result.directory_info.final_permissions}`);
    }
    if (result.directory_info.created_new) {
      console.log(`  Created new: ${result.directory_info.created_new}`);
    }
    if (result.warnings && result.warnings.length > 0) {
      console.log(chalk.yellow('  Warnings:'));
      result.warnings.forEach((w: string) => console.log(`    - ${w}`));
    }
  }

  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
}

/**
 * Handle delete command
 */
async function handleDelete(argv: string[]) {
  const options = commandLineArgs(deleteDefinitions, { argv });
  
  if (!options.path) {
    console.error(chalk.red('Error: File path required'));
    process.exit(1);
  }

  console.log(chalk.blue('🗑️  Delete File:'), options.path);
  console.log('═'.repeat(50));

  // Confirm unless force
  if (!options.force) {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise<string>(resolve => {
      rl.question(chalk.yellow('Are you sure you want to delete this file? (y/N) '), resolve);
    });
    rl.close();
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log(chalk.gray('Cancelled'));
      return;
    }
  }

  const params = {
    path: options.path,
    force: options.force
  };

  const startTime = Date.now();
  const result = await deleteFile(params);
  const duration = Date.now() - startTime;

  // Display result
  if (!result.success) {
    console.log(chalk.red('\n❌ Failed to delete file:'));
    console.log(`  Code: ${result.error.code}`);
    console.log(`  Message: ${result.error.message}`);
    if (result.error.suggestions && result.error.suggestions.length > 0) {
      console.log(chalk.yellow('\n💡 Suggestions:'));
      result.error.suggestions.forEach((suggestion: string, i: number) => {
        console.log(`  ${i + 1}. ${suggestion}`);
      });
    }
  } else {
    console.log(chalk.green('\n✓ File deleted successfully'));
  }

  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
}

/**
 * Handle rmdir command
 */
async function handleDeleteDir(argv: string[]) {
  const options = commandLineArgs(deleteDirDefinitions, { argv });
  
  if (!options.path) {
    console.error(chalk.red('Error: Directory path required'));
    process.exit(1);
  }

  console.log(chalk.blue('🗑️  Delete Directory:'), options.path);
  console.log('═'.repeat(50));

  const params = {
    path: options.path,
    dry_run: options['dry-run'],
    ...(options['exclude-patterns'] && { 
      exclude_patterns: options['exclude-patterns'].split(',') 
    })
  };

  const startTime = Date.now();
  const result = await deleteDirectory(params);
  const duration = Date.now() - startTime;

  // Display result
  if (!result.success) {
    console.log(chalk.red('\n❌ Failed to delete directory:'));
    console.log(`  Code: ${result.error.code}`);
    console.log(`  Message: ${result.error.message}`);
    if (result.error.suggestions && result.error.suggestions.length > 0) {
      console.log(chalk.yellow('\n💡 Suggestions:'));
      result.error.suggestions.forEach((suggestion: string, i: number) => {
        console.log(`  ${i + 1}. ${suggestion}`);
      });
    }
  } else if (options['dry-run']) {
    console.log(chalk.yellow('\n🔍 Preview (dry run): Directory can be deleted'));
  } else {
    console.log(chalk.green('\n✓ Directory deleted successfully'));
  }

  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
}

/**
 * Handle movedir command
 */
async function handleMovedir(argv: string[]) {
  const options = commandLineArgs(moveDirDefinitions, { argv, stopAtFirstUnknown: true });
  const remainingArgs = argv.slice(argv.indexOf(options.source) + 1);
  
  if (!options.source) {
    console.error(chalk.red('Error: Source directory required'));
    process.exit(1);
  }

  const destination = options.destination || remainingArgs[0];
  if (!destination) {
    console.error(chalk.red('Error: Destination path required'));
    process.exit(1);
  }

  console.log(chalk.blue('📦 Move Directory:'));
  console.log(chalk.gray('  From:'), options.source);
  console.log(chalk.gray('  To:'), destination);
  if (options.merge) {
    console.log(chalk.yellow('  Mode: Merge enabled'));
  }
  console.log('═'.repeat(50));

  const params = {
    source: options.source,
    destination,
    merge_with_existing: options.merge
  };

  const startTime = Date.now();
  const result = await moveDirectory(params);
  const duration = Date.now() - startTime;

  // Display result
  if (result.status === 'error') {
    console.log(chalk.red('\n❌ Failed to move directory'));
    if (result.issue_details) {
      console.log(`  Reason: ${result.issue_details.reason}`);
    }
    if (result.alternatives && result.alternatives.suggestions.length > 0) {
      console.log(chalk.yellow('\n💡 Suggestions:'));
      result.alternatives.suggestions.forEach((sug: string, i: number) => {
        console.log(`  ${i + 1}. ${sug}`);
      });
    }
  } else {
    console.log(chalk.green('\n✓ Directory moved successfully'));
    if (result.operation_info) {
      console.log(`  Operation: ${result.operation_info.operation_type}`);
      console.log(`  Files moved: ${result.operation_info.total_files}`);
      console.log(`  Directories: ${result.operation_info.total_directories}`);
      console.log(`  Total size: ${formatBytes(result.operation_info.total_size_bytes)}`);
    }
  }

  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
}

/**
 * Handle get-default-exclude-dirs command
 */
async function handleGetDefaultExcludeDirs(argv: string[]) {
  const options = commandLineArgs(getDefaultExcludeDirsDefinitions, { argv });
  
  console.log(chalk.blue('📁 Default Exclude Directories:'));
  console.log('═'.repeat(50));

  const params = {
    userDefaultExcludeDirs: !options.minimal
  };

  const result = await getDefaultExcludeDirs(params);
  
  console.log(chalk.yellow(`\nType: ${result.type}`));
  console.log(chalk.gray(result.description));
  console.log(chalk.yellow('\nExcluded directories:'));
  
  for (const dir of result.excludeDirs) {
    console.log(`  - ${dir}`);
  }
  
  if (options.__verbose) {
    console.log(chalk.gray('\n💡 Usage tips:'));
    if (result.type === 'user_default') {
      console.log(chalk.gray('  This is the default for search operations'));
      console.log(chalk.gray('  Use --no-user-default-exclude for minimal exclusions'));
    } else {
      console.log(chalk.gray('  This only excludes essential directories'));
      console.log(chalk.gray('  Remove --minimal flag for user-friendly defaults'));
    }
  }
}

/**
 * Handle security-test command
 */
async function handleSecurityTest(argv: string[]) {
  const testPath = argv[0] || '/etc/passwd';
  
  console.log(chalk.blue('🔒 Security Test:'), testPath);
  console.log('═'.repeat(50));

  // Test various security scenarios
  const tests = [
    { path: testPath, desc: 'Direct path' },
    { path: '../../../' + testPath, desc: 'Path traversal' },
    { path: path.join(process.cwd(), '..', '..', testPath), desc: 'Parent directory access' },
  ];

  for (const test of tests) {
    console.log(chalk.yellow(`\nTesting: ${test.desc}`));
    console.log(`  Path: ${test.path}`);
    
    try {
      const result = await readFile({ path: test.path }, safety, analyzer);
      if (result.success) {
        console.log(chalk.red('  ⚠️  SECURITY ISSUE: Read succeeded!'));
      } else {
        const reason = 'error' in result ? result.error.code : 'unknown';
        console.log(chalk.green('  ✓ Blocked:'), reason);
      }
    } catch (error) {
      console.log(chalk.green('  ✓ Blocked:'), error instanceof Error ? error.message : error);
    }
  }
}

/**
 * Display helpers
 */
function displayListResults(result: any, verbose: boolean) {
  if (!result.success) {
    console.log(chalk.red('\n❌ Failed to list directory:'));
    console.log(`  Code: ${result.error.code}`);
    console.log(`  Message: ${result.error.message}`);
    return;
  }

  console.log(chalk.green(`\n✓ Found ${result.summary.file_count} files, ${result.summary.directory_count} directories`));
  console.log(`  Total size: ${formatBytes(result.summary.total_size)}`);

  if (result.items.length > 0) {
    console.log(chalk.yellow('\n📄 Files:'));
    const maxItems = verbose ? result.items.length : Math.min(10, result.items.length);
    
    for (let i = 0; i < maxItems; i++) {
      const item = result.items[i];
      const icon = item.type === 'directory' ? '📁' : '📄';
      console.log(`  ${icon} ${item.name.padEnd(30)} ${formatBytes(item.size).padStart(10)}`);
    }
    
    if (result.items.length > maxItems) {
      console.log(chalk.gray(`  ... and ${result.items.length - maxItems} more`));
    }
  }
}

function displayReadError(result: any, _verbose: boolean) {
  console.log(chalk.red('\n❌ Failed to read file:'));
  console.log(`  Code: ${result.error.code}`);
  console.log(`  Message: ${result.error.message}`);
  
  // Show file info for size exceeded
  if (result.error.code === 'file_too_large' && result.error.details && result.error.details.file_info) {
    console.log(chalk.yellow('\n📊 File Info:'));
    const fileInfo = result.error.details.file_info;
    console.log(`  Size: ${formatBytes(fileInfo.size_bytes || 0)}`);
    if (fileInfo.total_lines) {
      console.log(`  Total lines: ${fileInfo.total_lines}`);
    }
    if (fileInfo.estimated_tokens) {
      console.log(`  Estimated tokens: ${fileInfo.estimated_tokens}`);
    }
  }
  
  // Show preview if available
  if (result.preview) {
    console.log(chalk.yellow('\n👀 Preview:'));
    console.log(result.preview.first_lines.map((line: string) => '  ' + line).join('\n'));
    if (result.preview.content_summary) {
      console.log(chalk.gray(`\n  Summary: ${result.preview.content_summary}`));
    }
  }
  
  // Show alternatives
  if (result.alternatives) {
    console.log(chalk.yellow('\n💡 Alternatives:'));
    result.alternatives.suggestions.forEach((sug: string) => {
      console.log(`  - ${sug}`);
    });
  }
}

function displaySearchResults(result: any, _verbose: boolean) {
  if (!result.matches || result.matches.length === 0) {
    return;
  }

  // Display all results (already limited to DISPLAY_LIMIT in search-content.ts)
  const maxResults = result.matches.length;
  
  for (let i = 0; i < maxResults; i++) {
    const match = result.matches[i];
    console.log(chalk.cyan(`\n📄 ${match.file}`));
    console.log(`   Matches: ${match.matchCount} | Size: ${formatBytes(match.fileSize)}`);
    
    if (match.lines && match.lines.length > 0) {
      // Display all line matches (already limited in search-content.ts)
      for (const line of match.lines) {
        if (typeof line === 'string') {
          // This should not occur anymore with new implementation
          console.log(chalk.gray(`   ${line}`));
        } else {
          // LineMatch object
          console.log(chalk.gray(`   Line ${line.lineNo}: ${line.content.trim()}`));
        }
      }
    }
  }
  
  // No need for "and X more files" message - refinement suggestions handle this
}

function displayMoveResult(result: any, _verbose: boolean) {
  if (!result.success) {
    console.log(chalk.red('\n❌ Failed to move file:'));
    console.log(`  Code: ${result.error.code}`);
    console.log(`  Message: ${result.error.message}`);
    if (result.error.suggestions && result.error.suggestions.length > 0) {
      console.log(chalk.yellow('\n💡 Suggestions:'));
      result.error.suggestions.forEach((suggestion: string, i: number) => {
        console.log(`  ${i + 1}. ${suggestion}`);
      });
    }
  } else {
    console.log(chalk.green('\n✓ File moved successfully'));
    if (result.source_path && result.destination_path) {
      console.log(`  From: ${result.source_path}`);
      console.log(`  To: ${result.destination_path}`);
    }
    if (result.operation_type) {
      console.log(`  Operation: ${result.operation_type}`);
    }
    if (result.file_size !== undefined) {
      console.log(`  Size: ${formatBytes(result.file_size)}`);
    }
    if (result.overwritten_existing) {
      console.log(chalk.yellow('  ⚠️  Overwrote existing file'));
    }
  }
}

/**
 * Read from stdin
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks).toString('utf8');
}

// Run main
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
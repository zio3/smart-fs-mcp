#!/usr/bin/env node
/**
 * Smart Filesystem MCP - CLI Test Interface
 * Command-line interface for testing MCP tools
 */

import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import chalk from 'chalk';
import { SafetyController } from '../core/safety-controller.js';
import { FileAnalyzer } from '../core/file-analyzer.js';
import { listDirectory } from '../tools/list-directory.js';
import { readFile } from '../tools/read-file.js';
import { searchContent } from '../tools/search-content.js';
import { writeFile } from '../tools/write-file.js';
import { editFile } from '../tools/edit-file.js';
import { moveFile } from '../tools/move-file.js';
import { listAllowedDirs } from '../tools/list-allowed-dirs.js';
import { fileInfo } from '../tools/file-info.js';
import { mkdir } from '../tools/mkdir.js';
import { deleteFile } from '../tools/delete-file.js';
import { deleteDirectory } from '../tools/delete-directory.js';
import { moveDirectory } from '../tools/move-directory.js';
import { initializeSecurityController } from '../core/security-controller-v2.js';
import { formatBytes, formatDuration } from '../utils/helpers.js';

// Command definitions
const mainDefinitions = [
  { name: 'command', defaultOption: true },
  { name: 'help', alias: 'h', type: Boolean, description: 'Show help' },
  { name: 'version', alias: 'v', type: Boolean, description: 'Show version' },
];

const listDefinitions = [
  { name: 'path', defaultOption: true, description: 'Directory to list' },
  { name: 'hidden', type: Boolean, description: 'Include hidden files' },
  { name: 'sort', type: String, description: 'Sort by (name|size|modified)' },
  { name: 'order', type: String, description: 'Sort order (asc|desc)' },
  { name: 'verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
  { name: 'format', type: String, description: 'Output format (table|json)' },
];

const readDefinitions = [
  { name: 'path', defaultOption: true, description: 'File to read' },
  { name: 'encoding', type: String, description: 'Text encoding' },
  { name: 'verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const searchDefinitions = [
  { name: 'file-pattern', alias: 'f', type: String, description: 'File name pattern (regex)' },
  { name: 'content-pattern', alias: 'c', type: String, description: 'Content pattern (regex)' },
  { name: 'directory', alias: 'd', type: String, defaultOption: true, description: 'Search directory' },
  { name: 'extensions', alias: 'e', type: String, multiple: true, description: 'File extensions to include' },
  { name: 'exclude-dirs', alias: 'x', type: String, multiple: true, description: 'Directories to exclude' },
  { name: 'case-sensitive', alias: 's', type: Boolean, description: 'Case-sensitive search' },
  { name: 'whole-word', alias: 'w', type: Boolean, description: 'Match whole words only' },
  { name: 'max-files', alias: 'm', type: Number, description: 'Maximum number of results' },
  { name: 'verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
  { name: 'format', type: String, description: 'Output format (table|json)' },
];

const writeDefinitions = [
  { name: 'path', defaultOption: true, description: 'File path to write' },
  { name: 'content', alias: 'c', type: String, description: 'Content to write (or use stdin)' },
  { name: 'encoding', alias: 'e', type: String, description: 'Text encoding (default: utf8)' },
  { name: 'verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const editDefinitions = [
  { name: 'path', defaultOption: true, description: 'File to edit' },
  { name: 'literal', alias: 'l', type: String, multiple: true, description: 'Literal edit: old_text,new_text' },
  { name: 'regex', alias: 'r', type: String, multiple: true, description: 'Regex edit: pattern,replacement[,flags]' },
  { name: 'diff', alias: 'f', type: String, description: 'Apply diff from file or stdin' },
  { name: 'preserve-formatting', alias: 'p', type: Boolean, description: 'Preserve formatting (default: true)' },
  { name: 'dry-run', alias: 'd', type: Boolean, description: 'Preview changes without applying' },
  { name: 'verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const moveDefinitions = [
  { name: 'source', defaultOption: true, description: 'Source file path' },
  { name: 'destination', type: String, description: 'Destination file path' },
  { name: 'overwrite', alias: 'o', type: Boolean, description: 'Overwrite existing file' },
  { name: 'verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const fileInfoDefinitions = [
  { name: 'path', defaultOption: true, description: 'File or directory path' },
  { name: 'no-analysis', type: Boolean, description: 'Skip detailed analysis' },
  { name: 'verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const mkdirDefinitions = [
  { name: 'path', defaultOption: true, description: 'Directory path to create' },
  { name: 'no-recursive', type: Boolean, description: 'Do not create parent directories' },
  { name: 'mode', type: String, description: 'Unix permissions (default: 0755)' },
  { name: 'verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const deleteDefinitions = [
  { name: 'path', defaultOption: true, description: 'File path to delete' },
  { name: 'force', alias: 'f', type: Boolean, description: 'Force deletion of read-only files' },
  { name: 'verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const rmdirDefinitions = [
  { name: 'path', defaultOption: true, description: 'Directory path to delete' },
  { name: 'recursive', alias: 'r', type: Boolean, description: 'Delete directory contents recursively' },
  { name: 'force', alias: 'f', type: Boolean, description: 'Force deletion of read-only files' },
  { name: 'dry-run', alias: 'd', type: Boolean, description: 'Preview deletion without executing' },
  { name: 'max-preview', alias: 'm', type: Number, description: 'Maximum files to show in preview (default: 10)' },
  { name: 'verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

const movedirDefinitions = [
  { name: 'source', defaultOption: true, description: 'Source directory path' },
  { name: 'destination', type: String, description: 'Destination directory path' },
  { name: 'overwrite', alias: 'o', type: Boolean, description: 'Overwrite existing destination' },
  { name: 'dry-run', alias: 'd', type: Boolean, description: 'Preview operation without executing' },
  { name: 'verbose', alias: 'v', type: Boolean, description: 'Verbose output' },
];

// Initialize services
const safety = new SafetyController();
const analyzer = new FileAnalyzer();

// Initialize security with allowed directories from command line args
// Format: smart-fs-test [allowed-dirs...] command [options]
let commandIndex = 2;
const allowedDirs: string[] = [];
while (commandIndex < process.argv.length && !process.argv[commandIndex].startsWith('-')) {
  const arg = process.argv[commandIndex];
  // Check if this is a command
  const commands = ['list', 'read', 'search', 'write', 'edit', 'move', 'list-allowed', 'info', 'mkdir', 'delete', 'rmdir', 'movedir', 'security-test', 'test-all'];
  if (commands.includes(arg)) {
    break;
  }
  allowedDirs.push(arg);
  commandIndex++;
}

if (allowedDirs.length > 0) {
  console.error(chalk.gray(`Initializing with allowed directories: ${allowedDirs.join(', ')}\n`));
  initializeSecurityController(allowedDirs);
}

/**
 * Main CLI entry point
 */
async function main() {
  const mainOptions = commandLineArgs(mainDefinitions, { stopAtFirstUnknown: true });
  const argv = mainOptions._unknown || [];

  if (mainOptions.version) {
    console.log('smart-fs-mcp version 1.0.0');
    return;
  }

  if (mainOptions.help || !mainOptions.command) {
    showHelp();
    return;
  }

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
      case 'list-allowed':
        await handleListAllowed();
        break;
      case 'info':
        await handleFileInfo(argv);
        break;
      case 'mkdir':
        await handleMkdir(argv);
        break;
      case 'delete':
        await handleDelete(argv);
        break;
      case 'rmdir':
        await handleRmdir(argv);
        break;
      case 'movedir':
        await handleMovedir(argv);
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
    path: options.path,
    include_hidden: options.hidden,
    sort_by: options.sort as any,
    sort_order: options.order as any,
  };

  const startTime = Date.now();
  const result = await listDirectory(params, safety);
  const duration = Date.now() - startTime;

  // Display results
  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    displayListResults(result, options.verbose || false);
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
  console.log('═'.repeat(50));

  const params = {
    path: options.path,
  };

  const result = await readFile(params, safety, analyzer);
  
  if (result.status === 'success') {
    console.log(result.content);
  } else {
    displayReadError(result as any, options.verbose || false);
  }
}


/**
 * Handle search command
 */
async function handleSearch(argv: string[]) {
  const options = commandLineArgs(searchDefinitions, { argv });
  
  if (!options['file-pattern'] && !options['content-pattern']) {
    console.error(chalk.red('Error: Either file-pattern or content-pattern is required'));
    console.log('Use -f for file pattern or -c for content pattern');
    process.exit(1);
  }

  const directory = options.directory || '.';
  console.log(chalk.blue('🔍 Search:'), directory);
  if (options['file-pattern']) {
    console.log(chalk.gray('  File pattern:'), options['file-pattern']);
  }
  if (options['content-pattern']) {
    console.log(chalk.gray('  Content pattern:'), options['content-pattern']);
  }
  console.log('═'.repeat(50));

  const params = {
    file_pattern: options['file-pattern'],
    content_pattern: options['content-pattern'],
    directory,
    extensions: options.extensions,
    exclude_dirs: options['exclude-dirs'],
    case_sensitive: options['case-sensitive'],
    whole_word: options['whole-word'],
    max_files: options['max-files'],
  };

  const startTime = Date.now();
  const result = await searchContent(params, safety);
  const duration = Date.now() - startTime;

  // Display results
  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    displaySearchResults(result, options.verbose || false);
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

  // Get content from option or stdin
  let content = options.content || '';
  if (!options.content && !process.stdin.isTTY) {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    content = Buffer.concat(chunks).toString('utf8');
  }

  if (!content) {
    console.error(chalk.red('Error: Content required (use -c or pipe from stdin)'));
    process.exit(1);
  }

  console.log(chalk.blue('📝 Write File:'), options.path);
  console.log(chalk.gray(`  Size: ${formatBytes(Buffer.byteLength(content))}`));
  console.log('═'.repeat(50));

  const params = {
    path: options.path,
    content,
    encoding: options.encoding as any
  };

  const startTime = Date.now();
  const result = await writeFile(params, safety);
  const duration = Date.now() - startTime;

  // Display results
  displayWriteResult(result, options.verbose || false);
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

  if (!options.literal && !options.regex && !options.diff) {
    console.error(chalk.red('Error: At least one edit required (-l, -r, or -f)'));
    console.log('Examples:');
    console.log('  -l "old text,new text"        # Literal replacement');
    console.log('  -r "pattern,replacement[,flags]"  # Regex replacement');
    console.log('  -f patch.diff                 # Apply diff from file');
    console.log('  cat patch.diff | edit file.js -f -  # Apply diff from stdin');
    process.exit(1);
  }

  console.log(chalk.blue('✏️  Edit File:'), options.path);
  if (options['dry-run']) {
    console.log(chalk.yellow('  Mode: DRY RUN (preview only)'));
  }
  console.log('═'.repeat(50));

  // Parse edits
  const edits: any[] = [];
  
  if (options.literal) {
    const literals = Array.isArray(options.literal) ? options.literal : [options.literal];
    for (const literal of literals) {
      const parts = literal.split(',');
      if (parts.length < 2) {
        console.error(chalk.red(`Invalid literal edit format: ${literal}`));
        console.log('Format: "old_text,new_text"');
        process.exit(1);
      }
      edits.push({
        type: 'literal',
        old_text: parts[0],
        new_text: parts.slice(1).join(',') // Handle commas in new_text
      });
    }
  }
  
  if (options.regex) {
    const regexes = Array.isArray(options.regex) ? options.regex : [options.regex];
    for (const regex of regexes) {
      const parts = regex.split(',');
      if (parts.length < 2) {
        console.error(chalk.red(`Invalid regex edit format: ${regex}`));
        console.log('Format: "pattern,replacement[,flags]"');
        process.exit(1);
      }
      edits.push({
        type: 'regex',
        pattern: parts[0],
        replacement: parts[1],
        flags: parts[2] || 'g'
      });
    }
  }
  
  if (options.diff) {
    let diffContent: string;
    
    if (options.diff === '-') {
      // Read from stdin
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      diffContent = Buffer.concat(chunks).toString('utf8');
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

  const params = {
    path: options.path,
    edits,
    dry_run: options['dry-run'],
    preserve_formatting: options['preserve-formatting'] !== false // Default true
  };

  const startTime = Date.now();
  const result = await editFile(params, safety, analyzer);
  const duration = Date.now() - startTime;

  // Display results
  displayEditResult(result, options.verbose || false);
  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
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
  displayMoveResult(result, options.verbose || false);
  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
}

/**
 * Handle test-all command
 */
async function handleTestAll(argv: string[]) {
  const path = argv[0] || '.';
  
  console.log(chalk.green('🧪 Running all tests on:'), path);
  console.log('═'.repeat(50));

  // Test list
  console.log(chalk.yellow('\n📁 Testing directory list...'));
  try {
    const listResult = await listDirectory({ path }, safety);
    console.log(chalk.green('✓'), `Found ${listResult.summary.total_files} files, ${listResult.summary.total_subdirectories} directories`);
  } catch (error) {
    console.log(chalk.red('✗'), 'List failed:', error);
  }

  // Test read on package.json
  console.log(chalk.yellow('\n📄 Testing file read...'));
  try {
    const readResult = await readFile({ path: 'package.json' }, safety, analyzer);
    if (readResult.status === 'success') {
      console.log(chalk.green('✓'), `Read package.json: ${readResult.content.length} characters`);
    } else {
      console.log(chalk.yellow('⚠'), `Read limited: ${readResult.status}`);
    }
  } catch (error) {
    console.log(chalk.red('✗'), 'Read failed:', error);
  }

  console.log(chalk.green('\n✅ All tests completed'));
}

/**
 * Handle list-allowed command
 */
async function handleListAllowed() {
  console.log(chalk.blue('🔒 Allowed Directories:'));
  console.log('═'.repeat(50));

  const result = await listAllowedDirs();
  
  // Platform info
  console.log(chalk.yellow('\n🖥️  Platform Info:'));
  console.log(`  OS: ${result.platform_info.os}`);
  console.log(`  Case sensitive: ${result.platform_info.case_sensitive}`);
  console.log(`  Path separator: '${result.platform_info.path_separator}'`);
  console.log(`  Current directory: ${result.platform_info.resolved_cwd}`);
  
  // Security summary
  console.log(chalk.yellow('\n🛡️  Security Summary:'));
  console.log(`  Total directories: ${result.security_info.total_directories}`);
  console.log(`  Accessible: ${result.security_info.accessible_directories}`);
  console.log(`  Read-only: ${result.security_info.read_only_directories}`);
  
  // Directory details
  console.log(chalk.yellow('\n📁 Directory Details:'));
  for (const dir of result.allowed_directories) {
    const statusIcon = dir.exists ? (dir.accessible ? '✅' : '⚠️') : '❌';
    console.log(`\n  ${statusIcon} ${dir.original_path}`);
    console.log(`     Resolved: ${dir.resolved_path}`);
    console.log(`     Exists: ${dir.exists}`);
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
 * Handle file-info command
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
    path: options.path,
    include_analysis: !options['no-analysis']
  };

  const startTime = Date.now();
  const result = await fileInfo(params, analyzer);
  const duration = Date.now() - startTime;

  // Basic info
  console.log(chalk.yellow('\n📊 Basic Info:'));
  console.log(`  Path: ${result.path}`);
  console.log(`  Resolved: ${result.resolved_path}`);
  console.log(`  Exists: ${result.exists}`);
  console.log(`  Type: ${result.type}`);
  
  if (result.exists) {
    console.log(`  Size: ${formatBytes(result.size)}`);
    console.log(`  Created: ${result.created ? new Date(result.created).toLocaleString() : 'N/A'}`);
    console.log(`  Modified: ${new Date(result.modified).toLocaleString()}`);
    console.log(`  Accessed: ${new Date(result.accessed).toLocaleString()}`);
    
    // Permissions
    console.log(chalk.yellow('\n🔐 Permissions:'));
    console.log(`  Readable: ${result.permissions.readable}`);
    console.log(`  Writable: ${result.permissions.writable}`);
    console.log(`  Executable: ${result.permissions.executable}`);
    console.log(`  Mode: ${result.permissions.mode}`);
    
    // File analysis
    if (result.file_analysis) {
      console.log(chalk.yellow('\n📋 File Analysis:'));
      console.log(`  Binary: ${result.file_analysis.is_binary}`);
      console.log(`  Encoding: ${result.file_analysis.encoding}`);
      console.log(`  Type: ${result.file_analysis.file_type}`);
      console.log(`  Language: ${result.file_analysis.syntax_language || 'N/A'}`);
      console.log(`  Estimated tokens: ${result.file_analysis.estimated_tokens}`);
      console.log(`  Safe to read: ${result.file_analysis.safe_to_read}`);
      if (result.file_analysis.line_count) {
        console.log(`  Lines: ${result.file_analysis.line_count}`);
      }
    }
    
    // Directory info
    if (result.directory_info) {
      console.log(chalk.yellow('\n📁 Directory Info:'));
      console.log(`  Files: ${result.directory_info.file_count}`);
      console.log(`  Subdirectories: ${result.directory_info.subdirectory_count}`);
      console.log(`  Total size: ${formatBytes(result.directory_info.total_size_estimate)}`);
    }
  }
  
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
  if (result.status === 'error') {
    console.log(chalk.red('❌ Failed to create directory'));
  } else if (result.status === 'warning') {
    console.log(chalk.yellow('⚠️  Directory created with warnings'));
  } else {
    console.log(chalk.green('✅ Directory created successfully'));
  }
  
  console.log(chalk.yellow('\n📊 Operation Info:'));
  console.log(`  Path: ${result.directory_info.path}`);
  console.log(`  Resolved: ${result.directory_info.resolved_path}`);
  console.log(`  Created new: ${result.directory_info.created_new}`);
  console.log(`  Permissions: ${result.directory_info.final_permissions}`);
  
  if (result.directory_info.parent_directories_created.length > 0) {
    console.log(chalk.yellow('\n📁 Parent Directories Created:'));
    result.directory_info.parent_directories_created.forEach(dir => {
      console.log(`  • ${dir}`);
    });
  }
  
  if (result.warnings && result.warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️  Warnings:'));
    result.warnings.forEach(warning => {
      console.log(`  • ${warning}`);
    });
  }
  
  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
}

/**
 * Handle security-test command
 */
async function handleSecurityTest(argv: string[]) {
  const testPath = argv[0] || '/etc/passwd';
  
  console.log(chalk.blue('🔒 Security Test:'), testPath);
  console.log('═'.repeat(50));
  
  try {
    console.log('\nAttempting to read:', testPath);
    const result = await readFile({ path: testPath }, safety, analyzer);
    console.log(chalk.red('⚠️  Security check failed - file was readable!'));
    console.log('Content preview:', result.content?.substring(0, 100) + '...');
  } catch (error) {
    console.log(chalk.green('✅ Security check passed - access denied'));
    console.log('Error:', error instanceof Error ? error.message : error);
    
    // Parse security error response if available
    try {
      const errorObj = JSON.parse(error instanceof Error ? error.message : '');
      if (errorObj.allowed_directories) {
        console.log('\nSecurity Details:');
        console.log('  Reason:', errorObj.reason);
        console.log('  Attempted path:', errorObj.attempted_path);
        console.log('  Allowed directories:', errorObj.allowed_directories.join(', '));
      }
    } catch {}
  }
}

/**
 * Display list results
 */
function displayListResults(result: any, verbose: boolean) {
  // Status
  if (result.status !== 'success') {
    console.log(chalk.yellow(`Status: ${result.status}`));
  }
  
  // Warnings
  if (result.warnings && result.warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️  Warnings:'));
    result.warnings.forEach((warning: string) => {
      console.log(`  ${warning}`);
    });
  }
  
  // Summary
  console.log(chalk.yellow('\n📊 Summary:'));
  console.log(`  Total files: ${result.summary.total_files}`);
  console.log(`  Total subdirectories: ${result.summary.total_subdirectories}`);
  console.log(`  Total size: ${formatBytes(result.summary.total_size_bytes)}`);
  if (result.summary.largest_file) {
    console.log(`  Largest file: ${result.summary.largest_file.name} (${formatBytes(result.summary.largest_file.size_bytes)})`);
  }

  // Files
  if (result.files.length > 0) {
    console.log(chalk.yellow('\n📋 Files:'));
    const displayCount = verbose ? result.files.length : Math.min(10, result.files.length);
    for (let i = 0; i < displayCount; i++) {
      const file = result.files[i];
      console.log(`  ${file.name} (${formatBytes(file.size_bytes)}) - ${new Date(file.last_modified).toLocaleDateString()}`);
    }
    if (!verbose && result.files.length > 10) {
      console.log(`  ... and ${result.files.length - 10} more files`);
    }
  }
  
  // Subdirectories
  if (result.subdirectories.length > 0) {
    console.log(chalk.yellow('\n📁 Subdirectories:'));
    for (const dir of result.subdirectories) {
      console.log(`  ${dir.name}/ (${dir.file_count} files, ${dir.folder_count} folders)`);
    }
  }
}

/**
 * Display search results
 */
function displaySearchResults(result: any, verbose: boolean) {
  // Status
  if (result.status === 'error') {
    console.log(chalk.red('❌ Search failed'));
    if (result.warnings) {
      result.warnings.forEach((warning: string) => {
        console.log(chalk.red(`  ${warning}`));
      });
    }
    return;
  }
  
  // Search info
  console.log(chalk.yellow('\n🔍 Search Info:'));
  console.log(`  Pattern: ${result.search_info.pattern}`);
  console.log(`  Type: ${result.search_info.search_type}`);
  console.log(`  Files scanned: ~${result.search_info.total_files_scanned || result.results.length}`);
  console.log(`  Time: ${result.search_info.search_time_ms}ms`);
  
  // Summary
  console.log(chalk.yellow('\n📊 Summary:'));
  console.log(`  Total matches: ${result.summary.total_matches}`);
  console.log(`  Files with matches: ${result.summary.files_with_matches}`);
  if (result.summary.most_matches) {
    console.log(`  Most matches: ${result.summary.most_matches.file_path} (${result.summary.most_matches.match_count} matches)`);
  }
  
  // Results
  if (result.results.length > 0) {
    console.log(chalk.yellow('\n📋 Results:'));
    const displayCount = verbose ? result.results.length : Math.min(10, result.results.length);
    
    for (let i = 0; i < displayCount; i++) {
      const file = result.results[i];
      const matches = (file.filename_matches || 0) + (file.content_matches || 0);
      console.log(`\n  ${chalk.cyan(file.file_path)}`);
      console.log(`    Matches: ${matches} | Size: ${formatBytes(file.file_size_bytes)} | Modified: ${new Date(file.last_modified).toLocaleDateString()}`);
      
      if (file.content_preview && verbose) {
        console.log(`    Preview: ${chalk.gray(file.content_preview)}`);
      }
      
      if (file.match_context && verbose) {
        console.log('    Context:');
        file.match_context.slice(0, 3).forEach((line: string) => {
          console.log(`      ${chalk.gray(line)}`);
        });
      }
    }
    
    if (!verbose && result.results.length > 10) {
      console.log(chalk.gray(`\n  ... and ${result.results.length - 10} more files`));
    }
  } else {
    console.log(chalk.yellow('\n  No matches found'));
  }
  
  // Warnings
  if (result.warnings && result.warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️  Warnings:'));
    result.warnings.forEach((warning: string) => {
      console.log(`  ${warning}`);
    });
  }
  
  // Next actions
  if (result.summary.next_actions && result.summary.next_actions.length > 0) {
    console.log(chalk.yellow('\n💡 Suggestions:'));
    result.summary.next_actions.forEach((action: string) => {
      console.log(`  • ${action}`);
    });
  }
}

/**
 * Display write result
 */
function displayWriteResult(result: any, verbose: boolean) {
  if (result.status === 'error') {
    console.log(chalk.red('❌ Write failed'));
    if (result.warnings) {
      result.warnings.forEach((warning: string) => {
        console.log(chalk.red(`  ${warning}`));
      });
    }
    return;
  }
  
  // File info
  console.log(chalk.green('\n✅ File written successfully'));
  console.log(chalk.yellow('\n📊 File Info:'));
  console.log(`  Path: ${result.file_info.path}`);
  console.log(`  Size: ${formatBytes(result.file_info.size_bytes)}`);
  console.log(`  New file: ${result.file_info.created_new ? 'Yes' : 'No'}`);
  console.log(`  Estimated tokens: ~${result.file_info.estimated_tokens.toLocaleString()}`);
  
  // Warnings
  if (result.status === 'warning' && result.issue_details) {
    console.log(chalk.yellow('\n⚠️  Warning:'));
    console.log(`  ${result.issue_details.reason}`);
    console.log(`  Risk level: ${result.issue_details.risk_level}`);
    if (result.issue_details.size_warning) {
      console.log(`  Size: ${result.issue_details.size_warning.size_mb.toFixed(2)}MB`);
      console.log(`  ${result.issue_details.size_warning.recommendation}`);
    }
  }
  
  // Suggestions
  if (result.alternatives && result.alternatives.suggestions.length > 0) {
    console.log(chalk.yellow('\n💡 Suggestions:'));
    result.alternatives.suggestions.forEach((suggestion: string) => {
      console.log(`  • ${suggestion}`);
    });
  }
  
  // Additional warnings
  if (result.warnings && result.warnings.length > 0) {
    console.log(chalk.yellow('\n📝 Notes:'));
    result.warnings.forEach((warning: string) => {
      console.log(`  • ${warning}`);
    });
  }
}

/**
 * Display edit result
 */
function displayEditResult(result: any, verbose: boolean) {
  if (result.status === 'error') {
    console.log(chalk.red('❌ Edit failed'));
    if (result.issue_details) {
      console.log(chalk.red(`  ${result.issue_details.reason}`));
    }
    return;
  }
  
  // Special message for dry run with no regex
  if (result.message) {
    console.log(chalk.yellow('\n' + result.message));
    console.log(`  Total edits: ${result.edit_summary.total_edits}`);
    return;
  }
  
  // Edit summary
  console.log(chalk.yellow('\n📊 Edit Summary:'));
  console.log(`  Total edits: ${result.edit_summary.total_edits}`);
  if (result.edit_summary.successful_edits !== undefined) {
    console.log(`  Successful: ${result.edit_summary.successful_edits}`);
    console.log(`  Failed: ${result.edit_summary.failed_edits}`);
  }
  console.log(`  Regex edits: ${result.edit_summary.regex_edits_count}`);
  if (result.edit_summary.diff_edits_count !== undefined) {
    console.log(`  Diff edits: ${result.edit_summary.diff_edits_count}`);
  }
  if (result.edit_summary.lines_changed !== undefined) {
    console.log(`  Lines changed: ${result.edit_summary.lines_changed}`);
  }
  if (result.edit_summary.formatting_applied) {
    console.log(`  Formatting: Applied`);
  }
  
  // Edit details
  if (result.edit_details && result.edit_details.length > 0) {
    console.log(chalk.yellow('\n📝 Edit Details:'));
    
    for (const edit of result.edit_details) {
      const statusColor = edit.status === 'success' ? chalk.green : 
                         edit.status === 'multiple_matches' ? chalk.yellow : chalk.red;
      const statusIcon = edit.status === 'success' ? '✓' : 
                        edit.status === 'multiple_matches' ? '⚠' : '✗';
      
      console.log(`\n  ${statusColor(statusIcon)} Edit ${edit.edit_index + 1} (${edit.type}):`);
      console.log(`    Pattern: ${edit.old_text_or_pattern}`);
      console.log(`    Replace: ${edit.new_text_or_replacement}`);
      console.log(`    Status: ${edit.status}`);
      if (edit.match_count !== undefined) {
        console.log(`    Matches: ${edit.match_count}`);
      }
      if (edit.diff_hunks !== undefined) {
        console.log(`    Diff hunks: ${edit.diff_hunks}`);
      }
      
      if (edit.sample_matches && verbose) {
        console.log('    Samples:');
        edit.sample_matches.forEach((sample: string) => {
          console.log(`      ${chalk.gray(sample)}`);
        });
      }
    }
  }
  
  // Warnings
  if (result.status === 'warning' && result.issue_details) {
    console.log(chalk.yellow('\n⚠️  Warning:'));
    console.log(`  ${result.issue_details.reason}`);
    console.log(`  Problematic edits: ${result.issue_details.problematic_edits}`);
    console.log(`  Risk: ${result.issue_details.risk_assessment}`);
  }
  
  // Alternative approaches
  if (result.alternatives && result.alternatives.safer_approaches.length > 0) {
    console.log(chalk.yellow('\n🔧 Safer Approaches:'));
    result.alternatives.safer_approaches.forEach((approach: string) => {
      console.log(`  • ${approach}`);
    });
  }
  
  // Suggestions
  if (result.alternatives && result.alternatives.suggestions.length > 0) {
    console.log(chalk.yellow('\n💡 Suggestions:'));
    result.alternatives.suggestions.forEach((suggestion: string) => {
      console.log(`  • ${suggestion}`);
    });
  }
  
  // Diff output
  if (result.diff_output) {
    console.log(chalk.yellow('\n📝 Diff Output:'));
    console.log('─'.repeat(50));
    console.log(result.diff_output);
    console.log('─'.repeat(50));
  }
  
  // Formatting info
  if (result.formatting_info) {
    console.log(chalk.yellow('\n🎨 Formatting Info:'));
    console.log(`  Indent style: ${result.formatting_info.indent_style}`);
    console.log(`  Indent size: ${result.formatting_info.indent_size}`);
    console.log(`  Line ending: ${result.formatting_info.line_ending}`);
    if (result.formatting_info.trailing_whitespace_removed > 0) {
      console.log(`  Trailing spaces removed: ${result.formatting_info.trailing_whitespace_removed} lines`);
    }
  }
}

/**
 * Display move result
 */
function displayMoveResult(result: any, verbose: boolean) {
  if (result.status === 'error') {
    console.log(chalk.red('❌ Move failed'));
    if (result.issue_details) {
      console.log(chalk.red(`  ${result.issue_details.reason}`));
    }
    if (result.alternatives && result.alternatives.suggestions.length > 0) {
      console.log(chalk.yellow('\n💡 Suggestions:'));
      result.alternatives.suggestions.forEach((suggestion: string) => {
        console.log(`  • ${suggestion}`);
      });
    }
    return;
  }
  
  if (result.status === 'warning') {
    console.log(chalk.yellow('⚠️  Warning: ' + result.issue_details.reason));
    if (result.issue_details.existing_file_info) {
      console.log(chalk.yellow('\n📊 Existing File:'));
      console.log(`  Size: ${formatBytes(result.issue_details.existing_file_info.size_bytes)}`);
      console.log(`  Modified: ${new Date(result.issue_details.existing_file_info.last_modified).toLocaleDateString()}`);
    }
    if (result.alternatives && result.alternatives.suggestions.length > 0) {
      console.log(chalk.yellow('\n💡 Suggestions:'));
      result.alternatives.suggestions.forEach((suggestion: string) => {
        console.log(`  • ${suggestion}`);
      });
    }
    return;
  }
  
  // Success
  console.log(chalk.green('\n✅ Move completed successfully'));
  console.log(chalk.yellow('\n📊 Operation Info:'));
  console.log(`  Type: ${result.operation_info.operation_type}`);
  console.log(`  From: ${result.operation_info.source}`);
  console.log(`  To: ${result.operation_info.destination}`);
  console.log(`  Size: ${formatBytes(result.operation_info.size_bytes)}`);
}

/**
 * Display read error
 */
function displayReadError(result: any, verbose: boolean) {
  console.log(chalk.red(`\n❌ ${result.status}`));
  
  // File info
  console.log(chalk.yellow('\n📊 File Info:'));
  console.log(`  Size: ${formatBytes(result.file_info.size_bytes)}`);
  console.log(`  Type: ${result.file_info.type}`);
  console.log(`  Estimated tokens: ~${result.file_info.estimated_tokens?.toLocaleString() || 'unknown'}`);
  
  // Issue details
  console.log(chalk.yellow('\n❗ Issue:'));
  console.log(`  ${result.issue_details.reason}`);
  console.log(`  Limit: ${result.issue_details.current_vs_limit}`);
  
  // Preview
  if (result.preview.first_lines.length > 0) {
    console.log(chalk.yellow('\n📄 Preview:'));
    console.log('─'.repeat(50));
    result.preview.first_lines.forEach((line: string, i: number) => {
      console.log(chalk.gray(`${(i + 1).toString().padStart(3)} │`), line);
    });
    if (result.preview.truncated_at_line) {
      console.log(chalk.gray('... (truncated)'));
    }
    console.log('─'.repeat(50));
  }
  
  // Alternatives
  if (result.alternatives.suggestions.length > 0) {
    console.log(chalk.yellow('\n💡 Suggestions:'));
    result.alternatives.suggestions.forEach((suggestion: string) => {
      console.log(`  • ${suggestion}`);
    });
  }
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

  console.log(chalk.red('🗑️  Delete File:'), options.path);
  console.log('═'.repeat(50));

  const params = {
    path: options.path,
    force: options.force
  };

  const startTime = Date.now();
  const result = await deleteFile(params);
  const duration = Date.now() - startTime;

  // Display result
  if (result.status === 'error') {
    console.log(chalk.red('❌ Failed to delete file'));
    if (result.alternatives?.suggestions) {
      console.log(chalk.yellow('\n💡 Suggestions:'));
      result.alternatives.suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion}`);
      });
    }
  } else if (result.status === 'warning') {
    console.log(chalk.yellow('⚠️  File deleted with warnings'));
  } else {
    console.log(chalk.green('✅ File deleted successfully'));
  }
  
  console.log(chalk.yellow('\n📊 File Info:'));
  console.log(`  Path: ${result.deleted_file.path}`);
  console.log(`  Size: ${formatBytes(result.deleted_file.size_bytes)}`);
  console.log(`  Modified: ${new Date(result.deleted_file.last_modified).toLocaleString()}`);
  console.log(`  Read-only: ${result.deleted_file.was_readonly}`);
  
  if (result.safety_info) {
    console.log(chalk.yellow('\n⚠️  Safety Warnings:'));
    console.log(`  Importance: ${result.safety_info.file_importance}`);
    result.safety_info.warnings.forEach(warning => {
      console.log(`  • ${warning}`);
    });
  }
  
  if (result.alternatives?.suggestions) {
    console.log(chalk.blue('\n💡 Recommendations:'));
    result.alternatives.suggestions.forEach(suggestion => {
      console.log(`  • ${suggestion}`);
    });
  }
  
  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
}

/**
 * Handle rmdir command
 */
async function handleRmdir(argv: string[]) {
  const options = commandLineArgs(rmdirDefinitions, { argv });
  
  if (!options.path) {
    console.error(chalk.red('Error: Directory path required'));
    process.exit(1);
  }

  console.log(chalk.red('🗑️  Delete Directory:'), options.path);
  if (options.recursive) {
    console.log(chalk.yellow('  Mode: Recursive deletion enabled'));
  }
  if (options['dry-run']) {
    console.log(chalk.blue('  Mode: Preview only (dry run)'));
  }
  console.log('═'.repeat(50));

  const params = {
    path: options.path,
    recursive: options.recursive,
    force: options.force,
    dry_run: options['dry-run'],
    max_preview_files: options['max-preview'] || 10
  };

  const startTime = Date.now();
  const result = await deleteDirectory(params);
  const duration = Date.now() - startTime;

  // Display result
  if (result.status === 'error') {
    console.log(chalk.red('❌ Failed to delete directory'));
  } else if (result.status === 'warning') {
    console.log(chalk.yellow('⚠️  Directory operation completed with warnings'));
  } else {
    console.log(chalk.green('✅ Directory operation successful'));
  }
  
  // Show preview or operation summary
  if (result.preview) {
    console.log(chalk.yellow('\n📋 Deletion Preview:'));
    console.log(`  Total files: ${result.preview.total_files}`);
    console.log(`  Total directories: ${result.preview.total_directories}`);
    console.log(`  Total size: ${formatBytes(result.preview.total_size_bytes)}`);
    console.log(`  Estimated time: ${formatDuration(result.preview.estimated_time_ms)}`);
    
    if (result.preview.files_to_delete.length > 0) {
      console.log(chalk.yellow('\n📄 Files to delete (sample):'));
      result.preview.files_to_delete.forEach(file => {
        const importanceIcon = file.importance === 'critical' ? '🔴' : 
                              file.importance === 'important' ? '🟡' : '⚪';
        console.log(`  ${importanceIcon} ${file.path} (${formatBytes(file.size_bytes)})`);
      });
    }
    
    if (result.preview.critical_files_found.length > 0) {
      console.log(chalk.red('\n🚨 Critical files found:'));
      result.preview.critical_files_found.forEach(file => {
        console.log(`  🔴 ${file}`);
      });
    }
  }
  
  if (result.operation_summary) {
    console.log(chalk.yellow('\n📊 Operation Summary:'));
    console.log(`  Deleted files: ${result.operation_summary.deleted_files}`);
    console.log(`  Deleted directories: ${result.operation_summary.deleted_directories}`);
    console.log(`  Total size: ${formatBytes(result.operation_summary.total_size_bytes)}`);
    console.log(`  Operation time: ${formatDuration(result.operation_summary.operation_time_ms)}`);
  }
  
  if (result.safety_warnings) {
    console.log(chalk.yellow('\n⚠️  Safety Warnings:'));
    console.log(`  Risk level: ${result.safety_warnings.risk_level}`);
    result.safety_warnings.warnings.forEach(warning => {
      console.log(`  • ${warning}`);
    });
    
    if (result.safety_warnings.recommendations.length > 0) {
      console.log(chalk.blue('\n💡 Recommendations:'));
      result.safety_warnings.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }
  }
  
  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
}

/**
 * Handle movedir command
 */
async function handleMovedir(argv: string[]) {
  const options = commandLineArgs(movedirDefinitions, { argv, stopAtFirstUnknown: true });
  const remainingArgs = argv.slice(argv.indexOf(options.source) + 1);
  
  if (!options.source) {
    console.error(chalk.red('Error: Source directory path required'));
    process.exit(1);
  }

  const destination = options.destination || remainingArgs[0];
  if (!destination) {
    console.error(chalk.red('Error: Destination directory path required'));
    process.exit(1);
  }

  console.log(chalk.blue('📁 Move Directory:'));
  console.log(chalk.gray('  From:'), options.source);
  console.log(chalk.gray('  To:'), destination);
  if (options.overwrite) {
    console.log(chalk.yellow('  Mode: Overwrite enabled'));
  }
  if (options['dry-run']) {
    console.log(chalk.blue('  Mode: Preview only (dry run)'));
  }
  console.log('═'.repeat(50));

  const params = {
    source: options.source,
    destination,
    overwrite_existing: options.overwrite,
    dry_run: options['dry-run']
  };

  const startTime = Date.now();
  const result = await moveDirectory(params);
  const duration = Date.now() - startTime;

  // Display result
  if (result.status === 'error') {
    console.log(chalk.red('❌ Failed to move directory'));
  } else if (result.status === 'warning') {
    console.log(chalk.yellow('⚠️  Directory move completed with warnings'));
  } else {
    console.log(chalk.green('✅ Directory moved successfully'));
  }
  
  // Show preview or operation info
  if (result.preview) {
    console.log(chalk.yellow('\n📋 Move Preview:'));
    console.log(`  Operation type: ${result.preview.operation_type}`);
    console.log(`  Total files: ${result.preview.source_info.total_files}`);
    console.log(`  Total directories: ${result.preview.source_info.total_directories}`);
    console.log(`  Total size: ${formatBytes(result.preview.source_info.total_size_bytes)}`);
    console.log(`  Estimated time: ${formatDuration(result.preview.source_info.estimated_time_ms)}`);
    console.log(`  Destination exists: ${result.preview.destination_exists}`);
    console.log(`  Will overwrite: ${result.preview.will_overwrite}`);
  }
  
  if (result.operation_info) {
    console.log(chalk.yellow('\n📊 Operation Info:'));
    console.log(`  Operation type: ${result.operation_info.operation_type}`);
    console.log(`  Total files: ${result.operation_info.total_files}`);
    console.log(`  Total directories: ${result.operation_info.total_directories}`);
    console.log(`  Total size: ${formatBytes(result.operation_info.total_size_bytes)}`);
    console.log(`  Operation time: ${formatDuration(result.operation_info.operation_time_ms)}`);
  }
  
  if (result.issue_details) {
    console.log(chalk.yellow('\n⚠️  Issue Details:'));
    console.log(`  ${result.issue_details.reason}`);
  }
  
  if (result.alternatives?.suggestions) {
    console.log(chalk.blue('\n💡 Suggestions:'));
    result.alternatives.suggestions.forEach(suggestion => {
      console.log(`  • ${suggestion}`);
    });
  }
  
  console.log(chalk.gray(`\nCompleted in ${formatDuration(duration)}`));
}

/**
 * Show help message
 */
function showHelp() {
  const sections = [
    {
      header: 'Smart Filesystem MCP - CLI Test Tool',
      content: 'Test tool for Smart Filesystem MCP operations',
    },
    {
      header: 'Usage',
      content: [
        '$ smart-fs-test [allowed-dirs...] <command> [options]',
        '',
        'Allowed directories can be specified before the command to restrict access.',
        'Default: Current directory only'
      ],
    },
    {
      header: 'Commands',
      content: [
        { name: 'list <dir>', summary: 'List directory contents' },
        { name: 'read <file>', summary: 'Read file contents' },
        { name: 'search [dir]', summary: 'Search files by name or content' },
        { name: 'write <file>', summary: 'Write content to a file' },
        { name: 'edit <file>', summary: 'Edit file using literal or regex replacements' },
        { name: 'move <source> <dest>', summary: 'Move or rename a file' },
        { name: 'list-allowed', summary: 'List allowed directories for security' },
        { name: 'file-info <file>', summary: 'Get detailed file/directory information' },
        { name: 'mkdir <dir>', summary: 'Create a directory with parent dirs' },
        { name: 'delete <file>', summary: 'Delete a file with safety checks' },
        { name: 'rmdir <dir>', summary: 'Delete a directory (with dry-run preview)' },
        { name: 'movedir <src> <dest>', summary: 'Move or rename a directory' },
        { name: 'security-test [path]', summary: 'Test security restrictions' },
        { name: 'test-all [path]', summary: 'Run all tests' },
      ],
    },
    {
      header: 'Examples',
      content: [
        '$ smart-fs-test list ./src --hidden',
        '$ smart-fs-test list ./src --sort size --order desc',
        '$ smart-fs-test read package.json',
        '$ smart-fs-test search -f ".*\\.ts$" ./src',
        '$ smart-fs-test search -c "TODO|FIXME" --extensions .js .ts',
        '$ smart-fs-test write test.txt -c "Hello World"',
        '$ echo "Hello World" | smart-fs-test write test.txt',
        '$ smart-fs-test edit config.js -l "console.log,logger.info" --dry-run',
        '$ smart-fs-test edit test.js -r "TODO.*$,DONE" -r "console\\.log\\(,logger.debug("',
        '$ smart-fs-test move old-name.js new-name.js',
        '$ smart-fs-test move important.js backup/important.js.bak -o',
        '$ smart-fs-test list-allowed',
        '$ smart-fs-test file-info src/index.js --verbose',
        '$ smart-fs-test mkdir new/deep/directory',
        '$ smart-fs-test delete temp/cache.txt',
        '$ smart-fs-test delete readonly.txt --force',
        '$ smart-fs-test rmdir node_modules --recursive --dry-run',
        '$ smart-fs-test rmdir empty-dir',
        '$ smart-fs-test movedir old-folder new-folder',
        '$ smart-fs-test movedir project backup/project.old --overwrite',
        '$ smart-fs-test /allowed/dir1 /allowed/dir2 security-test /etc/passwd',
        '$ smart-fs-test test-all',
      ],
    },
  ];

  console.log(commandLineUsage(sections));
}

// Run CLI
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
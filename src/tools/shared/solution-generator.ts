/**
 * Unified Solution Generator for File Operations
 * Generates actionable solutions for LLM-optimized failure responses
 */

import * as path from 'path';
import type { 
  FileOperationFailureReason, 
  OperationContext, 
  PrioritizedSolution,
  ConflictInfo 
} from '../../core/types.js';
import { generateAlternativeNames, detectSimilarPatterns } from './file-status-checker.js';

/**
 * Generate prioritized solutions based on failure reason and context
 */
export function generateFileOperationSolutions(
  reason: FileOperationFailureReason,
  context: OperationContext,
  additionalContext?: {
    fileContent?: string;
    conflictInfo?: ConflictInfo[];
    similarPatterns?: string[];
  }
): PrioritizedSolution[] {
  const solutions: PrioritizedSolution[] = [];
  
  switch (reason) {
    case "file_not_found":
      solutions.push(...generateFileNotFoundSolutions(context));
      break;
      
    case "permission_denied":
      solutions.push(...generatePermissionDeniedSolutions(context));
      break;
      
    case "pattern_not_found":
      solutions.push(...generatePatternNotFoundSolutions(context, additionalContext));
      break;
      
    case "destination_exists":
      solutions.push(...generateDestinationExistsSolutions(context, additionalContext));
      break;
      
    case "invalid_path":
      solutions.push(...generateInvalidPathSolutions(context));
      break;
      
    case "operation_failed":
      solutions.push(...generateOperationFailedSolutions(context));
      break;
  }
  
  return solutions;
}

/**
 * Generate solutions for file not found errors
 */
function generateFileNotFoundSolutions(context: OperationContext): PrioritizedSolution[] {
  const solutions: PrioritizedSolution[] = [];
  const fileName = path.basename(context.target_file);
  const dirName = path.dirname(context.target_file);
  
  // Search for similar file names
  solutions.push({
    method: "search_content",
    params: {
      directory: dirName,
      file_pattern: fileName.replace(path.extname(fileName), '.*'),
      recursive: false
    },
    description: `類似ファイル名を検索: ${fileName}`,
    priority: "high"
  });
  
  // Search in parent directories
  solutions.push({
    method: "search_content", 
    params: {
      directory: path.dirname(dirName),
      file_pattern: fileName,
      recursive: true,
      max_depth: 3
    },
    description: `親ディレクトリで再帰検索: ${fileName}`,
    priority: "medium"
  });
  
  // List directory to see what files are available
  solutions.push({
    method: "list_directory",
    params: {
      path: dirName
    },
    description: `ディレクトリ内容を確認: ${dirName}`,
    priority: "high"
  });
  
  // Create file if it's an edit operation
  if (context.operation_type === "edit") {
    solutions.push({
      method: "write_file",
      params: {
        path: context.target_file,
        content: "// New file created for editing\n"
      },
      description: `新規ファイルを作成: ${fileName}`,
      priority: "medium"
    });
  }
  
  return solutions;
}

/**
 * Generate solutions for permission denied errors
 */
function generatePermissionDeniedSolutions(context: OperationContext): PrioritizedSolution[] {
  const solutions: PrioritizedSolution[] = [];
  
  // Check file info to understand permissions
  solutions.push({
    method: "file_info",
    params: {
      path: context.target_file,
      include_analysis: true
    },
    description: "ファイル権限と詳細情報を確認",
    priority: "high"
  });
  
  // For move operations, suggest alternative destination
  if (context.operation_type === "move" && context.destination_path) {
    const alternatives = generateAlternativeNames(context.destination_path);
    if (alternatives.length > 0) {
      solutions.push({
        method: "move_file",
        params: {
          source: context.target_file,
          destination: alternatives[0]
        },
        description: `書き込み可能な場所へ移動: ${alternatives[0] ? path.basename(alternatives[0]) : 'unknown'}`,
        priority: "high"
      });
    }
  }
  
  // Try reading file to see if we can at least access it
  solutions.push({
    method: "read_file",
    params: {
      path: context.target_file
    },
    description: "ファイル読み取り可能かテスト",
    priority: "medium"
  });
  
  return solutions;
}

/**
 * Generate solutions for pattern not found errors (edit operations)
 */
function generatePatternNotFoundSolutions(
  context: OperationContext, 
  additionalContext?: { fileContent?: string; similarPatterns?: string[] }
): PrioritizedSolution[] {
  const solutions: PrioritizedSolution[] = [];
  
  // Read file first to understand content
  solutions.push({
    method: "read_file",
    params: {
      path: context.target_file
    },
    description: "ファイル全体を確認して正確なパターンを特定",
    priority: "high"
  });
  
  // Search for patterns in the content
  if (context.search_patterns && context.search_patterns.length > 0) {
    const firstPattern = context.search_patterns[0];
    if (!firstPattern) return solutions;
    
    // Generate regex search for similar patterns
    const searchPattern = firstPattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex chars
      .replace(/\\s+/g, '\\s*')              // Flexible whitespace
      .replace(/const|let|var/g, '(const|let|var)'); // Variable declaration flexibility
    
    solutions.push({
      method: "search_content",
      params: {
        directory: path.dirname(context.target_file),
        content_pattern: searchPattern,
        file_pattern: path.basename(context.target_file)
      },
      description: `類似パターンを正規表現で検索: ${searchPattern}`,
      priority: "medium"
    });
  }
  
  // If we have similar patterns, suggest edits with them
  if (additionalContext?.similarPatterns && additionalContext.similarPatterns.length > 0) {
    additionalContext.similarPatterns.forEach((pattern, index) => {
      if (index < 2) { // Only suggest top 2 alternatives
        solutions.push({
          method: "edit_file",
          params: {
            path: context.target_file,
            edits: [{ oldText: pattern, newText: `${pattern} // TODO: Update this` }]
          },
          description: `類似パターンで編集を試行: "${pattern}"`,
          priority: index === 0 ? "medium" : "low"
        });
      }
    });
  }
  
  return solutions;
}

/**
 * Generate solutions for destination exists errors (move operations)
 */
function generateDestinationExistsSolutions(
  context: OperationContext,
  _additionalContext?: { conflictInfo?: ConflictInfo[] }
): PrioritizedSolution[] {
  const solutions: PrioritizedSolution[] = [];
  
  if (!context.destination_path) return solutions;
  
  // Read existing file to understand what would be overwritten
  solutions.push({
    method: "read_file",
    params: {
      path: context.destination_path
    },
    description: "既存ファイルの内容を確認してから判断",
    priority: "high"
  });
  
  // Generate alternative names
  const alternatives = generateAlternativeNames(context.destination_path);
  
  // Suggest timestamped backup name (highest priority)
  if (alternatives.length > 1) {
    solutions.push({
      method: "move_file",
      params: {
        source: context.target_file,
        destination: alternatives[1] // Timestamped version
      },
      description: `タイムスタンプ付きの別名で移動: ${alternatives[1] ? path.basename(alternatives[1]) : 'unknown'}`,
      priority: "high"
    });
  }
  
  // Suggest backup name
  if (alternatives.length > 0) {
    solutions.push({
      method: "move_file",
      params: {
        source: context.target_file,
        destination: alternatives[0] // Backup version
      },
      description: `バックアップ名で移動: ${alternatives[0] ? path.basename(alternatives[0]) : 'unknown'}`,
      priority: "medium"
    });
  }
  
  // Suggest overwrite with confirmation
  solutions.push({
    method: "move_file",
    params: {
      source: context.target_file,
      destination: context.destination_path,
      overwrite_existing: true
    },
    description: "既存ファイルを上書き（データ損失リスク）",
    priority: "low"
  });
  
  return solutions;
}

/**
 * Generate solutions for invalid path errors
 */
function generateInvalidPathSolutions(context: OperationContext): PrioritizedSolution[] {
  const solutions: PrioritizedSolution[] = [];
  
  // Convert to absolute path
  const absolutePath = path.resolve(context.target_file);
  
  if (context.operation_type === "edit") {
    solutions.push({
      method: "edit_file",
      params: {
        path: absolutePath,
        edits: [] // Will need to be filled by caller
      },
      description: `絶対パス「${absolutePath}」で再試行`,
      priority: "high"
    });
  } else if (context.operation_type === "move" && context.destination_path) {
    const absoluteDestination = path.resolve(context.destination_path);
    solutions.push({
      method: "move_file",
      params: {
        source: absolutePath,
        destination: absoluteDestination
      },
      description: `絶対パス「${absolutePath}」→「${absoluteDestination}」で再試行`,
      priority: "high"
    });
  }
  
  // List current directory to help user understand context
  solutions.push({
    method: "list_directory",
    params: {
      path: process.cwd()
    },
    description: "現在のディレクトリ内容を確認",
    priority: "medium"
  });
  
  return solutions;
}

/**
 * Generate solutions for general operation failed errors
 */
function generateOperationFailedSolutions(context: OperationContext): PrioritizedSolution[] {
  const solutions: PrioritizedSolution[] = [];
  
  // Check file status
  solutions.push({
    method: "file_info",
    params: {
      path: context.target_file,
      include_analysis: true
    },
    description: "ファイル状態と権限を詳細確認",
    priority: "high"
  });
  
  // For move operations, check destination directory
  if (context.operation_type === "move" && context.destination_path) {
    const destDir = path.dirname(context.destination_path);
    solutions.push({
      method: "list_directory",
      params: {
        path: destDir
      },
      description: `移動先ディレクトリを確認: ${destDir}`,
      priority: "high"
    });
  }
  
  // Try a simpler version of the operation
  if (context.operation_type === "edit") {
    solutions.push({
      method: "read_file",
      params: {
        path: context.target_file
      },
      description: "まずファイル読み取りが可能か確認",
      priority: "medium"
    });
  }
  
  return solutions;
}

/**
 * Generate solutions for specific edit patterns (helper)
 */
export function generateEditPatternSolutions(
  filePath: string,
  failedPatterns: string[],
  fileContent?: string
): PrioritizedSolution[] {
  const solutions: PrioritizedSolution[] = [];
  
  if (!fileContent) {
    return solutions;
  }
  
  // For each failed pattern, find similar patterns and suggest alternatives
  failedPatterns.forEach(pattern => {
    const similarPatterns = detectSimilarPatterns(fileContent, pattern);
    
    similarPatterns.forEach((similarPattern, index) => {
      solutions.push({
        method: "edit_file",
        params: {
          path: filePath,
          edits: [{ oldText: similarPattern, newText: pattern }]
        },
        description: `「${similarPattern}」を「${pattern}」に変更`,
        priority: index === 0 ? "medium" : "low"
      });
    });
  });
  
  return solutions.slice(0, 3); // Return top 3 suggestions
}
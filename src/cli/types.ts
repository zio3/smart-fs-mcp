/**
 * Smart Filesystem MCP - CLI Type Definitions
 * Types specific to CLI functionality
 */

export interface CliGlobalOptions {
  verbose?: boolean;
  quiet?: boolean;
  format?: 'json' | 'table' | 'tree';
  output?: string;
  benchmark?: boolean;
  help?: boolean;
  version?: boolean;
}

export interface ScanCommandOptions extends CliGlobalOptions {
  path: string;
  maxFiles?: number;
  maxDepth?: number;
  types?: string;
  sort?: string;
  exclude?: string;
  includeHidden?: boolean;
}

export interface PeekCommandOptions extends CliGlobalOptions {
  path: string;
  lines?: number;
  tail?: boolean;
  tailLines?: number;
  encoding?: string;
}

export interface SafetyCommandOptions extends CliGlobalOptions {
  path: string;
  operation?: string;
  simulateSize?: string;
}

export interface AnalyzeCommandOptions extends CliGlobalOptions {
  path: string;
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

export interface CliContext {
  startTime: number;
  verbose: boolean;
  quiet: boolean;
  format: 'json' | 'table' | 'tree';
  benchmark: boolean;
}
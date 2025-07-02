/**
 * Smart Filesystem MCP - File Analyzer
 * File analysis engine for detailed file inspection
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { detect } from 'chardet';
import { FILE_CLASSIFICATION, TOKEN_ESTIMATION, BOM_PATTERNS } from '../utils/constants.js';
import { 
  getFileTypeFromExtension,
  detectBOM,
  isBinaryContent,
  estimateTokenCount,
  formatBytes
} from '../utils/helpers.js';
import type { FileAnalysis, FileInfo, FileType, FileEncoding } from './types.js';

/**
 * File Analyzer class - provides detailed file analysis
 */
export class FileAnalyzer {
  private fileCache: Map<string, { analysis: FileAnalysis; timestamp: number }>;
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.fileCache = new Map();
  }

  /**
   * Analyze a file and return detailed information
   */
  async analyzeFile(filePath: string): Promise<FileAnalysis> {
    // Check cache first
    const cached = this.getCachedAnalysis(filePath);
    if (cached) return cached;

    try {
      // Get basic file info
      const stats = await fs.stat(filePath);
      const fileInfo = await this.getFileInfo(filePath, stats);
      
      // Detect file type
      const fileType = await this.detectFileType(filePath);
      
      // Read initial content for analysis
      const buffer = await this.readFileStart(filePath, Math.min(stats.size, 8192));
      
      // Detect encoding
      const encoding = await this.detectEncoding(buffer, filePath);
      
      // Check if binary
      const isBinary = isBinaryContent(buffer);
      
      // Estimate tokens if text file
      let estimatedTokens: number | undefined;
      let preview: FileAnalysis['preview'] | undefined;
      let detectedLanguage: string | undefined;
      
      if (!isBinary && fileType.readable) {
        const textContent = buffer.toString(encoding as BufferEncoding || 'utf8');
        estimatedTokens = estimateTokenCount(textContent, fileType);
        
        // Get preview lines
        const lines = textContent.split('\n');
        preview = {
          lines: lines.slice(0, 5),
          truncated: lines.length > 5 || textContent.length < stats.size
        };
        
        // Detect language for code files
        if (fileType.category === 'code') {
          detectedLanguage = this.detectProgrammingLanguage(filePath, textContent);
        }
      }
      
      // Build analysis result
      const analysis: FileAnalysis = {
        ...fileInfo,
        fileType,
        mimeType: this.getMimeType(fileType, filePath),
        extension: path.extname(filePath).toLowerCase(),
        encoding,
        isBinary,
        isSafeToRead: !isBinary && fileType.readable && stats.size < 1024 * 1024,
        estimatedTokens,
        detectedLanguage,
        preview,
        confidence: this.calculateConfidence(fileType, encoding, isBinary),
        warnings: this.generateWarnings(stats, isBinary, estimatedTokens)
      };
      
      // Cache the result
      this.cacheAnalysis(filePath, analysis);
      
      return analysis;
      
    } catch (error) {
      throw new Error(`Failed to analyze file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get basic file information
   */
  private async getFileInfo(filePath: string, stats: fs.Stats): Promise<FileInfo> {
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isSymlink: stats.isSymbolicLink(),
      permissions: {
        readable: true, // Already checked in safety controller
        writable: await this.checkWritable(filePath),
        executable: await this.checkExecutable(filePath)
      },
      timestamps: {
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime
      }
    };
  }

  /**
   * Detect file type with content analysis
   */
  async detectFileType(filePath: string, content?: Buffer): Promise<FileType> {
    // Start with extension-based detection
    const extensionType = getFileTypeFromExtension(filePath);
    
    // If we have content, verify the type
    if (content) {
      // Check for shebang in scripts
      if (content.length >= 2 && content[0] === 0x23 && content[1] === 0x21) { // #!
        const firstLine = content.toString('utf8', 0, Math.min(100, content.length)).split('\n')[0];
        if (firstLine.includes('python')) {
          return { category: 'code', specificType: 'python', readable: true, confidence: 'high' };
        } else if (firstLine.includes('node') || firstLine.includes('deno')) {
          return { category: 'code', specificType: 'javascript', readable: true, confidence: 'high' };
        } else if (firstLine.includes('bash') || firstLine.includes('sh')) {
          return { category: 'code', specificType: 'shell', readable: true, confidence: 'high' };
        }
      }
      
      // Check for XML/HTML
      const start = content.toString('utf8', 0, Math.min(100, content.length)).trim();
      if (start.startsWith('<?xml') || start.startsWith('<!DOCTYPE html') || start.startsWith('<html')) {
        return { category: 'web', specificType: 'markup', readable: true, confidence: 'high' };
      }
      
      // Check for JSON
      if (start.startsWith('{') || start.startsWith('[')) {
        try {
          JSON.parse(content.toString('utf8', 0, Math.min(1024, content.length)));
          return { category: 'config', specificType: 'json', readable: true, confidence: 'high' };
        } catch {
          // Not valid JSON, stick with extension type
        }
      }
    }
    
    return extensionType;
  }

  /**
   * Detect file encoding
   */
  async detectEncoding(buffer: Buffer, filePath?: string): Promise<FileEncoding> {
    // First check for BOM
    const bomEncoding = detectBOM(buffer);
    if (bomEncoding) return bomEncoding;
    
    // Use chardet library for detection
    try {
      const detected = detect(buffer);
      if (detected) {
        // Map common chardet results to our encoding types
        const encodingMap: Record<string, FileEncoding> = {
          'UTF-8': 'utf8',
          'UTF-16 LE': 'utf16le',
          'UTF-16 BE': 'utf16be',
          'UTF-32 LE': 'utf32le',
          'UTF-32 BE': 'utf32be',
          'ascii': 'ascii',
          'ISO-8859-1': 'latin1',
          'Shift_JIS': 'shift_jis',
          'EUC-JP': 'euc-jp',
          'GB2312': 'gb2312',
          'GB18030': 'gb2312'
        };
        
        const mapped = encodingMap[detected];
        if (mapped) return mapped;
      }
    } catch {
      // Chardet failed, continue with defaults
    }
    
    // Default based on file type
    if (filePath) {
      const ext = path.extname(filePath).toLowerCase();
      // Source code files are usually UTF-8
      if (FILE_CLASSIFICATION.code.extensions.includes(ext)) {
        return 'utf8';
      }
    }
    
    // Default to UTF-8
    return 'utf8';
  }

  /**
   * Estimate token count for file
   */
  estimateTokens(content: string, fileType?: FileType): number {
    return estimateTokenCount(content, fileType);
  }

  /**
   * Detect programming language from content
   */
  private detectProgrammingLanguage(filePath: string, content: string): string | undefined {
    const ext = path.extname(filePath).toLowerCase();
    
    // Extension mapping
    const extensionLanguageMap: Record<string, string> = {
      '.js': 'JavaScript',
      '.jsx': 'JavaScript React',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript React',
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.php': 'PHP',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.r': 'R',
      '.lua': 'Lua',
      '.dart': 'Dart',
      '.sh': 'Shell',
      '.bash': 'Bash',
      '.ps1': 'PowerShell'
    };
    
    // First try extension
    if (extensionLanguageMap[ext]) {
      return extensionLanguageMap[ext];
    }
    
    // Try content-based detection for common patterns
    const lines = content.split('\n').slice(0, 10);
    const firstNonEmptyLine = lines.find(line => line.trim().length > 0);
    
    if (firstNonEmptyLine) {
      // Python
      if (firstNonEmptyLine.includes('import ') || firstNonEmptyLine.includes('from ') || 
          firstNonEmptyLine.includes('def ') || firstNonEmptyLine.includes('class ')) {
        return 'Python';
      }
      
      // JavaScript/TypeScript
      if (firstNonEmptyLine.includes('const ') || firstNonEmptyLine.includes('let ') ||
          firstNonEmptyLine.includes('var ') || firstNonEmptyLine.includes('function ')) {
        return content.includes(': ') ? 'TypeScript' : 'JavaScript';
      }
      
      // Java
      if (firstNonEmptyLine.includes('public class') || firstNonEmptyLine.includes('package ')) {
        return 'Java';
      }
    }
    
    return undefined;
  }

  /**
   * Get MIME type for file
   */
  private getMimeType(fileType: FileType, filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    // Common MIME types
    const mimeMap: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.csv': 'text/csv'
    };
    
    return mimeMap[ext] || 'application/octet-stream';
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(fileType: FileType, encoding?: FileEncoding, isBinary?: boolean): number {
    let score = 0;
    
    // File type confidence contributes 40%
    if (fileType.confidence === 'high') score += 40;
    else if (fileType.confidence === 'medium') score += 25;
    else score += 10;
    
    // Known encoding adds 30%
    if (encoding && encoding !== 'unknown') score += 30;
    
    // Binary detection consistency adds 30%
    if (isBinary !== undefined) {
      if ((isBinary && !fileType.readable) || (!isBinary && fileType.readable)) {
        score += 30;
      }
    }
    
    return Math.min(score, 100);
  }

  /**
   * Generate warnings for file
   */
  private generateWarnings(stats: fs.Stats, isBinary: boolean, estimatedTokens?: number): string[] {
    const warnings: string[] = [];
    
    // Size warnings
    if (stats.size > 500 * 1024) {
      warnings.push(`Large file: ${formatBytes(stats.size)}`);
    }
    
    // Token warnings
    if (estimatedTokens && estimatedTokens > TOKEN_ESTIMATION.CHARS_PER_TOKEN * 10000) {
      warnings.push(`High token count: ~${estimatedTokens.toLocaleString()} tokens`);
    }
    
    // Binary warning
    if (isBinary) {
      warnings.push('File contains binary data');
    }
    
    // Age warning
    const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified > 365) {
      warnings.push(`File not modified for ${Math.floor(daysSinceModified)} days`);
    }
    
    return warnings;
  }

  /**
   * Read start of file safely
   */
  private async readFileStart(filePath: string, bytes: number): Promise<Buffer> {
    const handle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(bytes);
      const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  /**
   * Check if file is writable
   */
  private async checkWritable(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if file is executable
   */
  private async checkExecutable(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cache analysis result
   */
  private cacheAnalysis(filePath: string, analysis: FileAnalysis): void {
    this.fileCache.set(filePath, {
      analysis,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    this.cleanCache();
  }

  /**
   * Get cached analysis if fresh
   */
  private getCachedAnalysis(filePath: string): FileAnalysis | null {
    const cached = this.fileCache.get(filePath);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.analysis;
    }
    return null;
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [path, entry] of this.fileCache.entries()) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.fileCache.delete(path);
      }
    }
  }
}
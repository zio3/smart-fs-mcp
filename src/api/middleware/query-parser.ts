import { Request, Response, NextFunction } from 'express';
import type { PrioritizedSolution } from '../../core/types.js';

/**
 * クエリパラメータ型変換ミドルウェア（BREAKING CHANGE: failedInfo形式）
 */
export function parseQueryParameters(req: Request, res: Response, next: NextFunction): void | Response {
  try {
    const query = req.query;
    const errors: string[] = [];
    
    // Boolean型パラメータの変換（エラーハンドリング付き）
    const booleanParams = ['dry_run', 'recursive', 'force', 'include_hidden', 'case_sensitive', 'whole_word', 'acknowledge_risk', 'overwrite_existing', 'preserve_formatting'];
    for (const param of booleanParams) {
      if (query[param] !== undefined) {
        const value = query[param] as string;
        if (value === 'true' || value === 'false') {
          (query as any)[param] = value === 'true';
        } else {
          errors.push(`${param} must be 'true' or 'false', got '${value}'`);
        }
      }
    }
    
    // Number型パラメータの変換（エラーハンドリング付き）
    const numberParams = ['max_files', 'max_depth', 'max_matches_per_file', 'max_preview_files', 'max_size_mb'];
    for (const param of numberParams) {
      if (query[param] !== undefined && typeof query[param] === 'string') {
        const num = Number(query[param]);
        if (isNaN(num)) {
          errors.push(`${param} must be a valid number, got '${query[param]}'`);
        } else {
          (query as any)[param] = num;
        }
      }
    }
    
    if (errors.length > 0) {
      // BREAKING CHANGE: Convert to failedInfo format
      const solutions: PrioritizedSolution[] = [
        {
          method: 'check_documentation',
          params: { url: '/api-docs' },
          description: 'SwaggerUIでパラメータの正しい形式を確認',
          priority: 'high'
        },
        {
          method: 'api_info',
          params: { endpoint: '/api' },
          description: 'API情報でパラメータ仕様を確認',
          priority: 'medium'
        }
      ];

      return res.status(400).json({
        success: false,
        failedInfo: {
          reason: 'validation_error',
          message: `パラメータ形式エラー: ${errors.join('; ')}`,
          solutions,
          error_code: 'VALIDATION_ERROR'
        }
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
}
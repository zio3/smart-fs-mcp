import { Request, Response, NextFunction } from 'express';

/**
 * クエリパラメータ型変換ミドルウェア（統一エラー形式）
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
      // Return unified error format
      return res.status(400).json({
        success: false,
        error: {
          code: 'invalid_parameter',
          message: `パラメータ形式エラー: ${errors.join('; ')}`,
          details: {
            errors: errors
          },
          suggestions: [
            'SwaggerUIでパラメータ仕様を確認してください (/api-docs)',
            'API情報でパラメータ仕様を確認してください (/api)'
          ]
        }
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
}
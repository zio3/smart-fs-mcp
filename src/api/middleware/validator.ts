/**
 * Smart Filesystem MCP API - Validation Middleware
 * Request parameter validation utilities
 */

import { Request, Response, NextFunction } from 'express';
import * as path from 'path';

/**
 * Validation rule type
 */
export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null; // Return error message or null if valid
}

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(
    public field: string,
    public message: string,
    public value?: any
  ) {
    super(`Validation failed for field '${field}': ${message}`);
    this.name = 'ValidationError';
  }
}

/**
 * Validate a single field against rules
 */
function validateField(value: any, rule: ValidationRule): string | null {
  const { field, required, type, minLength, maxLength, min, max, pattern, custom } = rule;

  // Check required
  if (required && (value === undefined || value === null || value === '')) {
    return `${field} is required`;
  }

  // If not required and empty, skip other validations
  if (!required && (value === undefined || value === null || value === '')) {
    return null;
  }

  // Check type
  if (type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== type) {
      return `${field} must be of type ${type}, got ${actualType}`;
    }
  }

  // String validations
  if (type === 'string' && typeof value === 'string') {
    if (minLength !== undefined && value.length < minLength) {
      return `${field} must be at least ${minLength} characters long`;
    }
    if (maxLength !== undefined && value.length > maxLength) {
      return `${field} must be at most ${maxLength} characters long`;
    }
    if (pattern && !pattern.test(value)) {
      return `${field} format is invalid`;
    }
  }

  // Number validations
  if (type === 'number' && typeof value === 'number') {
    if (min !== undefined && value < min) {
      return `${field} must be at least ${min}`;
    }
    if (max !== undefined && value > max) {
      return `${field} must be at most ${max}`;
    }
  }

  // Array validations
  if (type === 'array' && Array.isArray(value)) {
    if (minLength !== undefined && value.length < minLength) {
      return `${field} must have at least ${minLength} items`;
    }
    if (maxLength !== undefined && value.length > maxLength) {
      return `${field} must have at most ${maxLength} items`;
    }
  }

  // Custom validation
  if (custom) {
    return custom(value);
  }

  return null;
}

/**
 * Create validation middleware
 */
export function validate(rules: ValidationRule[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: { field: string; message: string; value?: any }[] = [];
    
    // Combine query, body, and params for validation
    const data = { ...req.query, ...req.body, ...req.params };

    for (const rule of rules) {
      const value = data[rule.field];
      const error = validateField(value, rule);
      
      if (error) {
        errors.push({
          field: rule.field,
          message: error,
          value
        });
      }
    }

    if (errors.length > 0) {
      const validationError = new ValidationError(
        errors[0]?.field || 'unknown',
        errors.map(e => e.message).join('; ')
      );
      return next(validationError);
    }

    next();
  };
}

/**
 * Common validation rules
 */
export const commonRules = {
  filePath: (required = true): ValidationRule => ({
    field: 'path',
    required,
    type: 'string',
    minLength: 1,
    maxLength: 2000,
    custom: (value: string) => {
      if (!value) return null;
      
      // Check for null bytes (security)
      if (value.includes('\0')) {
        return 'File path cannot contain null bytes';
      }
      
      // Basic path traversal check (more detailed check in security controller)
      if (value.includes('..')) {
        return 'Path traversal attempts are not allowed';
      }
      
      return null;
    }
  }),

  absoluteFilePath: (required = true): ValidationRule => ({
    field: 'path',
    required,
    type: 'string',
    minLength: 1,
    maxLength: 2000,
    custom: (value: string) => {
      if (!value) return null;
      
      // Check for null bytes (security)
      if (value.includes('\0')) {
        return 'File path cannot contain null bytes';
      }
      
      // Basic path traversal check
      if (value.includes('..')) {
        return 'Path traversal attempts are not allowed';
      }
      
      // BREAKING CHANGE: Absolute path required
      if (!path.isAbsolute(value)) {
        return 'Path must be absolute (e.g., "C:\\Users\\..." or "/home/...") - breaking change: relative paths no longer supported';
      }
      
      return null;
    }
  }),

  sourceAndDestination: (): ValidationRule[] => [
    {
      field: 'source',
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 2000,
      custom: (value: string) => {
        if (value.includes('\0')) return 'Source path cannot contain null bytes';
        if (value.includes('..')) return 'Path traversal attempts are not allowed';
        return null;
      }
    },
    {
      field: 'destination',
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 2000,
      custom: (value: string) => {
        if (value.includes('\0')) return 'Destination path cannot contain null bytes';
        if (value.includes('..')) return 'Path traversal attempts are not allowed';
        return null;
      }
    }
  ],

  absoluteSourceAndDestination: (): ValidationRule[] => [
    {
      field: 'source',
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 2000,
      custom: (value: string) => {
        if (value.includes('\0')) return 'Source path cannot contain null bytes';
        if (value.includes('..')) return 'Path traversal attempts are not allowed';
        // BREAKING CHANGE: Absolute path required
        if (!path.isAbsolute(value)) {
          return 'Source path must be absolute (breaking change)';
        }
        return null;
      }
    },
    {
      field: 'destination',
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 2000,
      custom: (value: string) => {
        if (value.includes('\0')) return 'Destination path cannot contain null bytes';
        if (value.includes('..')) return 'Path traversal attempts are not allowed';
        // BREAKING CHANGE: Absolute path required
        if (!path.isAbsolute(value)) {
          return 'Destination path must be absolute (breaking change)';
        }
        return null;
      }
    }
  ],

  content: (required = true): ValidationRule => ({
    field: 'content',
    required,
    type: 'string',
    maxLength: 100 * 1024 * 1024 // 100MB limit
  }),

  maxSize: (): ValidationRule => ({
    field: 'maxSize',
    required: false,
    type: 'number',
    min: 1,
    max: 100 * 1024 * 1024 // 100MB
  }),

  encoding: (): ValidationRule => ({
    field: 'encoding',
    required: false,
    type: 'string',
    pattern: /^(utf8|utf16le|utf16be|latin1|ascii)$/
  }),

  boolean: (field: string, required = false): ValidationRule => ({
    field,
    required,
    type: 'boolean'
  }),

  positiveInteger: (field: string, required = false, max = 10000): ValidationRule => ({
    field,
    required,
    type: 'number',
    min: 1,
    max
  }),

  searchPattern: (required = true): ValidationRule => ({
    field: 'pattern',
    required,
    type: 'string',
    minLength: 1,
    maxLength: 1000,
    custom: (value: string) => {
      if (!value) return null;
      
      try {
        // Test if it's a valid regex
        new RegExp(value);
        return null;
      } catch (error) {
        return 'Pattern must be a valid regular expression';
      }
    }
  }),

  fileExtensions: (): ValidationRule => ({
    field: 'extensions',
    required: false,
    type: 'array',
    maxLength: 50,
    custom: (value: string[]) => {
      if (!Array.isArray(value)) return null;
      
      for (const ext of value) {
        if (typeof ext !== 'string') {
          return 'All extensions must be strings';
        }
        if (!ext.startsWith('.')) {
          return 'Extensions must start with a dot (e.g., ".js")';
        }
        if (ext.length > 10) {
          return 'Extensions must be 10 characters or less';
        }
      }
      return null;
    }
  })
};

/**
 * Sanitize file path
 */
export function sanitizePath(filePath: string): string {
  // Remove null bytes
  let sanitized = filePath.replace(/\0/g, '');
  
  // Normalize path separators
  sanitized = path.normalize(sanitized);
  
  // Remove leading/trailing whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}
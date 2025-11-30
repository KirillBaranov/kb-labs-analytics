/**
 * Event validator with detailed error reporting
 */

import { AnalyticsEventV1Schema, type AnalyticsEventV1 } from './event-v1';

export interface ValidationResult {
  valid: boolean;
  event?: AnalyticsEventV1;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

/**
 * Validate event with detailed error reporting
 */
export function validateEventDetailed(data: unknown): ValidationResult {
  const result = AnalyticsEventV1Schema.safeParse(data);

  if (result.success) {
    return {
      valid: true,
      event: result.data,
    };
  }

  const errors: ValidationError[] = result.error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  return {
    valid: false,
    errors,
  };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map((e) => `  ${e.path}: ${e.message} (${e.code})`).join('\n');
}


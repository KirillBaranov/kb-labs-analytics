/**
 * Schema exports
 */

export {
  AnalyticsEventV1Schema,
  validateEvent,
  safeValidateEvent,
  type AnalyticsEventV1 as SchemaAnalyticsEventV1,
} from './event-v1';

export {
  validateEventDetailed,
  formatValidationErrors,
  type ValidationResult,
  type ValidationError,
} from './validator';


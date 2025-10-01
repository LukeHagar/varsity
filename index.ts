// Main functional exports
export {
  validate,
  parse,
  generateValidationReport,
  saveValidationReport,
  validateMultiple,
  getSupportedVersions,
  createVarsity,
  // Individual module exports
  parseOpenAPISpec,
  validateBasicStructure,
  validateOpenAPISpec,
  generateReport,
  saveReport,
} from "./src/varsity.js";

// Type exports
export type {
  ParsedSpec,
  ValidationResult,
  ValidationError,
  ValidationOptions,
  ReportOptions,
  VarsityConfig,
  OpenAPIVersion,
  CLIResult,
} from "./src/types.js";

// Default export - functional instance
export { default } from "./src/varsity.js";

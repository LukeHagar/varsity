// Main functional exports
export {
  validate,
  parse,
  generateValidationReport,
  saveValidationReport,
  validateWithReferences,
  validateMultipleWithReferences,
  analyzeDocumentReferences,
  getSupportedVersions,
  createVarsity,
  // Individual module exports
  parseOpenAPISpec,
  validateBasicStructure,
  validateOpenAPISpec,
  generateReport,
  saveReport,
  // Recursive validation exports
  validateRecursively,
  validateMultipleRecursively,
  analyzeReferences,
  // Reference resolver exports
  resolveReference,
  findReferences,
  resolveAllReferences,
  // Partial validation exports
  validatePartialDocument,
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
  RecursiveValidationResult,
} from "./src/types.js";

// Export types from other modules
export type {
  ResolvedReference,
  ReferenceContext,
} from "./src/ref-resolver.js";

// Default export - functional instance
export { default } from "./src/varsity.js";

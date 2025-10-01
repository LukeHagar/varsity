import { parseOpenAPISpec, validateBasicStructure } from "./parser.js";
import { validateOpenAPISpec } from "./validator.js";
import { generateReport, saveReport } from "./reporter.js";
import {
  validateRecursively,
  validateMultipleRecursively,
  analyzeReferences,
} from "./recursive-validator.js";
import type {
  ParsedSpec,
  ValidationResult,
  ValidationOptions,
  ReportOptions,
  VarsityConfig,
  OpenAPISpec,
  RecursiveValidationResult,
} from "./types.js";

// Default configuration
const defaultConfig: VarsityConfig = {
  defaultVersion: "3.0",
  strictMode: false,
  customSchemas: {},
  reportFormats: ["json"],
};

/**
 * Parse and validate an OpenAPI specification or multiple specifications
 */
export const validate = async (
  source: string | string[],
  options: ValidationOptions = {},
  config: VarsityConfig = defaultConfig
): Promise<ValidationResult | ValidationResult[]> => {
  // If source is an array, validate multiple specifications
  if (Array.isArray(source)) {
    const results: ValidationResult[] = [];

    for (const singleSource of source) {
      try {
        const result = await validateSingle(singleSource, options, config);
        results.push(result);
      } catch (error) {
        // Create error result for failed parsing
        const errorResult: ValidationResult = {
          valid: false,
          errors: [
            {
              path: "/",
              message: `Failed to parse specification: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
          warnings: [],
          spec: {} as OpenAPISpec,
          version: config.defaultVersion!,
        };
        results.push(errorResult);
      }
    }

    return results;
  }

  // Single specification validation
  return validateSingle(source, options, config);
};

/**
 * Internal function to validate a single OpenAPI specification
 */
const validateSingle = async (
  source: string,
  options: ValidationOptions = {},
  config: VarsityConfig = defaultConfig
): Promise<ValidationResult> => {
  const parsed = await parseOpenAPISpec(source);

  // Merge options with config
  const validationOptions: ValidationOptions = {
    strict: options.strict ?? config.strictMode,
    validateExamples: options.validateExamples ?? false,
    validateReferences: options.validateReferences ?? false,
    customRules: options.customRules,
    ...options,
  };

  // If recursive validation is requested, use the recursive validator
  if (options.recursive) {
    const recursiveResult = await validateRecursively(
      source,
      validationOptions
    );
    return {
      valid: recursiveResult.valid,
      errors: recursiveResult.errors,
      warnings: recursiveResult.warnings,
      spec: recursiveResult.spec,
      version: recursiveResult.version,
    };
  }

  return validateOpenAPISpec(parsed.spec, parsed.version, validationOptions);
};

/**
 * Parse an OpenAPI specification without validation
 */
export const parse = async (source: string): Promise<ParsedSpec> => {
  return parseOpenAPISpec(source);
};

/**
 * Generate a validation report
 */
export const generateValidationReport = async (
  source: string,
  reportOptions: ReportOptions,
  validationOptions: ValidationOptions = {},
  config: VarsityConfig = defaultConfig
): Promise<string> => {
  const result = await validate(source, validationOptions, config);
  // Since source is a string, result will be ValidationResult, not ValidationResult[]
  return generateReport(result as ValidationResult, reportOptions);
};

/**
 * Save a validation report to file
 */
export const saveValidationReport = async (
  source: string,
  reportOptions: ReportOptions,
  validationOptions: ValidationOptions = {},
  config: VarsityConfig = defaultConfig
): Promise<void> => {
  const report = await generateValidationReport(
    source,
    reportOptions,
    validationOptions,
    config
  );
  if (reportOptions.output) {
    saveReport(report, reportOptions.output);
  } else {
    console.log(report);
  }
};

/**
 * Recursively validate an OpenAPI specification and all its references
 */
export const validateWithReferences = async (
  source: string,
  options: ValidationOptions = {},
  config: VarsityConfig = defaultConfig
): Promise<RecursiveValidationResult> => {
  return validateRecursively(source, { ...options, recursive: true });
};

/**
 * Recursively validate multiple OpenAPI specifications
 */
export const validateMultipleWithReferences = async (
  sources: string[],
  options: ValidationOptions = {},
  config: VarsityConfig = defaultConfig
): Promise<RecursiveValidationResult[]> => {
  return validateMultipleRecursively(sources, { ...options, recursive: true });
};

/**
 * Analyze references in an OpenAPI specification
 */
export const analyzeDocumentReferences = async (source: string) => {
  return analyzeReferences(source);
};

/**
 * Get supported OpenAPI versions
 */
export const getSupportedVersions = (): string[] => {
  return ["2.0", "3.0.0", "3.0.1", "3.0.2", "3.0.3", "3.1.0"];
};

/**
 * Create a Varsity instance with configuration
 */
export const createVarsity = (config: VarsityConfig = {}) => {
  const mergedConfig = { ...defaultConfig, ...config };

  return {
    validate: (source: string | string[], options: ValidationOptions = {}) =>
      validate(source, options, mergedConfig),
    parse,
    generateReport: (
      source: string,
      reportOptions: ReportOptions,
      validationOptions: ValidationOptions = {}
    ) =>
      generateValidationReport(
        source,
        reportOptions,
        validationOptions,
        mergedConfig
      ),
    getSupportedVersions,
    getConfig: () => ({ ...mergedConfig }),
    updateConfig: (newConfig: Partial<VarsityConfig>) => {
      Object.assign(mergedConfig, newConfig);
    },
  };
};

// Export individual functions for direct use
export { parseOpenAPISpec, validateBasicStructure } from "./parser.js";
export { validateOpenAPISpec } from "./validator.js";
export { generateReport, saveReport } from "./reporter.js";

export type {
  ParsedSpec,
  ValidationResult,
  ValidationError,
  ValidationOptions,
  ReportOptions,
  VarsityConfig,
  OpenAPIVersion,
  CLIResult,
} from "./types.js";

// Default export - create a default instance
export default createVarsity();

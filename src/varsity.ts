import { parseOpenAPISpec, validateBasicStructure } from "./parser.js";
import { validateOpenAPISpec } from "./validator.js";
import { generateReport, saveReport } from "./reporter.js";
import {
  validateRecursively,
  validateMultipleRecursively,
  analyzeReferences,
} from "./recursive-validator.js";
import {
  analyzeSpecification,
  generateDetailedSummary,
  generateJSONSummary,
} from "./summary-analyzer.js";
import { log } from "./logger.js";
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

    for (let i = 0; i < source.length; i++) {
      const singleSource = source[i];
      if (!singleSource) continue;

      log.info(`📄 Parsing: ${singleSource}`);
      try {
        const result = await validateSingle(singleSource, options, config);
        results.push(result);
        log.info(
          `✅ Validated: ${singleSource} - ${
            result.valid ? "Valid" : "Invalid"
          }`
        );
      } catch (error) {
        log.error(
          `❌ Failed: ${singleSource} - ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );

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

    const validCount = results.filter((r) => r.valid).length;
    const invalidCount = results.length - validCount;
    log.info(`📊 Summary: ${validCount} valid, ${invalidCount} invalid`);

    return results;
  }

  // Single specification validation
  log.info(`📄 Parsing: ${source}`);
  const result = await validateSingle(source, options, config);
  log.info(`✅ Validated: ${source} - ${result.valid ? "Valid" : "Invalid"}`);

  return result;
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

  const result = validateOpenAPISpec(
    parsed.spec,
    parsed.version,
    validationOptions
  );

  return result;
};

/**
 * Parse an OpenAPI specification without validation
 */
export const parse = async (source: string): Promise<ParsedSpec> => {
  log.startOperation("Parsing OpenAPI specification");
  log.fileOperation("Parsing specification", source);

  const result = await parseOpenAPISpec(source);

  log.endOperation("Parsing OpenAPI specification", true);
  log.validationStep(
    "Parsing completed",
    `Version: ${result.version}, Title: ${
      result.metadata.title
    }, HasPaths: ${!!result.spec.paths}`
  );

  return result;
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
  log.startOperation("Generating validation report");
  log.fileOperation("Generating report", source);

  const result = await validate(source, validationOptions, config);
  // Since source is a string, result will be ValidationResult, not ValidationResult[]
  const validationResult = result as ValidationResult;

  log.validationStep("Generating report", `Format: ${reportOptions.format}`);
  const report = generateReport(validationResult, reportOptions);

  log.endOperation("Generating validation report", true);
  log.validationStep(
    "Report generated",
    `Format: ${reportOptions.format}, Valid: ${validationResult.valid}, Errors: ${validationResult.errors.length}, Warnings: ${validationResult.warnings.length}`
  );

  return report;
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
  log.startOperation("Analyzing document references");
  log.fileOperation("Analyzing references", source);

  const result = await analyzeReferences(source);

  log.endOperation("Analyzing document references", true);
  log.validationStep(
    "Reference analysis completed",
    `Total: ${result.totalReferences}, Circular: ${result.circularReferences.length}`
  );

  return result;
};

/**
 * Generate a comprehensive summary of an OpenAPI specification
 */
export const generateSpecificationSummary = async (
  source: string,
  validationOptions: ValidationOptions = {},
  config: VarsityConfig = defaultConfig
): Promise<{
  summary: any;
  detailedSummary: string;
  jsonSummary: string;
}> => {
  log.startOperation("Generating specification summary");
  log.fileOperation("Generating summary", source);

  // Parse the specification
  const parsed = await parseOpenAPISpec(source);
  log.validationStep(
    "Specification parsed for summary",
    `Version: ${parsed.version}`
  );

  // Validate if requested
  let validationResults;
  if (
    validationOptions.strict ||
    validationOptions.validateExamples ||
    validationOptions.validateReferences
  ) {
    log.validationStep("Running validation for summary");
    const validation = await validate(source, validationOptions, config);
    const result = Array.isArray(validation) ? validation[0] : validation;
    if (result) {
      validationResults = {
        valid: result.valid,
        errors: result.errors.length,
        warnings: result.warnings.length,
        processingTime: 0, // This would be calculated from actual timing
      };
    }
  }

  // Analyze the specification
  log.validationStep("Analyzing specification structure");
  const summary = analyzeSpecification(
    parsed.spec,
    parsed.version,
    validationResults
  );

  // Generate detailed summary
  log.validationStep("Generating detailed summary");
  const detailedSummary = generateDetailedSummary(summary);

  // Generate JSON summary
  log.validationStep("Generating JSON summary");
  const jsonSummary = generateJSONSummary(summary);

  log.endOperation("Generating specification summary", true);
  log.validationStep(
    "Summary generation completed",
    `Version: ${summary.version}, Paths: ${summary.paths}, Endpoints: ${summary.endpoints}, Components: ${summary.components}, Valid: ${summary.validationResults.valid}`
  );

  return {
    summary,
    detailedSummary,
    jsonSummary,
  };
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
export {
  validateRecursively,
  validateMultipleRecursively,
  analyzeReferences,
} from "./recursive-validator.js";
export {
  resolveReference,
  findReferences,
  resolveAllReferences,
} from "./ref-resolver.js";
export { validatePartialDocument } from "./partial-validator.js";
export {
  analyzeSpecification,
  generateDetailedSummary,
  generateJSONSummary,
} from "./summary-analyzer.js";
export { log, Logger } from "./logger.js";

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
} from "./types.js";

// Export types from other modules
export type { ResolvedReference, ReferenceContext } from "./ref-resolver.js";

// Default export - create a default instance
export default createVarsity();

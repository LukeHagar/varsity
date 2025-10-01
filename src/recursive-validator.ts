import { parseOpenAPISpec } from "./parser.js";
import { validateOpenAPISpec } from "./validator.js";
import { validatePartialDocument } from "./partial-validator.js";
import { resolveAllReferences, findReferences } from "./ref-resolver.js";
import type {
  ValidationResult,
  ValidationError,
  ValidationOptions,
  OpenAPIVersion,
  OpenAPISpec,
} from "./types.js";
import { log } from "./logger.js";

export interface RecursiveValidationResult extends ValidationResult {
  partialValidations: Array<{
    path: string;
    result: ValidationResult;
    isCircular: boolean;
  }>;
  circularReferences: string[];
  totalDocuments: number;
  validDocuments: number;
}

/**
 * Recursively validate an OpenAPI specification and all its references
 */
export const validateRecursively = async (
  source: string,
  options: ValidationOptions = {}
): Promise<RecursiveValidationResult> => {
  // Parse the root document
  const rootParsed = await parseOpenAPISpec(source);

  // Validate the root document
  const rootValidation = validateOpenAPISpec(
    rootParsed.spec,
    rootParsed.version,
    options
  );

  // Resolve all references
  const { resolvedRefs, circularRefs } = await resolveAllReferences(
    rootParsed.spec,
    source,
    options.maxRefDepth || 10
  );

  log.info(`🔗 Following ${resolvedRefs.length} references...`);

  // Validate each resolved reference
  const partialValidations: Array<{
    path: string;
    result: ValidationResult;
    isCircular: boolean;
  }> = [];

  let validDocuments = rootValidation.valid ? 1 : 0;

  for (let i = 0; i < resolvedRefs.length; i++) {
    const ref = resolvedRefs[i];
    if (!ref) continue;

    if (ref.isCircular) {
      log.info(`🔄 Circular reference: ${ref.path}`);
      partialValidations.push({
        path: ref.path,
        result: {
          valid: false,
          errors: [
            {
              path: "/",
              message: "Circular reference detected",
            },
          ],
          warnings: [],
          spec: {} as OpenAPISpec,
          version: ref.version || "3.0",
        },
        isCircular: true,
      });
      continue;
    }

    if (ref.content === null) {
      continue;
    }

    // Determine the version for this partial document
    const version = ref.version || rootParsed.version;

    // Validate the partial document
    const partialResult = validatePartialDocument(
      ref.content,
      version,
      ref.path
    );

    partialValidations.push({
      path: ref.path,
      result: partialResult,
      isCircular: false,
    });

    if (partialResult.valid) {
      validDocuments++;
      log.info(`✅ Reference: ${ref.path}`);
    } else {
      log.info(
        `❌ Reference: ${ref.path} (${partialResult.errors.length} errors)`
      );
    }
  }

  // Combine all errors and warnings
  const allErrors: ValidationError[] = [...rootValidation.errors];
  const allWarnings: ValidationError[] = [...rootValidation.warnings];

  for (const partial of partialValidations) {
    allErrors.push(...partial.result.errors);
    allWarnings.push(...partial.result.warnings);
  }

  const result = {
    valid:
      rootValidation.valid && partialValidations.every((p) => p.result.valid),
    errors: allErrors,
    warnings: allWarnings,
    spec: rootParsed.spec,
    version: rootParsed.version,
    partialValidations,
    circularReferences: circularRefs,
    totalDocuments: 1 + partialValidations.length,
    validDocuments,
  };

  return result;
};

/**
 * Validate multiple OpenAPI specifications recursively
 */
export const validateMultipleRecursively = async (
  sources: string[],
  options: ValidationOptions = {}
): Promise<RecursiveValidationResult[]> => {
  log.startOperation("Multiple recursive validation");
  log.validationStep(
    "Starting batch validation",
    `${sources.length} specifications`
  );

  const results: RecursiveValidationResult[] = [];

  log.startProgress(sources.length, "Validating specifications");

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (!source) continue;

    log.updateProgress(i);
    log.fileOperation(
      "Processing specification",
      source,
      `${i + 1}/${sources.length}`
    );

    try {
      const result = await validateRecursively(source, options);
      results.push(result);
      log.validationStep("Specification validated", `Valid: ${result.valid}`);
    } catch (error) {
      log.error("Specification validation failed", {
        source,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Create error result for failed parsing
      const errorResult: RecursiveValidationResult = {
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
        version: "3.0",
        partialValidations: [],
        circularReferences: [],
        totalDocuments: 0,
        validDocuments: 0,
      };
      results.push(errorResult);
    }
  }

  log.endProgress();
  log.endOperation("Multiple recursive validation", true);

  const validCount = results.filter((r) => r.valid).length;
  const invalidCount = results.length - validCount;
  log.validationStep(
    "Batch validation completed",
    `Valid: ${validCount}, Invalid: ${invalidCount}`
  );

  return results;
};

/**
 * Find all references in a document without resolving them
 */
export const analyzeReferences = async (
  source: string
): Promise<{
  references: Array<{ path: string; value: string }>;
  circularReferences: string[];
  totalReferences: number;
}> => {
  log.startOperation("Analyzing references");
  log.fileOperation("Analyzing references", source);

  const parsed = await parseOpenAPISpec(source);
  log.validationStep("Parsing completed for reference analysis");

  const references = findReferences(parsed.spec);
  log.validationStep("References found", `${references.length} total`);

  // Check for circular references by analyzing reference paths
  log.validationStep("Analyzing circular references");
  const circularReferences: string[] = [];
  const referenceMap = new Map<string, string[]>();

  for (const ref of references) {
    const refValue = ref.value;
    if (!referenceMap.has(refValue)) {
      referenceMap.set(refValue, []);
    }
    referenceMap.get(refValue)!.push(ref.path);
  }

  // Simple circular reference detection based on reference patterns
  for (const [refValue, paths] of referenceMap) {
    if (paths.length > 1) {
      // This is a potential circular reference
      log.referenceStep(
        "Circular reference detected",
        refValue,
        `${paths.length} occurrences`
      );
      circularReferences.push(refValue);
    }
  }

  const result = {
    references,
    circularReferences,
    totalReferences: references.length,
  };

  log.endOperation("Analyzing references", true);
  log.validationStep(
    "Reference analysis completed",
    `Total: ${result.totalReferences}, Circular: ${result.circularReferences.length}`
  );

  return result;
};

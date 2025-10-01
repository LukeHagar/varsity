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

  // Validate each resolved reference
  const partialValidations: Array<{
    path: string;
    result: ValidationResult;
    isCircular: boolean;
  }> = [];

  let validDocuments = rootValidation.valid ? 1 : 0;

  for (const ref of resolvedRefs) {
    if (ref.isCircular) {
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
          spec: null,
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
    }
  }

  // Combine all errors and warnings
  const allErrors: ValidationError[] = [...rootValidation.errors];
  const allWarnings: ValidationError[] = [...rootValidation.warnings];

  for (const partial of partialValidations) {
    allErrors.push(...partial.result.errors);
    allWarnings.push(...partial.result.warnings);
  }

  return {
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
};

/**
 * Validate multiple OpenAPI specifications recursively
 */
export const validateMultipleRecursively = async (
  sources: string[],
  options: ValidationOptions = {}
): Promise<RecursiveValidationResult[]> => {
  const results: RecursiveValidationResult[] = [];

  for (const source of sources) {
    try {
      const result = await validateRecursively(source, options);
      results.push(result);
    } catch (error) {
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
        spec: null,
        version: "3.0",
        partialValidations: [],
        circularReferences: [],
        totalDocuments: 0,
        validDocuments: 0,
      };
      results.push(errorResult);
    }
  }

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
  const parsed = await parseOpenAPISpec(source);
  const references = findReferences(parsed.spec);

  // Check for circular references by analyzing reference paths
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
      circularReferences.push(refValue);
    }
  }

  return {
    references,
    circularReferences,
    totalReferences: references.length,
  };
};

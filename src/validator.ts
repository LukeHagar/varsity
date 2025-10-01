import Ajv from "ajv";
import type { JSONSchemaType } from "ajv";
import addFormats from "ajv-formats";
import type {
  ValidationResult,
  ValidationError,
  ValidationOptions,
  OpenAPIVersion,
  OpenAPISpec,
} from "./types.js";

import { allSchemas } from "oas-types/schemas";
import type { OpenAPI3_1, OpenAPI3_2, OpenAPI3, OpenAPI2 } from "oas-types";

// Initialize AJV instance
const createAjvInstance = (): Ajv => {
  const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    strict: false,
    validateFormats: true,
  });
  addFormats(ajv);
  return ajv;
};

// Global instances
const ajv = createAjvInstance();

// Create schemas map from oas-types
const schemas = new Map<OpenAPIVersion, any>();
schemas.set("2.0", allSchemas["2.0"].specification);
schemas.set("3.0", allSchemas["3.0"].specification);
schemas.set("3.1", allSchemas["3.1"].specification);
schemas.set("3.2", allSchemas["3.2"].specification);

/**
 * Normalize OpenAPI version to the base version for schema lookup
 */
const normalizeVersion = (version: OpenAPIVersion): OpenAPIVersion => {
  if (version.startsWith("3.0")) {
    return "3.0";
  } else if (version.startsWith("3.1")) {
    return "3.1";
  } else if (version.startsWith("3.2")) {
    return "3.2";
  }
  return version;
};

/**
 * Find all $ref references in the specification
 */
const findReferences = (
  obj: OpenAPISpec,
  path = ""
): Array<{ path: string; value: string }> => {
  const refs: Array<{ path: string; value: string }> = [];

  if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (key === "$ref" && typeof value === "string") {
        refs.push({ path: currentPath, value });
      } else if (typeof value === "object") {
        refs.push(...findReferences(value, currentPath));
      }
    }
  }

  return refs;
};

/**
 * Resolve a reference to check if it's valid
 */
const resolveReference = (
  spec: OpenAPISpec,
  ref: { path: string; value: string }
): boolean => {
  // Simple reference resolution - in a real implementation, this would be more comprehensive
  if (ref.value.startsWith("#/")) {
    const path = ref.value.substring(2).split("/");
    let current = spec;

    for (const segment of path) {
      if (current && typeof current === "object" && segment in current) {
        current = (current as any)[segment];
      } else {
        return false;
      }
    }

    return current !== undefined;
  }

  return false; // External references not supported in this simple implementation
};

/**
 * Perform strict validation checks
 */
const performStrictValidation = (
  spec: OpenAPISpec,
  version: OpenAPIVersion,
  errors: ValidationError[],
  warnings: ValidationError[]
): void => {
  // Check for required fields based on version
  if (version === "2.0") {
    const swaggerSpec = spec as OpenAPI2.Specification;
    if (!swaggerSpec.host) {
      errors.push({
        path: "/",
        message: 'Either "host" or "servers" must be specified in Swagger 2.0',
      });
    }
  } else {
    const openapiSpec = spec as
      | OpenAPI3.Specification
      | OpenAPI3_1.Specification
      | OpenAPI3_2.Specification;
    if (!openapiSpec.servers || openapiSpec.servers.length === 0) {
      warnings.push({
        path: "/",
        message: "No servers specified. Consider adding at least one server.",
      });
    }
  }

  // Check for security definitions
  if (version === "2.0") {
    const swaggerSpec = spec as OpenAPI2.Specification;
    if (
      swaggerSpec.security &&
      swaggerSpec.security.length > 0 &&
      !swaggerSpec.securityDefinitions
    ) {
      errors.push({
        path: "/",
        message: "Security schemes must be defined when using security",
      });
    }
  } else {
    const openapiSpec = spec as
      | OpenAPI3.Specification
      | OpenAPI3_1.Specification
      | OpenAPI3_2.Specification;
    if (
      openapiSpec.security &&
      openapiSpec.security.length > 0 &&
      !openapiSpec.components?.securitySchemes
    ) {
      errors.push({
        path: "/",
        message: "Security schemes must be defined when using security",
      });
    }
  }
};

/**
 * Validate examples in the specification
 */
const validateExamples = (
  spec: OpenAPISpec,
  version: OpenAPIVersion,
  errors: ValidationError[],
  warnings: ValidationError[]
): void => {
  // This would implement example validation logic
  // For now, just a placeholder
  if (spec.paths) {
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (typeof pathItem === "object" && pathItem !== null) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (
            typeof operation === "object" &&
            operation !== null &&
            "responses" in operation
          ) {
            // Check response examples
            for (const [statusCode, response] of Object.entries(
              operation.responses
            )) {
              if (
                typeof response === "object" &&
                response !== null &&
                "examples" in response
              ) {
                // Validate examples here
              }
            }
          }
        }
      }
    }
  }
};

/**
 * Validate references in the specification
 */
const validateReferences = (
  spec: OpenAPISpec,
  version: OpenAPIVersion,
  errors: ValidationError[],
  warnings: ValidationError[]
): void => {
  // This would implement reference validation logic
  // Check for broken $ref references
  const refs = findReferences(spec);
  for (const ref of refs) {
    if (!resolveReference(spec, ref)) {
      errors.push({
        path: ref.path,
        message: `Broken reference: ${ref.value}`,
      });
    }
  }
};

/**
 * Validate an OpenAPI specification
 */
export const validateOpenAPISpec = (
  spec: OpenAPISpec,
  version: OpenAPIVersion,
  options: ValidationOptions = {}
): ValidationResult => {
  const normalizedVersion = normalizeVersion(version);
  const schema = schemas.get(normalizedVersion);
  if (!schema) {
    throw new Error(
      `No schema available for OpenAPI version: ${version} (normalized to ${normalizedVersion})`
    );
  }

  const validate = ajv.compile(schema);
  const valid = validate(spec);

  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!valid && validate.errors) {
    for (const error of validate.errors) {
      const validationError: ValidationError = {
        path: error.instancePath || error.schemaPath || "/",
        message: error.message || "Validation error",
        data: error.data,
        schemaPath: error.schemaPath,
      };

      if (error.keyword === "required" || error.keyword === "type") {
        errors.push(validationError);
      } else {
        warnings.push(validationError);
      }
    }
  }

  // Additional custom validations
  if (options.strict) {
    performStrictValidation(spec, version, errors, warnings);
  }

  if (options.validateExamples) {
    validateExamples(spec, version, errors, warnings);
  }

  if (options.validateReferences) {
    validateReferences(spec, version, errors, warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    spec,
    version,
  };
};

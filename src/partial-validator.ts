import Ajv from "ajv";
import addFormats from "ajv-formats";
import { allSchemas } from "oas-types/schemas";
import type {
  FragmentKind,
  OpenAPIVersion,
  ValidationError,
  ValidationResult,
} from "./types.js";

// Initialize AJV instance for partial validation
const createPartialAjvInstance = (): Ajv => {
  const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    strict: false,
    validateFormats: true,
  });
  addFormats(ajv);
  return ajv;
};

const partialAjv = createPartialAjvInstance();

// Schema map for partial documents
const partialSchemas = new Map<string, any>();

// Initialize partial schemas
partialSchemas.set("2.0.schema", allSchemas["2.0"].schema);
partialSchemas.set("2.0.parameter", allSchemas["2.0"].parameter);
partialSchemas.set("2.0.response", allSchemas["2.0"].response);
partialSchemas.set("2.0.pathitem", allSchemas["2.0"].pathitem);

partialSchemas.set("3.0.schema", allSchemas["3.0"].schema);
partialSchemas.set("3.0.parameter", allSchemas["3.0"].parameter);
partialSchemas.set("3.0.response", allSchemas["3.0"].response);
partialSchemas.set("3.0.pathitem", allSchemas["3.0"].pathitem);
partialSchemas.set("3.0.requestbody", allSchemas["3.0"].requestbody);
partialSchemas.set("3.0.header", allSchemas["3.0"].header);
partialSchemas.set("3.0.example", allSchemas["3.0"].example);
partialSchemas.set("3.0.link", allSchemas["3.0"].link);
partialSchemas.set("3.0.callback", allSchemas["3.0"].callback);
partialSchemas.set("3.0.securityscheme", allSchemas["3.0"].securityscheme);

partialSchemas.set("3.1.schema", allSchemas["3.1"].schema);
partialSchemas.set("3.1.parameter", allSchemas["3.1"].parameter);
partialSchemas.set("3.1.response", allSchemas["3.1"].response);
partialSchemas.set("3.1.pathitem", allSchemas["3.1"].pathitem);
partialSchemas.set("3.1.requestbody", allSchemas["3.1"].requestbody);
partialSchemas.set("3.1.header", allSchemas["3.1"].header);
partialSchemas.set("3.1.example", allSchemas["3.1"].example);
partialSchemas.set("3.1.link", allSchemas["3.1"].link);
partialSchemas.set("3.1.callback", allSchemas["3.1"].callback);
partialSchemas.set("3.1.securityscheme", allSchemas["3.1"].securityscheme);

partialSchemas.set("3.2.schema", allSchemas["3.2"].schema);
partialSchemas.set("3.2.parameter", allSchemas["3.2"].parameter);
partialSchemas.set("3.2.response", allSchemas["3.2"].response);
partialSchemas.set("3.2.pathitem", allSchemas["3.2"].pathitem);
partialSchemas.set("3.2.requestbody", allSchemas["3.2"].requestbody);
partialSchemas.set("3.2.header", allSchemas["3.2"].header);
partialSchemas.set("3.2.example", allSchemas["3.2"].example);
partialSchemas.set("3.2.link", allSchemas["3.2"].link);
partialSchemas.set("3.2.callback", allSchemas["3.2"].callback);
partialSchemas.set("3.2.securityscheme", allSchemas["3.2"].securityscheme);

/**
 * Normalize a patch-versioned OpenAPI version (e.g. `3.0.3`) into the base
 * version used to key partial schemas (`3.0`, `3.1`, `3.2`).
 */
const normalizePartialVersion = (version: OpenAPIVersion): string => {
  if (version.startsWith("3.0")) return "3.0";
  if (version.startsWith("3.1")) return "3.1";
  if (version.startsWith("3.2")) return "3.2";
  return version;
};

/**
 * Validate a partial OpenAPI document (a `$ref` target fragment).
 *
 * The expected fragment kind comes from the reference site (where the
 * `$ref` appears), never from the fragment's shape: shape-guessing
 * misclassifies legal fragments such as the empty OpenAPI 3.1 schema `{}`.
 * When the reference site does not determine a kind, the fragment is
 * skipped with a warning instead of being guessed.
 */
export const validatePartialDocument = (
  document: any,
  version: OpenAPIVersion,
  documentPath?: string,
  expectedKind?: FragmentKind | null
): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const family = normalizePartialVersion(version);

  const finish = (valid: boolean): ValidationResult => {
    if (documentPath) {
      for (const error of errors) error.path = `${documentPath}${error.path}`;
      for (const warning of warnings)
        warning.path = `${documentPath}${warning.path}`;
    }
    return { valid, errors, warnings, spec: document, version };
  };

  // A bare `{ "$ref": ... }` wrapper is valid; its target is validated
  // separately by the recursive walk.
  if (
    document &&
    typeof document === "object" &&
    typeof document.$ref === "string" &&
    Object.keys(document).length === 1
  ) {
    return finish(true);
  }

  // Boolean JSON Schemas (`true` / `false`) are legal schema fragments in
  // OpenAPI 3.1+ (JSON Schema 2020-12).
  if (typeof document === "boolean") {
    if (
      (expectedKind === "schema" || expectedKind == null) &&
      (family === "3.1" || family === "3.2")
    ) {
      return finish(true);
    }
    errors.push({
      path: "/",
      message: `Boolean fragment is not a valid ${
        expectedKind ?? "fragment"
      } in OpenAPI ${version}`,
    });
    return finish(false);
  }

  if (expectedKind === undefined || expectedKind === null) {
    warnings.push({
      path: "/",
      message:
        "Could not determine the expected fragment type from the reference site; fragment was not validated",
    });
    return finish(true);
  }

  // Partial schemas are keyed by the base version (2.0/3.0/3.1/3.2).
  const schemaKey = `${family}.${expectedKind}`;
  const schema = partialSchemas.get(schemaKey);

  if (!schema) {
    warnings.push({
      path: "/",
      message: `No validation schema available for ${expectedKind} fragments in OpenAPI ${version}; fragment was not validated`,
    });
    return finish(true);
  }

  const validate = partialAjv.compile(schema);
  const valid = validate(document);

  if (!valid && validate.errors) {
    for (const error of filterReferenceNoise(validate.errors)) {
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

  return finish(errors.length === 0);
};

/** True for a bare Reference Object wrapper: `{ "$ref": "..." }`. */
const isRefOnlyObject = (value: unknown): boolean =>
  !!value &&
  typeof value === "object" &&
  typeof (value as { $ref?: unknown }).$ref === "string" &&
  Object.keys(value as object).length === 1;

interface AjvErrorLike {
  keyword: string;
  instancePath: string;
  schemaPath: string;
  message?: string;
  data?: unknown;
  params?: Record<string, unknown>;
}

/**
 * Drop AJV errors that are artifacts of *unresolved* nested Reference
 * Objects rather than genuine shape problems.
 *
 * OpenAPI allows `{ "$ref": ... }` in most object positions (responses,
 * parameters, headers, ...), but the partial schemas from `oas-types`
 * describe the resolved form and reject bare reference wrappers. Every
 * nested reference target is resolved and validated separately by the
 * recursive walk, so errors *about the wrapper itself* are noise:
 *
 *  1. errors whose offending data is exactly `{ "$ref": ... }`;
 *  2. `required: $ref` errors from the failed Reference branch of an
 *     anyOf/oneOf when the data is a genuine inline object;
 *  3. anyOf/oneOf aggregate errors left with no supporting error beneath
 *     them once 1–2 are removed.
 */
const filterReferenceNoise = (rawErrors: AjvErrorLike[]): AjvErrorLike[] => {
  const substantive = rawErrors.filter(
    (error) =>
      !isRefOnlyObject(error.data) &&
      !(
        error.keyword === "required" &&
        error.params?.missingProperty === "$ref"
      ),
  );

  const isAggregate = (error: AjvErrorLike): boolean =>
    error.keyword === "anyOf" || error.keyword === "oneOf";

  return substantive.filter(
    (error) =>
      !isAggregate(error) ||
      substantive.some(
        (other) =>
          other !== error &&
          !isAggregate(other) &&
          other.instancePath.startsWith(error.instancePath),
      ),
  );
};

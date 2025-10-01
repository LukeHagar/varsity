import { readFileSync } from "fs";
import { resolve } from "path";
import type { ParsedSpec, OpenAPIVersion, OpenAPISpec } from "./types.js";
import type { OpenAPI2, OpenAPI3, OpenAPI3_1 } from "oas-types";

/**
 * Detect OpenAPI version from specification
 */
const detectVersion = (spec: any): OpenAPIVersion => {
  // Check for OpenAPI 3.x
  if (spec.openapi) {
    const version = spec.openapi;
    if (version.startsWith("3.0")) {
      return version as OpenAPIVersion;
    } else if (version.startsWith("3.1")) {
      return version as OpenAPIVersion;
    } else if (version.startsWith("3.2")) {
      return version as OpenAPIVersion;
    }
    throw new Error(`Unsupported OpenAPI version: ${version}`);
  }

  // Check for Swagger 2.0
  if (spec.swagger === "2.0") {
    return "2.0";
  }

  throw new Error(
    'Unable to detect OpenAPI version. Specification must have "openapi" or "swagger" field.'
  );
};

/**
 * Extract metadata from specification
 */
const extractMetadata = (
  spec: OpenAPISpec,
  version: OpenAPIVersion
): ParsedSpec["metadata"] => {
  // All OpenAPI versions have the same info structure
  const info = spec.info;
  return {
    title: info?.title,
    version: info?.version,
    description: info?.description,
    contact: info?.contact,
    license: info?.license,
  };
};

/**
 * Parse an OpenAPI specification from a file path or URL
 */
export const parseOpenAPISpec = async (source: string): Promise<ParsedSpec> => {
  let content: string;
  let spec: any;

  try {
    // Handle file paths
    if (source.startsWith("http://") || source.startsWith("https://")) {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch specification: ${response.statusText}`
        );
      }
      content = await response.text();
    } else {
      // Local file
      const filePath = resolve(source);
      content = readFileSync(filePath, "utf-8");
    }

    // Parse JSON or YAML
    if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
      spec = JSON.parse(content);
    } else {
      // For YAML parsing, we'll use a simple approach or add yaml dependency later
      throw new Error(
        "YAML parsing not yet implemented. Please use JSON format."
      );
    }

    const version = detectVersion(spec);

    // Type the spec based on the detected version
    const typedSpec = spec as OpenAPISpec;

    return {
      spec: typedSpec,
      version,
      source,
      metadata: extractMetadata(typedSpec, version),
    };
  } catch (error) {
    throw new Error(
      `Failed to parse OpenAPI specification: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

/**
 * Validate that the parsed spec has required fields
 */
export const validateBasicStructure = (
  spec: OpenAPISpec,
  version: OpenAPIVersion
): boolean => {
  if (version === "2.0") {
    const swaggerSpec = spec as OpenAPI2.Specification;
    return !!(swaggerSpec.swagger && swaggerSpec.info && swaggerSpec.paths);
  } else {
    const openapiSpec = spec as
      | OpenAPI3.Specification
      | OpenAPI3_1.Specification;
    return !!(openapiSpec.openapi && openapiSpec.info && openapiSpec.paths);
  }
};

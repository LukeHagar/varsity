import { readFileSync } from "fs";
import { resolve } from "path";
import * as yaml from "js-yaml";
import type { ParsedSpec, OpenAPIVersion, OpenAPISpec } from "./types.js";
import type { OpenAPI2, OpenAPI3, OpenAPI3_1 } from "oas-types";
import { log } from "./logger.js";

/**
 * Detect OpenAPI version from specification
 */
const detectVersion = (spec: any): OpenAPIVersion => {
  log.parsingStep("Detecting OpenAPI version");

  // Check for OpenAPI 3.x
  if (spec.openapi) {
    const version = spec.openapi;
    log.parsingStep("Found OpenAPI 3.x specification", `Version: ${version}`);

    if (version.startsWith("3.0")) {
      log.parsingStep("Detected OpenAPI 3.0.x", version);
      return version as OpenAPIVersion;
    } else if (version.startsWith("3.1")) {
      log.parsingStep("Detected OpenAPI 3.1.x", version);
      return version as OpenAPIVersion;
    } else if (version.startsWith("3.2")) {
      log.parsingStep("Detected OpenAPI 3.2.x", version);
      return version as OpenAPIVersion;
    }
    log.error("Unsupported OpenAPI version", { version });
    throw new Error(`Unsupported OpenAPI version: ${version}`);
  }

  // Check for Swagger 2.0
  if (spec.swagger === "2.0") {
    log.parsingStep("Detected Swagger 2.0 specification");
    return "2.0";
  }

  log.error("Unable to detect OpenAPI version", {
    hasOpenapi: !!spec.openapi,
    hasSwagger: !!spec.swagger,
    openapiValue: spec.openapi,
    swaggerValue: spec.swagger,
  });
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
  log.parsingStep("Extracting metadata from specification");

  // All OpenAPI versions have the same info structure
  const info = spec.info;

  const metadata = {
    title: info?.title,
    version: info?.version,
    description: info?.description,
    contact: info?.contact,
    license: info?.license,
  };

  log.parsingStep(
    "Metadata extracted",
    `Title: ${metadata.title}, Version: ${
      metadata.version
    }, HasDescription: ${!!metadata.description}, HasContact: ${!!metadata.contact}, HasLicense: ${!!metadata.license}`
  );

  return metadata;
};

/**
 * Parse an OpenAPI specification from a file path or URL
 */
export const parseOpenAPISpec = async (source: string): Promise<ParsedSpec> => {
  log.startOperation("Parsing OpenAPI specification");
  log.fileOperation("Reading specification", source);

  let content: string;
  let spec: any;

  try {
    // Handle file paths
    if (source.startsWith("http://") || source.startsWith("https://")) {
      log.parsingStep("Fetching remote specification", source);
      const response = await fetch(source);
      if (!response.ok) {
        log.error("Failed to fetch remote specification", {
          url: source,
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(
          `Failed to fetch specification: ${response.statusText}`
        );
      }
      content = await response.text();
      log.parsingStep(
        "Remote specification fetched",
        `Size: ${content.length} characters`
      );
    } else {
      // Local file
      log.parsingStep("Reading local file", source);
      const filePath = resolve(source);
      log.fileOperation("Reading file", filePath);
      content = readFileSync(filePath, "utf-8");
      log.parsingStep("Local file read", `Size: ${content.length} characters`);
    }

    // Parse JSON or YAML
    log.parsingStep("Determining content format");
    if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
      log.parsingStep("Detected JSON format");
      log.parsingStep("Parsing JSON content");
      spec = JSON.parse(content);
      log.parsingStep("JSON parsing completed");
    } else {
      // Parse YAML
      log.parsingStep("Detected YAML format");
      log.parsingStep("Parsing YAML content");
      try {
        spec = yaml.load(content);
        log.parsingStep("YAML parsing completed");
      } catch (yamlError) {
        log.error("YAML parsing failed", {
          error:
            yamlError instanceof Error
              ? yamlError.message
              : "Unknown YAML error",
        });
        throw new Error(
          `Failed to parse YAML: ${
            yamlError instanceof Error
              ? yamlError.message
              : "Unknown YAML error"
          }`
        );
      }
    }

    const version = detectVersion(spec);
    log.parsingStep("Version detection completed", `Detected: ${version}`);

    // Type the spec based on the detected version
    const typedSpec = spec as OpenAPISpec;
    log.parsingStep("Specification typed", `Type: OpenAPISpec`);

    const metadata = extractMetadata(typedSpec, version);

    const result = {
      spec: typedSpec,
      version,
      source,
      metadata,
    };

    log.endOperation("Parsing OpenAPI specification", true);
    log.parsingStep(
      "Parsing completed successfully",
      `Version: ${version}, Source: ${source}, Title: ${
        metadata.title
      }, HasPaths: ${!!typedSpec.paths}, PathCount: ${
        typedSpec.paths ? Object.keys(typedSpec.paths).length : 0
      }`
    );

    return result;
  } catch (error) {
    log.error("Parsing failed", {
      source,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    log.endOperation("Parsing OpenAPI specification", false);
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
  log.parsingStep("Validating basic structure");

  let isValid: boolean;

  if (version === "2.0") {
    log.parsingStep("Validating Swagger 2.0 structure");
    const swaggerSpec = spec as OpenAPI2.Specification;
    isValid = !!(swaggerSpec.swagger && swaggerSpec.info && swaggerSpec.paths);

    log.parsingStep(
      "Swagger 2.0 structure validation",
      `HasSwagger: ${!!swaggerSpec.swagger}, HasInfo: ${!!swaggerSpec.info}, HasPaths: ${!!swaggerSpec.paths}, IsValid: ${isValid}`
    );
  } else {
    log.parsingStep("Validating OpenAPI 3.x structure");
    const openapiSpec = spec as
      | OpenAPI3.Specification
      | OpenAPI3_1.Specification;
    isValid = !!(openapiSpec.openapi && openapiSpec.info && openapiSpec.paths);

    log.parsingStep(
      "OpenAPI 3.x structure validation",
      `HasOpenapi: ${!!openapiSpec.openapi}, HasInfo: ${!!openapiSpec.info}, HasPaths: ${!!openapiSpec.paths}, IsValid: ${isValid}`
    );
  }

  log.parsingStep("Basic structure validation completed", `Valid: ${isValid}`);
  return isValid;
};

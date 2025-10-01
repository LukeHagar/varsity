import type { JSONSchemaType } from "ajv";
import type { OpenAPI2, OpenAPI3, OpenAPI3_1, OpenAPI3_2 } from "oas-types";

export interface ValidationError {
  path: string;
  message: string;
  data?: any;
  schemaPath?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  spec: OpenAPISpec;
  version: OpenAPIVersion;
}

export interface ValidationOptions {
  strict?: boolean;
  validateExamples?: boolean;
  validateReferences?: boolean;
  customRules?: Record<string, any>;
  maxRefDepth?: number;
  recursive?: boolean;
}

export interface ReportOptions {
  format: "json" | "yaml" | "html" | "markdown";
  output?: string;
  includeWarnings?: boolean;
  includeMetadata?: boolean;
}

export interface ParsedSpec {
  spec: OpenAPISpec;
  version: OpenAPIVersion;
  source: string;
  metadata: {
    title?: string;
    version?: string;
    description?: string;
    contact?: any;
    license?: any;
  };
}

export type OpenAPIVersion =
  | "2.0"
  | "3.0"
  | "3.0.0"
  | "3.0.1"
  | "3.0.2"
  | "3.0.3"
  | "3.0.4"
  | "3.1"
  | "3.1.0"
  | "3.1.1"
  | "3.2"
  | "3.2.0";

// Union type for all OpenAPI specifications
export type OpenAPISpec =
  | OpenAPI2.Specification
  | OpenAPI3.Specification
  | OpenAPI3_1.Specification
  | OpenAPI3_2.Specification;

export interface VarsityConfig {
  defaultVersion?: OpenAPIVersion;
  strictMode?: boolean;
  customSchemas?: Record<string, JSONSchemaType<any>>;
  reportFormats?: ReportOptions["format"][];
}

export interface CLIResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: ValidationError[];
}

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

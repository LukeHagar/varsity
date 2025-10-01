import type { OpenAPISpec, OpenAPIVersion } from "./types.js";
import type { OpenAPI2, OpenAPI3, OpenAPI3_1, OpenAPI3_2 } from "oas-types";
import { log } from "./logger.js";

export interface SpecificationSummary {
  // Basic info
  version: string;
  title?: string;
  description?: string;

  // Counts
  paths: number;
  endpoints: number;
  schemas: number;
  components: number;
  callbacks: number;
  webhooks: number;
  securitySchemes: number;
  servers: number;
  tags: number;
  operations: number;

  // HTTP methods used
  httpMethods: string[];

  // Component breakdown
  componentBreakdown: {
    schemas: number;
    responses: number;
    parameters: number;
    examples: number;
    requestBodies: number;
    headers: number;
    securitySchemes: number;
    links: number;
    callbacks: number;
    pathItems: number;
  };

  // Security analysis
  securityAnalysis: {
    hasSecurity: boolean;
    securitySchemes: number;
    securityRequirements: number;
    oauthFlows: number;
    apiKeys: number;
    httpAuth: number;
  };

  // Reference analysis
  referenceAnalysis: {
    totalReferences: number;
    internalReferences: number;
    externalReferences: number;
    circularReferences: number;
  };

  // Validation results
  validationResults: {
    valid: boolean;
    errors: number;
    warnings: number;
    processingTime: number;
  };
}

/**
 * Analyze an OpenAPI specification and generate a comprehensive summary
 */
export const analyzeSpecification = (
  spec: OpenAPISpec,
  version: OpenAPIVersion,
  validationResults?: {
    valid: boolean;
    errors: number;
    warnings: number;
    processingTime: number;
  }
): SpecificationSummary => {
  log.validationStep("Analyzing specification for summary");

  const summary: SpecificationSummary = {
    version,
    title: spec.info?.title,
    description: spec.info?.description,
    paths: 0,
    endpoints: 0,
    schemas: 0,
    components: 0,
    callbacks: 0,
    webhooks: 0,
    securitySchemes: 0,
    servers: 0,
    tags: 0,
    operations: 0,
    httpMethods: [],
    componentBreakdown: {
      schemas: 0,
      responses: 0,
      parameters: 0,
      examples: 0,
      requestBodies: 0,
      headers: 0,
      securitySchemes: 0,
      links: 0,
      callbacks: 0,
      pathItems: 0,
    },
    securityAnalysis: {
      hasSecurity: false,
      securitySchemes: 0,
      securityRequirements: 0,
      oauthFlows: 0,
      apiKeys: 0,
      httpAuth: 0,
    },
    referenceAnalysis: {
      totalReferences: 0,
      internalReferences: 0,
      externalReferences: 0,
      circularReferences: 0,
    },
    validationResults: validationResults || {
      valid: false,
      errors: 0,
      warnings: 0,
      processingTime: 0,
    },
  };

  // Analyze paths and endpoints
  if (spec.paths) {
    log.validationStep("Analyzing paths and endpoints");
    summary.paths = Object.keys(spec.paths).length;

    const methods = new Set<string>();
    let endpointCount = 0;

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (typeof pathItem === "object" && pathItem !== null) {
        for (const [method, operation] of Object.entries(pathItem)) {
          // Check if this is a valid HTTP method and has operation properties
          if (
            typeof operation === "object" &&
            operation !== null &&
            [
              "get",
              "post",
              "put",
              "delete",
              "patch",
              "head",
              "options",
              "trace",
            ].includes(method.toLowerCase()) &&
            ("responses" in operation ||
              "operationId" in operation ||
              "summary" in operation ||
              "description" in operation)
          ) {
            endpointCount++;
            methods.add(method.toUpperCase());
            log.endpointStep("Found endpoint", method, path);
          }
        }
      }
    }

    summary.endpoints = endpointCount;
    summary.httpMethods = Array.from(methods);
    summary.operations = endpointCount;

    log.validationStep(
      "Path analysis completed",
      `Paths: ${summary.paths}, Endpoints: ${summary.endpoints}`
    );
  }

  // Analyze components (OpenAPI 3.x)
  if (version.startsWith("3.") && (spec as any).components) {
    log.validationStep("Analyzing components");
    const components = (spec as any).components;

    if (components.schemas) {
      summary.componentBreakdown.schemas = Object.keys(
        components.schemas
      ).length;
      summary.schemas = summary.componentBreakdown.schemas;
    }

    if (components.responses) {
      summary.componentBreakdown.responses = Object.keys(
        components.responses
      ).length;
    }

    if (components.parameters) {
      summary.componentBreakdown.parameters = Object.keys(
        components.parameters
      ).length;
    }

    if (components.examples) {
      summary.componentBreakdown.examples = Object.keys(
        components.examples
      ).length;
    }

    if (components.requestBodies) {
      summary.componentBreakdown.requestBodies = Object.keys(
        components.requestBodies
      ).length;
    }

    if (components.headers) {
      summary.componentBreakdown.headers = Object.keys(
        components.headers
      ).length;
    }

    if (components.securitySchemes) {
      summary.componentBreakdown.securitySchemes = Object.keys(
        components.securitySchemes
      ).length;
      summary.securitySchemes = summary.componentBreakdown.securitySchemes;
    }

    if (components.links) {
      summary.componentBreakdown.links = Object.keys(components.links).length;
    }

    if (components.callbacks) {
      summary.componentBreakdown.callbacks = Object.keys(
        components.callbacks
      ).length;
      summary.callbacks = summary.componentBreakdown.callbacks;
    }

    if (components.pathItems) {
      summary.componentBreakdown.pathItems = Object.keys(
        components.pathItems
      ).length;
    }

    // Calculate total components
    summary.components = Object.values(summary.componentBreakdown).reduce(
      (sum, count) => sum + count,
      0
    );

    log.validationStep(
      "Component analysis completed",
      `Total components: ${summary.components}`
    );
  }

  // Analyze webhooks (OpenAPI 3.1+)
  if (version.startsWith("3.1") && (spec as any).webhooks) {
    log.validationStep("Analyzing webhooks");
    const webhooks = (spec as any).webhooks;
    summary.webhooks = Object.keys(webhooks).length;
    log.validationStep(
      "Webhook analysis completed",
      `Webhooks: ${summary.webhooks}`
    );
  }

  // Analyze servers
  if ((spec as any).servers) {
    log.validationStep("Analyzing servers");
    summary.servers = (spec as any).servers.length;
    log.validationStep(
      "Server analysis completed",
      `Servers: ${summary.servers}`
    );
  }

  // Analyze tags
  if (spec.tags) {
    log.validationStep("Analyzing tags");
    summary.tags = spec.tags.length;
    log.validationStep("Tag analysis completed", `Tags: ${summary.tags}`);
  }

  // Analyze security
  log.validationStep("Analyzing security");
  if (spec.security && spec.security.length > 0) {
    summary.securityAnalysis.hasSecurity = true;
    summary.securityAnalysis.securityRequirements = spec.security.length;
  }

  if (version.startsWith("3.") && (spec as any).components?.securitySchemes) {
    const securitySchemes = (spec as any).components.securitySchemes;
    summary.securityAnalysis.securitySchemes =
      Object.keys(securitySchemes).length;

    // Analyze security scheme types
    for (const [name, scheme] of Object.entries(securitySchemes)) {
      if (typeof scheme === "object" && scheme !== null) {
        const schemeObj = scheme as any;
        if (schemeObj.type === "oauth2") {
          summary.securityAnalysis.oauthFlows++;
        } else if (schemeObj.type === "apiKey") {
          summary.securityAnalysis.apiKeys++;
        } else if (schemeObj.type === "http") {
          summary.securityAnalysis.httpAuth++;
        }
      }
    }
  } else if (version === "2.0" && (spec as any).securityDefinitions) {
    const securityDefinitions = (spec as any).securityDefinitions;
    summary.securityAnalysis.securitySchemes =
      Object.keys(securityDefinitions).length;
  }

  log.validationStep(
    "Security analysis completed",
    JSON.stringify({
      hasSecurity: summary.securityAnalysis.hasSecurity ? "Yes" : "No",
      schemes: summary.securityAnalysis.securitySchemes,
      requirements: summary.securityAnalysis.securityRequirements,
    })
  );

  // Analyze references (basic count)
  log.validationStep("Analyzing references");
  const references = findReferencesInSpec(spec);
  summary.referenceAnalysis.totalReferences = references.length;
  summary.referenceAnalysis.internalReferences = references.filter((ref) =>
    ref.startsWith("#/")
  ).length;
  summary.referenceAnalysis.externalReferences = references.filter(
    (ref) => !ref.startsWith("#/")
  ).length;

  log.validationStep(
    "Reference analysis completed",
    JSON.stringify({
      total: summary.referenceAnalysis.totalReferences,
      internal: summary.referenceAnalysis.internalReferences,
      external: summary.referenceAnalysis.externalReferences,
    })
  );

  log.validationStep(
    "Specification analysis completed",
    JSON.stringify({
      version: summary.version,
      paths: summary.paths,
      endpoints: summary.endpoints,
      components: summary.components,
      schemas: summary.schemas,
    })
  );

  return summary;
};

/**
 * Find all references in a specification
 */
const findReferencesInSpec = (obj: any, path = ""): string[] => {
  const refs: string[] = [];

  if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (key === "$ref" && typeof value === "string") {
        refs.push(value);
      } else if (typeof value === "object") {
        refs.push(...findReferencesInSpec(value, path));
      }
    }
  }

  return refs;
};

/**
 * Generate a detailed summary report
 */
export const generateDetailedSummary = (
  summary: SpecificationSummary
): string => {
  const lines: string[] = [];

  lines.push("📊 OpenAPI Specification Summary");
  lines.push("=".repeat(50));

  // Basic information
  lines.push(`📋 Basic Information`);
  lines.push(`  Version: ${summary.version}`);
  lines.push(`  Title: ${summary.title || "N/A"}`);
  lines.push(`  Description: ${summary.description ? "Yes" : "No"}`);
  lines.push("");

  // Paths and endpoints
  lines.push(`🛣️  Paths & Endpoints`);
  lines.push(`  Total Paths: ${summary.paths}`);
  lines.push(`  Total Endpoints: ${summary.endpoints}`);
  lines.push(`  HTTP Methods: ${summary.httpMethods.join(", ")}`);
  lines.push("");

  // Components
  lines.push(`🧩 Components`);
  lines.push(`  Total Components: ${summary.components}`);
  lines.push(`  Schemas: ${summary.componentBreakdown.schemas}`);
  lines.push(`  Responses: ${summary.componentBreakdown.responses}`);
  lines.push(`  Parameters: ${summary.componentBreakdown.parameters}`);
  lines.push(`  Examples: ${summary.componentBreakdown.examples}`);
  lines.push(`  Request Bodies: ${summary.componentBreakdown.requestBodies}`);
  lines.push(`  Headers: ${summary.componentBreakdown.headers}`);
  lines.push(
    `  Security Schemes: ${summary.componentBreakdown.securitySchemes}`
  );
  lines.push(`  Links: ${summary.componentBreakdown.links}`);
  lines.push(`  Callbacks: ${summary.componentBreakdown.callbacks}`);
  lines.push(`  Path Items: ${summary.componentBreakdown.pathItems}`);
  lines.push("");

  // Security
  lines.push(`🔒 Security`);
  lines.push(
    `  Has Security: ${summary.securityAnalysis.hasSecurity ? "Yes" : "No"}`
  );
  lines.push(`  Security Schemes: ${summary.securityAnalysis.securitySchemes}`);
  lines.push(
    `  Security Requirements: ${summary.securityAnalysis.securityRequirements}`
  );
  lines.push(`  OAuth Flows: ${summary.securityAnalysis.oauthFlows}`);
  lines.push(`  API Keys: ${summary.securityAnalysis.apiKeys}`);
  lines.push(`  HTTP Auth: ${summary.securityAnalysis.httpAuth}`);
  lines.push("");

  // References
  lines.push(`🔗 References`);
  lines.push(
    `  Total References: ${summary.referenceAnalysis.totalReferences}`
  );
  lines.push(
    `  Internal References: ${summary.referenceAnalysis.internalReferences}`
  );
  lines.push(
    `  External References: ${summary.referenceAnalysis.externalReferences}`
  );
  lines.push(
    `  Circular References: ${summary.referenceAnalysis.circularReferences}`
  );
  lines.push("");

  // Additional features
  lines.push(`🌐 Additional Features`);
  lines.push(`  Servers: ${summary.servers}`);
  lines.push(`  Tags: ${summary.tags}`);
  lines.push(`  Webhooks: ${summary.webhooks}`);
  lines.push("");

  // Validation results
  lines.push(`✅ Validation Results`);
  lines.push(`  Valid: ${summary.validationResults.valid ? "Yes" : "No"}`);
  lines.push(`  Errors: ${summary.validationResults.errors}`);
  lines.push(`  Warnings: ${summary.validationResults.warnings}`);
  lines.push(
    `  Processing Time: ${summary.validationResults.processingTime.toFixed(
      2
    )}ms`
  );
  lines.push("");

  lines.push("=".repeat(50));

  return lines.join("\n");
};

/**
 * Generate a JSON summary report
 */
export const generateJSONSummary = (summary: SpecificationSummary): string => {
  return JSON.stringify(summary, null, 2);
};

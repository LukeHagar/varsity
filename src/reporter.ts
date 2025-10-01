import { writeFileSync } from "fs";
import { resolve } from "path";
import type { ValidationResult, ReportOptions } from "./types.js";

/**
 * Generate a comprehensive validation report
 */
export const generateReport = (
  result: ValidationResult,
  options: ReportOptions
): string => {
  switch (options.format) {
    case "json":
      return generateJSONReport(result, options);
    case "yaml":
      return generateYAMLReport(result, options);
    case "html":
      return generateHTMLReport(result, options);
    case "markdown":
      return generateMarkdownReport(result, options);
    default:
      throw new Error(`Unsupported report format: ${options.format}`);
  }
};

/**
 * Save report to file
 */
export const saveReport = (content: string, outputPath: string): void => {
  const fullPath = resolve(outputPath);
  writeFileSync(fullPath, content, "utf-8");
};

/**
 * Extract metadata from specification
 */
const extractMetadata = (spec: any): Record<string, any> => {
  return {
    title: spec.info?.title,
    version: spec.info?.version,
    description: spec.info?.description,
    contact: spec.info?.contact ? JSON.stringify(spec.info.contact) : undefined,
    license: spec.info?.license ? JSON.stringify(spec.info.license) : undefined,
  };
};

/**
 * Generate summary section for HTML
 */
const generateSummarySection = (result: ValidationResult): string => {
  return `
    <div class="section">
      <h3>Summary</h3>
      <p><strong>Errors:</strong> ${result.errors.length}</p>
      <p><strong>Warnings:</strong> ${result.warnings.length}</p>
    </div>
  `;
};

/**
 * Generate errors section for HTML
 */
const generateErrorsSection = (result: ValidationResult): string => {
  if (result.errors.length === 0) {
    return '<div class="section"><h3>Errors</h3><p>No errors found.</p></div>';
  }

  const errorItems = result.errors
    .map(
      (error) => `
    <div class="error">
      <div><strong>Path:</strong> <span class="path">${error.path}</span></div>
      <div><strong>Message:</strong> ${error.message}</div>
      ${
        error.schemaPath
          ? `<div><strong>Schema Path:</strong> <span class="path">${error.schemaPath}</span></div>`
          : ""
      }
    </div>
  `
    )
    .join("");

  return `
    <div class="section">
      <h3>Errors (${result.errors.length})</h3>
      ${errorItems}
    </div>
  `;
};

/**
 * Generate warnings section for HTML
 */
const generateWarningsSection = (result: ValidationResult): string => {
  if (result.warnings.length === 0) {
    return '<div class="section"><h3>Warnings</h3><p>No warnings found.</p></div>';
  }

  const warningItems = result.warnings
    .map(
      (warning) => `
    <div class="warning">
      <div><strong>Path:</strong> <span class="path">${
        warning.path
      }</span></div>
      <div><strong>Message:</strong> ${warning.message}</div>
      ${
        warning.schemaPath
          ? `<div><strong>Schema Path:</strong> <span class="path">${warning.schemaPath}</span></div>`
          : ""
      }
    </div>
  `
    )
    .join("");

  return `
    <div class="section">
      <h3>Warnings (${result.warnings.length})</h3>
      ${warningItems}
    </div>
  `;
};

/**
 * Generate metadata section for HTML
 */
const generateMetadataSection = (result: ValidationResult): string => {
  const metadata = extractMetadata(result.spec);
  const metadataItems = Object.entries(metadata)
    .filter(([_, value]) => value)
    .map(
      ([key, value]) => `
      <div class="metadata-item">
        <span class="metadata-label">${key}:</span> ${value}
      </div>
    `
    )
    .join("");

  return `
    <div class="section">
      <h3>Metadata</h3>
      <div class="metadata">
        ${metadataItems}
      </div>
    </div>
  `;
};

/**
 * Generate JSON report
 */
const generateJSONReport = (
  result: ValidationResult,
  options: ReportOptions
): string => {
  const report = {
    summary: {
      valid: result.valid,
      version: result.version,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      timestamp: new Date().toISOString(),
    },
    errors: result.errors,
    warnings: options.includeWarnings ? result.warnings : undefined,
    metadata: options.includeMetadata
      ? extractMetadata(result.spec)
      : undefined,
  };

  return JSON.stringify(report, null, 2);
};

/**
 * Generate YAML report
 */
const generateYAMLReport = (
  result: ValidationResult,
  options: ReportOptions
): string => {
  // Simple YAML generation - in production, use a proper YAML library
  const lines: string[] = [];

  lines.push("summary:");
  lines.push(`  valid: ${result.valid}`);
  lines.push(`  version: ${result.version}`);
  lines.push(`  errorCount: ${result.errors.length}`);
  lines.push(`  warningCount: ${result.warnings.length}`);
  lines.push(`  timestamp: ${new Date().toISOString()}`);

  if (result.errors.length > 0) {
    lines.push("errors:");
    for (const error of result.errors) {
      lines.push(`  - path: ${error.path}`);
      lines.push(`    message: ${error.message}`);
      if (error.schemaPath) {
        lines.push(`    schemaPath: ${error.schemaPath}`);
      }
    }
  }

  if (options.includeWarnings && result.warnings.length > 0) {
    lines.push("warnings:");
    for (const warning of result.warnings) {
      lines.push(`  - path: ${warning.path}`);
      lines.push(`    message: ${warning.message}`);
      if (warning.schemaPath) {
        lines.push(`    schemaPath: ${warning.schemaPath}`);
      }
    }
  }

  return lines.join("\n");
};

/**
 * Generate HTML report
 */
const generateHTMLReport = (
  result: ValidationResult,
  options: ReportOptions
): string => {
  const status = result.valid ? "valid" : "invalid";
  const statusColor = result.valid ? "#28a745" : "#dc3545";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenAPI Validation Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { padding: 20px; border-bottom: 1px solid #e9ecef; }
        .status { display: inline-block; padding: 8px 16px; border-radius: 4px; color: white; font-weight: bold; background: ${statusColor}; }
        .content { padding: 20px; }
        .section { margin-bottom: 30px; }
        .section h3 { color: #495057; margin-bottom: 15px; }
        .error, .warning { padding: 12px; margin: 8px 0; border-radius: 4px; border-left: 4px solid; }
        .error { background: #f8d7da; border-color: #dc3545; color: #721c24; }
        .warning { background: #fff3cd; border-color: #ffc107; color: #856404; }
        .path { font-family: monospace; background: #e9ecef; padding: 2px 6px; border-radius: 3px; }
        .metadata { background: #f8f9fa; padding: 15px; border-radius: 4px; }
        .metadata-item { margin: 5px 0; }
        .metadata-label { font-weight: bold; color: #495057; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>OpenAPI Validation Report</h1>
            <span class="status">${status.toUpperCase()}</span>
            <p>OpenAPI Version: ${result.version}</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        <div class="content">
            ${generateSummarySection(result)}
            ${generateErrorsSection(result)}
            ${options.includeWarnings ? generateWarningsSection(result) : ""}
            ${options.includeMetadata ? generateMetadataSection(result) : ""}
        </div>
    </div>
</body>
</html>`.trim();
};

/**
 * Generate Markdown report
 */
const generateMarkdownReport = (
  result: ValidationResult,
  options: ReportOptions
): string => {
  const lines: string[] = [];

  lines.push("# OpenAPI Validation Report");
  lines.push("");
  lines.push(`**Status:** ${result.valid ? "✅ Valid" : "❌ Invalid"}`);
  lines.push(`**Version:** ${result.version}`);
  lines.push(`**Generated:** ${new Date().toLocaleString()}`);
  lines.push("");

  lines.push("## Summary");
  lines.push(`- **Errors:** ${result.errors.length}`);
  lines.push(`- **Warnings:** ${result.warnings.length}`);
  lines.push("");

  if (result.errors.length > 0) {
    lines.push("## Errors");
    lines.push("");
    for (const error of result.errors) {
      lines.push(`### \`${error.path}\``);
      lines.push(`**Message:** ${error.message}`);
      if (error.schemaPath) {
        lines.push(`**Schema Path:** \`${error.schemaPath}\``);
      }
      lines.push("");
    }
  }

  if (options.includeWarnings && result.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const warning of result.warnings) {
      lines.push(`### \`${warning.path}\``);
      lines.push(`**Message:** ${warning.message}`);
      if (warning.schemaPath) {
        lines.push(`**Schema Path:** \`${warning.schemaPath}\``);
      }
      lines.push("");
    }
  }

  if (options.includeMetadata) {
    lines.push("## Metadata");
    lines.push("");
    const metadata = extractMetadata(result.spec);
    for (const [key, value] of Object.entries(metadata)) {
      if (value) {
        lines.push(`- **${key}:** ${value}`);
      }
    }
  }

  return lines.join("\n");
};

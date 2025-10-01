#!/usr/bin/env bun
import { Command } from "commander";
import {
  validate,
  parse,
  generateValidationReport,
  saveValidationReport,
  validateMultiple,
  validateWithReferences,
  validateMultipleWithReferences,
  analyzeDocumentReferences,
  getSupportedVersions,
  createVarsity,
} from "./varsity.js";
import type { ValidationOptions, ReportOptions } from "./types.js";

const program = new Command();

program
  .name("varsity")
  .description("Comprehensive OpenAPI parsing and validation library")
  .version("1.0.0");

// Validate command
program
  .command("validate")
  .description("Validate an OpenAPI specification")
  .argument("<source>", "Path or URL to OpenAPI specification")
  .option("-s, --strict", "Enable strict validation mode")
  .option("-e, --examples", "Validate examples in the specification")
  .option("-r, --references", "Validate all references")
  .option("--recursive", "Recursively validate all $ref references")
  .option(
    "--max-depth <depth>",
    "Maximum reference depth for recursive validation",
    "10"
  )
  .option("-v, --verbose", "Show detailed output")
  .action(async (source: string, options: any) => {
    try {
      const validationOptions: ValidationOptions = {
        strict: options.strict,
        validateExamples: options.examples,
        validateReferences: options.references,
        recursive: options.recursive,
        maxRefDepth: parseInt(options.maxDepth) || 10,
      };

      let result;
      if (options.recursive) {
        result = await validateWithReferences(source, validationOptions);

        if (result.valid) {
          console.log("✅ Specification and all references are valid");
          if (options.verbose) {
            console.log(`Version: ${result.version}`);
            console.log(`Total documents: ${result.totalDocuments}`);
            console.log(`Valid documents: ${result.validDocuments}`);
            console.log(
              `Circular references: ${result.circularReferences.length}`
            );
            console.log(`Warnings: ${result.warnings.length}`);
          }
        } else {
          console.log("❌ Specification or references are invalid");
          console.log(`Errors: ${result.errors.length}`);
          console.log(`Total documents: ${result.totalDocuments}`);
          console.log(`Valid documents: ${result.validDocuments}`);

          if (result.circularReferences.length > 0) {
            console.log(
              `Circular references: ${result.circularReferences.length}`
            );
            for (const circular of result.circularReferences) {
              console.log(`  • ${circular}`);
            }
          }

          for (const error of result.errors) {
            console.log(`  • ${error.path}: ${error.message}`);
          }

          if (options.verbose && result.warnings.length > 0) {
            console.log(`Warnings: ${result.warnings.length}`);
            for (const warning of result.warnings) {
              console.log(`  • ${warning.path}: ${warning.message}`);
            }
          }

          process.exit(1);
        }
      } else {
        result = await validate(source, validationOptions);

        if (result.valid) {
          console.log("✅ Specification is valid");
          if (options.verbose) {
            console.log(`Version: ${result.version}`);
            console.log(`Warnings: ${result.warnings.length}`);
          }
        } else {
          console.log("❌ Specification is invalid");
          console.log(`Errors: ${result.errors.length}`);

          for (const error of result.errors) {
            console.log(`  • ${error.path}: ${error.message}`);
          }

          if (options.verbose && result.warnings.length > 0) {
            console.log(`Warnings: ${result.warnings.length}`);
            for (const warning of result.warnings) {
              console.log(`  • ${warning.path}: ${warning.message}`);
            }
          }

          process.exit(1);
        }
      }
    } catch (error) {
      console.error(
        "❌ Validation failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      process.exit(1);
    }
  });

// Parse command
program
  .command("parse")
  .description("Parse an OpenAPI specification without validation")
  .argument("<source>", "Path or URL to OpenAPI specification")
  .option("-j, --json", "Output as JSON")
  .action(async (source: string, options: any) => {
    try {
      const parsed = await parse(source);

      if (options.json) {
        console.log(JSON.stringify(parsed, null, 2));
      } else {
        console.log("📄 Parsed OpenAPI Specification");
        console.log(`Version: ${parsed.version}`);
        console.log(`Source: ${parsed.source}`);
        console.log(`Title: ${parsed.metadata.title || "N/A"}`);
        console.log(`Version: ${parsed.metadata.version || "N/A"}`);
        if (parsed.metadata.description) {
          console.log(`Description: ${parsed.metadata.description}`);
        }
      }
    } catch (error) {
      console.error(
        "❌ Parsing failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      process.exit(1);
    }
  });

// Report command
program
  .command("report")
  .description("Generate a validation report")
  .argument("<source>", "Path or URL to OpenAPI specification")
  .option(
    "-f, --format <format>",
    "Report format (json, yaml, html, markdown)",
    "json"
  )
  .option("-o, --output <file>", "Output file path")
  .option("-s, --strict", "Enable strict validation mode")
  .option("-e, --examples", "Validate examples in the specification")
  .option("-r, --references", "Validate all references")
  .option("-w, --warnings", "Include warnings in report")
  .option("-m, --metadata", "Include metadata in report")
  .action(async (source: string, options: any) => {
    try {
      const validationOptions: ValidationOptions = {
        strict: options.strict,
        validateExamples: options.examples,
        validateReferences: options.references,
      };

      const reportOptions: ReportOptions = {
        format: options.format,
        output: options.output,
        includeWarnings: options.warnings,
        includeMetadata: options.metadata,
      };

      if (options.output) {
        await saveValidationReport(source, reportOptions, validationOptions);
        console.log(`📊 Report saved to: ${options.output}`);
      } else {
        const report = await generateValidationReport(
          source,
          reportOptions,
          validationOptions
        );
        console.log(report);
      }
    } catch (error) {
      console.error(
        "❌ Report generation failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      process.exit(1);
    }
  });

// Batch command
program
  .command("batch")
  .description("Validate multiple OpenAPI specifications")
  .argument("<sources...>", "Paths or URLs to OpenAPI specifications")
  .option("-s, --strict", "Enable strict validation mode")
  .option("-e, --examples", "Validate examples in the specification")
  .option("-r, --references", "Validate all references")
  .option("-j, --json", "Output as JSON")
  .action(async (sources: string[], options: any) => {
    try {
      const validationOptions: ValidationOptions = {
        strict: options.strict,
        validateExamples: options.examples,
        validateReferences: options.references,
      };

      const results = await validateMultiple(sources, validationOptions);

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log("📋 Batch Validation Results");
        console.log("=".repeat(50));

        let validCount = 0;
        let errorCount = 0;

        for (let i = 0; i < sources.length; i++) {
          const source = sources[i];
          const result = results[i];

          console.log(`\n${i + 1}. ${source}`);
          if (result && result.valid) {
            console.log("  ✅ Valid");
            validCount++;
          } else {
            console.log("  ❌ Invalid");
            console.log(`  Errors: ${result?.errors.length || 0}`);
            errorCount++;
          }
        }

        console.log("\n" + "=".repeat(50));
        console.log(`Summary: ${validCount} valid, ${errorCount} invalid`);
      }
    } catch (error) {
      console.error(
        "❌ Batch validation failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      process.exit(1);
    }
  });

// Analyze command
program
  .command("analyze")
  .description("Analyze references in an OpenAPI specification")
  .argument("<source>", "Path or URL to OpenAPI specification")
  .option("-j, --json", "Output as JSON")
  .action(async (source: string, options: any) => {
    try {
      const analysis = await analyzeDocumentReferences(source);

      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2));
      } else {
        console.log("🔍 Reference Analysis");
        console.log("=".repeat(40));
        console.log(`Total references: ${analysis.totalReferences}`);
        console.log(
          `Circular references: ${analysis.circularReferences.length}`
        );

        if (analysis.circularReferences.length > 0) {
          console.log("\nCircular references found:");
          for (const circular of analysis.circularReferences) {
            console.log(`  • ${circular}`);
          }
        }

        if (analysis.references.length > 0) {
          console.log("\nAll references:");
          for (const ref of analysis.references) {
            console.log(`  • ${ref.path}: ${ref.value}`);
          }
        }
      }
    } catch (error) {
      console.error(
        "❌ Analysis failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      process.exit(1);
    }
  });

// Info command
program
  .command("info")
  .description("Show information about supported OpenAPI versions")
  .action(() => {
    const versions = getSupportedVersions();

    console.log("🔍 Supported OpenAPI Versions");
    console.log("=".repeat(40));
    versions.forEach((version) => {
      console.log(`  • ${version}`);
    });
    console.log("\nFor more information, visit: https://spec.openapis.org/");
  });

// Parse command line arguments
program.parse();

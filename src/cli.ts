#!/usr/bin/env bun
import { Command } from "commander";
import {
  validate,
  parse,
  generateValidationReport,
  saveValidationReport,
  validateWithReferences,
  validateMultipleWithReferences,
  analyzeDocumentReferences,
  generateSpecificationSummary,
  getSupportedVersions,
  createVarsity,
  log,
} from "./varsity.js";
import type { ValidationOptions, ReportOptions } from "./types.js";

const program = new Command();

program
  .name("varsity")
  .description(
    "Comprehensive OpenAPI parsing and validation library (supports JSON and YAML)"
  )
  .version("1.0.0");

// Validate command
program
  .command("validate")
  .description("Validate one or more OpenAPI specifications")
  .argument(
    "<sources...>",
    "Path(s) or URL(s) to OpenAPI specification(s) (JSON or YAML)"
  )
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
  .option("-j, --json", "Output as JSON")
  .option("--no-progress", "Disable progress indicators")
  .option("--no-colors", "Disable colored output")
  .action(async (sources: string[], options: any) => {
    // Configure logger based on options
    log.setVerbose(options.verbose);
    log.setShowProgress(!options.noProgress);
    log.setUseColors(!options.noColors);
    try {
      const validationOptions: ValidationOptions = {
        strict: options.strict,
        validateExamples: options.examples,
        validateReferences: options.references,
        recursive: options.recursive,
        maxRefDepth: parseInt(options.maxDepth) || 10,
      };

      // Handle single vs multiple sources
      if (sources.length === 1) {
        const source = sources[0];
        if (!source) {
          console.log("❌ No source provided");
          process.exit(1);
        }
        let result;

        if (options.recursive) {
          result = await validateWithReferences(source, validationOptions);

          if (result.valid) {
            console.log("✅ Specification and all references are valid");

            // Show summary if not in JSON mode
            if (!options.json) {
              try {
                const { summary } = await generateSpecificationSummary(
                  source,
                  validationOptions
                );
                console.log("\n📊 Summary:");
                console.log(`  Version: ${summary.version}`);
                console.log(`  Paths: ${summary.paths}`);
                console.log(`  Endpoints: ${summary.endpoints}`);
                console.log(`  Components: ${summary.components}`);
                console.log(`  Schemas: ${summary.schemas}`);
                console.log(`  Total Documents: ${result.totalDocuments}`);
                console.log(`  Valid Documents: ${result.validDocuments}`);
                console.log(
                  `  References: ${summary.referenceAnalysis.totalReferences}`
                );
                console.log(
                  `  Circular References: ${result.circularReferences.length}`
                );
                console.log(`  Errors: ${result.errors.length}`);
                console.log(`  Warnings: ${result.warnings.length}`);
              } catch (error) {
                // Fallback to basic info if summary generation fails
                console.log(`Version: ${result.version}`);
                console.log(`Total documents: ${result.totalDocuments}`);
                console.log(`Valid documents: ${result.validDocuments}`);
                console.log(
                  `Circular references: ${result.circularReferences.length}`
                );
                console.log(`Warnings: ${result.warnings.length}`);
              }
            } else if (options.verbose) {
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
          result = await validate([source], validationOptions);

          // Handle both single result and array of results
          const validationResult = Array.isArray(result) ? result[0] : result;

          if (!validationResult) {
            console.log("❌ No validation result received");
            process.exit(1);
          }

          if (validationResult.valid) {
            console.log("✅ Specification is valid");

            // Show summary if not in JSON mode
            if (!options.json) {
              try {
                const { summary } = await generateSpecificationSummary(
                  source,
                  validationOptions
                );
                console.log("\n📊 Summary:");
                console.log(`  Version: ${summary.version}`);
                console.log(`  Paths: ${summary.paths}`);
                console.log(`  Endpoints: ${summary.endpoints}`);
                console.log(`  Components: ${summary.components}`);
                console.log(`  Schemas: ${summary.schemas}`);
                console.log(
                  `  References: ${summary.referenceAnalysis.totalReferences}`
                );
                console.log(
                  `  Circular References: ${summary.referenceAnalysis.circularReferences}`
                );
                console.log(`  Errors: ${summary.validationResults.errors}`);
                console.log(
                  `  Warnings: ${summary.validationResults.warnings}`
                );
              } catch (error) {
                // Fallback to basic info if summary generation fails
                console.log(`Version: ${validationResult.version}`);
                console.log(`Warnings: ${validationResult.warnings.length}`);
              }
            } else if (options.verbose) {
              console.log(`Version: ${validationResult.version}`);
              console.log(`Warnings: ${validationResult.warnings.length}`);
            }
          } else {
            console.log("❌ Specification is invalid");
            console.log(`Errors: ${validationResult.errors.length}`);

            for (const error of validationResult.errors) {
              console.log(`  • ${error.path}: ${error.message}`);
            }

            if (options.verbose && validationResult.warnings.length > 0) {
              console.log(`Warnings: ${validationResult.warnings.length}`);
              for (const warning of validationResult.warnings) {
                console.log(`  • ${warning.path}: ${warning.message}`);
              }
            }

            process.exit(1);
          }
        }
      } else {
        // Multiple sources - use batch validation logic
        const results = await validateMultipleWithReferences(
          sources,
          validationOptions
        );

        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
        } else {
          console.log("📋 Validation Results");
          console.log("=".repeat(50));

          let validCount = 0;
          let errorCount = 0;

          for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            const result = results[i];

            console.log(`\n${i + 1}. ${source}`);
            if (result && result.valid) {
              console.log("  ✅ Valid");
              if (options.verbose) {
                console.log(`  Version: ${result.version}`);
                console.log(`  Warnings: ${result.warnings.length}`);
              }
              validCount++;
            } else {
              console.log("  ❌ Invalid");
              console.log(`  Errors: ${result?.errors.length || 0}`);
              if (options.verbose && result?.errors) {
                for (const error of result.errors) {
                  console.log(`    • ${error.path}: ${error.message}`);
                }
              }
              errorCount++;
            }
          }

          console.log("\n" + "=".repeat(50));
          console.log(`Summary: ${validCount} valid, ${errorCount} invalid`);

          if (errorCount > 0) {
            process.exit(1);
          }
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
  .argument("<source>", "Path or URL to OpenAPI specification (JSON or YAML)")
  .option("-j, --json", "Output as JSON")
  .option("--no-progress", "Disable progress indicators")
  .option("--no-colors", "Disable colored output")
  .action(async (source: string, options: any) => {
    // Configure logger based on options
    log.setVerbose(options.verbose);
    log.setShowProgress(!options.noProgress);
    log.setUseColors(!options.noColors);
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
  .argument("<source>", "Path or URL to OpenAPI specification (JSON or YAML)")
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

// Analyze command
program
  .command("analyze")
  .description("Analyze references in an OpenAPI specification")
  .argument("<source>", "Path or URL to OpenAPI specification (JSON or YAML)")
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

// Summary command
program
  .command("summary")
  .description("Generate a comprehensive summary of an OpenAPI specification")
  .argument("<source>", "Path or URL to OpenAPI specification (JSON or YAML)")
  .option("-j, --json", "Output as JSON")
  .option("-d, --detailed", "Show detailed summary")
  .option("-s, --strict", "Enable strict validation mode")
  .option("-e, --examples", "Validate examples in the specification")
  .option("-r, --references", "Validate all references")
  .option("--no-progress", "Disable progress indicators")
  .option("--no-colors", "Disable colored output")
  .action(async (source: string, options: any) => {
    // Configure logger based on options
    log.setVerbose(options.verbose);
    log.setShowProgress(!options.noProgress);
    log.setUseColors(!options.noColors);

    try {
      const validationOptions: ValidationOptions = {
        strict: options.strict,
        validateExamples: options.examples,
        validateReferences: options.references,
      };

      const { summary, detailedSummary, jsonSummary } =
        await generateSpecificationSummary(source, validationOptions);

      if (options.json) {
        console.log(jsonSummary);
      } else if (options.detailed) {
        console.log(detailedSummary);
      } else {
        console.log("📊 OpenAPI Specification Summary");
        console.log("=".repeat(50));
        console.log(`Version: ${summary.version}`);
        console.log(`Title: ${summary.title || "N/A"}`);
        console.log(`Paths: ${summary.paths}`);
        console.log(`Endpoints: ${summary.endpoints}`);
        console.log(`Components: ${summary.components}`);
        console.log(`Schemas: ${summary.schemas}`);
        console.log(`Valid: ${summary.validationResults.valid ? "Yes" : "No"}`);
        if (summary.validationResults.errors > 0) {
          console.log(`Errors: ${summary.validationResults.errors}`);
        }
        if (summary.validationResults.warnings > 0) {
          console.log(`Warnings: ${summary.validationResults.warnings}`);
        }
        console.log("=".repeat(50));
      }
    } catch (error) {
      console.error(
        "❌ Summary generation failed:",
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

// Only parse command line arguments if this file is being run directly
if (import.meta.main) {
  program.parse();
}

import { describe, test, expect } from "bun:test";
import {
  validate,
  parse,
  generateValidationReport,
  getSupportedVersions,
  createVarsity,
  type ValidationResult,
} from "../src/varsity.js";
import { resolve } from "path";

describe("Varsity Library", () => {
  const sampleSpecPath = resolve(__dirname, "sample-openapi.json");

  test("should parse a valid OpenAPI specification", async () => {
    const parsed = await parse(sampleSpecPath);

    expect(parsed).toBeDefined();
    expect(parsed.version).toBe("3.0.3");
    expect(parsed.spec.info.title).toBe("Sample API");
  });

  test("should validate a valid OpenAPI specification", async () => {
    const result = (await validate(sampleSpecPath)) as ValidationResult;

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.version).toBe("3.0.3");
  });

  test("should generate a JSON report", async () => {
    const report = await generateValidationReport(sampleSpecPath, {
      format: "json",
      includeWarnings: true,
      includeMetadata: true,
    });

    const parsedReport = JSON.parse(report);
    expect(parsedReport.summary.valid).toBe(true);
    expect(parsedReport.summary.version).toBe("3.0.3");
  });

  test("should generate a markdown report", async () => {
    const report = await generateValidationReport(sampleSpecPath, {
      format: "markdown",
      includeWarnings: true,
      includeMetadata: true,
    });

    expect(report).toContain("# OpenAPI Validation Report");
    expect(report).toContain("✅ Valid");
    expect(report).toContain("Sample API");
  });

  test("should get supported versions", () => {
    const versions = getSupportedVersions();

    expect(versions).toContain("2.0");
    expect(versions).toContain("3.0.3");
    expect(versions).toContain("3.1.0");
  });

  test("should handle invalid specification", async () => {
    const invalidSpec = {
      openapi: "3.0.3",
      // Missing required 'info' and 'paths' fields
    };

    // Create a temporary file with invalid spec
    const fs = await import("fs");
    const tempPath = resolve(__dirname, "invalid-spec.json");
    fs.writeFileSync(tempPath, JSON.stringify(invalidSpec));

    try {
      const result = (await validate(tempPath)) as ValidationResult;
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    } finally {
      // Clean up
      fs.unlinkSync(tempPath);
    }
  });

  test("should work with createVarsity factory", async () => {
    const varsity = createVarsity();

    const result = (await varsity.validate(sampleSpecPath)) as ValidationResult;
    expect(result.valid).toBe(true);

    const versions = varsity.getSupportedVersions();
    expect(versions).toContain("3.0.3");
  });

  test("should work with createVarsity factory for multiple specs", async () => {
    const varsity = createVarsity();

    const results = (await varsity.validate([
      sampleSpecPath,
      sampleSpecPath,
    ])) as ValidationResult[];
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(2);
    expect(results[0]?.valid).toBe(true);
    expect(results[1]?.valid).toBe(true);
  });

  test("should validate multiple specifications", async () => {
    const results = (await validate([
      sampleSpecPath,
      sampleSpecPath,
    ])) as ValidationResult[];

    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(2);
    expect(results[0]?.valid).toBe(true);
    expect(results[1]?.valid).toBe(true);
  });

  test("should handle mixed valid and invalid specifications", async () => {
    const invalidSpec = {
      openapi: "3.0.3",
      // Missing required 'info' and 'paths' fields
    };

    // Create a temporary file with invalid spec
    const fs = await import("fs");
    const tempPath = resolve(__dirname, "invalid-spec-mixed.json");
    fs.writeFileSync(tempPath, JSON.stringify(invalidSpec));

    try {
      const results = (await validate([
        sampleSpecPath,
        tempPath,
      ])) as ValidationResult[];

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
      expect(results[0]?.valid).toBe(true); // Valid spec
      expect(results[1]?.valid).toBe(false); // Invalid spec
    } finally {
      // Clean up
      fs.unlinkSync(tempPath);
    }
  });
});

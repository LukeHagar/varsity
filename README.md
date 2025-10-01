# Varsity

A comprehensive OpenAPI parsing and validation library built with TypeScript and Bun. Varsity provides both a command-line interface and a programmatic API for validating OpenAPI specifications across all versions (2.0, 3.0.x, 3.1.0).

## Features

- 🔍 **Multi-version Support**: Validates OpenAPI 2.0 (Swagger) and OpenAPI 3.0.x/3.1.0 specifications
- 📊 **Comprehensive Reporting**: Generate reports in JSON, YAML, HTML, and Markdown formats
- 🚀 **High Performance**: Built with Bun for fast execution
- 🛠️ **Flexible Usage**: Use as a CLI tool or import as a library
- ✅ **AJV Integration**: Robust validation using the industry-standard AJV library
- 📝 **Detailed Error Reporting**: Clear error messages with path information
- 🔧 **Extensible**: Support for custom validation rules and schemas
- 🎯 **Type Safety**: Full TypeScript support with comprehensive OpenAPI type definitions from `oas-types`
- 📋 **Comprehensive Schemas**: Uses official JSON schemas for accurate validation

## Installation

```bash
bun install
```

## Usage

### Command Line Interface

#### Validate a specification
```bash
bun run src/cli.ts validate path/to/spec.json
```

#### Parse without validation
```bash
bun run src/cli.ts parse path/to/spec.json
```

#### Generate a report
```bash
bun run src/cli.ts report path/to/spec.json --format html --output report.html
```

#### Batch validation
```bash
bun run src/cli.ts batch spec1.json spec2.json spec3.json
```

#### Show supported versions
```bash
bun run src/cli.ts info
```

### CLI Options

#### Validate Command
- `-s, --strict`: Enable strict validation mode
- `-e, --examples`: Validate examples in the specification
- `-r, --references`: Validate all references
- `-v, --verbose`: Show detailed output

#### Report Command
- `-f, --format <format>`: Report format (json, yaml, html, markdown)
- `-o, --output <file>`: Output file path
- `-w, --warnings`: Include warnings in report
- `-m, --metadata`: Include metadata in report

### Programmatic Usage

#### Functional Approach (Recommended)

```typescript
import { validate, parse, generateValidationReport } from './src/varsity.js';

// Parse and validate
const result = await validate('path/to/spec.json');

// Generate a report
const report = await generateValidationReport('path/to/spec.json', {
  format: 'json',
  includeWarnings: true,
  includeMetadata: true
});

// Parse without validation
const parsed = await parse('path/to/spec.json');
```

#### Factory Pattern (For Configuration)

```typescript
import { createVarsity } from './src/varsity.js';

const varsity = createVarsity({
  defaultVersion: '3.0.3',
  strictMode: false,
  customSchemas: {},
  reportFormats: ['json']
});

// Use the configured instance
const result = await varsity.validate('path/to/spec.json');
const report = await varsity.generateReport('path/to/spec.json', {
  format: 'json',
  includeWarnings: true,
  includeMetadata: true
});
```

## API Reference

### Core Functions

#### Direct Functions
- `validate(source: string, options?: ValidationOptions, config?: VarsityConfig): Promise<ValidationResult>`
- `parse(source: string): Promise<ParsedSpec>`
- `generateValidationReport(source: string, reportOptions: ReportOptions, validationOptions?: ValidationOptions, config?: VarsityConfig): Promise<string>`
- `saveValidationReport(source: string, reportOptions: ReportOptions, validationOptions?: ValidationOptions, config?: VarsityConfig): Promise<void>`
- `validateMultiple(sources: string[], options?: ValidationOptions, config?: VarsityConfig): Promise<ValidationResult[]>`
- `getSupportedVersions(): string[]`

#### Factory Function
- `createVarsity(config?: VarsityConfig)`: Creates a configured instance with methods

#### Individual Module Functions
- `parseOpenAPISpec(source: string): Promise<ParsedSpec>`
- `validateBasicStructure(spec: any, version: OpenAPIVersion): boolean`
- `validateOpenAPISpec(spec: any, version: OpenAPIVersion, options?: ValidationOptions): ValidationResult`
- `generateReport(result: ValidationResult, options: ReportOptions): string`
- `saveReport(content: string, outputPath: string): void`

### Types

- `ValidationResult`: Contains validation results with errors and warnings
- `ParsedSpec`: Parsed specification with metadata
- `ValidationOptions`: Configuration for validation behavior
- `ReportOptions`: Configuration for report generation
- `VarsityConfig`: Global configuration for the library
- `OpenAPISpec`: Union type for all OpenAPI specification versions
- `OpenAPIVersion`: Supported OpenAPI version strings

### Type Safety

Varsity leverages the comprehensive `oas-types` package for full TypeScript support:

```typescript
import type { OpenAPI2, OpenAPI3, OpenAPI3_1 } from 'oas-types';

// All parsed specifications are properly typed
const result = await validate('spec.json');
// result.spec is typed as OpenAPISpec (OpenAPI2 | OpenAPI3 | OpenAPI3_1)

// Type guards for version-specific handling
if (result.version === '2.0') {
  const swaggerSpec = result.spec as OpenAPI2;
  // swaggerSpec.swagger, swaggerSpec.info, etc. are fully typed
}
```

## Development

### Running Tests
```bash
bun test
```

### Building
```bash
bun run build
```

### Linting
```bash
bun run lint
```

## License

MIT

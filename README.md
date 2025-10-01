# Varsity

A comprehensive OpenAPI parsing and validation library that supports both programmatic usage and command-line operations.

## Features

- 🔍 **Comprehensive Validation**: Validate OpenAPI 2.0, 3.0.x, and 3.1.x specifications
- 🔄 **Recursive Validation**: Validate all `$ref` references and detect circular dependencies
- 📊 **Rich Reporting**: Generate reports in JSON, YAML, HTML, and Markdown formats
- 🚀 **CLI & Library**: Use as both a command-line tool and a JavaScript/TypeScript library
- 🎯 **TypeScript Support**: Full TypeScript definitions included
- ⚡ **Fast**: Built with Bun for optimal performance
- 🔧 **Flexible**: Support for custom validation rules and configurations

## Installation

```bash
# Using npm
npm install varsity

# Using yarn
yarn add varsity

# Using pnpm
pnpm add varsity

# Using bun
bun add varsity
```

## Usage

### As a Library

#### Basic Validation

```javascript
import { validate, parse } from 'varsity';

// Validate an OpenAPI specification
const result = await validate('path/to/spec.json');
if (result.valid) {
  console.log('✅ Specification is valid');
} else {
  console.log('❌ Validation errors:', result.errors);
}

// Parse without validation
const parsed = await parse('path/to/spec.json');
console.log('Version:', parsed.version);
console.log('Title:', parsed.metadata.title);
```

#### Advanced Validation

```javascript
import { 
  validate, 
  validateWithReferences, 
  createVarsity 
} from 'varsity';

// Validate with custom options
const result = await validate('spec.json', {
  strict: true,
  validateExamples: true,
  validateReferences: true,
  recursive: true,
  maxRefDepth: 10
});

// Recursive validation with reference resolution
const recursiveResult = await validateWithReferences('spec.json', {
  strict: true,
  validateExamples: true
});

// Create a configured instance
const varsity = createVarsity({
  defaultVersion: '3.0',
  strictMode: true,
  reportFormats: ['json', 'html']
});

const result = await varsity.validate('spec.json');
```

#### Report Generation

```javascript
import { generateValidationReport, saveValidationReport } from 'varsity';

// Generate a report
const report = await generateValidationReport('spec.json', {
  format: 'html',
  includeWarnings: true,
  includeMetadata: true
});

// Save report to file
await saveValidationReport('spec.json', {
  format: 'json',
  output: 'validation-report.json',
  includeWarnings: true
});
```

#### Reference Analysis

```javascript
import { analyzeDocumentReferences, analyzeReferences } from 'varsity';

// Analyze references in a document
const analysis = await analyzeDocumentReferences('spec.json');
console.log('Total references:', analysis.totalReferences);
console.log('Circular references:', analysis.circularReferences);

// Find all references
const references = await analyzeReferences('spec.json');
```

### As a CLI Tool

#### Basic Commands

```bash
# Validate a specification
varsity validate spec.json

# Parse without validation
varsity parse spec.json

# Show supported OpenAPI versions
varsity info
```

#### Advanced Validation

```bash
# Strict validation with examples
varsity validate spec.json --strict --examples

# Recursive validation with references
varsity validate spec.json --recursive --references

# Verbose output
varsity validate spec.json --verbose
```

#### Report Generation

```bash
# Generate HTML report
varsity report spec.json --format html --output report.html

# Generate JSON report with warnings
varsity report spec.json --format json --warnings --metadata
```

#### Batch Processing

```bash
# Validate multiple specifications
varsity batch spec1.json spec2.json spec3.json

# Batch validation with JSON output
varsity batch *.json --json
```

#### Reference Analysis

```bash
# Analyze references
varsity analyze spec.json

# JSON output for analysis
varsity analyze spec.json --json
```

## API Reference

### Core Functions

#### `validate(source, options?, config?)`
Validates an OpenAPI specification.

- `source`: Path, URL, or array of paths/URLs to OpenAPI specifications
- `options`: Validation options (optional)
- `config`: Varsity configuration (optional)

#### `parse(source)`
Parses an OpenAPI specification without validation.

- `source`: Path or URL to OpenAPI specification

#### `validateWithReferences(source, options?, config?)`
Recursively validates an OpenAPI specification and all its references.

#### `validateMultipleWithReferences(sources, options?, config?)`
Validates multiple OpenAPI specifications with reference resolution.

### Validation Options

```typescript
interface ValidationOptions {
  strict?: boolean;              // Enable strict validation
  validateExamples?: boolean;    // Validate examples in the spec
  validateReferences?: boolean;  // Validate all references
  recursive?: boolean;          // Enable recursive validation
  maxRefDepth?: number;         // Maximum reference depth
  customRules?: Record<string, any>; // Custom validation rules
}
```

### Report Options

```typescript
interface ReportOptions {
  format: 'json' | 'yaml' | 'html' | 'markdown';
  output?: string;              // Output file path
  includeWarnings?: boolean;    // Include warnings in report
  includeMetadata?: boolean;    // Include metadata in report
}
```

### Configuration

```typescript
interface VarsityConfig {
  defaultVersion?: OpenAPIVersion;
  strictMode?: boolean;
  customSchemas?: Record<string, JSONSchemaType<any>>;
  reportFormats?: ReportOptions['format'][];
}
```

## Supported OpenAPI Versions

- OpenAPI 2.0 (Swagger 2.0)
- OpenAPI 3.0.0, 3.0.1, 3.0.2, 3.0.3
- OpenAPI 3.1.0

## Development

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- TypeScript 5+

### Setup

```bash
# Clone the repository
git clone https://github.com/luke/varsity.git
cd varsity

# Install dependencies
bun install

# Run tests
bun test

# Run linting
bun run lint

# Build the project
bun run build
```

### Testing

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test test/basic.test.ts
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

### 1.0.0
- Initial release
- Support for OpenAPI 2.0, 3.0.x, and 3.1.x
- CLI and library usage
- Recursive validation with reference resolution
- Multiple report formats
- TypeScript support
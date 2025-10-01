import { readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { URL } from "url";
import type { OpenAPIVersion, OpenAPISpec } from "./types.js";

export interface ResolvedReference {
  path: string;
  content: any;
  version?: OpenAPIVersion;
  isCircular: boolean;
  depth: number;
}

export interface ReferenceContext {
  basePath: string;
  visited: Set<string>;
  maxDepth: number;
  currentDepth: number;
  baseDocument: any;
}

/**
 * Detect OpenAPI version from a document
 */
const detectDocumentVersion = (doc: any): OpenAPIVersion | null => {
  if (doc.openapi) {
    const version = doc.openapi;
    if (version.startsWith("3.0")) return "3.0";
    if (version.startsWith("3.1")) return "3.1";
    if (version.startsWith("3.2")) return "3.2";
  }
  if (doc.swagger === "2.0") return "2.0";
  return null;
};

/**
 * Parse a JSON or YAML file
 */
const parseFile = (filePath: string): any => {
  const content = readFileSync(filePath, "utf-8");

  if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
    return JSON.parse(content);
  } else {
    // For now, throw error for YAML - can be enhanced later
    throw new Error(`YAML parsing not implemented for file: ${filePath}`);
  }
};

/**
 * Resolve a $ref to its content
 */
export const resolveReference = async (
  ref: string,
  context: ReferenceContext
): Promise<ResolvedReference> => {
  const { basePath, visited, maxDepth, currentDepth } = context;

  // Check for circular reference
  if (visited.has(ref)) {
    return {
      path: ref,
      content: null,
      isCircular: true,
      depth: currentDepth,
    };
  }

  // Check depth limit
  if (currentDepth >= maxDepth) {
    throw new Error(`Maximum reference depth (${maxDepth}) exceeded`);
  }

  // Add to visited set
  visited.add(ref);

  try {
    let resolvedPath: string;
    let content: any;

    if (ref.startsWith("http://") || ref.startsWith("https://")) {
      // External URL reference
      const response = await fetch(ref);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch external reference: ${response.statusText}`
        );
      }
      content = await response.json();
      resolvedPath = ref;
    } else if (ref.startsWith("#/")) {
      // Internal reference - resolve within the same document
      const pathSegments = ref.substring(2).split("/");
      let current = context.baseDocument;

      for (const segment of pathSegments) {
        if (current && typeof current === "object" && segment in current) {
          current = (current as any)[segment];
        } else {
          throw new Error(`Reference not found: ${ref}`);
        }
      }

      return {
        path: ref,
        content: current,
        isCircular: false,
        depth: currentDepth,
      };
    } else {
      // Local file reference
      const baseDir = dirname(basePath);
      resolvedPath = resolve(baseDir, ref);
      content = parseFile(resolvedPath);
    }

    // Detect version of the resolved document
    const version = detectDocumentVersion(content);

    return {
      path: ref,
      content,
      version: version || undefined,
      isCircular: false,
      depth: currentDepth,
    };
  } catch (error) {
    throw new Error(
      `Failed to resolve reference '${ref}': ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  } finally {
    // Remove from visited set when done
    visited.delete(ref);
  }
};

/**
 * Find all $ref references in a document
 */
export const findReferences = (
  obj: any,
  path = ""
): Array<{ path: string; value: string }> => {
  const refs: Array<{ path: string; value: string }> = [];

  if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (key === "$ref" && typeof value === "string") {
        refs.push({ path: currentPath, value });
      } else if (typeof value === "object") {
        refs.push(...findReferences(value, currentPath));
      }
    }
  }

  return refs;
};

/**
 * Recursively resolve all references in a document
 */
export const resolveAllReferences = async (
  document: any,
  basePath: string,
  maxDepth: number = 10
): Promise<{
  document: any;
  resolvedRefs: ResolvedReference[];
  circularRefs: string[];
}> => {
  const visited = new Set<string>();
  const resolvedRefs: ResolvedReference[] = [];
  const circularRefs: string[] = [];

  const context: ReferenceContext = {
    basePath,
    visited,
    maxDepth,
    currentDepth: 0,
    baseDocument: document,
  };

  const refs = findReferences(document);

  for (const ref of refs) {
    try {
      const resolved = await resolveReference(ref.value, context);
      resolvedRefs.push(resolved);

      if (resolved.isCircular) {
        circularRefs.push(ref.value);
      }
    } catch (error) {
      console.warn(
        `Warning: Failed to resolve reference '${ref.value}': ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  return {
    document,
    resolvedRefs,
    circularRefs,
  };
};

import { dirname, resolve } from "node:path";
import { isUrlSource, loadDocument } from "./document.js";
import type { FragmentKind, OpenAPIVersion } from "./types.js";

export interface ResolvedReference {
  path: string;
  content: any;
  version?: OpenAPIVersion;
  isCircular: boolean;
  depth: number;
  source?: string;
  /** Fragment kind implied by the reference site, when determinable. */
  expectedKind?: FragmentKind | null;
}

export interface ReferenceContext {
  basePath: string;
  visited: Set<string>;
  maxDepth: number;
  currentDepth: number;
  baseDocument: any;
}

export interface UnresolvedReference {
  path: string;
  value: string;
  message: string;
  depth: number;
}

const detectDocumentVersion = (doc: any): OpenAPIVersion | null => {
  if (doc?.openapi) {
    const version = String(doc.openapi);
    if (version.startsWith("3.0")) return "3.0";
    if (version.startsWith("3.1")) return "3.1";
    if (version.startsWith("3.2")) return "3.2";
  }
  if (doc?.swagger === "2.0") return "2.0";
  return null;
};

const decodePointerSegment = (segment: string): string =>
  segment.replace(/~1/g, "/").replace(/~0/g, "~");

export const resolveJsonPointer = (root: unknown, pointer: string): unknown => {
  const normalized = pointer.replace(/^#/, "");
  if (!normalized) return root;

  const parts = normalized.replace(/^\//, "").split("/").map(decodePointerSegment);
  let current: unknown = root;
  for (const part of parts) {
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
};

const splitRef = (ref: string): { sourcePart: string; pointer: string } => {
  const hashIndex = ref.indexOf("#");
  if (hashIndex === -1) return { sourcePart: ref, pointer: "" };
  return {
    sourcePart: ref.slice(0, hashIndex),
    pointer: ref.slice(hashIndex + 1),
  };
};

const resolveExternalSource = (sourcePart: string, basePath: string): string => {
  if (isUrlSource(sourcePart)) return sourcePart;
  if (isUrlSource(basePath)) return new URL(sourcePart, basePath).toString();
  return resolve(dirname(basePath), sourcePart);
};

const absoluteRefKey = (ref: string, basePath: string): string => {
  const { sourcePart, pointer } = splitRef(ref);
  const source =
    sourcePart.length === 0 ? basePath : resolveExternalSource(sourcePart, basePath);
  return `${source}#${pointer}`;
};

const loadExternalDocument = async (source: string): Promise<unknown> => {
  const loaded = await loadDocument(isUrlSource(source) ? { kind: "url", url: source } : source);
  return loaded.document;
};

const detectVersion = (
  doc: unknown,
  fallback?: OpenAPIVersion,
): OpenAPIVersion | undefined => {
  if (doc && typeof doc === "object") {
    return detectDocumentVersion(doc) ?? fallback;
  }
  return fallback;
};

export const resolveReference = async (
  ref: string,
  context: ReferenceContext,
): Promise<ResolvedReference> => {
  const { basePath, visited, maxDepth, currentDepth } = context;
  const refKey = absoluteRefKey(ref, basePath);

  if (visited.has(refKey)) {
    return {
      path: ref,
      content: null,
      isCircular: true,
      depth: currentDepth,
      source: refKey,
    };
  }

  if (currentDepth >= maxDepth) {
    throw new Error(`Maximum reference depth (${maxDepth}) exceeded`);
  }

  visited.add(refKey);

  try {
    const { sourcePart, pointer } = splitRef(ref);
    let source = basePath;
    let rootDocument = context.baseDocument;

    if (sourcePart.length > 0) {
      source = resolveExternalSource(sourcePart, basePath);
      rootDocument = await loadExternalDocument(source);
    }

    const content = pointer ? resolveJsonPointer(rootDocument, pointer) : rootDocument;
    if (content === undefined) {
      throw new Error(`Reference not found: ${ref}`);
    }

    return {
      path: ref,
      content,
      version: detectVersion(content, detectVersion(rootDocument)),
      isCircular: false,
      depth: currentDepth,
      source,
    };
  } catch (error) {
    throw new Error(
      `Failed to resolve reference '${ref}': ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  } finally {
    visited.delete(refKey);
  }
};

// ---------------------------------------------------------------------------
// Reference-site fragment kinds
// ---------------------------------------------------------------------------

/** Keys whose direct value is a Schema Object. */
const SCHEMA_VALUE_KEYS = new Set([
  "schema",
  "items",
  "additionalItems",
  "additionalProperties",
  "unevaluatedItems",
  "unevaluatedProperties",
  "not",
  "contains",
  "propertyNames",
  "if",
  "then",
  "else",
]);

/** Map containers whose entries are Schema Objects. */
const SCHEMA_MAP_KEYS = new Set([
  "properties",
  "patternProperties",
  "dependentSchemas",
  "definitions",
  "$defs",
  "schemas",
]);

/** Array containers whose items are Schema Objects. */
const SCHEMA_LIST_KEYS = new Set(["allOf", "anyOf", "oneOf", "prefixItems"]);

/** Map containers whose entries have a fixed, well-known object kind. */
const KIND_BY_CONTAINER_KEY: Record<string, FragmentKind> = {
  responses: "response",
  parameters: "parameter",
  requestBodies: "requestbody",
  headers: "header",
  examples: "example",
  links: "link",
  callbacks: "callback",
  securitySchemes: "securityscheme",
  securityDefinitions: "securityscheme",
  paths: "pathitem",
  webhooks: "pathitem",
  pathItems: "pathitem",
};

/**
 * Derive the expected kind of a `$ref` target from the object-path segments
 * of the object holding the `$ref` (the reference site). Returns null when
 * the site does not determine a kind (for example, inside a vendor
 * extension); callers must not fall back to shape-guessing.
 */
export const expectedFragmentKind = (
  segments: string[],
): FragmentKind | null => {
  const last = segments[segments.length - 1];
  const parent = segments[segments.length - 2];

  if (last !== undefined) {
    if (SCHEMA_VALUE_KEYS.has(last)) return "schema";
    if (last === "requestBody") return "requestbody";
  }

  if (last !== undefined && parent !== undefined) {
    if (SCHEMA_MAP_KEYS.has(parent)) return "schema";
    if (/^\d+$/.test(last) && SCHEMA_LIST_KEYS.has(parent)) return "schema";
    const containerKind = KIND_BY_CONTAINER_KEY[parent];
    if (containerKind) return containerKind;
  }

  return null;
};

export interface FoundReference {
  path: string;
  value: string;
  /** Object-path segments of the object that holds the `$ref`. */
  segments: string[];
  /** Fragment kind implied by the reference site, when determinable. */
  expectedKind: FragmentKind | null;
}

export const findReferences = (
  obj: any,
  path = "",
  segments: string[] = [],
): FoundReference[] => {
  const refs: FoundReference[] = [];

  if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (key === "$ref" && typeof value === "string") {
        refs.push({
          path: currentPath,
          value,
          segments,
          expectedKind: expectedFragmentKind(segments),
        });
      } else if (typeof value === "object") {
        refs.push(...findReferences(value, currentPath, [...segments, key]));
      }
    }
  }

  return refs;
};

export const resolveAllReferences = async (
  document: any,
  basePath: string,
  maxDepth = 10,
): Promise<{
  document: any;
  resolvedRefs: ResolvedReference[];
  circularRefs: string[];
  unresolvedRefs: UnresolvedReference[];
}> => {
  const active = new Set<string>();
  const seen = new Set<string>();
  const resolvedRefs: ResolvedReference[] = [];
  const circularRefs: string[] = [];
  const unresolvedRefs: UnresolvedReference[] = [];

  const walk = async (
    currentDocument: any,
    currentBasePath: string,
    currentRootDocument: any,
    depth: number,
    inheritedKind: FragmentKind | null = null,
  ): Promise<void> => {
    if (depth >= maxDepth) {
      unresolvedRefs.push({
        path: currentBasePath,
        value: currentBasePath,
        message: `Maximum reference depth (${maxDepth}) exceeded`,
        depth,
      });
      return;
    }

    const refs = findReferences(currentDocument);
    for (const ref of refs) {
      // A `$ref` at the root of a fragment (a bare `{ "$ref": ... }`
      // wrapper) carries no site context of its own; it inherits the kind
      // expected of the fragment it stands in for.
      const expectedKind =
        ref.expectedKind ?? (ref.segments.length === 0 ? inheritedKind : null);

      const key = absoluteRefKey(ref.value, currentBasePath);
      if (active.has(key)) {
        circularRefs.push(ref.value);
        resolvedRefs.push({
          path: ref.value,
          content: null,
          isCircular: true,
          depth,
          source: key,
          expectedKind,
        });
        continue;
      }

      if (seen.has(key)) continue;
      seen.add(key);
      active.add(key);

      try {
        const { sourcePart, pointer } = splitRef(ref.value);
        let resolvedSource = currentBasePath;
        let rootDocument = currentRootDocument;

        if (sourcePart.length > 0) {
          resolvedSource = resolveExternalSource(sourcePart, currentBasePath);
          rootDocument = await loadExternalDocument(resolvedSource);
        }

        const targetDocument = pointer
          ? resolveJsonPointer(rootDocument, pointer)
          : rootDocument;
        if (targetDocument === undefined) {
          throw new Error(`Reference not found: ${ref.value}`);
        }

        resolvedRefs.push({
          path: ref.value,
          content: targetDocument,
          version: detectVersion(targetDocument, detectVersion(rootDocument)),
          isCircular: false,
          depth,
          source: resolvedSource,
          expectedKind,
        });

        if (targetDocument && typeof targetDocument === "object") {
          await walk(
            targetDocument,
            resolvedSource,
            rootDocument,
            depth + 1,
            expectedKind,
          );
        }
      } catch (error) {
        unresolvedRefs.push({
          path: ref.path,
          value: ref.value,
          message: error instanceof Error ? error.message : "Unknown error",
          depth,
        });
      } finally {
        active.delete(key);
      }
    }
  };

  await walk(document, basePath, document, 0, null);

  return {
    document,
    resolvedRefs,
    circularRefs: [...new Set(circularRefs)],
    unresolvedRefs,
  };
};

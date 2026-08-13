import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expectedFragmentKind } from "../src/ref-resolver.js";
import {
  parseOpenAPISpec,
  validateOpenAPISpec,
  validateWithReferences,
} from "../src/varsity.js";

describe("expectedFragmentKind (reference-site kinds)", () => {
  test("derives kinds from canonical reference sites", () => {
    expect(
      expectedFragmentKind(["paths", "/users", "get", "responses", "200"]),
    ).toBe("response");
    expect(
      expectedFragmentKind([
        "paths",
        "/users",
        "get",
        "responses",
        "200",
        "content",
        "application/json",
        "schema",
      ]),
    ).toBe("schema");
    expect(
      expectedFragmentKind(["components", "schemas", "User", "properties", "address"]),
    ).toBe("schema");
    expect(
      expectedFragmentKind(["components", "schemas", "A", "allOf", "0"]),
    ).toBe("schema");
    expect(expectedFragmentKind(["paths", "/u", "get", "parameters", "0"])).toBe(
      "parameter",
    );
    expect(expectedFragmentKind(["paths", "/u", "post", "requestBody"])).toBe(
      "requestbody",
    );
    expect(
      expectedFragmentKind(["components", "responses", "Err", "headers", "X-Rate"]),
    ).toBe("header");
    expect(
      expectedFragmentKind(["components", "securitySchemes", "oauth"]),
    ).toBe("securityscheme");
    expect(expectedFragmentKind(["paths", "/u"])).toBe("pathitem");
    expect(expectedFragmentKind(["webhooks", "newPet"])).toBe("pathitem");
    expect(expectedFragmentKind(["components", "callbacks", "onEvent"])).toBe(
      "callback",
    );
  });

  test("schema property names that collide with container keys stay schemas", () => {
    // A schema property literally named "responses" or "headers" is still a
    // schema position: the `properties` parent wins.
    expect(
      expectedFragmentKind(["components", "schemas", "X", "properties", "responses"]),
    ).toBe("schema");
    expect(
      expectedFragmentKind(["components", "schemas", "X", "properties", "headers"]),
    ).toBe("schema");
    expect(
      expectedFragmentKind(["components", "schemas", "X", "properties", "requestBody"]),
    ).toBe("schema");
    // A header map entry named "requestBody" is still a header.
    expect(
      expectedFragmentKind(["components", "responses", "Err", "headers", "requestBody"]),
    ).toBe("header");
  });

  test("returns null instead of guessing when the site is not determinable", () => {
    expect(expectedFragmentKind([])).toBe(null);
    expect(expectedFragmentKind(["x-custom"])).toBe(null);
    // A path item nested inside a callback expression is currently not
    // classified; null means "skip with a warning", never "guess".
    expect(
      expectedFragmentKind([
        "components",
        "callbacks",
        "onEvent",
        "{$request.body#/url}",
      ]),
    ).toBe(null);
  });
});

describe("reference cycles are legal", () => {
  test("self-recursive schema validates clean and reports the cycle as metadata", async () => {
    const spec = {
      openapi: "3.1.0",
      info: { title: "Recursive", version: "1" },
      paths: {
        "/nodes": {
          get: {
            responses: {
              "200": {
                description: "ok",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/Node" },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Node: {
            type: "object",
            properties: {
              children: {
                type: "array",
                items: { $ref: "#/components/schemas/Node" },
              },
            },
          },
        },
      },
    };

    const result = await validateWithReferences(
      { kind: "object", value: spec, source: "recursive-spec" },
      { silent: true },
    );

    expect(result.errors).toHaveLength(0);
    expect(result.valid).toBe(true);
    expect(result.circularReferences.length).toBeGreaterThan(0);
  });

  test("cross-file mutual recursion validates clean", async () => {
    const dir = mkdtempSync(join(tmpdir(), "varsity-mutual-recursion-"));
    try {
      writeFileSync(
        join(dir, "openapi.yaml"),
        [
          "openapi: 3.0.3",
          "info:",
          "  title: Mutual",
          "  version: 1.0.0",
          "paths:",
          "  /a:",
          "    get:",
          "      responses:",
          "        '200':",
          "          description: ok",
          "          content:",
          "            application/json:",
          "              schema:",
          "                $ref: './a.yaml'",
        ].join("\n"),
      );
      writeFileSync(
        join(dir, "a.yaml"),
        ["type: object", "properties:", "  b:", "    $ref: './b.yaml'"].join("\n"),
      );
      writeFileSync(
        join(dir, "b.yaml"),
        ["type: object", "properties:", "  a:", "    $ref: './a.yaml'"].join("\n"),
      );

      const result = await validateWithReferences(join(dir, "openapi.yaml"), {
        silent: true,
      });

      expect(result.errors).toHaveLength(0);
      expect(result.valid).toBe(true);
      expect(result.circularReferences.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("fragment kinds come from the reference site", () => {
  test("an empty external schema {} is a legal OpenAPI 3.1 Schema Object", async () => {
    const dir = mkdtempSync(join(tmpdir(), "varsity-empty-schema-"));
    try {
      writeFileSync(
        join(dir, "openapi.json"),
        JSON.stringify({
          openapi: "3.1.0",
          info: { title: "Empty schema", version: "1" },
          paths: {
            "/anything": {
              get: {
                responses: {
                  "200": {
                    description: "ok",
                    content: {
                      "application/json": {
                        schema: { $ref: "./anything.json" },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      );
      writeFileSync(join(dir, "anything.json"), "{}");

      const result = await validateWithReferences(join(dir, "openapi.json"), {
        silent: true,
      });

      expect(result.errors).toHaveLength(0);
      expect(result.valid).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a boolean external schema is a legal OpenAPI 3.1 Schema Object", async () => {
    const dir = mkdtempSync(join(tmpdir(), "varsity-boolean-schema-"));
    try {
      writeFileSync(
        join(dir, "openapi.json"),
        JSON.stringify({
          openapi: "3.1.0",
          info: { title: "Boolean schema", version: "1" },
          paths: {
            "/anything": {
              get: {
                responses: {
                  "200": {
                    description: "ok",
                    content: {
                      "application/json": {
                        schema: { $ref: "./anything.json" },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      );
      writeFileSync(join(dir, "anything.json"), "true");

      const result = await validateWithReferences(join(dir, "openapi.json"), {
        silent: true,
      });

      expect(result.errors).toHaveLength(0);
      expect(result.valid).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a schema-shaped fragment referenced as a response is invalid (no shape-guess escape)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "varsity-response-kind-"));
    try {
      writeFileSync(
        join(dir, "openapi.json"),
        JSON.stringify({
          openapi: "3.0.3",
          info: { title: "Wrong kind", version: "1" },
          paths: {
            "/things": {
              get: {
                responses: {
                  "200": { $ref: "./not-a-response.json" },
                },
              },
            },
          },
        }),
      );
      // Shape-guessing would classify this as a schema and pass it. As a
      // Response Object it is invalid: `description` is required.
      writeFileSync(
        join(dir, "not-a-response.json"),
        JSON.stringify({ type: "object" }),
      );

      const result = await validateWithReferences(join(dir, "openapi.json"), {
        silent: true,
      });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.message.includes("description")),
      ).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("fragments with undeterminable reference sites", () => {
  test("a boolean fragment at an unknown site is skipped, never shape-judged", async () => {
    const { validatePartialDocument } = await import("../src/varsity.js");
    // A boolean referenced from a vendor extension in a 3.0 document: the
    // site does not say a schema was expected, so this must not be an error.
    const result = validatePartialDocument(true, "3.0.3", "x-custom", null);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("shallow internal reference validation", () => {
  test("decodes RFC 6901 escaped pointer segments (~1, ~0)", async () => {
    const spec = {
      openapi: "3.0.3",
      info: { title: "Escaped pointers", version: "1" },
      paths: {
        "/users": {
          get: {
            responses: {
              "200": { description: "ok" },
            },
          },
        },
        "/alias": { $ref: "#/paths/~1users" },
      },
    };

    const parsed = await parseOpenAPISpec({ kind: "object", value: spec });
    const result = validateOpenAPISpec(parsed.spec, parsed.version, {
      validateReferences: true,
    });

    expect(
      result.errors.filter((e) => e.message.includes("Broken reference")),
    ).toHaveLength(0);
  });
});

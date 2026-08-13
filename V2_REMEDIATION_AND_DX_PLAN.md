# Varsity v2: Remediation and DX Redesign Plan

Date: 2026-08-13
Scope: fix every release-blocking issue identified in `BEST_IN_CLASS_STRATEGY.md`, redesign the public library interface and CLI around a coherent vocabulary, and replace the CLI framework.
Versioning: this is a breaking release. Ship as **v2.0.0**. npm reported 35 downloads in the last month, so a clean break costs almost nothing now and saves years of compatibility debt.

---

## Part A — Critical fixes

Each item lists the defect, the fix, the tests that prove it, and the acceptance gate. Order within Phase A matters: A1–A3 are foundation; everything else layers on them.

### A1. One reference engine (fixes false circular errors, duplicate walkers)

**Status: partially shipped in PR #1** — cycles-as-metadata, one shared walker (`findReferences`/`resolveJsonPointer`), and RFC 6901 escape handling landed. Remaining: canonical source URIs, iterative traversal, source ranges, fetch policy/caching.

**Defect.** Three independent `$ref` walkers exist (`src/validator.ts`, `src/ref-resolver.ts`, `src/summary-analyzer.ts`), and `validateRecursively` converts every cycle reported by `resolveAllReferences` into a validation error. A legal recursive schema (`Node` → `children` → `Node`) fails validation. Reproduced on 2026-08-13.

**Fix.**
- Build a single `DocumentGraph` module: nodes are `(canonical source URI, JSON pointer)`; edges are references. Built once per load, used by validation, analysis, summary, and partition.
- Cycle handling: a cycle is recorded as graph metadata (`cycles: RefCycle[]`), never as a diagnostic. Only *unresolvable* references produce diagnostics.
- RFC 6901 pointer resolution in exactly one place (the existing `resolveJsonPointer` is closest to correct; the validator's `resolveReference` mishandles `~0`/`~1` and must be deleted).
- Traversal is iterative with an explicit stack (no recursion-depth crashes on adversarial documents).
- **Depth contract:** v2 `maxDepth` replaces v1 `maxRefDepth` and bounds *external document fan-out only* (how many files/URLs may be loaded transitively). In-document traversal needs no depth bound because the graph is cycle-safe.

**Tests.** Legal recursion (self, mutual, cross-file), escaped pointers (`~0`, `~1`, URL-encoded), duplicate targets reached by multiple paths, external fragments (`file.yaml#/components/schemas/X`), URL-relative refs, missing targets, depth bombs.

**Gate.** Recursive `Node` schema validates clean. Zero cycle-related errors across the conformance corpus.

### A2. Context-aware fragment validation (fixes shape guessing)

**Status: shipped in PR #1** — `expectedFragmentKind` derives kinds from reference sites; `detectPartialType` is deleted; unknown sites skip with a warning instead of guessing; reference-wrapper AJV noise is filtered.

**Defect.** `validatePartialDocument` guesses what a referenced fragment is from its fields. An empty `{}` — a legal OpenAPI 3.1 Schema Object — is rejected as "unable to determine document type". Reproduced on 2026-08-13.

**Fix.**
- The expected type of a `$ref` target is determined by the *reference site*, not the target's shape. The DocumentGraph records the expected kind on every edge (a ref under `responses/200` expects a Response; under `schema` expects a Schema; etc.), derived from a per-version location table.
- Delete `detectPartialType` entirely. `validatePartialDocument` becomes `validateFragment(fragment, expectedKind, version)`.
- Where the expected kind is ambiguous (extensions, unknown keys), emit an *info* diagnostic, never an error.

**Tests.** Empty 3.1 schema, boolean 3.1 schema (`true`/`false`), `$ref` to a Response vs a Header with identical shapes, security scheme fragments, fragments reached through multiple sites with different expected kinds.

**Gate.** Zero fragment misclassifications across the corpus; the two reproduced false positives pass.

### A3. Diagnostics become a stable contract

**Defect.** `ValidationError` is used for both errors and warnings, has `data?: any`, no code, no severity, no source location. Results embed the whole spec (`ValidationResult.spec`).

**Fix.**
- Introduce the canonical `Diagnostic` as the only finding type (same contract as `BEST_IN_CLASS_STRATEGY.md`):

  ```ts
  interface Diagnostic {
    code: string;
    severity: "error" | "warning" | "info" | "hint";
    message: string;
    source: string;
    range: SourceRange;
    pointer: string;
    rule?: string;
    referenceTrace?: ReferenceStep[];
    fingerprint: string;
    helpUrl?: string;
    fixes?: Fix[];
  }
  ```
- Preserve YAML/JSON source ranges at load time (js-yaml exposes marks; JSON needs a location-aware parse) so `range` is real, not synthesized.
- `CheckResult` carries `diagnostics: Diagnostic[]` plus a computed `ok: boolean`; it does not embed the document (expose `document` separately from `load`).

**Gate.** Every diagnostic emitted anywhere has a stable `code` and a `pointer`; CLI, JSON output, and reports all render from this one type.

### A4. Report security and correctness

**Defect.** HTML reports interpolate spec-controlled strings without escaping (markup injection reproduced 2026-08-13). YAML reports are hand-concatenated strings with no quoting and silently ignore `includeMetadata`.

**Fix.**
- Escape all interpolated values in the HTML renderer (`escapeHtml` on path, message, schemaPath, metadata, title).
- Generate YAML reports with `js-yaml` `dump` from the same object the JSON report uses; delete the hand-rolled emitter.
- Renderers become pure functions from `CheckResult` → string; writing to disk happens only in the CLI layer.

**Tests.** Snapshot tests per format; a hostile-content test asserting `<script>` and `${}` payloads render inert; YAML round-trips through `yaml.load`.

**Gate.** Hostile corpus renders inert in every format.

### A5. Partition integrity

**Defect.** Partition can knowingly emit dangling refs (skipped internal-pointer and remote path items; unknown component types left in place with no `components` block), silently drops paths, and `writePartitionPlan` will write wherever `tag.name`/`relativePath` resolve.

**Fix.**
- Every skip/leave-in-place path becomes a `Diagnostic` attached to the plan (`plan.diagnostics`), and `partition` gains `onIncomplete: "error" | "warn"` (default `error`): incomplete plans fail instead of writing broken output.
- Support internal-pointer path items (`#/paths/...`, `#/components/pathItems/...`) — they resolve in the DocumentGraph anyway.
- `write` verifies every resolved destination stays under the output root (reject `..`, absolute paths, drive letters), writes to a temp dir, then renames atomically.
- After writing, recursively validate every emitted root as a hard postcondition (already partially tested; make it an internal invariant, not just a test).

**Gate.** Zero dangling local refs in any emitted plan; hostile tag names cannot escape the output root.

### A6. Delete global mutable state

**Defect.** The library mutates a module-level `log` singleton; `config.silent` on one instance silences every other consumer in the process. Bonus trap: `saveValidationReport` with no `output` "saves" by logging at INFO while the default level is WARN — it silently discards the report.

**Fix.**
- Events, not logs: the engine accepts an optional `onEvent(event)` sink in config. The CLI subscribes and renders progress; the library default is silence.
- Delete `log`/`Logger` from the public surface. Delete the silent-fallback behavior of `saveValidationReport` along with the function itself (see Part B).

**Gate.** Two `createVarsity` instances with different verbosity cannot affect each other (test).

### A7. Package size and shape

**Defect.** 29.1 MB unpacked; the `oas-types` schema corpus is bundled into both `dist/index.js` (14.5 MB) and `dist/cli.js` (14.6 MB) even though `oas-types` is a runtime dependency.

**Fix.**
- Add `--external oas-types` to both build scripts (the other four deps are already external). Expected result: dist shrinks from ~29 MB to well under 1 MB.
- Load per-version schemas lazily so validating a 3.1 document never parses the 2.0/3.0/3.2 corpus.
- Add a CI gate: `npm pack --dry-run` unpacked size budget (e.g. fail over 2 MB).

**Gate.** Unpacked size under budget; `node dist/cli.js --version` cold-start measurably improved and tracked.

### A8. Documentation truth

**Defect.** README says `parse(source)` accepts raw content (a bare string is actually stdin/URL/path). `OPENAPI_CLI_TOOLING_REVIEW.md` contradicts the shipped CLI (claims no stdin, unstable single-source JSON, forced-recursive multi-source).

**Fix.** Rewrite docs against the v2 surface only; delete or re-verify the tooling review with executable capability checks; add a docs test that runs every README CLI example against fixtures.

**Gate.** Every documented invocation runs in CI.

### A9. Version vocabulary

**Defect.** `OpenAPIVersion` conflates exact versions (`"3.0.3"`) with families (`"3.0"`); `getSupportedVersions` returns `string[]` that disagrees with the type; two `normalizeVersion` implementations exist.

**Fix.** Split into `OpenAPIVersion` (exact, as written in the document) and `OpenAPIFamily` (`"2.0" | "3.0" | "3.1" | "3.2"`); one `familyOf(version)` helper; `capabilities()` reports families.

---

## Part B — Library interface redesign

### Naming principles

1. **One verb per capability.** Variants are options, not new exports.
2. **One term per concept.** The thing users hand us is a *document* (matching the OpenAPI spec's own term "OpenAPI Description"/document). `Spec`, `Specification`, and `Document` never coexist again.
3. **No union return types.** A function returns one shape. Batch is a different function or a CLI concern.
4. **Names never lie.** `save` must save. `Error` must be an error. `parse` must not do network I/O.
5. **Export only the seam.** Internals (slug helpers, serializers, walkers, logger) are not API.

### Current-surface audit (what goes, and why)

| Current export | Verdict | Reason / replacement |
| --- | --- | --- |
| `validate` | **Replace** | Union return `ValidationResult \| ValidationResult[]` forces casts (our own code casts). → `check(source, opts): Promise<CheckResult>` |
| `validateOpenAPISpec` | Remove | Internal step exposed; redundant verb #2 |
| `validateWithReferences` | Remove | Same capability as `validate({recursive:true})` — two spellings of one feature. → `check(source, { refs: "follow" })` |
| `validateMultipleWithReferences` | Remove | "Multiple" variant of a synonym. → `checkAll(sources, opts): Promise<CheckRun>` |
| `validateRecursively` | Remove | Synonym #3 for the same thing |
| `validateMultipleRecursively` | Remove | Synonym #4 |
| `validateBasicStructure` | Remove | Returns `boolean`; subsumed by `check` |
| `validatePartialDocument` | Remove | Shape-guessing is the A2 defect; internal `validateFragment` replaces it |
| `parse` | **Rename** | Does file/URL/stdin I/O — that is *loading*, not parsing. → `load(source): Promise<Document>` |
| `parseOpenAPISpec` | Remove | Duplicate of `parse` |
| `generateValidationReport` | **Replace** | Verb pileup (`generate`/`save` × `Report`/`ValidationReport`). → `render(result, { format })` (pure) |
| `saveValidationReport` | Remove | With no `output` it logs at INFO below the default WARN level — a `save` that silently discards. Writing is the caller's/CLI's job |
| `generateReport`, `saveReport` | Remove | Same capability, third and fourth names |
| `generateSpecificationSummary` | **Replace** | Returns `{summary, detailedSummary, jsonSummary}` — three eager render formats as data. → `inspect(source): Promise<Inspection>`; rendering via `render` |
| `analyzeSpecification`, `generateDetailedSummary`, `generateJSONSummary` | Remove | Internal steps of the above |
| `analyzeDocumentReferences` / `analyzeReferences` | **Merge** | Two exports distinguishable only by reading source. → `inspect` result gains `refs` (graph stats, cycles) |
| `resolveReference`, `resolveAllReferences`, `findReferences` | Remove from root | Resolver internals; `findReferences` also exists twice internally with different behavior. Graph queries live on `Document` |
| `partitionByTags` / `partitionSpecByTags` | **Merge** | Overload disguised as two names; the `Spec` one only accepts `string`, unlike every other entry point. → `partition(source, opts): Promise<PartitionPlan>` |
| `writePartitionPlan` | Keep, move | → `plan.write(dir, opts)` with containment + atomicity (A5) |
| `describePartitionPlan` | Keep, move | → `plan.preview()` |
| `collectTagBuckets`, `slugify`, `slugifyPath` | Remove | Implementation details; `slugify` at the root of an OpenAPI tool is namespace pollution |
| `serialize`, `extensionFor`, `detectFormatFromPath` | Remove | Serializer internals |
| `log`, `Logger` | Remove | A6 |
| `createVarsity` | Keep, fix | Returned object has mutable `updateConfig` (`Object.assign` on shared state) and dead config (`reportFormats` is never read; `defaultVersion` only fabricates error results). New: frozen config, only meaningful fields |
| default export (singleton instance) | Remove | Hidden shared state; hurts tree-shaking; two ways to do everything |
| `ValidationError` | **Replace** | Used for warnings too — the name lies. → `Diagnostic` (A3) |
| `ValidationResult` | Replace | Embeds entire `spec`; `valid` + separate error/warning arrays. → `CheckResult` |
| `RecursiveValidationResult` | Remove | `partialValidations` leaks implementation vocabulary |
| `CLIResult` | Remove | CLI type in the library surface, used by nothing |
| `VarsityConfig` | Replace | Mixes validation defaults, dead reporting config, and logging. → `VarsityOptions { fetch?, cache?, onEvent?, profile? }` |
| `OpenAPIVersion` | Split | A9 |
| `DocumentInput` | Keep, document | Good design; fix the string-overloading docs (bare string ≠ raw content) |

Net effect: ~35 value exports become **6** (`load`, `check`, `checkAll`, `inspect`, `partition`, `render`) plus `createVarsity` and types. That is the deep-module shape: small interface, all the machinery behind it.

### Target surface (v2)

```ts
import {
  load,      // load(source, opts?) → Document          (I/O + parse + graph)
  check,     // check(source|Document, opts?) → CheckResult
  checkAll,  // checkAll(sources, opts?) → CheckRun      (never a union)
  inspect,   // inspect(source|Document) → Inspection    (stats + refs + circularReferences)
  partition, // partition(source|Document, opts?) → PartitionPlan
  render,    // render(CheckResult|Inspection, {format}) → string  (pure)
  createVarsity, // frozen, per-instance config; no globals
} from "varsity";

const doc = await load("openapi.yaml");
const result = await check(doc, { refs: "follow", examples: true, profile: "recommended" });
for (const d of result.diagnostics) console.log(d.code, d.severity, d.pointer, d.message);

const plan = await partition(doc, { by: "tag", format: "yaml" });
await plan.write("./partition", { clean: true });
```

Option vocabulary (replaces `strict`/`strictSchema`/`validateExamples`/`validateReferences`/`recursive`/`silent`):

```ts
interface CheckOptions {
  refs?: "none" | "internal" | "follow";   // was: validateReferences / recursive
  examples?: boolean;                        // was: validateExamples
  profile?: "spec" | "recommended" | "strict"; // was: strict (ad-hoc extra checks)
  maxDepth?: number;                         // replaces maxRefDepth; bounds external
                                             // document fan-out only (in-document
                                             // traversal is cycle-safe); default 25
  severityOverrides?: Record<string, Severity>; // replaces strictSchema's hidden downgrade logic
}
```

`silent` disappears: the engine emits nothing unless an `onEvent` sink is provided.

Naming note: `circularReferences` remains the public name for cycle metadata on `Inspection` and check results (continuity with v1); `cycles` is internal `DocumentGraph` vocabulary only.

---

## Part C — CLI redesign

### Current-command audit

| Current | Verdict | Reason |
| --- | --- | --- |
| `validate` | Rename → `check` | Aligns with library verb; "validate" undersells rules/examples/refs |
| `parse` | Fold into `inspect` | Prints four metadata lines; not a command |
| `summary` | Fold into `inspect` | Same information domain |
| `analyze` | Fold into `inspect --refs` | Same information domain |
| `report` | Fold into `check --format/--output` | It is `validate` with a renderer; duplicating validation flags across two commands guarantees drift |
| `info` | Fold into `inspect --capabilities` (or `--help`) | Version trivia as a command |
| `partition` | Keep | The flagship |
| `split` (hidden) | Delete | Its error says "renamed to partition" while the README says "reserved for future" — contradictory messaging |

### Flag defects to fix

- `--json` on some commands vs `--format` on others → one global `--format <pretty|json|yaml|md|html|sarif|junit>`.
- Cryptic short flags `-s -e -r` (`--references` reads as "show references") → drop most short flags; keep `-o`, `-f`, `-v`, `-q`.
- `--max-depth` defaults to 10 on `check` and 25 on `partition` → one default (25).
- Primary human output goes to stderr for `validate`/`parse`/`summary` but stdout for `summary --detailed` and `partition --dry-run` → rule: *the result* goes to stdout, *progress/diagnostics about the run* go to stderr, always.
- Per-command `--no-progress`/`--no-colors` → global `--quiet`, `--no-color` (and honor `NO_COLOR`/`FORCE_COLOR`).
- Exit codes are binary → `0` clean, `1` findings at/above `--fail-on` (default `error`), `2` usage/config error, `3` internal/I/O error.
- No config file → `--config varsity.yaml` + auto-discovery, with `varsity config check`.

### Target command tree

```text
varsity check <sources...>   [--refs none|internal|follow] [--examples]
                             [--profile spec|recommended|strict]
                             [--format pretty|json|yaml|md|html|sarif|junit]
                             [--output <file>] [--fail-on error|warning]
varsity inspect <source>     [--refs] [--capabilities] [--format pretty|json|yaml]
varsity partition <source>   [--by tag] [--out <dir>] [--format json|yaml]
                             [--untagged include|skip] [--dry-run] [--clean]
varsity completion [install] # from the framework, below
```

### CLI framework replacement

Commander's cost is visible in `src/cli.ts` today: every action handler types its options as `any`, option values arrive as unvalidated strings (hand-rolled `parsePositiveInteger`), and there is no completion story.

| Criterion | Commander (current) | Clipanion 3 | **Stricli (recommended)** |
| --- | --- | --- | --- |
| Typed flags/args | No (`options: any`) | Yes (class fields, typanion validators) | Yes (inference from one spec through the handler) |
| Runtime deps | 1 | 0 | 0 |
| Shell completion | No | No first-class | First-class, incl. dynamic suggestions (`@stricli/auto-complete`) |
| Testability | Global `process` access | Context object | Context object designed for DI — all system access injected |
| Code splitting | No | Partial | Command impls load lazily; `--help` imports nothing |
| Battle testing | Very broad | Yarn | Bloomberg internal CLIs; public since 2024 |

**Recommendation: Stricli** (`@stricli/core`). The DI context directly serves the A6 fix (no `process` globals in handlers → trivially testable commands), typed flags eliminate the `any` handlers, enum flags give us `--format`/`--refs`/`--fail-on` validation for free, and built-in completion is a competitive feature Spectral lacks. Risk: younger ecosystem and bash-only completion install today — acceptable; Clipanion 3 is the fallback if we hit a wall (v4 is still RC).

Migration: build the v2 tree in Stricli from scratch (do not port command-by-command); keep `varsity validate` as a hidden alias for `check` for one minor with a deprecation notice.

---

## Part D — Execution sequence

| Step | Work | Gate |
| --- | --- | --- |
| 1 | Conformance + adversarial corpus (legal recursion, empty/boolean 3.1 schemas, escaped pointers, hostile strings, path-escape names) | Corpus red on v1 for every known defect |
| 2 | DocumentGraph + context-aware fragment validation (A1, A2) | Corpus green; old walkers deleted |
| 3 | Diagnostic contract + secure renderers (A3, A4) | Injection tests green; snapshots stable |
| 4 | Event sink; delete logger from API (A6) | Isolation test green |
| 5 | New library surface, `index.ts` rewritten to 6 verbs (Part B) | `tsc` + docs tests green; API-report snapshot committed |
| 6 | Partition integrity + `plan.write` containment (A5) | Zero dangling refs; escape tests green |
| 7 | Stricli CLI, new command tree, exit codes, `--format` outputs (Part C) | CLI e2e suite green incl. SARIF/JUnit schema checks |
| 8 | Build externalizes `oas-types`; size budget in CI (A7) | Pack ≤ 2 MB unpacked |
| 9 | README/API docs rewritten; tooling review re-verified or deleted (A8) | Every documented example runs in CI |
| 10 | Release v2.0.0 with migration guide (v1→v2 name table from Part B) | Trusted-publishing pipeline green |

Dependencies: steps 2–4 are sequential. Steps 5 and 6 both build on the diagnostic contract from step 3 and can proceed in parallel with each other; step 7 depends on steps 5 and 6; step 8 is independent and can land at any time; steps 9–10 close out the release.

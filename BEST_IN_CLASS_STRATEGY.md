# Varsity: Best-in-Class Strategy

Research date: 2026-08-13

## Executive assessment

Varsity is a promising OpenAPI utility, not yet a trustworthy validator or a credible replacement for Spectral, Vacuum, Scalar, or Redocly.

Its strongest product wedge is `partition`: deriving minimal, per-tag API descriptions and rewriting their transitive references. Its largest weakness is the semantic foundation beneath validation and transformation. The current implementation guesses the type of referenced fragments, treats legal reference cycles as validation failures, duplicates reference logic, and does not preserve source locations. Adding more commands before replacing that foundation would multiply correctness bugs.

The winning product is not “every competitor command in one CLI.” It is an **OpenAPI compiler**:

1. Load any OpenAPI description into one canonical, source-aware document graph.
2. Check it with schema validation, governance rules, examples, references, and compatibility policy.
3. Transform it safely and deterministically.
4. Explain every diagnostic precisely and offer safe fixes.
5. Expose the exact same behavior through the CLI, TypeScript library, language server, and CI integrations.

If Varsity becomes the most correct and explainable OpenAPI compiler, it can support linting, partitioning, bundling, splitting, overlays, diffs, and editor tooling through a small set of deep modules.

## Observed baseline

### What is good

- The repository is compact and approachable.
- The package has a typed TypeScript interface and a conventional Node executable.
- Input loading supports files, URLs, explicit content, objects, and stdin.
- The CLI keeps machine output on stdout and diagnostics on stderr.
- OpenAPI 2.0, 3.0, 3.1, and 3.2 schemas are available through `oas-types`.
- `partition` has useful end-to-end tests for tag bucketing, transitive component inclusion, reference rewriting, and output files.
- The release uses npm Trusted Publishing and provenance.
- The clean verification pipeline passes: TypeScript checking, 36 tests, build, and `npm pack --dry-run`.

### Release-blocking trust gaps

1. **Legal recursive schemas fail recursive validation.** `resolveAllReferences` identifies active cycles, then `validateRecursively` turns every circular reference into an error. Recursive schemas are normal and legal; a cycle is graph topology, not invalidity.
2. **Legal OpenAPI 3.1 Schema Objects fail recursive validation.** `validatePartialDocument` guesses an object type from fields such as `type`, `description`, and `content`. An empty Schema Object `{}` is legal in OpenAPI 3.1 but is rejected because it cannot be guessed.
3. **Referenced fragments are validated out of context.** A `$ref` target's legal type comes from the reference site, not from the target's shape. Shape guessing can misclassify security schemes, examples, headers, and schemas.
4. **HTML reports allow markup injection.** Titles, paths, messages, schema paths, and metadata are interpolated without HTML escaping. Opening a report generated from an untrusted description can execute injected markup.
5. **YAML reports are hand-built.** Values are not safely quoted and metadata is ignored even when requested. The project already depends on `js-yaml`.
6. **Partition can knowingly emit dangling references.** Unsupported internal and remote Path Item references are skipped; some unknown internal component references are left in output even though the emitted root has no `components` block.
7. **Partition writes are not contained defensively.** `writePartitionPlan` trusts `tag.name` and `relativePath`; the exported library function should verify every resolved destination remains under the output root.
8. **Library logging is global mutable state.** A silent configured instance changes the shared logger and does not restore it, so one caller can alter unrelated callers.
9. **The public interface exports implementation details.** Resolver internals, serializers, validators, analyzers, loggers, and partition internals are all exported from the root. This creates a large compatibility burden and shallowens the package interface.
10. **The published artifact is oversized.** `npm pack --dry-run` reports 29.1 MB unpacked: approximately 14.5 MB each for `dist/index.js` and `dist/cli.js`. The OpenAPI schema corpus is bundled into both entrypoints.
11. **The existing tooling review is stale against the same checkout.** It says stdin and stable single-source JSON are unsupported and multi-source validation is always recursive; the current CLI implements all three correctly. Competitive reviews need executable capability checks or explicit version pins.
12. **The documentation overstates string input.** The API reference says `parse(source)` accepts raw content, but a plain string is interpreted as stdin, URL, or path. Raw content requires `{ kind: "content", content }`.

## Competitive bar

| Tool | Current strength Varsity must respect | First-party evidence |
| --- | --- | --- |
| Spectral | Mature configurable rulesets, custom functions, JSONPath targeting, reusable JavaScript rulesets, editor and CI adoption | [Spectral documentation](https://docs.stoplight.io/docs/spectral/) |
| Vacuum | Spectral-compatible rulesets, high-performance Go implementation, LSP, dashboard, reports, bundling, overlays, change detection, OpenAPI/AsyncAPI/JSON Schema coverage | [Vacuum commands](https://quobix.com/vacuum/commands/), [Vacuum rulesets](https://quobix.com/vacuum/rulesets/), [Vacuum language server](https://quobix.com/vacuum/commands/language-server/) |
| Redocly CLI | Broad lifecycle workflow: lint, bundle, dereference, split, join, score, docs, Arazzo tests, drift, proxy, spec generation, completion, and platform publishing | [Redocly commands](https://redocly.com/docs/cli/commands), [Redocly lint](https://redocly.com/docs/cli/commands/lint), [Redocly bundle](https://redocly.com/docs/cli/commands/bundle), [Redocly split](https://redocly.com/docs/cli/commands/split) |
| Scalar CLI | Broad local document workflow plus registry integration: validation, Spectral linting, bundling, docs rendering, and cloud publishing | [Scalar CLI guide](https://guides.scalar.com/tools/cli/getting-started), [Scalar Registry CLI](https://scalar.com/products/registry/cli), [Scalar rules](https://scalar.com/products/registry/rules) |

Adoption is the real gap. npm's public download API reported 35 Varsity downloads in the preceding month, compared with 5,894,616 for `@stoplight/spectral-cli`, 8,197,628 for `@redocly/cli`, and 109,027 for `@scalar/cli`. These counts are not direct measures of quality, but they show that compatibility and migration paths matter more than a novel command list.

Sources:

- [Varsity npm downloads](https://api.npmjs.org/downloads/point/last-month/varsity)
- [Spectral CLI npm downloads](https://api.npmjs.org/downloads/point/last-month/@stoplight%2Fspectral-cli)
- [Redocly CLI npm downloads](https://api.npmjs.org/downloads/point/last-month/@redocly%2Fcli)
- [Scalar CLI npm downloads](https://api.npmjs.org/downloads/point/last-month/@scalar%2Fcli)

## Product thesis

### Positioning

> Varsity is the source-aware OpenAPI compiler: check, explain, transform, and compare API descriptions without losing correctness or provenance.

Do not position it as another schema validator. Schema validation is table stakes. The differentiators should be:

- **Correctness:** one context-aware document graph, complete reference semantics, conformance suites, and differential testing.
- **Explainability:** every result has a stable code, exact source range, reference trace, rationale, documentation URL, and suggested fix.
- **Safe transformation:** transformations preserve semantics, provenance, and deterministic output.
- **Migration:** Spectral ruleset compatibility and familiar CI formats make adoption incremental.
- **Architecture workflows:** partition APIs by ownership or audience, show cross-partition dependencies, and prove every generated description remains valid.

### What not to build yet

Do not immediately build an API docs renderer, hosted registry, SDK generator, mock server, traffic proxy, or general plugin marketplace. Scalar, Redocly, Speakeasy, Prism, and OpenAPI Generator have substantial leads there. First make Varsity the engine those workflows would want to embed.

## Target module design

The external interface should become smaller while the implementation becomes much deeper:

```ts
const varsity = createVarsity({
  configFile: "varsity.yaml",
});

const project = await varsity.load("openapi.yaml");

const result = await project.check();
const transformed = await project.transform([
  { use: "partition", by: "tag" },
]);
const changes = await project.compare("origin/main:openapi.yaml");
```

Four deep modules are enough:

1. **Loader** — creates an immutable document graph with canonical source identities, parsed syntax trees, source ranges, dialects, fetch policy, caching, and reference edges.
2. **Checker** — runs structural validation, rules, example checks, compatibility checks, and suppressions against the graph, returning normalized diagnostics.
3. **Transformer** — applies bundle, dereference, split, partition, join, overlay, upgrade, format, and safe fixes while maintaining provenance.
4. **Comparator** — computes semantic changes, breaking changes, changelogs, fingerprints, and changed-area policy.

The CLI, library, LSP, reports, and CI adapters should call these interfaces. They should not each implement loading, traversal, or diagnostics.

### Diagnostic contract

Make diagnostics a stable public interface:

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

This single model should power terminal codeframes, JSON, YAML, SARIF, JUnit, Checkstyle, GitHub Actions annotations, HTML, Markdown, editor diagnostics, baselines, and changed-area checks.

## Sequenced roadmap

### Phase 0: Earn trust

Ship no major new feature until this is complete.

- Replace all duplicate reference walkers and partial-type guessing with one context-aware document graph.
- Distinguish legal cycles from unresolvable references; traverse cycles safely without treating them as failures.
- Resolve RFC 6901 pointers correctly and preserve the expected target kind from each OpenAPI reference site.
- Add canonical URI resolution for files and HTTP(S), authenticated fetch options, timeouts, redirect policy, caching, and offline mode.
- Preserve YAML/JSON source ranges and reference traces.
- Normalize all diagnostics into the stable contract above.
- Escape HTML, use real YAML serialization, and add report snapshot/security tests.
- Remove global logger mutation; inject a logger or event sink.
- Add output path containment and atomic writes for every file-generating transform.
- Establish conformance fixtures for every supported OpenAPI version and JSON Schema dialect.
- Add legal recursion, empty 3.1 schema, escaped pointer, external fragment, mixed YAML/JSON, URL-relative reference, duplicate target, and hostile content tests.
- Add differential tests against at least Redocly and Vacuum for a pinned corpus; investigate every disagreement.
- Reduce the package to intentional subpath exports and avoid bundling the schema corpus twice.
- Set measurable release gates: zero known false positives in the conformance corpus, zero dangling output refs, deterministic output, and bounded performance regressions.

### Phase 1: Replace Spectral for daily governance

- Add `varsity check` as the default workflow: structural validation, references, examples, and governance in one command.
- Add `varsity.yaml` with explicit schema and `varsity config check`.
- Support Spectral-compatible rulesets first; do not force teams to rewrite governance policy.
- Ship excellent built-in profiles: specification correctness, documentation quality, security, SDK readiness, and AI-tool readiness.
- Add severity overrides, path/file scopes, inline suppression, ignore files, generated baselines, and expiring suppressions.
- Add deterministic safe fixes and `--fix-dry-run`.
- Add codeframes and CI-native SARIF, JUnit, Checkstyle, GitHub Actions, and GitLab Code Quality outputs.
- Add changed-area checking and stable diagnostic fingerprints.
- Build an LSP on the same Checker interface, with incremental parsing and fixes.
- Publish a documented compatibility matrix showing which Spectral ruleset features are supported.

### Phase 2: Become the best OpenAPI transformer

- Build `bundle`, `dereference`, `split`, `join`, `format`, `overlay apply`, and version `upgrade` on the shared Transformer.
- Make every transform deterministic, source-aware, and reversible where practical.
- Emit source maps or a provenance manifest so diagnostics in generated files point back to authored files.
- Promote `partition` into the flagship workflow:
  - partition by tag, path, extension, ownership map, audience, or policy expression;
  - report cross-partition dependencies and shared components;
  - support configurable duplication versus shared packages;
  - emit a machine-readable partition manifest;
  - validate every generated root recursively before committing output;
  - support dry-run diffs and atomic directory replacement.
- Guarantee round trips such as `split -> bundle` preserve semantic equivalence.

### Phase 3: Own API change management

- Add semantic `diff`, breaking-change detection, and changelog generation.
- Compare files, URLs, stdin, directories, and git revisions.
- Model consumer and provider compatibility separately.
- Let teams define lifecycle policy for beta, stable, deprecated, and sunset operations.
- Combine diff and lint so new violations fail while grandfathered debt remains visible.
- Generate OpenAPI Overlays from selected changes.
- Explain why a change is breaking and suggest compatible alternatives.

### Phase 4: Ecosystem leverage

- Publish a stable engine package, CLI package, LSP package, and CI actions without duplicating the implementation.
- Offer documented adapters for custom loaders, rule functions, reporters, and transforms only where at least two real implementations require a seam.
- Provide a migration command for Spectral and Redocly configuration.
- Publish repeatable benchmarks for startup, linting, resolution, transformation, and memory on small and very large descriptions.
- Add a self-contained native executable only if measurements show Node startup or distribution is a material adoption barrier.
- Integrate with docs, mocks, SDK generators, and registries before trying to replace all of them.

## Scorecard

Track the product against objective gates rather than command count:

| Dimension | Initial target |
| --- | --- |
| Correctness | Zero known false positives/negatives on the maintained conformance corpus |
| Transform safety | Every emitted root recursively validates; zero dangling local references |
| Diagnostics | 100% include stable code, source, range, pointer, and help |
| Compatibility | High-pass-rate Spectral ruleset compatibility suite with documented exceptions |
| Performance | Published benchmark suite and enforced regression budget |
| Package | One implementation copy; intentional exports; materially smaller install |
| CI/editor | Same diagnostic fingerprints across CLI, SARIF, GitHub, and LSP |
| Reproducibility | Deterministic output with snapshot tests across platforms |
| Adoption | Migration docs, starter configs, integrations, and tracked successful migrations |

## Immediate execution order

1. Freeze feature work.
2. Write the conformance and adversarial test corpus.
3. Design and implement the source-aware document graph.
4. Migrate validation and `partition` onto that graph.
5. Introduce normalized diagnostics and secure reporters.
6. Tighten and shrink the public/package interface.
7. Ship `check`, configuration, Spectral compatibility, and CI formats.
8. Turn `partition` into the differentiated architecture workflow.
9. Add the general transform suite.
10. Add semantic diff and change policy.

The shortest path to “better than everything” is to be narrower and substantially more trustworthy first. Breadth should emerge from one excellent compiler core, not from accumulating unrelated commands.

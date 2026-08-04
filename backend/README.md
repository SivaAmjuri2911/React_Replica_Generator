# replica-generator

Generates a new IDE-based coding assessment scenario — `prefilled_code`,
`solution_code`, `testcase`, and an `IDE_BASED_CODING` JSON — from a base
scenario (e.g. `Bid`) and a declarative transformation spec. Encodes every
rule from `GENERATION_RULES.md` as enforced, tested code instead of a
document someone has to remember to follow.

## Architecture

```
src/
  domain/           Pure data models + the error hierarchy. No I/O, no framework code.
    models/          ScenarioSpec, TestCase, GeneratedProject, TextReplacement/ColorSwap/FileRename
    errors/          GenerationError and its typed subclasses
  shared/            Result<T, E> — explicit success/failure, used instead of throwing for expected failures
  logging/           Logger interface + ConsoleLogger implementation
  services/          One interface + one implementation per infrastructure concern
    fileSystem/       All disk access goes through this — nothing else touches node:fs directly
    idGenerator/       UUID generation
    testRunner/         npm install / npm test, parses Vitest's summary output
    textTransformation/ Applies ordered literal replacements to file contents
    testCaseDerivation/ Parses :::PREFIX_test_N:::desc:::weight::: markers into TestCase[]
  rulesEngine/        GenerationRule interface + RulesRegistry + one class per invariant from
                       GENERATION_RULES.md (package alignment, testcase immutability, color
                       completeness, no placeholder links, JSON/test-file sync)
  pipeline/            PipelineStep interface + GenerationPipeline orchestrator + one step per
                       stage of the process (scaffold → transform → validate → promote →
                       derive → build JSON → enforce rules → final validation)
  config/              CompositionRoot (dependency wiring) + ScenarioSpecLoader (reads a spec
                       JSON file, resolves its relative paths)
  authoring/           ScenarioSpecAuthoringWorkflow — the `analyze` command's orchestrator
  cli/                 Presentation layer — a thin Commander.js wrapper around the pipeline
```

**Dependency direction**: `cli` → `config` → `pipeline` → `rulesEngine`/`services` → `domain`/`shared`.
Nothing in `domain` or `shared` imports from any other layer. Every service and rule is defined
as an interface first; concrete implementations are swapped in only at `CompositionRoot` — so any
of them can be replaced with a test fake without touching business logic (see `tests/unit/fakes/`).

## Adding something new

- **A new rule** (a new invariant to enforce): implement `GenerationRule`, register it in
  `CompositionRoot.buildGenerationPipeline()`. No existing rule or step changes.
- **A new pipeline stage**: implement `PipelineStep`, add it to the `steps` array in
  `CompositionRoot`. Steps run strictly in array order.
- **A different test runner or file system** (e.g. testing with an in-memory fake): implement the
  relevant service interface, pass it into the constructors that need it instead of the concrete
  class — nothing else needs to know.

## What's mechanical vs. what an LLM drafts

`GenerationPipeline` (the `generate` command) contains **no LLM call** — it is 100% deterministic,
the same input spec always produces the same output, and every rule in `rulesEngine/` can enforce
it without worrying about run-to-run variance. Authoring the `ScenarioSpec` itself is a separate,
upstream step, and it's the one place this codebase does call an LLM: `analyzeProjectCommand`
(`analyze`) → `ScenarioSpecAuthoringWorkflow` → `ClaudeScenarioSpecGenerationService`, which reads
an arbitrary base `solution_code`'s source files and asks Claude to draft the spec, so a project
this tool has never seen before doesn't require a human to hand-write one. The draft is written to
disk as an ordinary `spec.json` — `generate` cannot tell it apart from a hand-authored one, and you
should review a draft (especially the color palette and the manually-authored file contents) before
trusting it, the same way you'd review a human-authored spec before running `generate` against it.

A `ScenarioSpec` has three ways to produce a file, and choosing the right one per file matters:

1. **`transformableRelativePaths`** — the file's *structure* is identical to the base scenario;
   only specific tokens change (entity names, field names, routes, colors). Handled by ordered,
   literal find/replace (`textReplacements` + `colorSwaps`). Safe when every occurrence of a token
   means the same thing throughout the file.
2. **`manuallyAuthoredRelativePaths`** — the file needs genuinely new content (e.g. `sampleData.js`'s
   actual records), or contains a word/color used with *two different meanings* in the same file
   (see "the response problem" below) where a blind replace would silently corrupt the file. These
   files are pre-authored into `paths.stagingDir` and copied verbatim.
3. **Everything else** — copied byte-for-byte from the base, untouched.

### The "response" problem — why this distinction exists

While building the `ticket-management` example spec, `Bid`'s field `response` (a vote count) and
the generic word "response" (as in `await response.json()`, "API Response Format") turned out to
be the *same literal word* used for two unrelated meanings in the same files. A global
`"response" → "responses"` replacement would have corrupted `response.json()` into
`responses.json()`. Same issue with color `#3b82f6`: it means "accent button color" in the CSS
files but "in-progress status badge" in the detail page and README — two different target colors
for the same source hex, depending on file.

The fix wasn't a smarter regex — it was recognizing that **files with this kind of ambiguity
don't belong in the mechanical replacement path at all**. `README.md`, the test file, and the
detail-page component (all three mix the ambiguous word/color with unrelated uses) are staged as
pre-authored content instead. `ColorPaletteCompletenessRule` and the file categorization together
make this an explicit, deliberate choice per file — not something silently gotten wrong.

## Usage — CLI

```bash
npm install
npm run build

npm run generate -- --spec scenarios/ticket-management/spec.json --log-level debug
```

### Drafting a spec for a project you've never generated from before

**CLI**: requires an Anthropic API credential resolvable from the environment — set
`ANTHROPIC_API_KEY`, or `ANTHROPIC_AUTH_TOKEN`, or run `ant auth login` first. `analyze` fails fast
with a clear error if none is found.

```bash
npm run analyze -- \
  --description "A helpdesk ticket management app: agents triage and resolve customer tickets" \
  --base-prefilled-code ../../Bid \
  --base-solution-code ../../Bid_Solution \
  --base-testcase ../../Bid_tests \
  --scenario-slug helpdesk-tickets

# Review the draft, then generate from it exactly like a hand-authored spec:
npm run generate -- --spec scenarios/helpdesk-tickets/spec.json --log-level debug
```

**Web UI / `/api/analyses`**: the operator picks a provider (Anthropic, OpenAI, or OpenRouter),
pastes their own API key for it, and picks a model per request instead of relying on server-side env
resolution. Pasting/editing the key auto-loads that provider's model list (debounced, see
`AnalyzeForm.tsx`) — there's no separate "load models" action. `ProviderRoutingScenarioSpecGenerationService`
dispatches `request.provider` to `ClaudeScenarioSpecGenerationService`, `OpenAiScenarioSpecGenerationService`,
or `OpenRouterScenarioSpecGenerationService` (OpenRouter is called via the `openai` SDK pointed at its
OpenAI-compatible endpoint, rather than a fourth bespoke HTTP client), each of which builds a fresh
SDK client from the request's key when one is supplied — all three implement the same
`ScenarioSpecGenerationService` interface and are held to the exact same prompt/schema contract
(`scenarioSpecDraftContract.ts`), so which provider drafted a spec never changes what a valid draft
looks like. Not every model OpenRouter routes to honors structured JSON output the same way Claude's
and OpenAI's own APIs do — an incompatible model surfaces as a clear parse/schema error rather than a
silent bad draft. The key is never logged or persisted server-side; it only lives in the request body
and the browser's in-memory form state for that session. `POST /api/models` takes the same
`{ provider, apiKey }` shape to list that account's available models for the UI's picker.

Only `prefilled_code` and `solution_code` are uploaded — `testcase` (the pnpm/ccbp-jest-reporter
harness) is structurally identical across every scenario per GENERATION_RULES.md (nothing in it is
ever authored directly; only package.json's name field and the promoted test file change, both
applied downstream by `GenerationPipeline`). So it's a fixed server-side template, read from
`DEFAULT_BASE_TESTCASE` (env var, defaults to the sibling `Bid_tests` folder) rather than
re-uploaded on every run — see `InMemoryAnalysisJobService`.

`analyze` never touches `testcase` or the base folders — it only reads `solution_code`'s source
files and writes `scenarios/<slug>/spec.json` plus its staged manually-authored file contents.
`generate` still validates, runs, and enforces every rule exactly as it does for any other spec —
a draft that violates a rule (e.g. an incomplete color palette) fails `generate` the same way a
mistake in a hand-authored spec would, it's just caught downstream rather than at authoring time.

## Usage — Web API + UI

This backend also exposes an HTTP API (`src/api/`) wrapping the exact same `GenerationPipeline`
the CLI uses — same steps, same rules, nothing duplicated. A separate React frontend consumes it:
see [`../frontend`](../frontend), a sibling project, not nested here.
The two are deliberately separate folders/repos — the frontend only ever talks to this backend
over HTTP, never imports its code, so either can run, deploy, or change independently.

```bash
npm run serve          # starts the API on http://localhost:4000
```

Then, in `../frontend`: `npm install && npm run dev`, and open the printed URL.

### API surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/scenarios` | Lists available specs found under `scenarios/*/spec.json` |
| POST | `/api/generations` | Body `{ specPath }` — starts a generation in the background, returns `{ jobId }` |
| GET | `/api/generations/:jobId` | Current status, captured logs, and result/failure of that job |
| POST | `/api/models` | Body `{ provider, apiKey }` (`provider`: `"anthropic"` \| `"openai"`, defaults to `"anthropic"`) — lists the models that key can call, for the UI's model picker |
| POST | `/api/analyses` | Multipart: `prefilledCode`, `solutionCode` zips + `scenarioSlug`, `description`, `apiKey`, optional `provider`/`modelId` — starts a spec draft in the background, returns `{ jobId }` |
| GET | `/api/analyses/:jobId` | Current status, captured logs, and drafted spec/failure of that job |

`/api/analyses` never requires a `testcase` upload — see "Drafting a spec" below for why.

Jobs run in-memory, in-process (`src/api/services/InMemoryGenerationJobService.ts`) — adequate for
a single-operator tool; would need a persistent/queued store to survive a server restart or support
concurrent operators, which is out of scope until that's an actual requirement.

A spec file (see `scenarios/ticket-management/spec.json` for a complete example) declares:
paths to the base `prefilled_code`/`solution_code`/`testcase` and to a staging directory, the
ordered text replacements, file renames, color swaps, and which relative paths are
mechanically transformed vs. staged verbatim.

On success, the pipeline has: scaffolded `prefilled_code`, transformed `solution_code`, installed
its dependencies and run its tests until 100% passing, promoted the validated test file into
`testcase` untouched otherwise, derived `test_cases[]` from that file (never hand-written), built
the `IDE_BASED_CODING` JSON, and re-validated everything against every registered rule — twice.

On failure, the pipeline stops at the first step that fails and reports exactly which rule or
validation broke, with enough context (file paths, diffs, raw test output) to fix the spec and
re-run — nothing partially-generated is ever reported as a success.

## Testing

```bash
npm test          # unit tests (tests/unit/**) — fast, no disk/network access, uses fakes
npm run typecheck
npm run lint
```

Unit tests use `InMemoryFileSystemService` (`tests/unit/fakes/`) rather than the real disk, so
rules and steps are tested in isolation from actual file I/O. The full pipeline itself is exercised
end-to-end by actually running `npm run generate` against the `ticket-management` example spec —
that's an integration-level check, not a unit test, and deliberately touches real disk and runs
real `npm test` in the generated project, because that's the only way to know the *generated
project* is actually correct, not just that the generator's internal logic is.

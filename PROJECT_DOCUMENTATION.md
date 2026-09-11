# React_Replica_Generator — Project Documentation

## 1. Overview

React_Replica_Generator is an AI-powered application that helps teams convert an existing React project into a new scenario-based replica with minimal manual effort.

Instead of manually rewriting code, reworking test cases, and rebuilding the structure of a new scenario by hand, the application:

- analyzes the base React project,
- drafts a transformation specification,
- categorizes files into transformable, manually authored, and unchanged,
- generates a new scenario output,
- validates the generated project,
- and produces the final artifacts needed for a replica scenario.

This project is designed for use in test/assessment-style scenario generation, where the goal is to create a new project from an existing base project while preserving architecture, behavior, and quality rules.

---

## 2. What this application does

This application is built to solve a common problem:

> Creating a new scenario or replica from an existing React app usually requires a lot of manual coding, path rewriting, file renaming, color updates, and test adjustments.

React_Replica_Generator automates most of that work.

### Core purpose

The application takes a base React project and produces a new version of it for a different scenario, including:

- prefilled code,
- solution code,
- testcase files,
- IDE-based coding JSON metadata,
- generated final project artifacts.

### Main outcomes of the application

After the workflow runs, the system creates a new scenario that is ready for:

- review,
- test execution,
- build validation,
- and further use as a generated replica project.

---

## 3. Who this application is for

This application is useful for:

- learning platforms,
- coding assessment builders,
- internal engineering teams,
- scenario-based testing systems,
- automation teams that want to generate new project variants quickly.

It is especially useful when a team wants to create multiple scenario-based versions of a React app without rewriting everything from scratch.

---

## 4. High-level workflow

The project follows a two-part workflow:

### Part A — AI-assisted authoring

The system reads the base project files and uses an LLM provider (such as Anthropic, OpenAI, or OpenRouter) to draft a transformation spec.

This includes:

- scenario name,
- test prefix,
- renames,
- replacements,
- color swaps,
- transformable file list,
- manually authored file list.

### Part B — Deterministic generation pipeline

Once the spec is reviewed, the application runs a deterministic generation engine that applies the spec and produces the final scenario artifacts.

This part does not depend on a live AI call anymore. It uses code-driven transformations, validation, and test execution.

---

## 5. End-to-end process step by step

### Step 1: Upload base project files

The user uploads:

- prefilled code,
- solution code,
- optional testcase,
- scenario description,
- provider/model selection.

The frontend sends these to the backend service.

### Step 2: Extract uploaded archives

The backend extracts uploaded zip files into working folders.

It prepares:

- prefilled code folder,
- solution code folder,
- testcase folder (if provided),
- staging area for manually authored files.

If testcase is not uploaded, the system uses the default built-in testcase template.

### Step 3: Start analysis job

The application starts a background analysis job. This job tracks:

- current phase,
- logs,
- errors,
- generated draft status.

### Step 4: Generate scenario spec draft

The backend calls the configured AI provider to analyze the source files and create a transformation spec.

The spec includes all required information for the new scenario, such as:

- scenario metadata,
- routes to update,
- file renames,
- text replacements,
- color changes,
- file category decisions.

### Step 5: Use phased drafting for large projects

For large projects, the application uses phased drafting instead of one giant request.

It performs:

1. structure drafting,
2. manually authored file drafting in batches.

This lowers the chance of truncation or output loss for large source codebases.

### Step 6: Review the draft

The draft is saved as a scenario spec file (`spec.json`) and can be reviewed by a human before generation.

This review step is important because generated specs may need adjustment, especially for:

- manually authored files,
- color palette details,
- routes,
- screenshots/asset-related content,
- text replacements.

### Step 7: Generate the replica

Once approved, the application runs the deterministic generation pipeline.

This phase:

- applies replacements,
- renames files,
- transforms content,
- preserves unchanged files,
- writes the generated project structure.

### Step 8: Validate generated output

The system validates the generated project using rules and checks such as:

- route consistency,
- file path accuracy,
- test file correctness,
- color completeness,
- JSON consistency,
- syntax health,
- test pass status.

### Step 9: Produce final artifacts

The application generates the final output artifacts, including:

- prefilled code,
- solution code,
- testcase content,
- IDE-based coding JSON.

---

## 6. Key features of the project

### 6.1 AI-powered scenario drafting

The app can read a base project and produce a transformation spec automatically using an LLM.

### 6.2 Phased drafting

Large projects are drafted in phases instead of one large request, improving reliability and reducing failure risk.

### 6.3 Deterministic generation

After a spec is approved, the generation process is code-driven and repeatable.

### 6.4 File classification system

The system separates files into:

- transformable files,
- manually authored files,
- unchanged files.

This is one of the most important design decisions in the project.

### 6.5 Rule-driven validation

The generation pipeline enforces multiple rules to make sure the generated project is not just structurally similar but also valid and testable.

### 6.6 Multi-provider LLM support

The app can work with multiple providers, including OpenRouter, allowing flexibility in deployment and model selection.

### 6.7 Background job monitoring

Users can see logs and status while analysis or generation is running.

### 6.8 Separate frontend and backend

The frontend is intentionally separate from the backend, making the system modular and deployable independently.

### 6.9 Evaluation framework / Evals in this project

This project already includes an evaluation layer, even though it is implemented as a rules engine and pipeline validation system rather than a separate "evals" package.

#### Existing implemented evals

These are already enforced in the backend as generation rules and pipeline checks:

1. PackageJsonAlignmentRule
   - Ensures `prefilled_code`, `solution_code`, and `testcase` all have the same package name.
   - This prevents mismatched project identifiers after generation.

2. TestcaseFolderImmutabilityRule
   - Ensures the `testcase` folder is kept unchanged except for the promoted test file and package name.
   - This protects the fixed testcase harness from accidental editing.

3. TestFileParityRule
   - Ensures the testcase test file is byte-identical to the already validated solution test file.
   - This prevents accidental divergence between the test harness and the generated code.

4. ColorPaletteCompletenessRule
   - Checks that old palette hex values are fully replaced and do not remain in generated solution files.
   - This protects the output from inconsistent or incomplete color transformations.

5. NoPlaceholderLinksRule
   - Rejects `PLACEHOLDER_*` tokens in generated output.
   - This prevents broken static assets or invalid placeholder links.

6. RouteRenameConsistencyRule
   - Verifies that renamed pages also update route path literals such as `<Route path>`, `<Link to>`, `href`, and navigation calls.
   - This catches one of the most common failures in generated scenarios.

7. IdeBasedCodingJsonSyncRule
   - Re-derives test cases from the promoted testcase file and checks that `IDE_BASED_CODING` JSON remains synchronized.
   - This ensures the generated IDE metadata matches the actual test content.

8. JavaScript syntax and imports validation
   - The pipeline validates JavaScript/JSX syntax and import resolution before final generation completes.
   - This catches broken files before the final output is accepted.

9. Solution test validation
   - The generated solution is run through the project test runner.
   - This confirms that the output is not just structurally correct, but also functionally valid.

#### Recommended additional evals for future improvement

The project already has strong rule-based evals, but the following evaluation checks would make the system even more robust:

1. Draft schema validity eval
   - Validates that the AI-generated draft matches the exact expected JSON schema.
   - Helps catch malformed outputs early.

2. File categorization accuracy eval
   - Checks whether every source file was assigned to exactly one correct bucket: transformable, manually authored, or unchanged.

3. Manual file content quality eval
   - Verifies that manually authored files contain complete source, no leaked headers, and no accidental placeholder text.

4. Route and navigation coverage eval
   - Ensures all relevant route, link, and navigation references were updated for renamed pages.

5. Seed data quality eval
   - Checks that regenerated seed arrays are complete, realistic, and consistent with the new domain.

6. Test assertion consistency eval
   - Confirms that test assertions align with the actual output text, routes, and renamed component names.

7. Build health eval
   - Runs dependency installation and project build checks for the generated scenario.

8. Human review gate eval
   - Requires manual approval after draft generation for high-risk or ambiguous scenarios.

9. Scenario quality scorecard
   - Summarizes score across correctness, consistency, route coverage, visual completeness, and test success.

#### How these evals are implemented in this project today

The current app implements quality checks through:

- `backend/src/rulesEngine/rules/`
- `backend/src/pipeline/steps/`
- `backend/src/config/CompositionRoot.js`
- `backend/src/pipeline/steps/EnforceRulesStep.js`

In practical terms, the evaluation system is already present as a rule-driven validation engine that stops generation when required checks fail.

---

## 7. Why this is valuable

This application reduces the cost of creating scenario-based React projects.

Without automation, a developer would normally need to:

- inspect the existing app manually,
- determine what to rename,
- understand every component and route,
- rewrite manually authored files,
- modify test expectations,
- update colors and content,
- and validate everything repeatedly.

This takes significant time and effort.

---

## 8. Time reduction: manual effort vs automated workflow

### Manual approach

A manual project transformation or scenario creation effort often takes around:

- 1/2 day to a full day for a moderate project,
- and more for larger or more complex React apps.

Typical manual work includes:

- reading structure,
- identifying transformable files,
- hand-writing new content,
- editing tests,
- verifying routes and labels,
- correcting mismatches,
- validating everything at the end.

### Automated approach with this application

With React_Replica_Generator, the same work is reduced to:

- upload project,
- start analysis,
- review draft,
- run generation,
- validate output.

The expected time can be reduced to:

- about 10 to 30 minutes for a straightforward scenario,
- about 30 to 60 minutes for a medium-sized project,
- and around 1 to 2 hours for larger projects depending on review and validation needs.

### Estimated time saved

If manual work takes about 4 to 8 hours for a scenario,
then the automation can reduce that to roughly 20 to 60 minutes of active effort.

That means approximately:

- 70% to 90% reduction in scenario authoring time,
- significantly faster turnaround,
- less repetitive manual work,
- better consistency across generated scenarios.

### Important note

The actual time saved depends on:

- project size,
- number of files,
- complexity of route structure,
- quality of the draft,
- how much review is needed,
- how many validations and fixes are required.

But in general, the system provides a major reduction in effort compared with doing the work manually.

---

## 9. Business and productivity impact

This application helps teams:

- create scenarios faster,
- reduce repetitive coding effort,
- standardize scenario generation,
- improve consistency,
- reduce manual review work,
- support scale for multiple project variants.

In practical terms, it can turn a half-day manual effort into a much faster automated workflow.

---

## 10. Technical architecture summary

### Backend

The backend contains:

- API routes,
- analysis jobs,
- generation jobs,
- scenario authoring logic,
- model integration,
- generation pipeline,
- rule engine,
- validation services,
- file-system interactions.

### Frontend

The frontend provides:

- project upload,
- provider selection,
- job monitoring,
- draft review,
- generation trigger controls.

### Shared principles

- deterministic pipeline for generation,
- AI-assisted drafting for discovery,
- rule enforcement for quality,
- modular architecture for maintainability.

---

## 11. Example use case

A team wants to create a new React replica for a training or assessment platform.

Normally, they would:

- inspect the original app,
- rewrite routes,
- rename components,
- update labels,
- modify tests,
- adjust colors,
- validate outputs,
- and repeat several times.

With React_Replica_Generator, they can:

- upload the existing project,
- let the system draft the transformation spec,
- review the generated spec,
- run generation,
- receive the result and validate it quickly.

---

## 12. Final summary

React_Replica_Generator is an application designed to automate the creation of new React-based replica scenarios from an existing codebase.

It combines:

- AI-powered analysis,
- structured transformation drafting,
- deterministic generation,
- validation,
- and modern UI workflow management.

This reduces manual effort dramatically. A task that might take half a day or more by hand can often be completed in a much shorter automated flow, saving hours of engineering time while improving consistency and scalability.

---

## 13. Suggested next steps

Possible future improvements include:

- better quality scoring for generated drafts,
- smarter retry logic for provider failures,
- enhanced automated review of manually authored files,
- dashboards for scenario quality metrics,
- export support for generated scenario packs.

---

## 14. Conclusion

This project is a practical automation platform for scenario generation. It helps teams move from a manual, time-consuming process to a faster, structured, AI-assisted workflow.

The key value is simple:

- faster scenario creation,
- lower manual effort,
- more consistency,
- better scalability,
- and a repeatable system for generating multiple replicas from a single base project.

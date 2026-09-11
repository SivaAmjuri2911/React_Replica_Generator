# Scenario Evaluation Catalog

This folder contains the project’s evaluation catalog and summary utilities.

## Purpose

The project already contains a strong rule-driven evaluation system in the backend pipeline. This catalog makes those checks explicit and easier to review as a list of evaluation criteria.

## Current implemented checks

The catalog in `ScenarioEvaluationCatalog.js` includes the currently implemented generation checks:

- PackageJsonAlignmentRule
- TestcaseFolderImmutabilityRule
- TestFileParityRule
- ColorPaletteCompletenessRule
- NoPlaceholderLinksRule
- RouteRenameConsistencyRule
- IdeBasedCodingJsonSyncRule
- JavaScript syntax validation
- Import resolution validation
- Solution test validation

## Recommended future checks

The catalog also includes suggested future evals such as:

- Draft schema validity
- File categorization accuracy
- Manual file content quality
- Route/navigation coverage
- Seed data quality
- Test assertion consistency
- Build health
- Human review gate
- Scenario quality scorecard

## Usage

```js
import { buildScenarioEvaluationSummary } from './ScenarioEvaluationCatalog.js';

const summary = buildScenarioEvaluationSummary({
  violations: [
    { ruleName: 'RouteRenameConsistencyRule', message: 'Route path mismatch found' },
  ],
});

console.log(summary.scoreOutOf100);
console.log(summary);
```

## Notes

This is a documentation and reporting layer for the existing evals, not a replacement for the backend rules engine.

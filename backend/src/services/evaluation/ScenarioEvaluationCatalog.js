export const SCENARIO_EVALUATION_CHECKS = [
    {
        id: 'package-json-alignment',
        title: 'Package.json alignment',
        ruleName: 'PackageJsonAlignmentRule',
        category: 'project-integrity',
        implemented: true,
        severity: 'critical',
        description: 'Ensures the generated prefilled_code, solution_code, and testcase folders all declare the same package name.',
        sourcePath: 'backend/src/rulesEngine/rules/PackageJsonAlignmentRule.js',
    },
    {
        id: 'testcase-folder-immutability',
        title: 'Testcase folder immutability',
        ruleName: 'TestcaseFolderImmutabilityRule',
        category: 'testcase-integrity',
        implemented: true,
        severity: 'critical',
        description: 'Ensures the testcase folder remains unchanged except for the promoted test file and package.json name field.',
        sourcePath: 'backend/src/rulesEngine/rules/TestcaseFolderImmutabilityRule.js',
    },
    {
        id: 'test-file-parity',
        title: 'Test file parity',
        ruleName: 'TestFileParityRule',
        category: 'testcase-integrity',
        implemented: true,
        severity: 'critical',
        description: 'Ensures the testcase test file is byte-identical to the already validated test file in solution_code.',
        sourcePath: 'backend/src/rulesEngine/rules/TestFileParityRule.js',
    },
    {
        id: 'color-palette-completeness',
        title: 'Color palette completeness',
        ruleName: 'ColorPaletteCompletenessRule',
        category: 'content-consistency',
        implemented: true,
        severity: 'high',
        description: 'Ensures old palette colors are fully replaced and do not remain anywhere in generated solution files.',
        sourcePath: 'backend/src/rulesEngine/rules/ColorPaletteCompletenessRule.js',
    },
    {
        id: 'placeholder-link-rejection',
        title: 'Placeholder link rejection',
        ruleName: 'NoPlaceholderLinksRule',
        category: 'content-consistency',
        implemented: true,
        severity: 'high',
        description: 'Rejects PLACEHOLDER_* tokens and prevents broken or incomplete static asset links.',
        sourcePath: 'backend/src/rulesEngine/rules/NoPlaceholderLinksRule.js',
    },
    {
        id: 'route-rename-consistency',
        title: 'Route rename consistency',
        ruleName: 'RouteRenameConsistencyRule',
        category: 'route-integrity',
        implemented: true,
        severity: 'critical',
        description: 'Verifies that renamed pages also update route path literals, link references, and navigation calls.',
        sourcePath: 'backend/src/rulesEngine/rules/RouteRenameConsistencyRule.js',
    },
    {
        id: 'ide-based-coding-json-sync',
        title: 'IDE-based coding JSON sync',
        ruleName: 'IdeBasedCodingJsonSyncRule',
        category: 'metadata-integrity',
        implemented: true,
        severity: 'high',
        description: 'Re-derives test cases from the promoted testcase file and checks that IDE_BASED_CODING output stays synchronized.',
        sourcePath: 'backend/src/rulesEngine/rules/IdeBasedCodingJsonSyncRule.js',
    },
    {
        id: 'javascript-syntax-validation',
        title: 'JavaScript syntax validation',
        ruleName: 'ValidateJavaScriptSyntaxStep',
        category: 'quality-gates',
        implemented: true,
        severity: 'critical',
        description: 'Validates generated JS/JSX syntax before the pipeline accepts the output.',
        sourcePath: 'backend/src/pipeline/steps/ValidateJavaScriptSyntaxStep.js',
    },
    {
        id: 'import-resolution-validation',
        title: 'Import resolution validation',
        ruleName: 'ValidateImportResolutionStep',
        category: 'quality-gates',
        implemented: true,
        severity: 'critical',
        description: 'Checks that generated imports resolve correctly after transformation.',
        sourcePath: 'backend/src/pipeline/steps/ValidateImportResolutionStep.js',
    },
    {
        id: 'solution-test-validation',
        title: 'Solution test validation',
        ruleName: 'ValidateSolutionTestsStep',
        category: 'quality-gates',
        implemented: true,
        severity: 'critical',
        description: 'Runs the generated solution through the project test runner and requires all tests to pass.',
        sourcePath: 'backend/src/pipeline/steps/ValidateSolutionTestsStep.js',
    },
];

export const RECOMMENDED_FUTURE_EVALUATION_CHECKS = [
    {
        id: 'draft-schema-validity',
        title: 'Draft schema validity',
        category: 'draft-quality',
        implemented: false,
        severity: 'high',
        description: 'Ensures the AI-generated draft always matches the exact JSON schema expected by the pipeline.',
    },
    {
        id: 'file-categorization-accuracy',
        title: 'File categorization accuracy',
        category: 'draft-quality',
        implemented: false,
        severity: 'high',
        description: 'Checks whether each source file was assigned to the correct bucket: transformable, manually authored, or unchanged.',
    },
    {
        id: 'manual-file-content-quality',
        title: 'Manual file content quality',
        category: 'draft-quality',
        implemented: false,
        severity: 'high',
        description: 'Verifies manually authored file content is complete, syntactically valid, and free of leaked headers or placeholders.',
    },
    {
        id: 'route-navigation-coverage',
        title: 'Route navigation coverage',
        category: 'route-integrity',
        implemented: false,
        severity: 'high',
        description: 'Ensures renamed pages update all relevant routes, links, hrefs, and navigation references.',
    },
    {
        id: 'seed-data-quality',
        title: 'Seed data quality',
        category: 'content-consistency',
        implemented: false,
        severity: 'medium',
        description: 'Checks that regenerated seed arrays are complete, realistic, and aligned with the new scenario domain.',
    },
    {
        id: 'test-assertion-consistency',
        title: 'Test assertion consistency',
        category: 'testcase-integrity',
        implemented: false,
        severity: 'high',
        description: 'Confirms generated test assertions match actual displayed text, routes, and renamed component names.',
    },
    {
        id: 'build-health',
        title: 'Build health',
        category: 'quality-gates',
        implemented: false,
        severity: 'high',
        description: 'Runs dependency installation and build checks to confirm the generated scenario compiles successfully.',
    },
    {
        id: 'human-review-gate',
        title: 'Human review gate',
        category: 'workflow-quality',
        implemented: false,
        severity: 'medium',
        description: 'Requires explicit human approval for high-risk or ambiguous draft scenarios.',
    },
    {
        id: 'scenario-quality-scorecard',
        title: 'Scenario quality scorecard',
        category: 'reporting',
        implemented: false,
        severity: 'medium',
        description: 'Produces a summarized quality score across correctness, consistency, route coverage, and test success.',
    },
];

/**
 * Builds a structured evaluation summary for a generation run.
 *
 * @param {{ violations?: Array<{ ruleName?: string, message?: string }> }} params
 * @returns {{
 *   totalImplementedChecks: number,
 *   passedChecks: number,
 *   failedChecks: number,
 *   scoreOutOf100: number,
 *   checks: Array<{ id: string, title: string, category: string, implemented: boolean, severity: string, description: string, sourcePath?: string, status: 'passed' | 'failed' | 'not-implemented' }>
 * }}
 */
export function buildScenarioEvaluationSummary(params = {}) {
    const violations = params.violations ?? [];
    const failedRules = new Set(
        violations
            .filter((violation) => violation?.ruleName)
            .map((violation) => violation.ruleName),
    );

    const checks = SCENARIO_EVALUATION_CHECKS.map((check) => ({
        ...check,
        status: failedRules.has(check.ruleName) ? 'failed' : 'passed',
    }));

    const implementedChecks = checks.filter((check) => check.implemented);
    const failedChecks = checks.filter((check) => check.status === 'failed');
    const passedChecks = implementedChecks.length - failedChecks.length;
    const scoreOutOf100 = implementedChecks.length > 0
        ? Math.round((passedChecks / implementedChecks.length) * 100)
        : 0;

    return {
        totalImplementedChecks: implementedChecks.length,
        passedChecks,
        failedChecks: failedChecks.length,
        scoreOutOf100,
        checks,
    };
}

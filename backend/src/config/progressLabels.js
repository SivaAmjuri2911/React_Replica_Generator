/**
 * @typedef {object} GenerationStepLabel
 * @property {string} name
 * @property {string} label
 */

/** @type {readonly GenerationStepLabel[]} */
export const GENERATION_STEP_LABELS = [
    { name: 'ScaffoldPrefilledCodeStep', label: 'Setting up your starter project' },
    { name: 'TransformSolutionCodeStep', label: 'Rewriting your solution code' },
    { name: 'SyncPrefilledSeedDataStep', label: 'Syncing starter seed data with the solution' },
    { name: 'ValidateJavaScriptSyntaxStep', label: 'Checking the code compiles cleanly' },
    { name: 'ValidateImportResolutionStep', label: 'Checking every file import resolves' },
    { name: 'ValidateSolutionTestsStep', label: "Running the solution's tests" },
    { name: 'PromoteTestsToTestcaseStep', label: 'Preparing the official test files' },
    { name: 'DeriveTestCasesStep', label: 'Extracting the test cases' },
    { name: 'BuildIdeBasedCodingJsonStep', label: 'Building the coding-question file' },
    { name: 'EnforceRulesStep', label: 'Running final consistency checks' },
    { name: 'FinalValidationStep', label: 'Confirming everything still passes' },
];
export function generationStepLabel(stepName) {
    return GENERATION_STEP_LABELS.find((step) => step.name === stepName)?.label ?? stepName;
}
/**
 * @typedef {object} AnalysisPhaseLabel
 * @property {import('../domain/models/AnalysisJob.js').AnalysisPhaseName} name
 * @property {string} label
 */

/** @type {readonly AnalysisPhaseLabel[]} */
export const ANALYSIS_PHASE_LABELS = [
    { name: 'extracting-uploads', label: 'Extracting your uploaded project' },
    { name: 'reading-solution-code', label: 'Reading your solution code' },
    { name: 'drafting-with-model', label: 'Designing your new scenario with AI' },
    { name: 'saving-spec', label: 'Saving your scenario blueprint' },
];

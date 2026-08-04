import type { AnalysisPhaseName } from '../domain/models/AnalysisJob.js';

/**
 * Single source of truth for turning internal PipelineStep names / draft
 * phase names into the friendly text shown in the UI, so neither
 * InMemoryGenerationJobService nor InMemoryAnalysisJobService (nor the
 * frontend) has to know these strings itself. Kept separate from
 * CompositionRoot — that file's job is wiring service object graphs, this
 * one's is display copy, and nothing here needs a Logger/FileSystemService.
 *
 * GENERATION_STEP_LABELS' order must match CompositionRoot.buildGenerationPipeline()'s
 * `steps` array order — see backend/tests/unit/config/progressLabels.test.ts,
 * which asserts this directly against a real pipeline build.
 */

export interface GenerationStepLabel {
  readonly name: string;
  readonly label: string;
}

export const GENERATION_STEP_LABELS: readonly GenerationStepLabel[] = [
  { name: 'ScaffoldPrefilledCodeStep', label: 'Setting up your starter project' },
  { name: 'TransformSolutionCodeStep', label: 'Rewriting your solution code' },
  { name: 'ValidateJavaScriptSyntaxStep', label: 'Checking the code compiles cleanly' },
  { name: 'ValidateImportResolutionStep', label: 'Checking every file import resolves' },
  { name: 'ValidateSolutionTestsStep', label: "Running the solution's tests" },
  { name: 'PromoteTestsToTestcaseStep', label: 'Preparing the official test files' },
  { name: 'DeriveTestCasesStep', label: 'Extracting the test cases' },
  { name: 'BuildIdeBasedCodingJsonStep', label: 'Building the coding-question file' },
  { name: 'EnforceRulesStep', label: 'Running final consistency checks' },
  { name: 'FinalValidationStep', label: 'Confirming everything still passes' },
];

export function generationStepLabel(stepName: string): string {
  return GENERATION_STEP_LABELS.find((step) => step.name === stepName)?.label ?? stepName;
}

interface AnalysisPhaseLabel {
  readonly name: AnalysisPhaseName;
  readonly label: string;
}

export const ANALYSIS_PHASE_LABELS: readonly AnalysisPhaseLabel[] = [
  { name: 'extracting-uploads', label: 'Extracting your uploaded project' },
  { name: 'reading-solution-code', label: 'Reading your solution code' },
  { name: 'drafting-with-model', label: 'Designing your new scenario with AI' },
  { name: 'saving-spec', label: 'Saving your scenario blueprint' },
];

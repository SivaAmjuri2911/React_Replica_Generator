export type LlmProvider = 'anthropic' | 'openai' | 'openrouter';

export interface ModelSummary {
  readonly id: string;
  readonly displayName: string;
}

export type GenerationJobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface GenerationLogLine {
  readonly timestamp: string;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly message: string;
}

/** Shared shape for both the 10-step generation pipeline and the 4-phase draft flow. */
export type ProgressStepStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface ProgressStepDto {
  readonly name: string;
  readonly label: string;
  readonly status: ProgressStepStatus;
  readonly startedAt?: string;
  readonly finishedAt?: string;
}

export interface TestCaseDto {
  readonly testCaseEnum: string;
  readonly displayText: string;
  readonly weightage: number;
}

export interface GeneratedProjectDto {
  readonly scenarioName: string;
  readonly prefilledCodePath: string;
  readonly solutionCodePath: string;
  readonly testcasePath: string;
  readonly ideBasedCodingJsonPath: string;
  readonly testCases: readonly TestCaseDto[];
  readonly questionId: string;
  readonly ideSessionId: string;
}

export interface GenerationJobFailureDto {
  readonly code: string;
  readonly message: string;
  readonly context: Readonly<Record<string, unknown>>;
}

export interface GenerationJob {
  readonly id: string;
  readonly specPath: string;
  readonly scenarioName: string;
  readonly status: GenerationJobStatus;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly logs: readonly GenerationLogLine[];
  readonly result?: GeneratedProjectDto;
  readonly failure?: GenerationJobFailureDto;
  readonly attemptsUsed?: number;
  readonly steps?: readonly ProgressStepDto[];
}

export type AnalysisJobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface TextReplacementDto {
  readonly from: string;
  readonly to: string;
}

export interface FileRenameDto {
  readonly fromRelativePath: string;
  readonly toRelativePath: string;
}

export interface ColorSwapDto {
  readonly fromHex: string;
  readonly toHex: string;
}

export interface ScenarioSpecDraftDto {
  readonly scenarioName: string;
  readonly outputFolderBaseName: string;
  readonly testPrefix: string;
  readonly textReplacements: readonly TextReplacementDto[];
  readonly fileRenames: readonly FileRenameDto[];
  readonly colorSwaps: readonly ColorSwapDto[];
  readonly transformableRelativePaths: readonly string[];
  readonly manuallyAuthoredRelativePaths: readonly string[];
}

export interface AnalysisJobFailureDto {
  readonly code: string;
  readonly message: string;
  readonly context: Readonly<Record<string, unknown>>;
}

export interface AnalysisJob {
  readonly id: string;
  readonly scenarioSlug: string;
  readonly status: AnalysisJobStatus;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly logs: readonly GenerationLogLine[];
  readonly result?: ScenarioSpecDraftDto;
  readonly specPath?: string;
  readonly failure?: AnalysisJobFailureDto;
  readonly phases?: readonly ProgressStepDto[];
}

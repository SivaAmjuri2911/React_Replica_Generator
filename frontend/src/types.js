/**
 * @typedef {('anthropic'|'openai'|'openrouter'|'mistral')} LlmProvider
 */

/**
 * @typedef {object} ModelSummary
 * @property {string} id
 * @property {string} displayName
 */

/**
 * @typedef {('pending'|'running'|'succeeded'|'failed')} GenerationJobStatus
 */

/**
 * @typedef {object} GenerationLogLine
 * @property {string} timestamp
 * @property {('debug'|'info'|'warn'|'error')} level
 * @property {string} message
 */

/** Shared shape for both the 10-step generation pipeline and the 4-phase draft flow.
 * @typedef {('pending'|'running'|'succeeded'|'failed')} ProgressStepStatus
 */

/**
 * @typedef {object} ProgressStepDto
 * @property {string} name
 * @property {string} label
 * @property {ProgressStepStatus} status
 * @property {string} [startedAt]
 * @property {string} [finishedAt]
 */

/**
 * @typedef {object} TestCaseDto
 * @property {string} testCaseEnum
 * @property {string} displayText
 * @property {number} weightage
 */

/**
 * @typedef {object} GeneratedProjectDto
 * @property {string} scenarioName
 * @property {string} prefilledCodePath
 * @property {string} solutionCodePath
 * @property {string} testcasePath
 * @property {string} ideBasedCodingJsonPath
 * @property {readonly TestCaseDto[]} testCases
 * @property {string} questionId
 * @property {string} ideSessionId
 */

/**
 * @typedef {object} GenerationJobFailureDto
 * @property {string} code
 * @property {string} message
 * @property {Readonly<Record<string, unknown>>} context
 */

/**
 * @typedef {object} GenerationJob
 * @property {string} id
 * @property {string} specPath
 * @property {string} scenarioName
 * @property {GenerationJobStatus} status
 * @property {string} startedAt
 * @property {string} [finishedAt]
 * @property {readonly GenerationLogLine[]} logs
 * @property {GeneratedProjectDto} [result]
 * @property {GenerationJobFailureDto} [failure]
 * @property {number} [attemptsUsed]
 * @property {readonly ProgressStepDto[]} [steps]
 */

/**
 * @typedef {('pending'|'running'|'succeeded'|'failed')} AnalysisJobStatus
 */

/**
 * @typedef {object} TextReplacementDto
 * @property {string} from
 * @property {string} to
 */

/**
 * @typedef {object} FileRenameDto
 * @property {string} fromRelativePath
 * @property {string} toRelativePath
 */

/**
 * @typedef {object} ColorSwapDto
 * @property {string} fromHex
 * @property {string} toHex
 */

/**
 * @typedef {object} ScenarioSpecDraftDto
 * @property {string} scenarioName
 * @property {string} outputFolderBaseName
 * @property {string} testPrefix
 * @property {readonly TextReplacementDto[]} textReplacements
 * @property {readonly FileRenameDto[]} fileRenames
 * @property {readonly ColorSwapDto[]} colorSwaps
 * @property {readonly string[]} transformableRelativePaths
 * @property {readonly string[]} manuallyAuthoredRelativePaths
 */

/**
 * @typedef {object} AnalysisJobFailureDto
 * @property {string} code
 * @property {string} message
 * @property {Readonly<Record<string, unknown>>} context
 */

/**
 * @typedef {object} AnalysisJob
 * @property {string} id
 * @property {string} scenarioSlug
 * @property {AnalysisJobStatus} status
 * @property {string} startedAt
 * @property {string} [finishedAt]
 * @property {readonly GenerationLogLine[]} logs
 * @property {ScenarioSpecDraftDto} [result]
 * @property {string} [specPath]
 * @property {AnalysisJobFailureDto} [failure]
 * @property {readonly ProgressStepDto[]} [phases]
 */

export {};

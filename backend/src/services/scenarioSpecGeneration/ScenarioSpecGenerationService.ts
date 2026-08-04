import type { Result } from '../../shared/Result.js';
import type { ConfigurationError } from '../../domain/errors/GenerationError.js';
import type { ScenarioSpecDraft } from '../../domain/models/ScenarioSpecDraft.js';
import type { LlmProvider } from '../../domain/models/LlmProvider.js';

/**
 * A base project's source file, read from disk by the caller. This service
 * never touches the filesystem itself — it only reasons about text already
 * handed to it (keeps the LLM call testable with fakes, and keeps I/O in one
 * place per the FileSystemService convention used everywhere else).
 */
export interface BaseSourceFile {
  readonly relativePath: string;
  readonly contents: string;
}

export interface ScenarioSpecGenerationRequest {
  /**
   * Free-text description of the new scenario, e.g. "a helpdesk ticket
   * management app". Omit to let the model invent an appropriate new
   * scenario itself from the base project alone — see
   * SCENARIO_SPEC_DRAFT_SYSTEM_PROMPT.
   */
  readonly scenarioDescription?: string;
  /** Every source file under the base solution_code, already read into memory. */
  readonly baseSolutionCodeFiles: readonly BaseSourceFile[];
  /** Test prefixes already used by other scenarios, so the draft picks a genuinely new one. */
  readonly usedTestPrefixes: readonly string[];
  /** Which vendor to draft with. Defaults to 'anthropic' when omitted (preserves CLI/pre-multi-provider behavior). */
  readonly provider?: LlmProvider;
  /** Caller-supplied API key for the chosen provider. Falls back to the server's own credential resolution (env var) when omitted — see the implementation. */
  readonly apiKey?: string;
  /** Which model to draft with. Falls back to the implementation's default when omitted. */
  readonly modelId?: string;
}

/**
 * Turns an arbitrary base React project + a scenario description into a
 * ScenarioSpecDraft, so a project the tool has never seen before doesn't
 * require a human to hand-author its transformation spec. The one place in
 * this codebase that calls an LLM — every other service/rule/pipeline step
 * is deterministic (see README, "What's mechanical vs. what needs a person").
 */
export interface ScenarioSpecGenerationService {
  generateDraft(
    request: ScenarioSpecGenerationRequest
  ): Promise<Result<ScenarioSpecDraft, ConfigurationError>>;

  /**
   * Asks the model to correct a draft that was actually applied and tested —
   * `failureSummary` is what really broke (e.g. the pipeline's own error
   * message, or a test runner's failure output), not a guess. Used by
   * SelfCorrectingScenarioWorkflow so a scenario doesn't need a human in the
   * loop to close small gaps a one-shot draft left behind.
   */
  reviseDraft(
    request: ScenarioSpecGenerationRequest,
    previousDraft: ScenarioSpecDraft,
    failureSummary: string
  ): Promise<Result<ScenarioSpecDraft, ConfigurationError>>;
}

import type { ScenarioSpec } from '../domain/models/ScenarioSpec.js';
import type { TestCase } from '../domain/models/TestCase.js';

/**
 * Mutable, orchestrator-internal state threaded through pipeline steps.
 * Deliberately not the same type as the public `GeneratedProject` domain
 * model — this carries in-progress state (e.g. paths that don't exist yet
 * when early steps run) that the final, immutable GeneratedProject should
 * never expose.
 */
export class PipelineContext {
  readonly spec: ScenarioSpec;
  prefilledCodePath?: string;
  solutionCodePath?: string;
  testcasePath?: string;
  validatedTestFilePath?: string;
  testCases?: readonly TestCase[];
  ideBasedCodingJsonPath?: string;
  questionId?: string;
  ideSessionId?: string;

  constructor(spec: ScenarioSpec) {
    this.spec = spec;
  }
}

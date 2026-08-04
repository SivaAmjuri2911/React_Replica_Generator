import type { Result } from '../shared/Result.js';
import type { RuleViolationError } from '../domain/errors/GenerationError.js';
import type { ScenarioSpec } from '../domain/models/ScenarioSpec.js';
import type { GeneratedProject } from '../domain/models/GeneratedProject.js';
import type { FileSystemService } from '../services/fileSystem/FileSystemService.js';

export interface RuleEvaluationContext {
  readonly spec: ScenarioSpec;
  readonly generatedProject: GeneratedProject;
  readonly fileSystem: FileSystemService;
}

/**
 * A single, independently-testable invariant from GENERATION_RULES.md,
 * expressed as code. New rules are added by implementing this interface and
 * registering the implementation with RulesRegistry — nothing about the
 * pipeline or existing rules needs to change (open/closed principle).
 */
export interface GenerationRule {
  readonly name: string;
  evaluate(context: RuleEvaluationContext): Promise<Result<void, RuleViolationError>>;
}

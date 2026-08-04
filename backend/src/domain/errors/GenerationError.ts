/**
 * Base class for every error the pipeline can throw. Carries a stable `code`
 * so callers (CLI, tests) can branch on failure type without string-matching
 * messages, plus a `context` bag for structured logging.
 */
export abstract class GenerationError extends Error {
  abstract readonly code: string;
  readonly context: Readonly<Record<string, unknown>>;

  protected constructor(message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.context = Object.freeze({ ...context });
    Error.captureStackTrace?.(this, new.target);
  }
}

export class FileSystemError extends GenerationError {
  readonly code = 'FILE_SYSTEM_ERROR';

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
  }
}

export class ConfigurationError extends GenerationError {
  readonly code = 'CONFIGURATION_ERROR';

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
  }
}

export class TestExecutionError extends GenerationError {
  readonly code = 'TEST_EXECUTION_ERROR';

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
  }
}

export class RuleViolationError extends GenerationError {
  readonly code = 'RULE_VIOLATION_ERROR';
  readonly ruleName: string;

  constructor(ruleName: string, message: string, context: Record<string, unknown> = {}) {
    super(message, context);
    this.ruleName = ruleName;
  }
}

export class TestCaseParsingError extends GenerationError {
  readonly code = 'TEST_CASE_PARSING_ERROR';

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, context);
  }
}

export class PipelineStepError extends GenerationError {
  readonly code = 'PIPELINE_STEP_ERROR';
  readonly stepName: string;
  override readonly cause: unknown;

  constructor(stepName: string, cause: unknown, context: Record<string, unknown> = {}) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(`Pipeline step "${stepName}" failed: ${causeMessage}`, context);
    this.stepName = stepName;
    this.cause = cause;
  }
}

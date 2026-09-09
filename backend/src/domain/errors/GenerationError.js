/**
 * Base class for every error the pipeline can throw. Carries a stable `code`
 * so callers (CLI, tests) can branch on failure type without string-matching
 * messages, plus a `context` bag for structured logging.
 */
export class GenerationError extends Error {
    context;
    constructor(message, context = {}) {
        super(message);
        this.name = new.target.name;
        this.context = Object.freeze({ ...context });
        Error.captureStackTrace?.(this, new.target);
    }
}
export class FileSystemError extends GenerationError {
    code = 'FILE_SYSTEM_ERROR';
    constructor(message, context = {}) {
        super(message, context);
    }
}
export class ConfigurationError extends GenerationError {
    code = 'CONFIGURATION_ERROR';
    constructor(message, context = {}) {
        super(message, context);
    }
}
export class TestExecutionError extends GenerationError {
    code = 'TEST_EXECUTION_ERROR';
    constructor(message, context = {}) {
        super(message, context);
    }
}
export class RuleViolationError extends GenerationError {
    code = 'RULE_VIOLATION_ERROR';
    ruleName;
    constructor(ruleName, message, context = {}) {
        super(message, context);
        this.ruleName = ruleName;
    }
}
export class TestCaseParsingError extends GenerationError {
    code = 'TEST_CASE_PARSING_ERROR';
    constructor(message, context = {}) {
        super(message, context);
    }
}
export class PipelineStepError extends GenerationError {
    code = 'PIPELINE_STEP_ERROR';
    stepName;
    cause;
    constructor(stepName, cause, context = {}) {
        const causeMessage = cause instanceof Error ? cause.message : String(cause);
        super(`Pipeline step "${stepName}" failed: ${causeMessage}`, context);
        this.stepName = stepName;
        this.cause = cause;
    }
}

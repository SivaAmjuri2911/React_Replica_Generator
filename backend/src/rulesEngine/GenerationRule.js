/**
 * @typedef {object} RuleEvaluationContext
 * @property {import('../domain/models/ScenarioSpec.js').ScenarioSpec} spec
 * @property {import('../domain/models/GeneratedProject.js').GeneratedProject} generatedProject
 * @property {import('../services/fileSystem/FileSystemService.js').FileSystemService} fileSystem
 */

/**
 * A single, independently-testable invariant from GENERATION_RULES.md,
 * expressed as code. New rules are added by implementing this interface and
 * registering the implementation with RulesRegistry — nothing about the
 * pipeline or existing rules needs to change (open/closed principle).
 * @typedef {object} GenerationRule
 * @property {string} name
 * @property {(context: RuleEvaluationContext) => Promise<import('../shared/Result.js').Result<void, import('../domain/errors/GenerationError.js').RuleViolationError>>} evaluate
 */

export {};

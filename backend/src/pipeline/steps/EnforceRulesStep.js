import { summarizeViolations } from '../../rulesEngine/RulesRegistry.js';
import { RuleViolationError } from '../../domain/errors/GenerationError.js';
/**
 * Runs every registered GenerationRule against the freshly-generated
 * project. This is the single gate that turns GENERATION_RULES.md from a
 * document someone might forget to follow into something a generation run
 * cannot pass without satisfying.
 */
/**
 * @implements {PipelineStep}
 */
export class EnforceRulesStep {
    name = 'EnforceRulesStep';
    rulesRegistry;
    fileSystem;
    constructor(rulesRegistry, fileSystem) {
        this.rulesRegistry = rulesRegistry;
        this.fileSystem = fileSystem;
    }
    async execute(context) {
        const generatedProject = {
            scenarioName: context.spec.scenarioName,
            prefilledCodePath: this.require(context.prefilledCodePath, 'prefilledCodePath'),
            solutionCodePath: this.require(context.solutionCodePath, 'solutionCodePath'),
            testcasePath: this.require(context.testcasePath, 'testcasePath'),
            ideBasedCodingJsonPath: this.require(context.ideBasedCodingJsonPath, 'ideBasedCodingJsonPath'),
            testCases: this.require(context.testCases, 'testCases'),
            questionId: this.require(context.questionId, 'questionId'),
            ideSessionId: this.require(context.ideSessionId, 'ideSessionId'),
        };
        const result = await this.rulesRegistry.evaluateAll({
            spec: context.spec,
            generatedProject,
            fileSystem: this.fileSystem,
        });
        if (!result.ok) {
            throw new RuleViolationError('EnforceRulesStep', `Generation produced ${result.error.length} rule violation(s):\n${summarizeViolations(result.error)}`);
        }
    }
    require(value, fieldName) {
        if (value === undefined) {
            throw new RuleViolationError('EnforceRulesStep', `Pipeline context is missing "${fieldName}"`);
        }
        return value;
    }
}

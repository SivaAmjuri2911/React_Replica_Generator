import path from 'node:path';
import { CompositionRoot } from '../../config/CompositionRoot.js';
import { FileSystemScenarioSpecRepository } from '../../config/FileSystemScenarioSpecRepository.js';
import { GenerationError } from '../../domain/errors/GenerationError.js';

/**
 * @typedef {object} AnalyzeCommandOptions
 * @property {string} [description]
 * @property {string} basePrefilledCode
 * @property {string} baseSolutionCode
 * @property {string} baseTestcase
 * @property {string} scenarioSlug
 * @property {string} scenariosRoot
 * @property {string} contentType
 * @property {string} toughness
 * @property {string} language
 * @property {string} questionType
 * @property {string} questionFormat
 * @property {import('../../logging/Logger.js').LogLevel} logLevel
 */

/**
 * `analyze` produces a spec.json the same shape a human would hand-author —
 * `generate` cannot tell the difference and needs no changes. This is the
 * only command in the CLI that calls an LLM; everything downstream of the
 * spec.json it writes stays fully deterministic.
 */
export function registerAnalyzeCommand(program) {
    program
        .command('analyze')
        .description('Use Claude to draft a scenario spec from an arbitrary base solution_code project, so a new project does not need a hand-authored spec.json')
        .option('--description <text>', 'Natural-language description of the new scenario (its domain/entities) — omit to let the model invent one')
        .requiredOption('--base-prefilled-code <path>', 'Path to the base prefilled_code folder')
        .requiredOption('--base-solution-code <path>', 'Path to the base solution_code folder')
        .requiredOption('--base-testcase <path>', 'Path to the base testcase folder')
        .requiredOption('--scenario-slug <slug>', 'Kebab-case folder name for this analysis run, e.g. "helpdesk-tickets" — created under scenarios/')
        .option('--scenarios-root <path>', 'Root directory holding per-scenario folders', './scenarios')
        .option('--content-type <value>', 'IDE_BASED_CODING platformMetadata.contentType', 'MARKDOWN')
        .option('--toughness <value>', 'IDE_BASED_CODING platformMetadata.toughness', 'EASY')
        .option('--language <value>', 'IDE_BASED_CODING platformMetadata.language', 'ENGLISH')
        .option('--question-type <value>', 'IDE_BASED_CODING platformMetadata.questionType', 'IDE_BASED_CODING')
        .option('--question-format <value>', 'IDE_BASED_CODING platformMetadata.questionFormat', 'CODING_PRACTICE')
        .option('--log-level <level>', 'debug | info | warn | error', 'info')
        .action(async (options) => {
        const root = CompositionRoot.create(options.logLevel);
        const logger = root.logger.child('analyze');
        try {
            const scenariosRoot = path.resolve(process.cwd(), options.scenariosRoot);
            const scenarioDir = path.join(scenariosRoot, options.scenarioSlug);
            const specRepository = new FileSystemScenarioSpecRepository(scenariosRoot);
            const existingScenarios = await specRepository.listAvailable();
            const usedTestPrefixes = existingScenarios.map((scenario) => scenario.testPrefix);
            logger.info('Drafting scenario spec with Claude', {
                scenarioSlug: options.scenarioSlug,
                usedTestPrefixCount: usedTestPrefixes.length,
            });
            const workflow = root.buildScenarioSpecAuthoringWorkflow();
            const result = await workflow.run({
                ...(options.description ? { scenarioDescription: options.description } : {}),
                usedTestPrefixes,
                platformMetadata: {
                    contentType: options.contentType,
                    toughness: options.toughness,
                    language: options.language,
                    questionType: options.questionType,
                    questionFormat: options.questionFormat,
                },
                basePrefilledCode: path.resolve(process.cwd(), options.basePrefilledCode),
                baseSolutionCode: path.resolve(process.cwd(), options.baseSolutionCode),
                baseTestcase: path.resolve(process.cwd(), options.baseTestcase),
                ideBasedCodingOutputDir: path.join(scenarioDir, 'output', 'IDE_BASED_CODING'),
                outputRoot: path.join(scenarioDir, 'output'),
                stagingDir: path.join(scenarioDir, 'staging'),
                specOutputPath: path.join(scenarioDir, 'spec.json'),
            });
            if (!result.ok) {
                logger.error(`Spec draft failed [${result.error.code}]: ${result.error.message}`, result.error.context);
                process.exitCode = 1;
                return;
            }
            logger.info('Draft spec written — review it, then run `generate` against it', {
                specPath: path.join(scenarioDir, 'spec.json'),
                scenarioName: result.value.scenarioName,
                testPrefix: result.value.testPrefix,
                transformableFileCount: result.value.transformableRelativePaths.length,
                manuallyAuthoredFileCount: result.value.manuallyAuthoredRelativePaths.length,
            });
        }
        catch (error) {
            if (error instanceof GenerationError) {
                logger.error(`Analyze failed [${error.code}]: ${error.message}`, error.context);
            }
            else {
                logger.error('Analyze failed with an unexpected error', { error: String(error) });
            }
            process.exitCode = 1;
        }
    });
}

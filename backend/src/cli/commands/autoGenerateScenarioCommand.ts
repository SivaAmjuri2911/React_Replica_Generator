import path from 'node:path';
import { Command } from 'commander';
import { CompositionRoot } from '../../config/CompositionRoot.js';
import { FileSystemScenarioSpecRepository } from '../../config/FileSystemScenarioSpecRepository.js';
import { GenerationError } from '../../domain/errors/GenerationError.js';
import type { LlmProvider } from '../../domain/models/LlmProvider.js';
import type { LogLevel } from '../../logging/Logger.js';

interface AutoGenerateCommandOptions {
  readonly description?: string;
  readonly basePrefilledCode: string;
  readonly baseSolutionCode: string;
  readonly baseTestcase: string;
  readonly scenarioSlug: string;
  readonly scenariosRoot: string;
  readonly provider?: string;
  readonly apiKey?: string;
  readonly model?: string;
  readonly maxAttempts: string;
  readonly contentType: string;
  readonly toughness: string;
  readonly language: string;
  readonly questionType: string;
  readonly questionFormat: string;
  readonly logLevel: LogLevel;
}

const VALID_PROVIDERS: readonly LlmProvider[] = ['anthropic', 'openai', 'openrouter'];

/**
 * `auto-generate` is `analyze` + `generate` fused into one self-correcting
 * loop: draft a spec, actually run it, and if it fails its own tests feed
 * the real failure back to the model for a fix, retrying up to
 * --max-attempts times — see SelfCorrectingScenarioWorkflow. `analyze`
 * stays untouched (draft-only, no pipeline run, review-before-generate) for
 * when that's what's wanted instead.
 */
export function registerAutoGenerateCommand(program: Command): void {
  program
    .command('auto-generate')
    .description(
      'Draft a scenario spec and generate from it, automatically asking the model to fix its own mistakes if the generated solution fails its tests'
    )
    .option('--description <text>', 'Natural-language description of the new scenario — omit to let the model invent one')
    .requiredOption('--base-prefilled-code <path>', 'Path to the base prefilled_code folder')
    .requiredOption('--base-solution-code <path>', 'Path to the base solution_code folder')
    .requiredOption('--base-testcase <path>', 'Path to the base testcase folder')
    .requiredOption('--scenario-slug <slug>', 'Kebab-case folder name for this run, e.g. "helpdesk-tickets" — created under scenarios/')
    .option('--scenarios-root <path>', 'Root directory holding per-scenario folders', './scenarios')
    .option('--provider <name>', `LLM provider: ${VALID_PROVIDERS.join(' | ')}`, 'anthropic')
    .option('--api-key <key>', 'API key for the chosen provider — falls back to env-var resolution when omitted')
    .option('--model <id>', 'Model id to draft/revise with — falls back to the provider service\'s default when omitted')
    .option('--max-attempts <n>', 'Total attempts (initial draft + revisions) before giving up', '3')
    .option('--content-type <value>', 'IDE_BASED_CODING platformMetadata.contentType', 'MARKDOWN')
    .option('--toughness <value>', 'IDE_BASED_CODING platformMetadata.toughness', 'EASY')
    .option('--language <value>', 'IDE_BASED_CODING platformMetadata.language', 'ENGLISH')
    .option('--question-type <value>', 'IDE_BASED_CODING platformMetadata.questionType', 'IDE_BASED_CODING')
    .option('--question-format <value>', 'IDE_BASED_CODING platformMetadata.questionFormat', 'CODING_PRACTICE')
    .option('--log-level <level>', 'debug | info | warn | error', 'info')
    .action(async (options: AutoGenerateCommandOptions) => {
      const root = CompositionRoot.create(options.logLevel);
      const logger = root.logger.child('auto-generate');

      if (options.provider && !(VALID_PROVIDERS as readonly string[]).includes(options.provider)) {
        logger.error(`--provider must be one of: ${VALID_PROVIDERS.join(', ')}`);
        process.exitCode = 1;
        return;
      }

      try {
        const scenariosRoot = path.resolve(process.cwd(), options.scenariosRoot);
        const scenarioDir = path.join(scenariosRoot, options.scenarioSlug);

        const specRepository = new FileSystemScenarioSpecRepository(scenariosRoot);
        const existingScenarios = await specRepository.listAvailable();
        const usedTestPrefixes = existingScenarios.map((scenario) => scenario.testPrefix);

        const maxAttempts = Number(options.maxAttempts);
        logger.info('Starting self-correcting generation', {
          scenarioSlug: options.scenarioSlug,
          provider: options.provider ?? 'anthropic',
          maxAttempts,
          usedTestPrefixCount: usedTestPrefixes.length,
        });

        const workflow = root.buildSelfCorrectingScenarioWorkflow();
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
          ideBasedCodingOutputDir: path.join(scenarioDir, 'ide_based_coding_output'),
          outputRoot: path.join(scenarioDir, 'output'),
          stagingDir: path.join(scenarioDir, 'staging'),
          specOutputPath: path.join(scenarioDir, 'spec.json'),
          ...(options.provider ? { provider: options.provider as LlmProvider } : {}),
          ...(options.apiKey ? { apiKey: options.apiKey } : {}),
          ...(options.model ? { modelId: options.model } : {}),
          maxAttempts,
        });

        if (!result.ok) {
          logger.error(`Auto-generate failed [${result.error.code}]: ${result.error.message}`, result.error.context);
          process.exitCode = 1;
          return;
        }

        logger.info('Generation succeeded', {
          scenarioName: result.value.spec.scenarioName,
          attemptsUsed: result.value.attemptsUsed,
          prefilledCodePath: result.value.generatedProject.prefilledCodePath,
          solutionCodePath: result.value.generatedProject.solutionCodePath,
          testcasePath: result.value.generatedProject.testcasePath,
          ideBasedCodingJsonPath: result.value.generatedProject.ideBasedCodingJsonPath,
          testCaseCount: result.value.generatedProject.testCases.length,
        });
      } catch (error) {
        if (error instanceof GenerationError) {
          logger.error(`Auto-generate failed [${error.code}]: ${error.message}`, error.context);
        } else {
          logger.error('Auto-generate failed with an unexpected error', { error: String(error) });
        }
        process.exitCode = 1;
      }
    });
}

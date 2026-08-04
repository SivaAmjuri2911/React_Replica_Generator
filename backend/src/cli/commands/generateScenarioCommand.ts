import { Command } from 'commander';
import { CompositionRoot } from '../../config/CompositionRoot.js';
import { ScenarioSpecLoader } from '../../config/ScenarioSpecLoader.js';
import { GenerationError } from '../../domain/errors/GenerationError.js';
import type { LogLevel } from '../../logging/Logger.js';

export function registerGenerateCommand(program: Command): void {
  program
    .command('generate')
    .description('Generate a new scenario (prefilled_code, solution_code, testcase, IDE_BASED_CODING) from a spec file')
    .requiredOption('--spec <path>', 'Path to the scenario spec JSON file')
    .option('--log-level <level>', 'debug | info | warn | error', 'info')
    .action(async (options: { spec: string; logLevel: LogLevel }) => {
      const root = CompositionRoot.create(options.logLevel);
      const logger = root.logger.child('generate');

      try {
        const spec = await new ScenarioSpecLoader().loadFromFile(options.spec);
        logger.info(`Loaded scenario spec "${spec.scenarioName}"`);

        const pipeline = root.buildGenerationPipeline();
        const result = await pipeline.run(spec);

        logger.info('Generation succeeded', {
          prefilledCodePath: result.prefilledCodePath,
          solutionCodePath: result.solutionCodePath,
          testcasePath: result.testcasePath,
          ideBasedCodingJsonPath: result.ideBasedCodingJsonPath,
          testCaseCount: result.testCases.length,
        });
      } catch (error) {
        if (error instanceof GenerationError) {
          logger.error(`Generation failed [${error.code}]: ${error.message}`, error.context);
        } else {
          logger.error('Generation failed with an unexpected error', { error: String(error) });
        }
        process.exitCode = 1;
      }
    });
}

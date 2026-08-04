import { ConsoleLogger } from '../logging/ConsoleLogger.js';
import type { Logger, LogLevel } from '../logging/Logger.js';
import { NodeFileSystemService } from '../services/fileSystem/NodeFileSystemService.js';
import type { FileSystemService } from '../services/fileSystem/FileSystemService.js';
import { CryptoUuidGeneratorService } from '../services/idGenerator/CryptoUuidGeneratorService.js';
import { NpmVitestRunnerService } from '../services/testRunner/NpmVitestRunnerService.js';
import { OrderedReplacementTransformationService } from '../services/textTransformation/OrderedReplacementTransformationService.js';
import { MarkerBasedTestCaseDerivationService } from '../services/testCaseDerivation/MarkerBasedTestCaseDerivationService.js';
import { RulesRegistry } from '../rulesEngine/RulesRegistry.js';
import { PackageJsonAlignmentRule } from '../rulesEngine/rules/PackageJsonAlignmentRule.js';
import { TestcaseFolderImmutabilityRule } from '../rulesEngine/rules/TestcaseFolderImmutabilityRule.js';
import { TestFileParityRule } from '../rulesEngine/rules/TestFileParityRule.js';
import { ColorPaletteCompletenessRule } from '../rulesEngine/rules/ColorPaletteCompletenessRule.js';
import { NoPlaceholderLinksRule } from '../rulesEngine/rules/NoPlaceholderLinksRule.js';
import { RouteRenameConsistencyRule } from '../rulesEngine/rules/RouteRenameConsistencyRule.js';
import { IdeBasedCodingJsonSyncRule } from '../rulesEngine/rules/IdeBasedCodingJsonSyncRule.js';
import { ScaffoldPrefilledCodeStep } from '../pipeline/steps/ScaffoldPrefilledCodeStep.js';
import { TransformSolutionCodeStep } from '../pipeline/steps/TransformSolutionCodeStep.js';
import { ValidateJavaScriptSyntaxStep } from '../pipeline/steps/ValidateJavaScriptSyntaxStep.js';
import { ValidateImportResolutionStep } from '../pipeline/steps/ValidateImportResolutionStep.js';
import { ValidateSolutionTestsStep } from '../pipeline/steps/ValidateSolutionTestsStep.js';
import { PromoteTestsToTestcaseStep } from '../pipeline/steps/PromoteTestsToTestcaseStep.js';
import { DeriveTestCasesStep } from '../pipeline/steps/DeriveTestCasesStep.js';
import { BuildIdeBasedCodingJsonStep } from '../pipeline/steps/BuildIdeBasedCodingJsonStep.js';
import { EnforceRulesStep } from '../pipeline/steps/EnforceRulesStep.js';
import { FinalValidationStep } from '../pipeline/steps/FinalValidationStep.js';
import { GenerationPipeline } from '../pipeline/GenerationPipeline.js';
import { ClaudeScenarioSpecGenerationService } from '../services/scenarioSpecGeneration/ClaudeScenarioSpecGenerationService.js';
import { OpenAiScenarioSpecGenerationService } from '../services/scenarioSpecGeneration/OpenAiScenarioSpecGenerationService.js';
import { OpenRouterScenarioSpecGenerationService } from '../services/scenarioSpecGeneration/OpenRouterScenarioSpecGenerationService.js';
import { ProviderRoutingScenarioSpecGenerationService } from '../services/scenarioSpecGeneration/ProviderRoutingScenarioSpecGenerationService.js';
import { ScenarioSpecAuthoringWorkflow } from '../authoring/ScenarioSpecAuthoringWorkflow.js';
import { SelfCorrectingScenarioWorkflow } from '../authoring/SelfCorrectingScenarioWorkflow.js';
import type { ScenarioSpecGenerationService } from '../services/scenarioSpecGeneration/ScenarioSpecGenerationService.js';

/**
 * The single place object graphs get wired up. Nothing outside this file
 * calls `new NodeFileSystemService(...)` etc. directly — every consumer
 * (CLI commands, tests) either uses this factory or builds its own graph
 * with fakes, keeping every other module dependent only on interfaces.
 */
export class CompositionRoot {
  readonly logger: Logger;
  readonly fileSystem: FileSystemService;

  private constructor(logger: Logger, fileSystem: FileSystemService) {
    this.logger = logger;
    this.fileSystem = fileSystem;
  }

  static create(logLevel: LogLevel = 'info'): CompositionRoot {
    const logger = new ConsoleLogger(logLevel);
    const fileSystem = new NodeFileSystemService(logger);
    return new CompositionRoot(logger, fileSystem);
  }

  /**
   * Builds a fresh pipeline graph. Pass `loggerOverride` to scope every
   * service's logging to something other than this root's default logger —
   * used by the API layer so each job's log lines are captured separately
   * instead of interleaving on the server's own stdout.
   */
  buildGenerationPipeline(loggerOverride?: Logger): GenerationPipeline {
    const logger = loggerOverride ?? this.logger;
    const fileSystem = loggerOverride ? new NodeFileSystemService(logger) : this.fileSystem;

    const idGenerator = new CryptoUuidGeneratorService();
    const testRunner = new NpmVitestRunnerService(logger);
    const textTransformation = new OrderedReplacementTransformationService();
    const testCaseDerivation = new MarkerBasedTestCaseDerivationService();

    const rulesRegistry = new RulesRegistry(logger)
      .register(new PackageJsonAlignmentRule())
      .register(new TestcaseFolderImmutabilityRule())
      .register(new TestFileParityRule())
      .register(new ColorPaletteCompletenessRule())
      .register(new NoPlaceholderLinksRule())
      .register(new RouteRenameConsistencyRule())
      .register(new IdeBasedCodingJsonSyncRule(testCaseDerivation));

    const steps = [
      new ScaffoldPrefilledCodeStep(fileSystem, logger.child('ScaffoldPrefilledCodeStep')),
      new TransformSolutionCodeStep(fileSystem, textTransformation, logger.child('TransformSolutionCodeStep')),
      new ValidateJavaScriptSyntaxStep(fileSystem),
      new ValidateImportResolutionStep(fileSystem),
      new ValidateSolutionTestsStep(fileSystem, testRunner),
      new PromoteTestsToTestcaseStep(fileSystem),
      new DeriveTestCasesStep(fileSystem, testCaseDerivation),
      new BuildIdeBasedCodingJsonStep(fileSystem, idGenerator),
      new EnforceRulesStep(rulesRegistry, fileSystem),
      new FinalValidationStep(testRunner),
    ];

    return new GenerationPipeline(steps, logger);
  }

  /**
   * Builds the spec-authoring workflow — the one LLM-backed capability in
   * this codebase, kept entirely separate from `buildGenerationPipeline()`
   * (which stays 100% deterministic). Dispatches to Claude, OpenAI, or
   * OpenRouter per request (`request.provider`, defaulting to 'anthropic')
   * via ProviderRoutingScenarioSpecGenerationService — a request without an
   * explicit `apiKey` falls back to that provider's own env-credential
   * resolution (ANTHROPIC_API_KEY/`ant auth login`, OPENAI_API_KEY, or
   * OPENROUTER_API_KEY).
   */
  buildScenarioSpecAuthoringWorkflow(loggerOverride?: Logger): ScenarioSpecAuthoringWorkflow {
    const logger = loggerOverride ?? this.logger;
    const fileSystem = loggerOverride ? new NodeFileSystemService(logger) : this.fileSystem;

    return new ScenarioSpecAuthoringWorkflow(fileSystem, this.buildScenarioSpecGenerationService(logger), logger);
  }

  /**
   * Builds the self-correcting variant: drafts a spec, actually runs it
   * through buildGenerationPipeline(), and — if it fails its own tests or
   * any rule — feeds that real failure back to the model for a revision,
   * retrying up to a few times, instead of handing a human a one-shot draft
   * that's likely to need a manual follow-up round. See
   * SelfCorrectingScenarioWorkflow's doc comment.
   */
  buildSelfCorrectingScenarioWorkflow(loggerOverride?: Logger): SelfCorrectingScenarioWorkflow {
    const logger = loggerOverride ?? this.logger;
    const fileSystem = loggerOverride ? new NodeFileSystemService(logger) : this.fileSystem;

    const generationService = this.buildScenarioSpecGenerationService(logger);
    const authoringWorkflow = new ScenarioSpecAuthoringWorkflow(fileSystem, generationService, logger);
    const generationPipeline = this.buildGenerationPipeline(logger);

    return new SelfCorrectingScenarioWorkflow(fileSystem, generationService, authoringWorkflow, generationPipeline, logger);
  }

  private buildScenarioSpecGenerationService(logger: Logger): ScenarioSpecGenerationService {
    return new ProviderRoutingScenarioSpecGenerationService({
      anthropic: new ClaudeScenarioSpecGenerationService(logger),
      openai: new OpenAiScenarioSpecGenerationService(logger),
      openrouter: new OpenRouterScenarioSpecGenerationService(logger),
    });
  }
}

import path from 'node:path';
import type { PipelineStep } from '../PipelineStep.js';
import type { PipelineContext } from '../PipelineContext.js';
import type { FileSystemService } from '../../services/fileSystem/FileSystemService.js';
import type { IdGeneratorService } from '../../services/idGenerator/IdGeneratorService.js';
import { packageName } from '../../domain/models/ScenarioSpec.js';
import { toIdeBasedCodingTestCase } from '../../domain/models/TestCase.js';
import { findReadmeFile } from './findReadmeFile.js';
import { FileSystemError } from '../../domain/errors/GenerationError.js';

interface IdeBasedCodingDocument {
  readonly question_id: string;
  readonly ide_session_id: string;
  readonly short_text: string;
  readonly question_key: number;
  readonly question_text: string;
  readonly content_type: string;
  readonly toughness: string;
  readonly language: string;
  readonly question_type: string;
  readonly question_asked_by_companies_info: readonly unknown[];
  readonly question_format: string;
  readonly test_cases: ReadonlyArray<{ test_case_enum: string; display_text: string; weightage: number }>;
  readonly multimedia: readonly unknown[];
  readonly solutions_metadata: readonly unknown[];
  readonly hints: readonly unknown[];
}

/**
 * question_text is the already-generated README.md, re-encoded with CRLF
 * line endings to match the original platform export's convention, then
 * escaped into the JSON string by JSON.stringify (never hand-escaped).
 */
function toCrlf(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
}

export class BuildIdeBasedCodingJsonStep implements PipelineStep {
  readonly name = 'BuildIdeBasedCodingJsonStep';
  private readonly fileSystem: FileSystemService;
  private readonly idGenerator: IdGeneratorService;

  constructor(fileSystem: FileSystemService, idGenerator: IdGeneratorService) {
    this.fileSystem = fileSystem;
    this.idGenerator = idGenerator;
  }

  async execute(context: PipelineContext): Promise<void> {
    if (!context.solutionCodePath || !context.testCases) {
      throw new FileSystemError(
        'solutionCodePath/testCases are not set — TransformSolutionCodeStep and DeriveTestCasesStep must run first'
      );
    }

    // TransformSolutionCodeStep already guarantees a readme exists here (any casing) — this
    // step still resolves it itself, via the same case-insensitive lookup, rather than assuming
    // the exact filename "README.md".
    const readmePath = await findReadmeFile(this.fileSystem, context.solutionCodePath);
    if (!readmePath) {
      throw new FileSystemError(`No readme file found at the root of "${context.solutionCodePath}"`, {
        solutionCodePath: context.solutionCodePath,
      });
    }
    const readmeResult = await this.fileSystem.readFile(readmePath);
    if (!readmeResult.ok) {
      throw readmeResult.error;
    }

    const questionId = this.idGenerator.generateUuid();
    const ideSessionId = this.idGenerator.generateUuid();
    const { platformMetadata } = context.spec;

    const document: IdeBasedCodingDocument = {
      question_id: questionId,
      ide_session_id: ideSessionId,
      short_text: packageName(context.spec),
      question_key: 0,
      question_text: toCrlf(readmeResult.value),
      content_type: platformMetadata.contentType,
      toughness: platformMetadata.toughness,
      language: platformMetadata.language,
      question_type: platformMetadata.questionType,
      question_asked_by_companies_info: [],
      question_format: platformMetadata.questionFormat,
      test_cases: context.testCases.map(toIdeBasedCodingTestCase),
      multimedia: [],
      solutions_metadata: [],
      hints: [],
    };

    const outputPath = path.join(context.spec.paths.ideBasedCodingOutputDir, `${questionId}.json`);
    const writeResult = await this.fileSystem.writeFile(outputPath, JSON.stringify([document], null, 2));
    if (!writeResult.ok) {
      throw writeResult.error;
    }

    context.questionId = questionId;
    context.ideSessionId = ideSessionId;
    context.ideBasedCodingJsonPath = outputPath;
  }
}

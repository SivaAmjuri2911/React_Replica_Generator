import { outputIdeBasedCodingPath, packageName } from '../../domain/models/ScenarioSpec.js';
import { toIdeBasedCodingTestCase } from '../../domain/models/TestCase.js';
import { findReadmeFile } from './findReadmeFile.js';
import { FileSystemError } from '../../domain/errors/GenerationError.js';

/**
 * @typedef {object} IdeBasedCodingDocument
 * @property {string} question_id
 * @property {string} ide_session_id
 * @property {string} short_text
 * @property {number} question_key
 * @property {string} question_text
 * @property {string} content_type
 * @property {string} toughness
 * @property {string} language
 * @property {string} question_type
 * @property {readonly unknown[]} question_asked_by_companies_info
 * @property {string} question_format
 * @property {ReadonlyArray<{test_case_enum: string, display_text: string, weightage: number}>} test_cases
 * @property {readonly unknown[]} multimedia
 * @property {readonly unknown[]} solutions_metadata
 * @property {readonly unknown[]} hints
 */

/**
 * question_text is the already-generated README.md, re-encoded with CRLF
 * line endings to match the original platform export's convention, then
 * escaped into the JSON string by JSON.stringify (never hand-escaped).
 */
function toCrlf(text) {
    return text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
}
/**
 * @implements {PipelineStep}
 */
export class BuildIdeBasedCodingJsonStep {
    name = 'BuildIdeBasedCodingJsonStep';
    fileSystem;
    idGenerator;
    constructor(fileSystem, idGenerator) {
        this.fileSystem = fileSystem;
        this.idGenerator = idGenerator;
    }
    async execute(context) {
        if (!context.solutionCodePath || !context.testCases) {
            throw new FileSystemError('solutionCodePath/testCases are not set — TransformSolutionCodeStep and DeriveTestCasesStep must run first');
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
        const document = {
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
        const outputPath = outputIdeBasedCodingPath(context.spec, questionId);
        const writeResult = await this.fileSystem.writeFile(outputPath, JSON.stringify([document], null, 2));
        if (!writeResult.ok) {
            throw writeResult.error;
        }
        context.questionId = questionId;
        context.ideSessionId = ideSessionId;
        context.ideBasedCodingJsonPath = outputPath;
    }
}

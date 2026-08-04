import { describe, expect, it } from 'vitest';
import { PackageJsonAlignmentRule } from '../../../src/rulesEngine/rules/PackageJsonAlignmentRule.js';
import { InMemoryFileSystemService } from '../fakes/InMemoryFileSystemService.js';
import type { ScenarioSpec } from '../../../src/domain/models/ScenarioSpec.js';
import type { GeneratedProject } from '../../../src/domain/models/GeneratedProject.js';

function buildSpec(): ScenarioSpec {
  return {
    scenarioName: 'ticket-management',
    outputFolderBaseName: 'TicketManagement',
    testPrefix: 'ABC',
    platformMetadata: {
      contentType: 'MARKDOWN',
      toughness: 'EASY',
      language: 'ENGLISH',
      questionType: 'IDE_BASED_CODING',
      questionFormat: 'CODING_PRACTICE',
    },
    paths: {
      basePrefilledCode: '/base/prefilled',
      baseSolutionCode: '/base/solution',
      baseTestcase: '/base/testcase',
      ideBasedCodingOutputDir: '/out/json',
      outputRoot: '/out',
      stagingDir: '/staging',
    },
    textReplacements: [],
    fileRenames: [],
    transformableRelativePaths: [],
    colorSwaps: [],
    manuallyAuthoredRelativePaths: [],
  };
}

function buildGeneratedProject(): GeneratedProject {
  return {
    scenarioName: 'ticket-management',
    prefilledCodePath: '/out/Prefilled',
    solutionCodePath: '/out/Solution',
    testcasePath: '/out/Testcase',
    ideBasedCodingJsonPath: '/out/json/id.json',
    testCases: [],
    questionId: 'q1',
    ideSessionId: 's1',
  };
}

describe('PackageJsonAlignmentRule', () => {
  const rule = new PackageJsonAlignmentRule();

  it('passes when all three package.json files share the expected name', async () => {
    const fileSystem = new InMemoryFileSystemService();
    const generatedProject = buildGeneratedProject();
    const expectedJson = JSON.stringify({ name: 'ticket-management-project' });
    fileSystem.seed(`${generatedProject.prefilledCodePath}/package.json`, expectedJson);
    fileSystem.seed(`${generatedProject.solutionCodePath}/package.json`, expectedJson);
    fileSystem.seed(`${generatedProject.testcasePath}/package.json`, expectedJson);

    const result = await rule.evaluate({ spec: buildSpec(), generatedProject, fileSystem });

    expect(result.ok).toBe(true);
  });

  it('fails when one package.json has a different name', async () => {
    const fileSystem = new InMemoryFileSystemService();
    const generatedProject = buildGeneratedProject();
    fileSystem.seed(
      `${generatedProject.prefilledCodePath}/package.json`,
      JSON.stringify({ name: 'ticket-management-project' })
    );
    fileSystem.seed(
      `${generatedProject.solutionCodePath}/package.json`,
      JSON.stringify({ name: 'WRONG-NAME' })
    );
    fileSystem.seed(
      `${generatedProject.testcasePath}/package.json`,
      JSON.stringify({ name: 'ticket-management-project' })
    );

    const result = await rule.evaluate({ spec: buildSpec(), generatedProject, fileSystem });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('WRONG-NAME');
    }
  });
});

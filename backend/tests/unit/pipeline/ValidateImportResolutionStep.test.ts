import { describe, expect, it } from 'vitest';
import { ValidateImportResolutionStep } from '../../../src/pipeline/steps/ValidateImportResolutionStep.js';
import { PipelineContext } from '../../../src/pipeline/PipelineContext.js';
import { InMemoryFileSystemService } from '../fakes/InMemoryFileSystemService.js';
import type { ScenarioSpec } from '../../../src/domain/models/ScenarioSpec.js';

function buildSpec(): ScenarioSpec {
  return {
    scenarioName: 'work-order-management',
    outputFolderBaseName: 'WorkOrderManagement',
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

function buildContext(solutionCodePath: string): PipelineContext {
  const context = new PipelineContext(buildSpec());
  context.solutionCodePath = solutionCodePath;
  return context;
}

describe('ValidateImportResolutionStep', () => {
  const step = new ValidateImportResolutionStep(new InMemoryFileSystemService());
  const solutionCodePath = '/out/Solution';

  it('throws when an import references a component that does not exist on disk', async () => {
    const fileSystem = new InMemoryFileSystemService();
    // The exact real-world bug: a chained textReplacements entry corrupted "VendorsPage" into
    // "VendorssPage" everywhere it was referenced, including this import.
    fileSystem.seed(
      `${solutionCodePath}/src/App.jsx`,
      "import VendorssPage from './components/VendorssPage';\nexport default function App() { return <VendorssPage />; }"
    );
    fileSystem.seed(`${solutionCodePath}/src/components/VendorsPage.jsx`, 'export default function VendorsPage() { return null; }');

    const localStep = new ValidateImportResolutionStep(fileSystem);
    await expect(localStep.execute(buildContext(solutionCodePath))).rejects.toThrow(/VendorssPage/);
  });

  it('passes when every import resolves to a real file', async () => {
    const fileSystem = new InMemoryFileSystemService();
    fileSystem.seed(
      `${solutionCodePath}/src/App.jsx`,
      "import VendorsPage from './components/VendorsPage';\nimport './App.css';\nexport default function App() { return <VendorsPage />; }"
    );
    fileSystem.seed(`${solutionCodePath}/src/components/VendorsPage.jsx`, 'export default function VendorsPage() { return null; }');
    fileSystem.seed(`${solutionCodePath}/src/App.css`, '.app {}');

    const localStep = new ValidateImportResolutionStep(fileSystem);
    await expect(localStep.execute(buildContext(solutionCodePath))).resolves.toBeUndefined();
  });

  it('resolves an extensionless import against a directory index file', async () => {
    const fileSystem = new InMemoryFileSystemService();
    fileSystem.seed(`${solutionCodePath}/src/App.jsx`, "import utils from './utils';\nexport default utils;");
    fileSystem.seed(`${solutionCodePath}/src/utils/index.js`, 'export default {};');

    const localStep = new ValidateImportResolutionStep(fileSystem);
    await expect(localStep.execute(buildContext(solutionCodePath))).resolves.toBeUndefined();
  });

  it('ignores non-relative (package) imports entirely', async () => {
    const fileSystem = new InMemoryFileSystemService();
    fileSystem.seed(`${solutionCodePath}/src/App.jsx`, "import { useState } from 'react';\nexport default function App() {}");

    const localStep = new ValidateImportResolutionStep(fileSystem);
    await expect(localStep.execute(buildContext(solutionCodePath))).resolves.toBeUndefined();
  });

  it('resolves a parent-directory (../) relative import correctly', async () => {
    const fileSystem = new InMemoryFileSystemService();
    fileSystem.seed(
      `${solutionCodePath}/src/components/WorkOrderDetailPage.jsx`,
      "import { formatDate } from '../utils/dateFormat';\nexport default function WorkOrderDetailPage() {}"
    );
    fileSystem.seed(`${solutionCodePath}/src/utils/dateFormat.js`, 'export function formatDate() {}');

    const localStep = new ValidateImportResolutionStep(fileSystem);
    await expect(localStep.execute(buildContext(solutionCodePath))).resolves.toBeUndefined();
  });

  it('throws a RuleViolationError with a solutionCodePath guidance message when the path is unset', async () => {
    await expect(step.execute(new PipelineContext(buildSpec()))).rejects.toThrow(/solutionCodePath/);
  });
});

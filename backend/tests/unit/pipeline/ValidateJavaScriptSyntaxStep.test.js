import { describe, expect, it } from 'vitest';
import { ValidateJavaScriptSyntaxStep } from '../../../src/pipeline/steps/ValidateJavaScriptSyntaxStep.js';
import { PipelineContext } from '../../../src/pipeline/PipelineContext.js';
import { InMemoryFileSystemService } from '../fakes/InMemoryFileSystemService.js';
function buildSpec() {
    return {
        scenarioName: 'service-request-management',
        outputFolderBaseName: 'ServiceRequestManagement',
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
function buildContext(solutionCodePath) {
    const context = new PipelineContext(buildSpec());
    context.solutionCodePath = solutionCodePath;
    return context;
}
describe('ValidateJavaScriptSyntaxStep', () => {
    const solutionCodePath = '/out/Solution';
    it('throws when a manually-authored file still has a leaked "--- FILE: path ---" header as its first line', async () => {
        const fileSystem = new InMemoryFileSystemService();
        fileSystem.seed(`${solutionCodePath}/src/__tests__/ServiceRequest.test.jsx`, "--- FILE: src/__tests__/ServiceRequest.test.jsx ---\nimport { describe, it } from 'vitest';\ndescribe('x', () => {});");
        const step = new ValidateJavaScriptSyntaxStep(fileSystem);
        await expect(step.execute(buildContext(solutionCodePath))).rejects.toThrow(/ServiceRequest\.test\.jsx/);
    });
    it('throws when a chained replacement injected a space into a variable name', async () => {
        const fileSystem = new InMemoryFileSystemService();
        // The exact real-world bug: "Bid" -> "Service Request" fired inside "setBid", producing an
        // invalid identifier with an embedded space.
        fileSystem.seed(`${solutionCodePath}/src/components/ServiceRequestDetailPage.jsx`, "import { useState } from 'react';\nfunction Page() {\n  const [bid, setService Request] = useState(null);\n  return null;\n}\nexport default Page;");
        const step = new ValidateJavaScriptSyntaxStep(fileSystem);
        await expect(step.execute(buildContext(solutionCodePath))).rejects.toThrow(/ServiceRequestDetailPage\.jsx/);
    });
    it('passes when every generated file is valid JSX', async () => {
        const fileSystem = new InMemoryFileSystemService();
        fileSystem.seed(`${solutionCodePath}/src/App.jsx`, "import React from 'react';\nexport default function App() {\n  return <div>Hello</div>;\n}");
        fileSystem.seed(`${solutionCodePath}/src/App.css`, '.app { color: red; }');
        fileSystem.seed(`${solutionCodePath}/sampleData.js`, 'export const data = [1, 2, 3];');
        const step = new ValidateJavaScriptSyntaxStep(fileSystem);
        await expect(step.execute(buildContext(solutionCodePath))).resolves.toBeUndefined();
    });
    it('ignores non-source files entirely', async () => {
        const fileSystem = new InMemoryFileSystemService();
        fileSystem.seed(`${solutionCodePath}/README.md`, 'This is not valid JS at all: <<< {{{ ??? ---');
        fileSystem.seed(`${solutionCodePath}/package.json`, '{ "name": "x" }');
        const step = new ValidateJavaScriptSyntaxStep(fileSystem);
        await expect(step.execute(buildContext(solutionCodePath))).resolves.toBeUndefined();
    });
});

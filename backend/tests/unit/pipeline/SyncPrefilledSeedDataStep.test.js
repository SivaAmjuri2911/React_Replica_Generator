import { describe, expect, it } from 'vitest';
import { SyncPrefilledSeedDataStep } from '../../../src/pipeline/steps/SyncPrefilledSeedDataStep.js';
import { InMemoryFileSystemService } from '../fakes/InMemoryFileSystemService.js';

describe('SyncPrefilledSeedDataStep', () => {
    it('copies transformed seed-data arrays from solution into matching prefilled files', async () => {
        const fileSystem = new InMemoryFileSystemService();
        const prefilledRoot = '/output/Prefilled';
        const solutionRoot = '/output/Solution';
        fileSystem.seed(`${prefilledRoot}/src/App.jsx`, `import './App.css';

const articles = [
  { id: '1', title: 'Old headline' },
];

const App = () => <h1>Starter</h1>;
export default App;
`);
        fileSystem.seed(`${solutionRoot}/src/App.jsx`, `import './App.css';

const records = [
  { id: '1', title: 'New headline' },
  { id: '2', title: 'Another record' },
];

const App = () => <div>Done</div>;
export default App;
`);
        const step = new SyncPrefilledSeedDataStep(fileSystem, { debug() {} });
        await step.execute({
            spec: {
                manuallyAuthoredRelativePaths: ['src/App.jsx'],
                transformableRelativePaths: [],
            },
            prefilledCodePath: prefilledRoot,
            solutionCodePath: solutionRoot,
        });
        const syncedResult = await fileSystem.readFile(`${prefilledRoot}/src/App.jsx`);
        expect(syncedResult.ok).toBe(true);
        if (syncedResult.ok) {
            expect(syncedResult.value).toContain('const records = [');
            expect(syncedResult.value).toContain('New headline');
            expect(syncedResult.value).toContain('<h1>Starter</h1>');
            expect(syncedResult.value).not.toContain('Old headline');
        }
    });
});

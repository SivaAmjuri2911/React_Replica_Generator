import { describe, expect, it } from 'vitest';
import {
    findLeadingConstArrayDeclaration,
    replaceLeadingConstArrayDeclaration,
} from '../../../src/pipeline/steps/prefilledSeedDataUtils.js';

describe('prefilledSeedDataUtils', () => {
    const prefilled = `import './App.css';

const articles = [
  { id: '1', title: 'Old headline', author: 'Priya' },
];

const App = () => <h1>Hello World!!</h1>;

export default App;
`;

    const solution = `import { useState } from 'react';
import './App.css';

const records = [
  { id: '1', title: 'Midnight Echoes', artist: 'Lena' },
  { id: '2', title: 'Golden Hour', artist: 'Marcus' },
];

const App = () => null;
export default App;
`;

    it('finds the leading seed-data array declaration', () => {
        expect(findLeadingConstArrayDeclaration(prefilled)?.name).toBe('articles');
        expect(findLeadingConstArrayDeclaration(solution)?.name).toBe('records');
    });

    it('replaces prefilled seed data with the solution declaration while keeping the starter UI', () => {
        const solutionData = findLeadingConstArrayDeclaration(solution);
        expect(solutionData).toBeDefined();
        const synced = replaceLeadingConstArrayDeclaration(prefilled, solutionData.declaration);
        expect(synced).toContain('const records = [');
        expect(synced).toContain('Midnight Echoes');
        expect(synced).not.toContain('const articles = [');
        expect(synced).toContain('<h1>Hello World!!</h1>');
    });
});

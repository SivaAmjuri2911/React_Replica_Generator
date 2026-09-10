import { describe, expect, it } from 'vitest';
import { MarkerBasedTestCaseDerivationService } from '../../../src/services/testCaseDerivation/MarkerBasedTestCaseDerivationService.js';
describe('MarkerBasedTestCaseDerivationService', () => {
    const service = new MarkerBasedTestCaseDerivationService();
    it('derives test cases from legacy TEST markers with uppercase test segment', () => {
        const contents = `it(':::ABC_TEST_1:::First check:::5:::', () => {});`;
        const result = service.deriveFromTestFileContents(contents, 'ABC');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value[0]?.testCaseEnum).toBe('ABC_test_1');
        }
    });

    it('derives test cases from valid sequential markers', () => {
        const contents = `
      it(':::ABC_test_1:::First check:::5:::', () => {});
      it(':::ABC_test_2:::Second check:::10:::', () => {});
    `;
        const result = service.deriveFromTestFileContents(contents, 'ABC');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toEqual([
                { testCaseEnum: 'ABC_test_1', displayText: 'First check:::5:::', weightage: 5 },
                { testCaseEnum: 'ABC_test_2', displayText: 'Second check:::10:::', weightage: 10 },
            ]);
        }
    });
    it('fails when the prefix does not match the expected scenario prefix', () => {
        const contents = `it(':::WRONG_test_1:::Something:::5:::', () => {});`;
        const result = service.deriveFromTestFileContents(contents, 'ABC');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('WRONG');
        }
    });
    it('fails on duplicate test_case_enum values', () => {
        const contents = `
      it(':::ABC_test_1:::First:::5:::', () => {});
      it(':::ABC_test_1:::Duplicate:::5:::', () => {});
    `;
        const result = service.deriveFromTestFileContents(contents, 'ABC');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('Duplicate');
        }
    });
    it('fails on non-sequential test numbering', () => {
        const contents = `
      it(':::ABC_test_1:::First:::5:::', () => {});
      it(':::ABC_test_3:::Skipped two:::5:::', () => {});
    `;
        const result = service.deriveFromTestFileContents(contents, 'ABC');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('not sequential');
        }
    });
    it('fails when no markers are present at all', () => {
        const result = service.deriveFromTestFileContents('it("no markers here", () => {});', 'ABC');
        expect(result.ok).toBe(false);
    });
    it('preserves multi-line descriptions inside a single marker', () => {
        const contents = `it(':::ABC_test_1:::Line one\nLine two:::5:::', () => {});`;
        const result = service.deriveFromTestFileContents(contents, 'ABC');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value[0]?.displayText).toBe('Line one\nLine two:::5:::');
        }
    });
});

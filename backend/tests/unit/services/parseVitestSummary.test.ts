import { describe, expect, it } from 'vitest';
import { parseVitestSummary } from '../../../src/services/testRunner/parseVitestSummary.js';

describe('parseVitestSummary', () => {
  it('parses an all-passed summary ("N passed (total)")', () => {
    const result = parseVitestSummary(' Test Files  1 passed (1)\n      Tests  48 passed (48)\n');
    expect(result).toEqual({ passed: true, totalTests: 48, passedTests: 48, rawOutput: expect.any(String) });
  });

  it('parses a failed-first summary ("N failed | M passed (total)") — the order Vitest actually uses when anything fails', () => {
    const result = parseVitestSummary(' Test Files  1 failed (1)\n      Tests  10 failed | 38 passed (48)\n');
    expect(result).toEqual({ passed: false, totalTests: 48, passedTests: 38, rawOutput: expect.any(String) });
  });

  it('does not confuse the "Test Files" line above with the "Tests" summary line', () => {
    const result = parseVitestSummary(' Test Files  1 failed (1)\n      Tests  2 failed | 3 passed (5)\n');
    expect(result?.totalTests).toBe(5);
    expect(result?.passedTests).toBe(3);
  });

  it('returns undefined when there is no parseable summary at all', () => {
    const result = parseVitestSummary('SyntaxError: Unexpected token\n    at Module._compile');
    expect(result).toBeUndefined();
  });

  it('parses real ANSI-colorized output captured from child_process.exec, including escape codes sitting directly before "Tests"', () => {
    // Byte-for-byte the actual bytes vitest wrote when its stdout was captured via
    // exec() rather than a real TTY — colorizes by default either way. The escape
    // codes appear before "Tests" itself (breaking a naive ^\s*Tests anchor) and
    // between numbers and the words after them.
    const rawOutput =
      '\x1b[2m Test Files \x1b[22m \x1b[1m\x1b[31m1 failed\x1b[39m\x1b[22m\x1b[90m (1)\x1b[39m\n' +
      '\x1b[2m      Tests \x1b[22m \x1b[1m\x1b[31m11 failed\x1b[39m\x1b[22m\x1b[2m | \x1b[22m\x1b[1m\x1b[32m37 passed\x1b[39m\x1b[22m\x1b[90m (48)\x1b[39m\n';
    const result = parseVitestSummary(rawOutput);
    expect(result).toMatchObject({ passed: false, totalTests: 48, passedTests: 37 });
  });
});

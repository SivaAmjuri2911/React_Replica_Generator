import type { TestRunResult } from './TestRunnerService.js';

/**
 * Isolates Vitest's "Tests" summary line (not the "Test Files" line above
 * it) so passed/failed counts are read only from there. Deliberately does
 * NOT assume "passed" comes before "failed" within that line — Vitest
 * prints "N passed (total)" when everything passes, but flips the order to
 * "N failed | M passed (total)" the moment anything fails, and an
 * order-locked regex silently fails to match that second, arguably more
 * important case (a run with real failures), misreporting it as an
 * infrastructure error instead of the correct "N/M passed" outcome.
 */
const TESTS_SUMMARY_LINE_PATTERN = /^\s*Tests\s+(.+?)\((\d+)\)/m;
const PASSED_COUNT_PATTERN = /(\d+)\s+passed/;
const FAILED_COUNT_PATTERN = /(\d+)\s+failed/;
/**
 * Vitest colorizes its output by default even when captured through
 * `child_process.exec` rather than a real TTY — including ANSI codes
 * directly in front of "Tests" itself (e.g. dim-style before the label,
 * bold/color codes wrapping each number). Left in place, those escape
 * bytes break `^\s*Tests` (they aren't whitespace) and can sit between a
 * number and the word after it, so every real captured run needs this
 * stripped before any of the patterns above have a chance to match.
 */
const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*m/g;

export function parseVitestSummary(rawOutput: string): TestRunResult | undefined {
  const plainOutput = rawOutput.replace(ANSI_ESCAPE_PATTERN, '');
  const summaryMatch = TESTS_SUMMARY_LINE_PATTERN.exec(plainOutput);
  if (!summaryMatch) {
    return undefined;
  }
  const [, summaryLine, totalText] = summaryMatch;
  const passedMatch = PASSED_COUNT_PATTERN.exec(summaryLine!);
  const failedMatch = FAILED_COUNT_PATTERN.exec(summaryLine!);
  const passedTests = passedMatch ? Number(passedMatch[1]) : 0;
  const failedTests = failedMatch ? Number(failedMatch[1]) : 0;
  const totalTests = Number(totalText);
  return {
    passed: failedTests === 0 && totalTests > 0,
    totalTests,
    passedTests,
    rawOutput,
  };
}

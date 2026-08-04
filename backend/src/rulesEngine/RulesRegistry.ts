import type { GenerationRule, RuleEvaluationContext } from './GenerationRule.js';
import { err, ok, type Result } from '../shared/Result.js';
import { RuleViolationError } from '../domain/errors/GenerationError.js';
import type { Logger } from '../logging/Logger.js';

/**
 * Runs every registered rule and collects all violations rather than
 * stopping at the first one, so a single generation attempt reports every
 * problem at once instead of forcing a fix-rerun-fix cycle per rule.
 */
export class RulesRegistry {
  private readonly rules: GenerationRule[] = [];
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child('RulesRegistry');
  }

  register(rule: GenerationRule): this {
    this.rules.push(rule);
    return this;
  }

  async evaluateAll(context: RuleEvaluationContext): Promise<Result<void, RuleViolationError[]>> {
    const violations: RuleViolationError[] = [];

    for (const rule of this.rules) {
      this.logger.debug('Evaluating rule', { rule: rule.name });
      const result = await rule.evaluate(context);
      if (!result.ok) {
        violations.push(result.error);
      }
    }

    if (violations.length > 0) {
      return err(violations);
    }
    return ok(undefined);
  }
}

export function summarizeViolations(violations: readonly RuleViolationError[]): string {
  return violations.map((violation) => `- [${violation.ruleName}] ${violation.message}`).join('\n');
}

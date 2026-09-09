import { err, ok } from '../shared/Result.js';
/**
 * Runs every registered rule and collects all violations rather than
 * stopping at the first one, so a single generation attempt reports every
 * problem at once instead of forcing a fix-rerun-fix cycle per rule.
 */
export class RulesRegistry {
    rules = [];
    logger;
    constructor(logger) {
        this.logger = logger.child('RulesRegistry');
    }
    register(rule) {
        this.rules.push(rule);
        return this;
    }
    async evaluateAll(context) {
        const violations = [];
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
export function summarizeViolations(violations) {
    return violations.map((violation) => `- [${violation.ruleName}] ${violation.message}`).join('\n');
}

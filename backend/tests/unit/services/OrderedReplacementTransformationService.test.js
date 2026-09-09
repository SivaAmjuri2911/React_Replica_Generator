import { describe, expect, it } from 'vitest';
import { OrderedReplacementTransformationService } from '../../../src/services/textTransformation/OrderedReplacementTransformationService.js';
describe('OrderedReplacementTransformationService', () => {
    const service = new OrderedReplacementTransformationService();
    it('applies a single replacement globally', () => {
        const result = service.applyReplacements('bid bid bid', [{ from: 'bid', to: 'ticket' }]);
        expect(result).toBe('ticket ticket ticket');
    });
    it('applies replacements in order, earlier ones affecting later matches', () => {
        const result = service.applyReplacements('bidNumber and bid', [
            { from: 'bidNumber', to: 'ticketNumber' },
            { from: 'bid', to: 'ticket' },
        ]);
        // "bidNumber" is consumed by the first, more specific replacement first,
        // so the second, broader replacement only touches the standalone "bid".
        expect(result).toBe('ticketNumber and ticket');
    });
    it('does not require regex escaping for special characters', () => {
        const result = service.applyReplacements('path="/bid/:id"', [{ from: '/bid/:id', to: '/ticket/:id' }]);
        expect(result).toBe('path="/ticket/:id"');
    });
    it('leaves content unchanged when there is nothing to replace', () => {
        const result = service.applyReplacements('unchanged content', [{ from: 'notfound', to: 'x' }]);
        expect(result).toBe('unchanged content');
    });
    it('returns the original string when given no replacements', () => {
        const result = service.applyReplacements('as-is', []);
        expect(result).toBe('as-is');
    });
    describe('applySimultaneousReplacements', () => {
        it('does not chain — an earlier target that equals a later source is not double-transformed', () => {
            // Regression case for a real generated scenario: colorSwaps included both
            // "#ffffff" -> "#f8fafc" and, for a different original color, "#f8fafc" -> "#e2e8f0".
            // applyReplacements (chained) turned #ffffff into #e2e8f0 because the first swap's
            // output fed the second swap. Colors must land on their own declared target only.
            const result = service.applySimultaneousReplacements('#ffffff and #123456', [
                { from: '#ffffff', to: '#f8fafc' },
                { from: '#f8fafc', to: '#e2e8f0' },
                { from: '#123456', to: '#f8fafc' },
            ]);
            expect(result).toBe('#f8fafc and #f8fafc');
        });
        it('resolves a two-way swap without either value clobbering the other', () => {
            const result = service.applySimultaneousReplacements('#111111 #222222', [
                { from: '#111111', to: '#222222' },
                { from: '#222222', to: '#111111' },
            ]);
            expect(result).toBe('#222222 #111111');
        });
        it('prefers the longer match at a given position, same as ordered replacement', () => {
            const result = service.applySimultaneousReplacements('bidNumber and bid', [
                { from: 'bid', to: 'ticket' },
                { from: 'bidNumber', to: 'ticketNumber' },
            ]);
            expect(result).toBe('ticketNumber and ticket');
        });
        it('returns the original string when given no replacements', () => {
            const result = service.applySimultaneousReplacements('as-is', []);
            expect(result).toBe('as-is');
        });
    });
});

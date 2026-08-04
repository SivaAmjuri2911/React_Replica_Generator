import { describe, expect, it } from 'vitest';
import { ConsoleLogger } from '../../../src/logging/ConsoleLogger.js';
import { CompositionRoot } from '../../../src/config/CompositionRoot.js';
import { GENERATION_STEP_LABELS } from '../../../src/config/progressLabels.js';

describe('progressLabels', () => {
  it('lists generation steps in the exact order CompositionRoot builds the real pipeline in', () => {
    const compositionRoot = CompositionRoot.create('error');
    const pipeline = compositionRoot.buildGenerationPipeline(new ConsoleLogger('error'));

    expect(pipeline.stepNames).toEqual(GENERATION_STEP_LABELS.map((step) => step.name));
  });
});

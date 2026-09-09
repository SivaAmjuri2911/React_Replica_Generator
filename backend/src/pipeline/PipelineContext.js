/**
 * Mutable, orchestrator-internal state threaded through pipeline steps.
 * Deliberately not the same type as the public `GeneratedProject` domain
 * model — this carries in-progress state (e.g. paths that don't exist yet
 * when early steps run) that the final, immutable GeneratedProject should
 * never expose.
 */
export class PipelineContext {
    spec;
    prefilledCodePath;
    solutionCodePath;
    testcasePath;
    validatedTestFilePath;
    testCases;
    ideBasedCodingJsonPath;
    questionId;
    ideSessionId;
    constructor(spec) {
        this.spec = spec;
    }
}

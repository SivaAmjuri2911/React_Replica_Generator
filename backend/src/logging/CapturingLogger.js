/**
 * @typedef {(line: import('../domain/models/GenerationJob.js').GenerationLogLine) => void} LogLineSink
 */

/**
 * Wraps a delegate Logger (e.g. ConsoleLogger, for the server's own stdout)
 * and additionally pushes every log line to a sink — used by
 * GenerationJobService to capture per-job logs for the API/UI to poll,
 * without the pipeline/services/rules layers knowing anything about jobs.
 */
/**
 * @implements {Logger}
 */
export class CapturingLogger {
    delegate;
    sink;
    scope;
    constructor(delegate, sink, scope) {
        this.delegate = delegate;
        this.sink = sink;
        this.scope = scope;
    }
    debug(message, fields) {
        this.emit('debug', message, fields);
    }
    info(message, fields) {
        this.emit('info', message, fields);
    }
    warn(message, fields) {
        this.emit('warn', message, fields);
    }
    error(message, fields) {
        this.emit('error', message, fields);
    }
    child(scope) {
        const nested = this.scope ? `${this.scope}:${scope}` : scope;
        return new CapturingLogger(this.delegate.child(scope), this.sink, nested);
    }
    emit(level, message, fields) {
        this.delegate[level](message, fields);
        const fullMessage = this.scope ? `[${this.scope}] ${message}` : message;
        this.sink({
            timestamp: new Date().toISOString(),
            level,
            message: fields && Object.keys(fields).length > 0 ? `${fullMessage} ${JSON.stringify(fields)}` : fullMessage,
        });
    }
}

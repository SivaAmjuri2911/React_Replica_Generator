import type { LogFields, LogLevel, Logger } from './Logger.js';
import type { GenerationLogLine } from '../domain/models/GenerationJob.js';

export type LogLineSink = (line: GenerationLogLine) => void;

/**
 * Wraps a delegate Logger (e.g. ConsoleLogger, for the server's own stdout)
 * and additionally pushes every log line to a sink — used by
 * GenerationJobService to capture per-job logs for the API/UI to poll,
 * without the pipeline/services/rules layers knowing anything about jobs.
 */
export class CapturingLogger implements Logger {
  private readonly delegate: Logger;
  private readonly sink: LogLineSink;
  private readonly scope: string | undefined;

  constructor(delegate: Logger, sink: LogLineSink, scope?: string) {
    this.delegate = delegate;
    this.sink = sink;
    this.scope = scope;
  }

  debug(message: string, fields?: LogFields): void {
    this.emit('debug', message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.emit('info', message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.emit('warn', message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.emit('error', message, fields);
  }

  child(scope: string): Logger {
    const nested = this.scope ? `${this.scope}:${scope}` : scope;
    return new CapturingLogger(this.delegate.child(scope), this.sink, nested);
  }

  private emit(level: LogLevel, message: string, fields?: LogFields): void {
    this.delegate[level](message, fields);
    const fullMessage = this.scope ? `[${this.scope}] ${message}` : message;
    this.sink({
      timestamp: new Date().toISOString(),
      level,
      message: fields && Object.keys(fields).length > 0 ? `${fullMessage} ${JSON.stringify(fields)}` : fullMessage,
    });
  }
}

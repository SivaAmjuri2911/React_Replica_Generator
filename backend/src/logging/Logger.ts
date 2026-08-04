export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  readonly [key: string]: unknown;
}

/**
 * Structured logger abstraction. Nothing in the pipeline/services/rules layers
 * talks to `console` directly — they depend on this interface so the output
 * target (console today, a file or remote sink tomorrow) is swappable without
 * touching business logic.
 */
export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(scope: string): Logger;
}

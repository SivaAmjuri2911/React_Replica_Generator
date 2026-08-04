import type { LogFields, LogLevel, Logger } from './Logger.js';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class ConsoleLogger implements Logger {
  private readonly minLevel: LogLevel;
  private readonly scope: string | undefined;

  constructor(minLevel: LogLevel = 'info', scope?: string) {
    this.minLevel = minLevel;
    this.scope = scope;
  }

  debug(message: string, fields?: LogFields): void {
    this.write('debug', message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.write('info', message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.write('warn', message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.write('error', message, fields);
  }

  child(scope: string): Logger {
    const nested = this.scope ? `${this.scope}:${scope}` : scope;
    return new ConsoleLogger(this.minLevel, nested);
  }

  private write(level: LogLevel, message: string, fields?: LogFields): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) {
      return;
    }
    const prefix = this.scope ? `[${this.scope}]` : '';
    const line = `${new Date().toISOString()} ${level.toUpperCase()} ${prefix} ${message}`;
    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (fields && Object.keys(fields).length > 0) {
      sink(line, fields);
    } else {
      sink(line);
    }
  }
}

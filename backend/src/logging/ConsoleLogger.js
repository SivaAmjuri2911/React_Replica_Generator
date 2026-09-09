const LEVEL_ORDER = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
/**
 * @implements {Logger}
 */
export class ConsoleLogger {
    minLevel;
    scope;
    constructor(minLevel = 'info', scope) {
        this.minLevel = minLevel;
        this.scope = scope;
    }
    debug(message, fields) {
        this.write('debug', message, fields);
    }
    info(message, fields) {
        this.write('info', message, fields);
    }
    warn(message, fields) {
        this.write('warn', message, fields);
    }
    error(message, fields) {
        this.write('error', message, fields);
    }
    child(scope) {
        const nested = this.scope ? `${this.scope}:${scope}` : scope;
        return new ConsoleLogger(this.minLevel, nested);
    }
    write(level, message, fields) {
        if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) {
            return;
        }
        const prefix = this.scope ? `[${this.scope}]` : '';
        const line = `${new Date().toISOString()} ${level.toUpperCase()} ${prefix} ${message}`;
        const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
        if (fields && Object.keys(fields).length > 0) {
            sink(line, fields);
        }
        else {
            sink(line);
        }
    }
}

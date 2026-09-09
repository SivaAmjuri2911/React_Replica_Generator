/**
 * @typedef {('debug'|'info'|'warn'|'error')} LogLevel
 */

/**
 * @typedef {Object.<string, unknown>} LogFields
 */

/**
 * Structured logger abstraction. Nothing in the pipeline/services/rules layers
 * talks to `console` directly — they depend on this interface so the output
 * target (console today, a file or remote sink tomorrow) is swappable without
 * touching business logic.
 * @typedef {object} Logger
 * @property {(message: string, fields?: LogFields) => void} debug
 * @property {(message: string, fields?: LogFields) => void} info
 * @property {(message: string, fields?: LogFields) => void} warn
 * @property {(message: string, fields?: LogFields) => void} error
 * @property {(scope: string) => Logger} child
 */

export {};

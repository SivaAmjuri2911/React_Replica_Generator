/**
 * Explicit success/failure container used across services and rules so callers
 * are forced to handle the failure case instead of relying on thrown exceptions
 * for expected, recoverable failures (validation results, rule checks, etc).
 *
 * Reserve thrown errors (see domain/errors) for unexpected/unrecoverable failures
 * that should halt the pipeline immediately.
 */
export type Result<TValue, TError = Error> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: TError };

export function ok<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value };
}

export function err<TError>(error: TError): Result<never, TError> {
  return { ok: false, error };
}

export function isOk<TValue, TError>(
  result: Result<TValue, TError>
): result is { ok: true; value: TValue } {
  return result.ok;
}

export function isErr<TValue, TError>(
  result: Result<TValue, TError>
): result is { ok: false; error: TError } {
  return !result.ok;
}

export function mapResult<TValue, TMapped, TError>(
  result: Result<TValue, TError>,
  mapFn: (value: TValue) => TMapped
): Result<TMapped, TError> {
  return result.ok ? ok(mapFn(result.value)) : result;
}

export function unwrapOr<TValue, TError>(
  result: Result<TValue, TError>,
  fallback: TValue
): TValue {
  return result.ok ? result.value : fallback;
}

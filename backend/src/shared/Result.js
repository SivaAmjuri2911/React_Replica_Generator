export function ok(value) {
    return { ok: true, value };
}
export function err(error) {
    return { ok: false, error };
}
export function isOk(result) {
    return result.ok;
}
export function isErr(result) {
    return !result.ok;
}
export function mapResult(result, mapFn) {
    return result.ok ? ok(mapFn(result.value)) : result;
}
export function unwrapOr(result, fallback) {
    return result.ok ? result.value : fallback;
}

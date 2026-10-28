/**
 * The result of an operation that can fail in an expected way.
 *
 * @remarks Expected failures, such as a storage conflict or an invalid file, are returned, not thrown, so they
 * show up in the type and callers must handle them. Exceptions mean bugs (ADR-0018).
 * @packageDocumentation
 */

/**
 * Either the value an operation produced or the expected failure that stopped it.
 *
 * @remarks Check `ok` before reading `value` or `error`. Each operation declares its own union of error kinds,
 * for example `{ kind: "conflict" } | { kind: "not-found" }`, so a `switch` over `error.kind` is exhaustive.
 * @typeParam T - What the operation produces when it succeeds.
 * @typeParam E - The expected failures the operation can report.
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/**
 * Wraps the value of an operation that succeeded.
 *
 * @typeParam T - What the operation produces.
 * @param value - What the operation produced.
 * @returns A successful result holding `value`.
 */
export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

/**
 * Wraps an expected failure.
 *
 * @typeParam E - The kind of failure.
 * @param error - What went wrong, usually an object with a `kind`.
 * @returns A failed result holding `error`.
 */
export function err<E>(error: E): { readonly ok: false; readonly error: E } {
  return { ok: false, error };
}

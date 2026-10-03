/**
 * Safe accessor for vitest mock call args under `noUncheckedIndexedAccess`.
 * Throws when the expected call/arg is missing so tests fail loudly.
 */
export function mockCallArg<T = unknown>(
  mock: { mock: { calls: ReadonlyArray<ReadonlyArray<unknown>> } },
  callIndex = 0,
  argIndex = 0,
): T {
  const call = mock.mock.calls[callIndex];
  if (call === undefined) {
    throw new Error(`expected mock call at index ${callIndex}`);
  }
  const arg = call[argIndex];
  if (arg === undefined) {
    throw new Error(`expected mock arg at call ${callIndex} index ${argIndex}`);
  }
  return arg as T;
}

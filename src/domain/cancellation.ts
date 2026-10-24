/** React Native uses abort-controller, which has no AbortSignal.throwIfAborted(). */
export function checkCancelled(
  signal?: Pick<AbortSignal, "aborted"> | null,
): void {
  if (signal?.aborted) {
    const error = new Error("Operation cancelled");
    error.name = "AbortError";
    throw error;
  }
}

// React Native's AbortController does not retain abort(reason).
const reasons = new WeakMap<object, unknown>();
export function cancellationReason(signal: AbortSignal): unknown {
  return reasons.get(signal) ?? signal.reason;
}
export function abortTransfer(
  controller: AbortController,
  reason?: unknown,
): void {
  if (controller.signal.aborted) return;
  reasons.set(controller.signal, reason);
  controller.abort(reason);
}

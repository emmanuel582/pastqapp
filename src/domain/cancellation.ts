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

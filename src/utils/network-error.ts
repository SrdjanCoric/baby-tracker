const NETWORK_ERROR_PATTERNS = [
  /network/i,
  /fetch/i,
  /internet/i,
  /connection/i,
  /offline/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
];

/** Broad network-message classification for user-facing error handling. */
export function isNetworkErrorMessage(message: string): boolean {
  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/** Transport failures have SDK-specific shapes; backend errors must retain normal reporting. */
export function isTransportFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, message, code } = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
  };
  if (name === "AuthRetryableFetchError") return true;
  if (name === "TypeError") {
    return (
      message === "Network request failed" ||
      message === "Network request timed out" ||
      message === "Failed to fetch" ||
      message === "Load failed"
    );
  }
  return (
    code === "" &&
    typeof message === "string" &&
    (message.startsWith("TypeError: Network request failed") ||
      message.startsWith("TypeError: Network request timed out"))
  );
}

import type { AiMatchEvent, ApiErrorBody } from "@internly/shared";
import { ApiError } from "./api";

/**
 * Calls the streaming CV matcher and hands each Server-Sent Event to `onEvent` as it arrives.
 * We use fetch + a stream reader (not EventSource) because EventSource can only do GET and we
 * need to POST the CV. Cancelling `signal` closes the connection; the server notices and stops.
 */
export async function streamAiMatch(
  cvText: string,
  signal: AbortSignal,
  onEvent: (e: AiMatchEvent) => void,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/ai/match", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", "X-Request-Id": crypto.randomUUID() },
      body: JSON.stringify({ cvText }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "network_error", "Cannot reach the server.");
  }

  // Validation / auth problems come back as ordinary JSON errors before the stream starts.
  if (!res.ok || !res.body) {
    const e = ((await res.json().catch(() => null)) as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, e?.code ?? "http_error", e?.message ?? "The matcher is unavailable", e?.fields);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    // events are separated by a blank line; a chunk may hold several, or half of one
    let end: number;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (block.startsWith("data: ")) onEvent(JSON.parse(block.slice(6)) as AiMatchEvent);
    }
  }
}

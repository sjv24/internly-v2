import { ApiError } from "./api.js";

/**
 * Calls the streaming CV matcher and hands each Server-Sent Event to `onEvent` as it arrives.
 *
 * fetch() + a stream reader is used instead of EventSource because EventSource can only send GET and
 * we need to POST the CV. Calling `controller.abort()` closes the connection; the server notices
 * and stops its work.
 *
 * Wire format: each event is a line `data: {...json...}` followed by a blank line.
 */
export async function streamAiMatch(cvText, signal, onEvent) {
  let res;
  try {
    res = await fetch("/api/ai/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "X-Request-Id": crypto.randomUUID(),
      },
      body: JSON.stringify({ cvText }),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(0, "network_error", "Cannot reach the server.");
  }

  // Auth / validation problems arrive as ordinary JSON errors BEFORE the stream starts.
  if (!res.ok || !res.body) {
    const e = (await res.json().catch(() => null))?.error;
    throw new ApiError(
      res.status,
      e?.code ?? "http_error",
      e?.message ?? "The matcher is unavailable",
      e?.fields,
    );
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    // a chunk may hold several events, or only half of one: split on the blank-line separator
    let end;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (block.startsWith("data: ")) onEvent(JSON.parse(block.slice(6)));
    }
  }
}

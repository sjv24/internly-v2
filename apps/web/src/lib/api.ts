import type { ApiErrorBody } from "@internly/shared";

/** An error returned by our API (or a network failure), with the details the UI needs. */
export class ApiError extends Error {
  constructor(
    public status: number, // 0 = the request never reached the server
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public requestId?: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown; // object -> sent as JSON, FormData -> sent as multipart
  signal?: AbortSignal;
  retries?: number; // extra attempts for flaky connections (GET only by default)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isRetryable = (err: ApiError) =>
  err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504;

/**
 * The one function every API call goes through. The generic <T> is the TYPE OF THE RESPONSE
 * the caller expects: `request<Page<Listing>>("/api/listings")` is typed end to end.
 */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const maxRetries = opts.retries ?? (method === "GET" ? 2 : 0); // never auto-retry writes: could double-submit

  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce<T>(path, method, opts);
    } catch (err) {
      const canRetry = err instanceof ApiError && isRetryable(err) && attempt < maxRetries && !opts.signal?.aborted;
      if (!canRetry) throw err;
      await sleep(300 * 3 ** attempt); // exponential backoff: 300ms, 900ms, ...
    }
  }
}

async function requestOnce<T>(path: string, method: string, opts: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    // the same id appears in the server's logs, so one failing click can be traced end to end
    "X-Request-Id": crypto.randomUUID(),
  };
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) {
    body = opts.body; // the browser sets the multipart Content-Type (with boundary) itself
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(path, { method, headers, body, signal: opts.signal, credentials: "same-origin" });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err; // cancelled on purpose: not an error
    throw new ApiError(0, "network_error", "Cannot reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;

  const requestId = res.headers.get("x-request-id") ?? undefined;
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON (e.g. a proxy error page) */
  }

  if (!res.ok) {
    const e = (json as ApiErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      e?.code ?? "http_error",
      e?.message ?? `Request failed (${res.status})`,
      e?.fields,
      requestId,
    );
  }
  return json as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) => request<T>(path, { method: "POST", body, signal }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T = void>(path: string, body?: unknown) => request<T>(path, { method: "DELETE", body }),
};

/** Turn any thrown value into a message that is safe to show to a user. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Something went wrong. Please try again.";
}

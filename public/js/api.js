/**
 * The one function every server call goes through (ES module: `import { api } from "/js/api.js"`).
 *  - sends/receives JSON (or FormData for file uploads)
 *  - adds an X-Request-Id header: the same id shows up in the server log, so one failing click
 *    can be traced from the browser's Network tab to the server
 *  - turns error responses into an ApiError the UI can display
 *  - retries GET requests that fail because of the network (never POST/PUT/DELETE: could double-submit)
 */
export class ApiError extends Error {
  constructor(status, code, message, fields, requestId) {
    super(message);
    this.status = status; // 0 = the request never reached the server
    this.code = code;
    this.fields = fields; // { fieldName: "message" } for validation errors
    this.requestId = requestId;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isRetryable = (err) => err.status === 0 || [502, 503, 504].includes(err.status);

export async function request(path, { method = "GET", body, signal, retries } = {}) {
  const maxRetries = retries ?? (method === "GET" ? 2 : 0);
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce(path, method, body, signal);
    } catch (err) {
      const canRetry =
        err instanceof ApiError && isRetryable(err) && attempt < maxRetries && !signal?.aborted;
      if (!canRetry) throw err;
      await sleep(300 * 3 ** attempt); // exponential backoff: 300 ms, then 900 ms
    }
  }
}

async function requestOnce(path, method, body, signal) {
  const headers = { Accept: "application/json", "X-Request-Id": crypto.randomUUID() };
  let payload;
  if (body instanceof FormData) {
    payload = body; // the browser sets the multipart Content-Type (with its boundary) itself
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, { method, headers, body: payload, signal, credentials: "same-origin" });
  } catch (err) {
    if (err.name === "AbortError") throw err; // cancelled on purpose: not an error to show
    throw new ApiError(0, "network_error", "Cannot reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined;
  const requestId = res.headers.get("x-request-id") ?? undefined;
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON (e.g. a proxy error page) */
  }
  if (!res.ok) {
    const e = json?.error;
    throw new ApiError(
      res.status,
      e?.code ?? "http_error",
      e?.message ?? `Request failed (${res.status})`,
      e?.fields,
      requestId,
    );
  }
  return json;
}

export const api = {
  get: (path, signal) => request(path, { signal }),
  post: (path, body, signal) => request(path, { method: "POST", body, signal }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path, body) => request(path, { method: "DELETE", body }),
};

/** Any thrown value -> a message that is safe to show a user. */
export const errorMessage = (err) =>
  err instanceof ApiError ? err.message : "Something went wrong. Please try again.";

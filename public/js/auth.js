import { api } from "./api.js";

/*
 * "Who is logged in?" The server keeps the session (an httpOnly cookie JavaScript cannot read), so
 * the browser asks /api/auth/me. We cache the answer for the lifetime of the page.
 */
let cached; // a Promise, so concurrent callers share one request

export function getUser() {
  cached ??= api
    .get("/api/auth/me")
    .then((r) => r.user)
    .catch(() => null); // server down: behave as logged out
  return cached;
}

export const forgetUser = () => {
  cached = undefined;
};

export async function logout() {
  await api.post("/api/auth/logout");
  forgetUser();
  location.assign("/");
}

/** Where to send people after login/signup. */
export const homeFor = (user) => (user.role === "company" ? "/company/listings" : "/listings");

/**
 * `?next=/some/path` after login. Only same-site paths are accepted: otherwise an attacker could craft
 * a login link that bounces the user to a malicious site afterwards (an "open redirect").
 */
export function safeNext(fallback) {
  const next = new URLSearchParams(location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

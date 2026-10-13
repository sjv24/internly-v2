import { createHash, randomBytes } from "node:crypto";
import { config } from "../config.js";
import { query } from "../db.js";
/*
 * How a login session works (this replaces v1's single global `mySession` object):
 *   1. On login we create a random 256-bit token and send it to the browser in a cookie.
 *   2. The database stores only SHA-256(token) next to the user id and an expiry.
 *   3. On every request the cookie comes back, we hash it, look it up, and know exactly
 *      WHICH user this request belongs to. Two users logged in at once never collide.
 */
export const hash = (token) => createHash("sha256").update(token).digest("hex");
const cookieOptions = () => ({
  httpOnly: true, // JavaScript in the page can NOT read the cookie -> XSS cannot steal it
  sameSite: "lax", // not sent on cross-site POSTs -> first line of CSRF defence
  secure: config.isProd, // https only in production
  path: "/",
  maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
});
export async function startSession(res, userId) {
  const token = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [hash(token), userId, String(config.sessionDays)],
  );
  res.cookie(config.cookieName, token, cookieOptions());
}
export async function endSession(res, token) {
  if (token) await query(`DELETE FROM sessions WHERE id = $1`, [hash(token)]);
  res.clearCookie(config.cookieName, { ...cookieOptions(), maxAge: undefined });
}
export async function findUserByToken(token) {
  const { rows } = await query(
    `SELECT u.id, u.role, u.name, u.email
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now()`,
    [hash(token)],
  );
  return rows[0] ?? null;
}
/** Housekeeping: remove expired sessions (called on server start). */
export async function purgeExpiredSessions() {
  await query(`DELETE FROM sessions WHERE expires_at < now()`);
}

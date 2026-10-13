import { config } from "../config.js";
import { forbidden } from "../errors.js";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
/**
 * CSRF defence (on top of SameSite=Lax cookies): a state-changing request that carries an
 * Origin header must come from our own site. Browsers always attach Origin to cross-site
 * POSTs, and a malicious page cannot forge it. Non-browser clients (curl, tests) send none.
 */
export const originCheck = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.header("origin");
  if (!origin) return next();
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("Bad Origin header");
  }
  const sameSite = originHost === req.header("host");
  const allowed = config.allowedOrigins.includes(origin);
  if (!sameSite && !allowed) throw forbidden("Cross-site request blocked");
  next();
};

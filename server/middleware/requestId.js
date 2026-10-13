import { randomUUID } from "node:crypto";
/**
 * Every request gets an ID that appears in every log line for that request and is sent
 * back in the `x-request-id` response header. If the frontend already sent one, we reuse
 * it, so one click can be traced from the browser's network tab to the server logs.
 */
export const requestId = (req, res, next) => {
  const incoming = req.header("x-request-id");
  const id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  req.headers["x-request-id"] = id;
  res.setHeader("x-request-id", id);
  next();
};

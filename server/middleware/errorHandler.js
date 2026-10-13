import multer from "multer";
import { ZodError } from "zod";
import { AppError, notFound } from "../errors.js";
import { logger } from "../logger.js";
/** Unknown /api route -> JSON 404 (instead of Express's default HTML page). */
export const apiNotFound = () => {
  throw notFound("No such API route");
};
/**
 * The ONE place that turns any thrown error into an HTTP response. Handlers just `throw`;
 * they never format error responses themselves, so every error has the same JSON shape.
 */
export const errorHandler = (err, req, res, _next) => {
  const send = (status, code, message, fields) => {
    const body = { error: { code, message, ...(fields ? { fields } : {}) } };
    res.status(status).json(body);
  };
  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
    return send(400, "validation_error", "Some fields are invalid", fields);
  }
  if (err instanceof AppError) return send(err.status, err.code, err.message, err.fields);
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Resume must be 5 MB or smaller" : err.message;
    return send(400, "upload_error", message);
  }
  if (err?.type === "entity.parse.failed") return send(400, "bad_json", "Request body is not valid JSON");
  if (err?.type === "entity.too.large") return send(413, "too_large", "Request body is too large");
  // Unexpected: log everything (with the request id) but tell the client nothing internal.
  logger.error({ err, reqId: req.headers["x-request-id"] }, "unhandled error");
  send(500, "internal_error", "Something went wrong on our side");
};

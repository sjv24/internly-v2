/** An error we expect and know how to describe to the client. */
export class AppError extends Error {
  status;
  code;
  fields;
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
export const badRequest = (message, fields) => new AppError(400, "bad_request", message, fields);
export const unauthorized = (message = "Please log in") => new AppError(401, "unauthorized", message);
export const forbidden = (message = "You are not allowed to do that") =>
  new AppError(403, "forbidden", message);
export const notFound = (message = "Not found") => new AppError(404, "not_found", message);
export const conflict = (message) => new AppError(409, "conflict", message);

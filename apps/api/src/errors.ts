/** An error we expect and know how to describe to the client. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new AppError(400, "bad_request", message, fields);
export const unauthorized = (message = "Please log in") => new AppError(401, "unauthorized", message);
export const forbidden = (message = "You are not allowed to do that") => new AppError(403, "forbidden", message);
export const notFound = (message = "Not found") => new AppError(404, "not_found", message);
export const conflict = (message: string) => new AppError(409, "conflict", message);

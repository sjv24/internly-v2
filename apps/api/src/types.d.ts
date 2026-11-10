import type { PublicUser } from "@internly/shared";

// Teach TypeScript that our middleware attaches `user` to every request.
declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export {};

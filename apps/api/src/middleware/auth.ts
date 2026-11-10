import type { RequestHandler } from "express";
import type { Role } from "@internly/shared";
import { config } from "../config.js";
import { forbidden, unauthorized } from "../errors.js";
import { findUserByToken } from "../lib/sessions.js";

/** Runs on every request: if the browser sent a valid session cookie, attach the user. */
export const loadUser: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[config.cookieName];
  if (typeof token === "string" && token.length > 0) {
    req.user = (await findUserByToken(token)) ?? undefined;
  }
  next();
};

/** Authentication: "who are you?" - 401 if nobody is logged in. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) throw unauthorized();
  next();
};

/** Authorisation: "are you allowed?" - 403 if logged in as the wrong kind of user. */
export const requireRole =
  (role: Role): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (req.user.role !== role) throw forbidden(`Only ${role} accounts can do this`);
    next();
  };

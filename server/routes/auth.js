import { Router } from "express";
import rateLimit from "express-rate-limit";
import { companySignupSchema, loginSchema, studentSignupSchema } from "../validation.js";
import { config } from "../config.js";
import { query, withTransaction } from "../db.js";
import { AppError, conflict, unauthorized } from "../errors.js";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../lib/passwords.js";
import { endSession, startSession } from "../lib/sessions.js";
export const authRouter = Router();
// Brute-force protection: at most 10 FAILED logins per IP per 15 minutes.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  skip: () => config.isTest,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(new AppError(429, "too_many_attempts", "Too many login attempts, try again later")),
});
const isUniqueViolation = (err) => err?.code === "23505";
authRouter.post("/signup/student", async (req, res) => {
  const input = studentSignupSchema.parse(req.body);
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO users (role, email, password_hash, name) VALUES ('student', $1, $2, $3)
         RETURNING id, role, name, email`,
        [input.email, passwordHash, input.name],
      );
      await client.query(
        `INSERT INTO student_profiles (user_id, university, year_of_study, website) VALUES ($1, $2, $3, $4)`,
        [rows[0].id, input.university, input.yearOfStudy, input.website],
      );
      return rows[0];
    });
    await startSession(res, user.id);
    res.status(201).json({ user });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("An account with this email already exists");
    throw err;
  }
});
authRouter.post("/signup/company", async (req, res) => {
  const input = companySignupSchema.parse(req.body);
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO users (role, email, password_hash, name) VALUES ('company', $1, $2, $3)
         RETURNING id, role, name, email`,
        [input.email, passwordHash, input.name],
      );
      await client.query(
        `INSERT INTO company_profiles (user_id, location, industry, contact_name) VALUES ($1, $2, $3, $4)`,
        [rows[0].id, input.location, input.industry, input.contactName],
      );
      return rows[0];
    });
    await startSession(res, user.id);
    res.status(201).json({ user });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("An account with this email already exists");
    throw err;
  }
});
authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const { rows } = await query(
    `SELECT id, role, name, email, password_hash FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  const row = rows[0];
  // Always run bcrypt, even for unknown emails, so timing does not reveal which emails exist.
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) throw unauthorized("Invalid email or password"); // same message for both cases
  await startSession(res, row.id); // brand-new token on every login (prevents session fixation)
  res.json({
    user: { id: row.id, role: row.role, name: row.name, email: row.email },
  });
});
authRouter.post("/logout", async (req, res) => {
  await endSession(res, req.cookies?.[config.cookieName]);
  res.status(204).end();
});
// "Who am I?" - the frontend calls this on page load to restore the logged-in state.
authRouter.get("/me", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ user: req.user ?? null });
});

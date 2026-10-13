import { Router } from "express";
import { z } from "zod";
import { accountUpdateSchema } from "../validation.js";
import { config } from "../config.js";
import { query } from "../db.js";
import { badRequest } from "../errors.js";
import { deleteResumeFiles } from "../lib/uploads.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { endSession, hash as hashToken } from "../lib/sessions.js";
import { requireAuth } from "../middleware/auth.js";
export const accountRouter = Router();
accountRouter.use(requireAuth);
async function loadHash(userId) {
  const { rows } = await query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
  return rows[0].password_hash;
}
// v1 saved the NEW password as plain text here (and so locked the user out). Now: verify the
// current password, then store a fresh bcrypt hash.
accountRouter.patch("/", async (req, res) => {
  const input = accountUpdateSchema.parse(req.body);
  const user = req.user;
  if (input.newPassword) {
    const ok = await verifyPassword(input.currentPassword, await loadHash(user.id));
    if (!ok)
      throw badRequest("Current password is incorrect", {
        currentPassword: "Incorrect password",
      });
    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      await hashPassword(input.newPassword),
      user.id,
    ]);
    // log out every other device after a password change
    const token = req.cookies?.[config.cookieName];
    if (token) {
      await query(`DELETE FROM sessions WHERE user_id = $1 AND id <> $2`, [user.id, hashToken(token)]);
    }
  }
  if (input.name) await query(`UPDATE users SET name = $1 WHERE id = $2`, [input.name, user.id]);
  const { rows } = await query(`SELECT id, role, name, email FROM users WHERE id = $1`, [user.id]);
  res.json({ user: rows[0] });
});
accountRouter.delete("/", async (req, res) => {
  const { password } = z.object({ password: z.string().min(1).max(100) }).parse(req.body);
  const user = req.user;
  if (!(await verifyPassword(password, await loadHash(user.id)))) throw badRequest("Password is incorrect");
  // collect resume files first: deleting rows cascades, but the files on disk are ours to clean
  const { rows } = await query(
    `SELECT a.resume_file FROM applications a
       LEFT JOIN listings l ON l.id = a.listing_id
      WHERE a.student_id = $1 OR l.company_id = $1`,
    [user.id],
  );
  await query(`DELETE FROM users WHERE id = $1`, [user.id]); // cascades to profile, listings, applications, sessions
  deleteResumeFiles(rows.map((r) => r.resume_file));
  await endSession(res, req.cookies?.[config.cookieName]);
  res.status(204).end();
});

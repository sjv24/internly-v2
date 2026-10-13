import { Router } from "express";
import { applicationStatusSchema, updateStatusSchema } from "../validation.js";
import { z } from "zod";
import { query } from "../db.js";
import { AppError, badRequest, forbidden, notFound } from "../errors.js";
import { deleteResumeFiles, resumePath } from "../lib/uploads.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
export const applicationsRouter = Router();
const parseId = (raw) => {
  const id = Number(Array.isArray(raw) ? NaN : raw);
  if (!Number.isInteger(id) || id < 1) throw badRequest("Invalid id");
  return id;
};
// GET /api/applications/mine - the student's own applications
applicationsRouter.get("/mine", requireRole("student"), async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.status, a.cover_note, a.created_at, a.resume_file,
            l.id AS listing_id, l.title, u.name AS company_name, l.location, l.work_type
       FROM applications a
       JOIN listings l ON l.id = a.listing_id
       JOIN users u ON u.id = l.company_id
      WHERE a.student_id = $1
      ORDER BY a.created_at DESC`,
    [req.user.id],
  );
  const items = rows.map((r) => ({
    id: r.id,
    status: r.status,
    coverNote: r.cover_note,
    createdAt: r.created_at.toISOString(),
    hasResume: !!r.resume_file,
    listing: {
      id: r.listing_id,
      title: r.title,
      companyName: r.company_name,
      location: r.location,
      workType: r.work_type,
    },
  }));
  res.setHeader("Cache-Control", "no-store");
  res.json({ items });
});
// GET /api/applications/received?listingId=&status= - applicants to the company's OWN listings
applicationsRouter.get("/received", requireRole("company"), async (req, res) => {
  const filters = z
    .object({
      listingId: z.coerce.number().int().min(1).optional(),
      status: applicationStatusSchema.optional(),
    })
    .parse(req.query);
  const { rows } = await query(
    `SELECT a.id, a.status, a.cover_note, a.created_at, a.resume_file, l.id AS listing_id, l.title,
            s.name AS s_name, s.email AS s_email, sp.university, sp.website
       FROM applications a
       JOIN listings l ON l.id = a.listing_id
       JOIN users s ON s.id = a.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = s.id
      WHERE l.company_id = $1                                  -- only applicants to MY listings
        AND ($2::int  IS NULL OR l.id = $2)
        AND ($3::text IS NULL OR a.status = $3)
      ORDER BY a.created_at DESC`,
    [req.user.id, filters.listingId ?? null, filters.status ?? null],
  );
  const items = rows.map((r) => ({
    id: r.id,
    status: r.status,
    coverNote: r.cover_note,
    createdAt: r.created_at.toISOString(),
    hasResume: !!r.resume_file,
    listingId: r.listing_id,
    listingTitle: r.title,
    student: {
      name: r.s_name,
      email: r.s_email,
      university: r.university ?? "",
      website: r.website ?? "",
    },
  }));
  res.setHeader("Cache-Control", "no-store");
  res.json({ items });
});
// PATCH /api/applications/:id/status - accept / reject (only the company that owns the listing)
applicationsRouter.patch("/:id/status", requireRole("company"), async (req, res) => {
  const id = parseId(req.params.id);
  const { status } = updateStatusSchema.parse(req.body);
  const { rows } = await query(
    `SELECT l.company_id FROM applications a JOIN listings l ON l.id = a.listing_id WHERE a.id = $1`,
    [id],
  );
  if (!rows[0]) throw notFound("Application not found");
  if (rows[0].company_id !== req.user.id) throw forbidden("This application is not for one of your listings");
  await query(`UPDATE applications SET status = $2, updated_at = now() WHERE id = $1`, [id, status]);
  res.json({ application: { id, status } });
});
// DELETE /api/applications/:id - a student withdraws their own PENDING application
applicationsRouter.delete("/:id", requireRole("student"), async (req, res) => {
  const id = parseId(req.params.id);
  const { rows } = await query(`SELECT student_id, status, resume_file FROM applications WHERE id = $1`, [
    id,
  ]);
  if (!rows[0]) throw notFound("Application not found");
  if (rows[0].student_id !== req.user.id) throw forbidden();
  if (rows[0].status !== "pending") {
    throw new AppError(409, "not_pending", "Only pending applications can be withdrawn");
  }
  await query(`DELETE FROM applications WHERE id = $1`, [id]);
  deleteResumeFiles([rows[0].resume_file]);
  res.status(204).end();
});
// GET /api/applications/:id/resume - private download.
// Only (a) the student who applied and (b) the company that owns the listing may read it.
// v1 served every resume to the whole internet from /uploads/.
applicationsRouter.get("/:id/resume", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const { rows } = await query(
    `SELECT a.student_id, l.company_id, a.resume_file, a.resume_original_name
       FROM applications a JOIN listings l ON l.id = a.listing_id WHERE a.id = $1`,
    [id],
  );
  const app = rows[0];
  if (!app || !app.resume_file) throw notFound("Resume not found");
  const me = req.user;
  const allowed =
    (me.role === "student" && me.id === app.student_id) ||
    (me.role === "company" && me.id === app.company_id);
  if (!allowed) throw forbidden();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Disposition", `inline; filename="resume-${id}.pdf"`);
  res.sendFile(resumePath(app.resume_file), (err) => {
    if (err && !res.headersSent)
      res.status(404).json({
        error: { code: "not_found", message: "Resume file is missing" },
      });
  });
});

import { Router } from "express";
import fs from "node:fs";
import { applyFieldsSchema, listingInputSchema, listingQuerySchema } from "../validation.js";
import { query } from "../db.js";
import { AppError, badRequest, conflict, forbidden, notFound } from "../errors.js";
import { LISTING_SELECT, toListing } from "../lib/mappers.js";
import { deleteResumeFiles, looksLikePdf, resumeUpload } from "../lib/uploads.js";
import { requireRole } from "../middleware/auth.js";
export const listingsRouter = Router();
/** "react dev" -> "react:* & dev:*" : every typed word must match as a PREFIX (search-as-you-type). */
function toTsQuery(q) {
  const words = q.toLowerCase().match(/[a-z0-9]+/g);
  return words?.length ? words.map((w) => `${w}:*`).join(" & ") : null;
}
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
/* ------------------------------------------------------------------ public ---- */
// GET /api/listings?q=&location=&workType=&page=&pageSize=
// Filtering, sorting and pagination all happen IN THE DATABASE (v1 downloaded every row
// and filtered in the browser). Values are always passed as $n parameters, never pasted
// into the SQL string, which is what prevents SQL injection.
listingsRouter.get("/", async (req, res) => {
  const { q, location, workType, page, pageSize } = listingQuerySchema.parse(req.query);
  const tsQuery = q ? toTsQuery(q) : null;
  const like = q ? `%${escapeLike(q)}%` : null;
  const where = `
    WHERE ($1::text IS NULL
           OR l.search @@ to_tsquery('english', $1)
           OR u.name ILIKE $2
           OR EXISTS (SELECT 1 FROM unnest(l.skills) s WHERE s ILIKE $2))
      AND ($3::text IS NULL OR lower(l.location) = lower($3))
      AND ($4::text IS NULL OR l.work_type = $4)`;
  const params = [tsQuery, like, location ?? null, workType ?? null];
  const [countResult, rowsResult] = await Promise.all([
    query(`SELECT count(*) FROM listings l JOIN users u ON u.id = l.company_id ${where}`, params),
    query(`${LISTING_SELECT} ${where} ORDER BY l.created_at DESC, l.id DESC LIMIT $5 OFFSET $6`, [
      ...params,
      pageSize,
      (page - 1) * pageSize,
    ]),
  ]);
  const total = Number(countResult.rows[0].count);
  const body = {
    items: rowsResult.rows.map(toListing),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
  // `no-cache` = "you may store this, but re-check with me before reusing it". Express adds an
  // ETag automatically, so an unchanged page costs a tiny 304 response instead of the full JSON.
  res.setHeader("Cache-Control", "no-cache");
  res.json(body);
});
// Distinct locations for the filter dropdown.
listingsRouter.get("/locations", async (_req, res) => {
  const { rows } = await query(`SELECT DISTINCT location FROM listings ORDER BY location`);
  res.setHeader("Cache-Control", "no-cache");
  res.json({ locations: rows.map((r) => r.location) });
});
/* --------------------------------------------------------------- company ---- */
// GET /api/listings/mine - the logged-in company's own listings (+ how many applicants each has)
listingsRouter.get("/mine", requireRole("company"), async (req, res) => {
  const { rows } = await query(
    `SELECT l.id, l.company_id, u.name AS company_name, l.title, l.description, l.location,
            l.work_type, l.duration, l.stipend, l.skills, l.openings, l.start_date, l.deadline, l.created_at,
            (SELECT count(*) FROM applications a WHERE a.listing_id = l.id) AS application_count
       FROM listings l JOIN users u ON u.id = l.company_id
      WHERE l.company_id = $1
      ORDER BY l.created_at DESC, l.id DESC`,
    [req.user.id],
  );
  const items = rows.map((r) => ({
    ...toListing(r),
    applicationCount: Number(r.application_count),
  }));
  res.setHeader("Cache-Control", "no-store");
  res.json({ items });
});
listingsRouter.post("/", requireRole("company"), async (req, res) => {
  const input = listingInputSchema.parse(req.body);
  // company_id comes from the SESSION, never from the request body: a company cannot post as someone else.
  const { rows } = await query(
    `INSERT INTO listings (company_id, title, description, location, work_type, duration, stipend, skills, openings, start_date, deadline)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [
      req.user.id,
      input.title,
      input.description,
      input.location,
      input.workType,
      input.duration,
      input.stipend,
      input.skills,
      input.openings,
      input.startDate ?? null,
      input.deadline ?? null,
    ],
  );
  const created = await query(`${LISTING_SELECT} WHERE l.id = $1`, [rows[0].id]);
  res.status(201).json({ listing: toListing(created.rows[0]) });
});
/** Load a listing and make sure the logged-in company owns it (v1 had NO such check). */
async function ownedListingOrThrow(listingId, companyId) {
  const { rows } = await query(`SELECT company_id FROM listings WHERE id = $1`, [listingId]);
  if (!rows[0]) throw notFound("Listing not found");
  if (rows[0].company_id !== companyId) throw forbidden("This listing belongs to another company");
}
const parseId = (raw) => {
  const id = Number(Array.isArray(raw) ? NaN : raw);
  if (!Number.isInteger(id) || id < 1) throw badRequest("Invalid id");
  return id;
};
listingsRouter.put("/:id", requireRole("company"), async (req, res) => {
  const id = parseId(req.params.id);
  const input = listingInputSchema.parse(req.body);
  await ownedListingOrThrow(id, req.user.id);
  await query(
    `UPDATE listings SET title=$2, description=$3, location=$4, work_type=$5, duration=$6,
                         stipend=$7, skills=$8, openings=$9, start_date=$10, deadline=$11
      WHERE id = $1`,
    [
      id,
      input.title,
      input.description,
      input.location,
      input.workType,
      input.duration,
      input.stipend,
      input.skills,
      input.openings,
      input.startDate ?? null,
      input.deadline ?? null,
    ],
  );
  const updated = await query(`${LISTING_SELECT} WHERE l.id = $1`, [id]);
  res.json({ listing: toListing(updated.rows[0]) });
});
listingsRouter.delete("/:id", requireRole("company"), async (req, res) => {
  const id = parseId(req.params.id);
  await ownedListingOrThrow(id, req.user.id);
  const files = await query(`SELECT resume_file FROM applications WHERE listing_id = $1`, [id]);
  await query(`DELETE FROM listings WHERE id = $1`, [id]); // applications cascade
  deleteResumeFiles(files.rows.map((f) => f.resume_file));
  res.status(204).end();
});
/* ---------------------------------------------------------------- student ---- */
// POST /api/listings/:id/apply  (multipart/form-data: resume=<pdf>, coverNote=<text>)
// One request does the whole job (v1 used two, so a failed upload left a ghost application).
listingsRouter.post("/:id/apply", requireRole("student"), resumeUpload.single("resume"), async (req, res) => {
  const file = req.file;
  const discardUpload = () => file && fs.rm(file.path, { force: true }, () => {});
  try {
    const id = parseId(req.params.id);
    const { coverNote } = applyFieldsSchema.parse(req.body ?? {});
    if (!file)
      throw badRequest("Please attach your resume (PDF)", {
        resume: "Resume is required",
      });
    if (!looksLikePdf(file.path))
      throw badRequest("That file is not a valid PDF", {
        resume: "Not a valid PDF",
      });
    const listing = await query(`SELECT deadline FROM listings WHERE id = $1`, [id]);
    if (!listing.rows[0]) throw notFound("Listing not found");
    const deadline = listing.rows[0].deadline;
    if (deadline && deadline < new Date().toISOString().slice(0, 10)) {
      throw new AppError(400, "deadline_passed", "The application deadline for this listing has passed");
    }
    try {
      const { rows } = await query(
        `INSERT INTO applications (student_id, listing_id, cover_note, resume_file, resume_original_name)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [req.user.id, id, coverNote, file.filename, file.originalname.slice(0, 200)],
      );
      res.status(201).json({ application: { id: rows[0].id, status: "pending" } });
    } catch (err) {
      if (err.code === "23505") throw conflict("You have already applied to this listing");
      throw err;
    }
  } catch (err) {
    discardUpload(); // never keep an uploaded file whose application was rejected
    throw err;
  }
});
// Keep this LAST: "/:id" would otherwise swallow "/mine" and "/locations".
listingsRouter.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const { rows } = await query(`${LISTING_SELECT} WHERE l.id = $1`, [id]);
  if (!rows[0]) throw notFound("Listing not found");
  res.setHeader("Cache-Control", "no-cache");
  res.json({ listing: toListing(rows[0]) });
});

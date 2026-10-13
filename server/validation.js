import { z } from "zod";
/* ------------------------------------------------------------------ *
 *  Shared contract between apps/api and apps/web.
 *  Each zod schema is the single source of truth: the API uses it to
 *  validate requests at runtime, the web app uses z.infer<> types at
 *  compile time. If the shape changes, both sides stop compiling/passing.
 * ------------------------------------------------------------------ */
// ---------- enums ----------
export const roleSchema = z.enum(["student", "company"]);
export const workTypeSchema = z.enum(["on-site", "remote", "hybrid"]);
export const applicationStatusSchema = z.enum(["pending", "accepted", "rejected"]);
// ---------- reusable field rules ----------
const email = z.string().trim().toLowerCase().email().max(255);
const password = z.string().min(8, "Password must be at least 8 characters").max(100);
const shortText = (max = 100) => z.string().trim().min(1).max(max);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Must start with http:// or https://")
  .optional()
  .default("");
// ---------- auth ----------
export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(100),
});
export const studentSignupSchema = z.object({
  name: shortText(),
  email,
  password,
  university: shortText(255),
  yearOfStudy: z.coerce.number().int().min(1).max(8),
  website: optionalUrl,
});
export const companySignupSchema = z.object({
  name: shortText(),
  email,
  password,
  location: shortText(100),
  industry: shortText(100),
  contactName: shortText(100),
});
export const accountUpdateSchema = z
  .object({
    name: shortText().optional(),
    currentPassword: z.string().max(100).optional(),
    newPassword: password.optional(),
  })
  .refine((v) => !v.newPassword || !!v.currentPassword, {
    message: "Current password is required to set a new password",
    path: ["currentPassword"],
  });
// ---------- listings ----------
export const listingInputSchema = z.object({
  title: shortText(100),
  description: z.string().trim().min(10).max(5000),
  location: shortText(100),
  workType: workTypeSchema,
  duration: shortText(50),
  stipend: z.string().trim().max(50).default(""),
  skills: z.array(shortText(40)).max(15).default([]),
  openings: z.coerce.number().int().min(1).max(1000).default(1),
  startDate: z.string().date().nullable().optional(),
  deadline: z.string().date().nullable().optional(),
});
export const listingQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  location: z.string().trim().max(100).optional(),
  workType: workTypeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(9),
});
// ---------- applications ----------
export const updateStatusSchema = z.object({ status: applicationStatusSchema });
export const applyFieldsSchema = z.object({
  coverNote: z.string().trim().max(1000).optional().default(""),
});
// ---------- AI ----------
export const aiMatchRequestSchema = z.object({
  cvText: z.string().trim().min(50, "Paste at least a few lines of your CV").max(8000),
});

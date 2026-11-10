import { z } from "zod";

/* ------------------------------------------------------------------ *
 *  Shared contract between apps/api and apps/web.
 *  Each zod schema is the single source of truth: the API uses it to
 *  validate requests at runtime, the web app uses z.infer<> types at
 *  compile time. If the shape changes, both sides stop compiling/passing.
 * ------------------------------------------------------------------ */

// ---------- enums ----------
export const roleSchema = z.enum(["student", "company"]);
export type Role = z.infer<typeof roleSchema>;

export const workTypeSchema = z.enum(["on-site", "remote", "hybrid"]);
export type WorkType = z.infer<typeof workTypeSchema>;

export const applicationStatusSchema = z.enum(["pending", "accepted", "rejected"]);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

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
export const loginSchema = z.object({ email, password: z.string().min(1).max(100) });
export type LoginInput = z.infer<typeof loginSchema>;

export const studentSignupSchema = z.object({
  name: shortText(),
  email,
  password,
  university: shortText(255),
  yearOfStudy: z.coerce.number().int().min(1).max(8),
  website: optionalUrl,
});
export type StudentSignupInput = z.infer<typeof studentSignupSchema>;

export const companySignupSchema = z.object({
  name: shortText(),
  email,
  password,
  location: shortText(100),
  industry: shortText(100),
  contactName: shortText(100),
});
export type CompanySignupInput = z.infer<typeof companySignupSchema>;

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
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;

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
export type ListingInput = z.infer<typeof listingInputSchema>;

export const listingQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  location: z.string().trim().max(100).optional(),
  workType: workTypeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(9),
});
export type ListingQuery = z.infer<typeof listingQuerySchema>;

// ---------- applications ----------
export const updateStatusSchema = z.object({ status: applicationStatusSchema });
export const applyFieldsSchema = z.object({
  coverNote: z.string().trim().max(1000).optional().default(""),
});

// ---------- AI ----------
export const aiMatchRequestSchema = z.object({
  cvText: z.string().trim().min(50, "Paste at least a few lines of your CV").max(8000),
});
export type AiMatchRequest = z.infer<typeof aiMatchRequestSchema>;

// ---------- API response types ----------
export interface PublicUser {
  id: number;
  role: Role;
  name: string;
  email: string;
}

export interface Listing {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  description: string;
  location: string;
  workType: WorkType;
  duration: string;
  stipend: string;
  skills: string[];
  openings: number;
  startDate: string | null;
  deadline: string | null;
  createdAt: string;
}

export interface CompanyListing extends Listing {
  applicationCount: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StudentApplication {
  id: number;
  status: ApplicationStatus;
  coverNote: string;
  createdAt: string;
  hasResume: boolean;
  listing: Pick<Listing, "id" | "title" | "companyName" | "location" | "workType">;
}

export interface CompanyApplication {
  id: number;
  status: ApplicationStatus;
  coverNote: string;
  createdAt: string;
  hasResume: boolean;
  listingId: number;
  listingTitle: string;
  student: { name: string; email: string; university: string; website: string };
}

/** Error body every non-2xx API response uses. */
export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

// ---------- AI streaming events (Server-Sent Events payloads) ----------
export type AiMatchEvent =
  | { type: "start"; provider: string; totalCandidates: number }
  | {
      type: "match";
      listing: Pick<Listing, "id" | "title" | "companyName" | "location" | "workType">;
      score: number; // 0-100, computed deterministically from skill overlap
      matchedSkills: string[];
      missingSkills: string[];
    }
  | { type: "reason_delta"; listingId: number; text: string }
  | { type: "reason_done"; listingId: number; source: "ai" | "template" }
  | { type: "done" }
  | { type: "error"; message: string };

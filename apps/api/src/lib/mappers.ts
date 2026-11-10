import type { Listing, WorkType } from "@internly/shared";

/** Shape of a row from `SELECT l.*, u.name AS company_name FROM listings l JOIN users u ...` */
export interface ListingRow {
  id: number;
  company_id: number;
  company_name: string;
  title: string;
  description: string;
  location: string;
  work_type: WorkType;
  duration: string;
  stipend: string;
  skills: string[];
  openings: number;
  start_date: string | null;
  deadline: string | null;
  created_at: Date;
}

// Database uses snake_case, the JSON API uses camelCase: this is the one translation point.
export const toListing = (r: ListingRow): Listing => ({
  id: r.id,
  companyId: r.company_id,
  companyName: r.company_name,
  title: r.title,
  description: r.description,
  location: r.location,
  workType: r.work_type,
  duration: r.duration,
  stipend: r.stipend,
  skills: r.skills,
  openings: r.openings,
  startDate: r.start_date,
  deadline: r.deadline,
  createdAt: r.created_at.toISOString(),
});

export const LISTING_SELECT = `
  SELECT l.id, l.company_id, u.name AS company_name, l.title, l.description, l.location,
         l.work_type, l.duration, l.stipend, l.skills, l.openings, l.start_date, l.deadline, l.created_at
    FROM listings l JOIN users u ON u.id = l.company_id`;

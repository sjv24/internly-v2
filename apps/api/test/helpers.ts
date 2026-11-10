import request from "supertest";
import type { Agent } from "supertest";
import { createApp } from "../src/app.js";
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";
import { pool, query } from "../src/db.js";

export const app = createApp();

/** Every agent keeps its own cookie jar = its own browser. */
export const newBrowser = (): Agent => request.agent(app);

export async function resetDb() {
  await query(
    `TRUNCATE sessions, applications, listings, student_profiles, company_profiles, users RESTART IDENTITY CASCADE`,
  );
  // remove resumes uploaded by earlier tests
  for (const f of fs.existsSync(config.uploadDir) ? fs.readdirSync(config.uploadDir) : []) {
    fs.rmSync(path.join(config.uploadDir, f), { force: true });
  }
}
export const closeDb = () => pool.end();

export const PASSWORD = "Password123!";

export async function signupStudent(browser: Agent, email = "stu@test.dev", name = "Stu Dent") {
  const res = await browser
    .post("/api/auth/signup/student")
    .send({ name, email, password: PASSWORD, university: "Test Uni", yearOfStudy: 2 });
  if (res.status !== 201) throw new Error(`student signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.user as { id: number; role: string; name: string; email: string };
}

export async function signupCompany(browser: Agent, email = "co@test.dev", name = "Test Co") {
  const res = await browser
    .post("/api/auth/signup/company")
    .send({ name, email, password: PASSWORD, location: "Dubai", industry: "Software", contactName: "Recruiter" });
  if (res.status !== 201) throw new Error(`company signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.user as { id: number; role: string; name: string; email: string };
}

export const listingBody = (over: Record<string, unknown> = {}) => ({
  title: "Frontend Intern",
  description: "Build React user interfaces with the team.",
  location: "Dubai",
  workType: "hybrid",
  duration: "3 months",
  stipend: "AED 3000",
  skills: ["React", "TypeScript"],
  openings: 2,
  ...over,
});

export async function createListing(browser: Agent, over: Record<string, unknown> = {}) {
  const res = await browser.post("/api/listings").send(listingBody(over));
  if (res.status !== 201) throw new Error(`create listing failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.listing as { id: number; title: string };
}

export const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

export async function apply(browser: Agent, listingId: number, file: Buffer = PDF, filename = "cv.pdf") {
  return browser
    .post(`/api/listings/${listingId}/apply`)
    .field("coverNote", "I would love to join.")
    .attach("resume", file, { filename, contentType: "application/pdf" });
}

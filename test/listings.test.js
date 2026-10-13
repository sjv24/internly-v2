import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { query } from "../server/db.js";
import {
  PDF,
  apply,
  app,
  closeDb,
  createListing,
  newBrowser,
  resetDb,
  signupCompany,
  signupStudent,
} from "./helpers.js";
beforeEach(resetDb);
afterAll(closeDb);
async function seedListings(n) {
  const co = newBrowser();
  await signupCompany(co, "co@test.dev", "Acme Corp");
  for (let i = 1; i <= n; i++) {
    await createListing(co, {
      title: i % 2 ? `React Developer ${i}` : `Data Analyst ${i}`,
      location: i % 3 ? "Dubai" : "Sharjah",
      workType: i % 3 ? "remote" : "on-site",
      skills: i % 2 ? ["React"] : ["SQL"],
      description:
        i % 2
          ? "Work on user interfaces with modern tooling."
          : "Analyse customer datasets and report findings.",
    });
  }
  return co;
}
describe("GET /api/listings (public)", () => {
  it("paginates in the database and reports totals", async () => {
    await seedListings(12);
    const p1 = await request(app).get("/api/listings?pageSize=5&page=1").expect(200);
    expect(p1.body).toMatchObject({
      total: 12,
      page: 1,
      pageSize: 5,
      totalPages: 3,
    });
    expect(p1.body.items).toHaveLength(5);
    const p3 = await request(app).get("/api/listings?pageSize=5&page=3");
    expect(p3.body.items).toHaveLength(2);
    // newest first
    expect(p1.body.items[0].id).toBeGreaterThan(p1.body.items[4].id);
  });
  it("searches by prefix across title/description, company and skills", async () => {
    await seedListings(6);
    const byTitle = await request(app).get("/api/listings?q=reac");
    expect(byTitle.body.total).toBe(3);
    const byCompany = await request(app).get("/api/listings?q=acme");
    expect(byCompany.body.total).toBe(6);
    const bySkill = await request(app).get("/api/listings?q=sql");
    expect(bySkill.body.total).toBe(3);
  });
  it("filters by location and work type", async () => {
    await seedListings(6);
    const res = await request(app).get("/api/listings?location=sharjah&workType=on-site");
    expect(res.body.total).toBe(2);
    expect(res.body.items.every((l) => l.location === "Sharjah")).toBe(true);
  });
  it("is immune to SQL injection in the search box", async () => {
    await seedListings(2);
    const evil = "'; DROP TABLE users; --";
    const res = await request(app).get("/api/listings").query({ q: evil, location: evil });
    expect(res.status).toBe(200);
    const { rows } = await query(`SELECT count(*) FROM users`);
    expect(Number(rows[0].count)).toBe(1); // the table still exists and still has the company
  });
  it("rejects absurd paging values", async () => {
    await request(app).get("/api/listings?pageSize=100000").expect(400);
    await request(app).get("/api/listings?page=0").expect(400);
  });
  it("supports HTTP caching: ETag + 304 Not Modified", async () => {
    await seedListings(3);
    const first = await request(app).get("/api/listings");
    const etag = first.headers.etag;
    expect(etag).toBeTruthy();
    expect(first.headers["cache-control"]).toBe("no-cache");
    const again = await request(app).get("/api/listings").set("If-None-Match", etag);
    expect(again.status).toBe(304);
    expect(again.text).toBe("");
  });
  it("returns 404 for a missing listing and 400 for a malformed id", async () => {
    await request(app).get("/api/listings/99999").expect(404);
    await request(app).get("/api/listings/abc").expect(400);
  });
  it("does not leak HTML or stack traces on unknown routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });
});
describe("applying", () => {
  it("accepts a PDF, blocks duplicates, and rejects non-PDF uploads", async () => {
    const co = await seedListings(1);
    void co;
    const s = newBrowser();
    await signupStudent(s);
    const first = await apply(s, 1);
    expect(first.status).toBe(201);
    expect((await apply(s, 1)).status).toBe(409); // already applied
    const s2 = newBrowser();
    await signupStudent(s2, "s2@test.dev");
    const wrongType = await s2.post("/api/listings/1/apply").attach("resume", Buffer.from("hello"), {
      filename: "cv.txt",
      contentType: "text/plain",
    });
    expect(wrongType.status).toBe(400);
    const fakePdf = await apply(s2, 1, Buffer.from("this is not a pdf at all"), "cv.pdf");
    expect(fakePdf.status).toBe(400); // claims to be a PDF, content says otherwise
    const missing = await s2.post("/api/listings/1/apply").send({});
    expect(missing.status).toBe(400);
  });
  it("lets a student withdraw a pending application only", async () => {
    const co = await seedListings(1);
    const s = newBrowser();
    await signupStudent(s);
    const { body } = await apply(s, 1);
    await co
      .patch(`/api/applications/${body.application.id}/status`)
      .send({ status: "accepted" })
      .expect(200);
    await s.delete(`/api/applications/${body.application.id}`).expect(409);
    await co.patch(`/api/applications/${body.application.id}/status`).send({ status: "pending" }).expect(200);
    await s.delete(`/api/applications/${body.application.id}`).expect(204);
    expect((await s.get("/api/applications/mine")).body.items).toHaveLength(0);
  });
  it("only students can apply", async () => {
    const co = await seedListings(1);
    await apply(co, 1).then((r) => expect(r.status).toBe(403));
    await request(app).post("/api/listings/1/apply").attach("resume", PDF, "cv.pdf").expect(401);
  });
});

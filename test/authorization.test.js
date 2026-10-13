import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  PASSWORD,
  apply,
  app,
  closeDb,
  createListing,
  listingBody,
  newBrowser,
  resetDb,
  signupCompany,
  signupStudent,
} from "./helpers.js";
beforeEach(resetDb);
afterAll(closeDb);
/* Each test below is a v1 vulnerability that must now be impossible. */
describe("who may change listings", () => {
  it("anonymous visitors can NOT create, edit or delete (v1: anyone could delete anything)", async () => {
    const owner = newBrowser();
    await signupCompany(owner);
    const listing = await createListing(owner);
    await request(app).post("/api/listings").send(listingBody()).expect(401);
    await request(app).put(`/api/listings/${listing.id}`).send(listingBody()).expect(401);
    await request(app).delete(`/api/listings/${listing.id}`).expect(401);
  });
  it("a student can NOT create listings", async () => {
    const s = newBrowser();
    await signupStudent(s);
    await s.post("/api/listings").send(listingBody()).expect(403);
  });
  it("company B can NOT edit or delete company A's listing (IDOR)", async () => {
    const a = newBrowser();
    const b = newBrowser();
    await signupCompany(a, "a@test.dev", "A Corp");
    await signupCompany(b, "b@test.dev", "B Corp");
    const listing = await createListing(a);
    await b
      .put(`/api/listings/${listing.id}`)
      .send(listingBody({ title: "Hacked title" }))
      .expect(403);
    await b.delete(`/api/listings/${listing.id}`).expect(403);
    const still = await request(app).get(`/api/listings/${listing.id}`);
    expect(still.body.listing.title).toBe("Frontend Intern");
  });
  it("the owner can edit and delete", async () => {
    const a = newBrowser();
    await signupCompany(a);
    const listing = await createListing(a);
    const upd = await a
      .put(`/api/listings/${listing.id}`)
      .send(listingBody({ title: "New title" }))
      .expect(200);
    expect(upd.body.listing.title).toBe("New title");
    await a.delete(`/api/listings/${listing.id}`).expect(204);
    await request(app).get(`/api/listings/${listing.id}`).expect(404);
  });
  it("the company id comes from the session, not from the request body", async () => {
    const a = newBrowser();
    const user = await signupCompany(a);
    const res = await a
      .post("/api/listings")
      .send({ ...listingBody(), companyId: 9999 })
      .expect(201);
    expect(res.body.listing.companyId).toBe(user.id);
  });
});
describe("applications and resumes are private", () => {
  async function scenario() {
    const company = newBrowser();
    const otherCompany = newBrowser();
    const student = newBrowser();
    const otherStudent = newBrowser();
    await signupCompany(company, "c1@test.dev", "Company One");
    await signupCompany(otherCompany, "c2@test.dev", "Company Two");
    await signupStudent(student, "s1@test.dev");
    await signupStudent(otherStudent, "s2@test.dev");
    const listing = await createListing(company);
    const applied = await apply(student, listing.id);
    expect(applied.status).toBe(201);
    return {
      company,
      otherCompany,
      student,
      otherStudent,
      appId: applied.body.application.id,
    };
  }
  it("resumes are not publicly downloadable (v1 served /uploads/ to everyone)", async () => {
    const { appId } = await scenario();
    await request(app).get(`/api/applications/${appId}/resume`).expect(401);
    await request(app).get(`/uploads/anything.pdf`).expect(404); // no static uploads folder any more
  });
  it("only the applicant and the owning company can read a resume", async () => {
    const { company, otherCompany, student, otherStudent, appId } = await scenario();
    await student.get(`/api/applications/${appId}/resume`).expect(200).expect("Content-Type", /pdf/);
    await company.get(`/api/applications/${appId}/resume`).expect(200);
    await otherStudent.get(`/api/applications/${appId}/resume`).expect(403);
    await otherCompany.get(`/api/applications/${appId}/resume`).expect(403);
  });
  it("only the owning company can change an application's status", async () => {
    const { company, otherCompany, student, appId } = await scenario();
    await student.patch(`/api/applications/${appId}/status`).send({ status: "accepted" }).expect(403);
    await otherCompany.patch(`/api/applications/${appId}/status`).send({ status: "accepted" }).expect(403);
    await company.patch(`/api/applications/${appId}/status`).send({ status: "bogus" }).expect(400);
    await company.patch(`/api/applications/${appId}/status`).send({ status: "accepted" }).expect(200);
    const mine = await student.get("/api/applications/mine");
    expect(mine.body.items[0].status).toBe("accepted");
  });
  it("a company only sees applicants to ITS listings", async () => {
    const { company, otherCompany } = await scenario();
    expect((await company.get("/api/applications/received")).body.items).toHaveLength(1);
    expect((await otherCompany.get("/api/applications/received")).body.items).toHaveLength(0);
  });
  it("a student only sees their own applications", async () => {
    const { student, otherStudent } = await scenario();
    expect((await student.get("/api/applications/mine")).body.items).toHaveLength(1);
    expect((await otherStudent.get("/api/applications/mine")).body.items).toHaveLength(0);
  });
});
describe("cross-site request forgery", () => {
  it("rejects a state-changing request that comes from another website's origin", async () => {
    const s = newBrowser();
    await signupStudent(s);
    const res = await s.post("/api/auth/logout").set("Origin", "https://evil.example");
    expect(res.status).toBe(403);
  });
  it("accepts the same request from the app's own origin", async () => {
    const s = newBrowser();
    await signupStudent(s);
    await s.post("/api/auth/logout").set("Origin", "http://localhost:3000").expect(204);
  });
});
describe("account deletion", () => {
  it("needs the password and removes the user's data", async () => {
    const s = newBrowser();
    await signupStudent(s, "del@test.dev");
    await s.delete("/api/account").send({ password: "wrong-password" }).expect(400);
    await s.delete("/api/account").send({ password: PASSWORD }).expect(204);
    await request(app)
      .post("/api/auth/login")
      .send({ email: "del@test.dev", password: PASSWORD })
      .expect(401);
  });
});

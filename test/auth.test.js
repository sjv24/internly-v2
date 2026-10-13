import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { query } from "../server/db.js";
import { PASSWORD, app, closeDb, newBrowser, resetDb, signupCompany, signupStudent } from "./helpers.js";
import request from "supertest";
beforeEach(resetDb);
afterAll(closeDb);
describe("sessions (the v1 'one global session' bug)", () => {
  it("keeps two logged-in users completely separate", async () => {
    const alice = newBrowser();
    const bob = newBrowser();
    await signupStudent(alice, "alice@test.dev", "Alice");
    await signupCompany(bob, "bob@test.dev", "Bob Inc");
    const a = await alice.get("/api/auth/me");
    const b = await bob.get("/api/auth/me");
    expect(a.body.user).toMatchObject({ name: "Alice", role: "student" });
    expect(b.body.user).toMatchObject({ name: "Bob Inc", role: "company" });
  });
  it("a browser with no cookie is anonymous", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.body.user).toBeNull();
  });
  it("sets an httpOnly, SameSite cookie and stores only a hash of the token", async () => {
    const res = await request(app).post("/api/auth/signup/student").send({
      name: "X Y",
      email: "x@test.dev",
      password: PASSWORD,
      university: "U",
      yearOfStudy: 1,
    });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const token = /sid=([^;]+)/.exec(cookie)[1];
    const { rows } = await query(`SELECT id FROM sessions`);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toContain(token); // the raw token is never stored
  });
  it("logout really ends the session", async () => {
    const b = newBrowser();
    await signupStudent(b);
    await b.post("/api/auth/logout").expect(204);
    const res = await b.get("/api/auth/me");
    expect(res.body.user).toBeNull();
  });
});
describe("passwords and login", () => {
  it("stores a bcrypt hash, never the password", async () => {
    await signupStudent(newBrowser());
    const { rows } = await query(`SELECT password_hash FROM users`);
    expect(rows[0].password_hash).not.toBe(PASSWORD);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });
  it("logs in with the right password and rejects the wrong one with the same message as an unknown email", async () => {
    await signupStudent(newBrowser(), "me@test.dev");
    await request(app).post("/api/auth/login").send({ email: "me@test.dev", password: PASSWORD }).expect(200);
    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ email: "me@test.dev", password: "nope-nope" });
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "who@test.dev", password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message); // no account enumeration
  });
  it("treats emails case-insensitively and rejects duplicates", async () => {
    await signupStudent(newBrowser(), "Case@Test.dev");
    const dup = await newBrowser().post("/api/auth/signup/student").send({
      name: "Dup",
      email: "case@test.dev",
      password: PASSWORD,
      university: "U",
      yearOfStudy: 1,
    });
    expect(dup.status).toBe(409);
  });
  it("returns field-level validation errors", async () => {
    const res = await request(app).post("/api/auth/signup/student").send({
      name: "",
      email: "not-an-email",
      password: "short",
      university: "U",
      yearOfStudy: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });
  it("changing the password needs the current one, and then the new one works", async () => {
    const b = newBrowser();
    await signupStudent(b, "pw@test.dev");
    const bad = await b
      .patch("/api/account")
      .send({ currentPassword: "wrong-pass", newPassword: "BrandNew123" });
    expect(bad.status).toBe(400);
    await b.patch("/api/account").send({ currentPassword: PASSWORD, newPassword: "BrandNew123" }).expect(200);
    await request(app)
      .post("/api/auth/login")
      .send({ email: "pw@test.dev", password: "BrandNew123" })
      .expect(200);
    await request(app).post("/api/auth/login").send({ email: "pw@test.dev", password: PASSWORD }).expect(401);
  });
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { containsTerm, rankListings } from "../server/ai/matcher.js";
import { app, closeDb, createListing, newBrowser, resetDb, signupCompany, signupStudent } from "./helpers.js";
afterAll(closeDb);
const listing = (id, title, skills) => ({
  id,
  companyId: 1,
  companyName: "Co",
  title,
  description: "d",
  location: "Dubai",
  workType: "remote",
  duration: "3 months",
  stipend: "",
  skills,
  openings: 1,
  startDate: null,
  deadline: null,
  createdAt: new Date().toISOString(),
});
describe("matcher (deterministic scoring)", () => {
  it("matches whole words only: 'java' is not 'javascript'", () => {
    expect(containsTerm("i know javascript and react", "java")).toBe(false);
    expect(containsTerm("i know java and react", "java")).toBe(true);
    expect(containsTerm("experienced in c++ and node.js.", "c++")).toBe(true);
    expect(containsTerm("experienced in c++ and node.js.", "node.js")).toBe(true);
  });
  it("ranks by skill coverage and lists matched and missing skills", () => {
    const cv =
      "Final-year student. Skills: React, TypeScript, Node.js, SQL. Built a frontend developer portfolio.";
    const ranked = rankListings(cv, [
      listing(1, "Frontend Developer Intern", ["React", "TypeScript", "CSS"]),
      listing(2, "Marketing Intern", ["SEO", "Canva"]),
      listing(3, "Backend Developer Intern", ["Node.js", "SQL"]),
    ]);
    expect(ranked.map((r) => r.listing.id)).toEqual([3, 1]); // the marketing role has no overlap -> dropped
    expect(ranked[0].matchedSkills).toEqual(["Node.js", "SQL"]);
    expect(ranked[1].missingSkills).toEqual(["CSS"]);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});
describe("POST /api/ai/match (streaming)", () => {
  beforeEach(resetDb);
  const CV =
    "Computer science student with experience in React, TypeScript and Node.js. I built a full-stack project with SQL.";
  function parseSse(text) {
    return text
      .split("\n\n")
      .filter((b) => b.startsWith("data: "))
      .map((b) => JSON.parse(b.slice(6)));
  }
  it("requires a logged-in student", async () => {
    await request(app).post("/api/ai/match").send({ cvText: CV }).expect(401);
    const co = newBrowser();
    await signupCompany(co);
    await co.post("/api/ai/match").send({ cvText: CV }).expect(403);
  });
  it("validates the CV text", async () => {
    const s = newBrowser();
    await signupStudent(s);
    const res = await s.post("/api/ai/match").send({ cvText: "too short" });
    expect(res.status).toBe(400);
  });
  it("streams start -> match -> reason chunks -> done, with the offline provider", async () => {
    const co = newBrowser();
    await signupCompany(co);
    await createListing(co, {
      title: "Frontend Developer Intern",
      skills: ["React", "TypeScript", "CSS"],
    });
    await createListing(co, { title: "Chef Intern", skills: ["Cooking"] });
    const s = newBrowser();
    await signupStudent(s);
    const res = await s
      .post("/api/ai/match")
      .send({ cvText: CV })
      .buffer(true)
      .parse((r, cb) => {
        let data = "";
        r.setEncoding("utf8");
        r.on("data", (c) => (data += c));
        r.on("end", () => cb(null, data));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    const events = parseSse(res.body);
    expect(events[0]).toMatchObject({
      type: "start",
      provider: "offline",
      totalCandidates: 1,
    });
    expect(events.at(-1)).toEqual({ type: "done" });
    const match = events.find((e) => e.type === "match");
    expect(match).toMatchObject({
      type: "match",
      matchedSkills: ["React", "TypeScript"],
      missingSkills: ["CSS"],
    });
    const reason = events
      .filter((e) => e.type === "reason_delta")
      .map((e) => e.text)
      .join("");
    expect(reason).toContain("React, TypeScript");
    expect(events.some((e) => e.type === "reason_done" && e.source === "template")).toBe(true);
  });
});

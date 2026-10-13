import { pool, query, withTransaction } from "./db.js";
import { hashPassword } from "./lib/passwords.js";
import { logger } from "./logger.js";
/*
 * SAMPLE DATA for local development and demos. All companies and people are fictional.
 * Demo logins (password for all of them: Password123!):
 *   student@internly.dev   (student)        company@internly.dev   (Northwind Labs)
 */
export const DEMO_PASSWORD = "Password123!";
const COMPANIES = [
  {
    name: "Northwind Labs",
    email: "company@internly.dev",
    location: "Dubai",
    industry: "Software",
  },
  {
    name: "Falcon Robotics",
    email: "hr@falcon-robotics.example",
    location: "Abu Dhabi",
    industry: "Robotics",
  },
  {
    name: "Oasis Analytics",
    email: "jobs@oasis-analytics.example",
    location: "Dubai",
    industry: "Data & AI",
  },
  {
    name: "Palm Fintech",
    email: "careers@palm-fintech.example",
    location: "Sharjah",
    industry: "Finance",
  },
  {
    name: "Desert Cloud",
    email: "talent@desert-cloud.example",
    location: "Dubai",
    industry: "Cloud",
  },
  {
    name: "Marina Media",
    email: "hello@marina-media.example",
    location: "Ajman",
    industry: "Media",
  },
  {
    name: "Gulf Health Tech",
    email: "people@gulfhealth.example",
    location: "Abu Dhabi",
    industry: "Healthcare",
  },
  {
    name: "Souk Commerce",
    email: "intern@souk-commerce.example",
    location: "Ras Al Khaimah",
    industry: "E-commerce",
  },
];
// [company index, title, location, workType, duration, stipend, skills, description]
const LISTINGS = [
  [
    0,
    "Frontend Developer Intern",
    "Dubai",
    "hybrid",
    "3 months",
    "AED 3000/month",
    ["JavaScript", "React", "TypeScript", "CSS"],
    "Build and polish user-facing features in our React dashboard. You will pair with senior engineers, write tests and ship to production every week.",
  ],
  [
    0,
    "Backend Developer Intern",
    "Dubai",
    "on-site",
    "4 months",
    "AED 3000/month",
    ["Node.js", "PostgreSQL", "REST", "Git"],
    "Design REST endpoints, write SQL, and improve the reliability of the services behind our product.",
  ],
  [
    0,
    "Full-Stack Engineer Intern",
    "Dubai",
    "hybrid",
    "6 months",
    "AED 3500/month",
    ["TypeScript", "React", "Node.js", "SQL"],
    "Own small features end to end: database, API and UI. Great fit if you like seeing your work in front of users.",
  ],
  [
    1,
    "Robotics Software Intern",
    "Abu Dhabi",
    "on-site",
    "6 months",
    "AED 3200/month",
    ["Python", "C++", "ROS", "Linux"],
    "Work on perception and motion-planning code that runs on real robots in our test arena.",
  ],
  [
    1,
    "Embedded Systems Intern",
    "Abu Dhabi",
    "on-site",
    "4 months",
    "AED 2800/month",
    ["C", "C++", "Electronics", "Debugging"],
    "Bring up firmware for new sensor boards and help write hardware test tooling.",
  ],
  [
    2,
    "Data Analyst Intern",
    "Dubai",
    "remote",
    "3 months",
    "AED 2500/month",
    ["SQL", "Python", "Excel", "Tableau"],
    "Turn messy customer data into dashboards and clear recommendations for our consulting team.",
  ],
  [
    2,
    "Machine Learning Intern",
    "Dubai",
    "hybrid",
    "6 months",
    "AED 3500/month",
    ["Python", "PyTorch", "Pandas", "Machine Learning"],
    "Prototype and evaluate models for forecasting and document understanding, then help ship them.",
  ],
  [
    2,
    "AI Engineer Intern",
    "Dubai",
    "hybrid",
    "6 months",
    "AED 3800/month",
    ["Python", "LLMs", "RAG", "LangGraph", "APIs"],
    "Build retrieval-augmented and agent-based features: prompts, evaluation, tool calling and monitoring.",
  ],
  [
    3,
    "Software Engineering Intern",
    "Sharjah",
    "on-site",
    "3 months",
    "AED 3000/month",
    ["Java", "Spring", "SQL", "Testing"],
    "Contribute to payment services used by thousands of merchants. Code reviews and mentoring included.",
  ],
  [
    3,
    "Cybersecurity Intern",
    "Sharjah",
    "hybrid",
    "4 months",
    "AED 3000/month",
    ["Networking", "Linux", "Python", "Security"],
    "Help our security team triage alerts, harden systems and run vulnerability scans.",
  ],
  [
    4,
    "Cloud / DevOps Intern",
    "Dubai",
    "remote",
    "4 months",
    "AED 3000/month",
    ["Docker", "Linux", "CI/CD", "AWS", "Git"],
    "Automate deployments, improve our pipelines and learn how production infrastructure really runs.",
  ],
  [
    4,
    "Site Reliability Intern",
    "Dubai",
    "hybrid",
    "6 months",
    "AED 3200/month",
    ["Linux", "Python", "Monitoring", "Kubernetes"],
    "Join on-call shadowing, write runbooks and build dashboards that make outages shorter.",
  ],
  [
    5,
    "Social Media Intern",
    "Ajman",
    "on-site",
    "3 months",
    "AED 1800/month",
    ["Content Writing", "Canva", "Social Media", "Analytics"],
    "Plan, create and measure posts for our client brands across Instagram, TikTok and LinkedIn.",
  ],
  [
    5,
    "Video Editing Intern",
    "Ajman",
    "on-site",
    "3 months",
    "AED 2000/month",
    ["Premiere Pro", "After Effects", "Storytelling"],
    "Cut short-form video, add motion graphics and help produce weekly shows.",
  ],
  [
    5,
    "UX Design Intern",
    "Ajman",
    "hybrid",
    "4 months",
    "AED 2500/month",
    ["Figma", "User Research", "Prototyping", "CSS"],
    "Run user interviews, design flows in Figma and test them with real people.",
  ],
  [
    6,
    "Health Data Intern",
    "Abu Dhabi",
    "hybrid",
    "4 months",
    "AED 2800/month",
    ["Python", "SQL", "Statistics", "Data Visualization"],
    "Clean and analyse anonymised clinical datasets to support hospital operations.",
  ],
  [
    6,
    "Mobile App Developer Intern",
    "Abu Dhabi",
    "hybrid",
    "4 months",
    "AED 3000/month",
    ["React Native", "TypeScript", "REST", "Git"],
    "Help build the patient-facing mobile app: appointment booking, reminders and results.",
  ],
  [
    7,
    "E-commerce Analytics Intern",
    "Ras Al Khaimah",
    "remote",
    "3 months",
    "AED 2200/month",
    ["Excel", "SQL", "Google Analytics", "A/B Testing"],
    "Analyse funnels and run experiments that improve conversion across our online store.",
  ],
  [
    7,
    "Web Developer Intern",
    "Ras Al Khaimah",
    "remote",
    "3 months",
    "AED 2400/month",
    ["HTML", "CSS", "JavaScript", "Accessibility"],
    "Build responsive, accessible storefront pages and keep them fast on slow mobile networks.",
  ],
  [
    7,
    "Product Management Intern",
    "Ras Al Khaimah",
    "hybrid",
    "4 months",
    "AED 2600/month",
    ["Communication", "Analytics", "Roadmapping", "SQL"],
    "Shadow our product managers, write specs and help prioritise the next quarter's roadmap.",
  ],
];
export async function seed(opts = {}) {
  const hash = await hashPassword(DEMO_PASSWORD);
  await withTransaction(async (client) => {
    const companyIds = [];
    for (const c of COMPANIES) {
      const { rows } = await client.query(
        `INSERT INTO users (role, email, password_hash, name) VALUES ('company', $1, $2, $3) RETURNING id`,
        [c.email, hash, c.name],
      );
      companyIds.push(rows[0].id);
      await client.query(
        `INSERT INTO company_profiles (user_id, location, industry, contact_name) VALUES ($1,$2,$3,'Recruiting Team')`,
        [rows[0].id, c.location, c.industry],
      );
    }
    const student = await client.query(
      `INSERT INTO users (role, email, password_hash, name) VALUES ('student', 'student@internly.dev', $1, 'Sam Student') RETURNING id`,
      [hash],
    );
    await client.query(
      `INSERT INTO student_profiles (user_id, university, year_of_study, website) VALUES ($1, 'Demo University', 3, 'https://example.com/sam')`,
      [student.rows[0].id],
    );
    // newest-first ordering uses created_at, so stagger them to give a natural order
    for (const [
      i,
      [ci, title, location, workType, duration, stipend, skills, description],
    ] of LISTINGS.entries()) {
      await client.query(
        `INSERT INTO listings (company_id, title, description, location, work_type, duration, stipend, skills, openings, deadline, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CURRENT_DATE + 60, now() - ($10 || ' hours')::interval)`,
        [
          companyIds[ci],
          title,
          description,
          location,
          workType,
          duration,
          stipend,
          skills,
          (i % 3) + 1,
          String(i * 5),
        ],
      );
    }
    // a couple of demo applications so the dashboards are not empty (no resume file for seeded rows)
    await client.query(
      `INSERT INTO applications (student_id, listing_id, status, cover_note)
       SELECT $1, id, s.status, 'Excited to apply - sample application.'
         FROM (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM listings) l
         JOIN (VALUES (1, 'pending'), (2, 'accepted'), (4, 'rejected')) AS s(rn, status) ON s.rn = l.rn`,
      [student.rows[0].id],
    );
    // optional: lots of extra rows to demonstrate pagination / indexes / search performance
    if (opts.bulk && opts.bulk > 0) {
      const roles = ["Software", "Data", "Marketing", "Design", "Finance", "Operations", "Security", "Cloud"];
      const skillPool = [
        "Python",
        "SQL",
        "React",
        "TypeScript",
        "Excel",
        "Figma",
        "Docker",
        "Java",
        "Node.js",
        "Git",
      ];
      await client.query(
        `INSERT INTO listings (company_id, title, description, location, work_type, duration, stipend, skills, openings, deadline, created_at)
         SELECT ($1::int[])[1 + (g % $2)],
                ($3::text[])[1 + (g % $4)] || ' Intern #' || g,
                'Sample bulk listing number ' || g || ' used to test pagination, search and indexes at scale.',
                (ARRAY['Dubai','Abu Dhabi','Sharjah','Ajman','Fujairah'])[1 + (g % 5)],
                (ARRAY['on-site','remote','hybrid'])[1 + (g % 3)],
                '3 months', 'AED 2000/month',
                ARRAY[($5::text[])[1 + (g % 10)], ($5::text[])[1 + ((g * 7) % 10)]],
                1, CURRENT_DATE + 30, now() - (g || ' minutes')::interval
           FROM generate_series(1, $6) AS g`,
        [companyIds, companyIds.length, roles, roles.length, skillPool, opts.bulk],
      );
    }
  });
  logger.info(`seeded sample data${opts.bulk ? ` (+${opts.bulk} bulk listings)` : ""}`);
}
export async function seedIfEmpty() {
  const { rows } = await query(`SELECT count(*) FROM users`);
  if (Number(rows[0].count) > 0) return false;
  await seed();
  return true;
}
// `npm run db:seed` -> add sample data (optionally: -- --bulk 2000)
if (process.argv[1]?.endsWith("seed.js")) {
  const i = process.argv.indexOf("--bulk");
  const bulk = i > -1 ? Number(process.argv[i + 1]) : 0;
  const { migrate, waitForDb } = await import("./migrate.js");
  await waitForDb();
  await migrate();
  if ((await query(`SELECT 1 FROM users LIMIT 1`)).rowCount) {
    console.log("Database already has data. Run `npm run db:reset` first for a clean start.");
  } else {
    await seed({ bulk });
  }
  await pool.end();
}

# Internly v2 scope

Rebuild of Internly (v1, July/Aug 2025, see tag `v1-legacy`) with the same product, rebuilt properly.

## Same features as v1

- Student + company signup/login/logout
- Browse and search internships (public), apply with a PDF resume, track application status
- Company: create/edit/delete own internships, review applicants, accept/reject
- Static marketing sections kept as small components: testimonials slider, partner logo wall (labelled as sample content)

## Upgrades (each maps to a JD item)

| Upgrade                                                                                                              | JD item                             |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Express + TypeScript API, per-user cookie sessions, role and ownership checks, zod validation, central error handler | Node APIs, business logic, security |
| Server-side search, filters, pagination, DB indexes                                                                  | API design, performance             |
| Private resume uploads (only the owner and the receiving company can read)                                           | security                            |
| React + TypeScript frontend, typed API client, custom hooks, protected routes, error boundary                        | React, TS, component design         |
| npm-workspaces monorepo with shared zod schemas/types                                                                | monorepo, modular development       |
| AI CV matcher: ranked listings with reasons, streamed, stop button                                                   | AI project, reliable AI UX          |
| Vitest + Supertest tests, GitHub Actions CI, /health, request-ID logging                                             | testing, stability, monitoring      |
| Free deploy (static host + Render + MySQL-compatible free DB)                                                        | release                             |

## Acceptance (done = ...)

- Two users logged in at once never see each other's data
- An anonymous request can never modify or delete anything
- Listing page stays fast with 1,000+ rows (paginated)
- `npm test` and CI are green; the public URL works

## Out of scope

Email notifications, payments, admin panel, agent-with-tools (only if time remains).

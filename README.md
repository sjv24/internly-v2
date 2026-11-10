# Internly

> **Two versions of this project:** `main` (this branch) is the React + TypeScript version. The [`vanilla`](../../tree/vanilla) branch is the same app with a plain HTML, CSS and JavaScript front end.

An internship portal that connects **students** with **companies**: search and apply with a resume, track every application, post and manage listings, review applicants, and get an **AI CV match** that ranks listings with explanations.

**v2** is a ground-up rebuild of my first version (kept in [`legacy/`](legacy), tag `v1-legacy`) with a modern, secure, tested stack.

|             | v1 (`legacy/`)                          | v2                                                          |
| ----------- | --------------------------------------- | ----------------------------------------------------------- |
| Frontend    | static HTML + `innerHTML` scripts       | React 19, TypeScript (strict), Vite, Tailwind               |
| Backend     | raw `http` module, one 800-line file    | Node + Express 5, TypeScript, middleware pipeline           |
| Database    | MySQL, one shared connection            | PostgreSQL with constraints, indexes, full-text search      |
| Auth        | **one global session for all visitors** | per-user httpOnly cookie sessions, role + ownership checks  |
| Data safety | no validation, XSS, public resumes      | zod validation, escaped rendering, private resume downloads |
| Quality     | no tests                                | 55 tests (38 API on real Postgres, 17 web), ESLint, CI      |
| AI          | none                                    | streamed CV matcher with deterministic scores and fallback  |

## Quick start

Requires **Node.js 22+**. No Docker or database install needed.

```bash
npm install
npm run setup     # creates .env
npm run dev       # database + API + web app
```

Open <http://localhost:5173> and log in with `student@internly.dev` or `company@internly.dev` (password `Password123!`).

## Documentation

**[docs/GUIDE.md](docs/GUIDE.md)** explains how everything works: architecture, request flows, a file-by-file map, the database, the security fixes (with the test that proves each), the AI design, deployment and honest limitations.

## Stack

- **Web:** React 19, React Router 7, TypeScript, Vite 8, Tailwind CSS 4, Vitest + Testing Library
- **API:** Express 5, TypeScript, `pg`, zod, bcryptjs, multer, helmet, pino, Vitest + Supertest
- **Shared:** `packages/shared`, zod schemas and types used by both apps (npm workspaces monorepo)
- **Infra:** embedded PostgreSQL for local dev, GitHub Actions CI, Render blueprint for free hosting

## Repository layout

```
apps/api         Express API, SQL schema, seed data, tests
apps/web         React app, hooks, components, tests
packages/shared  zod schemas + TypeScript types shared by both
legacy/          the original v1 app (reference only)
docs/            guide and scope
scripts/         local database + setup helpers
```

## What I would do next

- Move resume storage to object storage (disk is ephemeral on free hosts)
- Turn the CV matcher into a small tool-using agent (search listings, read a listing, check status) with schema-validated tool inputs and step limits
- Add an end-to-end Playwright test for "student finds a listing and applies", and email notifications on status changes
- Add TanStack Query or RTK Query if more screens start sharing server data

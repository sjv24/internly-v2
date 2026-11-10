# Internly v2: the complete guide

How the app works, how every file connects to the others, and how to run it on your machine.

> **Contents**
>
> 1. [Run it locally (5 minutes)](#1-run-it-locally)
> 2. [What the app does](#2-what-the-app-does)
> 3. [Architecture at a glance](#3-architecture-at-a-glance)
> 4. [Follow a request end to end](#4-follow-a-request-end-to-end)
> 5. [File map: what every file does and what it connects to](#5-file-map)
> 6. [The database](#6-the-database)
> 7. [Security: v1 problem → v2 fix → proof](#7-security-v1-problem--v2-fix--proof)
> 8. [Frontend deep dive](#8-frontend-deep-dive)
> 9. [The AI CV matcher](#9-the-ai-cv-matcher)
> 10. [Testing, linting and CI](#10-testing-linting-and-ci)
> 11. [Configuration reference](#11-configuration-reference)
> 12. [Deploying for free](#12-deploying-for-free)
> 13. [Honest limitations](#13-honest-limitations)
> 14. [Concept cheat sheet (interview map)](#14-concept-cheat-sheet-interview-map)

---

## 1. Run it locally

**You need:** Node.js 22 or newer (`node -v`) and nothing else. No Docker, no database installer.

```bash
npm install        # installs everything for all three packages (about 1 minute)
npm run setup      # creates your .env file from .env.example (once)
npm run dev        # starts the database + API + web app together
```

Then open **http://localhost:5173**.

The PostgreSQL binaries arrive with `npm install`. The first `npm run dev` initialises a database in a hidden `.pgdata/` folder (about 20 seconds), creates the tables, and loads sample data.

**Demo accounts** (password for all of them: `Password123!`)

| Role    | Email                                   | What to try                                                                            |
| ------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| Student | `student@internly.dev`                  | search internships, apply with a PDF, **AI CV Match**, track and withdraw applications |
| Company | `company@internly.dev` (Northwind Labs) | create/edit/delete listings, review applicants, accept/reject, view resumes            |

**What `npm run dev` starts** (three processes, one terminal):

| Name  | Port  | What it is                                                                                |
| ----- | ----- | ----------------------------------------------------------------------------------------- |
| `db`  | 54329 | a real PostgreSQL server (the `embedded-postgres` npm package runs it, no install needed) |
| `api` | 8080  | the Express backend (restarts automatically when you edit code)                           |
| `web` | 5173  | the Vite dev server for React. It forwards `/api/*` to port 8080                          |

**Other commands**

| Command                          | What it does                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm test`                       | runs all tests (needs the database running: use a second terminal for `npm run db`, or run it while `npm run dev` is up) |
| `npm run typecheck`              | TypeScript check of all packages                                                                                         |
| `npm run lint`                   | ESLint                                                                                                                   |
| `npm run build`                  | production build of the web app into `apps/web/dist`                                                                     |
| `npm start`                      | runs the API in production style (also serves `apps/web/dist` if it exists)                                              |
| `npm run db:reset`               | wipes the local database (next start recreates + reseeds it)                                                             |
| `npm run db:seed -- --bulk 2000` | adds 2000 extra listings, to see pagination/search at scale (run `db:reset` first if the DB already has data)            |

**Troubleshooting**

| Symptom                                                     | Fix                                                                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Port 8080 / 5173 / 54329 already in use`                   | something else is using it; close the old `npm run dev` window, or change `PORT` in `.env`                                                             |
| API says "Waiting for the database…" for more than a minute | the `db` process failed. Look at the `[db]` lines in the terminal. Deleting the `.pgdata/` folder (with everything stopped) gives you a fresh database |
| Tests: "Cannot reach the test database"                     | start the database (`npm run db`) before `npm test`                                                                                                    |
| You want real AI explanations                               | put an API key in `AI_API_KEY` in `.env` and restart (see [section 9](#9-the-ai-cv-matcher))                                                           |

---

## 2. What the app does

Internly is a two-sided internship portal.

- **Anyone** can browse and search listings.
- **Students** register, apply to a listing with a PDF resume and a cover note, track the status of every application (pending / accepted / rejected), withdraw pending ones, and use the **AI CV Match** to get ranked listings with explanations.
- **Companies** register, post and manage their own listings, see who applied, open resumes, and accept or reject applicants.

---

## 3. Architecture at a glance

```
┌───────────────────────────── BROWSER ─────────────────────────────┐
│  React 19 + TypeScript app (apps/web)                             │
│   pages → components → hooks → lib/api.ts (typed fetch client)    │
│   AuthContext: "who is logged in?"      session cookie (httpOnly) │
└───────────────┬───────────────────────────────────────────────────┘
                │ HTTPS/HTTP + JSON   (dev: Vite forwards /api → :8080)
┌───────────────▼────────────── EXPRESS API (apps/api) ─────────────┐
│ middleware pipeline, in order:                                    │
│  requestId → access log → helmet → cors → json → cookies →        │
│  rate limit → originCheck(CSRF) → loadUser(cookie→user)           │
│ routes: /auth /listings /applications /account /ai   (+ /health)  │
│ every handler: zod-validate input → authorise → parameterised SQL │
│ errors anywhere → one errorHandler → uniform JSON error           │
└───────┬───────────────────────┬─────────────────────┬─────────────┘
        │ pg Pool (SQL)         │ files               │ HTTPS (optional)
┌───────▼────────┐   ┌──────────▼───────┐   ┌─────────▼──────────────┐
│ PostgreSQL     │   │ apps/api/uploads │   │ LLM provider (writes   │
│ users, listings│   │ resumes, random  │   │ the explanations; the  │
│ applications,  │   │ names, NOT served│   │ app works without it)  │
│ sessions       │   │ statically       │   └────────────────────────┘
└────────────────┘   └──────────────────┘

        packages/shared  ←── imported by BOTH apps: zod schemas + TypeScript types
```

**Why this shape**

| Choice                                                                   | Reason                                                                                                                                              |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Monorepo** (npm workspaces: `apps/api`, `apps/web`, `packages/shared`) | one repo, one install, one CI; the API and the UI share one definition of every data shape                                                          |
| **`packages/shared` with zod**                                           | the same schema validates requests on the server (runtime) _and_ types the UI (compile time). Change a field once → both sides notice               |
| **Cookie sessions stored in the DB**                                     | simple, revocable (logout really logs out), and the token is invisible to JavaScript                                                                |
| **Postgres**                                                             | real relational database; full-text search, constraints, indexes; same engine you can use for free in the cloud                                     |
| **Vite dev proxy**                                                       | the browser only ever talks to `:5173`, so cookies work without CORS gymnastics. In production the API serves the built UI itself: one origin again |
| **No Redux**                                                             | state is small: auth lives in Context, server data in a `useApiData` hook, filters in the URL (see [section 8](#8-frontend-deep-dive))              |

---

## 4. Follow a request end to end

### A. Logging in

1. **`pages/Login.tsx`** collects email + password (controlled inputs) and calls `login()` from the auth context.
2. **`context/AuthContext.tsx`** calls `api.post("/api/auth/login", …)`.
3. **`lib/api.ts`** adds an `X-Request-Id` header and sends `fetch` with the JSON body.
4. The dev server (**`vite.config.ts` proxy**) forwards it to Express on `:8080`.
5. Express runs the middleware pipeline in **`api/src/app.ts`** (request id → log → security headers → body parsing → rate limit → CSRF check → `loadUser`, which finds no cookie yet).
6. **`routes/auth.ts`** `POST /login`: the login rate limiter (10 failed tries / 15 min), then `loginSchema.parse(req.body)` (zod, from **`packages/shared`**). Then SQL: `SELECT … WHERE lower(email) = lower($1)`. Then **`lib/passwords.ts`** `verifyPassword` (bcrypt). If the email is unknown it still runs bcrypt against a dummy hash, so timing doesn't reveal which emails exist.
7. **`lib/sessions.ts`** `startSession`: creates 32 random bytes, stores `SHA-256(token)` in the `sessions` table with an expiry, and sets the cookie `sid` (`HttpOnly`, `SameSite=Lax`, `Secure` in production).
8. The JSON `{ user }` returns; `AuthContext` stores it in state; the nav bar re-renders because it reads `useAuth()`.
9. On every later request the browser sends the cookie → **`middleware/auth.ts`** `loadUser` hashes it, looks it up, and sets `req.user`. **This replaces v1's single global `mySession` variable.**

### B. Applying to an internship

1. **`pages/ListingDetail.tsx`** loads the listing with `useApiData`, shows **`components/ApplicationForm.tsx`** to students only.
2. The form validates the file in the browser (PDF, ≤ 5 MB), builds a `FormData`, and calls `api.post(.../apply, formData)`.
3. **`routes/listings.ts`** `POST /:id/apply` passes through `requireRole("student")` (401 if anonymous, 403 for companies), then **`lib/uploads.ts`** (multer): saves the file under a random UUID name, PDF only, 5 MB max.
4. The handler checks the file's first bytes are `%PDF-`, checks the listing exists and its deadline hasn't passed, then inserts into `applications`. The `UNIQUE (student_id, listing_id)` constraint turns a double-apply into a clean `409`.
5. If anything fails after the upload, the saved file is deleted (no orphans). v1 did apply and upload as **two** requests, so a failed upload left a ghost application.

### C. Searching

1. **`components/SearchBar.tsx`** keeps the typed text in local state and passes it through **`hooks/useDebounce.ts`**: nothing is sent until the user pauses for 300 ms.
2. **`pages/Listings.tsx`** writes the term into the URL (`?q=pyth`). **`hooks/useListings.ts`** builds `/api/listings?q=pyth&page=1&pageSize=9` and calls **`hooks/useApiData.ts`**, which aborts any older in-flight request (no race conditions).
3. **`routes/listings.ts`** `GET /`: parses the query with `listingQuerySchema`, builds a PostgreSQL prefix full-text query (`pyth:*`), also matches company name and skills, filters, sorts newest-first, and paginates **in SQL**, with a separate `count(*)`. Values are always `$1…$n` parameters.
4. The response includes an `ETag`; the next identical request can be answered with `304 Not Modified` and no body.
5. **`components/ListingList.tsx`** shows exactly one of: skeletons (loading), error + retry, empty state, or the cards (each keyed by listing id).

---

## 5. File map

Arrows mean "imports / depends on".

### Root

| File                                   | Purpose                                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `package.json`                         | declares the **workspaces** and the root scripts (`dev`, `test`, `build`, …)                       |
| `.env.example` → `.env`                | configuration (copied by `npm run setup`; `.env` is git-ignored)                                   |
| `scripts/db.mjs`                       | starts the embedded PostgreSQL, creates `internly` and `internly_test` databases, handles shutdown |
| `scripts/setup.mjs`                    | copies `.env.example` to `.env`                                                                    |
| `scripts/db-reset.mjs`                 | drops all tables in the local DB (refuses non-local URLs)                                          |
| `tsconfig.base.json`                   | strict TypeScript settings every package extends                                                   |
| `eslint.config.js`, `.prettierrc.json` | lint + formatting rules                                                                            |
| `.github/workflows/ci.yml`             | CI: typecheck, lint, tests (real Postgres), build on every push                                    |
| `render.yaml`                          | one-file deploy description for Render (free tier)                                                 |
| `legacy/`                              | the original v1 app, untouched (tag `v1-legacy`), kept for before/after comparison                 |
| `docs/`                                | this guide + the scope doc                                                                         |

### `packages/shared`: the contract

| File           | Purpose                                                                                                                                                                                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts` | zod schemas (`loginSchema`, `studentSignupSchema`, `listingInputSchema`, `listingQuerySchema`, `aiMatchRequestSchema` …), enums (`Role`, `WorkType`, `ApplicationStatus`), response types (`Listing`, `Page<T>`, `StudentApplication` …) and the AI stream event type `AiMatchEvent`. **Imported by both apps.** |

### `apps/api`: the backend

| File                               | Purpose                                                                                                                   | Connects to                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `src/server.ts`                    | entry point: wait for DB → create tables → seed if empty → listen; graceful shutdown                                      | `migrate.ts`, `seed.ts`, `app.ts`, `db.ts`     |
| `src/app.ts`                       | builds the Express app; **the middleware pipeline lives here**; mounts routers; serves the built UI in production         | all middleware + routes                        |
| `src/config.ts`                    | reads and validates environment variables with zod (fails fast on bad config)                                             | used by almost everything                      |
| `src/db.ts`                        | the `pg` connection **pool**, `query()` and `withTransaction()` helpers                                                   | every route                                    |
| `src/migrate.ts` + `db/schema.sql` | `schema.sql` defines all tables/indexes (idempotent); `migrate()` runs it; `waitForDb()` retries until Postgres is up     | `server.ts`                                    |
| `src/seed.ts`                      | demo companies, 20 listings, a demo student and applications; optional `--bulk N`                                         | `server.ts`, `npm run db:seed`                 |
| `src/logger.ts`                    | structured logging (pino); pretty in dev, JSON in production                                                              | `app.ts`, routes                               |
| `src/errors.ts`                    | `AppError` + helpers (`notFound()`, `forbidden()` …) that handlers `throw`                                                | handlers → `errorHandler`                      |
| `src/middleware/requestId.ts`      | tags every request with an id (reuses the browser's `X-Request-Id`)                                                       | `app.ts`                                       |
| `src/middleware/auth.ts`           | `loadUser` (cookie → `req.user`), `requireAuth` (401), `requireRole` (403)                                                | `lib/sessions.ts`, routes                      |
| `src/middleware/originCheck.ts`    | CSRF defence: rejects state-changing requests from foreign origins                                                        | `app.ts`, `config.ts`                          |
| `src/middleware/errorHandler.ts`   | the single place that converts any error (zod, AppError, multer, bad JSON, unknown) into JSON                             | `app.ts` (registered last)                     |
| `src/lib/sessions.ts`              | create / find / end sessions; cookie options; stores only SHA-256 of the token                                            | `middleware/auth.ts`, `routes/auth.ts`         |
| `src/lib/passwords.ts`             | bcrypt hash/verify + dummy hash for timing safety                                                                         | `routes/auth.ts`, `routes/account.ts`          |
| `src/lib/uploads.ts`               | multer config, PDF magic-byte check, safe file paths, cleanup                                                             | `routes/listings.ts`, `routes/applications.ts` |
| `src/lib/mappers.ts`               | snake_case DB rows → camelCase API objects; shared `LISTING_SELECT`                                                       | listings/applications/ai routes                |
| `src/routes/auth.ts`               | signup (student/company), login (rate limited), logout, `/me`                                                             | `lib/*`, shared schemas                        |
| `src/routes/listings.ts`           | public search/detail; company create/edit/delete (ownership checked); student **apply**                                   | `lib/uploads.ts`, `lib/mappers.ts`             |
| `src/routes/applications.ts`       | student "mine"; company "received" + status change; withdraw; **authorised resume download**                              | `lib/uploads.ts`                               |
| `src/routes/account.ts`            | change name/password (verifies current password), delete account                                                          | `lib/passwords.ts`                             |
| `src/routes/ai.ts`                 | the streaming CV matcher endpoint (Server-Sent Events)                                                                    | `ai/matcher.ts`, `ai/providers.ts`             |
| `src/ai/matcher.ts`                | **deterministic** scoring: skill overlap + title words → score 0-100, matched/missing skills                              | `routes/ai.ts`                                 |
| `src/ai/providers.ts`              | `ReasonProvider` interface: offline template writer, real-model writer, and `getProvider()`                               | `routes/ai.ts`                                 |
| `src/types.d.ts`                   | tells TypeScript that `req.user` exists                                                                                   | middleware                                     |
| `test/*.test.ts`                   | 38 API tests (see [section 10](#10-testing-linting-and-ci)); `helpers.ts` makes fake "browsers" with separate cookie jars | the real app + a real test DB                  |
| `uploads/`                         | stored resumes (git-ignored, never served statically)                                                                     | `lib/uploads.ts`                               |

### `apps/web`: the frontend

| File                                                                                   | Purpose                                                                                                                      | Connects to                         |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `index.html` → `src/main.tsx`                                                          | HTML shell; mounts React, wraps the app in `BrowserRouter` + `AuthProvider`                                                  | `App.tsx`                           |
| `src/App.tsx`                                                                          | the **route table**; `ProtectedRoute` groups for students/companies; `React.lazy` code-splitting                             | all pages                           |
| `src/context/AuthContext.tsx`                                                          | `AuthProvider` + `useAuth()`: current user, login/signup/logout; asks `/api/auth/me` on load                                 | `lib/api.ts`                        |
| `src/lib/api.ts`                                                                       | the **typed fetch client**: `request<T>()`, `ApiError`, JSON/FormData, request id, retry with exponential backoff (GET only) | everything that talks to the server |
| `src/lib/aiStream.ts`                                                                  | POST + read the Server-Sent-Event stream with a stream reader                                                                | `pages/student/AiMatch.tsx`         |
| `src/lib/format.ts`, `src/lib/debounce.ts`                                             | label/date helpers; a from-scratch `debounce()` (closure)                                                                    | components                          |
| `src/hooks/useApiData.ts`                                                              | generic "GET + loading/error/data + abort on change" hook                                                                    | most pages                          |
| `src/hooks/useListings.ts`                                                             | builds the listings URL from filters, uses `useApiData`                                                                      | `pages/Listings.tsx`                |
| `src/hooks/useDebounce.ts`                                                             | value debouncing with timer cleanup                                                                                          | `SearchBar.tsx`                     |
| `src/hooks/usePageTitle.ts`                                                            | sets the browser tab title per page                                                                                          | pages                               |
| `src/components/Layout.tsx`                                                            | nav bar (role-aware, mobile menu), skip link, footer, error boundary around pages                                            | `App.tsx`                           |
| `src/components/ProtectedRoute.tsx`                                                    | redirects anonymous users to `/login`, blocks the wrong role                                                                 | `App.tsx`, `AuthContext`            |
| `src/components/ListingCard.tsx`, `ListingList.tsx`, `SearchBar.tsx`, `Pagination.tsx` | the listing browsing UI                                                                                                      | `pages/Listings.tsx`                |
| `src/components/ApplicationForm.tsx`                                                   | file + note form, validation, focus management                                                                               | `pages/ListingDetail.tsx`           |
| `src/components/FormField.tsx`                                                         | accessible label/error/hint wrappers for inputs                                                                              | all forms                           |
| `src/components/States.tsx`                                                            | `Spinner`, `EmptyState`, `ErrorMessage`, `SkeletonGrid`                                                                      | everywhere                          |
| `src/components/ErrorBoundary.tsx`                                                     | catches render crashes, shows a fallback                                                                                     | `Layout.tsx`                        |
| `src/components/StatusBadge.tsx`                                                       | status chip; the `Record<ApplicationStatus, …>` type forces handling every status                                            | applications pages                  |
| `src/components/TestimonialSlider.tsx`, `LogoWall.tsx`                                 | marketing sections (sample content); the slider is the classic `useEffect` + cleanup example                                 | `pages/Home.tsx`                    |
| `src/pages/*`                                                                          | `Home`, `Listings`, `ListingDetail`, `Login`, `Signup`, `Account`, `NotFound`                                                |                                     |
| `src/pages/student/*`                                                                  | `MyApplications`, `AiMatch`                                                                                                  |                                     |
| `src/pages/company/*`                                                                  | `MyListings`, `ListingEditor` (create + edit), `Applicants`                                                                  |                                     |
| `src/index.css`                                                                        | Tailwind import, design tokens (colors), `.btn`/`.input`/`.card` classes                                                     |                                     |
| `vite.config.ts`                                                                       | dev proxy, build chunking, test environment                                                                                  |                                     |
| `src/test/*`                                                                           | 17 tests (debounce, API client retry, XSS-safe rendering, route guards, search bar)                                          |                                     |

### Who depends on whom (simplified)

```
pages → components → hooks → lib/api.ts ──HTTP──► routes → middleware → lib → db.ts → PostgreSQL
  │                                                  │
  └──────────── packages/shared (types + zod) ───────┘
```

---

## 6. The database

```
users ─┬─< student_profiles   (1:1, only for students)
       ├─< company_profiles   (1:1, only for companies)
       ├─< sessions           (a user can be logged in on many devices)
       ├─< listings           (a COMPANY user owns many listings)
       └─< applications       (a STUDENT user makes many applications)
listings ─< applications      (a listing receives many applications)
```

| Table                                   | Key columns                                                                                          | Notes                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `users`                                 | `id`, `role` (`student`/`company`), `email`, `password_hash`, `name`                                 | unique index on `lower(email)`. One table for both roles keeps login simple    |
| `student_profiles` / `company_profiles` | `user_id` → users                                                                                    | role-specific details (university, industry …)                                 |
| `listings`                              | `company_id` → users, `title`, `description`, `location`, `work_type`, `skills TEXT[]`, `deadline` … | `search` is a **generated tsvector** column for full-text search               |
| `applications`                          | `student_id`, `listing_id`, `status`, `resume_file`                                                  | **`UNIQUE (student_id, listing_id)`**: one application per student per listing |
| `sessions`                              | `id` = SHA-256 of the cookie token, `user_id`, `expires_at`                                          |                                                                                |

**Constraints do the policing:** `CHECK` constraints limit `role`, `work_type`, `status`; foreign keys use `ON DELETE CASCADE`, so deleting a listing removes its applications and deleting a user removes everything they own.

**Indexes (each one answers a real query):** `listings(company_id)` company dashboards; `listings(work_type)`, `listings(lower(location))` filters; `listings(created_at DESC, id DESC)` newest-first paging; `GIN(search)` full-text; `applications(listing_id)` and `(student_id, created_at DESC)` the two dashboards; `sessions(user_id)`, `sessions(expires_at)` cleanup.

---

## 7. Security: v1 problem → v2 fix → proof

Every row has an automated test (in `apps/api/test/`) that fails if the fix is removed.

| #   | v1 problem                                                                                                 | v2 fix                                                                                                                 | Where                                          | Proof (test)                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | **One global session for the whole server** (`session.js`): whoever logged in last became everybody's user | Per-user random session token in an `httpOnly` cookie; DB stores only its hash                                         | `lib/sessions.ts`, `middleware/auth.ts`        | "keeps two logged-in users completely separate"                              |
| 2   | Any `.js` file downloadable (`/db.js` leaked the DB password); path traversal                              | No static file serving of server code; env-based config; only `apps/web/dist` is served                                | `app.ts`, `config.ts`                          | structure (no route exists)                                                  |
| 3   | Anyone could **edit or delete any listing** with no login                                                  | Auth + role + **ownership** checks                                                                                     | `routes/listings.ts` (`ownedListingOrThrow`)   | "anonymous visitors can NOT…", "company B can NOT edit… company A's listing" |
| 4   | Resumes publicly downloadable at `/uploads/…`, guessable names                                             | Random file names, no static route, authorised download (only applicant + owning company)                              | `lib/uploads.ts`, `routes/applications.ts`     | "only the applicant and the owning company can read a resume"                |
| 5   | **Stored XSS**: user text injected with `innerHTML`                                                        | React escapes by default; no `dangerouslySetInnerHTML` anywhere; links to user-supplied URLs only render for `http(s)` | all components, `pages/company/Applicants.tsx` | web test: "shows HTML in a description as plain text"                        |
| 6   | Password change saved **plain text** (and locked the user out)                                             | Verify current password; bcrypt hash; other sessions logged out                                                        | `routes/account.ts`                            | "changing the password needs the current one…"                               |
| 7   | No input validation (crashes on missing fields)                                                            | zod schemas on every endpoint, field-level errors                                                                      | `packages/shared`, `errorHandler.ts`           | "returns field-level validation errors"                                      |
| 8   | No CSRF protection; `GET /logout`                                                                          | `SameSite=Lax` cookie + Origin check; logout is `POST`                                                                 | `middleware/originCheck.ts`                    | "rejects… another website's origin"                                          |
| 9   | Duplicate applications; apply + upload were two requests                                                   | `UNIQUE` constraint; one multipart request; cleanup on failure                                                         | `schema.sql`, `routes/listings.ts`             | "blocks duplicates"                                                          |
| 10  | Resume uploads trusted whatever the browser said                                                           | PDF only, 5 MB, magic-byte check                                                                                       | `lib/uploads.ts`                               | "rejects non-PDF uploads" (incl. a fake `.pdf`)                              |
| 11  | SQL built from user input in places; client-side filtering of **all** rows                                 | Parameterised queries everywhere; filtering/paging in SQL                                                              | `routes/*`                                     | "is immune to SQL injection in the search box"                               |
| 12  | No brute-force protection; "wrong email" vs "wrong password" distinguishable                               | Rate limit on login; same error + same timing                                                                          | `routes/auth.ts`                               | "same message as an unknown email"                                           |
| 13  | Hardcoded `root/1234` DB credentials                                                                       | `.env` (git-ignored), validated at startup                                                                             | `config.ts`, `.env.example`                    | n/a                                                                          |
| 14  | Error pages leaked internals / inconsistent formats                                                        | One error handler, uniform JSON, internals only in server logs with a request id                                       | `errorHandler.ts`                              | "does not leak HTML or stack traces"                                         |

Also: `helmet` security headers, 100 KB JSON body limit, `x-powered-by` removed, global API rate limit, account deletion requires the password.

---

## 8. Frontend deep dive

**State: where does each kind of state live?**

| Kind                                 | Where                                  | Why                                                            |
| ------------------------------------ | -------------------------------------- | -------------------------------------------------------------- |
| Who is logged in                     | React **Context** (`AuthContext`)      | needed by many distant components, changes rarely              |
| Server data (listings, applications) | `useApiData` hook, per page            | it's a cache of the server, scoped to the screen that needs it |
| Search / filters / page number       | the **URL** (`useSearchParams`)        | back button works, shareable links, single source of truth     |
| Form fields                          | local `useState` ("controlled inputs") | only that form cares                                           |
| AI stream                            | `useReducer` in `AiMatch.tsx`          | many small events → one pure reducer                           |

**Why not Redux?** Nothing here needs it: no big shared client-side state, no cross-page caching. Redux Toolkit (or TanStack Query/RTK Query for server data) would be worth adding when many screens share the same data or you need undo/time-travel/devtools. Being able to say _why not_ is the point.

**Rendering and performance**

- **Code splitting:** `React.lazy` per page; first load downloads ~83 kB (22 kB gzip) of app code + a separate cached ~259 kB (82 kB gzip) React chunk. Pages are 0.4-6 kB each.
- **`memo(ListingCard)`** avoids re-rendering every card while typing in the search box. `useMemo` is used once (the auth context value). Nothing else is memoized "just in case"; measure first.
- **Keys:** list items use the database `id`, never the array index.
- **Debounce** + **AbortController**: typing fires one request, and a slow old response can never overwrite a newer one.
- **Images:** `loading="lazy"` with explicit width/height (no layout shift).
- **Animation:** the slider cross-fade only changes `opacity` (GPU-composited, no reflow) and respects `prefers-reduced-motion`.

**Resilience:** `ErrorBoundary` around every page; every list handles _loading → error (with retry) → empty → data_; GET requests auto-retry network failures with exponential backoff (300 ms, 900 ms); POST/PUT/DELETE never auto-retry (could double-submit); status changes use **optimistic updates** with rollback.

**Accessibility:** semantic HTML (`header`, `nav`, `main`, `article`, `dl`, `fieldset/legend`); every input has a real `<label>`; errors use `role="alert"` and `aria-invalid`/`aria-describedby`; result counts use `aria-live="polite"`; skip-to-content link; visible focus ring; keyboard-operable carousel dots; mobile menu uses `aria-expanded`; focus moves to the first problem when a form fails.

**CSS:** Tailwind utilities for speed; **Flexbox** for the nav and rows, **CSS Grid** for card grids and the logo wall; responsive via `sm:`/`md:`/`lg:` breakpoints (mobile-first); design tokens (navy / sky / brand) defined once in `index.css`.

**TypeScript patterns worth knowing:** generic `request<T>()`; `z.infer` types from schemas; discriminated union `AiMatchEvent` (switch on `type`); `Record<ApplicationStatus, …>` for exhaustive handling; `strict: true` everywhere.

---

## 9. The AI CV matcher

**User flow:** paste CV → _Find my matches_ → ranked cards appear one by one, each with a score, ✓/✗ skills, and an explanation that **types itself in**; a **Stop** button cancels mid-stream.

**Design: retrieval first, language second.**

1. **Score deterministically** (`ai/matcher.ts`): for every open listing, `score = 85 × (matched skills ÷ required skills) + 15 × (title words found in CV)`. Whole-word matching (`java` ≠ `javascript`; `C++` and `Node.js` work). The top 5 with score > 0 are kept. _This is the part users must be able to trust, so it contains no AI._
2. **Explain with a model** (`ai/providers.ts`): for each match, a model writes a 2-sentence reason **using only the facts it's handed** (matched/missing skills, score). This is the same pattern as RAG: retrieve with reliable code, then let the language model write about retrieved facts instead of inventing them.
3. **Stream** (`routes/ai.ts`): Server-Sent Events: `start → (match → reason_delta* → reason_done)* → done`. The browser reads them with `fetch` + a stream reader (`lib/aiStream.ts`) because `EventSource` can't POST.

**Reliability mechanisms**

| Risk                                                                      | Mitigation                                                                                                                                                                                                                                     | Where                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Model slow/down/erroring                                                  | 25 s timeout per explanation, then a **template fallback** sentence; UI shows a "generated from your matched skills" notice                                                                                                                    | `routes/ai.ts`                |
| No API key                                                                | offline provider streams the template text; the feature always works                                                                                                                                                                           | `providers.ts`                |
| User clicks Stop / closes the tab                                         | `AbortController` on the client → server detects `res.on("close")` → aborts the model call                                                                                                                                                     | `AiMatch.tsx`, `routes/ai.ts` |
| **Prompt injection** inside a pasted CV ("ignore previous instructions…") | CV is wrapped in `<cv>` tags and declared untrusted in the system prompt; the CV cannot close its own tag; the model only writes text (it has no tools); output is rendered as plain text by React; and the _score_ never depends on the model | `providers.ts`, `AiMatch.tsx` |
| Cost abuse                                                                | login required, student-only, 6 requests/min limit, 8,000-character CV cap                                                                                                                                                                     | `routes/ai.ts`, shared schema |
| Debuggability                                                             | each step logged with the request id: provider, listings scanned, per-listing source (`ai` / `template`) and latency                                                                                                                           | `routes/ai.ts`                |

**Turning on a real model:** put a key in `.env` (`AI_API_KEY=…`; model name in `AI_MODEL`) and restart. The provider uses the official Anthropic TypeScript SDK with streaming. **It type-checks, but I could not run it against the live API (no key in this environment).** The offline provider is what is tested. Try it with a real key and tell me if anything needs adjusting.

**Agent vs single call (interview note):** this feature is a _workflow_: the code decides every step and the model only fills in text. An _agent_ lets the model choose which tools to call in a loop (search listings, read a listing, check status). It's more flexible and less predictable, so it needs structured outputs, tool-input validation, timeouts, step limits and per-tool logging. That is the natural next step; this app deliberately stops at the safer workflow, which is also the more defensible production choice for a feature users must trust.

---

## 10. Testing, linting and CI

| Layer                | Tool                                                               | Count | What it proves                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API (integration)    | Vitest + Supertest against a **real PostgreSQL** (`internly_test`) | 38    | sessions are per-user, every authorisation rule, SQL-injection safety, pagination/search/filters, ETag/304, upload validation, duplicate prevention, CSRF, validation errors, matcher logic, SSE stream shape |
| Web (unit/component) | Vitest + Testing Library + jsdom                                   | 17    | debounce, API-client retry/error mapping, XSS-safe rendering, route guards, search bar, empty/error states                                                                                                    |
| Static               | TypeScript `strict`, ESLint (+ react-hooks rules), Prettier        | n/a   | catches bugs before runtime                                                                                                                                                                                   |
| CI                   | GitHub Actions (`.github/workflows/ci.yml`)                        | n/a   | runs install → typecheck → lint → tests (with a Postgres service) → build on every push/PR                                                                                                                    |

Why integration tests at the API: the risky logic (who may touch what) lives in the combination of middleware + SQL, which mocks would hide. Why not end-to-end tests (Playwright): not included (see [section 13](#13-honest-limitations)).

---

## 11. Configuration reference

All in `.env` (template: `.env.example`). Validated at startup by `apps/api/src/config.ts`.

| Variable            | Default (dev)                                           | Meaning                                                                        |
| ------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `NODE_ENV`          | `development`                                           | `production` turns on secure cookies, JSON logs, proxy trust                   |
| `PORT`              | `8080`                                                  | API port                                                                       |
| `DATABASE_URL`      | `postgres://postgres:postgres@localhost:54329/internly` | PostgreSQL connection string                                                   |
| `CLIENT_ORIGIN`     | `http://localhost:5173`                                 | origin(s) allowed to send cookie requests (CORS + CSRF check); comma-separated |
| `SEED_ON_EMPTY`     | `true`                                                  | load demo data when the users table is empty                                   |
| `AI_API_KEY`        | _(empty)_                                               | empty → offline explanations; set → model-written explanations                 |
| `AI_MODEL`          | `claude-opus-5-5`                                       | model used when a key is set (change it to a cheaper model if you like)        |
| `TEST_DATABASE_URL` | local `internly_test`                                   | used only by `npm test`; CI sets it                                            |

---

## 12. Deploying for free

Goal: one public URL. The API serves the built React app itself, so there is **one service + one database**, no CORS setup.

> **Not done or verified in this environment.** The config below is standard, but I could not deploy from here. Treat the first deploy as something to check.

1. **Database:** create a free PostgreSQL (for example on **Neon**) and copy its connection string (it ends with `?sslmode=require`).
2. **Code:** push this repo to GitHub.
3. **Web service:** on **Render**, _New → Blueprint_, pick the repo (it reads `render.yaml`). In the dashboard set `DATABASE_URL` to the Neon string. Optionally set `AI_API_KEY`.
4. Render builds (`npm ci --include=dev && npm run build`), starts (`npm start`), and checks `/health`. The first visit after idle takes ~30 s (free tier sleeps).
5. `SEED_ON_EMPTY=true` loads the demo accounts on first boot. **Those accounts have a public password**, so remove the variable (and delete the demo users) if you care.

Production notes: resumes are stored on the server's disk, which is **wiped on every deploy/restart on free hosts**. For real use, move uploads to object storage (S3-compatible); the code is isolated in `lib/uploads.ts` for exactly that change.

---

## 13. Honest limitations

Know these so you're never caught out in an interview:

- **No Redux/RTK**: deliberate (see section 8). Can discuss; not built.
- **No Playwright/E2E test**, no Husky pre-commit hook, no Webpack (Vite 8 with its Rolldown bundler is the modern equivalent; code splitting and manual chunks are configured).
- **No email notifications / external-service integration** beyond the optional LLM call.
- **No list virtualisation**: pagination keeps pages small, so it isn't needed.
- **AI agent with tools: not built** (single-feature workflow only). **Live LLM call is untested** (offline path is tested).
- **Not deployed** from this environment (config provided).
- **No Lighthouse/bundle measurement was recorded** beyond the build output above; do your own run before quoting numbers (`npm run build`, `npm start`, Chrome DevTools → Lighthouse at http://localhost:8080).
- **Sessions are looked up in the DB on every request**: fine at this scale; at larger scale you'd add a cache (Redis).
- Login rate limit and AI rate limit are **per IP, in memory**, so they reset on restart and don't coordinate across multiple servers.
- Uploaded resumes are not virus-scanned.
- Demo/sample content (testimonials, logo wall, companies) is fictional/placeholder and labelled as such.

---

## 14. Concept cheat sheet (interview map)

Use this to jump to the code behind any concept.

| Interview topic                           | Where to point                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Closures                                  | `lib/debounce.ts` (`timer` survives between calls)                                                                |
| Event loop / async-await / Promises       | `lib/api.ts` (`await`, retry loop with `sleep`), `AuthContext` effect, `routes/*` async handlers                  |
| `this` / scope / hoisting                 | arrow-function handlers throughout; `lib/debounce.ts`                                                             |
| DOM events, bubbling, delegation          | handled declaratively by React; `Layout.tsx` nav, `Pagination.tsx` buttons                                        |
| `preventDefault` on forms                 | every `handleSubmit` (e.g. `ApplicationForm.tsx`, `Login.tsx`)                                                    |
| XSS                                       | React escaping; `components.test.tsx` XSS test; `Applicants.tsx` URL-scheme check                                 |
| CSRF, cookies vs localStorage             | `lib/sessions.ts` (`httpOnly`, `SameSite`), `middleware/originCheck.ts`                                           |
| CORS                                      | `app.ts` (`cors`), `vite.config.ts` proxy (why dev avoids it)                                                     |
| REST design, status codes                 | `routes/*` (201 create, 204 delete, 400 validation, 401 anon, 403 role/owner, 404, 409 duplicate, 429 rate limit) |
| HTTP caching                              | `routes/listings.ts` (`no-cache` + ETag → 304), `listings.test.ts`                                                |
| Pagination & indexes                      | `routes/listings.ts`, `db/schema.sql`                                                                             |
| Validation                                | `packages/shared` + `errorHandler.ts`                                                                             |
| Middleware pattern                        | `app.ts` pipeline, `middleware/*`                                                                                 |
| Auth vs authorisation                     | `requireAuth` (401) vs `requireRole`/`ownedListingOrThrow` (403)                                                  |
| React components/props/state              | `components/*`, `pages/*`                                                                                         |
| `useEffect` + cleanup                     | `TestimonialSlider.tsx` (interval), `useDebounce.ts` (timer), `useApiData.ts` (abort)                             |
| Custom hooks                              | `useApiData`, `useListings`, `useDebounce`, `useAuth`, `usePageTitle`                                             |
| Controlled forms, `useRef`                | `Signup.tsx`, `ListingEditor.tsx`; `ApplicationForm.tsx` (file input ref, focus)                                  |
| Lifting state / Context                   | `AuthContext.tsx`                                                                                                 |
| `useReducer`                              | `pages/student/AiMatch.tsx`                                                                                       |
| Keys & reconciliation, `memo`             | `ListingList.tsx` (`key={l.id}`), `ListingCard.tsx` (`memo`)                                                      |
| Routing & protected routes                | `App.tsx`, `ProtectedRoute.tsx`                                                                                   |
| Code splitting / lazy loading             | `App.tsx` (`React.lazy`), `vite.config.ts` chunks                                                                 |
| Error boundary                            | `ErrorBoundary.tsx`                                                                                               |
| TypeScript generics, unions, `strict`     | `lib/api.ts`, `AiMatchEvent`, `StatusBadge.tsx`, `tsconfig.base.json`                                             |
| Monorepo / shared types                   | root `package.json` workspaces, `packages/shared`                                                                 |
| Build tooling                             | `vite.config.ts` (dev server, proxy, chunking), `npm run build`                                                   |
| Testing pyramid                           | many fast unit/component tests (web), integration tests where risk is (API), CI                                   |
| Streaming / SSE / cancellation            | `routes/ai.ts`, `lib/aiStream.ts`, `AiMatch.tsx`                                                                  |
| AI reliability & prompt-injection defence | [section 9](#9-the-ai-cv-matcher)                                                                                 |
| Logging / tracing                         | `requestId.ts`, `logger.ts`, `X-Request-Id` set in `lib/api.ts`                                                   |
| Health checks / graceful shutdown         | `app.ts` (`/health`), `server.ts`                                                                                 |

**Using AI tooling honestly in an interview.** AI-assisted development is normal; say so plainly: AI wrote a lot of the first draft; _you_ are responsible for understanding, testing and owning it. Strong things to say: you reviewed every security-sensitive path and can explain it (use section 7), you verified behaviour with tests that fail if a fix is removed, and you caught/fixed problems yourself (examples that happened while building this: a Windows BOM broke JSON parsing, Tailwind v4 rejects `@apply` on custom classes, Vite 8's bundler needs a function-style `manualChunks`, Express 5 types route params as `string | string[]`). Don't claim you hand-wrote code you didn't, and be able to explain any line you're asked about. If you can't explain a file yet, read its section above before an interview.

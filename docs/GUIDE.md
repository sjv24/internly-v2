# Internly (vanilla stack): the guide

How the app works, how the files connect, and how to run it.

> **Contents:** [1 Run it](#1-run-it) · [2 What it does](#2-what-it-does) · [3 Architecture](#3-architecture) · [4 Request flows](#4-request-flows) · [5 File map](#5-file-map) · [6 Database](#6-database) · [7 Security](#7-security) · [8 Front-end concepts](#8-front-end-concepts-with-the-file-that-shows-each) · [9 Tests](#9-tests) · [10 Limitations](#10-honest-limitations)

---

## 1. Run it

**Needs:** Node.js 22+ (check with `node -v`). Nothing else.

```bash
npm install
npm run setup     # copies .env.example to .env (once)
npm run dev       # starts PostgreSQL + the app together
```

Open **http://localhost:3000**. Demo accounts (password `Password123!`):

| Role    | Email                  | Try                                                                         |
| ------- | ---------------------- | --------------------------------------------------------------------------- |
| Student | `student@internly.dev` | search, apply with a PDF, **AI CV Match**, track and withdraw applications  |
| Company | `company@internly.dev` | create/edit/delete listings, review applicants, accept/reject, open resumes |

| Command                          | What it does                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`                    | PostgreSQL (port **54330**) + the app on port **3000**, auto-restarting on changes |
| `npm run db`                     | only the database (needed before `npm test`)                                       |
| `npm start`                      | the app only, no auto-restart (database must already run)                          |
| `npm test`                       | all 49 tests                                                                       |
| `npm run db:reset`               | wipe the local database (next start recreates + reseeds it)                        |
| `npm run db:seed -- --bulk 2000` | add 2000 extra listings to see pagination/search at scale (on an empty database)   |

> **Windows PowerShell blocks `npm`?** Use `npm.cmd run dev`, or Git Bash/`cmd`.

| Problem                                      | Fix                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Port 3000 or 54330 already in use            | close the old window running it, or change `PORT` in `.env`                                       |
| "Waiting for the database…" forever          | look at the `[db]` lines; delete the hidden `.pgdata/` folder (everything stopped) to start fresh |
| `npm test`: "Cannot reach the test database" | start the database first (`npm run db`)                                                           |

---

## 2. What it does

- **Anyone:** browse and search listings (keyword, location, type, pages).
- **Students:** sign up, apply with a PDF resume + cover note, track status (pending/accepted/rejected), withdraw pending applications, AI CV match.
- **Companies:** sign up, create/edit/delete **their own** listings, see applicants, open resumes, accept or reject.

---

## 3. Architecture

```
┌──────────────── BROWSER ─────────────────┐
│ plain HTML pages + ES-module JavaScript  │
│ public/*.html  public/js/*.js  styles.css│      cookie "sid" (httpOnly)
└───────────────┬──────────────────────────┘
                │ HTTP + JSON  (fetch)
┌───────────────▼──────────── EXPRESS (server/) ─────────────────────┐
│ requestId → access log → helmet → json → cookies → rateLimit →      │
│ originCheck (CSRF) → loadUser (cookie → req.user)                   │
│ /api/auth  /api/listings  /api/applications  /api/account  /api/ai  │
│ each handler: validate (zod) → authorise → parameterised SQL        │
│ any error → ONE errorHandler → uniform JSON                         │
│ everything else → static files from public/                         │
└───────┬─────────────────────────┬──────────────────┬───────────────┘
        │ pg Pool                 │ files            │ optional HTTPS
┌───────▼────────┐   ┌────────────▼──────┐   ┌───────▼──────────────┐
│ PostgreSQL     │   │ uploads/ (resumes,│   │ LLM provider (writes │
│ users,listings │   │ random names, not │   │ explanations; app    │
│ applications,  │   │ served statically)│   │ works without it)    │
│ sessions       │   └───────────────────┘   └──────────────────────┘
└────────────────┘
```

One Node process serves **both** the website and the API, so there is a single origin: cookies just work, no CORS setup, no separate front-end server.

---

## 4. Request flows

### A. Logging in

1. **`public/login.html`** has the form. **`js/pages/login.js`** catches `submit`, calls `e.preventDefault()` (stops the browser's full-page form post) and does `api.post("/api/auth/login", …)`.
2. **`js/api.js`** sends `fetch` with JSON and an `X-Request-Id` header.
3. Express runs the middleware pipeline in **`server/app.js`**; `loadUser` finds no cookie yet.
4. **`server/routes/auth.js`** `POST /login`: rate limit (10 failed tries / 15 min) → zod validation → SQL `SELECT … WHERE lower(email) = lower($1)` → **`lib/passwords.js`** bcrypt compare (against a dummy hash if the email is unknown, so timing doesn't reveal which emails exist).
5. **`lib/sessions.js`** creates 32 random bytes, stores only their SHA-256 in the `sessions` table with an expiry, and sets the `sid` cookie (`HttpOnly`, `SameSite=Lax`).
6. The browser is redirected; on every later page **`js/layout.js`** → **`js/auth.js`** asks `GET /api/auth/me`, and **`middleware/auth.js`** looks the cookie up to set `req.user`. Two people logged in at once never collide.

### B. Showing a page (no framework)

1. The server sends a nearly empty HTML file (e.g. `listings.html`) with `<script type="module" src="/js/pages/listings.js">`.
2. The page script starts with `await initPage({ title, role })` (**`js/layout.js`**): it builds the shared header/footer, sets the tab title, and enforces who may see the page (redirects to `/login?next=…` if needed).
3. The script fetches JSON and builds elements with **`h()`** (**`js/dom.js`**), which inserts text with `createTextNode`, never `innerHTML`.

### C. Searching

`js/pages/listings.js`: typing → `debounce()` waits 300 ms → state is written into the URL (`?q=pyth&page=1`) with the History API → `fetch` (a previous in-flight request is aborted with `AbortController`) → **`server/routes/listings.js`** runs a prefix full-text query + filters + `LIMIT/OFFSET` **in SQL** and a separate `count(*)` → cards and pagination are rendered. The response carries an `ETag`, so an unchanged page is a tiny `304`.

### D. Applying

`js/pages/listing.js` builds the form, validates the file (PDF, ≤ 5 MB) in the browser, sends **one** multipart request. `routes/listings.js` → `lib/uploads.js` (multer: random file name, PDF only, 5 MB) → checks the file really starts with `%PDF-` → checks deadline → `INSERT`. A `UNIQUE(student_id, listing_id)` constraint turns a double-apply into a clean `409`. If anything fails, the uploaded file is deleted.

---

## 5. File map

### `server/` (Node + Express)

| File                              | Purpose                                                                                            | Connects to                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------- |
| `index.js`                        | entry point: wait for DB → create tables → seed if empty → listen; graceful shutdown               | `migrate.js`, `seed.js`, `app.js` |
| `app.js`                          | builds the Express app; **the middleware pipeline and route mounting live here**; serves `public/` | everything below                  |
| `config.js`                       | reads/validates `.env` with zod (fails fast on bad config)                                         | all                               |
| `db.js`                           | `pg` connection **pool**, `query()`, `withTransaction()`                                           | routes                            |
| `migrate.js` + `../db/schema.sql` | tables/indexes (idempotent); `waitForDb()` retries until Postgres is up                            | `index.js`                        |
| `seed.js`                         | demo companies, 20 listings, demo student + applications                                           | `index.js`                        |
| `logger.js`                       | tiny JSON logger (one line per event)                                                              | `app.js`, routes                  |
| `errors.js`                       | `AppError` + `notFound()`, `forbidden()`… that handlers `throw`                                    | handlers → `errorHandler`         |
| `validation.js`                   | zod schemas for every request body/query                                                           | routes                            |
| `middleware/requestId.js`         | tags each request with an id                                                                       | `app.js`                          |
| `middleware/auth.js`              | `loadUser` (cookie → user), `requireAuth` (401), `requireRole` (403)                               | `lib/sessions.js`                 |
| `middleware/originCheck.js`       | CSRF defence: refuses state-changing requests from other origins                                   | `config.js`                       |
| `middleware/errorHandler.js`      | the single place that turns any error into JSON                                                    | `app.js` (last)                   |
| `lib/sessions.js`                 | create/find/end sessions, cookie options, hashed tokens                                            | auth middleware/routes            |
| `lib/passwords.js`                | bcrypt hash/verify                                                                                 | auth/account routes               |
| `lib/uploads.js`                  | multer config, PDF signature check, safe paths, cleanup                                            | listings/applications routes      |
| `lib/mappers.js`                  | snake_case DB rows → camelCase API objects                                                         | routes                            |
| `routes/auth.js`                  | signup (student/company), login, logout, `/me`                                                     |                                   |
| `routes/listings.js`              | public search/detail; company CRUD (ownership checked); student apply                              |                                   |
| `routes/applications.js`          | student list/withdraw; company list + status; **authorised** resume download                       |                                   |
| `routes/account.js`               | change name/password, delete account                                                               |                                   |
| `routes/ai.js`                    | streaming CV matcher (Server-Sent Events)                                                          | `ai/*`                            |
| `ai/matcher.js`                   | **deterministic** scoring (skill overlap)                                                          | `routes/ai.js`                    |
| `ai/providers.js`                 | explanation writers: offline template or a real model, with fallback                               | `routes/ai.js`                    |

### `public/` (what the browser receives, unchanged)

| File                                                                                                     | Purpose                                                                                       |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `*.html` (`index`, `listings`, `listing`, `login`, `signup`, `account`, `404`, `student/*`, `company/*`) | semantic page skeletons with real `<label>`s; one `<script type="module">` each               |
| `css/styles.css`                                                                                         | the whole stylesheet: tokens, layout, components, responsive rules                            |
| `js/api.js`                                                                                              | `fetch` wrapper: JSON/FormData, `ApiError`, request id, GET retry with backoff                |
| `js/dom.js`                                                                                              | `h()` element builder (XSS-safe), `$`, state helpers (spinner/empty/error), `showFieldErrors` |
| `js/layout.js`                                                                                           | `initPage()`: header/footer, tab title, role guard                                            |
| `js/auth.js`                                                                                             | cached `getUser()`, `logout()`, `safeNext()` (open-redirect protection)                       |
| `js/components.js`                                                                                       | `listingCard`, `pagination`, `statusBadge`, `selectField`                                     |
| `js/debounce.js`, `js/format.js`, `js/slider.js`, `js/ai-stream.js`                                      | debounce closure; formatting; testimonial carousel; SSE reader                                |
| `js/pages/*.js`                                                                                          | one module per page, containing that page's logic                                             |

---

## 6. Database

```
users ─┬─< student_profiles   (1:1)        listings ─< applications
       ├─< company_profiles   (1:1)
       ├─< sessions
       ├─< listings           (a company owns many)
       └─< applications       (a student makes many)
```

- **`users`**: both roles in one table (`role` column), so login is one query. `UNIQUE` index on `lower(email)`.
- **`listings`**: `skills TEXT[]`, a **generated `tsvector` column + GIN index** for full-text search, `CHECK` constraints on `work_type` and `openings`.
- **`applications`**: `UNIQUE (student_id, listing_id)`; `status` limited by `CHECK`.
- **`sessions`**: `id` is the SHA-256 of the cookie token.
- `ON DELETE CASCADE` everywhere appropriate (deleting a listing removes its applications).
- **Indexes** each answer a real query: `listings(company_id)`, `(work_type)`, `(lower(location))`, `(created_at DESC, id DESC)`, GIN(`search`), `applications(listing_id)`, `(student_id, created_at DESC)`, `sessions(user_id)`, `(expires_at)`.

---

## 7. Security

| Threat                    | Defence                                                                                                                                    | Where                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Stolen/forged login       | random 256-bit token in an `httpOnly` `SameSite` cookie; only its hash stored                                                              | `lib/sessions.js`                          |
| Password leaks            | bcrypt (slow, salted); same error + timing for wrong email vs wrong password                                                               | `lib/passwords.js`, `routes/auth.js`       |
| Brute force               | login rate limit; global API limit                                                                                                         | `routes/auth.js`, `app.js`                 |
| SQL injection             | parameterised queries only (`$1…$n`)                                                                                                       | all routes                                 |
| XSS                       | text inserted via `createTextNode`, never `innerHTML`; user URLs only rendered for `http(s)`; CSP header from helmet blocks inline scripts | `public/js/dom.js`, `app.js`               |
| CSRF                      | `SameSite=Lax` + Origin check; logout is `POST`                                                                                            | `middleware/originCheck.js`                |
| Acting on others' data    | role check + **ownership check** on every write; a company id comes from the session, never the request body                               | `routes/*`                                 |
| Resume exposure           | random file names, not served statically, authorised download (only the applicant and the owning company)                                  | `lib/uploads.js`, `routes/applications.js` |
| Malicious uploads         | PDF only, 5 MB, content signature verified                                                                                                 | `lib/uploads.js`                           |
| Bad input                 | zod validation with per-field errors                                                                                                       | `validation.js`                            |
| Open redirect after login | `next` accepted only if it is a same-site path                                                                                             | `public/js/auth.js`                        |
| Leaked source/config      | only `public/` is served; secrets in `.env` (git-ignored)                                                                                  | `app.js`, `config.js`                      |
| Error leaks               | one handler; internals only in server logs with a request id                                                                               | `middleware/errorHandler.js`               |

---

## 8. Front-end concepts, with the file that shows each

| Concept                                                                                                                                           | File                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Semantic HTML5**: `header/nav/main/footer/article/fieldset/legend/dl`, skip link, `lang`, viewport                                              | `public/*.html`, `layout.js`                 |
| **Accessible forms**: `<label for>`, `aria-invalid`, `aria-describedby`, `role="alert"`, focus moves to the first error                           | `signup.html`, `dom.js` (`showFieldErrors`)  |
| **Right input types** (`email`, `password`, `url`, `number`, `date`, `search`, `file`)                                                            | `signup.html`, `listing-edit.html`           |
| **Box model** (`box-sizing: border-box`), **specificity**, custom properties                                                                      | `css/styles.css` §1-2                        |
| **Flexbox** (nav, rows, sticky footer) and **Grid** (card grid with `auto-fill/minmax`, forms, logo wall)                                         | `css/styles.css` §3, §9, §11                 |
| **Responsive** (mobile-first media queries, fluid `clamp()` type)                                                                                 | `css/styles.css` §13, `.hero h1`             |
| **Transitions on `transform`/`opacity`** (cheap: no layout/reflow)                                                                                | `.listing-card`, `.slide`, `.meter__fill`    |
| `prefers-reduced-motion` respected                                                                                                                | `css/styles.css`, `slider.js`                |
| **Closures** (debounce keeps `timer` alive)                                                                                                       | `js/debounce.js`                             |
| **Scope / hoisting / `this`**: arrow functions, module scope, `const`/`let`                                                                       | all modules                                  |
| **Event loop, Promises, async/await** (`await initPage()`, retry loop with `sleep`)                                                               | `api.js`, `layout.js`                        |
| **DOM manipulation** (create/append/replaceChildren)                                                                                              | `dom.js`, `components.js`                    |
| **Event handling**: `addEventListener`, `preventDefault` on forms, custom controls                                                                | every `pages/*.js`                           |
| **fetch + states**: loading, empty, error (with retry), success                                                                                   | `listings.js`, `dom.js`                      |
| **AbortController** (cancel stale requests; Stop button)                                                                                          | `listings.js`, `ai-match.js`                 |
| **History API** (`pushState`, `popstate`) keeps filters in the URL                                                                                | `listings.js`                                |
| **ES modules** (`import`/`export`, `type="module"`, top-level `await`)                                                                            | all of `public/js`                           |
| **Optimistic UI** with rollback                                                                                                                   | `applicants.js`                              |
| **Streaming** (`ReadableStream`, SSE parsing)                                                                                                     | `ai-stream.js`, `ai-match.js`                |
| **XSS-safe rendering**                                                                                                                            | `dom.js` (`h()`), tested in `client.test.js` |
| **Cookies vs localStorage**: the session is an `httpOnly` cookie JavaScript cannot read; nothing sensitive is in `localStorage` (not used at all) | `lib/sessions.js`                            |

> **Event bubbling/delegation:** one small real example: in `applicants.js` a single `change` listener on the `<form>` handles both dropdowns, because the event bubbles up from the `<select>`. Everywhere else listeners are attached directly (the card lists are re-rendered wholesale, so no delegation was needed).
>
> **Not used in this project:** `localStorage`/`sessionStorage`, Web Workers, a bundler, TypeScript, React.

---

## 9. Tests

`npm test` runs **49 tests** (the database must be running):

- **38 API tests** (Vitest + Supertest against a real PostgreSQL test database): per-user sessions, every authorisation rule, SQL-injection attempt, pagination/search/filters, ETag/304, upload validation, duplicate applications, CSRF, validation errors, the matcher and the SSE stream.
- **11 browser-side tests** (jsdom): debounce, XSS-safe DOM builder, form error accessibility, API client error mapping and retry.

---

## 10. Honest limitations

- The **live LLM call is untested** (no API key here); the offline writer is what runs and is tested.
- **Not deployed** from this environment.
- Resumes are stored on local disk: fine for local use, not for hosts with ephemeral disks.
- Rate limits are per-IP and in memory (reset on restart, not shared across servers).
- Pages are separate HTML files, so navigating reloads the page (a multi-page app); a framework would give single-page navigation at the cost of tooling.
- Sample content (testimonials, logo wall, companies) is fictional/placeholder and labelled as such.

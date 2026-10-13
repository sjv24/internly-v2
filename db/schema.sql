-- Internly schema (PostgreSQL). Idempotent: safe to run on every start.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('student', 'company')),
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- case-insensitive uniqueness: Bob@x.com and bob@x.com are the same account
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id       INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  university    TEXT NOT NULL DEFAULT '',
  year_of_study INT,
  website       TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS company_profiles (
  user_id      INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  location     TEXT NOT NULL DEFAULT '',
  industry     TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS listings (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  location    TEXT NOT NULL,
  work_type   TEXT NOT NULL CHECK (work_type IN ('on-site', 'remote', 'hybrid')),
  duration    TEXT NOT NULL,
  stipend     TEXT NOT NULL DEFAULT '',
  skills      TEXT[] NOT NULL DEFAULT '{}',
  openings    INT NOT NULL DEFAULT 1 CHECK (openings > 0),
  start_date  DATE,
  deadline    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- generated full-text search document, kept in sync by the database itself
  search      TSVECTOR GENERATED ALWAYS AS (
                to_tsvector('english', title || ' ' || description)
              ) STORED
);
-- One index per way we filter / sort / join: each answers "which column does a
-- WHERE, JOIN or ORDER BY touch?"
CREATE INDEX IF NOT EXISTS listings_company_idx   ON listings (company_id);
CREATE INDEX IF NOT EXISTS listings_work_type_idx ON listings (work_type);
CREATE INDEX IF NOT EXISTS listings_location_idx  ON listings (lower(location));
CREATE INDEX IF NOT EXISTS listings_created_idx   ON listings (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS listings_search_idx    ON listings USING GIN (search);

CREATE TABLE IF NOT EXISTS applications (
  id                   SERIAL PRIMARY KEY,
  student_id           INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id           INT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  cover_note           TEXT NOT NULL DEFAULT '',
  resume_file          TEXT,            -- stored file name (random), never the user's own file name
  resume_original_name TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, listing_id)       -- a student can apply to a listing only once
);
CREATE INDEX IF NOT EXISTS applications_listing_idx ON applications (listing_id);
CREATE INDEX IF NOT EXISTS applications_student_idx ON applications (student_id, created_at DESC);

-- Server-side sessions. The cookie holds a random token; we store only its SHA-256 hash,
-- so a database leak does not hand out usable session tokens.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx    ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { ErrorBoundary } from "./ErrorBoundary";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-2 py-1 text-sm font-medium transition hover:text-sky ${isActive ? "text-sky" : "text-white/90"}`;

function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await logout();
    setOpen(false);
    navigate("/");
  }
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-30 bg-navy shadow">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-xl font-bold tracking-widest text-sky" onClick={close}>
          INTERNLY
        </Link>

        <button
          type="button"
          className="rounded p-2 text-white md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
          </svg>
        </button>

        {/* On small screens the menu is a dropdown; from md up it is a horizontal row (Flexbox). */}
        <nav
          id="main-nav"
          aria-label="Main"
          className={`${open ? "flex" : "hidden"} absolute left-0 right-0 top-full flex-col items-start gap-2 bg-navy px-4 pb-4
            md:static md:flex md:flex-row md:items-center md:gap-4 md:p-0`}
        >
          <NavLink to="/listings" className={navClass} onClick={close}>
            Internships
          </NavLink>
          {user?.role === "student" && (
            <>
              <NavLink to="/student/ai-match" className={navClass} onClick={close}>
                AI CV Match
              </NavLink>
              <NavLink to="/student/applications" className={navClass} onClick={close}>
                My Applications
              </NavLink>
            </>
          )}
          {user?.role === "company" && (
            <>
              <NavLink to="/company/listings" className={navClass} onClick={close}>
                My Listings
              </NavLink>
              <NavLink to="/company/applicants" className={navClass} onClick={close}>
                Applicants
              </NavLink>
            </>
          )}
          {user ? (
            <>
              <NavLink to="/account" className={navClass} onClick={close}>
                {user.name}
              </NavLink>
              <button type="button" className="btn-primary px-4 py-1.5" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass} onClick={close}>
                Log in
              </NavLink>
              <Link to="/signup" className="btn-primary px-4 py-1.5" onClick={close}>
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <NavBar />
      <main id="content" className="flex-1">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="bg-navy py-6 text-center text-sm text-white/70">
        © {new Date().getFullYear()} Internly · A portfolio project. Sample data only.
      </footer>
    </div>
  );
}

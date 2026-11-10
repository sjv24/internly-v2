import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { FormField } from "../components/FormField";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

export default function Login() {
  usePageTitle("Log in");
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from ?? (user.role === "company" ? "/company/listings" : "/listings")} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const u = await login({ email, password });
      navigate(from ?? (u.role === "company" ? "/company/listings" : "/listings"), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-navy">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Log in as a student or a company.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FormField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          New here?{" "}
          <Link to="/signup" className="text-brand underline">
            Create an account
          </Link>
        </p>
        {import.meta.env.DEV && (
          <p className="mt-4 rounded bg-slate-100 p-3 text-xs text-slate-600">
            Demo logins (dev only, password <code>Password123!</code>): <code>student@internly.dev</code> or{" "}
            <code>company@internly.dev</code>
          </p>
        )}
      </div>
    </div>
  );
}

import { Navigate, Outlet, useLocation } from "react-router";
import type { Role } from "@internly/shared";
import { useAuth } from "../context/AuthContext";
import { EmptyState, Spinner } from "./States";

/**
 * Route guard. Wrap a group of routes: logged out -> redirected to /login (and sent back after
 * logging in); wrong kind of user -> a "not for you" message. This is for USER EXPERIENCE only:
 * the real security is the API, which re-checks the role on every request.
 */
export function ProtectedRoute({ role }: { role?: Role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (role && user.role !== role) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState title={`This page is for ${role} accounts`}>You are signed in as a {user.role}.</EmptyState>
      </div>
    );
  }
  return <Outlet />;
}

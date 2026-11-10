import { Link } from "react-router";
import { usePageTitle } from "../hooks/usePageTitle";

export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-6xl font-bold text-sky">404</p>
      <h1 className="mt-4 text-2xl font-bold text-navy">Page not found</h1>
      <p className="mt-2 text-slate-600">The page you are looking for does not exist.</p>
      <Link to="/" className="btn-primary mt-6">
        Back to home
      </Link>
    </div>
  );
}

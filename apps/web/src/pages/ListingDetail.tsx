import { Link, useLocation, useParams } from "react-router";
import type { Listing } from "@internly/shared";
import { ApplicationForm } from "../components/ApplicationForm";
import { ErrorMessage, Spinner } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { useApiData } from "../hooks/useApiData";
import { usePageTitle } from "../hooks/usePageTitle";
import { WORK_TYPE_LABEL, formatDate } from "../lib/format";

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const { data, loading, error, reload } = useApiData<{ listing: Listing }>(`/api/listings/${id}`);

  usePageTitle(data?.listing.title ?? "Internship");

  if (loading) return <Spinner />;
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorMessage
          error={error.status === 404 ? "This internship does not exist (or was removed)." : error}
          onRetry={error.status === 404 ? undefined : reload}
        />
        <Link to="/listings" className="btn-secondary mt-4">
          Back to internships
        </Link>
      </div>
    );
  }
  const l = data!.listing;

  const facts: Array<[string, string]> = [
    ["Location", l.location],
    ["Type", WORK_TYPE_LABEL[l.workType]],
    ["Duration", l.duration],
    ["Stipend", l.stipend || "Not specified"],
    ["Openings", String(l.openings)],
    ["Start date", formatDate(l.startDate)],
    ["Apply by", l.deadline ? formatDate(l.deadline) : "Open until filled"],
  ];

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1fr_22rem]">
      <article>
        <Link to="/listings" className="text-sm text-brand hover:underline">
          ← All internships
        </Link>
        <p className="mt-4 font-medium text-brand">{l.companyName}</p>
        <h1 className="text-3xl font-bold text-navy">{l.title}</h1>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
              <dd className="font-medium text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-8 text-lg font-semibold text-navy">About the role</h2>
        {/* whitespace-pre-line keeps the company's line breaks WITHOUT any HTML injection */}
        <p className="mt-2 whitespace-pre-line text-slate-700">{l.description}</p>

        <h2 className="mt-8 text-lg font-semibold text-navy">Skills</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {l.skills.length === 0 && <li className="text-slate-500">None listed</li>}
          {l.skills.map((s) => (
            <li key={s} className="rounded-full bg-sky/30 px-3 py-1 text-sm font-medium text-navy">
              {s}
            </li>
          ))}
        </ul>
      </article>

      <aside className="card h-fit p-6">
        {user?.role === "student" && <ApplicationForm listingId={l.id} />}
        {user?.role === "company" && (
          <p className="text-sm text-slate-600">You are signed in as a company. Only student accounts can apply.</p>
        )}
        {!user && (
          <div className="text-center">
            <p className="text-slate-700">Log in as a student to apply.</p>
            <Link to="/login" state={{ from: location.pathname }} className="btn-primary mt-4">
              Log in
            </Link>
            <p className="mt-3 text-sm text-slate-500">
              No account?{" "}
              <Link to="/signup" className="text-brand underline">
                Sign up
              </Link>
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

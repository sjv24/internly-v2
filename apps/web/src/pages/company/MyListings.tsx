import { useState } from "react";
import { Link } from "react-router";
import type { CompanyListing } from "@internly/shared";
import { EmptyState, ErrorMessage, Spinner } from "../../components/States";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../lib/api";
import { WORK_TYPE_LABEL, formatDate } from "../../lib/format";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function MyListings() {
  usePageTitle("My listings");
  const { data, loading, error, reload, setData } = useApiData<{ items: CompanyListing[] }>("/api/listings/mine");
  const [actionError, setActionError] = useState("");

  async function remove(l: CompanyListing) {
    const extra = l.applicationCount ? ` This also removes its ${l.applicationCount} application(s).` : "";
    if (!confirm(`Delete "${l.title}"?${extra}`)) return;
    setActionError("");
    try {
      await api.delete(`/api/listings/${l.id}`);
      setData((d) => (d ? { items: d.items.filter((x) => x.id !== l.id) } : d));
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-navy">My listings</h1>
        <Link to="/company/listings/new" className="btn-primary">
          + New internship
        </Link>
      </div>
      {actionError && (
        <div className="mt-4">
          <ErrorMessage error={actionError} />
        </div>
      )}
      <div className="mt-6">
        {loading && <Spinner />}
        {error && <ErrorMessage error={error} onRetry={reload} />}
        {data && data.items.length === 0 && (
          <EmptyState title="You have not posted any internships">
            <Link to="/company/listings/new" className="text-brand underline">
              Create your first listing
            </Link>
          </EmptyState>
        )}
        <ul className="space-y-4">
          {data?.items.map((l) => (
            <li key={l.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-navy">
                  <Link to={`/listings/${l.id}`} className="hover:underline">
                    {l.title}
                  </Link>
                </h2>
                <p className="text-sm text-slate-600">
                  {l.location} · {WORK_TYPE_LABEL[l.workType]} · {l.duration} · deadline{" "}
                  {l.deadline ? formatDate(l.deadline) : "none"}
                </p>
                <p className="mt-1 text-sm">
                  <Link to={`/company/applicants?listingId=${l.id}`} className="font-medium text-brand hover:underline">
                    {l.applicationCount} applicant{l.applicationCount === 1 ? "" : "s"}
                  </Link>
                </p>
              </div>
              <div className="flex gap-2">
                <Link to={`/company/listings/${l.id}/edit`} className="btn-secondary px-4 py-1.5">
                  Edit
                </Link>
                <button type="button" className="btn-secondary px-4 py-1.5 text-red-700" onClick={() => remove(l)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

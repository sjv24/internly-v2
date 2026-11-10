import { useState } from "react";
import { Link } from "react-router";
import type { StudentApplication } from "@internly/shared";
import { EmptyState, ErrorMessage, Spinner } from "../../components/States";
import { StatusBadge } from "../../components/StatusBadge";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../lib/api";
import { WORK_TYPE_LABEL, formatDate } from "../../lib/format";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function MyApplications() {
  usePageTitle("My applications");
  const { data, loading, error, reload, setData } = useApiData<{ items: StudentApplication[] }>(
    "/api/applications/mine",
  );
  const [actionError, setActionError] = useState("");

  async function withdraw(app: StudentApplication) {
    if (!confirm(`Withdraw your application to "${app.listing.title}"?`)) return;
    setActionError("");
    try {
      await api.delete(`/api/applications/${app.id}`);
      // update the screen locally instead of re-fetching the whole list
      setData((d) => (d ? { items: d.items.filter((a) => a.id !== app.id) } : d));
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy">My applications</h1>
      {actionError && (
        <div className="mt-4">
          <ErrorMessage error={actionError} />
        </div>
      )}
      <div className="mt-6">
        {loading && <Spinner />}
        {error && <ErrorMessage error={error} onRetry={reload} />}
        {data && data.items.length === 0 && (
          <EmptyState title="You have not applied to anything yet">
            <Link to="/listings" className="text-brand underline">
              Browse internships
            </Link>{" "}
            to get started.
          </EmptyState>
        )}
        <ul className="space-y-4">
          {data?.items.map((a) => (
            <li key={a.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-navy">
                  <Link to={`/listings/${a.listing.id}`} className="hover:underline">
                    {a.listing.title}
                  </Link>
                </h2>
                <p className="text-sm text-slate-600">
                  {a.listing.companyName} · {a.listing.location} · {WORK_TYPE_LABEL[a.listing.workType]}
                </p>
                <p className="mt-1 text-xs text-slate-400">Applied {formatDate(a.createdAt)}</p>
                {a.status === "accepted" && (
                  <p className="mt-2 text-sm font-medium text-emerald-700">
                    Congratulations! The company will contact you with next steps.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={a.status} />
                {a.hasResume && (
                  <a
                    href={`/api/applications/${a.id}/resume`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary px-3 py-1.5"
                  >
                    Resume
                  </a>
                )}
                {a.status === "pending" && (
                  <button type="button" className="btn-secondary px-3 py-1.5 text-red-700" onClick={() => withdraw(a)}>
                    Withdraw
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useSearchParams } from "react-router";
import { applicationStatusSchema } from "@internly/shared";
import type { ApplicationStatus, CompanyApplication, CompanyListing } from "@internly/shared";
import { SelectField } from "../../components/FormField";
import { EmptyState, ErrorMessage, Spinner } from "../../components/States";
import { StatusBadge } from "../../components/StatusBadge";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function Applicants() {
  usePageTitle("Applicants");
  const [params, setParams] = useSearchParams();
  const listingId = params.get("listingId") ?? "";
  const status = params.get("status") ?? "";
  const [actionError, setActionError] = useState("");

  const qs = new URLSearchParams();
  if (listingId) qs.set("listingId", listingId);
  if (status) qs.set("status", status);
  const apps = useApiData<{ items: CompanyApplication[] }>(`/api/applications/received?${qs}`);
  const listings = useApiData<{ items: CompanyListing[] }>("/api/listings/mine");

  const setFilter = (key: string, value: string) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (value) n.set(key, value);
      else n.delete(key);
      return n;
    });

  async function changeStatus(app: CompanyApplication, next: ApplicationStatus) {
    const previous = app.status;
    setActionError("");
    // Optimistic update: show the new status immediately, roll back if the server says no.
    apps.setData((d) => d && { items: d.items.map((a) => (a.id === app.id ? { ...a, status: next } : a)) });
    try {
      await api.patch(`/api/applications/${app.id}/status`, { status: next });
    } catch (err) {
      apps.setData((d) => d && { items: d.items.map((a) => (a.id === app.id ? { ...a, status: previous } : a)) });
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy">Applicants</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <SelectField label="Internship" value={listingId} onChange={(e) => setFilter("listingId", e.target.value)}>
          <option value="">All my internships</option>
          {listings.data?.items.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" value={status} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">Any status</option>
          {applicationStatusSchema.options.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </SelectField>
      </div>

      {actionError && (
        <div className="mt-4">
          <ErrorMessage error={actionError} />
        </div>
      )}
      <div className="mt-6">
        {apps.loading && <Spinner />}
        {apps.error && <ErrorMessage error={apps.error} onRetry={apps.reload} />}
        {apps.data && apps.data.items.length === 0 && <EmptyState title="No applicants match these filters" />}
        <ul className="space-y-4">
          {apps.data?.items.map((a) => (
            <li key={a.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-navy">{a.student.name}</h2>
                  <p className="text-sm text-slate-600">
                    applied to <strong>{a.listingTitle}</strong> on {formatDate(a.createdAt)}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-slate-400">Email</dt>
                  <dd>
                    <a className="text-brand hover:underline" href={`mailto:${a.student.email}`}>
                      {a.student.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">University</dt>
                  <dd>{a.student.university || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Website</dt>
                  <dd>
                    {/* only render real http(s) links: a "javascript:" URL here would be an XSS vector */}
                    {/^https?:\/\//i.test(a.student.website) ? (
                      <a
                        className="break-all text-brand hover:underline"
                        href={a.student.website}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {a.student.website}
                      </a>
                    ) : (
                      "-"
                    )}
                  </dd>
                </div>
              </dl>
              {a.coverNote && (
                <p className="mt-3 whitespace-pre-line rounded bg-slate-50 p-3 text-sm text-slate-700">{a.coverNote}</p>
              )}
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="w-44">
                  <SelectField
                    label="Set status"
                    value={a.status}
                    onChange={(e) => changeStatus(a, e.target.value as ApplicationStatus)}
                  >
                    {applicationStatusSchema.options.map((s) => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </SelectField>
                </div>
                {a.hasResume && (
                  <a
                    href={`/api/applications/${a.id}/resume`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                  >
                    View resume (PDF)
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

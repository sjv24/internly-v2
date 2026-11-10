import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { listingInputSchema, workTypeSchema } from "@internly/shared";
import type { Listing } from "@internly/shared";
import { FormField, SelectField, TextAreaField } from "../../components/FormField";
import { ErrorMessage, Spinner } from "../../components/States";
import { ApiError, api, errorMessage } from "../../lib/api";
import { WORK_TYPE_LABEL } from "../../lib/format";
import { useApiData } from "../../hooks/useApiData";
import { usePageTitle } from "../../hooks/usePageTitle";

type Form = Record<
  | "title"
  | "description"
  | "location"
  | "workType"
  | "duration"
  | "stipend"
  | "skills"
  | "openings"
  | "startDate"
  | "deadline",
  string
>;

const EMPTY: Form = {
  title: "",
  description: "",
  location: "",
  workType: "hybrid",
  duration: "",
  stipend: "",
  skills: "",
  openings: "1",
  startDate: "",
  deadline: "",
};

const fromListing = (l: Listing): Form => ({
  title: l.title,
  description: l.description,
  location: l.location,
  workType: l.workType,
  duration: l.duration,
  stipend: l.stipend,
  skills: l.skills.join(", "),
  openings: String(l.openings),
  startDate: l.startDate ?? "",
  deadline: l.deadline ?? "",
});

/** One component for BOTH "new" and "edit": the presence of :id in the URL decides. */
export default function ListingEditor() {
  usePageTitle("Internship editor");
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const existing = useApiData<{ listing: Listing }>(editing ? `/api/listings/${id}` : null);

  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // when the existing listing arrives, copy it into the (controlled) form
  useEffect(() => {
    if (existing.data) setForm(fromListing(existing.data.listing));
  }, [existing.data]);

  const bind = (name: keyof Form) => ({
    name,
    value: form[name],
    error: errors[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [name]: e.target.value })),
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const parsed = listingInputSchema.safeParse({
      ...form,
      skills: form.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean), // "React, SQL" -> ["React","SQL"]
      startDate: form.startDate || null,
      deadline: form.deadline || null,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[String(issue.path[0])] ??= issue.message;
      return setErrors(fe);
    }
    setErrors({});
    setSaving(true);
    try {
      if (editing) await api.put(`/api/listings/${id}`, parsed.data);
      else await api.post("/api/listings", parsed.data);
      navigate("/company/listings");
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (editing && existing.loading) return <Spinner />;
  if (editing && existing.error)
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorMessage error={existing.error} />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy">{editing ? "Edit internship" : "Create internship"}</h1>
      <form onSubmit={handleSubmit} noValidate className="card mt-6 grid gap-4 p-6 sm:grid-cols-2">
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:col-span-2"
          >
            {formError}
          </div>
        )}
        <div className="sm:col-span-2">
          <FormField label="Title" required {...bind("title")} />
        </div>
        <FormField label="Location" required placeholder="e.g. Dubai" {...bind("location")} />
        <SelectField label="Work type" {...bind("workType")}>
          {workTypeSchema.options.map((w) => (
            <option key={w} value={w}>
              {WORK_TYPE_LABEL[w]}
            </option>
          ))}
        </SelectField>
        <FormField label="Duration" required placeholder="e.g. 3 months" {...bind("duration")} />
        <FormField label="Stipend" placeholder="e.g. AED 2000/month or Unpaid" {...bind("stipend")} />
        <FormField label="Openings" type="number" min={1} {...bind("openings")} />
        <FormField label="Skills" hint="Comma separated, e.g. React, SQL, Git" {...bind("skills")} />
        <FormField label="Start date" type="date" {...bind("startDate")} />
        <FormField label="Application deadline" type="date" {...bind("deadline")} />
        <div className="sm:col-span-2">
          <TextAreaField label="Description" required rows={7} {...bind("description")} />
        </div>
        <div className="flex gap-3 sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create internship"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/company/listings")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

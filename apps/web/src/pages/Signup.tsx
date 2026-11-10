import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { companySignupSchema, studentSignupSchema } from "@internly/shared";
import type { Role } from "@internly/shared";
import { FormField, SelectField } from "../components/FormField";
import { useAuth } from "../context/AuthContext";
import { ApiError, errorMessage } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

type Errors = Record<string, string>;

export default function Signup() {
  usePageTitle("Sign up");
  const { user, signupStudent, signupCompany } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("student");
  const [values, setValues] = useState<Record<string, string>>({ yearOfStudy: "1" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/listings" replace />;

  // one handler for every field: the input's `name` attribute is the key in `values`
  const bind = (name: string) => ({
    name,
    value: values[name] ?? "",
    error: errors[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    // Validate in the browser with the SAME schema the server uses (shared package) for instant feedback.
    const schema = role === "student" ? studentSignupSchema : companySignupSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Errors = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      if (role === "student") await signupStudent(parsed.data as never);
      else await signupCompany(parsed.data as never);
      navigate(role === "company" ? "/company/listings" : "/listings", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields); // server-side field errors
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-navy">Create your account</h1>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium text-slate-700">I am a…</legend>
          <div className="grid grid-cols-2 gap-3">
            {(["student", "company"] as const).map((r) => (
              <label
                key={r}
                className={`cursor-pointer rounded-lg border-2 px-4 py-3 text-center font-semibold capitalize ${role === r ? "border-brand bg-sky/20 text-navy" : "border-slate-200 text-slate-500"}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => {
                    setRole(r);
                    setErrors({});
                  }}
                  className="sr-only"
                />
                {r}
              </label>
            ))}
          </div>
        </fieldset>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          {formError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {formError}
            </div>
          )}
          {role === "student" ? (
            <>
              <FormField label="Full name" required autoComplete="name" {...bind("name")} />
              <FormField label="Email" type="email" required autoComplete="email" {...bind("email")} />
              <FormField
                label="Password"
                type="password"
                required
                autoComplete="new-password"
                hint="At least 8 characters"
                {...bind("password")}
              />
              <FormField label="University / college" required {...bind("university")} />
              <SelectField label="Year of study" {...bind("yearOfStudy")}>
                {[1, 2, 3, 4, 5].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </SelectField>
              <FormField label="Personal website or LinkedIn" type="url" placeholder="https://" {...bind("website")} />
            </>
          ) : (
            <>
              <FormField label="Company name" required {...bind("name")} />
              <FormField label="Contact person" required {...bind("contactName")} />
              <FormField label="Email" type="email" required autoComplete="email" {...bind("email")} />
              <FormField
                label="Password"
                type="password"
                required
                autoComplete="new-password"
                hint="At least 8 characters"
                {...bind("password")}
              />
              <FormField label="Location" required placeholder="e.g. Dubai" {...bind("location")} />
              <FormField label="Industry" required {...bind("industry")} />
            </>
          )}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Creating account…" : `Sign up as ${role}`}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          Already registered?{" "}
          <Link to="/login" className="text-brand underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

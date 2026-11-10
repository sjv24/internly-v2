import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import type { PublicUser } from "@internly/shared";
import { FormField } from "../components/FormField";
import { useAuth } from "../context/AuthContext";
import { ApiError, api, errorMessage } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

export default function Account() {
  usePageTitle("Account");
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErrors({});
    try {
      const body: Record<string, string> = { name };
      if (newPassword) Object.assign(body, { currentPassword, newPassword });
      const r = await api.patch<{ user: PublicUser }>("/api/account", body);
      setUser(r.user);
      setCurrentPassword("");
      setNewPassword("");
      setMsg({ ok: true, text: "Saved." });
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      setMsg({ ok: false, text: errorMessage(err) });
    }
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    if (!confirm("Delete your account permanently? This cannot be undone.")) return;
    setDeleteError("");
    try {
      await api.delete("/api/account", { password: deletePassword });
      setUser(null);
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteError(errorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8 px-4 py-10">
      <h1 className="text-3xl font-bold text-navy">Account</h1>

      <form onSubmit={save} className="card space-y-4 p-6">
        <h2 className="text-lg font-semibold text-navy">Profile</h2>
        <p className="text-sm text-slate-500">
          Signed in as {user?.email} ({user?.role})
        </p>
        {msg && (
          <div
            role={msg.ok ? "status" : "alert"}
            className={`rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "border border-red-200 bg-red-50 text-red-800"}`}
          >
            {msg.text}
          </div>
        )}
        <FormField
          label={user?.role === "company" ? "Company name" : "Full name"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <FormField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          error={errors.currentPassword}
          hint="Only needed to change your password"
        />
        <FormField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={errors.newPassword}
          hint="At least 8 characters"
        />
        <button type="submit" className="btn-primary">
          Save changes
        </button>
      </form>

      <form onSubmit={deleteAccount} className="card space-y-4 border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-700">Delete account</h2>
        <p className="text-sm text-slate-600">This permanently removes your account and all your data.</p>
        {deleteError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {deleteError}
          </div>
        )}
        <FormField
          label="Confirm with your password"
          type="password"
          autoComplete="current-password"
          required
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
        />
        <button type="submit" className="btn-danger">
          Delete my account
        </button>
      </form>
    </div>
  );
}

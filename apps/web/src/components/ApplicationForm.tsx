import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { ApiError, api, errorMessage } from "../lib/api";
import { FormField, TextAreaField } from "./FormField";

const MAX_BYTES = 5 * 1024 * 1024;

/** Apply to a listing: cover note + PDF resume, sent as multipart/form-data in ONE request. */
export function ApplicationForm({ listingId }: { listingId: number }) {
  const [coverNote, setCoverNote] = useState("");
  const [fileError, setFileError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null); // direct handle to the <input type=file>
  const errorRef = useRef<HTMLDivElement>(null);

  function validateFile(file: File | undefined): string {
    if (!file) return "Please attach your resume";
    if (file.type !== "application/pdf") return "Resume must be a PDF";
    if (file.size > MAX_BYTES) return "Resume must be 5 MB or smaller";
    return "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); // stop the browser's default full-page form submit
    const file = fileRef.current?.files?.[0];
    const problem = validateFile(file);
    setFileError(problem);
    setFormError("");
    if (problem) return fileRef.current?.focus(); // move keyboard focus to the problem

    const body = new FormData();
    body.append("resume", file!);
    body.append("coverNote", coverNote);
    setSubmitting(true);
    try {
      await api.post(`/api/listings/${listingId}/apply`, body);
      setDone(true);
    } catch (err) {
      setFormError(errorMessage(err));
      if (err instanceof ApiError && err.fields?.resume) setFileError(err.fields.resume);
      errorRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
        <p className="font-semibold">Application sent!</p>
        <p className="mt-1 text-sm">
          Track its status any time in{" "}
          <Link to="/student/applications" className="underline">
            My Applications
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <h2 className="text-lg font-semibold text-navy">Apply for this internship</h2>
      {formError && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {formError}
        </div>
      )}
      <FormField
        ref={fileRef}
        label="Resume (PDF, max 5 MB)"
        type="file"
        accept="application/pdf"
        required
        error={fileError}
      />
      <TextAreaField
        label="Cover note (optional)"
        value={coverNote}
        maxLength={1000}
        onChange={(e) => setCoverNote(e.target.value)}
        hint={`${coverNote.length}/1000`}
      />
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Sending…" : "Submit application"}
      </button>
    </form>
  );
}

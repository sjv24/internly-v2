import { useReducer, useRef, useState } from "react";
import { Link } from "react-router";
import type { AiMatchEvent, Listing } from "@internly/shared";
import { TextAreaField } from "../../components/FormField";
import { ErrorMessage } from "../../components/States";
import { ApiError, errorMessage } from "../../lib/api";
import { streamAiMatch } from "../../lib/aiStream";
import { usePageTitle } from "../../hooks/usePageTitle";

type MatchCard = {
  listing: Pick<Listing, "id" | "title" | "companyName" | "location" | "workType">;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  reason: string;
  reasonState: "streaming" | "ai" | "template";
};
type Phase = "idle" | "streaming" | "done" | "stopped" | "error";
interface State {
  phase: Phase;
  provider: string;
  cards: MatchCard[];
  error: string;
}

type Action = AiMatchEvent | { type: "begin" } | { type: "stopped" } | { type: "failed"; message: string };

// A reducer = one pure function that says how each event changes the screen. Streaming gives us
// many small events; funnelling them all through one reducer keeps the state transitions in one place.
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "begin":
      return { phase: "streaming", provider: "", cards: [], error: "" };
    case "start":
      return { ...state, provider: action.provider };
    case "match":
      return {
        ...state,
        cards: [
          ...state.cards,
          {
            listing: action.listing,
            score: action.score,
            matchedSkills: action.matchedSkills,
            missingSkills: action.missingSkills,
            reason: "",
            reasonState: "streaming",
          },
        ],
      };
    case "reason_delta":
      return {
        ...state,
        cards: state.cards.map((c) =>
          c.listing.id === action.listingId ? { ...c, reason: c.reason + action.text } : c,
        ),
      };
    case "reason_done":
      return {
        ...state,
        cards: state.cards.map((c) => (c.listing.id === action.listingId ? { ...c, reasonState: action.source } : c)),
      };
    case "done":
      return { ...state, phase: "done" };
    case "error":
      return { ...state, phase: "error", error: action.message };
    case "stopped":
      return { ...state, phase: "stopped" };
    case "failed":
      return { ...state, phase: "error", error: action.message };
  }
}

export default function AiMatch() {
  usePageTitle("AI CV match");
  const [state, dispatch] = useReducer(reducer, { phase: "idle", provider: "", cards: [], error: "" });
  const cvRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null); // lets the Stop button cancel the request
  const [cvError, setCvError] = useState("");

  async function start() {
    const cvText = cvRef.current?.value.trim() ?? "";
    if (cvText.length < 50) return setCvError("Paste at least a few lines of your CV (50+ characters).");
    setCvError("");
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "begin" });
    try {
      await streamAiMatch(cvText, controller.signal, dispatch);
    } catch (err) {
      if (controller.signal.aborted) dispatch({ type: "stopped" });
      else dispatch({ type: "failed", message: err instanceof ApiError ? err.message : errorMessage(err) });
    }
  }

  const stop = () => abortRef.current?.abort();
  const streaming = state.phase === "streaming";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy">AI CV match</h1>
      <p className="mt-2 text-slate-600">
        Paste your CV and we rank open internships for you. The <strong>score</strong> is computed from the skills your
        CV shares with each listing, so you can check it yourself. The AI only writes the plain-language{" "}
        <strong>explanation</strong>.
      </p>

      <div className="mt-6 space-y-3">
        <TextAreaField
          ref={cvRef}
          label="Your CV (plain text)"
          rows={9}
          placeholder="Paste your CV here: education, skills, projects…"
          error={cvError}
          hint="Your CV is sent to the server only to compute this match and is not stored."
          maxLength={8000}
          disabled={streaming}
        />
        <div className="flex gap-3">
          <button type="button" className="btn-primary" onClick={start} disabled={streaming}>
            {streaming ? "Matching…" : "Find my matches"}
          </button>
          {streaming && (
            <button type="button" className="btn-danger" onClick={stop}>
              Stop
            </button>
          )}
        </div>
      </div>

      {/* aria-live: announce progress to screen-reader users */}
      <div className="mt-8" aria-live="polite" aria-busy={streaming}>
        {state.phase === "error" && <ErrorMessage error={state.error} onRetry={start} />}
        {state.phase === "stopped" && (
          <p className="text-sm text-slate-500">Stopped. Showing the {state.cards.length} result(s) received so far.</p>
        )}
        {state.phase === "done" && state.cards.length === 0 && (
          <p className="card p-6 text-slate-600">
            No strong matches found. Try adding more skills and tools to your CV.
          </p>
        )}
        {state.provider && (
          <p className="mb-3 text-xs text-slate-400">
            Explanations by:{" "}
            {state.provider === "offline" ? "built-in offline writer (no API key configured)" : state.provider}
          </p>
        )}
        <ol className="space-y-4">
          {state.cards.map((c, i) => (
            <li key={c.listing.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">#{i + 1}</p>
                  <h2 className="text-lg font-semibold text-navy">
                    <Link to={`/listings/${c.listing.id}`} className="hover:underline">
                      {c.listing.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-slate-600">
                    {c.listing.companyName} · {c.listing.location}
                  </p>
                </div>
                <div className="text-right" aria-label={`Match score ${c.score} out of 100`}>
                  <p className="text-3xl font-bold text-brand">{c.score}</p>
                  <p className="text-xs text-slate-400">/ 100</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky to-brand"
                  style={{ width: `${c.score}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {c.matchedSkills.map((s) => (
                  <span key={s} className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                    ✓ {s}
                  </span>
                ))}
                {c.missingSkills.map((s) => (
                  <span key={s} className="rounded bg-slate-100 px-2 py-0.5 text-slate-500">
                    ✗ {s}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm text-slate-700">
                {c.reason}
                {c.reasonState === "streaming" && (
                  <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-brand align-middle" aria-hidden />
                )}
              </p>
              {c.reasonState === "template" && state.provider !== "offline" && (
                <p className="mt-1 text-xs text-amber-600">
                  The AI was unavailable, so this explanation was generated from your matched skills.
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

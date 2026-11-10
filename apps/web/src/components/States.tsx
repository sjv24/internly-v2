import type { ReactNode } from "react";
import { ApiError } from "../lib/api";

/** The three states every data screen must handle besides "success": loading, empty, error. */

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand" aria-hidden />
      <span>{label}…</span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="text-lg font-semibold text-slate-700">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function ErrorMessage({ error, onRetry }: { error: ApiError | Error | string; onRetry?: () => void }) {
  const message = typeof error === "string" ? error : error.message;
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
      <p className="font-semibold">Something went wrong</p>
      <p className="mt-1">{message}</p>
      {requestId && <p className="mt-1 text-xs text-red-600">Reference: {requestId}</p>}
      {onRetry && (
        <button type="button" className="btn-secondary mt-3" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card h-56 animate-pulse bg-slate-100" />
      ))}
    </div>
  );
}

import type { ApplicationStatus } from "@internly/shared";

// Record<ApplicationStatus, ...> makes TypeScript force us to handle EVERY status:
// add a 4th status in packages/shared and this file stops compiling until we style it.
const STYLES: Record<ApplicationStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
  accepted: { label: "Accepted", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const s = STYLES[status];
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${s.className}`}>{s.label}</span>;
}

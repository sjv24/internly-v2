import type { WorkType } from "@internly/shared";

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  "on-site": "On-site",
  remote: "Remote",
  hybrid: "Hybrid",
};

/** "2026-10-04" or an ISO timestamp -> "4 Oct 2026". */
export function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

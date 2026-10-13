export const WORK_TYPE_LABEL = { "on-site": "On-site", remote: "Remote", hybrid: "Hybrid" };

/** "2026-10-04" or an ISO timestamp -> "4 Oct 2026". */
export function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

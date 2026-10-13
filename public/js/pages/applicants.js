import { api, errorMessage } from "../api.js";
import { statusBadge } from "../components.js";
import { $, emptyState, errorBox, h, isSafeUrl, setContent, spinner } from "../dom.js";
import { capitalize, formatDate } from "../format.js";
import { initPage } from "../layout.js";

const user = await initPage({ title: "Applicants", role: "company" });
if (!user) throw new Error("not allowed");

const STATUSES = ["pending", "accepted", "rejected"];
const form = $("#filters");
const list = $("#list");

// the "Internship" filter is filled from the company's own listings; ?listingId= preselects one
const initial = new URLSearchParams(location.search).get("listingId") ?? "";
try {
  const { items } = await api.get("/api/listings/mine");
  for (const l of items) form.elements.listingId.append(h("option", { value: l.id }, l.title));
  form.elements.listingId.value = initial;
} catch {
  /* the filter just stays "All" */
}

async function load() {
  setContent(list, spinner());
  const params = new URLSearchParams();
  if (form.elements.listingId.value) params.set("listingId", form.elements.listingId.value);
  if (form.elements.status.value) params.set("status", form.elements.status.value);
  try {
    const { items } = await api.get(`/api/applications/received?${params}`);
    if (items.length === 0) return setContent(list, emptyState("No applicants match these filters"));
    setContent(list, h("ul", { class: "item-list" }, items.map(card)));
  } catch (err) {
    setContent(list, errorBox(err.message, load));
  }
}

function card(a) {
  const badgeSlot = h("span", {}, statusBadge(a.status));
  const select = h(
    "select",
    { id: `status-${a.id}`, onchange: (e) => changeStatus(a, e.target, badgeSlot) },
    STATUSES.map((s) => h("option", { value: s, selected: s === a.status }, capitalize(s))),
  );

  return h(
    "li",
    { class: "card stack" },
    h(
      "div",
      { class: "row row--between" },
      h(
        "div",
        {},
        h("h2", { style: "margin:0" }, a.student.name),
        h(
          "p",
          { class: "muted", style: "margin:0" },
          `applied to ${a.listingTitle} on ${formatDate(a.createdAt)}`,
        ),
      ),
      badgeSlot,
    ),
    h(
      "dl",
      { class: "details-grid" },
      h(
        "div",
        {},
        h("dt", {}, "Email"),
        h("dd", {}, h("a", { href: `mailto:${a.student.email}` }, a.student.email)),
      ),
      h("div", {}, h("dt", {}, "University"), h("dd", {}, a.student.university || "-")),
      h(
        "div",
        {},
        h("dt", {}, "Website"),
        // only real http(s) links become <a>: a "javascript:" URL here would be an XSS vector
        h(
          "dd",
          {},
          isSafeUrl(a.student.website)
            ? h(
                "a",
                { href: a.student.website, target: "_blank", rel: "noreferrer noopener" },
                a.student.website,
              )
            : "-",
        ),
      ),
    ),
    a.coverNote ? h("p", { class: "note-box" }, a.coverNote) : null,
    h(
      "div",
      { class: "row" },
      h(
        "div",
        { class: "field", style: "margin:0;min-width:11rem" },
        h("label", { for: `status-${a.id}` }, "Set status"),
        select,
      ),
      a.hasResume
        ? h(
            "a",
            {
              class: "btn btn--secondary",
              href: `/api/applications/${a.id}/resume`,
              target: "_blank",
              rel: "noreferrer",
            },
            "View resume (PDF)",
          )
        : null,
    ),
  );
}

/** Optimistic update: show the new status right away, roll back if the server refuses. */
async function changeStatus(a, select, badgeSlot) {
  const previous = a.status;
  const next = select.value;
  setContent($("#action-error"));
  setContent(badgeSlot, statusBadge(next));
  try {
    await api.patch(`/api/applications/${a.id}/status`, { status: next });
    a.status = next;
  } catch (err) {
    select.value = previous;
    setContent(badgeSlot, statusBadge(previous));
    setContent($("#action-error"), h("div", { class: "alert", role: "alert" }, errorMessage(err)));
  }
}

form.addEventListener("change", load);
form.addEventListener("submit", (e) => e.preventDefault());
load();

import { h } from "./dom.js";
import { WORK_TYPE_LABEL, capitalize, formatDate } from "./format.js";

/* Small reusable "components": plain functions that return DOM elements. */

export const statusBadge = (status) => h("span", { class: `badge badge--${status}` }, capitalize(status));

export function listingCard(l) {
  return h(
    "li",
    {},
    h(
      "article",
      { class: "card listing-card" },
      h("p", { class: "listing-card__company" }, l.companyName),
      h("h3", {}, h("a", { href: `/listing?id=${l.id}` }, l.title)),
      h(
        "ul",
        { class: "chips" },
        [l.location, WORK_TYPE_LABEL[l.workType], l.duration].map((t) => h("li", { class: "chip" }, t)),
      ),
      h("p", { class: "listing-card__desc" }, l.description),
      h(
        "ul",
        { class: "chips" },
        l.skills.slice(0, 4).map((s) => h("li", { class: "chip chip--skill" }, s)),
      ),
      h(
        "p",
        { class: "muted", style: "margin:0" },
        l.deadline ? `Apply by ${formatDate(l.deadline)}` : "Open until filled",
      ),
    ),
  );
}

/** Page buttons: 1 … (page-1) page (page+1) … last */
export function pagination(page, totalPages, onPage) {
  if (totalPages <= 1) return h("span");
  const shown = [
    ...new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages)),
  ].sort((a, b) => a - b);
  const nodes = [
    h(
      "button",
      { type: "button", class: "btn btn--secondary", disabled: page <= 1, onclick: () => onPage(page - 1) },
      "Previous",
    ),
  ];
  shown.forEach((p, i) => {
    if (i > 0 && p - shown[i - 1] > 1) nodes.push(h("span", { "aria-hidden": "true" }, "…"));
    nodes.push(
      h(
        "button",
        {
          type: "button",
          class: "page-btn",
          "aria-label": `Page ${p}`,
          "aria-current": p === page ? "page" : null,
          onclick: () => onPage(p),
        },
        String(p),
      ),
    );
  });
  nodes.push(
    h(
      "button",
      {
        type: "button",
        class: "btn btn--secondary",
        disabled: page >= totalPages,
        onclick: () => onPage(page + 1),
      },
      "Next",
    ),
  );
  return h("nav", { class: "pagination", "aria-label": "Pagination" }, nodes);
}

/** A <select> field with a label. `options` = [[value, text], ...] */
export function selectField(name, label, options, value = "") {
  return h(
    "div",
    { class: "field" },
    h("label", { for: name }, label),
    h(
      "select",
      { id: name, name },
      options.map(([v, text]) => h("option", { value: v, selected: String(v) === String(value) }, text)),
    ),
  );
}

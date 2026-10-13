import { api, errorMessage } from "../api.js";
import { statusBadge } from "../components.js";
import { $, emptyState, errorBox, h, setContent, spinner } from "../dom.js";
import { WORK_TYPE_LABEL, formatDate } from "../format.js";
import { initPage } from "../layout.js";

const user = await initPage({ title: "My applications", role: "student" });
if (!user) throw new Error("not allowed"); // stops this module; the page already redirected/explained

const list = $("#list");

async function load() {
  setContent(list, spinner());
  try {
    const { items } = await api.get("/api/applications/mine");
    render(items);
  } catch (err) {
    setContent(list, errorBox(err.message, load));
  }
}

function render(items) {
  if (items.length === 0) {
    return setContent(
      list,
      emptyState(
        "You have not applied to anything yet",
        h("a", { href: "/listings" }, "Browse internships"),
        " to get started.",
      ),
    );
  }
  setContent(list, h("ul", { class: "item-list" }, items.map(row)));
}

function row(a) {
  return h(
    "li",
    { class: "card item" },
    h(
      "div",
      {},
      h("h2", {}, h("a", { href: `/listing?id=${a.listing.id}` }, a.listing.title)),
      h(
        "p",
        { class: "muted", style: "margin:0" },
        `${a.listing.companyName} · ${a.listing.location} · ${WORK_TYPE_LABEL[a.listing.workType]}`,
      ),
      h("p", { class: "muted", style: "margin:.25rem 0 0" }, `Applied ${formatDate(a.createdAt)}`),
      a.status === "accepted"
        ? h(
            "p",
            { style: "color:var(--success);font-weight:500;margin:.5rem 0 0" },
            "Congratulations! The company will contact you with next steps.",
          )
        : null,
    ),
    h(
      "div",
      { class: "item__actions" },
      statusBadge(a.status),
      a.hasResume
        ? h(
            "a",
            {
              class: "btn btn--secondary btn--small",
              href: `/api/applications/${a.id}/resume`,
              target: "_blank",
              rel: "noreferrer",
            },
            "Resume",
          )
        : null,
      a.status === "pending"
        ? h(
            "button",
            {
              type: "button",
              class: "btn btn--secondary btn--small",
              style: "color:var(--danger)",
              onclick: () => withdraw(a),
            },
            "Withdraw",
          )
        : null,
    ),
  );
}

async function withdraw(a) {
  if (!confirm(`Withdraw your application to "${a.listing.title}"?`)) return;
  setContent($("#action-error"));
  try {
    await api.delete(`/api/applications/${a.id}`);
    load();
  } catch (err) {
    setContent($("#action-error"), h("div", { class: "alert", role: "alert" }, errorMessage(err)));
  }
}

load();

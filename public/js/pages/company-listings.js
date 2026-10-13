import { api, errorMessage } from "../api.js";
import { $, emptyState, errorBox, h, setContent, spinner } from "../dom.js";
import { WORK_TYPE_LABEL, formatDate } from "../format.js";
import { initPage } from "../layout.js";

const user = await initPage({ title: "My listings", role: "company" });
if (!user) throw new Error("not allowed");

const list = $("#list");

async function load() {
  setContent(list, spinner());
  try {
    const { items } = await api.get("/api/listings/mine");
    if (items.length === 0) {
      return setContent(
        list,
        emptyState(
          "You have not posted any internships",
          h("a", { href: "/company/listing-edit" }, "Create your first listing"),
        ),
      );
    }
    setContent(list, h("ul", { class: "item-list" }, items.map(row)));
  } catch (err) {
    setContent(list, errorBox(err.message, load));
  }
}

function row(l) {
  const n = l.applicationCount;
  return h(
    "li",
    { class: "card item" },
    h(
      "div",
      {},
      h("h2", {}, h("a", { href: `/listing?id=${l.id}` }, l.title)),
      h(
        "p",
        { class: "muted", style: "margin:0" },
        `${l.location} · ${WORK_TYPE_LABEL[l.workType]} · ${l.duration} · deadline ${l.deadline ? formatDate(l.deadline) : "none"}`,
      ),
      h(
        "p",
        { style: "margin:.25rem 0 0" },
        h("a", { href: `/company/applicants?listingId=${l.id}` }, `${n} applicant${n === 1 ? "" : "s"}`),
      ),
    ),
    h(
      "div",
      { class: "item__actions" },
      h("a", { class: "btn btn--secondary btn--small", href: `/company/listing-edit?id=${l.id}` }, "Edit"),
      h(
        "button",
        {
          type: "button",
          class: "btn btn--secondary btn--small",
          style: "color:var(--danger)",
          onclick: () => remove(l),
        },
        "Delete",
      ),
    ),
  );
}

async function remove(l) {
  const extra = l.applicationCount ? ` This also removes its ${l.applicationCount} application(s).` : "";
  if (!confirm(`Delete "${l.title}"?${extra}`)) return;
  setContent($("#action-error"));
  try {
    await api.delete(`/api/listings/${l.id}`);
    load();
  } catch (err) {
    setContent($("#action-error"), h("div", { class: "alert", role: "alert" }, errorMessage(err)));
  }
}

load();

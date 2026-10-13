import { api, ApiError, errorMessage } from "../api.js";
import { $, emptyState, errorBox, h, setContent, showFieldErrors, spinner } from "../dom.js";
import { WORK_TYPE_LABEL, formatDate } from "../format.js";
import { initPage } from "../layout.js";

const user = await initPage({ title: "Internship" });
const root = $("#detail");
const id = new URLSearchParams(location.search).get("id");
const MAX_BYTES = 5 * 1024 * 1024;

async function load() {
  setContent(root, spinner());
  try {
    const { listing } = await api.get(`/api/listings/${encodeURIComponent(id)}`);
    document.title = `${listing.title} | Internly`;
    render(listing);
  } catch (err) {
    setContent(
      root,
      err.status === 404 || err.status === 400
        ? emptyState(
            "This internship does not exist (or was removed).",
            h("a", { href: "/listings" }, "Back to internships"),
          )
        : errorBox(err.message, load),
    );
  }
}

function render(l) {
  const facts = [
    ["Location", l.location],
    ["Type", WORK_TYPE_LABEL[l.workType]],
    ["Duration", l.duration],
    ["Stipend", l.stipend || "Not specified"],
    ["Openings", String(l.openings)],
    ["Start date", formatDate(l.startDate)],
    ["Apply by", l.deadline ? formatDate(l.deadline) : "Open until filled"],
  ];

  setContent(
    root,
    h(
      "div",
      { class: "detail-layout" },
      h(
        "article",
        {},
        h("a", { href: "/listings" }, "← All internships"),
        h("p", { style: "margin:1rem 0 0;color:var(--brand);font-weight:500" }, l.companyName),
        h("h1", {}, l.title),
        h(
          "dl",
          { class: "facts" },
          facts.map(([k, v]) => h("div", {}, h("dt", {}, k), h("dd", {}, v))),
        ),
        h("h2", {}, "About the role"),
        h("p", { class: "pre-line" }, l.description), // text only: never injected as HTML
        h("h2", {}, "Skills"),
        l.skills.length
          ? h(
              "ul",
              { class: "chips" },
              l.skills.map((s) => h("li", { class: "chip chip--skill" }, s)),
            )
          : h("p", { class: "muted" }, "None listed"),
      ),
      h("aside", { class: "card" }, applyPanel(l)),
    ),
  );
}

function applyPanel(l) {
  if (!user) {
    return h(
      "div",
      { style: "text-align:center" },
      h("p", {}, "Log in as a student to apply."),
      h(
        "a",
        {
          class: "btn btn--primary",
          href: `/login?next=${encodeURIComponent(location.pathname + location.search)}`,
        },
        "Log in",
      ),
      h(
        "p",
        { class: "muted", style: "margin-top:.75rem" },
        "No account? ",
        h("a", { href: "/signup" }, "Sign up"),
      ),
    );
  }
  if (user.role === "company")
    return h("p", { class: "muted" }, "You are signed in as a company. Only student accounts can apply.");
  return applicationForm(l);
}

/** Apply: a cover note plus a PDF resume, sent as multipart/form-data in ONE request. */
function applicationForm(l) {
  const msg = h("div");
  const form = h(
    "form",
    { novalidate: true },
    h("h2", {}, "Apply for this internship"),
    msg,
    h(
      "div",
      { class: "field" },
      h(
        "label",
        { for: "resume" },
        "Resume (PDF, max 5 MB) ",
        h("span", { class: "required", "aria-hidden": "true" }, "*"),
      ),
      h("input", { id: "resume", name: "resume", type: "file", accept: "application/pdf", required: true }),
    ),
    h(
      "div",
      { class: "field" },
      h("label", { for: "coverNote" }, "Cover note (optional)"),
      h("textarea", { id: "coverNote", name: "coverNote", maxlength: 1000 }),
    ),
    h("button", { type: "submit", class: "btn btn--primary" }, "Submit application"),
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // stop the browser's default full-page form submit
    setContent(msg);
    const file = form.elements.resume.files[0];
    const problem = !file
      ? "Please attach your resume"
      : file.type !== "application/pdf"
        ? "Resume must be a PDF"
        : file.size > MAX_BYTES
          ? "Resume must be 5 MB or smaller"
          : "";
    showFieldErrors(form, problem ? { resume: problem } : {});
    if (problem) return;

    const body = new FormData();
    body.append("resume", file);
    body.append("coverNote", form.elements.coverNote.value);
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Sending…";
    try {
      await api.post(`/api/listings/${l.id}/apply`, body);
      form.replaceWith(
        h(
          "div",
          { class: "alert alert--success", role: "status" },
          h("strong", {}, "Application sent! "),
          "Track its status in ",
          h("a", { href: "/student/applications" }, "My Applications"),
          ".",
        ),
      );
    } catch (err) {
      button.disabled = false;
      button.textContent = "Submit application";
      setContent(msg, h("div", { class: "alert", role: "alert" }, errorMessage(err)));
      if (err instanceof ApiError && err.fields) showFieldErrors(form, err.fields);
    }
  });
  return form;
}

load();

import { getUser, logout } from "./auth.js";
import { $, h } from "./dom.js";

/*
 * Every page calls initPage() first. It builds the shared header + footer (so the HTML files do not
 * repeat them), sets the tab title, and enforces who may see the page.
 *
 *   const user = await initPage({ title: "My applications", role: "student" });
 *   if (!user) return;   // wrong/no user: the page already redirected or showed a message
 */
export async function initPage({ title = "", role } = {}) {
  document.title = title ? `${title} | Internly` : "Internly - find your next internship";
  const user = await getUser();

  if (role && !user) {
    // not logged in: go to login and come back here afterwards
    location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    return null;
  }
  renderHeader(user);
  renderFooter();

  if (role && role !== "any" && user.role !== role) {
    $("main").replaceChildren(
      h(
        "div",
        { class: "container container--medium" },
        h(
          "div",
          { class: "card empty" },
          h("p", { class: "empty__title" }, `This page is for ${role} accounts`),
          h("p", { class: "muted" }, `You are signed in as a ${user.role}.`),
        ),
      ),
    );
    return null;
  }
  return user;
}

function navLink(href, text) {
  const active = location.pathname === href || location.pathname === href.replace(/\.html$/, "");
  return h("a", { href, "aria-current": active ? "page" : null }, text);
}

function renderHeader(user) {
  const links = [navLink("/listings", "Internships")];
  if (user?.role === "student")
    links.push(
      navLink("/student/ai-match", "AI CV Match"),
      navLink("/student/applications", "My Applications"),
    );
  if (user?.role === "company")
    links.push(navLink("/company/listings", "My Listings"), navLink("/company/applicants", "Applicants"));
  if (user) {
    links.push(
      navLink("/account", user.name),
      h("button", { type: "button", class: "btn btn--primary btn--small", onclick: logout }, "Log out"),
    );
  } else {
    links.push(
      navLink("/login", "Log in"),
      h("a", { href: "/signup", class: "btn btn--primary btn--small" }, "Sign up"),
    );
  }

  const nav = h("nav", { class: "nav", id: "main-nav", "aria-label": "Main" }, links);
  const toggle = h(
    "button",
    {
      type: "button",
      class: "nav-toggle",
      "aria-label": "Toggle menu",
      "aria-expanded": "false",
      "aria-controls": "main-nav",
      onclick: () => {
        const open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
        toggle.textContent = open ? "✕" : "☰";
      },
    },
    "☰",
  );

  $("#site-header").replaceChildren(
    h("div", { class: "site-header__inner" }, h("a", { href: "/", class: "logo" }, "INTERNLY"), toggle, nav),
  );
}

function renderFooter() {
  $("#site-footer").replaceChildren(
    `© ${new Date().getFullYear()} Internly · A portfolio project. Sample data only.`,
  );
}

/**
 * h(tag, attributes, ...children): builds a DOM element safely.
 *
 * This is the structural fix for the classic XSS bug (v1 built HTML strings and assigned them to
 * innerHTML). Here strings are always added with createTextNode(), so "<img onerror=...>" coming
 * from a database shows up as harmless TEXT on the page, never as an element.
 *
 *   h("a", { href: "/x", class: "btn", onclick: handler }, "Click ", h("b", {}, "me"))
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** Only allow http(s) links from user-supplied text: "javascript:..." URLs are an XSS vector. */
export const isSafeUrl = (value) => /^https?:\/\//i.test(value ?? "");

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/* ---- the states every data screen must handle besides "success" ---- */

export const spinner = (label = "Loading") => h("div", { class: "spinner", role: "status" }, `${label}…`);

export const skeletonGrid = (count = 6) =>
  h(
    "div",
    { class: "card-grid", "aria-hidden": "true" },
    Array.from({ length: count }, () => h("div", { class: "skeleton" })),
  );

export const emptyState = (title, ...details) =>
  h(
    "div",
    { class: "card empty" },
    h("p", { class: "empty__title" }, title),
    details.length ? h("p", { class: "muted" }, ...details) : null,
  );

export function errorBox(message, onRetry) {
  return h(
    "div",
    { class: "alert", role: "alert" },
    h("strong", {}, "Something went wrong. "),
    message,
    onRetry
      ? h(
          "div",
          {},
          h(
            "button",
            {
              type: "button",
              class: "btn btn--secondary btn--small",
              onclick: onRetry,
              style: "margin-top:.5rem",
            },
            "Try again",
          ),
        )
      : null,
  );
}

/* ---- accessible form helpers ---- */

/** Show { fieldName: "message" } errors next to the matching inputs (and tell screen readers). */
export function showFieldErrors(form, fields = {}) {
  for (const old of $$(".field-error", form)) old.remove();
  for (const input of $$("[aria-invalid]", form)) input.removeAttribute("aria-invalid");
  let first = null;
  for (const [name, message] of Object.entries(fields)) {
    const input = form.elements[name];
    if (!input || input instanceof RadioNodeList) continue;
    input.setAttribute("aria-invalid", "true");
    const id = `err-${name}`;
    input.setAttribute("aria-describedby", id);
    input.closest(".field")?.append(h("p", { class: "field-error", id, role: "alert" }, message));
    first ??= input;
  }
  first?.focus(); // move keyboard focus to the first problem
}

/** Replace the contents of an element. */
export const setContent = (el, ...nodes) => el.replaceChildren(...nodes.flat().filter(Boolean));

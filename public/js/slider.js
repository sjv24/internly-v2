import { h } from "./dom.js";
import { initials } from "./format.js";

const INTERVAL_MS = 5000;

/**
 * Testimonial carousel. Auto-advances, pauses while the mouse is over it or a button has focus,
 * and does not auto-advance at all for people who asked their OS for reduced motion.
 * The slides cross-fade with a CSS transition on `opacity` (see styles.css), so JavaScript only
 * toggles a class: the animation itself runs on the browser's compositor.
 */
export function createSlider(root, items) {
  let index = 0;
  let timer;

  const slides = items.map((t) =>
    h(
      "figure",
      { class: "slide" },
      h("div", { class: "slide__avatar", "aria-hidden": "true" }, initials(t.name)),
      h("blockquote", {}, `“${t.quote}”`),
      h("figcaption", {}, `${t.name}, ${t.role}`),
    ),
  );
  const dots = items.map((_, i) =>
    h("button", {
      type: "button",
      "aria-label": `Show testimonial ${i + 1} of ${items.length}`,
      onclick: () => show(i),
    }),
  );

  root.setAttribute("aria-roledescription", "carousel");
  root.setAttribute("aria-label", "What our users say (sample testimonials)");
  root.replaceChildren(
    h("div", { class: "slider__stage" }, slides),
    h("div", { class: "slider__dots" }, dots),
  );

  function show(i) {
    index = i;
    slides.forEach((slide, n) => {
      slide.classList.toggle("is-active", n === i);
      slide.setAttribute("aria-hidden", String(n !== i));
    });
    dots.forEach((dot, n) => dot.setAttribute("aria-current", String(n === i)));
  }

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function start() {
    stop();
    if (!reduceMotion) timer = setInterval(() => show((index + 1) % items.length), INTERVAL_MS);
  }
  // Always clear the interval when pausing: a forgotten timer keeps running (a "leak").
  const stop = () => clearInterval(timer);

  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);
  root.addEventListener("focusin", stop);
  root.addEventListener("focusout", start);

  show(0);
  start();
}

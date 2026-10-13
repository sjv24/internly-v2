// @vitest-environment jsdom
// ^ this one file runs in a simulated browser (jsdom) so we can test the front-end modules.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, request } from "../public/js/api.js";
import { debounce } from "../public/js/debounce.js";
import { h, isSafeUrl, showFieldErrors } from "../public/js/dom.js";

describe("debounce (closure over a timer)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("calls the function once, after the calls stop, with the last arguments", () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d("r");
    d("re");
    d("react");
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("react");
  });

  it("can be cancelled", () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    d.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("h() builds DOM safely (XSS)", () => {
  it('shows "<img onerror=...>" as plain text instead of creating an element', () => {
    const evil = '<img src=x onerror="alert(1)">';
    const el = h("p", {}, evil);
    expect(el.querySelector("img")).toBeNull();
    expect(el.textContent).toBe(evil);
  });

  it("sets attributes, classes and event listeners", () => {
    const onclick = vi.fn();
    const el = h("button", { class: "btn", type: "button", disabled: true, onclick }, "Go");
    el.click();
    expect(el.className).toBe("btn");
    expect(el.disabled).toBe(true);
    expect(onclick).not.toHaveBeenCalled(); // disabled buttons ignore clicks
  });

  it("accepts nested arrays and skips null/false children", () => {
    const el = h("ul", {}, [h("li", {}, "a"), null, false, [h("li", {}, "b")]]);
    expect(el.children).toHaveLength(2);
  });

  it("only treats http(s) URLs as safe links (blocks javascript:)", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("")).toBe(false);
  });
});

describe("showFieldErrors (accessible form errors)", () => {
  it("marks the input invalid, links the message to it, and focuses the first problem", () => {
    document.body.replaceChildren(
      h(
        "form",
        { id: "f" },
        h(
          "div",
          { class: "field" },
          h("label", { for: "email" }, "Email"),
          h("input", { id: "email", name: "email" }),
        ),
      ),
    );
    const form = document.getElementById("f");
    showFieldErrors(form, { email: "Invalid email" });
    const input = form.elements.email;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")).textContent).toBe("Invalid email");
    expect(document.activeElement).toBe(input);
    showFieldErrors(form, {}); // clearing removes old errors
    expect(form.querySelector(".field-error")).toBeNull();
  });
});

describe("api client", () => {
  const json = (status, body) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("turns an error response into an ApiError with code and field messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json(400, {
        error: {
          code: "validation_error",
          message: "Some fields are invalid",
          fields: { email: "Invalid email" },
        },
      }),
    );
    const err = await request("/api/x", { method: "POST", body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: "validation_error", fields: { email: "Invalid email" } });
  });

  it("retries a GET after a network failure (exponential backoff), then succeeds", async () => {
    vi.useFakeTimers();
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(json(200, { n: 1 }));
    const promise = request("/api/x");
    await vi.advanceTimersByTimeAsync(400);
    await expect(promise).resolves.toEqual({ n: 1 });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("never retries a POST (it could be submitted twice)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    await expect(request("/api/x", { method: "POST", body: {} })).rejects.toMatchObject({ status: 0 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("sends a request id header so the server log can be correlated", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(200, {}));
    await request("/api/x");
    expect(spy.mock.calls[0][1].headers["X-Request-Id"]).toMatch(/[0-9a-f-]{36}/);
  });
});

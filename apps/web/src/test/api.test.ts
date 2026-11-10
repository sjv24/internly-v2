import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, request } from "../lib/api";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it("returns parsed JSON and sends a request id header", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(200, { ok: true }));
    await expect(request<{ ok: boolean }>("/api/x")).resolves.toEqual({ ok: true });
    const headers = spy.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers["X-Request-Id"]).toMatch(/[0-9a-f-]{36}/);
  });

  it("turns an error response into an ApiError with code and field messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json(400, {
        error: { code: "validation_error", message: "Some fields are invalid", fields: { email: "Invalid email" } },
      }),
    );
    const err = await request("/api/x", { method: "POST", body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: "validation_error", fields: { email: "Invalid email" } });
  });

  it("retries a GET that fails with a network error, then succeeds", async () => {
    vi.useFakeTimers();
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(json(200, { n: 1 }));
    const p = request<{ n: number }>("/api/x");
    await vi.advanceTimersByTimeAsync(400);
    await expect(p).resolves.toEqual({ n: 1 });
    expect(spy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("never retries a POST (it could be submitted twice)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    await expect(request("/api/x", { method: "POST", body: {} })).rejects.toMatchObject({ status: 0 });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

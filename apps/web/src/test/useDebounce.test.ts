import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "../hooks/useDebounce";
import { debounce } from "../lib/debounce";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDebounce", () => {
  it("only updates after the value stops changing", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), { initialProps: { v: "a" } });
    rerender({ v: "re" });
    rerender({ v: "rea" });
    rerender({ v: "react" });
    expect(result.current).toBe("a"); // still the old value: nothing has settled yet
    act(() => void vi.advanceTimersByTime(299));
    expect(result.current).toBe("a");
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe("react"); // exactly one update, to the LAST value
  });
});

describe("debounce()", () => {
  it("calls the function once, with the last arguments", () => {
    const fn = vi.fn();
    const d = debounce(fn, 200);
    d("a");
    d("b");
    d("c");
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("can be cancelled", () => {
    const fn = vi.fn();
    const d = debounce(fn, 200);
    d();
    d.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });
});

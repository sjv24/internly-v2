import { useEffect, useState } from "react";

/**
 * Returns `value`, but only after it has stopped changing for `delayMs`.
 * Typing "react" fires 5 keystrokes but only ONE search, 300 ms after the last one.
 * The cleanup function cancels the previous timer on every change - that is the whole trick.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

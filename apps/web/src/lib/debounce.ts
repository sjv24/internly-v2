/**
 * debounce(fn, ms): a plain-JavaScript version of the same idea (no React).
 * Written from scratch to show the mechanics: a CLOSURE keeps `timer` alive between calls,
 * and every new call cancels the pending one and starts the clock again.
 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

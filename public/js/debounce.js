/**
 * debounce(fn, ms): returns a version of `fn` that waits until calls stop for `ms` milliseconds.
 * Typing "react" fires 5 keystrokes but only ONE search, 300 ms after the last one.
 *
 * The key idea is a CLOSURE: the inner function remembers `timer` between calls. Every new call
 * cancels the pending timer and starts the clock again.
 */
export function debounce(fn, delayMs) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

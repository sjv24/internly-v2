import { useEffect, useState } from "react";
import { useDebounce } from "../hooks/useDebounce";

interface Props {
  /** the value currently applied (from the URL) */
  value: string;
  onSearch: (q: string) => void;
  delayMs?: number;
}

/**
 * Controlled input + debounce. The text box updates instantly (local state), but `onSearch`
 * - which triggers a network request - only fires 300 ms after the user stops typing.
 */
export function SearchBar({ value, onSearch, delayMs = 300 }: Props) {
  const [text, setText] = useState(value);
  const debounced = useDebounce(text, delayMs);

  // fire the search when the debounced value settles (and differs from what is applied)
  useEffect(() => {
    if (debounced.trim() !== value) onSearch(debounced.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced text
  }, [debounced]);

  // keep the box in sync if the URL changes from elsewhere (back button, "clear filters")
  useEffect(() => setText(value), [value]);

  return (
    <div role="search" className="flex-1">
      <label htmlFor="search" className="sr-only">
        Search internships by title, company or skill
      </label>
      <input
        id="search"
        type="search"
        className="input py-2.5"
        placeholder="Search by title, company or skill…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
      />
    </div>
  );
}

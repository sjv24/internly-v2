import { useEffect } from "react";

/** Sets the browser tab title (and what screen readers announce on navigation) for the current page. */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | Internly` : "Internly - find your next internship";
  }, [title]);
}

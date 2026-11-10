import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../lib/api";

export interface ApiData<T> {
  data: T | null;
  /** true during the very first load */
  loading: boolean;
  /** true on any (re)load - use it to dim old results while new ones arrive */
  fetching: boolean;
  error: ApiError | null;
  reload: () => void;
  /** update the cached data locally (optimistic UI) */
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Generic "GET this URL and track loading / error / data" hook. Every list screen needs the same
 * four states, so we write the logic once:
 *  - AbortController cancels the in-flight request when `url` changes or the component unmounts,
 *    so a slow OLD response can never overwrite a newer one (a classic race condition).
 *  - pass url = null to skip fetching.
 */
export function useApiData<T>(url: string | null): ApiData<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [fetching, setFetching] = useState(url !== null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (url === null) {
      setFetching(false);
      return;
    }
    const controller = new AbortController();
    setFetching(true);
    setError(null);
    api
      .get<T>(url, controller.signal)
      .then((d) => {
        setData(d);
        setFetching(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return; // superseded by a newer request: ignore
        setError(err instanceof ApiError ? err : new ApiError(0, "unknown", "Unexpected error"));
        setFetching(false);
      });
    return () => controller.abort();
  }, [url, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading: fetching && data === null, fetching, error, reload, setData };
}

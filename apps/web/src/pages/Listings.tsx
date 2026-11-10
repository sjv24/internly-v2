import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { workTypeSchema } from "@internly/shared";
import type { WorkType } from "@internly/shared";
import { ListingList } from "../components/ListingList";
import { Pagination } from "../components/Pagination";
import { SearchBar } from "../components/SearchBar";
import { SelectField } from "../components/FormField";
import { useApiData } from "../hooks/useApiData";
import { useListings } from "../hooks/useListings";
import { WORK_TYPE_LABEL } from "../lib/format";
import { usePageTitle } from "../hooks/usePageTitle";

/**
 * The filters live in the URL (?q=react&location=Dubai&page=2), not in component state:
 *  - the browser Back button and refreshing work,
 *  - a search can be shared as a link,
 *  - there is a single source of truth.
 */
export default function Listings() {
  usePageTitle("Find internships");
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const location = params.get("location") ?? "";
  const workTypeParsed = workTypeSchema.safeParse(params.get("workType"));
  const workType: WorkType | "" = workTypeParsed.success ? workTypeParsed.data : "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const { data, loading, fetching, error, reload } = useListings({ q, location, workType, page });
  const locations = useApiData<{ locations: string[] }>("/api/listings/locations");

  const update = useCallback(
    (changes: Record<string, string | null>, resetPage = true) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (resetPage) next.delete("page");
        return next;
      });
    },
    [setParams],
  );
  const onSearch = useCallback((value: string) => update({ q: value || null }), [update]);

  const hasFilters = Boolean(q || location || workType);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy">Find your internship</h1>

      <form
        role="search"
        aria-label="Filters"
        className="mt-6 flex flex-col gap-3 md:flex-row md:items-end"
        onSubmit={(e) => e.preventDefault()}
      >
        <SearchBar value={q} onSearch={onSearch} />
        <div className="md:w-48">
          <SelectField label="Location" value={location} onChange={(e) => update({ location: e.target.value || null })}>
            <option value="">All locations</option>
            {locations.data?.locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="md:w-40">
          <SelectField label="Type" value={workType} onChange={(e) => update({ workType: e.target.value || null })}>
            <option value="">All types</option>
            {workTypeSchema.options.map((w) => (
              <option key={w} value={w}>
                {WORK_TYPE_LABEL[w]}
              </option>
            ))}
          </SelectField>
        </div>
        {hasFilters && (
          <button type="button" className="btn-secondary" onClick={() => setParams({})}>
            Clear
          </button>
        )}
      </form>

      {/* aria-live: screen readers announce the new result count after every search */}
      <p className="mt-4 text-sm text-slate-500" aria-live="polite">
        {data ? `${data.total} internship${data.total === 1 ? "" : "s"} found` : " "}
      </p>

      <div className="mt-4">
        <ListingList listings={data?.items} loading={loading} fetching={fetching} error={error} onRetry={reload} />
      </div>
      {data && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          onPage={(p) => {
            update({ page: String(p) }, false);
            window.scrollTo({ top: 0 });
          }}
        />
      )}
    </div>
  );
}

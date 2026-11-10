import type { Listing, Page, WorkType } from "@internly/shared";
import { useApiData } from "./useApiData";

export interface ListingFilters {
  q: string;
  location: string;
  workType: WorkType | "";
  page: number;
  pageSize?: number;
}

/** Builds /api/listings?... from the filters (empty values are left out) and fetches it. */
export function useListings(filters: ListingFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.location) params.set("location", filters.location);
  if (filters.workType) params.set("workType", filters.workType);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize ?? 9));
  return useApiData<Page<Listing>>(`/api/listings?${params.toString()}`);
}

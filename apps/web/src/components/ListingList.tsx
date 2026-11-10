import type { Listing } from "@internly/shared";
import type { ApiError } from "../lib/api";
import { ListingCard } from "./ListingCard";
import { EmptyState, ErrorMessage, SkeletonGrid } from "./States";

interface Props {
  listings: Listing[] | undefined;
  loading: boolean;
  fetching: boolean;
  error: ApiError | null;
  onRetry: () => void;
}

/** Decides which of the four states to show: loading / error / empty / list. */
export function ListingList({ listings, loading, fetching, error, onRetry }: Props) {
  if (loading) return <SkeletonGrid />;
  if (error && !listings) return <ErrorMessage error={error} onRetry={onRetry} />;
  if (!listings || listings.length === 0) {
    return (
      <EmptyState title="No internships match your search">
        Try a different keyword, or clear the location and type filters.
      </EmptyState>
    );
  }
  return (
    <>
      {error && (
        <div className="mb-4">
          <ErrorMessage error={error} onRetry={onRetry} />
        </div>
      )}
      {/* dim the old results while new ones load instead of flashing an empty page */}
      <ul className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${fetching ? "opacity-60" : ""}`} aria-busy={fetching}>
        {listings.map((l) => (
          // key = a stable unique id, so React can match old and new items and only touch what changed
          <li key={l.id} className="relative">
            <ListingCard listing={l} />
          </li>
        ))}
      </ul>
    </>
  );
}

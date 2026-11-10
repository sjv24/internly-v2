interface Props {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, totalPages, onPage }: Props) {
  if (totalPages <= 1) return null;

  // show: 1 ... (page-1) page (page+1) ... last
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      {sorted.map((p, i) => (
        <span key={p} className="flex items-center gap-2">
          {i > 0 && p - sorted[i - 1] > 1 && (
            <span aria-hidden className="text-slate-400">
              …
            </span>
          )}
          <button
            type="button"
            onClick={() => onPage(p)}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Page ${p}`}
            className={`h-10 w-10 rounded-full text-sm font-semibold ${
              p === page ? "bg-navy text-white" : "bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {p}
          </button>
        </span>
      ))}
      <button type="button" className="btn-secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}

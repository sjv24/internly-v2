import { memo } from "react";
import { Link } from "react-router";
import type { Listing } from "@internly/shared";
import { WORK_TYPE_LABEL, formatDate } from "../lib/format";

interface Props {
  listing: Listing;
}

/**
 * One internship card. Plain, presentational component: data in via props, nothing else.
 * Text is rendered as {text} (never innerHTML), so React escapes it: a malicious description like
 * "<script>..." is shown as harmless text. That is the structural fix for v1's XSS bug.
 * memo(): skip re-rendering when the same listing object comes in again (e.g. while typing in
 * the search box), since every card on screen would otherwise redraw on each keystroke.
 */
export const ListingCard = memo(function ListingCard({ listing }: Props) {
  return (
    <article className="card flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-sm font-medium text-brand">{listing.companyName}</p>
      <h3 className="mt-1 text-lg font-semibold text-navy">
        <Link to={`/listings/${listing.id}`} className="after:absolute after:inset-0 hover:underline">
          {listing.title}
        </Link>
      </h3>
      <ul className="mt-3 flex flex-wrap gap-2 text-xs">
        <li className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{listing.location}</li>
        <li className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{WORK_TYPE_LABEL[listing.workType]}</li>
        <li className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{listing.duration}</li>
      </ul>
      <p className="mt-3 line-clamp-3 flex-1 text-sm text-slate-600">{listing.description}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {listing.skills.slice(0, 4).map((s) => (
          <span key={s} className="rounded bg-sky/30 px-2 py-0.5 text-xs font-medium text-navy">
            {s}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {listing.deadline ? `Apply by ${formatDate(listing.deadline)}` : "Open until filled"}
      </p>
    </article>
  );
});

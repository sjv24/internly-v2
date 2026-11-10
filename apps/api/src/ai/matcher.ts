import type { Listing } from "@internly/shared";

/*
 * STEP 1 of the CV matcher: retrieval + scoring. No AI involved.
 * This is a deliberately boring, deterministic algorithm, so the SCORE is something a user
 * (and an engineer) can verify: "you have 3 of the 4 skills this listing asks for".
 * The language model is only used afterwards to EXPLAIN the result in words.
 * (Same pattern as RAG: retrieve candidates with cheap, reliable code, then let the model
 * write about facts it was handed instead of letting it invent them.)
 */

export interface Candidate {
  listing: Listing;
  score: number; // 0-100
  matchedSkills: string[];
  missingSkills: string[];
}

const STOPWORDS = new Set([
  "intern",
  "internship",
  "junior",
  "summer",
  "with",
  "and",
  "the",
  "for",
  "team",
  "trainee",
  "assistant",
]);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Does `text` contain `term` as a whole word? ("java" must not match "javascript"; "c++" works.) */
export function containsTerm(text: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  return new RegExp(`(^|[^a-z0-9+#])${escapeRegExp(t)}($|[^a-z0-9+#])`).test(text);
}

export function scoreListing(cvLower: string, listing: Listing): Candidate {
  const matchedSkills = listing.skills.filter((s) => containsTerm(cvLower, s));
  const missingSkills = listing.skills.filter((s) => !containsTerm(cvLower, s));

  // 85 points for skill coverage, 15 for the job-title words appearing in the CV
  const skillPart = listing.skills.length ? matchedSkills.length / listing.skills.length : 0;
  const titleWords = (listing.title.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOPWORDS.has(w));
  const titlePart = titleWords.length
    ? titleWords.filter((w) => containsTerm(cvLower, w)).length / titleWords.length
    : 0;

  return {
    listing,
    score: Math.round(skillPart * 85 + titlePart * 15),
    matchedSkills,
    missingSkills,
  };
}

export function rankListings(cvText: string, listings: Listing[], limit = 5): Candidate[] {
  const cvLower = cvText.toLowerCase();
  return listings
    .map((l) => scoreListing(cvLower, l))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || b.listing.id - a.listing.id)
    .slice(0, limit);
}

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
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Does `text` contain `term` as a whole word? ("java" must not match "javascript"; "c++" works.) */
export function containsTerm(text, term) {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  return new RegExp(`(^|[^a-z0-9+#])${escapeRegExp(t)}($|[^a-z0-9+#])`).test(text);
}
export function scoreListing(cvLower, listing) {
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
export function rankListings(cvText, listings, limit = 5) {
  const cvLower = cvText.toLowerCase();
  return listings
    .map((l) => scoreListing(cvLower, l))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || b.listing.id - a.listing.id)
    .slice(0, limit);
}

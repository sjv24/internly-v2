import { api } from "../api.js";
import { listingCard, pagination } from "../components.js";
import { debounce } from "../debounce.js";
import { $, emptyState, errorBox, h, setContent, skeletonGrid } from "../dom.js";
import { initPage } from "../layout.js";

await initPage({ title: "Find internships" });

/*
 * The filters live in the URL (?q=react&location=Dubai&page=2), not just in JavaScript variables:
 * the Back button and refresh work, and a search can be shared as a link.
 */
const WORK_TYPES = ["on-site", "remote", "hybrid"];
const form = $("#filters");
let state = readUrl();
let controller; // lets us cancel an in-flight request when a newer one starts

function readUrl() {
  const p = new URLSearchParams(location.search);
  const workType = p.get("workType");
  return {
    q: p.get("q") ?? "",
    location: p.get("location") ?? "",
    workType: WORK_TYPES.includes(workType) ? workType : "",
    page: Math.max(1, Number(p.get("page")) || 1),
  };
}

function writeUrl(push) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) if (v && !(k === "page" && v === 1)) p.set(k, v);
  const url = p.toString() ? `?${p}` : location.pathname;
  history[push ? "pushState" : "replaceState"](null, "", url);
}

function syncControls() {
  form.elements.q.value = state.q;
  form.elements.location.value = state.location;
  form.elements.workType.value = state.workType;
}

async function load() {
  controller?.abort(); // a slow OLD response must never overwrite a newer one (race condition)
  controller = new AbortController();
  const { signal } = controller;

  const results = $("#results");
  const firstLoad = !results.firstChild;
  if (firstLoad) setContent(results, skeletonGrid());
  else results.firstChild.classList?.add("is-loading"); // dim old results instead of flashing blank

  const params = new URLSearchParams({ page: state.page, pageSize: 9 });
  for (const k of ["q", "location", "workType"]) if (state[k]) params.set(k, state[k]);

  try {
    const data = await api.get(`/api/listings?${params}`, signal);
    $("#count").textContent = `${data.total} internship${data.total === 1 ? "" : "s"} found`;
    if (data.items.length === 0) {
      setContent(
        results,
        emptyState("No internships match your search", "Try a different keyword, or clear the filters."),
      );
    } else {
      setContent(results, h("ul", { class: "card-grid" }, data.items.map(listingCard)));
    }
    setContent(
      $("#pager"),
      pagination(data.page, data.totalPages, (p) => {
        state.page = p;
        writeUrl(true);
        load();
        scrollTo({ top: 0 });
      }),
    );
  } catch (err) {
    if (signal.aborted) return; // superseded by a newer request: ignore
    setContent(results, errorBox(err.message, load));
    $("#count").textContent = "";
  }
}

/** Something about the search changed: go back to page 1 and reload. */
function applyFilters(changes) {
  state = { ...state, ...changes, page: 1 };
  writeUrl(true);
  load();
}

// Debounced search: one request 300 ms after the user stops typing, not one per keystroke.
const searchSoon = debounce((value) => applyFilters({ q: value.trim() }), 300);
form.elements.q.addEventListener("input", (e) => searchSoon(e.target.value));
form.elements.location.addEventListener("change", (e) => applyFilters({ location: e.target.value }));
form.elements.workType.addEventListener("change", (e) => applyFilters({ workType: e.target.value }));
$("#clear").addEventListener("click", () => {
  searchSoon.cancel();
  state = { q: "", location: "", workType: "", page: 1 };
  syncControls();
  writeUrl(true);
  load();
});
form.addEventListener("submit", (e) => e.preventDefault());
addEventListener("popstate", () => {
  state = readUrl();
  syncControls();
  load();
});

// fill the location dropdown, then show the first page
syncControls();
load();
try {
  const { locations } = await api.get("/api/listings/locations");
  const select = form.elements.location;
  for (const l of locations) select.append(h("option", { value: l }, l));
  select.value = state.location;
} catch {
  /* the filter just stays "All locations" */
}

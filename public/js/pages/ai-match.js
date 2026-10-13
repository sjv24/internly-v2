import { ApiError, errorMessage } from "../api.js";
import { streamAiMatch } from "../ai-stream.js";
import { $, h, setContent, showFieldErrors } from "../dom.js";
import { initPage } from "../layout.js";

const user = await initPage({ title: "AI CV match", role: "student" });
if (!user) throw new Error("not allowed");

const form = $("#cv-form");
const startBtn = $("#start");
const stopBtn = $("#stop");
const matches = $("#matches");
let controller; // lets the Stop button cancel the request
const cards = new Map(); // listingId -> the elements we update as the stream arrives
let provider = "";

function setRunning(running) {
  startBtn.disabled = running;
  startBtn.textContent = running ? "Matching…" : "Find my matches";
  stopBtn.classList.toggle("hidden", !running);
  form.elements.cvText.disabled = running;
  $("#output").setAttribute("aria-busy", String(running));
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cvText = form.elements.cvText.value.trim();
  if (cvText.length < 50)
    return showFieldErrors(form, { cvText: "Paste at least a few lines of your CV (50+ characters)." });
  showFieldErrors(form);

  // reset the screen for a new run
  cards.clear();
  setContent(matches);
  setContent($("#status"));
  $("#provider-note").classList.add("hidden");
  controller = new AbortController();
  setRunning(true);

  try {
    await streamAiMatch(cvText, controller.signal, handleEvent);
  } catch (err) {
    if (controller.signal.aborted) {
      setContent(
        $("#status"),
        h("p", { class: "muted" }, `Stopped. Showing the ${cards.size} result(s) received so far.`),
      );
    } else {
      setContent(
        $("#status"),
        h(
          "div",
          { class: "alert", role: "alert" },
          err instanceof ApiError ? err.message : errorMessage(err),
        ),
      );
    }
  } finally {
    setRunning(false);
  }
});

stopBtn.addEventListener("click", () => controller?.abort());

/** One function decides what each streamed event does to the screen. */
function handleEvent(event) {
  switch (event.type) {
    case "start":
      provider = event.provider;
      $("#provider-note").textContent =
        `Explanations by: ${provider === "offline" ? "built-in offline writer (no API key configured)" : provider}`;
      $("#provider-note").classList.remove("hidden");
      break;
    case "match":
      addCard(event);
      break;
    case "reason_delta":
      cards.get(event.listingId)?.reason.append(document.createTextNode(event.text)); // text only, never HTML
      break;
    case "reason_done": {
      const card = cards.get(event.listingId);
      card?.cursor.remove();
      if (card && event.source === "template" && provider !== "offline") {
        card.root.append(
          h(
            "p",
            { class: "muted", style: "color:#b45309;margin:.5rem 0 0" },
            "The AI was unavailable, so this explanation was generated from your matched skills.",
          ),
        );
      }
      break;
    }
    case "done":
      if (cards.size === 0)
        setContent(
          $("#status"),
          h(
            "p",
            { class: "card empty" },
            "No strong matches found. Try adding more skills and tools to your CV.",
          ),
        );
      break;
    case "error":
      setContent($("#status"), h("div", { class: "alert", role: "alert" }, event.message));
      break;
  }
}

function addCard(e) {
  const fill = h("div", { class: "meter__fill", style: "transform:scaleX(0)" });
  const reason = h("span");
  const cursor = h("span", { class: "cursor", "aria-hidden": "true" });
  const root = h(
    "li",
    { class: "card match-card" },
    h(
      "div",
      { class: "match-card__head" },
      h(
        "div",
        {},
        h("p", { class: "muted", style: "margin:0" }, `#${cards.size + 1}`),
        h("h2", {}, h("a", { href: `/listing?id=${e.listing.id}` }, e.listing.title)),
        h("p", { class: "muted", style: "margin:0" }, `${e.listing.companyName} · ${e.listing.location}`),
      ),
      h(
        "div",
        { class: "score", "aria-label": `Match score ${e.score} out of 100` },
        h("strong", {}, String(e.score)),
        h("span", { class: "muted" }, "/ 100"),
      ),
    ),
    h("div", { class: "meter", "aria-hidden": "true" }, fill),
    h(
      "div",
      { class: "chips" },
      e.matchedSkills.map((s) => h("span", { class: "chip chip--match" }, `✓ ${s}`)),
      e.missingSkills.map((s) => h("span", { class: "chip" }, `✗ ${s}`)),
    ),
    h("p", { style: "margin:.75rem 0 0" }, reason, cursor),
  );
  matches.append(root);
  cards.set(e.listing.id, { root, reason, cursor });
  // Reading a layout property forces the browser to apply scaleX(0) first, so changing it next
  // animates (a transition needs a "before" state). Unlike requestAnimationFrame this still works
  // when the tab is in the background.
  fill.getBoundingClientRect();
  fill.style.transform = `scaleX(${e.score / 100})`;
}

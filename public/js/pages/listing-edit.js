import { api, ApiError, errorMessage } from "../api.js";
import { $, h, setContent, showFieldErrors, spinner } from "../dom.js";
import { initPage } from "../layout.js";

const user = await initPage({ title: "Internship editor", role: "company" });
if (!user) throw new Error("not allowed");

// One page for BOTH "new" and "edit": the presence of ?id= decides.
const id = new URLSearchParams(location.search).get("id");
const editing = id !== null;
const form = $("#listing-form");

if (editing) {
  $("#page-heading").textContent = "Edit internship";
  $("#save").textContent = "Save changes";
  form.classList.add("hidden");
  setContent($("#load-state"), spinner());
  try {
    const { listing } = await api.get(`/api/listings/${encodeURIComponent(id)}`);
    for (const [name, value] of Object.entries({
      title: listing.title,
      location: listing.location,
      workType: listing.workType,
      duration: listing.duration,
      stipend: listing.stipend,
      openings: listing.openings,
      skills: listing.skills.join(", "),
      startDate: listing.startDate ?? "",
      deadline: listing.deadline ?? "",
      description: listing.description,
    })) {
      form.elements[name].value = value;
    }
    form.classList.remove("hidden");
    setContent($("#load-state"));
  } catch (err) {
    setContent($("#load-state"), h("div", { class: "alert", role: "alert" }, errorMessage(err)));
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setContent($("#form-error"));
  showFieldErrors(form);
  const v = (name) => form.elements[name].value.trim();
  const body = {
    title: v("title"),
    description: v("description"),
    location: v("location"),
    workType: v("workType"),
    duration: v("duration"),
    stipend: v("stipend"),
    skills: v("skills")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean), // "React, SQL" -> ["React", "SQL"]
    openings: Number(v("openings")) || 1,
    startDate: v("startDate") || null,
    deadline: v("deadline") || null,
  };
  const button = $("#save");
  button.disabled = true;
  try {
    if (editing) await api.put(`/api/listings/${encodeURIComponent(id)}`, body);
    else await api.post("/api/listings", body);
    location.assign("/company/listings");
  } catch (err) {
    button.disabled = false;
    setContent($("#form-error"), h("div", { class: "alert", role: "alert" }, errorMessage(err)));
    if (err instanceof ApiError && err.fields) showFieldErrors(form, err.fields); // server says which field is wrong
  }
});

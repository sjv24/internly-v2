import { api, ApiError, errorMessage } from "../api.js";
import { forgetUser } from "../auth.js";
import { $, h, setContent, showFieldErrors } from "../dom.js";
import { initPage } from "../layout.js";

// role "any": any logged-in user may open this page (anonymous visitors are sent to /login)
const user = await initPage({ title: "Account", role: "any" });
if (!user) throw new Error("not allowed");

$("#signed-in-as").textContent = `Signed in as ${user.email} (${user.role})`;
$("#name-label").textContent = user.role === "company" ? "Company name" : "Full name";

const profile = $("#profile-form");
profile.elements.name.value = user.name;
profile.addEventListener("submit", async (e) => {
  e.preventDefault();
  showFieldErrors(profile);
  const body = { name: profile.elements.name.value.trim() };
  if (profile.elements.newPassword.value) {
    body.currentPassword = profile.elements.currentPassword.value;
    body.newPassword = profile.elements.newPassword.value;
  }
  try {
    await api.patch("/api/account", body);
    forgetUser();
    profile.elements.currentPassword.value = "";
    profile.elements.newPassword.value = "";
    setContent($("#profile-msg"), h("div", { class: "alert alert--success", role: "status" }, "Saved."));
  } catch (err) {
    setContent($("#profile-msg"), h("div", { class: "alert", role: "alert" }, errorMessage(err)));
    if (err instanceof ApiError && err.fields) showFieldErrors(profile, err.fields);
  }
});

const del = $("#delete-form");
del.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!confirm("Delete your account permanently? This cannot be undone.")) return;
  try {
    await api.delete("/api/account", { password: del.elements.password.value });
    forgetUser();
    location.assign("/");
  } catch (err) {
    setContent($("#delete-msg"), h("div", { class: "alert", role: "alert" }, errorMessage(err)));
  }
});

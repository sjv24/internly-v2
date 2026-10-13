import { api, ApiError, errorMessage } from "../api.js";
import { forgetUser, homeFor, safeNext } from "../auth.js";
import { $, h, setContent, showFieldErrors } from "../dom.js";
import { initPage } from "../layout.js";

const user = await initPage({ title: "Log in" });
if (user) location.replace(safeNext(homeFor(user))); // already logged in

if (["localhost", "127.0.0.1"].includes(location.hostname)) $("#demo-hint").classList.remove("hidden");

const form = $("#login-form");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setContent($("#form-error"));
  showFieldErrors(form);
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Logging in…";
  try {
    const { user } = await api.post("/api/auth/login", {
      email: form.elements.email.value,
      password: form.elements.password.value,
    });
    forgetUser();
    location.assign(safeNext(homeFor(user)));
  } catch (err) {
    button.disabled = false;
    button.textContent = "Log in";
    setContent($("#form-error"), h("div", { class: "alert", role: "alert" }, errorMessage(err)));
    if (err instanceof ApiError && err.fields) showFieldErrors(form, err.fields);
  }
});

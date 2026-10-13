import { api, ApiError, errorMessage } from "../api.js";
import { forgetUser, homeFor } from "../auth.js";
import { $, $$, h, setContent, showFieldErrors } from "../dom.js";
import { initPage } from "../layout.js";

const user = await initPage({ title: "Sign up" });
if (user) location.replace(homeFor(user));

const forms = { student: $("#student-form"), company: $("#company-form") };

// show the form that matches the chosen role
for (const radio of $$("input[name=role]")) {
  radio.addEventListener("change", () => {
    setContent($("#form-error"));
    for (const [role, form] of Object.entries(forms)) form.classList.toggle("hidden", role !== radio.value);
  });
}

for (const [role, form] of Object.entries(forms)) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setContent($("#form-error"));
    showFieldErrors(form);

    // Native browser validation first (required, type=email, minlength...) for instant feedback;
    // the server re-validates everything anyway because the browser can be bypassed.
    if (!form.checkValidity()) {
      const fields = {};
      for (const input of form.elements)
        if (input.name && !input.validity.valid) fields[input.name] = input.validationMessage;
      return showFieldErrors(form, fields);
    }

    const body = Object.fromEntries(new FormData(form)); // { name: "...", email: "...", ... }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const { user } = await api.post(`/api/auth/signup/${role}`, body);
      forgetUser();
      location.assign(homeFor(user));
    } catch (err) {
      button.disabled = false;
      setContent($("#form-error"), h("div", { class: "alert", role: "alert" }, errorMessage(err)));
      if (err instanceof ApiError && err.fields) showFieldErrors(form, err.fields); // server-side field errors
    }
  });
}

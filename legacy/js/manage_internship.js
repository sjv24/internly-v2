// manage-internship.js
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const internshipId = urlParams.get("id");

  const form = document.getElementById("manage-internship-form");
  const deleteBtn = document.getElementById("deleteBtn");

  // Load internship data
  fetch("/internships")
    .then(res => res.json())
    .then(data => {
      const internship = data.find(i => i.i_id == internshipId);
      if (!internship) {
        document.getElementById("msg").innerText = "Internship not found";
        return;
      }

        document.getElementById("i_id").value = internship.i_id;
        document.getElementById("title").value = internship.i_title;
        document.getElementById("location").value = internship.i_location;
        document.getElementById("type").value = internship.i_type;
        document.getElementById("duration").value = internship.i_duration;
        document.getElementById("openings").value = internship.i_openings;
        document.getElementById("stipend").value = internship.i_stipend;
        document.getElementById("skills").value = internship.i_skills;
        document.getElementById("description").value = internship.i_description;
        });

  // Handle update
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const body = new URLSearchParams({
        id: internshipId,
        title: form.title.value,
        location: form.location.value,
        type: form.type.value,
        duration: form.duration.value,
        openings: form.openings.value,
        stipend: form.stipend.value,
        skills: form.skills.value,
        description: form.description.value,
    });

    fetch("/update-internship", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    })
    .then(res => res.text())
    .then(msg => {
      document.getElementById("msg").innerText = msg;
    });
  });

  // Handle delete
  deleteBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete this internship?")) {
      fetch("/delete-internship", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `id=${internshipId}`
      })
      .then(res => res.text())
      .then(msg => {
        alert(msg);
        window.location.href = "company_internship.html";
      });
    }
  });
});

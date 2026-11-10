document.addEventListener("DOMContentLoaded", () => {
  populateInternshipDropdown(); // Load internships and trigger application fetch
});

function populateInternshipDropdown() {
  fetch('/session-data')
    .then(res => res.json())
    .then(session => {
      const companyName = session.username || "";

      fetch("/internships")
        .then(res => res.json())
        .then(data => {
          const filtered = data.filter(intern =>
            intern.c_name.toLowerCase() === companyName.toLowerCase()
          );

          const dropdown = document.getElementById("internship-filter");
          filtered.forEach(intern => {
            const option = document.createElement("option");
            option.value = intern.i_title;
            option.textContent = intern.i_title;
            dropdown.appendChild(option);
          });

          fetchApplications(); // Load apps after internships ready
        });
    })
    .catch(err => console.error("Error loading internships:", err));
}

function fetchApplications() {
  fetch("/company/applications")
    .then(res => res.json())
    .then(applications => {
      const internshipTitle = document.getElementById("internship-filter").value;
      const status = document.getElementById("status-filter").value;

      let filtered = applications;

      if (internshipTitle !== "All") {
        filtered = filtered.filter(app => app.i_title === internshipTitle);
      }

      if (status !== "All") {
        filtered = filtered.filter(app => app.status === status);
      }

      const container = document.getElementById("companies-review-applications");
      if (filtered.length === 0) {
        container.innerHTML = `<p class="none">No applications found for the selected filter.</p>`;
        return;
      }

      container.innerHTML = filtered.map(app => `
        <div class="application-card">
          <h2>${app.i_title}</h2>
          <p><strong>Student:</strong> ${app.s_name}</p>
          <p><strong>University:</strong> ${app.s_uni}</p>
          <p><strong>Email:</strong> ${app.s_email}</p>
          <p><strong>Personal Link:</strong> ${app.s_website} </p>
          <p><strong>Status:</strong>
            <select onchange="updateStatus(${app.app_id}, this.value)">
              <option value="Pending" ${app.status === "Pending" ? "selected" : ""}>Pending</option>
              <option value="Accepted" ${app.status === "Accepted" ? "selected" : ""}>Accepted</option>
              <option value="Rejected" ${app.status === "Rejected" ? "selected" : ""}>Rejected</option>
            </select>
          </p>
          <p><strong>Applied on:</strong> ${new Date(app.app_date).toLocaleDateString()}</p>
          <p><strong>Resume:</strong> 
            <a href="/uploads/resume-${app.app_id}-${app.s_email}.pdf" target="_blank">View Resume</a>
          </p>
        </div>
      `).join("");
    });
}

function filterApplications() {
  fetchApplications();
}

function updateStatus(appId, newStatus) {
  fetch("/company/applications/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, status: newStatus })
  })
  .then(res => res.text())
  .then(msg => {
    console.log(msg);
  })
  .catch(err => console.error("Update error", err));
}

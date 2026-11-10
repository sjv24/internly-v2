fetch("/student/applications")
  .then(response => response.json())
  .then(applications => {
    console.log("Applications from server:", applications);  // ADD THIS

    const container = document.getElementById("student-applications");

    if (!Array.isArray(applications) || applications.length === 0) {
      container.innerHTML = "<p>You have not applied to any internships yet.</p>";
      return;
    }

    let html = applications.map(app => `
      <div class="application-card">
        <h2>${app.i_title}</h2>
        <h3>${app.c_name}</h3>
        <p><strong>Status:</strong> ${app.status === "Accepted" ? `<p>Accepted, <br>You will be contacted shortly regarding the next steps.</p>` : app.status}</p>
        <p><strong>Applied on:</strong> ${new Date(app.app_date).toLocaleDateString()}</p>
        <p>${app.i_description.substring(0, 150)}...</p>
      </div>
    `).join("");

    container.innerHTML = html;
  })
  .catch(err => {
    console.error("Failed to load applications", err);
    document.getElementById("student-applications").innerHTML = "<p>Error loading applications.</p>";
  });

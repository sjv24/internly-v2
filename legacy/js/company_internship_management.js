function fetchSession() {
  return fetch('/session-data')
    .then(res => {
      if (!res.ok) throw new Error("Failed to fetch session data");
      return res.json();
    });
}

function fetchAndDisplayInternships() {
  fetchSession().then(session => {
    const companyName = session.username || "";

    fetch("/internships")
      .then(response => response.json())
      .then(data => {
        const container = document.getElementById("internship-container");
        container.innerHTML = "";

        const filtered = data.filter(internship =>
          internship.c_name.toLowerCase().includes(companyName.toLowerCase())
        );

        if (filtered.length === 0) {
          container.innerHTML = `<p class="none">You dont have any internships yet</p>`;
          return;
        }

        let cardsHTML = "";
        filtered.forEach(intern => {
          cardsHTML += `
            <div class="internship-card">
              <div class="card-content">
                <h3>${intern.i_title}</h3><br>
                <ul>
                  <li><strong>Type:</strong> ${intern.i_type}</li>
                  <li><strong>Location:</strong> ${intern.i_location}</li>
                  <li><strong>Category:</strong> ${intern.i_category || "General"}</li>
                </ul>
                <p>${intern.i_description.replace(/\r\n/g, "<br>")}</p>
                <div class="btn-group">
                  <a href="companies-manage-internship.html?id=${intern.i_id}" class="visit-btn">Manage</a>
                </div>
              </div>
            </div>
          `;
        });

        container.innerHTML = cardsHTML;
      })
      .catch(error => {
        console.error("Error loading internships:", error);
      });
  })
  .catch(err => {
    console.error("Error loading session data:", err);
  });
}

// Auto-run when DOM ready
document.addEventListener("DOMContentLoaded", () => {
  fetchAndDisplayInternships();
});

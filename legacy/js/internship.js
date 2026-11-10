  function fetchAndDisplayInternships(searchTerm = "", location = "", type = "") {
   fetch("/internships") 
      .then(response => response.json())
      .then(data => {
        const container = document.getElementById("internship-container");
        container.innerHTML = "";

        const filtered = data.filter(internship => {
          const titleMatch = internship.i_title.toLowerCase().includes(searchTerm.toLowerCase());
          const skillMatch = internship.c_name.toLowerCase().includes(searchTerm.toLowerCase());
          const locationMatch = location === "" || internship.i_location === location;
          const typeMatch = type === "" || internship.i_type.toLowerCase() === type.toLowerCase();

          return (titleMatch || skillMatch) && locationMatch && typeMatch;
        });

        if (filtered.length === 0) {
          container.innerHTML = "<p>No internships found matching your criteria.</p>";
          return;
        }

        filtered.forEach(intern => {
          const cardHTML = `
            <div class="internship-card">
              <div class="card-content">
                <h2>${intern.c_name}</h2>
                <h3>${intern.i_title}</h3><br>
                <ul>
                  <li><strong>Type:</strong> ${intern.i_type}</li>
                  <li><strong>Location:</strong> ${intern.i_location}</li>
                  <li><strong>Category:</strong> ${intern.i_category || "General"}</li>
                </ul>
                <p>${intern.i_description.replace(/\r\n/g, "<br>")}</p>
                <div class="btn-group">
                  <a href="student-apply.html?id=${intern.i_id}" class="visit-btn">Apply Now</a>
                </div>
              </div>
            </div>
          `;
          container.innerHTML += cardHTML;  // Append each card
        });
      })
      .catch(error => {
        console.error("Error loading internships:", error);
      });
  }

  function applyFilters() {
    const searchTerm = document.getElementById("searchInput").value.trim();
    const location = document.getElementById("locationFilter").value;
    const type = document.getElementById("typeFilter").value;  // Grab type filter value
    fetchAndDisplayInternships(searchTerm, location, type);
  }



  // Initial load
  document.addEventListener("DOMContentLoaded", function () {
    fetchAndDisplayInternships(); // auto-runs when DOM is ready
  });


document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const internshipId = urlParams.get("id");

  if (!internshipId) {
    document.getElementById("internship-details").innerHTML = "<p>Invalid internship ID.</p>";
    return;
  }

  fetch(`/internship?id=${internshipId}`)
    .then(res => {
      if (!res.ok) throw new Error("Failed to fetch internship");
      return res.json();
    })
    .then(internship => {
      document.getElementById("internship-details").innerHTML = `
        <h2>${internship.i_title}</h2>
        <h3>Company: ${internship.c_name}</h3>
        <p><strong>Location:</strong> ${internship.i_location}</p>
        <p><strong>Type:</strong> ${internship.i_type}</p>
        <p><strong>Duration:</strong> ${internship.i_duration}</p>
        <p><strong>Openings:</strong> ${internship.i_openings}</p>
        <p><strong>Stipend:</strong> ${internship.i_stipend}</p>
        <p><strong>Skills Required:</strong> ${internship.i_skills}</p>
        <p>${internship.i_description.replace(/\r\n/g, "<br>")}</p>

        <button id="upload-resume-btn">Upload Resume</button>

        <div id="resume-modal">
          <div>
            <span id="close-resume-modal">&times;</span>
            <h3>Upload Your Resume</h3>
            <form id="resume-upload-form" enctype="multipart/form-data">
              <input type="file" name="resume" accept=".pdf" required><br><br>
              <input type="hidden" name="app_id" id="resume-app-id">
              <button type="submit">Upload</button>
            </form>
            <p id="resume-upload-status"></p>
          </div>
        </div>
      `;

      // Set resume app_id when Upload Resume clicked
      document.getElementById("upload-resume-btn").addEventListener("click", () => {
        document.getElementById("resume-app-id").value = internshipId;
        document.getElementById("resume-modal").style.display = "block";
      });

      // Close modal
      document.getElementById("close-resume-modal").addEventListener("click", () => {
        document.getElementById("resume-modal").style.display = "none";
      });
    })
    .catch(err => {
      document.getElementById("internship-details").innerHTML = `<p>Error loading internship details.</p>`;
      console.error(err);
    });
});

// Function to send application POST request
function applyForInternship(internshipId) {
  fetch("/apply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ i_id: internshipId })
  })
    .then(res => {
      if (!res.ok) throw new Error("Failed to apply");
      return res.text();
    })
    .then(msg => {
      const msgEl = document.getElementById("apply-message");
      msgEl.style.color = "green";
      msgEl.textContent = "Application submitted successfully!";
      document.getElementById("apply-btn").disabled = true;
    })
    .catch(err => {
      const msgEl = document.getElementById("apply-message");
      msgEl.style.color = "red";
      msgEl.textContent = "Failed to submit application.";
      console.error(err);
    });
}

document.addEventListener("click", function (event) {
  // Open modal on upload button click
  if (event.target.id === "upload-resume-btn") {
    document.getElementById("resume-modal").style.display = "block";
  }

  // Close modal
  if (event.target.id === "close-resume-modal") {
    document.getElementById("resume-modal").style.display = "none";
  }
});

// Handle resume form submit
document.addEventListener("submit", function (event) {
  if (event.target.id === "resume-upload-form") {
    event.preventDefault();

    const internshipId = document.getElementById("resume-app-id").value;

    // First, apply for the internship (inserts into DB)
    fetch("/apply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ i_id: internshipId })
    })
    .then(res => {
      if (!res.ok) throw new Error("Application failed");
      return res.text();
    })
    .then(() => {
      // Then upload the resume
      const formData = new FormData(event.target);

      return fetch("/upload-resume", {
        method: "POST",
        body: formData
      });
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        window.location.href = "student_internship.html";
      } else {
        alert("Upload failed.");
      }
    })
    .catch(err => {
      console.error("Error during apply/upload:", err);
      alert("Upload or apply failed.");
    });
  }
});
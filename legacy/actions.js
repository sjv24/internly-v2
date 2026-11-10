const formidable = require("formidable");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");
const db = require("./db");
const sessionModule = require("./session");
const bcrypt = require('bcrypt');

// Serve static files
function serveStatic(req, res, filePath, ext) {
  const mimeTypes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg"
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Static file not found");
      return;  // <-- RETURN ADDED
    } else {
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
      res.end(content);
    }
  });
}

// Serve view pages
function serveViewPage(req, res, viewName) {
  const filePath = path.join(__dirname, "views", viewName);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("View not found");
      return;  // <-- RETURN ADDED
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    }
  });
}

// Student signup
function handleStudentSignup(req, res) {
  let body = "";
  req.on("data", chunk => (body += chunk.toString()));
  req.on("end", async () => {
    const data = querystring.parse(body);

    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);

      const sql = `INSERT INTO STUDENTS (s_name, s_email, s_password, s_uni, s_gender, s_year_of_study, s_joining_date, s_website)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

      const values = [
        data.fullname,
        data.email,
        hashedPassword, // Use hashed password
        data.university,
        data.gender,
        parseInt(data.year),
        new Date().toISOString().slice(0, 10),
        data.website || ""
      ];

      db.query(sql, values, (err, result) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end("<h3>Registration failed</h3>");
        } else {
          serveViewPage(req, res, "student-login.html");
        }
      });
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end("<h3>Something went wrong with signup.</h3>");
    }
  });
}

// Student login
function handleStudentLogin(req, res) {
  let body = "";
  req.on("data", chunk => (body += chunk.toString()));
  req.on("end", async () => {
    const data = querystring.parse(body);

    const sql = `SELECT * FROM STUDENTS WHERE s_email = ?`;
    const values = [data["student-login-email"]];

    try {
      db.query(sql, values, async (err, results) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end("<h3>Server error. Please try again later.</h3>");
          return;
        }

        if (results.length === 0) {
          res.writeHead(401, { "Content-Type": "text/html" });
          res.end("<h3>Invalid email or password</h3>");
          return;
        }

        const user = results[0];

        const isMatch = await bcrypt.compare(
          data["student-login-password"],
          user.s_password
        );

        if (!isMatch) {
          res.writeHead(401, { "Content-Type": "text/html" });
          res.end("<h3>Invalid email or password</h3>");
          return;
        }

        // Password matched: set session
        sessionModule.setMySession(user.s_name, user.s_id, "student", user.s_email);
        res.writeHead(302, { Location: "/student/student-dashboard.html" });
        res.end();
      });
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end("<h3>Login error occurred. Please try again.</h3>");
    }
  });
}

// Company signup
function handleCompanySignup(req, res) {
  let body = "";
  req.on("data", chunk => (body += chunk.toString()));
  req.on("end", async () => {
    const data = querystring.parse(body);

    try {
      // Hash the company password before storing
      const hashedPassword = await bcrypt.hash(data.password, 10);

      const sql = `
        INSERT INTO COMPANIES (c_name, c_email, c_password, c_location, c_industry, c_contact_name)
        VALUES (?, ?, ?, ?, ?, ?)`;

      const values = [
        data.company_name,
        data.email,
        hashedPassword, // hashed password goes in the DB
        data.location,
        data.industry,
        data.contact_person
      ];

      db.query(sql, values, (err, result) => {
        if (err) {
          // Something went wrong with the query or DB
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end("<h3>Registration failed</h3>");
        } else {
          // Signup successful – redirect to login page
          serveViewPage(req, res, "company-login.html");
        }
      });
    } catch (err) {
      // If hashing or any async error occurs
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end("<h3>Something went wrong during signup</h3>");
    }
  });
}

// Company login
function handleCompanyLogin(req, res) {
  let body = "";
  req.on("data", chunk => (body += chunk.toString()));
  req.on("end", async () => {
    const data = querystring.parse(body);

    const sql = `SELECT * FROM COMPANIES WHERE c_email = ?`;
    const values = [data["company-login-email"]];

    try {
      db.query(sql, values, async (err, results) => {
        if (err) {
          // Database error
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end("<h3>Server error. Please try again later.</h3>");
          return;
        }

        if (results.length === 0) {
          // No company with that email found
          res.writeHead(401, { "Content-Type": "text/html" });
          res.end("<h3>Invalid email or password</h3>");
          return;
        }

        const company = results[0];

        // Compare input password with hashed password from DB
        const isMatch = await bcrypt.compare(
          data["company-login-password"],
          company.c_password
        );

        if (!isMatch) {
          // Password doesn't match
          res.writeHead(401, { "Content-Type": "text/html" });
          res.end("<h3>Invalid email or password</h3>");
          return;
        }

        // Password matches – set session and redirect
        sessionModule.setMySession(company.c_name, company.c_id, "company", company.c_email);
        res.writeHead(302, { Location: "/companies/companies-dashboard.html" });
        res.end();
      });
    } catch (err) {
      // Something unexpected went wrong
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end("<h3>Login error occurred. Please try again.</h3>");
    }
  });
}


function createInternshipData(req, res) {
  let body = "";
  req.on("data", chunk => (body += chunk));
  req.on("end", () => {
    const data = querystring.parse(body);

    // Get company session
    const sessionData = sessionModule.getMySession();

    // Check authorization
    if (!sessionData.userId || sessionData.userType !== "company") {
      res.writeHead(401);
      res.end("Unauthorized: Please login as company");
      return; 
    }

    const companyId = sessionData.userId;

    // Insert internship using form data + session c_id
    const sql = `
      INSERT INTO INTERNSHIPS 
      (i_title, i_location, i_type, i_duration, i_openings, i_start_date, i_application_deadline, i_stipend, i_skills, i_description, c_id, c_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      data.title,
      data.location,
      data.type,
      data.duration,
      data.openings,
      data.start_date,
      data.deadline,
      data.stipend,
      data.skills,
      data.description,
      companyId,
      data.c_name
    ];

    db.query(sql, values, (err2, result2) => {
      if (err2) {
        res.writeHead(500);
        res.end("Failed to create internship");
        return; 
      }

      res.writeHead(302, { Location: "/companies/companies-dashboard.html" });
      res.end();
    });
  });
}

// Handle account update for students
function handleAccountUpdate(req, res) {
  let body = "";
  req.on("data", chunk => (body += chunk));
  req.on("end", () => {
    const data = querystring.parse(body);

    const sessionData = sessionModule.getMySession();
    const studentId = sessionData.userId;

    if (!studentId) {
      res.writeHead(401);
      res.end("Unauthorized");
      return;
    }

    // Get original student data
    const selectSQL = `SELECT * FROM STUDENTS WHERE s_id = ?`;
    db.query(selectSQL, [studentId], (err, results) => {
      if (err || results.length === 0) {
        res.writeHead(500);
        res.end("Error fetching user data");
        return;
      }

      const original = results[0];

      // Updated values, fallback to old ones if input is empty
      const updatedName = data.name.trim() !== "" ? data.name : original.s_name;
      const updatedEmail = data.email.trim() !== "" ? data.email : original.s_email;
      const updatedPassword = data.password.trim() !== "" ? data.password : original.s_password;

      const updateSQL = `
        UPDATE STUDENTS SET s_name = ?, s_email = ?, s_password = ? WHERE s_id = ?
      `;
      const values = [updatedName, updatedEmail, updatedPassword, studentId];

      db.query(updateSQL, values, (err2, result2) => {
        if (err2) {
          res.writeHead(500);
          res.end("Update failed");
          return;
        }

        sessionModule.setMySession(updatedName, studentId, "student", updatedEmail);
        res.writeHead(302, { Location: "/student/student-dashboard.html" });
        res.end();
      });
    });
  });
}

// hanlde company account update
function handleCompanyAccountUpdate(req, res) {
  let body = "";
  req.on("data", chunk => (body += chunk));
  req.on("end", () => {
    const data = querystring.parse(body);

    const sessionData = sessionModule.getMySession();
    const companyId = sessionData.userId;

    if (!companyId) {
      res.writeHead(401);
      res.end("Unauthorized");
      return;
    }

    // Get original company data
    const selectSQL = `SELECT * FROM COMPANIES WHERE c_id = ?`;
    db.query(selectSQL, [companyId], (err, results) => {
      if (err || results.length === 0) {
        res.writeHead(500);
        res.end("Error fetching user data");
        return;
      }

      const original = results[0];

      // Updated values, fallback to old ones if input is empty
      const updatedName = data.name.trim() !== "" ? data.name : original.c_name;
      const updatedEmail = data.email.trim() !== "" ? data.email : original.c_email;
      const updatedPassword = data.password.trim() !== "" ? data.password : original.c_password;

      const updateSQL = `
        UPDATE COMPANIES SET c_name = ?, c_email = ?, c_password = ? WHERE c_id = ?
      `;
      const values = [updatedName, updatedEmail, updatedPassword, companyId];

      db.query(updateSQL, values, (err2, result2) => {
        if (err2) {
          res.writeHead(500);
          res.end("Update failed");
          return;
        }

        sessionModule.setMySession(updatedName, companyId, "company", updatedEmail);
        res.writeHead(302, { Location: "/companies/companies-dashboard.html" });
        res.end();
      });
    });
  });
}

// Handle account deletion
function handleAccountDelete(req, res) {
  const sessionData = sessionModule.getMySession();
  const userId = sessionData.userId;
  const userType = sessionData.userType;

  if (!userId) {
    res.writeHead(401);
    res.end("Unauthorized");
    return; 
  }

  let deleteSQL;
  if (userType === "student") {
    deleteSQL = `DELETE FROM STUDENTS WHERE s_id = ?`;
  } else if (userType === "company") {
    deleteSQL = `DELETE FROM COMPANIES WHERE c_id = ?`;
  } else {
    res.writeHead(400);
    res.end("Invalid user type");
    return; 
  }

  db.query(deleteSQL, [userId], (err) => {
    if (err) {
      res.writeHead(500);
      res.end("Account deletion failed");
      return;  // <-- RETURN ADDED
    }

    sessionModule.deleteSession();
    res.writeHead(302, { Location: "/home-page.html" });
    res.end();
  });
}

// Internship data as JSON
function serveInternshipData(req, res) {
  db.query("SELECT * FROM INTERNSHIPS", (err, results) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "DB query failed" }));
      return;  // <-- RETURN ADDED
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(results));
    }
  });
}
function updateInternship(req, res) {
  let body = "";

  req.on("data", chunk => {
    body += chunk;
  });

  req.on("end", () => {
    const data = querystring.parse(body);

    console.log("Received update request for internship id:", data.id);

    const {
      id,
      title,
      location,
      type,
      duration,
      openings,
      stipend,
      skills,
      description
    } = data;

    const sql = `
      UPDATE INTERNSHIPS SET 
        i_title = ?, 
        i_location = ?, 
        i_type = ?, 
        i_duration = ?, 
        i_openings = ?, 
        i_stipend = ?, 
        i_skills = ?, 
        i_description = ?
      WHERE i_id = ?
    `;

    const values = [
      title,
      location,
      type,
      duration,
      openings,
      stipend,
      skills,
      description,
      id
    ];

    db.query(sql, values, (err) => {
      if (err) {
        console.error("❌ DB Update Error:", err);
        res.writeHead(500);
        res.end("Failed to update internship");
      } else {
        res.writeHead(200);
        res.end("Internship updated successfully");
      }
    });
  });
}


function deleteInternship(req, res) {
  let body = "";
  req.on("data", chunk => body += chunk);
  req.on("end", () => {
    const data = querystring.parse(body);
    const { id } = data;

    const sql = `DELETE FROM INTERNSHIPS WHERE i_id = ?`;
    db.query(sql, [id], (err) => {
      if (err) {
        res.writeHead(500);
        res.end("Failed to delete internship");
      } else {
        res.writeHead(200);
        res.end("Internship deleted successfully");
      }
    });
  });
}

// server internship details for student apply page
function serveSingleInternship(req, res) {
  const url = require("url");
  const queryObject = url.parse(req.url, true).query;
  const internshipId = queryObject.id;

  if (!internshipId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing internship id" }));
    return;
  }

  const sql = "SELECT * FROM INTERNSHIPS WHERE i_id = ?";
  db.query(sql, [internshipId], (err, results) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Database error" }));
      return;
    }

    if (results.length === 0) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internship not found" }));
      return;
    }

    // Return the internship record as JSON
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(results[0]));
  });
}

// handle apply 
function handleApply(req, res) {
  let body = "";
  req.on("data", chunk => {
    body += chunk;
  });

  req.on("end", () => {
    try {
      const data = JSON.parse(body);
      const internshipId = data.i_id;

      if (!internshipId) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Missing internship id");
        return;
      }

      const sessionData = require("./session").getMySession();

      if (!sessionData.userId || sessionData.userType !== "student") {
        res.writeHead(401, { "Content-Type": "text/plain" });
        res.end("Unauthorized: Please login as student");
        return;
      }

      const studentId = sessionData.userId;

      // Insert application into APPLICATIONS table with current date and default status
      const sql = `INSERT INTO APPLICATIONS (s_id, i_id, app_date, status) VALUES (?, ?, CURDATE(), ?)`;
      const values = [studentId, internshipId, "Pending"];

      db.query(sql, values, (err, result) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Failed to submit application");
          return;
        }

        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Application submitted successfully");
      });
    } catch (e) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Invalid request body");
    }
  });
}

// Serve student applications
function serveStudentApplications(req, res) {
  const sessionData = sessionModule.getMySession();
  const studentId = sessionData.userId;

  if (!studentId) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  const sql = `
    SELECT A.*, I.i_title, I.i_description, C.c_name, A.app_date, A.status, S.s_uni, S.s_website
    FROM APPLICATIONS A
    JOIN INTERNSHIPS I ON A.i_id = I.i_id
    JOIN COMPANIES C ON I.c_id = C.c_id
    JOIN STUDENTS S ON A.s_id = S.s_id
    WHERE A.s_id = ?
    ORDER BY A.app_date DESC
  `;

  db.query(sql, [studentId], (err, results) => {
    if (err) {
      console.error("DB error fetching applications:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "DB query failed" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(results));
  });
}

// Serve company applications
function serveCompanyApplications(req, res) {
  const sessionData = sessionModule.getMySession();
  if (!sessionData.userId || sessionData.userType !== "company") {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized: Please login as company" }));
    return;
  }

  const sql = `
    SELECT a.app_id, a.status, a.app_date,
           i.i_title,
           s.s_name, s.s_email, s.s_uni, s.s_website
    FROM APPLICATIONS a
    JOIN INTERNSHIPS i ON a.i_id = i.i_id
    JOIN STUDENTS s ON a.s_id = s.s_id
    WHERE i.c_id = ?
    ORDER BY a.app_date DESC
  `;

  db.query(sql, [sessionData.userId], (err, results) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Database query failed" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(results));
  });
}

// Handle application status update by company
function handleApplicationStatusUpdate(req, res) {
  let body = "";
  req.on("data", chunk => (body += chunk));
  req.on("end", () => {
    try {
      const data = JSON.parse(body);
      const { app_id, status } = data;

      const sessionData = sessionModule.getMySession();
      if (!sessionData.userId || sessionData.userType !== "company") {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized: Please login as company" }));
        return;
      }

      const validStatuses = ["Pending", "Accepted", "Rejected"];
      if (!validStatuses.includes(status)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid status value" }));
        return;
      }

      const checkSql = `
        SELECT a.app_id FROM APPLICATIONS a
        JOIN INTERNSHIPS i ON a.i_id = i.i_id
        WHERE a.app_id = ? AND i.c_id = ?
      `;

      db.query(checkSql, [app_id, sessionData.userId], (err, results) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Database error" }));
          return;
        }

        if (results.length === 0) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not authorized to update this application" }));
          return;
        }

        const updateSql = `UPDATE APPLICATIONS SET status = ? WHERE app_id = ?`;
        db.query(updateSql, [status, app_id], (err2) => {
          if (err2) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to update status" }));
            return;
          }

          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("Status updated successfully");
        });
      });
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON data" }));
    }
  });
}



// Serve session data (helps in making dashboard personalized)
function serveSessionData(req, res) {
  const sessionData = sessionModule.getMySession();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(sessionData));
}

function handleUploadResume(req, res) {
  if (req.method.toLowerCase() !== "post") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Method Not Allowed" }));
  }

  const form = new formidable.IncomingForm();
  const uploadDir = path.join(__dirname, "uploads");

  // Ensure the uploads directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  form.uploadDir = uploadDir;
  form.keepExtensions = true;

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error("Error parsing form:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Server error while parsing form." }));
    }

    console.log("Fields:", fields);
    console.log("Files:", files);

    // Normalize field and file references
    const appId = fields.app_id?.[0] || fields.app_id || null;
    const resumeFile = Array.isArray(files.resume) ? files.resume[0] : files.resume;

    // Validate input
    if (!appId || !resumeFile || !resumeFile.filepath) {
      console.error("Missing resume or app_id.");
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Missing resume file or application ID." }));
    }

    const sessionData = sessionModule.getMySession();
    const email = sessionData.userEmail;
    const originalName = resumeFile.originalFilename || "resume.pdf";
    const fileExt = path.extname(originalName) || ".pdf";
    const newFileName = `resume-${appId}-${email}${fileExt}`;
    const newPath = path.join(uploadDir, newFileName);

    fs.rename(resumeFile.filepath, newPath, (err) => {
      if (err) {
        console.error("Failed to save file:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Failed to save uploaded resume." }));
      }

      console.log(`Resume uploaded as: ${newFileName}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    });
  });
}

module.exports = {
  serveStatic,
  serveViewPage,
  handleStudentSignup,
  handleStudentLogin,
  serveInternshipData,
  handleCompanyLogin,
  handleCompanySignup,
  createInternshipData,
  serveSessionData,
  handleAccountUpdate,
  handleCompanyAccountUpdate,
  handleAccountDelete,
  updateInternship,
  deleteInternship,
  serveSingleInternship,
  handleApply,
  serveStudentApplications,
  handleApplicationStatusUpdate,
  serveCompanyApplications,
  handleUploadResume
};

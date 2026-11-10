require("./db_creation");
const http = require("http");
const path = require("path");
const fs = require("fs");
const {
  serveStatic,
  serveViewPage,
  handleStudentSignup,
  handleStudentLogin,
  serveInternshipData,
  handleCompanyLogin,
  handleCompanySignup,
  createInternshipData,
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
} = require("./actions");

http.createServer((req, res) => {
  const ext = path.extname(req.url);
  const filePath = path.join(__dirname, req.url);

  if ([".css", ".js", ".png", ".jpg", ".jpeg"].includes(ext)) {
    serveStatic(req, res, filePath, ext);
    return;
  }

  if (req.url === "/internships" && req.method === "GET") {
    serveInternshipData(req, res);
    return;
  }

  if (req.url === "/student-signup" && req.method === "POST") {
    handleStudentSignup(req, res);
    return;
  }

  if (req.url === "/student-login" && req.method === "POST") {
    handleStudentLogin(req, res);
    return;
  }

  if (req.url === "/company-signup" && req.method === "POST") {
    handleCompanySignup(req, res);
    return;
  }

  if (req.url === "/company-login" && req.method === "POST") {
    handleCompanyLogin(req, res);
    return;
  }

  if (req.url === "/create-internship" && req.method === "POST") {
    createInternshipData(req, res);
    return;
  }

  if (req.url === "/session-data" && req.method === "GET") {
  const sessionModule = require("./session");
  const sessionData = sessionModule.getMySession();

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(sessionData));
  return;
  }

  if (req.url === "/logout" && req.method === "GET") {
  const sessionModule = require("./session");
  sessionModule.deleteSession();

  res.writeHead(302, { Location: "/home-page.html" });
  res.end();
  return;
  }

  // Update student account details
  if (req.method === "POST" && req.url === "/updateAccount") {
    handleAccountUpdate(req, res);
    return;
  }

  // Update company account details
  if (req.method === "POST" && req.url === "/updateCompanyAccount") {
    handleCompanyAccountUpdate(req, res);
    return;
  }

  // Delete student account
  if (req.url === "/deleteAccount" && req.method === "POST") {
    handleAccountDelete(req, res);
    return;
  }

  if (req.url === "/" || req.url === "/home-page.html") {
    serveViewPage(req, res, "home-page.html");
    return;
  }

  if (req.url.includes(".html")) {
    const cleanPath = req.url.split("?")[0].slice(1);  // removes / and ?id=...
    serveViewPage(req, res, cleanPath);
    return;
  }

  if (req.url === "/update-internship" && req.method === "POST") {
    updateInternship(req, res);
    return;
  }

  if (req.url === "/delete-internship" && req.method === "POST") {
    deleteInternship(req, res);
    return;
  }

  if (req.url.startsWith("/internship") && req.method === "GET") {
  serveSingleInternship(req, res);
  return;
  }

  if (req.url === "/apply" && req.method === "POST") {
    handleApply(req, res);
    return;
  }

  if (req.url === "/company/applications" && req.method === "GET") {
  serveCompanyApplications(req, res);
  return;
  } 
  
  if (req.url === "/company/applications/update" && req.method === "POST") {
    handleApplicationStatusUpdate(req, res);
    return;
  }


// Serve student applications
  if (req.url === "/student/applications" && req.method === "GET") {
  serveStudentApplications(req, res);
  return;
  }

  if (req.url === "/upload-resume" && req.method === "POST") {
    handleUploadResume(req, res);
    return;
  }

  if (req.url.startsWith("/uploads/") && req.method === "GET") {
  const filePath = path.join(__dirname, "uploads", path.basename(req.url));
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Resume not found");
    } else {
      res.writeHead(200, { "Content-Type": "application/pdf" });
      res.end(data);
    }
  });
  return;
}

  res.writeHead(404);
  res.end("<h1>404 - Page Not Found</h1>");
}).listen(8080, () => {
  console.log("Server running at http://localhost:8080");
});

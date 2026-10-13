import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { config } from "../config.js";
import { badRequest } from "../errors.js";
fs.mkdirSync(config.uploadDir, { recursive: true });
/**
 * Resume upload rules (v1 trusted everything the browser said):
 *  - stored under a random name, never the user-supplied one (no path tricks, no guessing)
 *  - PDF only, max 5 MB, and the file CONTENT is checked, not just its claimed type
 *  - the folder is NOT served statically; downloads go through an authorised route
 */
export const resumeUpload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, _file, cb) => cb(null, `${randomUUID()}.pdf`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    file.mimetype === "application/pdf" ? cb(null, true) : cb(badRequest("Resume must be a PDF file")),
});
/** A real PDF starts with the bytes "%PDF-". */
export function looksLikePdf(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    return buf.toString("latin1") === "%PDF-";
  } finally {
    fs.closeSync(fd);
  }
}
export const resumePath = (file) => path.join(config.uploadDir, path.basename(file));
export function deleteResumeFiles(files) {
  for (const f of files) {
    if (f) fs.rm(resumePath(f), { force: true }, () => {});
  }
}

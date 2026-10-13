// `npm run setup` - one-time local configuration: creates .env from .env.example.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = path.join(root, ".env");
if (fs.existsSync(env)) {
  console.log(".env already exists - leaving it alone.");
} else {
  fs.copyFileSync(path.join(root, ".env.example"), env);
  console.log("Created .env from .env.example");
}
console.log("\nNext: npm run dev   (starts the database and the app)");

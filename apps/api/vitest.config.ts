import { defineConfig } from "vitest/config";

const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/internly_test";

// globalSetup runs in the main process, so set these before anything else reads them
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = TEST_DB;

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    env: { NODE_ENV: "test", DATABASE_URL: TEST_DB },
    globalSetup: ["test/globalSetup.ts"],
    fileParallelism: false, // all test files share one database, so run them one after another
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});

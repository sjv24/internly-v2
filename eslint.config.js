import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// ESLint finds likely bugs (unused variables, missing hook dependencies, floating promises ...)
// that the TypeScript compiler alone does not report.
export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "legacy/**", ".pgdata/**", "apps/api/uploads/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["apps/api/**/*.ts", "scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);

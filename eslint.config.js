import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "reports/", ".stryker-tmp/", "test-results/", "playwright-report/"] },
  js.configs.recommended,
  {
    files: ["**/*.js", "bin/pele-preview"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Callbacks passed to Playwright's page.evaluate run in the browser.
    files: ["e2e/**/*.js", "test/evals/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];

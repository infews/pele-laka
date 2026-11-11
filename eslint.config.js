import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "reports/", ".stryker-tmp/"] },
  js.configs.recommended,
  {
    files: ["**/*.js", "bin/pele-laka"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Jasmine specs; callbacks passed to Playwright's page.evaluate run in the browser.
    files: ["test/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.jasmine, ...globals.browser } },
  },
];

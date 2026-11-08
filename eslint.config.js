import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "reports/", ".stryker-tmp/", "test-results/", "playwright-report/"] },
  js.configs.recommended,
  {
    files: ["**/*.js", "bin/pele-preview"],
    languageOptions: { globals: { ...globals.node } },
  },
];

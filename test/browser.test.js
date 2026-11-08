// Internal tests of part of the Preview subsystem. A redesign may rewrite or
// delete them; the PREVIEW evals (test/evals/preview.test.js) must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { openCommand } from "../src/browser.js";

const url = "http://127.0.0.1:1/";

test("macOS uses open", () => {
  assert.deepEqual(openCommand(url, { platform: "darwin" }), ["open", url]);
});

test("a named app uses open -a", () => {
  assert.deepEqual(openCommand(url, { app: "Google Chrome", platform: "darwin" }), ["open", "-a", "Google Chrome", url]);
});

test("elsewhere uses xdg-open", () => {
  assert.deepEqual(openCommand(url, { platform: "linux" }), ["xdg-open", url]);
});

// Internal tests of part of the Preview subsystem. A redesign may rewrite or
// delete them; the PREVIEW evals (test/evals/preview.test.js) must keep passing.
import { openCommand } from "../src/browser.js";

const url = "http://127.0.0.1:1/";

describe("openCommand", () => {
  it("uses open on macOS", () => {
    expect(openCommand(url, { platform: "darwin" })).toEqual(["open", url]);
  });

  it("uses open -a for a named app", () => {
    expect(openCommand(url, { app: "Google Chrome", platform: "darwin" })).toEqual(["open", "-a", "Google Chrome", url]);
  });

  it("uses xdg-open elsewhere", () => {
    expect(openCommand(url, { platform: "linux" })).toEqual(["xdg-open", url]);
  });
});

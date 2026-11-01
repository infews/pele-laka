import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "pele";

test("pele renders headless in node", () => {
  const { svg } = render("flowchart LR\n  A --> B");
  assert.match(svg, /^<svg /);
});

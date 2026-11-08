// Eval tests for the PLEX area (docs/evals/plex.md): pele-plex.css as it looks
// in a diagram exported with it, read back from Chromium. Keep them.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const bin = new URL("../../bin/pele-preview", import.meta.url).pathname;
const THEME = readFileSync(new URL("../../pele-plex.css", import.meta.url), "utf8");
const EVALS = readFileSync(new URL("../../docs/evals/plex.md", import.meta.url), "utf8");
const TONES = [1, 2, 3, 4, 5, 6, 7, 8];
const MODES = ["light", "dark"];

// The carbon table in PLEX-CON-001: { light: { "--pele-bg": "#ffffff", ... }, dark: {...} }.
const CARBON = (() => {
  const table = { light: {}, dark: {} };
  for (const [, name, light, dark] of EVALS.matchAll(/^\s*\| `(--pele-[a-z0-9-]+)` \| `(#[0-9a-f]{6})` \| `(#[0-9a-f]{6})` \|$/gm)) {
    table.light[name] = light;
    table.dark[name] = dark;
  }
  assert.ok(Object.keys(table.light).length >= 20, "the carbon table is in docs/evals/plex.md");
  return table;
})();

// Exports `mmd` with `css` (default: the theme) and returns the SVG text.
function exported(mmd, { css = THEME, scheme = "auto" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "pele-preview-eval-"));
  writeFileSync(join(dir, "d.mmd"), mmd);
  const args = [join(dir, "d.mmd")];
  if (css !== null) {
    writeFileSync(join(dir, "s.css"), css);
    args.push(join(dir, "s.css"));
  }
  const result = spawnSync(process.execPath, [bin, ...args, "--scheme", scheme, "-o", join(dir, "o.svg")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return readFileSync(join(dir, "o.svg"), "utf8");
}

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

// Shows `html` in a page whose own light/dark setting is `viewer`. The theme's
// web-font import is blocked so the tests stay offline.
async function show(html, viewer = "light") {
  const page = await browser.newPage({ colorScheme: viewer });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.setContent(html);
  return page;
}

// Runs `body(page)` against the svg, closing the page afterwards.
async function inPage(html, viewer, body) {
  const page = await show(html, viewer);
  try {
    return await body(page);
  } finally {
    await page.close();
  }
}

// [r, g, b] in 0-255 from "#rrggbb", "rgb(...)" or "color(srgb ...)".
function rgb(text) {
  if (text.startsWith("#")) return [1, 3, 5].map((i) => parseInt(text.slice(i, i + 2), 16));
  const srgb = text.match(/^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/);
  if (srgb) return srgb.slice(1, 4).map((c) => Number(c) * 255);
  const plain = text.match(/^rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)/);
  assert.ok(plain, `a color: ${text}`);
  return plain.slice(1, 4).map(Number);
}
const mix = (a, b, share) => rgb(a).map((c, i) => c * share + rgb(b)[i] * (1 - share));
function sameColor(actual, expected, what) {
  const [a, e] = [rgb(actual), Array.isArray(expected) ? expected : rgb(expected)];
  assert.ok(a.every((c, i) => Math.abs(c - e[i]) <= 1.5), `${what}: got ${actual}, expected rgb(${e.map(Math.round).join(", ")})`);
}

// Resolves each named custom property on the root svg to a computed color.
const resolveVariables = (page, names) => page.evaluate((list) => {
  const svg = document.querySelector("svg");
  return Object.fromEntries(list.map((name) => {
    const probe = document.createElementNS("http://www.w3.org/2000/svg", "g");
    probe.style.color = `var(${name})`;
    svg.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return [name, value];
  }));
}, names);

const computed = (page, selector, props) => page.evaluate(([sel, list]) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const style = getComputedStyle(el);
  return Object.fromEntries(list.map((p) => [p, style[p] ?? style.getPropertyValue(p)]));
}, [selector, props]);

// One flowchart with every tone on a node, a solid node, a subgraph, and edge
// labels; subgraphs sit apart from edges so pele keeps their titles inside.
const TONED = [
  "flowchart TB",
  ...TONES.map((n) => `  T${n}[Tone ${n}]:::tone-${n}`),
  ...TONES.map((n) => `  S${n}[Solid ${n}]:::tone-${n}`),
  ...TONES.map((n) => `  class S${n} solid`),
  "  SA[Accent]",
  "  class SA solid",
  ...TONES.map((n) => `  subgraph G${n}[Group ${n}]\n    M${n}[Member ${n}]\n  end\n  class G${n} tone-${n}`),
  "  E1[From] -->|yes| E2[To]",
  "  E3[From] -->|a long label that pele will wrap onto more than one line| E4[To]",
].join("\n");

const SEQUENCE = "sequenceDiagram\n  Alice->>Bob: hello there\n  Bob-->>Alice: fine thanks\n";

// --- Contracts --------------------------------------------------------------

test("PLEX-CON-001 the theme's colors are carbon's, light and dark", async () => {
  // @spec PLEX-CON-001
  for (const mode of MODES) {
    const svg = exported(TONED, { scheme: mode });
    await inPage(svg, mode, async (page) => {
      const values = await resolveVariables(page, Object.keys(CARBON[mode]));
      for (const [name, hex] of Object.entries(CARBON[mode])) sameColor(values[name], hex, `${mode} ${name}`);
    });
  }
});

// --- End-to-end -------------------------------------------------------------

const background = async (page) => (await resolveVariables(page, ["--pele-bg"]))["--pele-bg"];

test("PLEX-E2E-001 --scheme light or dark wins over the viewer's setting", async () => {
  // @spec PLEX-E2E-001
  for (const [scheme, viewer] of [["dark", "light"], ["light", "dark"]]) {
    await inPage(exported(TONED, { scheme }), viewer, async (page) => {
      sameColor(await background(page), CARBON[scheme]["--pele-bg"], `${scheme} for a ${viewer} viewer`);
      const node = await computed(page, '[data-id="T2"] > rect', ["stroke"]);
      sameColor(node.stroke, CARBON[scheme]["--pele-series-2"], `${scheme} tone 2 for a ${viewer} viewer`);
    });
  }
});

test("PLEX-E2E-002 with --scheme auto the diagram follows the viewer", async () => {
  // @spec PLEX-E2E-002
  const svg = exported(TONED);
  for (const viewer of MODES) {
    await inPage(svg, viewer, async (page) => {
      sameColor(await background(page), CARBON[viewer]["--pele-bg"], `${viewer} viewer`);
    });
  }
});

test("PLEX-E2E-003 data-pele-mode on a container wins over the viewer's setting", async () => {
  // @spec PLEX-E2E-003
  const svg = exported(TONED);
  for (const [mode, viewer] of [["dark", "light"], ["light", "dark"]]) {
    await inPage(`<div data-pele-mode="${mode}">${svg}</div>`, viewer, async (page) => {
      sameColor(await background(page), CARBON[mode]["--pele-bg"], `data-pele-mode=${mode} for a ${viewer} viewer`);
    });
  }
});

// Every tone in both modes, for the node, solid and subgraph evals.
async function eachTone(check) {
  for (const mode of MODES) {
    await inPage(exported(TONED, { scheme: mode }), mode, async (page) => {
      for (const n of TONES) await check(page, mode, n, CARBON[mode]);
    });
  }
}

test("PLEX-E2E-004 a toned node is filled with an 18% tint over the surface", async () => {
  // @spec PLEX-E2E-004
  await eachTone(async (page, mode, n, c) => {
    const { fill } = await computed(page, `[data-id="T${n}"] > rect`, ["fill"]);
    sameColor(fill, mix(c[`--pele-series-${n}`], c["--pele-surface"], 0.18), `${mode} tone ${n} fill`);
  });
});

test("PLEX-E2E-005 a toned node is outlined in its tone, with foreground text", async () => {
  // @spec PLEX-E2E-005
  await eachTone(async (page, mode, n, c) => {
    const { stroke } = await computed(page, `[data-id="T${n}"] > rect`, ["stroke"]);
    sameColor(stroke, c[`--pele-series-${n}`], `${mode} tone ${n} outline`);
    const { fill } = await computed(page, `[data-id="T${n}"] text`, ["fill"]);
    sameColor(fill, c["--pele-fg"], `${mode} tone ${n} text`);
  });
});

test("PLEX-E2E-006 a solid toned node is filled and outlined in its tone", async () => {
  // @spec PLEX-E2E-006
  await eachTone(async (page, mode, n, c) => {
    const { fill, stroke } = await computed(page, `[data-id="S${n}"] > rect`, ["fill", "stroke"]);
    sameColor(fill, c[`--pele-series-${n}`], `${mode} solid ${n} fill`);
    sameColor(stroke, c[`--pele-series-${n}`], `${mode} solid ${n} outline`);
  });
});

test("PLEX-E2E-007 a solid node's text is the background color", async () => {
  // @spec PLEX-E2E-007
  await eachTone(async (page, mode, n, c) => {
    for (const id of [`S${n}`, "SA"]) {
      const { fill } = await computed(page, `[data-id="${id}"] text`, ["fill"]);
      sameColor(fill, c["--pele-bg"], `${mode} ${id} text`);
    }
  });
});

test("PLEX-E2E-008 a solid node with no tone uses the accent color", async () => {
  // @spec PLEX-E2E-008
  for (const mode of MODES) {
    await inPage(exported(TONED, { scheme: mode }), mode, async (page) => {
      const { fill, stroke } = await computed(page, '[data-id="SA"] > rect', ["fill", "stroke"]);
      sameColor(fill, CARBON[mode]["--pele-accent"], `${mode} fill`);
      sameColor(stroke, CARBON[mode]["--pele-accent"], `${mode} outline`);
    });
  }
});

test("PLEX-E2E-009 a toned subgraph is filled, opaque, with a 9% tint over the background", async () => {
  // @spec PLEX-E2E-009
  await eachTone(async (page, mode, n, c) => {
    const box = await computed(page, `.pele-cluster[data-id="G${n}"] > rect`, ["fill", "fillOpacity"]);
    sameColor(box.fill, mix(c[`--pele-series-${n}`], c["--pele-bg"], 0.09), `${mode} group ${n} fill`);
    assert.equal(box.fillOpacity, "1", `${mode} group ${n} opacity`);
  });
});

test("PLEX-E2E-010 a toned subgraph is outlined and titled in its tone", async () => {
  // @spec PLEX-E2E-010
  await eachTone(async (page, mode, n, c) => {
    const { stroke } = await computed(page, `.pele-cluster[data-id="G${n}"] > rect`, ["stroke"]);
    sameColor(stroke, c[`--pele-series-${n}`], `${mode} group ${n} outline`);
    const title = await computed(page, `.pele-cluster[data-id="G${n}"] > .pele-cluster-label`, ["fill"]);
    assert.ok(title, `group ${n} has its title inside its group`);
    sameColor(title.fill, c[`--pele-series-${n}`], `${mode} group ${n} title`);
  });
});

// Font size pele gives an edge label's text, with no stylesheet.
async function peleLabelSize(mmd) {
  return inPage(exported(mmd, { css: null }), "light", async (page) =>
    parseFloat((await computed(page, ".pele-edge-label text", ["fontSize"])).fontSize));
}

// The first single-line and the first wrapped flowchart edge label.
const SINGLE = ".pele-edge-label:not(:has(tspan[x] + tspan[x]))";
const WRAPPED = ".pele-edge-label:has(tspan[x] + tspan[x])";

async function labelBox(page, selector) {
  return page.evaluate((sel) => {
    const rect = document.querySelector(`${sel} > rect`);
    const style = getComputedStyle(rect);
    return {
      matrix: new DOMMatrixReadOnly(style.transform).toFloat64Array(),
      origin: style.transformOrigin,
      box: style.transformBox,
      rx: parseFloat(style.rx),
      ry: parseFloat(style.ry),
      width: rect.getBBox().width,
      height: rect.getBBox().height,
    };
  }, selector);
}

const close = (actual, expected, what, tolerance = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: got ${actual}, expected ${expected}`);

// Chromium reports the origin in pixels within the box, so its center is
// half the box's width and height.
function scaledAboutCenter({ matrix, origin, box, width, height }, x, y, what) {
  close(matrix[0], x, `${what} width scale`);
  close(matrix[5], y, `${what} height scale`);
  assert.equal(box, "fill-box", `${what} transform box`);
  const [ox, oy] = origin.split(" ").map(parseFloat);
  close(ox, width / 2, `${what} origin x`, 0.05);
  close(oy, height / 2, `${what} origin y`, 0.05);
}

test("PLEX-E2E-011 flowchart edge labels are capitals at 72%, tracked 0.06em, weight 500", async () => {
  // @spec PLEX-E2E-011
  const base = await peleLabelSize(TONED);
  await inPage(exported(TONED), "light", async (page) => {
    for (const selector of [SINGLE, WRAPPED]) {
      const text = await computed(page, `${selector} text`, ["textTransform", "fontSize", "letterSpacing", "fontWeight"]);
      assert.equal(text.textTransform, "uppercase");
      close(parseFloat(text.fontSize), base * 0.72, "size");
      close(parseFloat(text.letterSpacing), parseFloat(text.fontSize) * 0.06, "tracking");
      assert.equal(text.fontWeight, "500");
    }
  });
});

test("PLEX-E2E-012 a flowchart edge label's box is a full pill scaled 1.06 by 1.0", async () => {
  // @spec PLEX-E2E-012
  await inPage(exported(TONED), "light", async (page) => {
    const box = await labelBox(page, SINGLE);
    scaledAboutCenter(box, 1.06, 1.0, "single-line label");
    // A full pill: once scaled, both corner radii are half the drawn height.
    close(box.ry * 1.0, (box.height * 1.0) / 2, "vertical radius", 0.05);
    close(box.rx * 1.06, (box.height * 1.0) / 2, "horizontal radius", 0.05);
  });
});

test("PLEX-E2E-013 a wrapped edge label's box is scaled 1.14 by 1.18", async () => {
  // @spec PLEX-E2E-013
  await inPage(exported(TONED), "light", async (page) => {
    scaledAboutCenter(await labelBox(page, WRAPPED), 1.14, 1.18, "wrapped label");
  });
});

test("PLEX-E2E-014 sequence message labels keep pele's own type", async () => {
  // @spec PLEX-E2E-014
  const props = ["textTransform", "fontSize", "letterSpacing", "fontWeight"];
  const plain = await inPage(exported(SEQUENCE, { css: null }), "light", (page) => computed(page, ".pele-edge-label text, text.pele-edge-label", props));
  assert.ok(plain, "pele draws sequence messages as edge labels");
  await inPage(exported(SEQUENCE), "light", async (page) => {
    assert.deepEqual(await computed(page, ".pele-edge-label text, text.pele-edge-label", props), plain);
  });
});

test("PLEX-E2E-015 the tint knobs set node and subgraph tint strength", async () => {
  // @spec PLEX-E2E-015
  const css = `${THEME}\n:root { --plex-tone-node-mix: 50%; --plex-tone-cluster-mix: 30%; }`;
  await inPage(exported(TONED, { css, scheme: "light" }), "light", async (page) => {
    const c = CARBON.light;
    const node = await computed(page, '[data-id="T1"] > rect', ["fill"]);
    sameColor(node.fill, mix(c["--pele-series-1"], c["--pele-surface"], 0.5), "node at 50%");
    const group = await computed(page, '.pele-cluster[data-id="G1"] > rect', ["fill"]);
    sameColor(group.fill, mix(c["--pele-series-1"], c["--pele-bg"], 0.3), "subgraph at 30%");
  });
});

test("PLEX-E2E-016 the edge-label knobs change edge labels", async () => {
  // @spec PLEX-E2E-016
  const base = await peleLabelSize(TONED);
  const css = `${THEME}\n:root {
    --plex-edge-label-scale: 0.5; --plex-edge-label-tracking: 0.2em; --plex-edge-label-weight: 700;
    --plex-edge-label-pad-x: 1.3; --plex-edge-label-pad-y: 1.2;
    --plex-edge-label-pad-x-wrapped: 1.4; --plex-edge-label-pad-y-wrapped: 1.5;
    --plex-edge-label-radius: 2px; --plex-edge-label-stroke-width: 3px;
  }`;
  await inPage(exported(TONED, { css }), "light", async (page) => {
    const text = await computed(page, `${SINGLE} text`, ["fontSize", "letterSpacing", "fontWeight"]);
    close(parseFloat(text.fontSize), base * 0.5, "scale");
    close(parseFloat(text.letterSpacing), parseFloat(text.fontSize) * 0.2, "tracking");
    assert.equal(text.fontWeight, "700");

    const single = await labelBox(page, SINGLE);
    scaledAboutCenter(single, 1.3, 1.2, "single-line padding");
    close(single.rx * 1.3, 2, "radius", 0.05);
    close(single.ry * 1.2, 2, "radius", 0.05);
    scaledAboutCenter(await labelBox(page, WRAPPED), 1.4, 1.5, "wrapped padding");
    assert.equal((await computed(page, `${SINGLE} > rect`, ["strokeWidth"])).strokeWidth, "3px");
  });
});

const drawn = (page, id) => page.evaluate((i) => {
  const el = document.querySelector(`[data-id="${i}"]`);
  return getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
}, id);

test("PLEX-E2E-017 a node with the hidden class is not drawn", async () => {
  // @spec PLEX-E2E-017
  const mmd = "flowchart LR\n  A[Shown] --> B[Inline]:::hidden\n  A --> C[By line]\n  class C hidden\n";
  await inPage(exported(mmd), "light", async (page) => {
    assert.equal(await drawn(page, "A"), true);
    assert.equal(await drawn(page, "B"), false, ":::hidden");
    assert.equal(await drawn(page, "C"), false, "class C hidden");
  });
});

test("PLEX-E2E-018 a hidden subgraph loses its box and title but not its nodes", async () => {
  // @spec PLEX-E2E-018
  const mmd = "flowchart LR\n  A[Outside] --> D[Inside]\n  subgraph G[Group]\n    D\n  end\n  class G hidden\n";
  await inPage(exported(mmd), "light", async (page) => {
    assert.equal(await drawn(page, "G"), false, "the subgraph's box and title");
    assert.equal(await drawn(page, "D"), true, "the node inside");
  });
});

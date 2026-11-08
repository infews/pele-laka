// Eval tests for the PREVIEW area (docs/evals/preview.md). They run the real
// CLI and drive the page in Chromium, so the server, watcher and page can all
// be regrown. Keep them.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, renameSync, readdirSync, existsSync, chmodSync } from "node:fs";
import { createServer, connect } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import fc from "fast-check";
import { chromium } from "@playwright/test";

const bin = new URL("../../bin/pele-preview", import.meta.url).pathname;
const tempDir = () => mkdtempSync(join(tmpdir(), "pele-preview-eval-"));

const flow = (label) => `flowchart LR\n  A[${label}] --> B[SVG]\n`;
const BROKEN = "flowchart LR\n  A --> (((\n";
const SCHEMED = [
  ".pele { --probe: none; }",
  "@media (prefers-color-scheme: dark) { .pele { --probe: dark; } }",
  "@media (prefers-color-scheme: light) { .pele { --probe: light; } }",
].join("\n");

// A project folder holding a diagram and, optionally, a stylesheet.
function project({ mmd = flow("First"), css = null } = {}) {
  const dir = tempDir();
  const diagram = join(dir, "d.mmd");
  writeFileSync(diagram, mmd);
  const stylesheet = css === null ? null : join(dir, "s.css");
  if (stylesheet) writeFileSync(stylesheet, css);
  return { dir, diagram, stylesheet };
}

// Starts `pele-preview ...args` and resolves once it prints its URL. Collects
// stdout and stderr as they arrive.
async function preview(args, { env = process.env, cwd = tempDir() } = {}) {
  const child = spawn(process.execPath, [bin, ...args], { env, cwd });
  const out = { stdout: "", stderr: "" };
  child.stdout.on("data", (chunk) => { out.stdout += chunk; });
  child.stderr.on("data", (chunk) => { out.stderr += chunk; });
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  const url = await waitFor(() => out.stdout.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0], 5000, () => out.stderr);
  return {
    url, out, exited, cwd,
    async stop() {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGINT");
      const result = await Promise.race([exited, sleep(3000).then(() => null)]);
      if (!result) child.kill("SIGKILL");
      return result;
    },
  };
}

async function waitFor(check, ms, explain = () => "") {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out; ${explain()}`);
    await sleep(25);
  }
}

// Runs a preview for the duration of `body`, always stopping it.
async function withPreview(args, body, options) {
  const p = await preview(args, options);
  try {
    return await body(p);
  } finally {
    await p.stop();
  }
}

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

// Opens the preview page; `viewer` is the browser's own light/dark setting.
async function open(url, viewer = "light") {
  const page = await browser.newPage({ colorScheme: viewer });
  await page.goto(url);
  await page.waitForSelector("#pp-stage svg");
  await page.evaluate(() => { window.__sameDocument = true; });
  return page;
}

const stageText = (page) => page.evaluate(() => document.querySelector("#pp-stage").textContent);
const showsLabel = (page, label) =>
  page.waitForFunction((l) => document.querySelector("#pp-stage")?.textContent.includes(l), label, { timeout: 3000 });
const notReloaded = async (page) => assert.equal(await page.evaluate(() => window.__sameDocument), true, "page was reloaded");
const probe = (page) => page.evaluate(() => getComputedStyle(document.querySelector("#pp-stage svg")).getPropertyValue("--probe").trim());

// Relative luminance of a computed rgb() color, 0 (black) to 1 (white).
const luminance = (rgb) => {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const pageBackground = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

// A PATH with fake `open` and `xdg-open` that record how they were called.
function fakeOpeners() {
  const dir = tempDir();
  const log = join(dir, "opened.log");
  for (const name of ["open", "xdg-open"]) {
    const script = join(dir, name);
    writeFileSync(script, `#!/bin/sh\nprintf '%s' "${name}" >> "${log}"\nfor a in "$@"; do printf ' [%s]' "$a" >> "${log}"; done\necho >> "${log}"\n`);
    chmodSync(script, 0o755);
  }
  return { env: { ...process.env, PATH: `${dir}:${process.env.PATH}` }, log };
}

const freePort = () => new Promise((resolve) => {
  const server = createServer().listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

// --- Contracts --------------------------------------------------------------

test("PREVIEW-CON-001 without -n the URL is opened with the platform's opener", async () => {
  // @spec PREVIEW-CON-001
  const { diagram } = project();
  const { env, log } = fakeOpeners();
  await withPreview([diagram], async ({ url }) => {
    const line = await waitFor(() => existsSync(log) && readFileSync(log, "utf8"), 3000);
    const opener = process.platform === "darwin" ? "open" : "xdg-open";
    assert.equal(line, `${opener} [${url}]\n`);
  }, { env });
});

test("PREVIEW-CON-002 -B APP opens the URL with open -a APP on macOS", { skip: process.platform !== "darwin" && "macOS only" }, async () => {
  // @spec PREVIEW-CON-002
  const { diagram } = project();
  const { env, log } = fakeOpeners();
  await withPreview([diagram, "-B", "Some Browser"], async ({ url }) => {
    const line = await waitFor(() => existsSync(log) && readFileSync(log, "utf8"), 3000);
    assert.equal(line, `open [-a] [Some Browser] [${url}]\n`);
  }, { env });
});

test("PREVIEW-CON-003 -n opens nothing", async () => {
  // @spec PREVIEW-CON-003
  const { diagram } = project();
  const { env, log } = fakeOpeners();
  await withPreview([diagram, "-n"], async () => {
    await sleep(1000);
    assert.equal(existsSync(log), false);
  }, { env });
});

// --- End-to-end -------------------------------------------------------------

test("PREVIEW-E2E-001 preview serves the page and prints its URL", async () => {
  // @spec PREVIEW-E2E-001
  const { diagram, stylesheet } = project({ css: SCHEMED });
  await withPreview([diagram, stylesheet, "-n"], async ({ url, out }) => {
    assert.match(out.stdout, /^pele-preview: http:\/\/127\.0\.0\.1:\d+\/ {2}\(Ctrl-C to stop\)\n/m);
    const page = await open(url);
    assert.match(await stageText(page), /First/);
    await page.close();
  });
});

test("PREVIEW-E2E-002 -p picks the port; without it the OS picks one", async () => {
  // @spec PREVIEW-E2E-002
  const { diagram } = project();
  const port = await freePort();
  await withPreview([diagram, "-n", "-p", String(port)], async ({ url }) => {
    assert.equal(url, `http://127.0.0.1:${port}/`);
  });
  for (const args of [[], ["-p", "0"]]) {
    await withPreview([diagram, "-n", ...args], async ({ url }) => {
      assert.ok(Number(new URL(url).port) > 0);
      assert.equal((await fetch(url)).status, 200);
    });
  }
});

test("PREVIEW-E2E-003 a -p that isn't a whole number from 0 to 65535 exits 2", () => {
  // @spec PREVIEW-E2E-003
  const { diagram } = project();
  for (const port of ["abc", "65536", "1.5", "99999999"]) {
    const result = spawnSync(process.execPath, [bin, diagram, "-n", "-p", port], { encoding: "utf8", timeout: 5000 });
    assert.equal(result.status, 2, port);
    assert.match(result.stderr, /^--port must be /);
  }
});

test("PREVIEW-E2E-004 the page shows what -o with the same --scheme writes", async () => {
  // @spec PREVIEW-E2E-004
  const { dir, diagram, stylesheet } = project({ css: `${SCHEMED}\n.pele-node > rect { stroke-width: 3px; }` });
  for (const scheme of ["auto", "light", "dark"]) {
    const file = join(dir, `${scheme}.svg`);
    const exported = spawnSync(process.execPath, [bin, diagram, stylesheet, "--scheme", scheme, "-o", file]);
    assert.equal(exported.status, 0);
    const svg = readFileSync(file, "utf8");
    await withPreview([diagram, stylesheet, "-n", "--scheme", scheme], async ({ url }) => {
      const page = await open(url);
      // Compare as XML: the stylesheet's text, then everything else.
      const [shown, expected] = await page.evaluate((text) => [
        document.querySelector("#pp-stage svg"),
        new DOMParser().parseFromString(text, "image/svg+xml").documentElement,
      ].map((root) => {
        const copy = root.cloneNode(true);
        const style = copy.querySelector("style");
        const css = style?.textContent ?? null;
        if (style) style.textContent = "";
        return { css, rest: new XMLSerializer().serializeToString(copy) };
      }), svg);
      assert.deepEqual(shown, expected, scheme);
      await page.close();
    });
  }
});

test("PREVIEW-E2E-005 with --scheme auto the diagram and page follow the browser, without a reload", async () => {
  // @spec PREVIEW-E2E-005
  const { diagram, stylesheet } = project({ css: SCHEMED });
  await withPreview([diagram, stylesheet, "-n"], async ({ url }) => {
    const page = await open(url, "light");
    assert.equal(await probe(page), "light");
    assert.ok(luminance(await pageBackground(page)) > 0.5);

    await page.emulateMedia({ colorScheme: "dark" });
    assert.equal(await probe(page), "dark");
    assert.ok(luminance(await pageBackground(page)) < 0.5);
    await notReloaded(page);
    await page.close();
  });
});

test("PREVIEW-E2E-006 with --scheme light or dark the page uses it whatever the browser says", async () => {
  // @spec PREVIEW-E2E-006
  const { diagram, stylesheet } = project({ css: SCHEMED });
  for (const [scheme, viewer, isDark] of [["dark", "light", true], ["light", "dark", false]]) {
    await withPreview([diagram, stylesheet, "-n", "--scheme", scheme], async ({ url }) => {
      const page = await open(url, viewer);
      await page.waitForFunction((s) => document.documentElement.dataset.scheme === s, scheme);
      assert.equal(luminance(await pageBackground(page)) < 0.5, isDark, `${scheme} page in a ${viewer} browser`);
      assert.equal(await probe(page), scheme);
      await page.close();
    });
  }
});

test("PREVIEW-E2E-007 the diagram's area is painted with --pele-bg, white by default", async () => {
  // @spec PREVIEW-E2E-007
  const area = (page) => page.evaluate(() => getComputedStyle(document.querySelector("#pp-stage svg")).backgroundColor);
  for (const [css, expected] of [[".pele { --pele-bg: rgb(1, 2, 3); }", "rgb(1, 2, 3)"], [null, "rgb(255, 255, 255)"]]) {
    const { diagram, stylesheet } = project({ css });
    await withPreview([diagram, ...(stylesheet ? [stylesheet] : []), "-n"], async ({ url }) => {
      for (const viewer of ["light", "dark"]) {
        const page = await open(url, viewer);
        assert.equal(await area(page), expected, `${css} in a ${viewer} browser`);
        await page.close();
      }
    });
  }
});

test("PREVIEW-E2E-008 saving the diagram or stylesheet updates the page without a reload", async () => {
  // @spec PREVIEW-E2E-008
  const { diagram, stylesheet } = project({ css: ".pele { --probe: one; }" });
  await withPreview([diagram, stylesheet, "-n"], async ({ url }) => {
    const page = await open(url);
    writeFileSync(diagram, flow("Second"));
    await showsLabel(page, "Second");
    writeFileSync(stylesheet, ".pele { --probe: two; }");
    await page.waitForFunction(() =>
      getComputedStyle(document.querySelector("#pp-stage svg")).getPropertyValue("--probe").trim() === "two", null, { timeout: 3000 });
    await notReloaded(page);
    await page.close();
  });
});

test("PREVIEW-E2E-009 a save that replaces the file by rename still updates the page", async () => {
  // @spec PREVIEW-E2E-009
  const { diagram } = project();
  await withPreview([diagram, "-n"], async ({ url }) => {
    const page = await open(url);
    for (const label of ["Renamed", "Renamed again"]) {
      writeFileSync(`${diagram}.tmp`, flow(label));
      renameSync(`${diagram}.tmp`, diagram);
      await showsLabel(page, label);
    }
    await page.close();
  });
});

test("PREVIEW-E2E-010 each successful render after a save prints rendered (revision N)", async () => {
  // @spec PREVIEW-E2E-010
  const { diagram } = project();
  await withPreview([diagram, "-n"], async ({ out }) => {
    writeFileSync(diagram, flow("Second"));
    await waitFor(() => /^rendered \(revision 2\)$/m.test(out.stdout), 3000, () => out.stdout);
    await sleep(300);
    writeFileSync(diagram, flow("Third"));
    await waitFor(() => /^rendered \(revision 3\)$/m.test(out.stdout), 3000, () => out.stdout);
  });
});

const errorBanner = (page) => page.evaluate(() => {
  const error = document.querySelector("#pp-error");
  const stage = document.querySelector("#pp-stage");
  const box = (el) => el.getBoundingClientRect();
  const style = getComputedStyle(stage);
  return {
    shown: getComputedStyle(error).display !== "none" && box(error).height > 0,
    text: error.textContent,
    above: box(error).bottom <= box(stage).top + 1,
    greyed: Number(style.opacity) < 1 && style.filter.includes("grayscale"),
  };
});

test("PREVIEW-E2E-011 a failed render keeps the last diagram, greyed, under the error", async () => {
  // @spec PREVIEW-E2E-011
  const { diagram } = project();
  await withPreview([diagram, "-n"], async ({ url }) => {
    const page = await open(url);
    writeFileSync(diagram, BROKEN);
    await page.waitForFunction(() => document.querySelector("#pp-error").textContent.length > 0, null, { timeout: 3000 });
    const banner = await errorBanner(page);
    assert.ok(banner.shown, "error shown");
    assert.match(banner.text, /d\.mmd:2:9: Parse error/);
    assert.ok(banner.above, "error above the diagram");
    assert.ok(banner.greyed, "diagram greyed out");
    assert.match(await stageText(page), /First/);
    await page.close();
  });
});

test("PREVIEW-E2E-012 a failed render prints the error and keeps serving, even at startup", async () => {
  // @spec PREVIEW-E2E-012
  const { diagram } = project({ mmd: BROKEN });
  await withPreview([diagram, "-n"], async ({ url, out }) => {
    assert.match(out.stderr, /d\.mmd:2:9: Parse error/);
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector("#pp-error").textContent.includes("Parse error"), null, { timeout: 3000 });

    writeFileSync(diagram, flow("Fixed"));
    await showsLabel(page, "Fixed");
    const before = out.stderr.length;
    writeFileSync(diagram, BROKEN);
    await waitFor(() => out.stderr.slice(before).includes("Parse error"), 3000, () => out.stderr);
    assert.equal((await fetch(url)).status, 200);
    await page.close();
  });
});

test("PREVIEW-E2E-013 rendering again after a failure clears the error", async () => {
  // @spec PREVIEW-E2E-013
  const { diagram } = project();
  await withPreview([diagram, "-n"], async ({ url }) => {
    const page = await open(url);
    writeFileSync(diagram, BROKEN);
    await page.waitForFunction(() => document.querySelector("#pp-error").textContent.length > 0, null, { timeout: 3000 });
    writeFileSync(diagram, flow("Recovered"));
    await showsLabel(page, "Recovered");
    const banner = await errorBanner(page);
    assert.equal(banner.shown, false);
    assert.equal(banner.greyed, false);
    await page.close();
  });
});

test("PREVIEW-E2E-014 Ctrl-C stops the preview with exit 0", async () => {
  // @spec PREVIEW-E2E-014
  const { diagram } = project();
  const p = await preview([diagram, "-n"]);
  assert.deepEqual(await p.stop(), { code: 0, signal: null });
});

test("PREVIEW-E2E-015 a server that can't start prints the reason and exits 1", async () => {
  // @spec PREVIEW-E2E-015
  const { diagram } = project();
  const busy = createServer();
  await new Promise((resolve) => busy.listen(0, "127.0.0.1", resolve));
  try {
    const result = spawnSync(process.execPath, [bin, diagram, "-n", "-p", String(busy.address().port)], { encoding: "utf8", timeout: 5000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^could not start server: .*EADDRINUSE/);
  } finally {
    busy.close();
  }
});

// --- Invariants -------------------------------------------------------------

const outsideAddresses = () => Object.values(networkInterfaces()).flat()
  .filter((a) => !a.internal && a.family === "IPv4").map((a) => a.address);

test("PREVIEW-INV-001 the server refuses connections on every non-loopback address", { skip: outsideAddresses().length === 0 && "no network interface" }, async () => {
  // @spec PREVIEW-INV-001
  const { diagram } = project();
  await withPreview([diagram, "-n"], async ({ url }) => {
    const port = Number(new URL(url).port);
    for (const host of outsideAddresses()) {
      const outcome = await new Promise((resolve) => {
        const socket = connect({ host, port });
        socket.setTimeout(2000, () => { socket.destroy(); resolve("timeout"); });
        socket.once("connect", () => { socket.destroy(); resolve("connected"); });
        socket.once("error", (e) => resolve(e.code));
      });
      assert.notEqual(outcome, "connected", `${host}:${port}`);
    }
  });
});

test("PREVIEW-INV-002 previewing never writes or changes a file", async () => {
  // @spec PREVIEW-INV-002
  const save = fc.oneof(
    fc.constantFrom("diagram", "stylesheet").map((file) => ({ file, how: "write" })),
    fc.constantFrom("diagram", "stylesheet").map((file) => ({ file, how: "rename" })),
    fc.constant({ file: "diagram", how: "broken" }),
  );
  await fc.assert(fc.asyncProperty(fc.array(save, { minLength: 1, maxLength: 5 }), async (saves) => {
    const { dir, diagram, stylesheet } = project({ css: SCHEMED });
    const expected = { "d.mmd": readFileSync(diagram, "utf8"), "s.css": SCHEMED };
    await withPreview([diagram, stylesheet, "-n"], async ({ url, cwd }) => {
      const page = await open(url);
      for (const [i, { file, how }] of saves.entries()) {
        const path = file === "diagram" ? diagram : stylesheet;
        const text = how === "broken" ? BROKEN : file === "diagram" ? flow(`Save ${i}`) : `${SCHEMED}\n/* ${i} */`;
        if (how === "rename") { writeFileSync(`${path}.tmp`, text); renameSync(`${path}.tmp`, path); }
        else writeFileSync(path, text);
        expected[file === "diagram" ? "d.mmd" : "s.css"] = text;
        await sleep(250);
      }
      await page.close();
      assert.deepEqual(readdirSync(dir).sort(), ["d.mmd", "s.css"]);
      for (const [name, text] of Object.entries(expected)) assert.equal(readFileSync(join(dir, name), "utf8"), text, name);
      assert.deepEqual(readdirSync(cwd), []);
    });
  }), { numRuns: 4 });
});

// --- Monitors ---------------------------------------------------------------

test("PREVIEW-MON-001 a save shows on the page within 1 second", async () => {
  // @spec PREVIEW-MON-001
  const { diagram } = project();
  await withPreview([diagram, "-n"], async ({ url }) => {
    const page = await open(url);
    for (const label of ["Quick one", "Quick two", "Quick three"]) {
      const started = Date.now();
      writeFileSync(diagram, flow(label));
      await showsLabel(page, label);
      const elapsed = Date.now() - started;
      assert.ok(elapsed < 1000, `${label} took ${elapsed} ms`);
      await sleep(200);
    }
    await page.close();
  });
});

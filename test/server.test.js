// Internal tests of part of the Preview subsystem. A redesign may rewrite or
// delete them; the PREVIEW evals (test/evals/preview.test.js) must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../src/server.js";

const get = async (url) => {
  const res = await fetch(url);
  return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
};

// render() returns one svg per color scheme.
const every = (svg) => ({ auto: svg, light: svg, dark: svg });

test("serves page, diagram and state on loopback", async () => {
  const server = await startServer({ port: 0, render: () => every("<svg>one</svg>") });
  try {
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    assert.deepEqual(server.initial, { revision: 1, error: null });

    const page = await get(server.url);
    assert.equal(page.status, 200);
    assert.match(page.body, /EventSource\("\/events"\)/);

    const svg = await get(`${server.url}diagram.svg`);
    assert.equal(svg.type, "image/svg+xml; charset=utf-8");
    assert.equal(svg.body, "<svg>one</svg>");

    assert.deepEqual(JSON.parse((await get(`${server.url}state.json`)).body), { revision: 1, error: null, scheme: "auto" });
    assert.equal((await get(`${server.url}nope`)).status, 404);
  } finally {
    await server.close();
  }
});

test("a failed render keeps the last good svg and reports the error", async () => {
  let fail = false;
  const server = await startServer({
    port: 0,
    render: () => { if (fail) throw new Error("boom"); return every("<svg>good</svg>"); },
    describe: (e) => `d.mmd: ${e.message}`,
  });
  try {
    fail = true;
    const state = server.refresh();
    assert.equal(state.revision, 2);
    assert.equal(state.error, "d.mmd: boom");
    assert.equal((await get(`${server.url}diagram.svg`)).body, "<svg>good</svg>");
    assert.deepEqual(JSON.parse((await get(`${server.url}state.json`)).body), { revision: 2, error: "d.mmd: boom", scheme: "auto" });
  } finally {
    await server.close();
  }
});

test("refresh pushes the new revision to event listeners", async () => {
  let n = 0;
  const server = await startServer({ port: 0, render: () => every(`<svg>${++n}</svg>`) });
  try {
    const res = await fetch(`${server.url}events`);
    assert.equal(res.headers.get("content-type"), "text/event-stream");
    const reader = res.body.getReader();
    const next = async () => new TextDecoder().decode((await reader.read()).value);

    assert.equal(await next(), "data: 1\n\n");
    server.refresh();
    assert.equal(await next(), "data: 2\n\n");
    await reader.cancel();
  } finally {
    await server.close();
  }
});

test("?scheme= picks which svg is served; the starting scheme is in state.json", async () => {
  const server = await startServer({
    port: 0,
    scheme: "dark",
    render: () => ({ auto: "<svg>A</svg>", light: "<svg>L</svg>", dark: "<svg>D</svg>" }),
  });
  try {
    assert.equal((await get(`${server.url}diagram.svg?scheme=light`)).body, "<svg>L</svg>");
    assert.equal((await get(`${server.url}diagram.svg?scheme=dark`)).body, "<svg>D</svg>");
    assert.equal((await get(`${server.url}diagram.svg`)).body, "<svg>A</svg>");
    assert.equal((await get(`${server.url}diagram.svg?scheme=blue`)).body, "<svg>A</svg>");
    assert.equal(JSON.parse((await get(`${server.url}state.json`)).body).scheme, "dark");
  } finally {
    await server.close();
  }
});

test("the page has a scheme toggle", async () => {
  const server = await startServer({ port: 0, render: () => every("<svg/>") });
  try {
    const page = (await get(server.url)).body;
    for (const scheme of ["auto", "light", "dark"]) assert.match(page, new RegExp(`data-scheme="${scheme}"`));
  } finally {
    await server.close();
  }
});

test("without describe, a failed render reports the error's message", async () => {
  let fail = false;
  const server = await startServer({ port: 0, render: () => { if (fail) throw new Error("boom"); return every("<svg/>"); } });
  try {
    fail = true;
    assert.equal(server.refresh().error, "boom");
  } finally {
    await server.close();
  }
});

test("before any render succeeds, the diagram is empty", async () => {
  const server = await startServer({ port: 0, render: () => { throw new Error("broken"); } });
  try {
    assert.equal((await get(`${server.url}diagram.svg`)).body, "");
  } finally {
    await server.close();
  }
});

// Internal tests of part of the Preview subsystem. A redesign may rewrite or
// delete them; the PREVIEW evals (test/evals/preview.test.js) must keep passing.
import { startServer } from "../src/server.js";

const get = async (url) => {
  const res = await fetch(url);
  return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
};
const state = async (server) => JSON.parse((await get(`${server.url}state.json`)).body);

// Runs `body(server)` against a started server, always closing it.
async function withServer(options, body) {
  const server = await startServer({ port: 0, ...options });
  try {
    await body(server);
  } finally {
    await server.close();
  }
}

describe("startServer", () => {
  it("serves the page, diagram and state on loopback", () => withServer({ render: () => "<svg>one</svg>" }, async (server) => {
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(server.initial).toEqual({ revision: 1, error: null });

    const page = await get(server.url);
    expect(page.status).toBe(200);
    expect(page.body).toMatch(/EventSource\("\/events"\)/);

    const svg = await get(`${server.url}diagram.svg`);
    expect(svg.type).toBe("image/svg+xml; charset=utf-8");
    expect(svg.body).toBe("<svg>one</svg>");

    expect(await state(server)).toEqual({ revision: 1, error: null, scheme: "auto" });
    expect((await get(`${server.url}nope`)).status).toBe(404);
  }));

  it("keeps the last good svg after a failed render, and reports the error", async () => {
    let fail = false;
    const render = () => { if (fail) throw new Error("boom"); return "<svg>good</svg>"; };
    await withServer({ render, describe: (e) => `d.mmd: ${e.message}` }, async (server) => {
      fail = true;
      const refreshed = server.refresh();
      expect(refreshed.revision).toBe(2);
      expect(refreshed.error).toBe("d.mmd: boom");
      expect((await get(`${server.url}diagram.svg`)).body).toBe("<svg>good</svg>");
      expect(await state(server)).toEqual({ revision: 2, error: "d.mmd: boom", scheme: "auto" });
    });
  });

  it("pushes each new revision to event listeners", async () => {
    let n = 0;
    await withServer({ render: () => `<svg>${++n}</svg>` }, async (server) => {
      const res = await fetch(`${server.url}events`);
      expect(res.headers.get("content-type")).toBe("text/event-stream");
      const reader = res.body.getReader();
      const next = async () => new TextDecoder().decode((await reader.read()).value);

      expect(await next()).toBe("data: 1\n\n");
      server.refresh();
      expect(await next()).toBe("data: 2\n\n");
      await reader.cancel();
    });
  });

  it("serves the one svg render returns, and says in state.json which scheme the page shows", () =>
    withServer({ scheme: "dark", render: () => "<svg>D</svg>" }, async (server) => {
      expect((await get(`${server.url}diagram.svg`)).body).toBe("<svg>D</svg>");
      expect((await get(`${server.url}diagram.svg?scheme=light`)).body).toBe("<svg>D</svg>");
      expect((await state(server)).scheme).toBe("dark");
    }));

  it("reports a failed render's message when there is no describe", async () => {
    let fail = false;
    await withServer({ render: () => { if (fail) throw new Error("boom"); return "<svg/>"; } }, async (server) => {
      fail = true;
      expect(server.refresh().error).toBe("boom");
    });
  });

  it("serves an empty diagram before any render succeeds", () =>
    withServer({ render: () => { throw new Error("broken"); } }, async (server) => {
      expect((await get(`${server.url}diagram.svg`)).body).toBe("");
    }));
});

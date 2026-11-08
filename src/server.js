import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PAGE = readFileSync(new URL("./page.html", import.meta.url));

// Serves the current render on 127.0.0.1. `render` returns
// { auto, light, dark }, one SVG per scheme, or throws; `describe` turns the
// thrown error into the text shown to the user. A failed render keeps the last
// good SVGs on screen. `scheme` is what the page starts on.
export function startServer({ port = 0, render, describe = (e) => e.message, scheme = "auto" }) {
  const state = { revision: 0, svgs: {}, error: null };
  const listeners = new Set();

  const refresh = () => {
    try {
      state.svgs = render();
      state.error = null;
    } catch (error) {
      state.error = describe(error);
    }
    state.revision += 1;
    for (const res of listeners) res.write(`data: ${state.revision}\n\n`);
    return { revision: state.revision, error: state.error };
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    switch (url.pathname) {
      case "/":
        return send(res, "text/html; charset=utf-8", PAGE);
      case "/diagram.svg":
        return send(res, "image/svg+xml; charset=utf-8", svgFor(url.searchParams));
      case "/state.json":
        return send(res, "application/json", JSON.stringify({
          revision: state.revision, error: state.error, scheme,
        }));
      case "/events":
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
        res.write(`data: ${state.revision}\n\n`);
        listeners.add(res);
        req.on("close", () => listeners.delete(res));
        return;
      default:
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
    }
  });

  // Unknown schemes fall back to auto.
  const svgFor = (params) => {
    const wanted = params.get("scheme");
    return (Object.hasOwn(state.svgs, wanted) ? state.svgs[wanted] : state.svgs.auto) ?? "";
  };

  const initial = refresh();

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}/`,
        initial,
        refresh,
        close: () => new Promise((done) => {
          for (const res of listeners) res.end();
          server.close(done);
          server.closeAllConnections();
        }),
      });
    });
  });
}

function send(res, type, body) {
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

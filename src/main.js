// The pele-laka command: parses the arguments, then exports or previews.
import { parse, UsageError, HelpRequested } from "./cli.js";
import { readAndCompose, describeError } from "./compose.js";
import { exportFiles } from "./export.js";
import { startServer } from "./server.js";
import { watchFiles } from "./watcher.js";
import { launch } from "./browser.js";

const options = parseOrExit(process.argv.slice(2));
const describe = (error) => describeError(error, options.diagram);

if (options.command === "export") {
  process.exitCode = await exportFiles(options);
} else {
  await preview();
}

function parseOrExit(argv) {
  try {
    return parse(argv);
  } catch (error) {
    if (error instanceof HelpRequested) {
      console.log(error.message);
      process.exit(0);
    }
    if (error instanceof UsageError) {
      console.error(error.message);
      process.exit(2);
    }
    throw error;
  }
}

// @subsystem Preview
async function preview() {
  let server;
  try {
    server = await startServer({
      port: options.port,
      scheme: options.scheme,
      render: () => readAndCompose(options),
      describe,
    });
  } catch (error) {
    console.error(`could not start server: ${error.message}`);
    process.exit(1);
  }

  const report = ({ revision, error }) =>
    error ? console.error(error) : console.log(`rendered (revision ${revision})`);
  if (server.initial.error) console.error(server.initial.error);

  const files = [options.diagram, options.stylesheet].filter(Boolean);
  const watcher = watchFiles(files, () => report(server.refresh()));

  // Listen for Ctrl-C before printing the URL: whoever reads the URL may stop
  // the preview at once.
  process.once("SIGINT", async () => {
    watcher.close();
    await server.close();
    process.exit(0);
  });

  console.log(`pele-laka: ${server.url}  (Ctrl-C to stop)`);
  if (options.open) launch(server.url, { app: options.browserApp });
}

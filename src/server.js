import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDemoReport, generateAttentionReport, readPersistedReport } from "./attention.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const publicRoot = path.join(projectRoot, "public");
const persistedReportPath = path.join(publicRoot, "data", "latest-report.json");
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

async function loadReport() {
  try {
    return await readPersistedReport(persistedReportPath);
  } catch {
    return createDemoReport();
  }
}

async function serveStatic(response, requestPath) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const absolutePath = path.join(publicRoot, normalizedPath);

  if (!absolutePath.startsWith(publicRoot)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const file = await readFile(absolutePath);
    const ext = path.extname(absolutePath);
    response.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    response.end(file);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      repository: process.env.GITHUB_REPOSITORY || null,
      mode: process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY ? "live-capable" : "demo",
    });
    return;
  }

  if (url.pathname === "/api/report") {
    if (url.searchParams.get("live") === "1" && process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
      try {
        const liveReport = await generateAttentionReport({
          token: process.env.GITHUB_TOKEN,
          repository: process.env.GITHUB_REPOSITORY,
        });
        sendJson(response, 200, liveReport);
        return;
      } catch (error) {
        sendJson(response, 502, {
          error: "Live scan failed.",
          detail: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    }

    sendJson(response, 200, await loadReport());
    return;
  }

  if (url.pathname === "/api/demo-report") {
    sendJson(response, 200, createDemoReport());
    return;
  }

  await serveStatic(response, url.pathname);
}).listen(port, () => {
  console.log(`Attention Scan is running at http://localhost:${port}`);
});

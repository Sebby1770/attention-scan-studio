import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectConfig } from "../src/config.js";
import { buildSiteData } from "../src/site-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

async function main() {
  const projectConfig = await loadProjectConfig(projectRoot);
  const result = await buildSiteData({ projectRoot, projectConfig });

  console.log(`Site config written to ${result.siteConfigPath}`);
  console.log(`Changelog data written to ${result.changelogPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

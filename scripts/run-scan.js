import { fileURLToPath } from "node:url";
import path from "node:path";
import { appendFile, mkdir, writeFile } from "node:fs/promises";

import {
  createDemoReport,
  generateAttentionReport,
  persistReport,
  toMarkdown,
  upsertReportIssue,
} from "../src/attention.js";
import { createScanConfig, loadProjectConfig, resolveRepository } from "../src/config.js";
import { updateReportHistory } from "../src/history.js";
import { buildSiteData } from "../src/site-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

async function main() {
  const projectConfig = await loadProjectConfig(projectRoot);
  const config = createScanConfig(projectConfig);
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  const repository = resolveRepository(projectConfig);
  await buildSiteData({ projectRoot, projectConfig });

  const report = repository && token
    ? await generateAttentionReport({ token, repository, config })
    : createDemoReport({
        repository: repository || "owner/repo",
        reason: "No live GitHub credentials were provided, so a demo report was generated.",
      });

  const { jsonPath, markdownPath } = await persistReport(report, { projectRoot });
  const { historyPath } = await updateReportHistory(report, { projectRoot });
  const markdown = toMarkdown(report);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, "utf8");
  }

  if (process.env.WRITE_REPORT_ISSUE === "true" && token && repository) {
    const issueUrl = await upsertReportIssue({
      token,
      repository,
      title: process.env.REPORT_TITLE || "Attention Scan Report",
      label: process.env.REPORT_LABEL || "",
      body: markdown,
    });

    await mkdir(path.join(projectRoot, "artifacts"), { recursive: true });
    await writeFile(
      path.join(projectRoot, "artifacts", "report-meta.json"),
      `${JSON.stringify({ issueUrl, repository, generatedAt: report.meta.generatedAt }, null, 2)}\n`,
      "utf8",
    );
  }

  console.log(`Report JSON written to ${jsonPath}`);
  console.log(`Report markdown written to ${markdownPath}`);
  console.log(`Report history written to ${historyPath}`);
  console.log(`Summary: ${report.summary}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

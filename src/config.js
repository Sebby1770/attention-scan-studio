import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = path.resolve(__dirname, "..");

const DEFAULT_CONFIG = {
  repository: "",
  site: {
    title: "Attention Scan",
    eyebrow: "GitHub attention intelligence",
    heroTitle: "Attention Scan turns repo chaos into a signal field.",
    heroBody:
      "A sharp dashboard for pull requests, issue drift, and CI breakage. The frontend is visual and atmospheric. The backend is modular, scored, and reusable from both local preview and GitHub Actions.",
    description: "An abstract GitHub attention radar with a live dashboard and automated repo triage.",
    repoUrl: "",
    siteUrl: "",
  },
  scan: {
    staleDays: 7,
    reviewGraceDays: 3,
    triageDays: 2,
    failedRunLimit: 10,
    reportTitle: "Attention Scan Report",
  },
};

function mergeConfig(rawConfig = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...rawConfig,
    site: {
      ...DEFAULT_CONFIG.site,
      ...(rawConfig.site || {}),
    },
    scan: {
      ...DEFAULT_CONFIG.scan,
      ...(rawConfig.scan || {}),
    },
  };
}

export async function loadProjectConfig(projectRoot = defaultProjectRoot) {
  const configPath = path.join(projectRoot, "attention.config.json");

  try {
    const file = await readFile(configPath, "utf8");
    return mergeConfig(JSON.parse(file));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return mergeConfig();
    }

    throw error;
  }
}

export function createScanConfig(projectConfig) {
  return {
    staleDays: Number(process.env.STALE_DAYS || projectConfig.scan.staleDays || 7),
    reviewGraceDays: Number(process.env.REVIEW_GRACE_DAYS || projectConfig.scan.reviewGraceDays || 3),
    triageDays: Number(process.env.TRIAGE_DAYS || projectConfig.scan.triageDays || 2),
    failedRunLimit: Number(process.env.FAILED_RUN_LIMIT || projectConfig.scan.failedRunLimit || 10),
    reportTitle: process.env.REPORT_TITLE || projectConfig.scan.reportTitle || "Attention Scan Report",
  };
}

export function resolveRepository(projectConfig) {
  return process.env.GITHUB_REPOSITORY || process.env.ATTENTION_REPOSITORY || projectConfig.repository || "";
}

export { defaultProjectRoot };

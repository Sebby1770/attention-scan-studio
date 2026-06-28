import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export function createHistorySnapshot(report) {
  return {
    generatedAt: report.meta.generatedAt,
    pulse: report.meta.pulse || "watch",
    totalAttentionCount: report.metrics.totalAttentionCount ?? 0,
    immediateCount: report.metrics.immediateCount ?? 0,
    reviewQueueCount: report.metrics.reviewQueueCount ?? 0,
    issueTriageCount: report.metrics.issueTriageCount ?? 0,
    workflowFailureCount: report.metrics.workflowFailureCount ?? 0,
    staleCount: report.metrics.staleCount ?? 0,
    openPullRequests: report.metrics.openPullRequests ?? 0,
    openIssues: report.metrics.openIssues ?? 0,
  };
}

export function summarizeHistory(history) {
  if (history.length === 0) {
    return {
      direction: "flat",
      delta: 0,
      label: "No scan history yet",
    };
  }

  if (history.length === 1) {
    return {
      direction: "flat",
      delta: 0,
      label: "First scan captured",
    };
  }

  const latest = history.at(-1);
  const previous = history.at(-2);
  const delta = latest.totalAttentionCount - previous.totalAttentionCount;

  if (delta > 0) {
    return {
      direction: "up",
      delta,
      label: `Attention increased by ${delta}`,
    };
  }

  if (delta < 0) {
    return {
      direction: "down",
      delta,
      label: `Attention dropped by ${Math.abs(delta)}`,
    };
  }

  return {
    direction: "flat",
    delta,
    label: "Attention is steady",
  };
}

export async function readReportHistory(historyPath) {
  try {
    const file = await readFile(historyPath, "utf8");
    const parsed = JSON.parse(file);
    return Array.isArray(parsed.history) ? parsed.history : [];
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function updateReportHistory(report, {
  projectRoot,
  historyRelativePath = "public/data/history.json",
  limit = 30,
} = {}) {
  const historyPath = path.join(projectRoot, historyRelativePath);
  const existingHistory = await readReportHistory(historyPath);
  const snapshot = createHistorySnapshot(report);
  const history = [...existingHistory.filter((entry) => entry.generatedAt !== snapshot.generatedAt), snapshot]
    .sort((left, right) => new Date(left.generatedAt) - new Date(right.generatedAt))
    .slice(-limit);
  const summary = summarizeHistory(history);

  await mkdir(path.dirname(historyPath), { recursive: true });
  await writeFile(historyPath, `${JSON.stringify({ history, summary }, null, 2)}\n`, "utf8");

  return {
    history,
    summary,
    historyPath,
  };
}

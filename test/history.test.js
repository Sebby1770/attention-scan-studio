import test from "node:test";
import assert from "node:assert/strict";

import { createHistorySnapshot, summarizeHistory } from "../src/history.js";

test("createHistorySnapshot keeps the trend fields compact", () => {
  const snapshot = createHistorySnapshot({
    meta: {
      generatedAt: "2026-06-28T00:00:00.000Z",
      pulse: "calm",
    },
    metrics: {
      totalAttentionCount: 2,
      immediateCount: 1,
      reviewQueueCount: 1,
      issueTriageCount: 0,
      workflowFailureCount: 0,
      staleCount: 0,
      openPullRequests: 3,
      openIssues: 5,
    },
  });

  assert.deepEqual(snapshot, {
    generatedAt: "2026-06-28T00:00:00.000Z",
    pulse: "calm",
    totalAttentionCount: 2,
    immediateCount: 1,
    reviewQueueCount: 1,
    issueTriageCount: 0,
    workflowFailureCount: 0,
    staleCount: 0,
    openPullRequests: 3,
    openIssues: 5,
  });
});

test("summarizeHistory reports direction from the last two scans", () => {
  const summary = summarizeHistory([
    { generatedAt: "2026-06-27T00:00:00.000Z", totalAttentionCount: 5 },
    { generatedAt: "2026-06-28T00:00:00.000Z", totalAttentionCount: 2 },
  ]);

  assert.equal(summary.direction, "down");
  assert.equal(summary.delta, -3);
  assert.equal(summary.label, "Attention dropped by 3");
});

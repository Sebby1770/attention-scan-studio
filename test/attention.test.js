import test from "node:test";
import assert from "node:assert/strict";

import { createDemoReport, isReportIssue, selectUnresolvedWorkflowRuns, toMarkdown } from "../src/attention.js";

test("demo report exposes ordered top actions", () => {
  const report = createDemoReport();

  assert.ok(report.topActions.length > 0);
  assert.equal(report.topActions[0].severity, "critical");
  assert.equal(report.meta.mode, "demo");
});

test("markdown output includes major sections", () => {
  const markdown = toMarkdown(createDemoReport());

  assert.match(markdown, /# Attention Scan Report/);
  assert.match(markdown, /## Top Actions/);
  assert.match(markdown, /## Workflow Failures/);
});

test("resolved workflow failures are filtered out", () => {
  const runs = [
    {
      id: 4,
      name: "Deploy Pages",
      head_branch: "main",
      conclusion: "success",
    },
    {
      id: 3,
      name: "Deploy Pages",
      head_branch: "main",
      conclusion: "failure",
    },
    {
      id: 2,
      name: "Preview",
      head_branch: "feature/x",
      conclusion: "failure",
    },
    {
      id: 1,
      name: "Attention Scan",
      head_branch: "main",
      conclusion: "failure",
    },
  ];

  const unresolved = selectUnresolvedWorkflowRuns(runs);

  assert.equal(unresolved.selected.length, 1);
  assert.equal(unresolved.selected[0].id, 2);
  assert.equal(unresolved.suppressedCount, 1);
});

test("report issue can be identified as scanner-owned noise", () => {
  assert.equal(isReportIssue({ title: "Attention Scan Report" }), true);
  assert.equal(isReportIssue({ title: "User-facing bug" }), false);
});

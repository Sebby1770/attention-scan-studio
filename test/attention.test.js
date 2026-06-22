import test from "node:test";
import assert from "node:assert/strict";

import { createDemoReport, toMarkdown } from "../src/attention.js";

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

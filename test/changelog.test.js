import test from "node:test";
import assert from "node:assert/strict";

import { parseChangelog } from "../src/changelog.js";

test("parseChangelog extracts releases, summary titles, and items", () => {
  const markdown = `# Changelog

## 0.5.0 - 2026-06-27

Summary: Config-driven site data and generated release history.

- Added a config file.
- Added a build step.

## 0.4.0 - 2026-06-26

- Added signal controls.
`;

  const parsed = parseChangelog(markdown);

  assert.equal(parsed.releases.length, 2);
  assert.equal(parsed.releases[0].version, "0.5.0");
  assert.equal(parsed.releases[0].title, "Config-driven site data and generated release history.");
  assert.deepEqual(parsed.releases[0].items, [
    "Added a config file.",
    "Added a build step.",
  ]);
  assert.equal(parsed.releases[1].title, "Release 0.4.0");
});

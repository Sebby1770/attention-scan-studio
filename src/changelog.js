import { readFile } from "node:fs/promises";
import path from "node:path";

export function parseChangelog(markdown) {
  const lines = markdown.split(/\r?\n/);
  const releases = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const headingMatch = /^##\s+(.+?)\s+-\s+(\d{4}-\d{2}-\d{2})$/.exec(line);

    if (headingMatch) {
      if (current) {
        releases.push({
          ...current,
          title: current.title || `Release ${current.version}`,
        });
      }

      current = {
        version: headingMatch[1],
        date: headingMatch[2],
        title: "",
        items: [],
      };
      continue;
    }

    if (!current || !line) {
      continue;
    }

    if (line.startsWith("Summary:")) {
      current.title = line.replace(/^Summary:\s*/, "").trim();
      continue;
    }

    if (line.startsWith("- ")) {
      current.items.push(line.slice(2).trim());
    }
  }

  if (current) {
    releases.push({
      ...current,
      title: current.title || `Release ${current.version}`,
    });
  }

  return { releases };
}

export async function readChangelog(projectRoot) {
  const changelogPath = path.join(projectRoot, "CHANGELOG.md");
  const markdown = await readFile(changelogPath, "utf8");
  return parseChangelog(markdown);
}

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { readChangelog } from "./changelog.js";

export async function buildSiteData({ projectRoot, projectConfig }) {
  const dataRoot = path.join(projectRoot, "public", "data");
  const changelogPath = path.join(dataRoot, "changelog.json");
  const siteConfigPath = path.join(dataRoot, "site-config.json");
  const changelog = await readChangelog(projectRoot);
  const repoUrl = projectConfig.site.repoUrl || (projectConfig.repository ? `https://github.com/${projectConfig.repository}` : "");

  const siteConfig = {
    repository: projectConfig.repository,
    title: projectConfig.site.title,
    eyebrow: projectConfig.site.eyebrow,
    heroTitle: projectConfig.site.heroTitle,
    heroBody: projectConfig.site.heroBody,
    description: projectConfig.site.description,
    repoUrl,
    siteUrl: projectConfig.site.siteUrl,
    latestVersion: changelog.releases[0]?.version || null,
    latestReleaseDate: changelog.releases[0]?.date || null,
    releasesCount: changelog.releases.length,
  };

  await mkdir(dataRoot, { recursive: true });
  await writeFile(changelogPath, `${JSON.stringify(changelog, null, 2)}\n`, "utf8");
  await writeFile(siteConfigPath, `${JSON.stringify(siteConfig, null, 2)}\n`, "utf8");

  return {
    changelog,
    siteConfig,
    changelogPath,
    siteConfigPath,
  };
}

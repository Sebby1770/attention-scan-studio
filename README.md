# Attention Scan

Attention Scan is a GitHub-first repo radar with two outputs:

- a scheduled scan that scores PR, issue, and CI signals
- an abstract dashboard site that turns those signals into something readable

## What changed

- Moved scan logic out of workflow YAML into reusable backend code.
- Added severity scoring, sectioned reporting, and deduplicated attention items.
- Added a static site in `public/` with a stronger visual identity and dynamic data rendering.
- Added a local server for previewing the site and loading reports.
- Added GitHub Pages deployment and artifact generation.
- Added config-driven site data generation so changelog and branding stay in sync.

## Local usage

```bash
npm run build:data
npm run scan
npm run dev
```

Optional environment variables:

```bash
export GITHUB_TOKEN=your_token
export GITHUB_REPOSITORY=owner/repo
```

Then open [http://localhost:3000](http://localhost:3000).

## Project layout

- `attention.config.json`: repository, site, and scan defaults
- `src/attention.js`: scan engine, scoring, markdown generation, and GitHub issue sync
- `src/changelog.js`: changelog parser used to generate release data
- `src/site-data.js`: static site data builder for changelog and branding assets
- `src/server.js`: local server and report API
- `scripts/build-site-data.js`: generates `public/data` artifacts from config and changelog
- `scripts/run-scan.js`: CLI entrypoint used locally and in GitHub Actions
- `public/`: website assets and generated report data
- `.github/workflows/`: scan automation and Pages deploy
- `CHANGELOG.md`: release history for repo-level changes

## Deploy

- Push to GitHub.
- Let `Deploy Pages` run on `main`.
- GitHub Pages will serve the contents of `public/`.

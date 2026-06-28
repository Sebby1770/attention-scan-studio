# Changelog

## 0.6.0 - 2026-06-28

Summary: Scan history and dashboard momentum tracking.

- Added `history.json` generation so each scan stores a compact trend snapshot.
- Added a momentum panel to the dashboard with recent scan bars and a trend summary.
- Ignored the scanner-owned report issue during issue triage so the dashboard does not flag its own output as work.
- Added history tests covering compact snapshots and attention direction labels.
- Updated the scan workflow so refreshed report commits include history data.

## 0.5.0 - 2026-06-27

Summary: Config-driven site data and generated release history.

- Added `attention.config.json` so repo, site, and scan defaults come from one source of truth.
- Added generated `site-config.json` and `changelog.json` data so the UI consumes build artifacts instead of hand-maintained duplicates.
- Added a changelog parser and site-data build step, then wired them into local runs and GitHub Actions deploys.
- Added hero release metadata and config-driven site copy on the frontend.

## 0.4.0 - 2026-06-26

Summary: Signal controls and cleaner backend truth.

- Added severity filters, repo status cards, and a release trail to the dashboard UI.
- Added richer report metadata including severity breakdown, total attention count, pulse state, and suppressed workflow-failure counts.
- Suppressed older workflow failures when a newer successful rerun on the same workflow and branch already resolved the issue.

## 0.3.0 - 2026-06-22

Summary: Pages deployment and modular scan engine.

- Rebuilt the project from a single workflow into a proper app with `public/`, `src/`, and `scripts/`.
- Added GitHub Pages deployment, a local preview server, and automated report generation.
- Added abstract visual design, modular scan logic, and GitHub issue sync for reports.

## 0.1.0 - 2026-04-23

Summary: Initial scan workflow.

- Created the original workflow-only Attention Scan automation.

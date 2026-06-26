# Changelog

## 0.4.0 - 2026-06-26

- Added severity filters, repo status cards, and a release trail to the dashboard UI.
- Added richer report metadata including severity breakdown, total attention count, pulse state, and suppressed workflow-failure counts.
- Suppressed older workflow failures when a newer successful rerun on the same workflow and branch already resolved the issue.

## 0.3.0 - 2026-06-22

- Rebuilt the project from a single workflow into a proper app with `public/`, `src/`, and `scripts/`.
- Added GitHub Pages deployment, a local preview server, and automated report generation.
- Added abstract visual design, modular scan logic, and GitHub issue sync for reports.

## 0.1.0 - 2026-04-23

- Created the original workflow-only Attention Scan automation.

const sectionTitles = {
  immediateAction: "Immediate Action",
  reviewQueue: "Review Queue",
  issueTriage: "Issue Triage",
  workflowFailures: "Workflow Failures",
  staleWork: "Stale Work",
};

const severityOptions = ["all", "critical", "high", "medium", "low"];
const state = {
  report: null,
  changelog: { releases: [] },
  siteConfig: null,
  severity: "all",
};

async function loadJson(candidates) {
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) {
        continue;
      }

      return await response.json();
    } catch {
      // Try the next source.
    }
  }

  return null;
}

async function loadReport() {
  const report = await loadJson(["./data/latest-report.json", "./api/report", "./data/demo-report.json"]);

  if (!report) {
    throw new Error("No report source could be loaded.");
  }

  return report;
}

async function loadChangelog() {
  return (await loadJson(["./data/changelog.json"])) || { releases: [] };
}

async function loadSiteConfig() {
  return (await loadJson(["./data/site-config.json"])) || null;
}

function metricCard(label, value) {
  return `
    <article class="metric-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `;
}

function statusCard(label, value, tone = "") {
  return `
    <article class="status-card ${tone}">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `;
}

function signalCard(item) {
  return `
    <article class="signal-card ${item.severity}">
      <h4><a href="${item.url}" target="_blank" rel="noreferrer">${item.title}</a></h4>
      <p>${item.summary}</p>
      <footer>
        <span class="pill">${item.severity}</span>
        <span class="pill">${item.nextAction}</span>
      </footer>
    </article>
  `;
}

function filterButton(severity, activeSeverity) {
  const isActive = severity === activeSeverity;
  const label = severity === "all" ? "All signals" : severity;

  return `
    <button class="filter-chip ${isActive ? "active" : ""}" data-severity="${severity}">
      ${label}
    </button>
  `;
}

function insightCard(text) {
  return `
    <article class="insight-card">
      <p>${text}</p>
    </article>
  `;
}

function releaseCard(release) {
  const items = release.items.map((item) => `<li>${item}</li>`).join("");

  return `
    <article class="release-card">
      <span>${release.version} · ${release.date}</span>
      <h4>${release.title}</h4>
      <ul>${items}</ul>
    </article>
  `;
}

function sectionPanel(key, items) {
  const list = items.length
    ? items
        .map(
          (item) => `
            <li>
              <a href="${item.url}" target="_blank" rel="noreferrer">${item.title}</a><br>
              ${item.summary}<br>
              <span class="pill">${item.nextAction}</span>
            </li>
          `,
        )
        .join("")
    : "<li>Nothing is currently sitting in this lane.</li>";

  return `
    <article class="section-panel">
      <h3>${sectionTitles[key]}</h3>
      <ul>${list}</ul>
    </article>
  `;
}

function filterItems(items) {
  if (state.severity === "all") {
    return items;
  }

  return items.filter((item) => item.severity === state.severity);
}

function filteredSections(report) {
  return Object.fromEntries(
    Object.entries(report.sections).map(([key, items]) => [key, filterItems(items)]),
  );
}

function bindFilters() {
  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.addEventListener("click", () => {
      state.severity = button.dataset.severity;
      render();
    });
  });
}

function hydrateSiteConfig(report, siteConfig, changelog) {
  const effectiveConfig = siteConfig || {};
  const latestRelease = changelog.releases?.[0] || null;
  const heroTitle = effectiveConfig.heroTitle || "Attention Scan turns repo chaos into a signal field.";
  const heroBody = effectiveConfig.heroBody || report.summary;
  const eyebrow = effectiveConfig.eyebrow || "GitHub attention intelligence";
  const title = effectiveConfig.title || "Attention Scan";
  const description =
    effectiveConfig.description || "An abstract GitHub attention radar with a live dashboard and automated repo triage.";
  const repoUrl = effectiveConfig.repoUrl || `https://github.com/${report.meta.repository}`;

  document.title = title;
  document.querySelector('meta[name="description"]').setAttribute("content", description);
  document.querySelector("#site-eyebrow").textContent = eyebrow;
  document.querySelector("#hero-title").textContent = heroTitle;
  document.querySelector("#hero-body").textContent = heroBody;
  document.querySelector("#repo-link").href = repoUrl;
  document.querySelector("#repo-pill").textContent = report.meta.repository;
  document.querySelector("#latest-version").textContent = latestRelease
    ? `v${latestRelease.version} · ${latestRelease.date}`
    : "No release notes yet";
}

function render() {
  const { report, changelog, siteConfig } = state;
  const sections = filteredSections(report);
  const filteredTopActions = filterItems(report.topActions);
  const visibleCount = Object.values(sections).reduce((total, items) => total + items.length, 0);
  const severityLabel = state.severity === "all" ? "all signals" : `${state.severity} signals`;
  const severityBreakdown = report.metrics.severityBreakdown || { critical: 0, high: 0, medium: 0, low: 0 };
  const pulse = report.meta.pulse || "watch";

  hydrateSiteConfig(report, siteConfig, changelog);
  document.querySelector("#report-mode").textContent = `${report.meta.mode.toUpperCase()} / ${pulse.toUpperCase()}`;
  document.querySelector("#signal-caption").textContent = report.summary;
  document.querySelector("#footer-meta").textContent = `${report.meta.repository} · ${new Date(
    report.meta.generatedAt,
  ).toLocaleString()}`;
  document.querySelector("#filter-caption").textContent = `Showing ${severityLabel}. ${visibleCount} item(s) currently match this view.`;

  document.querySelector("#metric-grid").innerHTML = [
    metricCard("Open PRs", report.metrics.openPullRequests),
    metricCard("Open issues", report.metrics.openIssues),
    metricCard("Immediate", report.metrics.immediateCount),
    metricCard("Review queue", report.metrics.reviewQueueCount),
    metricCard("Workflow failures", report.metrics.workflowFailureCount),
    metricCard("Stale work", report.metrics.staleCount),
    metricCard("Total attention", report.metrics.totalAttentionCount ?? visibleCount),
    metricCard("Suppressed failures", report.metrics.suppressedWorkflowFailures ?? 0),
  ].join("");

  document.querySelector("#filter-row").innerHTML = severityOptions
    .map((severity) => filterButton(severity, state.severity))
    .join("");
  bindFilters();

  document.querySelector("#status-ribbon").innerHTML = [
    statusCard("Pulse", pulse, pulse),
    statusCard("Source", report.meta.source),
    statusCard("Critical", severityBreakdown.critical, "critical"),
    statusCard("High", severityBreakdown.high, "high"),
  ].join("");

  document.querySelector("#top-actions").innerHTML = filteredTopActions.length
    ? filteredTopActions.map(signalCard).join("")
    : '<article class="signal-card low"><h4>Signal field is clean</h4><p>No high-pressure actions were returned in this filter.</p></article>';

  document.querySelector("#insights").innerHTML = (report.insights || [])
    .map(insightCard)
    .join("");

  document.querySelector("#sections").innerHTML = Object.entries(sections)
    .map(([key, items]) => sectionPanel(key, items))
    .join("");

  document.querySelector("#release-list").innerHTML = (changelog.releases || [])
    .map(releaseCard)
    .join("");
}

Promise.all([loadReport(), loadChangelog(), loadSiteConfig()])
  .then(([report, changelog, siteConfig]) => {
    state.report = report;
    state.changelog = changelog;
    state.siteConfig = siteConfig;
    render();
  })
  .catch((error) => {
    document.querySelector("#signal-caption").textContent = error.message;
  });

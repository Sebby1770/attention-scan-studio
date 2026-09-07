import { createChamber } from "./chamber.js";

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
  history: { history: [], summary: { direction: "flat", delta: 0, label: "No scan history yet" } },
  siteConfig: null,
  severity: "all",
};

const prefersReducedMotion =
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const chamber = createChamber({
  canvas: document.querySelector("#chamber-radar"),
  readout: document.querySelector("#chamber-readout"),
  reducedMotion: prefersReducedMotion,
  onSelect(item) {
    document.querySelectorAll(".signal-card.is-locked").forEach((card) => card.classList.remove("is-locked"));
    const node = document.querySelector(`.signal-card[data-id="${CSS.escape(item.id || item.title)}"]`);
    if (node) {
      node.classList.add("is-locked");
      node.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
    }
  },
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadJson(candidates) {
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) continue;
      return await response.json();
    } catch {
      // Try the next source.
    }
  }
  return null;
}

async function loadReport() {
  const live = await loadJson(["./data/latest-report.json", "./api/report"]);
  const demo = await loadJson(["./data/demo-report.json"]);
  if (live && (live.metrics?.totalAttentionCount || collectItems(live).length) > 0) {
    return live;
  }
  if (demo) {
    demo.meta = { ...(demo.meta || {}), mode: "rehearsal" };
    return demo;
  }
  if (live) return live;
  throw new Error("No report source could be loaded.");
}

async function loadChangelog() {
  return (await loadJson(["./data/changelog.json"])) || { releases: [] };
}

async function loadHistory() {
  return (
    (await loadJson(["./data/history.json"])) || {
      history: [],
      summary: { direction: "flat", delta: 0, label: "No scan history yet" },
    }
  );
}

async function loadSiteConfig() {
  return (await loadJson(["./data/site-config.json"])) || null;
}

function collectItems(report) {
  return Object.values(report.sections || {}).flat();
}

function metricCard(label, value) {
  return `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function statusCard(label, value, tone = "") {
  return `
    <article class="status-card ${escapeHtml(tone)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function signalCard(item) {
  const id = item.id || item.title;
  return `
    <article class="signal-card ${escapeHtml(item.severity)}" data-id="${escapeHtml(id)}">
      <h4><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h4>
      <p>${escapeHtml(item.summary)}</p>
      <footer>
        <span class="pill">${escapeHtml(item.severity)}</span>
        <span class="pill">${escapeHtml(item.nextAction)}</span>
      </footer>
    </article>
  `;
}

function filterButton(severity, activeSeverity) {
  const isActive = severity === activeSeverity;
  const label = severity === "all" ? "All signals" : severity;
  return `
    <button class="filter-chip ${isActive ? "active" : ""}" data-severity="${escapeHtml(severity)}">
      ${escapeHtml(label)}
    </button>
  `;
}

function insightCard(text) {
  return `
    <article class="insight-card">
      <p>${escapeHtml(text)}</p>
    </article>
  `;
}

function releaseCard(release) {
  const items = (release.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `
    <article class="release-card">
      <span>${escapeHtml(release.version)} · ${escapeHtml(release.date)}</span>
      <h4>${escapeHtml(release.title)}</h4>
      <ul>${items}</ul>
    </article>
  `;
}

function trendBar(entry, maxAttention) {
  const height = maxAttention === 0 ? 8 : Math.max(8, Math.round((entry.totalAttentionCount / maxAttention) * 96));
  const label = new Date(entry.generatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `
    <span class="trend-bar ${escapeHtml(entry.pulse)}" style="height: ${height}px" title="${escapeHtml(label)}: ${entry.totalAttentionCount} attention item(s)">
      <span>${entry.totalAttentionCount}</span>
    </span>
  `;
}

function sectionPanel(key, items) {
  const list = items.length
    ? items
        .map(
          (item) => `
            <li>
              <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a><br>
              ${escapeHtml(item.summary)}<br>
              <span class="pill">${escapeHtml(item.nextAction)}</span>
            </li>
          `,
        )
        .join("")
    : "<li>Nothing is currently sitting in this lane.</li>";

  return `
    <article class="section-panel">
      <h3>${escapeHtml(sectionTitles[key] || key)}</h3>
      <ul>${list}</ul>
    </article>
  `;
}

function filterItems(items) {
  if (state.severity === "all") return items;
  return items.filter((item) => item.severity === state.severity);
}

function filteredSections(report) {
  return Object.fromEntries(Object.entries(report.sections).map(([key, items]) => [key, filterItems(items)]));
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
  const heroTitle = effectiveConfig.heroTitle || "The Chamber plots repo pressure as contacts on a live scope.";
  const heroBody = effectiveConfig.heroBody || report.summary;
  const eyebrow = effectiveConfig.eyebrow || "Attention Scan · PPI scope";
  const title = effectiveConfig.title || "The Chamber";
  const description =
    effectiveConfig.description || "A phosphor radar chamber for GitHub attention.";
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
  const { report, changelog, history, siteConfig } = state;
  const sections = filteredSections(report);
  const filteredTopActions = filterItems(report.topActions);
  const visibleCount = Object.values(sections).reduce((total, items) => total + items.length, 0);
  const severityLabel = state.severity === "all" ? "all signals" : `${state.severity} signals`;
  const severityBreakdown = report.metrics.severityBreakdown || { critical: 0, high: 0, medium: 0, low: 0 };
  const pulse = report.meta.pulse || "watch";
  const visibleItems = filterItems(collectItems(report));

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
    : '<article class="signal-card low"><h4>Scope is clean</h4><p>No high-pressure actions were returned in this filter.</p></article>';

  document.querySelector("#insights").innerHTML = (report.insights || []).map(insightCard).join("");
  document.querySelector("#sections").innerHTML = Object.entries(sections)
    .map(([key, items]) => sectionPanel(key, items))
    .join("");
  document.querySelector("#release-list").innerHTML = (changelog.releases || []).map(releaseCard).join("");

  const trendHistory = (history.history || []).slice(-12);
  const maxAttention = Math.max(0, ...trendHistory.map((entry) => entry.totalAttentionCount || 0));
  document.querySelector("#trend-summary").innerHTML = `
    <strong>${escapeHtml(history.summary?.label || "No scan history yet")}</strong>
    <span>${trendHistory.length} scan snapshot(s) tracked</span>
  `;
  document.querySelector("#trend-bars").innerHTML = trendHistory.length
    ? trendHistory.map((entry) => trendBar(entry, maxAttention)).join("")
    : '<span class="trend-empty">History will appear after the next scan.</span>';

  chamber.sync(visibleItems, {
    pulse,
    score: report.metrics.totalAttentionCount ?? visibleItems.length,
  });
}

Promise.all([loadReport(), loadChangelog(), loadHistory(), loadSiteConfig()])
  .then(([report, changelog, history, siteConfig]) => {
    state.report = report;
    state.changelog = changelog;
    state.history = history;
    state.siteConfig = siteConfig;
    render();
  })
  .catch((error) => {
    document.querySelector("#signal-caption").textContent = error.message;
  });

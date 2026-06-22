const sectionTitles = {
  immediateAction: "Immediate Action",
  reviewQueue: "Review Queue",
  issueTriage: "Issue Triage",
  workflowFailures: "Workflow Failures",
  staleWork: "Stale Work",
};

async function loadReport() {
  const candidates = ["./data/latest-report.json", "./api/report", "./data/demo-report.json"];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) {
        continue;
      }

      return await response.json();
    } catch {
      // Move to the next candidate.
    }
  }

  throw new Error("No report source could be loaded.");
}

function metricCard(label, value) {
  return `
    <article class="metric-card">
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

function insightCard(text) {
  return `
    <article class="insight-card">
      <p>${text}</p>
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

function render(report) {
  document.querySelector("#report-mode").textContent = report.meta.mode.toUpperCase();
  document.querySelector("#signal-caption").textContent = report.summary;
  document.querySelector("#footer-meta").textContent = `${report.meta.repository} · ${new Date(
    report.meta.generatedAt,
  ).toLocaleString()}`;

  document.querySelector("#metric-grid").innerHTML = [
    metricCard("Open PRs", report.metrics.openPullRequests),
    metricCard("Open issues", report.metrics.openIssues),
    metricCard("Immediate", report.metrics.immediateCount),
    metricCard("Review queue", report.metrics.reviewQueueCount),
    metricCard("Workflow failures", report.metrics.workflowFailureCount),
    metricCard("Stale work", report.metrics.staleCount),
  ].join("");

  document.querySelector("#top-actions").innerHTML = report.topActions.length
    ? report.topActions.map(signalCard).join("")
    : '<article class="signal-card low"><h4>Signal field is clean</h4><p>No high-pressure actions were returned.</p></article>';

  document.querySelector("#insights").innerHTML = (report.insights || [])
    .map(insightCard)
    .join("");

  document.querySelector("#sections").innerHTML = Object.entries(report.sections)
    .map(([key, items]) => sectionPanel(key, items))
    .join("");
}

loadReport()
  .then(render)
  .catch((error) => {
    document.querySelector("#signal-caption").textContent = error.message;
  });

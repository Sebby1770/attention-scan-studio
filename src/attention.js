import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API_ROOT = "https://api.github.com";
const SECTION_ORDER = [
  "immediateAction",
  "reviewQueue",
  "issueTriage",
  "workflowFailures",
  "staleWork",
];
const SECTION_TITLES = {
  immediateAction: "Immediate Action",
  reviewQueue: "Review Queue",
  issueTriage: "Issue Triage",
  workflowFailures: "Workflow Failures",
  staleWork: "Stale Work",
};
const SEVERITY_WEIGHT = {
  critical: 100,
  high: 78,
  medium: 52,
  low: 28,
};
const PRIORITY_LABELS = new Set(["bug", "critical", "p0", "p1", "priority:high", "sev1", "urgent"]);
const BAD_CONCLUSIONS = new Set(["action_required", "cancelled", "failure", "startup_failure", "timed_out"]);

function daysSince(isoDate, now = new Date()) {
  const then = new Date(isoDate).getTime();
  return Math.max(0, Math.floor((now.getTime() - then) / (1000 * 60 * 60 * 24)));
}

function formatAge(days) {
  return days === 1 ? "1 day" : `${days} days`;
}

function sortItems(items) {
  return [...items].sort((left, right) => right.score - left.score || right.ageDays - left.ageDays);
}

function parseRepository(repository) {
  const [owner, repo] = (repository || "").split("/");
  if (!owner || !repo) {
    throw new Error(`Expected repository in owner/repo format, received "${repository || ""}".`);
  }

  return { owner, repo };
}

function labelNames(item) {
  return (item.labels || [])
    .map((label) => (typeof label === "string" ? label : label.name))
    .filter(Boolean);
}

function markdownLink(label, url) {
  return `[${label}](${url})`;
}

function createItem({
  id,
  title,
  summary,
  section,
  severity,
  url,
  nextAction,
  ageDays = 0,
  area,
}) {
  const base = SEVERITY_WEIGHT[severity] || 0;

  return {
    id,
    title,
    summary,
    section,
    severity,
    score: base + Math.min(ageDays * 3, 18),
    url,
    nextAction,
    ageDays,
    area,
  };
}

function flattenSections(sections) {
  return SECTION_ORDER.flatMap((key) => sections[key] || []);
}

function createSeverityBreakdown(items) {
  return items.reduce(
    (breakdown, item) => {
      breakdown[item.severity] += 1;
      return breakdown;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );
}

function resolvePulse(metrics) {
  if (metrics.severityBreakdown.critical > 0) {
    return "critical";
  }

  if (metrics.immediateCount > 0 || metrics.workflowFailureCount > 0) {
    return "elevated";
  }

  if (metrics.totalAttentionCount > 0) {
    return "watch";
  }

  return "calm";
}

function buildMetrics({
  openPullRequests,
  openIssues,
  sections,
  suppressedWorkflowFailures = 0,
}) {
  const items = flattenSections(sections);

  return {
    openPullRequests,
    openIssues,
    immediateCount: sections.immediateAction.length,
    reviewQueueCount: sections.reviewQueue.length,
    issueTriageCount: sections.issueTriage.length,
    workflowFailureCount: sections.workflowFailures.length,
    staleCount: sections.staleWork.length,
    totalAttentionCount: items.length,
    severityBreakdown: createSeverityBreakdown(items),
    suppressedWorkflowFailures,
  };
}

function createInsights(report) {
  const insights = [];
  const { metrics } = report;

  if (metrics.severityBreakdown.critical > 0) {
    insights.push(`${metrics.severityBreakdown.critical} critical signal(s) are actively breaking flow.`);
  } else if (metrics.immediateCount > 0) {
    insights.push(`${metrics.immediateCount} high-pressure signal(s) are sitting above the line right now.`);
  }

  if (metrics.reviewQueueCount > metrics.immediateCount && metrics.reviewQueueCount > 0) {
    insights.push("Review latency is larger than direct breakage, so response time is the main drag factor.");
  }

  if (metrics.workflowFailureCount > 0) {
    insights.push("CI is contributing active friction and should be cleared before queue depth grows.");
  }

  if (metrics.suppressedWorkflowFailures > 0) {
    insights.push(`${metrics.suppressedWorkflowFailures} older workflow failure(s) were suppressed because a newer success resolved them.`);
  }

  if (metrics.staleCount > 0 && metrics.immediateCount === 0) {
    insights.push("Nothing is burning, but quiet drift is building up across the backlog.");
  }

  if (insights.length === 0) {
    insights.push("Signal field is clean. Attention Scan did not find anything urgent.");
  }

  return insights.slice(0, 3);
}

function createEmptySections() {
  return {
    immediateAction: [],
    reviewQueue: [],
    issueTriage: [],
    workflowFailures: [],
    staleWork: [],
  };
}

function addUnique(sections, item, seen) {
  if (seen.has(item.id)) {
    return;
  }

  seen.add(item.id);
  sections[item.section].push(item);
}

function toMarkdown(report) {
  const lines = [
    "# Attention Scan Report",
    "",
    report.summary,
    "",
    "## Overview",
    "| Area | Count |",
    "| --- | ---: |",
    `| Open pull requests | ${report.metrics.openPullRequests} |`,
    `| Open issues | ${report.metrics.openIssues} |`,
    `| Immediate action | ${report.metrics.immediateCount} |`,
    `| Review queue | ${report.metrics.reviewQueueCount} |`,
    `| Issue triage | ${report.metrics.issueTriageCount} |`,
    `| Workflow failures | ${report.metrics.workflowFailureCount} |`,
    `| Stale work | ${report.metrics.staleCount} |`,
    "",
    "## Top Actions",
  ];

  if (report.topActions.length === 0) {
    lines.push("- None");
  } else {
    for (const item of report.topActions) {
      lines.push(`- ${markdownLink(item.title, item.url)}: ${item.summary} Next: ${item.nextAction}`);
    }
  }

  for (const key of SECTION_ORDER) {
    lines.push("");
    lines.push(`## ${SECTION_TITLES[key]}`);
    if (report.sections[key].length === 0) {
      lines.push("- None");
      continue;
    }

    for (const item of report.sections[key]) {
      lines.push(`- ${markdownLink(item.title, item.url)}: ${item.summary} Next: ${item.nextAction}`);
    }
  }

  lines.push("");
  lines.push(`Scanned repository: \`${report.meta.repository}\``);
  lines.push(`Generated at: ${report.meta.generatedAt}`);
  lines.push(`Mode: ${report.meta.mode}`);

  return lines.join("\n");
}

function createGitHubClient(token) {
  async function requestJson(pathname, searchParams = {}) {
    const url = new URL(pathname, API_ROOT);
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "attention-scan",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API request failed (${response.status} ${response.statusText}): ${text}`);
    }

    return {
      data: await response.json(),
      headers: response.headers,
    };
  }

  async function paginate(pathname, searchParams = {}) {
    let page = 1;
    const items = [];

    while (true) {
      const { data } = await requestJson(pathname, { ...searchParams, page, per_page: 100 });
      if (!Array.isArray(data)) {
        return data;
      }

      items.push(...data);
      if (data.length < 100) {
        break;
      }

      page += 1;
    }

    return items;
  }

  return {
    requestJson,
    paginate,
  };
}

async function githubWrite(token, pathname, method, body) {
  const response = await fetch(new URL(pathname, API_ROOT), {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "attention-scan",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub write failed (${response.status} ${response.statusText}): ${text}`);
  }

  return response.json();
}

async function inspectPullRequest(client, repository, pr, config, now) {
  const { owner, repo } = repository;
  const ageDays = daysSince(pr.updated_at, now);
  const prLabel = `PR #${pr.number} · ${pr.title}`;
  const itemBase = {
    area: "pull_request",
    ageDays,
    url: pr.html_url,
  };

  const [reviews, reviewComments, checkRunsResponse, statusesResponse] = await Promise.all([
    client.paginate(`/repos/${owner}/${repo}/pulls/${pr.number}/reviews`),
    client.paginate(`/repos/${owner}/${repo}/pulls/${pr.number}/comments`),
    client.requestJson(`/repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs`, {
      filter: "latest",
      per_page: 100,
    }),
    client.requestJson(`/repos/${owner}/${repo}/commits/${pr.head.sha}/status`),
  ]);

  const latestReviewByUser = new Map();
  for (const review of reviews) {
    if (!review.user || review.user.type === "Bot") {
      continue;
    }
    latestReviewByUser.set(review.user.login, review);
  }

  const latestReviews = Array.from(latestReviewByUser.values());
  const changesRequested = latestReviews.filter((review) => review.state === "CHANGES_REQUESTED");
  const requestedReviewers = pr.requested_reviewers || [];
  const reviewCommentCount = reviewComments.length;
  const failingCheckRuns = (checkRunsResponse.data.check_runs || []).filter(
    (run) => run.status === "completed" && BAD_CONCLUSIONS.has(run.conclusion),
  );
  const failingStatuses = (statusesResponse.data.statuses || []).filter((status) =>
    ["error", "failure"].includes(status.state),
  );

  const items = [];

  if (changesRequested.length > 0) {
    const reviewers = changesRequested.map((review) => `@${review.user.login}`).join(", ");
    items.push(
      createItem({
        ...itemBase,
        id: `pr-${pr.number}-changes-requested`,
        title: prLabel,
        summary: `Requested changes are waiting from ${reviewers}. Last movement was ${formatAge(ageDays)} ago.`,
        section: "immediateAction",
        severity: "high",
        nextAction: "Reply to the review or push the next revision.",
      }),
    );
  }

  if (failingCheckRuns.length > 0 || failingStatuses.length > 0) {
    const failureNames = [
      ...failingCheckRuns.map((run) => run.name),
      ...failingStatuses.map((status) => status.context),
    ]
      .filter(Boolean)
      .slice(0, 4)
      .join(", ");

    items.push(
      createItem({
        ...itemBase,
        id: `pr-${pr.number}-failing-checks`,
        title: prLabel,
        summary: `Checks are failing${failureNames ? ` (${failureNames})` : ""}. Last movement was ${formatAge(ageDays)} ago.`,
        section: "immediateAction",
        severity: "critical",
        nextAction: "Open the failed jobs and clear the broken path first.",
      }),
    );
  }

  if (requestedReviewers.length > 0) {
    const reviewers = requestedReviewers.map((reviewer) => `@${reviewer.login}`).join(", ");
    items.push(
      createItem({
        ...itemBase,
        id: `pr-${pr.number}-review-requested`,
        title: prLabel,
        summary: `Review is queued with ${reviewers}. Last movement was ${formatAge(ageDays)} ago.`,
        section: "reviewQueue",
        severity: ageDays >= config.reviewGraceDays ? "high" : "medium",
        nextAction: "Nudge reviewers or swap ownership if the queue is stuck.",
      }),
    );
  } else if (latestReviews.length === 0 && ageDays >= config.reviewGraceDays) {
    items.push(
      createItem({
        ...itemBase,
        id: `pr-${pr.number}-no-review`,
        title: prLabel,
        summary: `No human review activity after ${formatAge(ageDays)}.`,
        section: "reviewQueue",
        severity: "medium",
        nextAction: "Route this PR to a concrete reviewer instead of leaving it ambient.",
      }),
    );
  }

  if (reviewCommentCount > 0 && ageDays >= config.reviewGraceDays) {
    items.push(
      createItem({
        ...itemBase,
        id: `pr-${pr.number}-comment-debt`,
        title: prLabel,
        summary: `${reviewCommentCount} review comment(s) exist and the PR has been quiet for ${formatAge(ageDays)}.`,
        section: "immediateAction",
        severity: "medium",
        nextAction: "Close the review comment loop so the PR can move again.",
      }),
    );
  }

  if (ageDays >= config.staleDays) {
    items.push(
      createItem({
        ...itemBase,
        id: `pr-${pr.number}-stale`,
        title: prLabel,
        summary: `This PR has been quiet for ${formatAge(ageDays)}.`,
        section: "staleWork",
        severity: "low",
        nextAction: "Decide whether to revive, merge, or close it.",
      }),
    );
  }

  return items;
}

function inspectIssue(issue, config, now) {
  const ageDays = daysSince(issue.updated_at, now);
  const names = labelNames(issue).map((name) => name.toLowerCase());
  const issueLabel = `Issue #${issue.number} · ${issue.title}`;
  const items = [];
  const itemBase = {
    area: "issue",
    ageDays,
    url: issue.html_url,
  };

  if (issue.assignees.length === 0 && ageDays >= config.triageDays) {
    items.push(
      createItem({
        ...itemBase,
        id: `issue-${issue.number}-unassigned`,
        title: issueLabel,
        summary: `This issue is unassigned and has been idle for ${formatAge(ageDays)}.`,
        section: "issueTriage",
        severity: "medium",
        nextAction: "Assign an owner or explicitly park it.",
      }),
    );
  }

  if (names.some((name) => PRIORITY_LABELS.has(name))) {
    items.push(
      createItem({
        ...itemBase,
        id: `issue-${issue.number}-priority`,
        title: issueLabel,
        summary: `This issue carries a high-priority label and was last touched ${formatAge(ageDays)} ago.`,
        section: "immediateAction",
        severity: ageDays >= config.triageDays ? "high" : "medium",
        nextAction: "Check whether the owner is blocked or the scope needs narrowing.",
      }),
    );
  }

  if (ageDays >= config.staleDays) {
    items.push(
      createItem({
        ...itemBase,
        id: `issue-${issue.number}-stale`,
        title: issueLabel,
        summary: `This issue has been quiet for ${formatAge(ageDays)}.`,
        section: "staleWork",
        severity: "low",
        nextAction: "Close, rescope, or put it back into active planning.",
      }),
    );
  }

  return items;
}

function isReportIssue(issue, config = {}) {
  return issue.title === (config.reportTitle || "Attention Scan Report");
}

function inspectWorkflowRun(run, now) {
  const ageDays = daysSince(run.updated_at || run.created_at, now);
  const title = `${run.name || `Run ${run.id}`} · ${run.head_branch || "unknown branch"}`;

  return createItem({
    id: `workflow-${run.id}`,
    title,
    summary: `The run failed on ${run.event} and has been sitting for ${formatAge(ageDays)}.`,
    section: "workflowFailures",
    severity: "high",
    url: run.html_url,
    nextAction: "Open the failed workflow and clear the first red job.",
    ageDays,
    area: "workflow",
  });
}

function selectUnresolvedWorkflowRuns(workflowRuns) {
  const resolved = new Set();
  const selected = [];
  let suppressedCount = 0;

  for (const run of workflowRuns) {
    const key = `${run.name || "unknown"}::${run.head_branch || "unknown"}`;

    if (run.conclusion === "success") {
      resolved.add(key);
      continue;
    }

    if (run.name === "Attention Scan" || !BAD_CONCLUSIONS.has(run.conclusion) || resolved.has(key)) {
      if (BAD_CONCLUSIONS.has(run.conclusion) && resolved.has(key) && run.name !== "Attention Scan") {
        suppressedCount += 1;
      }
      continue;
    }

    selected.push(run);
    resolved.add(key);
  }

  return {
    selected,
    suppressedCount,
  };
}

export function createDemoReport({ repository = "Sebby1770/attention-scan", reason = "Demo mode is active." } = {}) {
  const now = new Date().toISOString();
  const sections = createEmptySections();
  const seen = new Set();

  addUnique(
    sections,
    createItem({
      id: "demo-pr-failing",
      title: "PR #27 · Refactor score normalizer",
      summary: "Checks are failing in the deploy lane, so the main path is red.",
      section: "immediateAction",
      severity: "critical",
      url: "https://github.com/Sebby1770/attention-scan/pull/27",
      nextAction: "Fix the failing deploy workflow before merging anything behind it.",
      ageDays: 1,
      area: "pull_request",
    }),
    seen,
  );
  addUnique(
    sections,
    createItem({
      id: "demo-review-queue",
      title: "PR #24 · Add repo score timeline",
      summary: "Review is waiting with @design-review and has already cooled off.",
      section: "reviewQueue",
      severity: "high",
      url: "https://github.com/Sebby1770/attention-scan/pull/24",
      nextAction: "Nudge the reviewer or reassign to someone who can unblock it today.",
      ageDays: 4,
      area: "pull_request",
    }),
    seen,
  );
  addUnique(
    sections,
    createItem({
      id: "demo-issue-triage",
      title: "Issue #18 · Export PDF digest",
      summary: "The issue is unassigned and old enough to be backlog drift instead of active work.",
      section: "issueTriage",
      severity: "medium",
      url: "https://github.com/Sebby1770/attention-scan/issues/18",
      nextAction: "Assign ownership or explicitly move it out of the current cycle.",
      ageDays: 3,
      area: "issue",
    }),
    seen,
  );
  addUnique(
    sections,
    createItem({
      id: "demo-workflow-failure",
      title: "Preview Deploy · feature/orbit-header",
      summary: "Preview deploy failed and the branch is blocked from visual review.",
      section: "workflowFailures",
      severity: "high",
      url: "https://github.com/Sebby1770/attention-scan/actions/runs/1",
      nextAction: "Open the preview logs and fix the first production-facing break.",
      ageDays: 2,
      area: "workflow",
    }),
    seen,
  );
  addUnique(
    sections,
    createItem({
      id: "demo-stale",
      title: "Issue #11 · Repo theming presets",
      summary: "This issue has gone quiet long enough that it needs an explicit decision.",
      section: "staleWork",
      severity: "low",
      url: "https://github.com/Sebby1770/attention-scan/issues/11",
      nextAction: "Close it or fold it into an active milestone.",
      ageDays: 11,
      area: "issue",
    }),
    seen,
  );

  for (const key of SECTION_ORDER) {
    sections[key] = sortItems(sections[key]);
  }

  const items = flattenSections(sections);
  const metrics = buildMetrics({
    openPullRequests: 6,
    openIssues: 14,
    sections,
  });
  const report = {
    meta: {
      repository,
      generatedAt: now,
      mode: "demo",
      source: reason,
      pulse: resolvePulse(metrics),
    },
    summary: reason,
    metrics,
    topActions: sortItems(items).slice(0, 4),
    sections,
    insights: [],
  };

  report.insights = createInsights(report);
  return report;
}

export async function generateAttentionReport({
  repository,
  token,
  config = {},
  now = new Date(),
} = {}) {
  if (!repository || !token) {
    return createDemoReport({
      repository: repository || "owner/repo",
      reason: "Live GitHub credentials were not provided, so the dashboard is showing demo data.",
    });
  }

  const thresholds = {
    staleDays: Number(config.staleDays ?? 7),
    reviewGraceDays: Number(config.reviewGraceDays ?? 3),
    triageDays: Number(config.triageDays ?? 2),
    failedRunLimit: Number(config.failedRunLimit ?? 10),
    reportTitle: config.reportTitle || "Attention Scan Report",
  };

  const repoRef = parseRepository(repository);
  const client = createGitHubClient(token);
  const [pulls, issues, workflowRuns] = await Promise.all([
    client.paginate(`/repos/${repoRef.owner}/${repoRef.repo}/pulls`, {
      state: "open",
      sort: "updated",
      direction: "desc",
    }),
    client.paginate(`/repos/${repoRef.owner}/${repoRef.repo}/issues`, {
      state: "open",
      sort: "updated",
      direction: "desc",
    }),
    client.paginate(`/repos/${repoRef.owner}/${repoRef.repo}/actions/runs`, {
      per_page: 50,
    }),
  ]);

  const realIssues = issues.filter((issue) => !issue.pull_request && !isReportIssue(issue, thresholds));
  const activePulls = pulls.filter((pr) => !pr.draft);

  const pullItems = (await Promise.all(activePulls.map((pr) => inspectPullRequest(client, repoRef, pr, thresholds, now)))).flat();
  const issueItems = realIssues.flatMap((issue) => inspectIssue(issue, thresholds, now));
  const workflowItems = (workflowRuns.workflow_runs || [])
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));

  const workflowSelection = selectUnresolvedWorkflowRuns(workflowItems);
  const unresolvedWorkflowItems = workflowSelection.selected
    .slice(0, thresholds.failedRunLimit)
    .map((run) => inspectWorkflowRun(run, now));

  const sections = createEmptySections();
  const seen = new Set();
  for (const item of [...pullItems, ...issueItems, ...unresolvedWorkflowItems]) {
    addUnique(sections, item, seen);
  }

  for (const key of SECTION_ORDER) {
    sections[key] = sortItems(sections[key]);
  }

  const items = flattenSections(sections);
  const metrics = buildMetrics({
    openPullRequests: activePulls.length,
    openIssues: realIssues.length,
    sections,
    suppressedWorkflowFailures: workflowSelection.suppressedCount,
  });
  const report = {
    meta: {
      repository,
      generatedAt: now.toISOString(),
      mode: "live",
      source: "GitHub REST API",
      pulse: resolvePulse(metrics),
    },
    summary:
      items.length === 0
        ? "No urgent GitHub signals were found in this scan."
        : `Found ${items.length} attention item(s) across pull requests, issues, and workflows.`,
    metrics,
    topActions: sortItems(items).slice(0, 5),
    sections,
    insights: [],
  };

  report.insights = createInsights(report);
  return report;
}

export async function persistReport(report, {
  projectRoot,
  jsonRelativePath = "public/data/latest-report.json",
  markdownRelativePath = "artifacts/attention-report.md",
} = {}) {
  const jsonPath = path.join(projectRoot, jsonRelativePath);
  const markdownPath = path.join(projectRoot, markdownRelativePath);

  await mkdir(path.dirname(jsonPath), { recursive: true });
  await mkdir(path.dirname(markdownPath), { recursive: true });

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, `${toMarkdown(report)}\n`, "utf8");

  return { jsonPath, markdownPath };
}

export async function readPersistedReport(jsonPath) {
  const file = await readFile(jsonPath, "utf8");
  return JSON.parse(file);
}

export async function upsertReportIssue({
  token,
  repository,
  title = "Attention Scan Report",
  label = "",
  body,
}) {
  if (!token || !repository || !body) {
    return null;
  }

  const repoRef = parseRepository(repository);
  const client = createGitHubClient(token);
  const issues = await client.paginate(`/repos/${repoRef.owner}/${repoRef.repo}/issues`, {
    state: "open",
  });
  const existing = issues.find((issue) => !issue.pull_request && issue.title === title);

  if (existing) {
    const updated = await githubWrite(
      token,
      `/repos/${repoRef.owner}/${repoRef.repo}/issues/${existing.number}`,
      "PATCH",
      { body },
    );
    return updated.html_url || existing.html_url;
  }

  const payload = { title, body };
  if (label) {
    payload.labels = [label];
  }

  try {
    const created = await githubWrite(
      token,
      `/repos/${repoRef.owner}/${repoRef.repo}/issues`,
      "POST",
      payload,
    );
    return created.html_url;
  } catch (error) {
    if (!label || !(error instanceof Error) || !error.message.includes("(422")) {
      throw error;
    }
  }

  const created = await githubWrite(
    token,
    `/repos/${repoRef.owner}/${repoRef.repo}/issues`,
    "POST",
    { title, body },
  );
  return created.html_url;
}

export {
  SECTION_ORDER,
  SECTION_TITLES,
  isReportIssue,
  selectUnresolvedWorkflowRuns,
  toMarkdown,
};

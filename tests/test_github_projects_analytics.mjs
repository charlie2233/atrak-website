import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SOURCE = fs.readFileSync(path.join(REPO_ROOT, "github-projects.js"), "utf8");

function jsonResponse(value, ok = true) {
  return {
    ok,
    json: async () => value,
  };
}

function createAnalyticsRuntime({ weeklyFetchError = null } = {}) {
  const elements = {
    "project-analytics-grid": { innerHTML: "" },
    "project-analytics-meta": { textContent: "" },
  };
  const fetchCalls = [];
  const consoleErrors = [];
  const repos = [
    {
      stargazers_count: 8,
      forks_count: 2,
      language: "JavaScript",
      pushed_at: "2026-08-15T12:00:00Z",
    },
    {
      stargazers_count: 3,
      forks_count: 1,
      language: "Swift",
      pushed_at: "2026-08-14T12:00:00Z",
    },
  ];
  const meta = {
    updatedAt: "2026-08-15T12:30:00Z",
    repoCount: 2,
    totalStars: 11,
    totalForks: 3,
    mostRecentPush: "2026-08-15T12:00:00Z",
  };
  const weekly = {
    source: "local-git-refresh",
    updatedAt: "2026-08-15T12:30:00Z",
    totalCommitContributions: 41,
  };

  const document = {
    currentScript: { src: "https://atrak.dev/github-projects.js?v=41" },
    readyState: "loading",
    addEventListener() {},
    getElementById(id) {
      return elements[id] || null;
    },
  };
  const context = {
    URL,
    Date,
    Promise,
    document,
    console: {
      log() {},
      error(...args) {
        consoleErrors.push(args);
      },
    },
    fetch: async (input, options) => {
      const url = String(input);
      fetchCalls.push({ url, options });
      if (url.includes("data/github-repos.json")) return jsonResponse(repos);
      if (url.includes("data/github-meta.json")) return jsonResponse(meta);
      if (url.includes("data/github-weekly.json")) {
        if (weeklyFetchError) throw weeklyFetchError;
        return jsonResponse(weekly);
      }
      return jsonResponse(null, false);
    },
    window: {
      location: {
        hostname: "atrak.dev",
        origin: "https://atrak.dev",
      },
    },
  };

  vm.createContext(context);
  vm.runInContext(SOURCE, context, { filename: "github-projects.js" });

  return {
    render: context.window.GitHubProjects.renderProjectAnalytics,
    elements,
    fetchCalls,
    consoleErrors,
  };
}

test("project analytics renders a local weekly cache through its browser runtime", async () => {
  const runtime = createAnalyticsRuntime();

  await runtime.render();

  assert.match(runtime.elements["project-analytics-grid"].innerHTML, /Commits \(7d\)/);
  assert.match(runtime.elements["project-analytics-grid"].innerHTML, />41</);
  assert.match(runtime.elements["project-analytics-grid"].innerHTML, /Local checked-out repos/);
  assert.match(runtime.elements["project-analytics-meta"].textContent, /Weekly: Local checked-out repos/);
  assert.doesNotMatch(runtime.elements["project-analytics-grid"].innerHTML, /Unable to load analytics/);
  assert.equal(runtime.consoleErrors.length, 0);

  const weeklyRequest = runtime.fetchCalls.find(({ url }) => url.includes("data/github-weekly.json"));
  assert.ok(weeklyRequest);
  const weeklyUrl = new URL(weeklyRequest.url);
  assert.equal(weeklyUrl.pathname, "/data/github-weekly.json");
  assert.ok(weeklyUrl.searchParams.get("v"));
  assert.equal(weeklyRequest.options.cache, "no-store");
});

test("project analytics remains available when the weekly cache cannot be fetched", async () => {
  const runtime = createAnalyticsRuntime({ weeklyFetchError: new Error("network unavailable") });

  await runtime.render();

  assert.match(runtime.elements["project-analytics-grid"].innerHTML, /Commits \(7d\)/);
  assert.match(runtime.elements["project-analytics-grid"].innerHTML, />—</);
  assert.doesNotMatch(runtime.elements["project-analytics-grid"].innerHTML, /Local checked-out repos/);
  assert.doesNotMatch(runtime.elements["project-analytics-grid"].innerHTML, /Unable to load analytics/);
  assert.equal(runtime.consoleErrors.length, 0);
});

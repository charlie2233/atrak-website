#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OWNER = "charlie2233";
const SITE_URL = "https://atrak.dev";
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA_DIR = path.join(REPO_ROOT, "data");

const paths = {
  repos: path.join(DATA_DIR, "github-repos.json"),
  events: path.join(DATA_DIR, "github-events.json"),
  releases: path.join(DATA_DIR, "github-releases.json"),
  meta: path.join(DATA_DIR, "github-meta.json"),
  weekly: path.join(DATA_DIR, "github-weekly.json"),
  lastUpdated: path.join(DATA_DIR, "last-updated.txt"),
};

function gh(endpoint) {
  const out = execFileSync("gh", ["api", endpoint], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(out);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function repoUrl(name) {
  return `https://github.com/${OWNER}/${name}`;
}

function projectUrl(relativePath) {
  return `${SITE_URL}/${relativePath.replace(/^\/+/, "")}`;
}

function statSize(relativePath) {
  try {
    return fs.statSync(path.join(REPO_ROOT, relativePath)).size;
  } catch {
    return 0;
  }
}

function slimRepo(repo) {
  return {
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    private: Boolean(repo.private),
    owner: {
      login: repo.owner?.login || OWNER,
      avatar_url: repo.owner?.avatar_url || "",
      html_url: repo.owner?.html_url || `https://github.com/${OWNER}`,
    },
    html_url: repo.html_url,
    description: repo.description,
    fork: Boolean(repo.fork),
    created_at: repo.created_at,
    updated_at: repo.updated_at,
    pushed_at: repo.pushed_at,
    homepage: repo.homepage || null,
    size: Number(repo.size) || 0,
    stargazers_count: Number(repo.stargazers_count) || 0,
    watchers_count: Number(repo.watchers_count) || 0,
    language: repo.language || null,
    has_issues: Boolean(repo.has_issues),
    has_projects: Boolean(repo.has_projects),
    has_downloads: Boolean(repo.has_downloads),
    forks_count: Number(repo.forks_count) || 0,
    open_issues_count: Number(repo.open_issues_count) || 0,
    license: repo.license
      ? {
          key: repo.license.key,
          name: repo.license.name,
          spdx_id: repo.license.spdx_id,
          url: repo.license.url,
        }
      : null,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    visibility: repo.visibility || (repo.private ? "private" : "public"),
    default_branch: repo.default_branch || "main",
    archived: Boolean(repo.archived),
  };
}

function slimEvent(event) {
  const payload = event.payload || {};
  const base = {
    type: event.type,
    created_at: event.created_at,
    repo: {
      name: event.repo?.name || "",
    },
  };

  if (event.type === "PushEvent") {
    return {
      ...base,
      payload: {
        ref: payload.ref,
        before: payload.before,
        head: payload.head,
        distinct_size: Number(payload.distinct_size) || 0,
        commits: Array.isArray(payload.commits)
          ? payload.commits.slice(0, 20).map((commit) => ({
              sha: commit.sha,
              message: commit.message,
              url: commit.url,
            }))
          : [],
      },
    };
  }

  if (event.type === "CreateEvent") {
    return {
      ...base,
      payload: {
        ref: payload.ref,
        ref_type: payload.ref_type,
        description: payload.description,
        master_branch: payload.master_branch,
      },
    };
  }

  if (event.type === "ReleaseEvent") {
    return {
      ...base,
      payload: {
        action: payload.action,
        release: payload.release
          ? {
              tag_name: payload.release.tag_name,
              name: payload.release.name,
              html_url: payload.release.html_url,
              published_at: payload.release.published_at,
            }
          : null,
      },
    };
  }

  if (event.type === "PullRequestEvent") {
    return {
      ...base,
      payload: {
        action: payload.action,
        number: payload.number,
        pull_request: payload.pull_request
          ? {
              title: payload.pull_request.title,
              html_url: payload.pull_request.html_url,
              merged_at: payload.pull_request.merged_at,
              state: payload.pull_request.state,
            }
          : null,
      },
    };
  }

  if (event.type === "WatchEvent") {
    return {
      ...base,
      payload: {
        action: payload.action,
      },
    };
  }

  return {
    ...base,
    payload: {},
  };
}

function normalizeRelease(repoName, release) {
  return {
    repo: `${OWNER}/${repoName}`,
    tag: release.tag_name || release.name || "release",
    name: release.name || release.tag_name || "Release",
    url: release.html_url || `${repoUrl(repoName)}/releases`,
    published_at: release.published_at || release.created_at || null,
    prerelease: Boolean(release.prerelease),
    draft: Boolean(release.draft),
    source: "github-release",
    zipball_url: release.zipball_url || `${repoUrl(repoName)}/archive/refs/tags/${release.tag_name}.zip`,
    tarball_url: release.tarball_url || `${repoUrl(repoName)}/archive/refs/tags/${release.tag_name}.tar.gz`,
    assets: Array.isArray(release.assets)
      ? release.assets.map((asset) => ({
          name: asset.name,
          download_url: asset.browser_download_url,
          size: Number(asset.size) || 0,
          download_count: Number(asset.download_count) || 0,
        }))
      : [],
  };
}

function projectDrops(repoMap) {
  const dropSpecs = [
    {
      repo: "lifepage",
      tag: "2026.04-lifepage-sync",
      name: "LifePage launch/readiness updates",
      project: "projects/lifepage.html",
    },
    {
      repo: "DestinnyBasketballPage",
      tag: "2026.04-site-refresh",
      name: "Destiny Basketball public site refresh",
      project: "projects/destiny-basketball.html",
    },
  ];

  return dropSpecs.map((drop) => {
    const repo = repoMap.get(drop.repo);
    const asset = drop.asset
      ? {
          name: path.basename(drop.asset),
          download_url: projectUrl(drop.asset),
          size: statSize(drop.asset),
          download_count: 0,
        }
      : null;

    return {
      repo: `${OWNER}/${drop.repo}`,
      tag: drop.tag,
      name: drop.name,
      url: projectUrl(drop.project),
      published_at: repo?.pushed_at || repo?.updated_at || new Date().toISOString(),
      prerelease: false,
      draft: false,
      source: "atrak-download",
      zipball_url: `${repoUrl(drop.repo)}/archive/refs/heads/${repo?.default_branch || "main"}.zip`,
      tarball_url: `${repoUrl(drop.repo)}/archive/refs/heads/${repo?.default_branch || "main"}.tar.gz`,
      assets: asset ? [asset] : [],
    };
  });
}

function weeklyStats(events, now) {
  const fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weeklyEvents = events.filter((event) => {
    const date = new Date(event.created_at);
    return !Number.isNaN(date.getTime()) && date >= fromDate && date <= now;
  });

  const activeRepos = new Set();
  let commits = 0;
  let prs = 0;
  let issues = 0;

  for (const event of weeklyEvents) {
    const repoName = event.repo?.name || "";
    if (repoName) activeRepos.add(repoName);

    if (event.type === "PushEvent") {
      commits += Number(event.payload?.distinct_size) || 0;
    } else if (event.type === "PullRequestEvent") {
      prs += 1;
    } else if (event.type === "IssuesEvent") {
      issues += 1;
    }
  }

  return {
    updatedAt: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    from: fromDate.toISOString().replace(/\.\d{3}Z$/, "Z"),
    to: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    totalCommitContributions: commits,
    totalPullRequestContributions: prs,
    totalIssueContributions: issues,
    totalRepositoryContributions: activeRepos.size,
  };
}

function weeklyStatsForWrite(events, now) {
  const liveWeeklyStats = weeklyStats(events, now);
  const existingWeeklyStats = readJson(paths.weekly);

  if (
    existingWeeklyStats?.source === "local-git-refresh" &&
    Number(existingWeeklyStats.totalCommitContributions || 0) >=
      Number(liveWeeklyStats.totalCommitContributions || 0)
  ) {
    return existingWeeklyStats;
  }

  return liveWeeklyStats;
}

function main() {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rawRepos = gh(`users/${OWNER}/repos?per_page=100&sort=updated`);
  const repos = rawRepos
    .filter((repo) => !repo.private)
    .map(slimRepo)
    .sort((a, b) => Date.parse(b.pushed_at || b.updated_at || "") - Date.parse(a.pushed_at || a.updated_at || ""));

  const repoMap = new Map(repos.map((repo) => [repo.name, repo]));
  const rawEvents = gh(`users/${OWNER}/events/public?per_page=100`);
  const events = rawEvents.map(slimEvent);

  const recentCommitSummaries = new Map();
  for (const repo of repos.filter((repo) => !repo.fork && !repo.archived)) {
    const pushedAt = repo.pushed_at ? new Date(repo.pushed_at) : null;
    if (!pushedAt || Number.isNaN(pushedAt.getTime()) || pushedAt < weekStart) continue;

    try {
      const commits = gh(
        `repos/${OWNER}/${repo.name}/commits?since=${encodeURIComponent(weekStart.toISOString())}&until=${encodeURIComponent(now.toISOString())}&per_page=100`,
      );
      recentCommitSummaries.set(repo.name, {
        count: Array.isArray(commits) ? commits.length : 0,
        commits: Array.isArray(commits)
          ? commits.slice(0, 20).map((commit) => ({
              sha: commit.sha,
              message: commit.commit?.message || "",
              url: commit.html_url || "",
            }))
          : [],
      });
    } catch {
      recentCommitSummaries.set(repo.name, { count: 0, commits: [] });
    }
  }

  for (const [repoName, summary] of recentCommitSummaries) {
    const repoFull = `${OWNER}/${repoName}`;
    const matchingPush = events.find((event) => {
      const eventDate = event.created_at ? new Date(event.created_at) : null;
      return (
        event.type === "PushEvent" &&
        event.repo?.name === repoFull &&
        eventDate &&
        !Number.isNaN(eventDate.getTime()) &&
        eventDate >= weekStart
      );
    });

    if (matchingPush) {
      matchingPush.payload.distinct_size = summary.count;
      matchingPush.payload.commits = summary.commits;
    } else if (summary.count > 0) {
      events.unshift({
        type: "PushEvent",
        created_at: repos.find((repo) => repo.name === repoName)?.pushed_at || now.toISOString(),
        repo: { name: repoFull },
        payload: {
          ref: "refs/heads/main",
          before: "",
          head: summary.commits[0]?.sha || "",
          distinct_size: summary.count,
          commits: summary.commits,
        },
      });
    }
  }

  const releases = [];
  for (const repo of repos.filter((repo) => !repo.fork && !repo.archived)) {
    try {
      const repoReleases = gh(`repos/${OWNER}/${repo.name}/releases?per_page=20`);
      releases.push(...repoReleases.map((release) => normalizeRelease(repo.name, release)));
    } catch {
      // Repos without releases or inaccessible release metadata simply skip.
    }
  }

  releases.push(...projectDrops(repoMap));
  releases.sort((a, b) => Date.parse(b.published_at || "") - Date.parse(a.published_at || ""));

  const totalStars = repos.reduce((sum, repo) => sum + Number(repo.stargazers_count || 0), 0);
  const totalForks = repos.reduce((sum, repo) => sum + Number(repo.forks_count || 0), 0);
  const languageCount = new Set(repos.map((repo) => repo.language).filter(Boolean)).size;
  const mostRecentPush = repos.map((repo) => repo.pushed_at).filter(Boolean).sort().at(-1) || null;

  writeJson(paths.repos, repos);
  writeJson(paths.events, events);
  writeJson(paths.releases, releases);
  writeJson(paths.meta, {
    updatedAt: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    repoCount: repos.length,
    totalStars,
    totalForks,
    languageCount,
    mostRecentPush,
    source: "github-live-cache",
  });
  writeJson(paths.weekly, weeklyStatsForWrite(events, now));
  fs.writeFileSync(paths.lastUpdated, `${now.toISOString().replace(/\.\d{3}Z$/, "Z")}\n`, "utf8");
}

main();

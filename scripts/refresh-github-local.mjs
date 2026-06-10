#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const OWNER = "charlie2233";
const HOME_DIR = os.homedir();
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const META_PATH = path.join(DATA_DIR, "github-meta.json");
const WEEKLY_PATH = path.join(DATA_DIR, "github-weekly.json");
const LAST_UPDATED_PATH = path.join(DATA_DIR, "last-updated.txt");
const REPOS_PATH = path.join(DATA_DIR, "github-repos.json");
const WEEKLY_ONLY = process.argv.includes("--weekly-only");
const EXTRA_SCAN_ROOTS = [
  path.join(HOME_DIR, ".codex", "worktrees"),
  path.join(HOME_DIR, ".tmp"),
];
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  ".open-next",
  ".wrangler",
  ".turbo",
  ".cache",
  "Library",
  "Applications",
  "Desktop",
  "Documents",
  "Downloads",
  "Movies",
  "Music",
  "Pictures",
  "Public",
]);

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function runGit(repoPath, args) {
  return execFileSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function getRemoteRepo(repoPath) {
  try {
    const remote = runGit(repoPath, ["remote", "get-url", "origin"]);
    const match = remote.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/i);
    if (!match) return null;

    const owner = match[1];
    const name = match[2];
    if (owner.toLowerCase() !== OWNER.toLowerCase()) return null;

    return { owner, name };
  } catch {
    return null;
  }
}

function getLocalRepoInfo(repoPath) {
  const remoteRepo = getRemoteRepo(repoPath);
  if (!remoteRepo) return null;

  try {
    const pushedAtRaw = runGit(repoPath, ["log", "-1", "--date=iso-strict", "--format=%cI"]);
    const pushedAt = new Date(pushedAtRaw).toISOString().replace(/\.\d{3}Z$/, "Z");
    const since = runGit(repoPath, ["log", "--all", "--since=7 days ago", "--format=%H"]);
    const recentCommits = since ? since.split("\n").filter(Boolean) : [];
    const recentCommitCount = new Set(recentCommits).size;
    const defaultBranch = runGit(repoPath, ["symbolic-ref", "--short", "HEAD"]);

    return {
      name: remoteRepo.name,
      full_name: `${remoteRepo.owner}/${remoteRepo.name}`,
      html_url: `https://github.com/${remoteRepo.owner}/${remoteRepo.name}`,
      updated_at: pushedAt,
      pushed_at: pushedAt,
      default_branch: defaultBranch || "main",
      recentCommitCount,
    };
  } catch {
    return null;
  }
}

function isGitRepoDir(repoPath) {
  const gitPath = path.join(repoPath, ".git");
  return fs.existsSync(gitPath);
}

function collectReposFromRoot(rootDir, maxDepth, results, visited) {
  if (!rootDir || !fs.existsSync(rootDir)) return;

  const walk = (currentDir, depth) => {
    let realPath;
    try {
      realPath = fs.realpathSync(currentDir);
    } catch {
      return;
    }

    if (visited.has(realPath)) return;
    visited.add(realPath);

    if (isGitRepoDir(currentDir)) {
      const repoInfo = getLocalRepoInfo(currentDir);
      if (repoInfo) {
        results.set(repoInfo.full_name.toLowerCase(), repoInfo);
      }
      return;
    }

    if (depth >= maxDepth) return;

    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith(".") && entry.name !== ".codex" && entry.name !== ".tmp") continue;
      walk(path.join(currentDir, entry.name), depth + 1);
    }
  };

  walk(rootDir, 0);
}

function collectLocalRepos() {
  const results = new Map();
  const visited = new Set();

  collectReposFromRoot(HOME_DIR, 1, results, visited);
  for (const rootDir of EXTRA_SCAN_ROOTS) {
    collectReposFromRoot(rootDir, 4, results, visited);
  }

  return [...results.values()];
}

function main() {
  const existingRepos = readJson(REPOS_PATH, []);
  const localRepos = collectLocalRepos();
  const localRepoMap = new Map(localRepos.map((repo) => [repo.full_name.toLowerCase(), repo]));

  const mergedRepoMap = new Map();

  if (Array.isArray(existingRepos)) {
    for (const repo of existingRepos) {
      const fullName = String(repo?.full_name || "").trim();
      if (!fullName) continue;
      mergedRepoMap.set(fullName.toLowerCase(), repo);
    }
  }

  for (const localRepo of localRepos) {
    const key = localRepo.full_name.toLowerCase();
    const existingRepo = mergedRepoMap.get(key) || {};
    mergedRepoMap.set(key, {
      ...existingRepo,
      ...localRepo,
      owner: existingRepo.owner ?? {
        login: OWNER,
      },
      private: existingRepo.private ?? false,
      fork: existingRepo.fork ?? false,
      visibility: existingRepo.visibility ?? "public",
    });
  }

  const trackedRepos = [...mergedRepoMap.values()];

  trackedRepos.sort((a, b) => {
    const aTime = Date.parse(a?.updated_at || a?.pushed_at || "") || 0;
    const bTime = Date.parse(b?.updated_at || b?.pushed_at || "") || 0;
    return bTime - aTime;
  });

  if (!WEEKLY_ONLY) {
    writeJson(REPOS_PATH, trackedRepos);
  }

  const trackedLocalRepos = WEEKLY_ONLY
    ? localRepos
    : trackedRepos
        .map((repo) => localRepoMap.get(String(repo?.full_name || "").toLowerCase()))
        .filter(Boolean);

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const mostRecentPush = trackedLocalRepos
    .map((repo) => repo.pushed_at)
    .filter(Boolean)
    .sort()
    .at(-1) ?? (trackedRepos.map((repo) => repo?.pushed_at).filter(Boolean).sort().at(-1) ?? null);

  const totalStars = trackedRepos.reduce((sum, repo) => sum + Number(repo?.stargazers_count || 0), 0);
  const totalForks = trackedRepos.reduce((sum, repo) => sum + Number(repo?.forks_count || 0), 0);
  const languageCount = new Set(
    trackedRepos.map((repo) => repo?.language).filter((value) => typeof value === "string" && value.trim()),
  ).size;

  const totalCommitContributions = trackedLocalRepos.reduce((sum, repo) => sum + repo.recentCommitCount, 0);
  const totalRepositoryContributions = trackedLocalRepos.filter((repo) => repo.recentCommitCount > 0).length;
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");

  const meta = {
    updatedAt: now,
    repoCount: trackedRepos.length,
    totalStars,
    totalForks,
    languageCount,
    mostRecentPush,
    source: "local-git-refresh",
  };

  const weekly = {
    updatedAt: now,
    from,
    to: now,
    totalCommitContributions,
    totalPullRequestContributions: 0,
    totalIssueContributions: 0,
    totalRepositoryContributions,
    source: "local-git-refresh",
  };

  if (!WEEKLY_ONLY) {
    writeJson(META_PATH, meta);
  }
  writeJson(WEEKLY_PATH, weekly);
  // Local refreshes can only observe checked-out git repos. Keep the public
  // GitHub event and release caches intact so shareable feeds stay populated
  // until the GitHub Actions refresh updates them again.
  if (!WEEKLY_ONLY) {
    fs.writeFileSync(LAST_UPDATED_PATH, `${now}\n`, "utf8");
  }
}

main();

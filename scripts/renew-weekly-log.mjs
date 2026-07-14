#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(repoRoot, 'data');
const dayMs = 24 * 60 * 60 * 1000;

function parseArgs(values) {
    const options = {
        dryRun: false,
        githubApi: false,
        historyPath: path.join(dataDir, 'weekly-history.json'),
        now: new Date(),
        weekStart: ''
    };

    for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        if (value === '--dry-run') options.dryRun = true;
        else if (value === '--github-api') options.githubApi = true;
        else if (value === '--history') options.historyPath = path.resolve(values[index += 1] || '');
        else if (value === '--now') options.now = new Date(values[index += 1] || '');
        else if (value === '--week-start') options.weekStart = values[index += 1] || '';
        else throw new Error(`Unknown option: ${value}`);
    }

    if (Number.isNaN(options.now.getTime())) throw new Error('The --now value must be a valid date.');
    return options;
}

function readJson(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function dateKey(date) {
    return date.toISOString().slice(0, 10);
}

function parseDateKey(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new Error('The --week-start value must use YYYY-MM-DD.');
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (date.getUTCDay() !== 0) throw new Error('The --week-start date must be a Sunday.');
    return date;
}

function startOfUtcWeek(value) {
    const date = new Date(value);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - date.getUTCDay());
    return date;
}

function formatRange(start, end) {
    const month = (date) => date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    if (start.getUTCMonth() === end.getUTCMonth()) {
        return `${month(start)} ${start.getUTCDate()} – ${end.getUTCDate()}`;
    }
    return `${month(start)} ${start.getUTCDate()} – ${month(end)} ${end.getUTCDate()}`;
}

function displayRepoName(fullName) {
    const repoName = String(fullName || '').split('/').pop() || 'Project';
    const names = {
        'atrak-website': 'Atrak Website',
        'rork-hoopshighlights-ai_Final': 'Hoops Highlights App',
        Basketball_action_recoginition_sever: 'Hoops Clips Server',
        'coursebinder-ai-ready-google-classroom-exporter': 'CourseBinder',
        'formative-ai-exporter': 'Formative Exporter',
        'ai-hoops-board': 'AI Hoops Board'
    };
    return names[repoName] || repoName.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeMessage(value) {
    const message = String(value || '').split('\n')[0].replace(/\s+/g, ' ').trim();
    if (!message || /^merge\b/i.test(message)) return '';
    if (/(?:update github data|renew weekly log)/i.test(message)) return '';
    return message
        .replace(/^(?:feat|fix|docs|refactor|chore|style|test|build|ci|perf)(?:\([^)]*\))?!?:\s*/i, '')
        .trim();
}

function normalizeCommitUrl(value, fullName, sha) {
    const url = String(value || '');
    if (/^https:\/\/api\.github\.com\/repos\//i.test(url)) {
        return url.replace('https://api.github.com/repos/', 'https://github.com/').replace('/commits/', '/commit/');
    }
    return /^https:\/\//i.test(url) ? url : `https://github.com/${fullName}/commit/${sha}`;
}

function fetchCommits(fullName, start, endExclusive) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) return [];
    const endpoint = `repos/${fullName}/commits?since=${encodeURIComponent(start.toISOString())}&until=${encodeURIComponent(endExclusive.toISOString())}&per_page=100`;
    try {
        const output = execFileSync('gh', ['api', '--paginate', '--slurp', endpoint], {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        const pages = JSON.parse(output);
        return Array.isArray(pages) ? pages.flat().filter((commit) => commit && typeof commit === 'object') : [];
    } catch (error) {
        process.stderr.write(`Could not enrich ${fullName}: ${error.message}\n`);
        return null;
    }
}

function createActivity(fullName, repoLookup) {
    const repo = repoLookup.get(fullName) || {};
    return {
        fullName,
        name: displayRepoName(fullName),
        url: repo.html_url || `https://github.com/${fullName}`,
        language: repo.language || '',
        events: 0,
        pushes: 0,
        pullRequests: 0,
        issues: 0,
        maxDistinctCommits: 0,
        commits: new Map(),
        lastAt: null
    };
}

function addCommit(activity, commit, fallbackDate) {
    const sha = String(commit?.sha || commit?.id || '').trim();
    if (!sha || activity.commits.has(sha)) return;
    const rawMessage = commit?.message || commit?.commit?.message || '';
    const text = normalizeMessage(rawMessage);
    const committedAt = commit?.commit?.committer?.date || commit?.commit?.author?.date || fallbackDate || '';
    activity.commits.set(sha, {
        sha,
        text,
        rawMessage: String(rawMessage || '').split('\n')[0].trim(),
        url: normalizeCommitUrl(commit?.url || commit?.html_url, activity.fullName, sha),
        at: committedAt
    });
}

function buildEntry({ events, releases, repos, start, now, useGithubApi }) {
    const endExclusive = new Date(start.getTime() + (7 * dayMs));
    const end = new Date(endExclusive.getTime() - dayMs);
    const repoLookup = new Map((Array.isArray(repos) ? repos : []).map((repo) => [repo.full_name, repo]));
    const activity = new Map();
    const getActivity = (fullName) => {
        if (!fullName) return null;
        if (!activity.has(fullName)) activity.set(fullName, createActivity(fullName, repoLookup));
        return activity.get(fullName);
    };

    const weeklyEvents = (Array.isArray(events) ? events : []).filter((event) => {
        const createdAt = new Date(event?.created_at);
        return !Number.isNaN(createdAt.getTime()) && createdAt >= start && createdAt < endExclusive;
    });

    weeklyEvents.forEach((event) => {
        const fullName = String(event?.repo?.name || '');
        const repoActivity = getActivity(fullName);
        if (!repoActivity) return;
        const createdAt = new Date(event.created_at);
        repoActivity.events += 1;
        if (!repoActivity.lastAt || createdAt > repoActivity.lastAt) repoActivity.lastAt = createdAt;

        if (event.type === 'PushEvent') {
            repoActivity.pushes += 1;
            const distinctSize = Number(event?.payload?.distinct_size || 0);
            repoActivity.maxDistinctCommits = Math.max(repoActivity.maxDistinctCommits, distinctSize);
            (Array.isArray(event?.payload?.commits) ? event.payload.commits : [])
                .forEach((commit) => addCommit(repoActivity, commit, event.created_at));
        } else if (event.type === 'PullRequestEvent') {
            repoActivity.pullRequests += 1;
        } else if (event.type === 'IssuesEvent' || event.type === 'IssueCommentEvent') {
            repoActivity.issues += 1;
        }
    });

    (Array.isArray(repos) ? repos : []).forEach((repo) => {
        const pushedAt = new Date(repo?.pushed_at || '');
        if (!Number.isNaN(pushedAt.getTime()) && pushedAt >= start && pushedAt < endExclusive && repo?.full_name) {
            getActivity(repo.full_name);
        }
    });

    if (useGithubApi) {
        const enrichmentFailures = [];
        activity.forEach((repoActivity) => {
            const commits = fetchCommits(repoActivity.fullName, start, endExclusive);
            if (commits === null) {
                enrichmentFailures.push(repoActivity.fullName);
                return;
            }
            if (!commits.length) return;
            repoActivity.commits.clear();
            commits.forEach((commit) => addCommit(repoActivity, commit, commit?.commit?.committer?.date));
            repoActivity.maxDistinctCommits = commits.length;
        });
        if (enrichmentFailures.length) {
            throw new Error(`GitHub commit enrichment failed for: ${enrichmentFailures.join(', ')}`);
        }
    }

    const repositories = Array.from(activity.values()).map((repoActivity) => ({
        name: repoActivity.name,
        fullName: repoActivity.fullName,
        url: repoActivity.url,
        language: repoActivity.language,
        commits: Math.max(repoActivity.commits.size, repoActivity.maxDistinctCommits),
        pushes: repoActivity.pushes,
        events: repoActivity.events,
        pullRequests: repoActivity.pullRequests,
        issues: repoActivity.issues,
        lastAt: repoActivity.lastAt ? repoActivity.lastAt.toISOString() : null,
        commitMessages: Array.from(repoActivity.commits.values())
            .filter((commit) => commit.text)
            .sort((first, second) => String(second.at).localeCompare(String(first.at)))
            .slice(0, 12)
    })).sort((first, second) => (
        second.commits - first.commits ||
        second.pushes - first.pushes ||
        second.events - first.events ||
        first.name.localeCompare(second.name)
    ));

    const weeklyReleases = (Array.isArray(releases) ? releases : []).filter((release) => {
        const publishedAt = new Date(release?.published_at || release?.created_at || '');
        return !Number.isNaN(publishedAt.getTime()) && publishedAt >= start && publishedAt < endExclusive;
    }).map((release) => ({
        repo: String(release.repo || ''),
        name: String(release.name || release.tag || 'Release'),
        tag: String(release.tag || ''),
        url: String(release.url || ''),
        publishedAt: release.published_at || release.created_at
    }));

    const commitMessages = repositories.flatMap((repo) => repo.commitMessages.map((commit) => ({
        repo: repo.fullName,
        text: commit.text,
        rawMessage: commit.rawMessage,
        url: commit.url,
        at: commit.at
    }))).sort((first, second) => String(second.at).localeCompare(String(first.at)));
    const totalCommits = repositories.reduce((total, repo) => total + repo.commits, 0);
    const pullRequests = repositories.reduce((total, repo) => total + repo.pullRequests, 0);
    const issues = repositories.reduce((total, repo) => total + repo.issues, 0);
    const pushes = repositories.reduce((total, repo) => total + repo.pushes, 0);
    const topRepo = repositories[0] || null;
    const secondRepo = repositories[1] || null;
    const title = topRepo && secondRepo
        ? `${topRepo.name} and ${secondRepo.name} moved the week forward.`
        : topRepo
            ? `${topRepo.name} carried the build week.`
            : weeklyReleases.length
                ? `${weeklyReleases.length} release${weeklyReleases.length === 1 ? '' : 's'} landed.`
                : 'A quieter week, automatically kept on the record.';
    const leadActivity = topRepo
        ? `${topRepo.name} led public activity with ${topRepo.commits} commit${topRepo.commits === 1 ? '' : 's'} across ${topRepo.pushes} push${topRepo.pushes === 1 ? '' : 'es'}.`
        : 'The public project archive stayed quiet this week.';
    const shipped = commitMessages.slice(0, 4).map((commit) => commit.text);
    if (!shipped.length) shipped.push(...weeklyReleases.slice(0, 3).map((release) => release.name));
    if (!shipped.length) shipped.push('Public project activity was captured and archived.');
    const languages = [...new Set(repositories.map((repo) => repo.language).filter(Boolean))].slice(0, 4);
    const fixes = commitMessages
        .filter((commit) => /\b(?:fix|bug|repair|resolve|stabil|hardening|crash)\w*\b/i.test(commit.rawMessage || commit.text))
        .slice(0, 4)
        .map((commit) => commit.text);

    return {
        weekStart: dateKey(start),
        weekEnd: dateKey(end),
        generatedAt: now.toISOString(),
        source: 'github-weekly-automation',
        dateRange: formatRange(start, end),
        title,
        highlights: [
            leadActivity,
            `${repositories.length} public repositor${repositories.length === 1 ? 'y was' : 'ies were'} active across ${weeklyEvents.length} GitHub events.`,
            weeklyReleases.length
                ? `${weeklyReleases.length} release${weeklyReleases.length === 1 ? '' : 's'} joined the public download feed.`
                : 'No formal GitHub release was published during this edition.'
        ],
        shipped,
        engineering: [
            `${pushes} pushes and ${pullRequests} pull request updates were condensed into this edition.`,
            languages.length ? `Active stacks included ${languages.join(', ')}.` : 'Repository activity was recorded from the public GitHub feed.',
            'The snapshot is stored permanently so the edition remains available after GitHub events expire.'
        ],
        fixes,
        metrics: [
            `Commits: ${totalCommits}`,
            `Active repos: ${repositories.length}`,
            `Pull requests: ${pullRequests}`,
            `Issues: ${issues}`,
            `Releases: ${weeklyReleases.length}`
        ],
        next: topRepo
            ? [
                `Continue the ${topRepo.name} build and publish the next visible milestone.`,
                'Review the next automated edition after Sunday refresh.'
            ]
            : ['Keep shipping and let the next Sunday refresh capture the work.'],
        stats: {
            commits: totalCommits,
            activeRepositories: repositories.length,
            pullRequests,
            issues,
            pushes,
            releases: weeklyReleases.length,
            events: weeklyEvents.length
        },
        repositories: repositories.map(({ commitMessages: repoCommitMessages, ...repo }) => repo),
        releases: weeklyReleases,
        commitMessages: commitMessages.slice(0, 20).map(({ rawMessage, ...commit }) => commit)
    };
}

function upsertEntry(history, entry) {
    const entries = Array.isArray(history) ? history.slice() : [];
    const existingIndex = entries.findIndex((candidate) => candidate?.weekStart === entry.weekStart);
    if (existingIndex >= 0) {
        const existing = entries[existingIndex];
        const comparableExisting = { ...existing, generatedAt: '' };
        const comparableEntry = { ...entry, generatedAt: '' };
        entries[existingIndex] = JSON.stringify(comparableExisting) === JSON.stringify(comparableEntry)
            ? existing
            : entry;
    } else {
        entries.push(entry);
    }
    return entries;
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const currentWeek = startOfUtcWeek(options.now);
    const weekStart = options.weekStart
        ? parseDateKey(options.weekStart)
        : new Date(currentWeek.getTime() - (7 * dayMs));
    const entry = buildEntry({
        events: readJson(path.join(dataDir, 'github-events.json'), []),
        releases: readJson(path.join(dataDir, 'github-releases.json'), []),
        repos: readJson(path.join(dataDir, 'github-repos.json'), []),
        start: weekStart,
        now: options.now,
        useGithubApi: options.githubApi
    });

    if (options.dryRun) {
        process.stdout.write(`${JSON.stringify(entry, null, 2)}\n`);
        return;
    }

    const history = readJson(options.historyPath, []);
    const updatedHistory = upsertEntry(history, entry);
    writeJson(options.historyPath, updatedHistory);
    process.stdout.write(`Renewed Weekly Log for ${entry.weekStart}: ${entry.stats.commits} commits across ${entry.stats.activeRepositories} repos.\n`);
}

main();

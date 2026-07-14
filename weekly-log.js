(() => {
    'use strict';

    const CACHE_VERSION = '20260714a';
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const BASE_URL = new URL('.', document.baseURI);
    const dataUrl = (path) => {
        const url = new URL(path, BASE_URL);
        url.searchParams.set('v', CACHE_VERSION);
        return url.toString();
    };

    const DATA_URLS = {
        events: dataUrl('data/github-events.json'),
        weekly: dataUrl('data/github-weekly.json'),
        repos: dataUrl('data/github-repos.json'),
        releases: dataUrl('data/github-releases.json'),
        meta: dataUrl('data/github-meta.json'),
        history: dataUrl('data/weekly-history.json'),
        archive: dataUrl('WeeklyLog.txt')
    };

    const state = {
        weeks: [],
        index: 0,
        releases: [],
        meta: null,
        loaded: false,
        loading: null,
        refs: null,
        resizeTimer: null
    };

    const displayNames = {
        'atrak-website': 'Atrak Website',
        'rork-hoopshighlights-ai_Final': 'Hoops Highlights App',
        'Basketball_action_recoginition_sever': 'Hoops Clips Server',
        'GBC_HuskiesWeb': 'GBC Huskies Website',
        'coursebinder-ai-ready-google-classroom-exporter': 'CourseBinder',
        'formative-ai-exporter': 'Formative Exporter',
        'ai-hoops-board': 'AI Hoops Board'
    };

    const icons = {
        link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 13.5 13.5 10.5M8 16H6a4 4 0 0 1 0-8h3M16 8h2a4 4 0 1 1 0 8h-3"/></svg>',
        shipped: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M8.5 15.5 4 20l1.2-5.7L14.5 5 19 9.5l-9.3 9.3L4 20M12 8l4 4"/></svg>',
        progress: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/></svg>',
        next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 6 8 6-8 6V6Zm8 0 8 6-8 6V6Z"/></svg>',
        commits: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v12m10-6v12M7 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm10-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7 9c0 3 2 3 5 3h2c3 0 3 2 3 3"/></svg>',
        repos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v15H6.5A2.5 2.5 0 0 1 4 16.5v-10Z"/><path d="M4 16.5A2.5 2.5 0 0 1 6.5 14H20M8 7h8"/></svg>',
        releases: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13 13 20l-9-9V4h7l9 9Z"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>',
        report: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Z"/><path d="M14 3v4h4M9 11h6M9 15h6"/></svg>',
        chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>'
    };

    const escapeHtml = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const plainText = (value) => String(value || '')
        .replace(/[`*_#]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const safeUrl = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '#';
        if (/^#[a-z0-9_-]+$/i.test(raw)) return raw;
        if (/^(?:\.\.\/|\.\/|\/)?[a-z0-9][a-z0-9_./?&=#%-]*$/i.test(raw) && !raw.startsWith('//')) return raw;
        try {
            const url = new URL(raw);
            return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '#';
        } catch (_) {
            return '#';
        }
    };

    const formatRepoName = (value) => {
        const key = String(value || '').split('/').pop() || 'Repository';
        if (displayNames[key]) return displayNames[key];
        return key
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase())
            .trim();
    };

    const startOfWeek = (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        result.setDate(result.getDate() - result.getDay());
        result.setHours(0, 0, 0, 0);
        return result;
    };

    const weekKey = (value) => {
        const date = startOfWeek(value);
        if (!date) return '';
        const pad = (number) => String(number).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };

    const formatWeekRange = (value) => {
        const start = startOfWeek(value);
        if (!start) return '';
        const end = new Date(start.getTime() + (6 * 24 * 60 * 60 * 1000));
        const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
        const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
        if (start.getFullYear() !== end.getFullYear()) {
            return `${startMonth} ${start.getDate()}, ${start.getFullYear()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
        }
        if (start.getMonth() === end.getMonth()) {
            return `${startMonth} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
        }
        return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
    };

    const formatChipDate = (value) => {
        const date = startOfWeek(value);
        return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    };

    const formatFullDate = (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const timeAgo = (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Sync time unavailable';
        const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
        if (minutes < 2) return 'Synced just now';
        if (minutes < 60) return `Synced ${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `Synced ${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `Synced ${days}d ago`;
    };

    const fetchJson = async (url, fallback) => {
        try {
            const response = await fetch(url);
            if (!response.ok) return fallback;
            return await response.json();
        } catch (_) {
            return fallback;
        }
    };

    const fetchText = async (url) => {
        try {
            const response = await fetch(url);
            return response.ok ? await response.text() : '';
        } catch (_) {
            return '';
        }
    };

    const createWeek = (date) => ({
        key: weekKey(date),
        start: startOfWeek(date),
        eventCount: 0,
        pushes: 0,
        commits: 0,
        hasCommitCount: false,
        pullRequests: 0,
        issues: 0,
        repoActivity: new Map(),
        messages: [],
        messageKeys: new Set(),
        releases: [],
        releaseKeys: new Set(),
        archive: null,
        weeklyStats: null,
        latestEventAt: null,
        dataThrough: null
    });

    const ensureWeek = (map, date) => {
        const key = weekKey(date);
        if (!key) return null;
        if (!map.has(key)) map.set(key, createWeek(date));
        return map.get(key);
    };

    const repoActivityFor = (week, fullName, repoLookup) => {
        const repoKey = String(fullName || '').split('/').pop();
        if (!repoKey) return null;
        if (!week.repoActivity.has(repoKey)) {
            const cachedRepo = repoLookup.get(fullName) || repoLookup.get(repoKey) || null;
            week.repoActivity.set(repoKey, {
                key: repoKey,
                name: formatRepoName(repoKey),
                fullName,
                url: safeUrl(cachedRepo && cachedRepo.html_url ? cachedRepo.html_url : `https://github.com/${fullName}`),
                commits: 0,
                pushes: 0,
                events: 0,
                language: cachedRepo && cachedRepo.language ? cachedRepo.language : '',
                lastAt: null
            });
        }
        return week.repoActivity.get(repoKey);
    };

    const normalizeCommitMessage = (value) => {
        const message = plainText(value);
        if (/^chore(?:\([^)]*\))?!?:\s*update github data/i.test(message)) return '';
        return message
            .replace(/^(?:feat|fix|docs|refactor|chore|style|test|build|ci|perf)(?:\([^)]*\))?!?:\s*/i, '')
            .replace(/^merge pull request\b.*$/i, '')
            .trim();
    };

    const addMessage = (week, fullName, message) => {
        const normalized = normalizeCommitMessage(message);
        if (!normalized || /^merge\b/i.test(normalized)) return;
        const key = `${fullName}:${normalized}`.toLowerCase();
        if (week.messageKeys.has(key)) return;
        week.messageKeys.add(key);
        week.messages.push({ repo: fullName, text: normalized });
    };

    const normalizeReleases = (releases) => (Array.isArray(releases) ? releases : [])
        .map((release) => {
            const publishedAt = new Date(release && (release.published_at || release.created_at));
            if (Number.isNaN(publishedAt.getTime())) return null;
            const fullName = String(release.repo || '').trim();
            return {
                key: `${fullName}:${release.tag || release.name || publishedAt.toISOString()}`,
                fullName,
                repo: formatRepoName(fullName),
                name: plainText(release.name || release.tag || 'Release'),
                tag: plainText(release.tag || ''),
                url: safeUrl(release.url || `https://github.com/${fullName}/releases`),
                publishedAt
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.publishedAt - a.publishedAt);

    const buildGitHubWeeks = (events, releases, repos) => {
        const weeks = new Map();
        const repoLookup = new Map();
        (Array.isArray(repos) ? repos : []).forEach((repo) => {
            if (!repo || !repo.name) return;
            repoLookup.set(repo.name, repo);
            if (repo.full_name) repoLookup.set(repo.full_name, repo);
        });

        (Array.isArray(events) ? events : []).forEach((event) => {
            if (!event || !event.created_at) return;
            const createdAt = new Date(event.created_at);
            if (Number.isNaN(createdAt.getTime())) return;
            const week = ensureWeek(weeks, createdAt);
            if (!week) return;
            const fullName = event.repo && event.repo.name ? String(event.repo.name) : '';
            const repo = repoActivityFor(week, fullName, repoLookup);
            week.eventCount += 1;
            if (!week.latestEventAt || createdAt > week.latestEventAt) week.latestEventAt = createdAt;
            if (!week.dataThrough || createdAt > week.dataThrough) week.dataThrough = createdAt;
            if (repo) {
                repo.events += 1;
                if (!repo.lastAt || createdAt > repo.lastAt) repo.lastAt = createdAt;
            }

            if (event.type === 'PushEvent') {
                week.pushes += 1;
                if (repo) repo.pushes += 1;
                const commits = event.payload && Array.isArray(event.payload.commits) ? event.payload.commits : [];
                const distinctSize = Number(event.payload && event.payload.distinct_size);
                const commitCount = Number.isFinite(distinctSize) && distinctSize > 0 ? distinctSize : commits.length;
                if (commitCount > 0) {
                    week.hasCommitCount = true;
                    week.commits += commitCount;
                    if (repo) repo.commits += commitCount;
                }
                commits.forEach((commit) => addMessage(week, fullName, commit && commit.message));
            } else if (event.type === 'PullRequestEvent') {
                week.pullRequests += 1;
            } else if (event.type === 'IssuesEvent' || event.type === 'IssueCommentEvent') {
                week.issues += 1;
            }
        });

        releases.forEach((release) => {
            const week = ensureWeek(weeks, release.publishedAt);
            if (!week || week.releaseKeys.has(release.key)) return;
            week.releaseKeys.add(release.key);
            week.releases.push(release);
            repoActivityFor(week, release.fullName, repoLookup);
            if (!week.dataThrough || release.publishedAt > week.dataThrough) week.dataThrough = release.publishedAt;
        });

        (Array.isArray(repos) ? repos : []).forEach((repo) => {
            if (!repo || !repo.pushed_at) return;
            const pushedAt = new Date(repo.pushed_at);
            if (Number.isNaN(pushedAt.getTime())) return;
            const week = weeks.get(weekKey(pushedAt));
            if (!week) return;
            const fullName = repo.full_name || `charlie2233/${repo.name}`;
            const activity = repoActivityFor(week, fullName, repoLookup);
            if (activity && (!activity.lastAt || pushedAt > activity.lastAt)) activity.lastAt = pushedAt;
        });

        return weeks;
    };

    const parseArchive = (text) => {
        const source = String(text || '');
        if (!source.trim()) return [];
        const projectMatch = source.match(/^#\s+(.+)$/m);
        const projectTitle = plainText(projectMatch ? projectMatch[1] : 'Atrak Project')
            .replace(/\s+—\s+Weekly Dev News.*$/i, '')
            .trim();
        const markers = [];
        const markerPattern = /^##\s+Week of\s+(.+)$/gm;
        let marker;
        while ((marker = markerPattern.exec(source)) !== null) {
            markers.push({ index: marker.index, range: plainText(marker[1]) });
        }

        const parsed = markers.map((current, index) => {
            const next = markers[index + 1];
            const section = source.slice(current.index, next ? next.index : source.length);
            const headlineMatch = section.match(/^###\s+(.+)$/m);
            const blocks = {};
            let activeBlock = '';
            section.split(/\r?\n/).forEach((rawLine) => {
                const line = rawLine.trim();
                if (!line) return;
                const blockMatch = line.match(/^\*\*(.+?)\*\*$/);
                if (blockMatch) {
                    activeBlock = plainText(blockMatch[1]);
                    if (!blocks[activeBlock]) blocks[activeBlock] = [];
                    return;
                }
                if (!activeBlock) return;
                const bulletMatch = line.match(/^[-*]\s+(.+)$/);
                if (bulletMatch) blocks[activeBlock].push(plainText(bulletMatch[1]));
            });
            return {
                range: current.range,
                headline: plainText(headlineMatch ? headlineMatch[1] : '').replace(/^["“]|["”]$/g, ''),
                projectTitle,
                blocks
            };
        });

        const monthIndex = (name) => {
            const date = new Date(`${name} 1, 2000`);
            return Number.isNaN(date.getTime()) ? -1 : date.getMonth();
        };
        const firstMonthDay = (range) => {
            const match = String(range || '').match(/([A-Za-z]{3,9})\s+(\d{1,2})/);
            return match ? { month: monthIndex(match[1]), day: Number(match[2]) } : null;
        };

        let year = new Date().getFullYear();
        const first = parsed.length ? firstMonthDay(parsed[0].range) : null;
        if (first) {
            const firstCandidate = new Date(year, first.month, first.day);
            if (firstCandidate.getTime() > Date.now() + (30 * 24 * 60 * 60 * 1000)) year -= 1;
        }
        let previousMonth = first ? first.month : -1;

        return parsed.map((entry, index) => {
            const monthDay = firstMonthDay(entry.range);
            if (!monthDay) return null;
            if (index > 0 && monthDay.month < previousMonth && previousMonth >= 9) year += 1;
            previousMonth = monthDay.month;
            const date = new Date(year, monthDay.month, monthDay.day);
            date.setHours(0, 0, 0, 0);
            return { ...entry, date, key: weekKey(date) };
        }).filter(Boolean);
    };

    const parseLocalDateKey = (value) => {
        const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        date.setHours(0, 0, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    };

    const parseHistory = (history) => {
        const entries = Array.isArray(history) ? history.filter((entry) => entry && typeof entry === 'object') : [];
        const monthIndex = (name) => {
            const date = new Date(`${name} 1, 2000`);
            return Number.isNaN(date.getTime()) ? -1 : date.getMonth();
        };
        const firstMonthDay = (range) => {
            const match = String(range || '').match(/([A-Za-z]{3,9})\s+(\d{1,2})/);
            return match ? { month: monthIndex(match[1]), day: Number(match[2]) } : null;
        };
        const firstLegacy = entries.find((entry) => !entry.weekStart && firstMonthDay(entry.dateRange));
        const first = firstLegacy ? firstMonthDay(firstLegacy.dateRange) : null;
        let year = new Date().getFullYear();
        if (first) {
            const candidate = new Date(year, first.month, first.day);
            if (candidate.getTime() > Date.now() + (30 * 24 * 60 * 60 * 1000)) year -= 1;
        }
        let previousMonth = first ? first.month : -1;

        return entries.map((entry) => {
            let date = parseLocalDateKey(entry.weekStart);
            if (!date) {
                const monthDay = firstMonthDay(entry.dateRange);
                if (!monthDay) return null;
                if (previousMonth >= 9 && monthDay.month < previousMonth) year += 1;
                previousMonth = monthDay.month;
                date = new Date(year, monthDay.month, monthDay.day);
                date.setHours(0, 0, 0, 0);
            }
            return {
                range: plainText(entry.dateRange || formatWeekRange(date)),
                headline: plainText(entry.title || ''),
                projectTitle: 'Atrak Team',
                blocks: {
                    Highlights: Array.isArray(entry.highlights) ? entry.highlights : [],
                    Shipped: Array.isArray(entry.shipped) ? entry.shipped : [],
                    Engineering: Array.isArray(entry.engineering) ? entry.engineering : [],
                    Fixes: Array.isArray(entry.fixes) ? entry.fixes : [],
                    Metrics: Array.isArray(entry.metrics) ? entry.metrics : [],
                    Next: Array.isArray(entry.next) ? entry.next : []
                },
                date,
                key: weekKey(date),
                snapshot: entry
            };
        }).filter(Boolean);
    };

    const blockEntries = (archive, names) => {
        if (!archive || !archive.blocks) return [];
        const normalizedNames = names.map((name) => name.toLowerCase());
        const key = Object.keys(archive.blocks).find((candidate) => normalizedNames.includes(candidate.toLowerCase()));
        return key && Array.isArray(archive.blocks[key]) ? archive.blocks[key].filter(Boolean) : [];
    };

    const metricFromArchive = (archive, labels) => {
        const metrics = blockEntries(archive, ['Metrics']);
        for (const metric of metrics) {
            const match = metric.match(/^([^:]+):\s*(.+)$/);
            if (!match) continue;
            const label = match[1].trim().toLowerCase();
            if (!labels.some((candidate) => label.includes(candidate))) continue;
            const numberMatch = match[2].match(/\d[\d,]*/);
            if (numberMatch) return Number(numberMatch[0].replace(/,/g, ''));
        }
        return null;
    };

    const mergeArchiveWeeks = (weeks, archiveEntries) => {
        archiveEntries.forEach((entry) => {
            const week = ensureWeek(weeks, entry.date);
            if (!week) return;
            week.archive = entry;
            const commits = metricFromArchive(entry, ['commit']);
            if (!week.hasCommitCount && Number.isFinite(commits)) {
                week.commits = commits;
                week.hasCommitCount = true;
            }
            const pullRequests = metricFromArchive(entry, ['pr', 'pull request']);
            if (!week.pullRequests && Number.isFinite(pullRequests)) week.pullRequests = pullRequests;
            const issues = metricFromArchive(entry, ['issue']);
            if (!week.issues && Number.isFinite(issues)) week.issues = issues;
            if (!week.dataThrough) week.dataThrough = new Date(week.start.getTime() + (6 * 24 * 60 * 60 * 1000));
        });
    };

    const mergeHistoryWeeks = (weeks, historyEntries) => {
        mergeArchiveWeeks(weeks, historyEntries);
        historyEntries.forEach((entry) => {
            const snapshot = entry.snapshot;
            if (!snapshot || snapshot.source !== 'github-weekly-automation' || !snapshot.stats) return;
            const week = ensureWeek(weeks, entry.date);
            if (!week) return;
            const stats = snapshot.stats;
            const weekEnd = parseLocalDateKey(snapshot.weekEnd);
            const throughDate = weekEnd
                ? new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59, 999)
                : new Date(week.start.getTime() + WEEK_MS - 1);
            week.weeklyStats = {
                updatedAt: snapshot.generatedAt,
                from: `${snapshot.weekStart}T00:00:00Z`,
                to: `${snapshot.weekEnd}T23:59:59Z`,
                totalCommitContributions: Number(stats.commits || 0),
                totalPullRequestContributions: Number(stats.pullRequests || 0),
                totalIssueContributions: Number(stats.issues || 0),
                totalRepositoryContributions: Number(stats.activeRepositories || 0),
                source: 'weekly-automation'
            };
            week.commits = Number(stats.commits || 0);
            week.hasCommitCount = true;
            week.pullRequests = Number(stats.pullRequests || 0);
            week.issues = Number(stats.issues || 0);
            week.pushes = Number(stats.pushes || 0);
            week.eventCount = Number(stats.events || 0);
            week.dataThrough = throughDate;
            week.latestEventAt = throughDate;

            (Array.isArray(snapshot.repositories) ? snapshot.repositories : []).forEach((repo) => {
                const fullName = String(repo.fullName || '');
                const repoKey = fullName.split('/').pop();
                if (!repoKey) return;
                week.repoActivity.set(repoKey, {
                    key: repoKey,
                    name: plainText(repo.name || formatRepoName(repoKey)),
                    fullName,
                    url: safeUrl(repo.url || `https://github.com/${fullName}`),
                    commits: Number(repo.commits || 0),
                    pushes: Number(repo.pushes || 0),
                    events: Number(repo.events || 0),
                    language: plainText(repo.language || ''),
                    lastAt: repo.lastAt ? new Date(repo.lastAt) : throughDate
                });
            });

            normalizeReleases((Array.isArray(snapshot.releases) ? snapshot.releases : []).map((release) => ({
                ...release,
                published_at: release.publishedAt
            }))).forEach((release) => {
                if (week.releaseKeys.has(release.key)) return;
                week.releaseKeys.add(release.key);
                week.releases.push(release);
            });
            (Array.isArray(snapshot.commitMessages) ? snapshot.commitMessages : [])
                .forEach((commit) => addMessage(week, commit.repo, commit.text));
        });
    };

    const attachWeeklyStats = (weeks, weeklyStats) => {
        if (!weeklyStats || typeof weeklyStats !== 'object' || !weeklyStats.to) return;
        const throughDate = new Date(weeklyStats.to);
        if (Number.isNaN(throughDate.getTime())) return;
        const week = ensureWeek(weeks, throughDate);
        if (!week) return;
        week.weeklyStats = weeklyStats;
        const commits = Number(weeklyStats.totalCommitContributions);
        if (Number.isFinite(commits)) {
            week.commits = Math.max(0, commits);
            week.hasCommitCount = true;
        }
        const pullRequests = Number(weeklyStats.totalPullRequestContributions);
        if (Number.isFinite(pullRequests)) week.pullRequests = Math.max(0, pullRequests);
        const issues = Number(weeklyStats.totalIssueContributions);
        if (Number.isFinite(issues)) week.issues = Math.max(0, issues);
        week.dataThrough = throughDate;
    };

    const topReposFor = (week) => Array.from(week.repoActivity.values())
        .sort((a, b) => (b.commits - a.commits) || (b.pushes - a.pushes) || (b.events - a.events) || a.name.localeCompare(b.name));

    const activeRepoCount = (week) => {
        if (week.weeklyStats) {
            const cachedCount = Number(week.weeklyStats.totalRepositoryContributions);
            if (Number.isFinite(cachedCount)) return Math.max(0, cachedCount);
        }
        return week.repoActivity.size;
    };

    const summarize = (items, fallback) => {
        const clean = items.map(plainText).filter(Boolean).slice(0, 2);
        if (!clean.length) return fallback;
        return clean.join(' · ');
    };

    const projectLinkForArchive = (archive) => {
        if (!archive) return '#';
        if (/basketball tactics board/i.test(archive.projectTitle)) return 'projects/ai-hoops-board.html';
        return '#projects';
    };

    const buildStoryRows = (week, topRepos) => {
        const archive = week.archive;
        const shippedArchive = blockEntries(archive, ['Shipped']);
        const progressArchive = blockEntries(archive, ['Engineering', 'Highlights']);
        const nextArchive = blockEntries(archive, ['Next']);
        const repoLink = topRepos[0] ? topRepos[0].url : projectLinkForArchive(archive);
        const repoName = topRepos[0] ? topRepos[0].name : (archive ? archive.projectTitle : 'the active projects');
        const messages = week.messages.map((message) => message.text);
        const shippedFallback = week.pushes
            ? `${week.pushes} push${week.pushes === 1 ? '' : 'es'} landed across ${Math.max(activeRepoCount(week), 1)} active repo${activeRepoCount(week) === 1 ? '' : 's'}.`
            : 'This archive week focused on steady project development.';
        const progressFallback = topRepos[0]
            ? `${repoName} carried the most visible activity in this snapshot.`
            : 'The archived notes capture the team’s implementation focus.';
        const nextFallback = topRepos[0]
            ? `Follow ${repoName} for the next public update.`
            : 'The next archived week continues the build story.';

        return [
            {
                key: 'shipped',
                label: 'Shipped',
                text: summarize(shippedArchive.length ? shippedArchive : messages.slice(0, 2), shippedFallback),
                href: repoLink
            },
            {
                key: 'progress',
                label: 'In progress',
                text: summarize(progressArchive.length ? progressArchive : messages.slice(2, 4), progressFallback),
                href: repoLink
            },
            {
                key: 'next',
                label: 'Next',
                text: summarize(nextArchive, nextFallback),
                href: repoLink
            }
        ];
    };

    const buildHeadline = (week, topRepos) => {
        if (week.archive && week.archive.headline) return week.archive.headline;
        if (topRepos.length > 1) return `${topRepos[0].name} and ${topRepos[1].name} led the build week.`;
        if (topRepos.length === 1) return `${topRepos[0].name} kept moving.`;
        if (week.releases.length) return `${week.releases.length} release${week.releases.length === 1 ? '' : 's'} landed this week.`;
        return 'A quieter week, kept on the record.';
    };

    const sourceModel = (week) => {
        if (week.weeklyStats) {
            const source = String(week.weeklyStats.source || '').toLowerCase();
            const label = source === 'local-git-refresh'
                ? 'Local checked-out repos'
                : source === 'weekly-automation'
                    ? 'Automated weekly snapshot'
                    : 'GitHub contribution data';
            return {
                label: `${label} • through ${formatFullDate(week.weeklyStats.to)}`,
                sync: timeAgo(week.weeklyStats.updatedAt),
                state: source === 'local-git-refresh' ? 'local' : (source === 'weekly-automation' ? 'archive' : 'fresh')
            };
        }
        if (week.eventCount || week.releases.length) {
            return {
                label: 'GitHub activity cache',
                sync: state.meta && state.meta.updatedAt ? timeAgo(state.meta.updatedAt) : 'Cache snapshot',
                state: 'fresh'
            };
        }
        return {
            label: 'Atrak editorial archive',
            sync: 'Archived',
            state: 'archive'
        };
    };

    const activityMeta = (repo) => {
        const parts = [];
        if (repo.commits > 0) parts.push(`${repo.commits} commit${repo.commits === 1 ? '' : 's'}`);
        if (repo.pushes > 0) parts.push(`${repo.pushes} push${repo.pushes === 1 ? '' : 'es'}`);
        if (!parts.length && repo.language) parts.push(repo.language);
        if (!parts.length && repo.lastAt) parts.push(`Updated ${formatFullDate(repo.lastAt)}`);
        return parts.join(' • ') || 'Activity recorded';
    };

    const linkRow = (href, title, meta) => `
        <a class="wl-link-row" href="${escapeHtml(safeUrl(href))}" aria-label="Open ${escapeHtml(title)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>
            <span class="wl-link-row__icon">${icons.link}</span>
            <span class="wl-link-row__copy">
                <strong>${escapeHtml(title)}</strong>
                <small>${escapeHtml(meta)}</small>
            </span>
        </a>
    `;

    const detailSection = (title, items) => {
        const entries = items.map(plainText).filter(Boolean).slice(0, 6);
        if (!entries.length) return '';
        return `
            <section class="wl-detail-block">
                <h5>${escapeHtml(title)}</h5>
                <ul>${entries.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>
            </section>
        `;
    };

    const renderWeekBody = (week) => {
        const topRepos = topReposFor(week);
        const rows = buildStoryRows(week, topRepos);
        const headline = buildHeadline(week, topRepos);
        const latestReleases = week.releases.length ? week.releases.slice(0, 2) : state.releases.slice(0, 2);
        const releaseHeading = week.releases.length ? 'Released this week' : 'Latest releases';
        const commitValue = week.hasCommitCount ? week.commits.toLocaleString('en-US') : '—';
        const repoCount = activeRepoCount(week);
        const archive = week.archive;
        const detailBlocks = [
            detailSection('Highlights', blockEntries(archive, ['Highlights'])),
            detailSection('Engineering', blockEntries(archive, ['Engineering'])),
            detailSection('Fixes & challenges', [
                ...blockEntries(archive, ['Fixes']),
                ...blockEntries(archive, ['Challenges'])
            ]),
            detailSection('GitHub changes', week.messages.map((message) => `${formatRepoName(message.repo)} — ${message.text}`))
        ].filter(Boolean).join('');
        const topRepoRows = topRepos.length
            ? topRepos.slice(0, 3).map((repo) => linkRow(repo.url, repo.name, activityMeta(repo))).join('')
            : linkRow(projectLinkForArchive(archive), archive ? archive.projectTitle : 'Atrak projects', archive ? 'Archived project log' : 'Browse the project hub');
        const releaseRows = latestReleases.length
            ? latestReleases.map((release) => linkRow(release.url, release.name || release.tag, `${release.repo} • ${formatFullDate(release.publishedAt)}`)).join('')
            : linkRow('releases.html', 'Release archive', 'No release was published in this snapshot');

        return `
            <article class="wl-report" data-week-key="${escapeHtml(week.key)}">
                <section class="wl-report__editorial" aria-labelledby="weekly-report-headline">
                    <div class="wl-eyebrow">${state.index === 0 ? 'This week at Atrak' : 'From the Atrak archive'}</div>
                    <h3 id="weekly-report-headline">${escapeHtml(headline)}</h3>
                    <div class="wl-story-list">
                        ${rows.map((row) => `
                            <div class="wl-story-row wl-story-row--${row.key}">
                                <span class="wl-story-row__symbol">${icons[row.key]}</span>
                                <div class="wl-story-row__copy">
                                    <h4>${escapeHtml(row.label)}</h4>
                                    <p>${escapeHtml(row.text)}</p>
                                </div>
                                <a class="wl-story-row__link" href="${escapeHtml(safeUrl(row.href))}"${/^https?:/i.test(row.href) ? ' target="_blank" rel="noopener noreferrer"' : ''} aria-label="Open ${escapeHtml(row.label)} source">${icons.link}</a>
                            </div>
                        `).join('')}
                    </div>
                    <details class="wl-report__details">
                        <summary>${icons.report}<span>Read full report</span>${icons.chevron}</summary>
                        <div class="wl-report__details-grid">
                            ${detailBlocks || detailSection('Week notes', ['No expanded notes were published for this week.'])}
                        </div>
                    </details>
                </section>

                <aside class="wl-pulse" aria-labelledby="weekly-pulse-title">
                    <div class="wl-eyebrow" id="weekly-pulse-title">GitHub pulse</div>
                    <div class="wl-pulse__metrics">
                        <div class="wl-metric" title="${week.hasCommitCount ? 'Count reported by the selected data source' : 'Commit count is unavailable for this cached week'}">
                            <span>${icons.commits}</span><strong>${escapeHtml(commitValue)}</strong><small>Commits</small>
                        </div>
                        <div class="wl-metric">
                            <span>${icons.repos}</span><strong>${escapeHtml(repoCount || '—')}</strong><small>Active repos</small>
                        </div>
                        <div class="wl-metric">
                            <span>${icons.releases}</span><strong>${escapeHtml(week.releases.length)}</strong><small>Releases</small>
                        </div>
                    </div>
                    <details class="wl-pulse__drawer" open>
                        <summary>Repositories &amp; releases ${icons.chevron}</summary>
                        <div class="wl-pulse__lists">
                            <section class="wl-pulse-list">
                                <div class="wl-pulse-list__heading"><h4>Top repos this week</h4><span>${escapeHtml(repoCount || 0)} active</span></div>
                                ${topRepoRows}
                            </section>
                            <section class="wl-pulse-list">
                                <div class="wl-pulse-list__heading"><h4>${escapeHtml(releaseHeading)}</h4><a href="releases.html" aria-label="Open all releases">${icons.link}All releases</a></div>
                                ${releaseRows}
                            </section>
                        </div>
                    </details>
                </aside>
            </article>
        `;
    };

    const refs = () => {
        if (state.refs) return state.refs;
        state.refs = {
            card: document.getElementById('weekly-highlights'),
            content: document.getElementById('weekly-content'),
            date: document.getElementById('weekly-date-range'),
            sync: document.getElementById('weekly-sync-pill'),
            source: document.getElementById('weekly-source-note'),
            freshness: document.getElementById('weekly-freshness-strip'),
            strip: document.getElementById('weekly-week-strip'),
            previous: document.getElementById('prev-week-btn'),
            next: document.getElementById('next-week-btn'),
            railPrevious: document.getElementById('weekly-rail-prev-btn'),
            railNext: document.getElementById('weekly-rail-next-btn'),
            share: document.getElementById('weekly-share-btn')
        };
        return state.refs;
    };

    const selectedKeyFromHash = () => {
        const match = String(window.location.hash || '').match(/^#week=(\d{4}-\d{2}-\d{2})$/);
        return match ? match[1] : '';
    };

    const syncPulseDrawer = () => {
        const drawer = document.querySelector('.wl-pulse__drawer');
        if (!drawer) return;
        drawer.open = !window.matchMedia('(max-width: 760px)').matches;
    };

    const updateRailControls = () => {
        const elements = refs();
        if (!elements.strip) return;
        const maxScroll = Math.max(0, elements.strip.scrollWidth - elements.strip.clientWidth);
        if (elements.railPrevious) elements.railPrevious.disabled = elements.strip.scrollLeft <= 2;
        if (elements.railNext) elements.railNext.disabled = elements.strip.scrollLeft >= maxScroll - 2;
    };

    const updateWeekStrip = () => {
        const elements = refs();
        if (!elements.strip) return;
        elements.strip.innerHTML = state.weeks.slice().reverse().map((week) => {
            const index = state.weeks.indexOf(week);
            const selected = index === state.index;
            return `
                <button class="weekly-week-chip" type="button" role="option" data-week-index="${index}" aria-selected="${selected}"${selected ? ' aria-current="true"' : ''}>
                    <span>${escapeHtml(formatChipDate(week.start))}</span>
                    <small>${escapeHtml(week.start.getFullYear())}</small>
                </button>
            `;
        }).join('');
        requestAnimationFrame(() => {
            const selected = elements.strip.querySelector('[aria-current="true"]');
            if (selected) {
                const target = selected.offsetLeft - ((elements.strip.clientWidth - selected.offsetWidth) / 2);
                elements.strip.scrollTo({ left: Math.max(0, target), behavior: 'auto' });
            }
            elements.card.scrollLeft = 0;
            updateRailControls();
        });
    };

    const updateFreshness = (week) => {
        const elements = refs();
        if (!elements.freshness) return;
        const through = week.dataThrough || new Date(week.start.getTime() + (6 * 24 * 60 * 60 * 1000));
        const historical = state.index > 0;
        const ageDays = Math.max(0, Math.floor((Date.now() - through.getTime()) / (24 * 60 * 60 * 1000)));
        let stateName = historical ? 'archive' : (ageDays <= 3 ? 'fresh' : 'aging');
        let label = historical ? `Archived week • data through ${formatFullDate(through)}` : `Data through ${formatFullDate(through)}`;
        if (week.weeklyStats && String(week.weeklyStats.source || '').toLowerCase() === 'local-git-refresh') {
            stateName = 'local';
            label = `Local aggregate snapshot • through ${formatFullDate(through)}`;
        }
        elements.freshness.dataset.state = stateName;
        elements.freshness.textContent = label;
    };

    const setPermalink = (key) => {
        try {
            const url = new URL(window.location.href);
            url.hash = `week=${key}`;
            window.history.replaceState(null, '', url);
        } catch (_) {
            window.location.hash = `week=${key}`;
        }
    };

    const alignPermalink = () => {
        if (!selectedKeyFromHash()) return;
        const card = refs().card;
        if (card) card.scrollIntoView({ block: 'start', behavior: 'auto' });
    };

    const schedulePermalinkAlignment = () => {
        requestAnimationFrame(alignPermalink);
        if (document.readyState !== 'complete') window.addEventListener('load', alignPermalink, { once: true });
        window.setTimeout(alignPermalink, 1800);
    };

    const renderSelectedWeek = ({ updateUrl = true, direction = '' } = {}) => {
        const elements = refs();
        const week = state.weeks[state.index];
        if (!elements.content || !week) return;
        const source = sourceModel(week);
        elements.card.setAttribute('aria-busy', 'true');
        elements.date.textContent = formatWeekRange(week.start);
        elements.sync.textContent = source.sync;
        elements.sync.dataset.state = source.state;
        elements.source.textContent = source.label;
        elements.content.innerHTML = renderWeekBody(week);
        elements.content.dataset.direction = direction;
        elements.previous.disabled = state.index >= state.weeks.length - 1;
        elements.next.disabled = state.index <= 0;
        elements.previous.title = elements.previous.disabled ? 'Oldest week in the archive' : 'Open the previous week';
        elements.next.title = elements.next.disabled ? 'Latest available week' : 'Open the next week';
        updateWeekStrip();
        updateFreshness(week);
        syncPulseDrawer();
        if (updateUrl) setPermalink(week.key);
        elements.card.setAttribute('aria-busy', 'false');
        elements.card.setAttribute('aria-label', `Weekly Log for ${formatWeekRange(week.start)}`);
        window.setTimeout(() => elements.content.removeAttribute('data-direction'), 360);
    };

    const goToIndex = (nextIndex, direction) => {
        const bounded = Math.max(0, Math.min(Number(nextIndex) || 0, state.weeks.length - 1));
        if (bounded === state.index) return;
        state.index = bounded;
        renderSelectedWeek({ updateUrl: true, direction });
    };

    const copyText = async (value) => {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(value);
                return true;
            } catch (_) {
            }
        }
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        return copied;
    };

    const showShareFallback = (url) => {
        const elements = refs();
        let fallback = document.getElementById('weekly-share-fallback');
        if (!fallback) {
            fallback = document.createElement('div');
            fallback.className = 'weekly-share-fallback';
            fallback.id = 'weekly-share-fallback';
            fallback.innerHTML = `
                <label for="weekly-share-url">Permalink</label>
                <input id="weekly-share-url" type="text" readonly aria-label="Weekly log permalink">
                <button type="button" aria-label="Close permalink">×</button>
            `;
            fallback.querySelector('button').addEventListener('click', () => fallback.hidden = true);
            elements.card.appendChild(fallback);
        }
        const input = fallback.querySelector('input');
        input.value = url;
        fallback.hidden = false;
        input.focus();
        input.select();
    };

    const shareSelectedWeek = async () => {
        const elements = refs();
        const week = state.weeks[state.index];
        if (!elements.share || !week) return;
        const label = elements.share.querySelector('[data-weekly-share-label]');
        const url = new URL(window.location.href);
        url.hash = `week=${week.key}`;
        const headline = buildHeadline(week, topReposFor(week));
        let status = 'Copied';
        try {
            if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
                await navigator.share({ title: `Atrak Weekly Log — ${formatWeekRange(week.start)}`, text: headline, url: url.toString() });
                status = 'Shared';
            } else {
                const copied = await copyText(url.toString());
                status = copied ? 'Copied' : 'Select link';
                if (!copied) showShareFallback(url.toString());
            }
        } catch (error) {
            if (error && error.name === 'AbortError') return;
            status = 'Try again';
        }
        if (label) label.textContent = status;
        elements.share.dataset.state = status === 'Try again' ? 'error' : (status === 'Select link' ? 'ready' : 'success');
        window.setTimeout(() => {
            if (label) label.textContent = 'Share';
            delete elements.share.dataset.state;
        }, 1600);
    };

    const bindInteractions = () => {
        const elements = refs();
        if (!elements.card || elements.card.dataset.weeklyBound === 'true') return;
        elements.card.dataset.weeklyBound = 'true';
        elements.previous.addEventListener('click', () => goToIndex(state.index + 1, 'older'));
        elements.next.addEventListener('click', () => goToIndex(state.index - 1, 'newer'));
        elements.share.addEventListener('click', shareSelectedWeek);
        elements.strip.addEventListener('click', (event) => {
            const button = event.target.closest('[data-week-index]');
            if (!button) return;
            const nextIndex = Number(button.dataset.weekIndex);
            goToIndex(nextIndex, nextIndex > state.index ? 'older' : 'newer');
        });
        elements.strip.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            if (event.key === 'ArrowLeft') goToIndex(state.index + 1, 'older');
            if (event.key === 'ArrowRight') goToIndex(state.index - 1, 'newer');
            if (event.key === 'Home') goToIndex(state.weeks.length - 1, 'older');
            if (event.key === 'End') goToIndex(0, 'newer');
        });
        elements.railPrevious.addEventListener('click', () => elements.strip.scrollBy({ left: -elements.strip.clientWidth * 0.72, behavior: 'smooth' }));
        elements.railNext.addEventListener('click', () => elements.strip.scrollBy({ left: elements.strip.clientWidth * 0.72, behavior: 'smooth' }));
        elements.strip.addEventListener('scroll', updateRailControls, { passive: true });

        let startX = 0;
        let startY = 0;
        elements.content.addEventListener('touchstart', (event) => {
            if (event.target.closest('a, button, summary, details')) return;
            const touch = event.changedTouches[0];
            startX = touch.clientX;
            startY = touch.clientY;
        }, { passive: true });
        elements.content.addEventListener('touchend', (event) => {
            if (!startX && !startY) return;
            const touch = event.changedTouches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            startX = 0;
            startY = 0;
            if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
            if (deltaX < 0) goToIndex(state.index + 1, 'older');
            else goToIndex(state.index - 1, 'newer');
        }, { passive: true });

        window.addEventListener('hashchange', () => {
            const requested = selectedKeyFromHash();
            const index = state.weeks.findIndex((week) => week.key === requested);
            if (index >= 0 && index !== state.index) {
                const direction = index > state.index ? 'older' : 'newer';
                state.index = index;
                renderSelectedWeek({ updateUrl: false, direction });
            }
        });
        window.addEventListener('resize', () => {
            window.clearTimeout(state.resizeTimer);
            state.resizeTimer = window.setTimeout(() => {
                syncPulseDrawer();
                updateRailControls();
            }, 120);
        }, { passive: true });
        document.addEventListener('atrak:projects-updated', () => {
            requestAnimationFrame(alignPermalink);
        });
    };

    const showError = () => {
        const elements = refs();
        if (!elements.content) return;
        elements.content.innerHTML = `
            <div class="weekly-briefing__error">
                <strong>The weekly briefing could not load.</strong>
                <p>The project and release archives are still available.</p>
                <a href="releases.html" aria-label="Open releases">${icons.link}Open releases</a>
            </div>
        `;
        if (elements.previous) elements.previous.disabled = true;
        if (elements.next) elements.next.disabled = true;
        if (elements.card) elements.card.setAttribute('aria-busy', 'false');
        if (elements.sync) {
            elements.sync.textContent = 'Unavailable';
            elements.sync.dataset.state = 'error';
        }
    };

    const loadAndRender = async () => {
        const [events, weeklyStats, repos, releasesRaw, meta, history, archiveText] = await Promise.all([
            fetchJson(DATA_URLS.events, []),
            fetchJson(DATA_URLS.weekly, null),
            fetchJson(DATA_URLS.repos, []),
            fetchJson(DATA_URLS.releases, []),
            fetchJson(DATA_URLS.meta, null),
            fetchJson(DATA_URLS.history, []),
            fetchText(DATA_URLS.archive)
        ]);
        state.releases = normalizeReleases(releasesRaw);
        state.meta = meta && typeof meta === 'object' ? meta : null;
        const weeks = buildGitHubWeeks(events, state.releases, repos);
        mergeHistoryWeeks(weeks, parseHistory(history));
        mergeArchiveWeeks(weeks, parseArchive(archiveText));
        attachWeeklyStats(weeks, weeklyStats);
        state.weeks = Array.from(weeks.values())
            .filter((week) => week && week.start)
            .sort((a, b) => b.start - a.start);
        if (!state.weeks.length) throw new Error('No weekly data available');
        const requestedKey = selectedKeyFromHash();
        const requestedIndex = requestedKey ? state.weeks.findIndex((week) => week.key === requestedKey) : -1;
        state.index = requestedIndex >= 0 ? requestedIndex : 0;
        bindInteractions();
        renderSelectedWeek({ updateUrl: Boolean(requestedKey) });
        if (requestedKey) schedulePermalinkAlignment();
        state.loaded = true;
    };

    const render = ({ force = false } = {}) => {
        if (!refs().content) return Promise.resolve();
        if (state.loaded && !force) return Promise.resolve();
        if (state.loading) return state.loading;
        state.loading = loadAndRender()
            .catch((error) => {
                console.error('Weekly Log failed to render:', error);
                showError();
            })
            .finally(() => {
                state.loading = null;
            });
        return state.loading;
    };

    window.AtrakWeeklyLog = { render, goToWeek: (key) => {
        const index = state.weeks.findIndex((week) => week.key === key);
        if (index >= 0) goToIndex(index, index > state.index ? 'older' : 'newer');
    } };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => render(), { once: true });
    } else {
        render();
    }
})();

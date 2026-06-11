// GitHub Projects - Dynamic project loading from GitHub API
// Fetches repositories for the user and displays them in the "More Projects" section
// Can use pre-cached data from GitHub Actions or fetch live from API

const GITHUB_USERNAME = 'charlie2233';
const GITHUB_API_BASE = 'https://api.github.com';
const SITE_BASE_URL = (() => {
    const currentScript = document.currentScript;
    if (currentScript && currentScript.src) {
        try {
            return new URL('.', currentScript.src).toString();
        } catch (_) {
            // fall through
        }
    }

    if (window.location && window.location.origin && window.location.origin !== 'null') {
        return `${window.location.origin}/`;
    }

    return '';
})();

const GITHUB_CACHE_VERSION = '20260610c';
const withCacheVersion = (url) => `${url}${url.includes('?') ? '&' : '?'}v=${GITHUB_CACHE_VERSION}`;
const CACHED_REPOS_BASE_PATH = SITE_BASE_URL ? `${SITE_BASE_URL}data/github-repos.json` : 'data/github-repos.json'; // Updated by GitHub Actions
const CACHED_DATA_PATH = withCacheVersion(CACHED_REPOS_BASE_PATH);
const CACHED_EVENTS_PATH = withCacheVersion(SITE_BASE_URL ? `${SITE_BASE_URL}data/github-events.json` : 'data/github-events.json'); // Updated by GitHub Actions
const CACHED_META_PATH = withCacheVersion(SITE_BASE_URL ? `${SITE_BASE_URL}data/github-meta.json` : 'data/github-meta.json'); // Updated by GitHub Actions
const CACHED_RELEASES_PATH = withCacheVersion(SITE_BASE_URL ? `${SITE_BASE_URL}data/github-releases.json` : 'data/github-releases.json'); // Updated by GitHub Actions
const CACHED_WEEKLY_PATH = withCacheVersion(SITE_BASE_URL ? `${SITE_BASE_URL}data/github-weekly.json` : 'data/github-weekly.json'); // Updated by GitHub Actions
const WEEKLY_LOG_PATH = withCacheVersion(SITE_BASE_URL ? `${SITE_BASE_URL}WeeklyLog.txt` : 'WeeklyLog.txt');
const IS_LOCAL_PREVIEW = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const PROJECTS_PER_SLIDER_PAGE = 6;

// Known featured/pinned projects to exclude from "More Projects" section
const FEATURED_PROJECT_REPOS = [
    'atrak-website',
    'AtrakWebpage',
    'LunarWeb',
    'rork-guide-pup--vision-assistant',
    'Basketball_action_recoginition_sever',
    'AI-predator-simulation',
    'DestinnyBasketball',
    'DestinnyBasketballPage',
    'lifepage',
    'My_portforlio',
    'Easy_Java_Ide-for-competitions',
    'rork-ten-seconds-vip-manager',
    'ai-hoops-board',
    'GBC_HuskiesWeb',
    'lunar',
    'formative-ai-exporter',
    'coursebinder-ai-ready-google-classroom-exporter',
    'SafeTraveling'
];

// Cache for GitHub data
let githubProjectsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let lastGitHubFetchSource = null; // 'cache' | 'api'
let weeklyLogArchiveCache = null;

/**
 * Try to load pre-cached data from GitHub Actions
 */
async function loadCachedData() {
    try {
        const response = await fetch(CACHED_DATA_PATH);
        if (response.ok) {
            const repos = await response.json();
            if (Array.isArray(repos) && repos.length > 0) {
                console.log('Using pre-cached GitHub data');
                return repos;
            }
        }
    } catch (e) {
        // Cached data not available, will fetch from API
    }
    return null;
}

async function loadCachedMeta() {
    try {
        const response = await fetch(CACHED_META_PATH);
        if (!response.ok) return null;
        const meta = await response.json();
        if (!meta || typeof meta !== 'object') return null;
        if (typeof meta.updatedAt !== 'string') return null;
        return meta;
    } catch (e) {
        return null;
    }
}

async function loadCachedReleases() {
    try {
        const response = await fetch(CACHED_RELEASES_PATH);
        if (!response.ok) return null;
        const releases = await response.json();
        if (!Array.isArray(releases)) return null;
        return releases;
    } catch (e) {
        return null;
    }
}

async function loadCachedWeeklyStats() {
    try {
        const response = await fetch(CACHED_WEEKLY_PATH);
        if (!response.ok) return null;
        const stats = await response.json();
        if (!stats || typeof stats !== 'object') return null;
        if (typeof stats.updatedAt !== 'string') return null;
        return stats;
    } catch (e) {
        return null;
    }
}

function setMoreProjectsMeta(message) {
    const metaEl = document.getElementById('more-projects-meta');
    if (metaEl) {
        metaEl.textContent = message || '';
    }
}

function setFooterSyncStatus(message) {
    const footerEl = document.getElementById('footer-sync-status');
    if (footerEl) {
        footerEl.textContent = message || '';
    }
}

function getGitHubCacheSource(meta) {
    if (!meta || typeof meta !== 'object') return 'unknown';
    return String(meta.source || '').trim().toLowerCase();
}

function getGitHubCacheSourceText(meta) {
    const source = getGitHubCacheSource(meta);
    if (source === 'local-git-refresh') return 'Local repo snapshot';
    if (source === 'github-live-cache') return 'GitHub live cache';
    if (source === 'github-actions-cache') return 'GitHub Actions cache';
    return 'GitHub cache';
}

function getWeeklyStatsSource(stats) {
    if (!stats || typeof stats !== 'object') return 'unknown';
    return String(stats.source || '').trim().toLowerCase();
}

function getWeeklyStatsSourceText(stats) {
    const source = getWeeklyStatsSource(stats);
    if (source === 'local-git-refresh') return 'Local checked-out repos';
    if (source === 'github-graphql') return 'GitHub contribution graph';
    if (source === 'github-public-events') return 'Public GitHub fallback';
    if (source === 'github-live-cache') return 'GitHub live cache';
    return 'Weekly cache';
}

function escapeHtml(value) {
    const str = value == null ? '' : String(value);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeExternalUrl(url) {
    const str = (url || '').trim();
    if (!str) return '#';
    if (!/^https?:\/\//i.test(str)) return '#';
    try {
        return new URL(str).toString();
    } catch (_) {
        return '#';
    }
}

function formatShortDate(date) {
    try {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (_) {
        return '';
    }
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function classifyCommitMessage(message) {
    const msg = String(message || '').trim().toLowerCase();
    if (!msg) return 'other';

    if (msg.startsWith('fix') || msg.includes('bug') || msg.includes('hotfix') || msg.includes('patch')) return 'fix';
    if (msg.startsWith('feat') || msg.startsWith('add') || msg.includes('feature') || msg.includes('implement')) return 'feature';
    if (msg.startsWith('doc') || msg.includes('readme') || msg.includes('docs')) return 'docs';
    if (msg.startsWith('refactor') || msg.includes('cleanup') || msg.includes('clean up')) return 'refactor';
    if (msg.startsWith('chore') || msg.includes('deps') || msg.includes('bump ')) return 'chore';

    return 'other';
}

function parseWeeklyLogEntry(sectionText, projectTitle, weekOf) {
    const headlineMatch = sectionText.match(/^###\s+(.+)$/m);
    const headline = headlineMatch ? headlineMatch[1].trim().replace(/^["“]|["”]$/g, '') : '';

    const lines = sectionText.split(/\r?\n/);
    const blocks = {};
    let currentKey = null;
    let current = null;
    const metrics = {};

    const flush = () => {
        if (!currentKey || !current) return;
        if (!blocks[currentKey]) blocks[currentKey] = { bullets: [], paragraphs: [] };
        blocks[currentKey].bullets.push(...current.bullets);
        blocks[currentKey].paragraphs.push(...current.paragraphs);
        currentKey = null;
        current = null;
    };

    for (const lineRaw of lines) {
        const line = lineRaw.trim();
        if (!line) continue;

        const blockHeader = line.match(/^\*\*(.+?)\*\*$/);
        if (blockHeader) {
            flush();
            currentKey = blockHeader[1].trim();
            current = { bullets: [], paragraphs: [] };
            continue;
        }

        if (!currentKey) continue;

        const bullet = line.match(/^[-*]\s+(.+)$/);
        if (bullet) {
            current.bullets.push(bullet[1].trim());
            continue;
        }

        if (/^reply\b/i.test(line)) continue;
        if (/^coverage complete\b/i.test(line)) continue;
        if (/^part\s+\d+/i.test(line)) continue;

        current.paragraphs.push(line);
    }
    flush();

    if (blocks.Metrics) {
        const all = [...blocks.Metrics.bullets, ...blocks.Metrics.paragraphs];
        all.forEach(entry => {
            const mm = String(entry).match(/^([A-Za-z ]+):\s*(.+)$/);
            if (!mm) return;
            metrics[mm[1].trim()] = mm[2].trim();
        });
    }

    return {
        projectTitle: projectTitle || 'Weekly Dev News',
        weekOf: weekOf || '',
        headline,
        blocks,
        metrics,
    };
}

function parseWeeklyLogArchive(text) {
    const content = String(text || '');
    if (!content) return null;

    const titleMatch = content.match(/^#\s+(.+)$/m);
    const rawTitle = titleMatch ? titleMatch[1].trim() : 'Weekly Dev News';
    const projectTitle = rawTitle.replace(/\s+—\s+Weekly Dev News.*$/i, '').trim() || 'Weekly Dev News';

    const markers = [];
    const re = /^##\s+Week of\s+(.+)$/gm;
    let m;
    while ((m = re.exec(content)) !== null) {
        markers.push({ index: m.index, weekOf: (m[1] || '').trim() });
    }

    const entries = [];
    for (let i = 0; i < markers.length; i += 1) {
        const start = markers[i].index;
        const end = (i + 1 < markers.length) ? markers[i + 1].index : content.length;
        const sectionText = content.slice(start, end);
        entries.push(parseWeeklyLogEntry(sectionText, projectTitle, markers[i].weekOf));
    }

    return { projectTitle, entries };
}

async function loadWeeklyLogArchive() {
    if (weeklyLogArchiveCache) return weeklyLogArchiveCache;

    try {
        const response = await fetch(WEEKLY_LOG_PATH);
        if (!response.ok) return null;
        const text = await response.text();
        weeklyLogArchiveCache = parseWeeklyLogArchive(text);
        return weeklyLogArchiveCache;
    } catch (_) {
        return null;
    }
}

const INTERNAL_PROJECT_PAGES = {
    'rork-guide-pup--vision-assistant': 'projects/guidepup.html',
    'Basketball_action_recoginition_sever': 'projects/hoops-clips.html',
    'AI-predator-simulation': 'projects/ai-predator-simulation.html',
    'DestinnyBasketball': 'projects/destiny-basketball.html',
    'DestinnyBasketballPage': 'projects/destiny-basketball.html',
    'rork-ten-seconds-vip-manager': 'projects/ten-seconds-vip-manager.html',
    'Easy_Java_Ide-for-competitions': 'projects/compide.html',
    'atrak-website': 'index.html',
    'AtrakWebpage': 'index.html',
    'LunarWeb': 'index.html',
    'lifepage': 'projects/lifepage.html',
    'My_portforlio': 'projects/lifepage.html',
    'coursebinder-ai-ready-google-classroom-exporter': 'projects/classroom-ai-exporter.html',
    'formative-ai-exporter': 'projects/formative-ai-exporter.html',
};

const REPO_CARD_ENHANCEMENTS = {
    'atrak-website': {
        displayName: 'Atrak Website + Project Hub',
        iconLabel: 'AW',
        iconVariant: 'repo',
        iconSub: 'WEB',
        description: 'The public Atrak hub powering projects, weekly news, releases, blog posts, downloads, team pages, and GitHub-backed activity snapshots.'
    },
    'AtrakWebpage': {
        displayName: 'Atrak Website + Project Hub',
        iconLabel: 'AW',
        iconVariant: 'repo',
        iconSub: 'WEB',
        description: 'The public Atrak hub powering projects, weekly news, releases, blog posts, downloads, team pages, and GitHub-backed activity snapshots.'
    },
    'lifepage': {
        displayName: 'LifePage',
        iconLabel: 'LP',
        iconVariant: 'repo',
        iconSub: 'AI',
        description: 'AI personal-brand builder using GitHub proof, crawled evidence, screenshots, portfolio generation, resume exports, and custom-domain publishing.'
    },
    'coursebinder-ai-ready-google-classroom-exporter': {
        displayName: 'CourseBinder Classroom AI Exporter',
        iconLabel: 'CB',
        iconVariant: 'analytics',
        iconSub: 'EDU',
        description: 'MIT-licensed Classroom visible-content exporter that turns coursework, links, and attachment metadata into local AI-readable archives.'
    },
    'formative-ai-exporter': {
        displayName: 'Practice Snapshot for Formative',
        iconLabel: 'FS',
        iconVariant: 'analytics',
        iconSub: 'ZIP',
        description: 'Chrome extension-only exporter that captures visible Formative practices into local ZIPs with text, answers, media, screenshots, and AI indexes.'
    },
    'GBC_HuskiesWeb': {
        displayName: 'GBC Huskies Basketball Website',
        iconLabel: 'GBC',
        iconVariant: 'hoops',
        iconSub: 'WEB',
        description: 'Official GBC Huskies Basketball site with fundraiser paths, parent-facing navigation, sponsor CTAs, and coach content shaped for a live community launch.'
    },
    'SafeTraveling': {
        displayName: 'SafeTraveling Risk Map',
        iconLabel: 'ST',
        iconVariant: 'travel',
        iconSub: 'MAP',
        description: 'Global safety-map product for helping travelers and locals understand regional risk, backend launch planning, and admin review workflows.'
    },
    'HoopsClips_MacOS': {
        displayName: 'Hoops Clips macOS App',
        iconLabel: 'HC',
        iconVariant: 'swift',
        iconSub: 'MAC',
        description: 'macOS control surface for Hoops Clips that syncs backend analysis, launch-gate review flows, exports, and installer-ready desktop delivery.'
    },
    'hoopclips-website': {
        displayName: 'HoopClips Official Website',
        iconLabel: 'HC',
        iconVariant: 'hoops',
        iconSub: 'SITE',
        description: 'Official product website for Hoops Clips with launch copy, coach/player positioning, and handoff into the active highlight workflow.'
    },
    'rork-hoopshighlights-ai_Final': {
        displayName: 'Hoops Highlights AI Final',
        iconLabel: 'HC',
        iconVariant: 'hoops',
        iconSub: 'AI',
        description: 'Active Hoops Clips launch repo for upload, cloud analysis, human review gates, TestFlight proof, and production-ready highlight workflows.'
    },
    'RestaurantCommentValidation_Analysis': {
        displayName: 'Restaurant Comment Validation Analysis',
        iconLabel: 'RV',
        iconVariant: 'analytics',
        iconSub: 'DATA',
        description: 'Restaurant review analysis toolkit for comment quality checks, validation signals, sentiment review, and reporting workflows.'
    },
    'AP-CSA-Consumer-Review-Lab-Final-Open-Ended-Activity-Presentation': {
        displayName: 'AP CSA Consumer Review Lab',
        iconLabel: 'JV',
        iconVariant: 'java',
        iconSub: 'AP',
        description: 'Java/AP CSA text-analysis project that explores consumer-review scoring, class design, data cleanup, and presentation-ready findings.'
    },
    'newproyecto': {
        displayName: 'New Proyecto',
        iconLabel: 'PY',
        iconVariant: 'python',
        iconSub: 'LAB',
        description: 'Python prototype workspace for testing automation ideas, backend utility patterns, and small experiments before they become larger tools.'
    },
    'Easy_command_prompt': {
        displayName: 'Easy Command Prompt',
        iconLabel: '>$',
        iconVariant: 'terminal',
        iconSub: 'C++',
        description: 'C++ terminal workflow experiment focused on faster local commands, command-line practice, and lightweight systems tooling.'
    },
    'rork-hoops-clips-cloud-clone-clone-clone-132': {
        displayName: 'Hoops Clips Cloud Prototype',
        iconLabel: 'HC',
        iconVariant: 'cloud',
        iconSub: 'WEB',
        description: 'Cloud prototype for Hoops Clips that tests upload/review UX and remote processing flows for basketball highlight generation.'
    },
    'MazeRunner67ers_APCSA_Java': {
        displayName: 'AP CSA Maze Runner',
        iconLabel: 'MR',
        iconVariant: 'java',
        iconSub: 'MAZE',
        description: 'Java maze-runner project focused on grid logic, path decisions, object-oriented design, and AP CSA-style problem solving.'
    },
    'CredibleSource_Investigator': {
        displayName: 'Credible Source Investigator',
        iconLabel: 'CS',
        iconVariant: 'analytics',
        iconSub: 'CHECK',
        description: 'Research helper that evaluates source credibility signals and turns classroom-style evidence checks into a repeatable workflow.'
    },
    'screenLocks_detectsFaceGuard': {
        displayName: 'FaceGuard Screen Lock',
        iconLabel: 'FG',
        iconVariant: 'vision',
        iconSub: 'CV',
        description: 'Face-detection security experiment that explores screen-lock behavior, presence detection, and privacy-minded local automation.'
    },
    'hoops-clips_2_with-Rorks': {
        displayName: 'Hoops Clips Rork Prototype',
        iconLabel: 'HC',
        iconVariant: 'hoops',
        iconSub: 'R2',
        description: 'Second Hoops Clips prototype exploring basketball clip UX, generated flows, and the path toward a cleaner production highlight tool.'
    },
    'Ai-Hoops-Clip': {
        displayName: 'AI Hoops Clip',
        iconLabel: 'AI',
        iconVariant: 'hoops',
        iconSub: 'CLIP',
        description: 'Early AI basketball clipping experiment for finding useful moments in game footage and shaping the highlights pipeline.'
    }
};

function createGeneratedProjectIcon(label, variant = 'repo', subLabel = 'DEV') {
    const cleanLabel = String(label || 'PR')
        .replace(/[^A-Za-z0-9>$]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'PR';
    const cleanVariant = slugify(variant || 'repo') || 'repo';
    const cleanSubLabel = String(subLabel || 'DEV')
        .replace(/[^A-Za-z0-9+.#-]/g, '')
        .slice(0, 5)
        .toUpperCase() || 'DEV';

    return `
        <span class="project-icon-generated project-icon-${escapeHtml(cleanVariant)}" aria-hidden="true">
            <span class="project-icon-orbit"></span>
            <span class="project-icon-main">${escapeHtml(cleanLabel)}</span>
            <span class="project-icon-sub">${escapeHtml(cleanSubLabel)}</span>
        </span>
    `;
}

function getFallbackRepoDescription(repo) {
    const language = String(repo.language || '').toLowerCase();
    if (language.includes('java')) {
        return 'Java project card from the Atrak build archive, focused on class design, algorithms, and classroom-to-product practice.';
    }
    if (language.includes('python')) {
        return 'Python project card from the Atrak build archive, used for automation experiments, data workflows, and backend prototyping.';
    }
    if (language.includes('c++') || language.includes('cpp')) {
        return 'Systems-oriented project card from the Atrak build archive, focused on command-line tools and lower-level programming practice.';
    }
    if (language.includes('typescript') || language.includes('javascript')) {
        return 'Web/app prototype from the Atrak build archive, exploring product flows, UI experiments, and deployable software patterns.';
    }
    if (language.includes('css') || language.includes('html')) {
        return 'Front-end project from the Atrak build archive, focused on visual polish, content structure, and fast static delivery.';
    }
    return 'Atrak build-archive project with repo, docs, release links, and a dedicated details page for deeper technical context.';
}

function formatUTCDateTime(isoString) {
    try {
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return isoString;
        return date.toUTCString().replace('GMT', 'UTC');
    } catch (_) {
        return isoString;
    }
}

function toValidDate(value) {
    if (!value) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getFreshnessStateMeta(dateValue, thresholds = {}) {
    const date = toValidDate(dateValue);
    if (!date) {
        return { state: 'unknown', label: 'Unknown', ageDays: null };
    }

    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const ageDays = diffMs / (1000 * 60 * 60 * 24);
    const freshDays = Number.isFinite(thresholds.freshDays) ? thresholds.freshDays : 2;
    const agingDays = Number.isFinite(thresholds.agingDays) ? thresholds.agingDays : 7;

    if (ageDays <= freshDays) return { state: 'fresh', label: 'Fresh', ageDays };
    if (ageDays <= agingDays) return { state: 'aging', label: 'Aging', ageDays };
    return { state: 'stale', label: 'Stale', ageDays };
}

function renderContentFreshnessStrip(targetId, options = {}) {
    const el = document.getElementById(targetId);
    if (!el) return;

    const updatedAt = toValidDate(options.updatedAt);
    const latestAt = toValidDate(options.latestActivityAt || options.latestPublishedAt);
    const freshness = getFreshnessStateMeta(updatedAt || latestAt, options.thresholds || {});
    const badgeLabel = options.badgeLabel ? String(options.badgeLabel) : freshness.label;
    const lastUpdatedLabel = updatedAt
        ? `Last updated ${formatUTCDateTime(updatedAt.toISOString())} (${getTimeAgo(updatedAt)})`
        : (latestAt ? `Last activity ${formatUTCDateTime(latestAt.toISOString())}` : 'Freshness timestamp unavailable');

    const metaParts = [];
    if (options.kind) metaParts.push(String(options.kind));
    if (typeof options.totalCount === 'number' && Number.isFinite(options.totalCount)) {
        const label = options.countLabel || 'items';
        metaParts.push(`${Math.max(0, Math.round(options.totalCount))} ${label}`);
    }
    if (latestAt && options.latestLabel) {
        const latestLabel = String(options.latestLabel);
        metaParts.push(`${latestLabel} ${formatLongDate(latestAt.toISOString())}`);
    }
    if (options.note) metaParts.push(String(options.note));

    el.innerHTML = `
        <span class="content-freshness-badge" data-state="${escapeHtml(freshness.state)}">${escapeHtml(badgeLabel)}</span>
        <span class="content-freshness-text">${escapeHtml(lastUpdatedLabel)}</span>
        ${metaParts.length ? `<span class="content-freshness-meta">• ${escapeHtml(metaParts.join(' • '))}</span>` : ''}
    `;
}

/**
 * Fetch repositories from GitHub API
 */
async function fetchGitHubRepositories() {
    // Check memory cache first
    if (githubProjectsCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        return githubProjectsCache;
    }

    // Try pre-cached data from GitHub Actions first
    let repos = await loadCachedData();
    lastGitHubFetchSource = repos ? 'cache' : null;
    
    // Only fall back to the live API for local preview. Public pages should use
    // the checked-in snapshot so renamed/private repos do not leak through.
    if (!repos) {
        if (!IS_LOCAL_PREVIEW) {
            lastGitHubFetchSource = 'unavailable';
            return [];
        }
        try {
            const response = await fetch(`${GITHUB_API_BASE}/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100`);
            
            if (!response.ok) {
                throw new Error(`GitHub API returned ${response.status}`);
            }
            
            repos = await response.json();
            lastGitHubFetchSource = 'api';
        } catch (error) {
            console.error('Failed to fetch GitHub repositories:', error);
            lastGitHubFetchSource = null;
            return [];
        }
    }
    
    // Filter and sort repositories
    const projects = repos
        .filter(repo => {
            // Exclude featured projects and forks
            return !repo.fork && !repo.private && !FEATURED_PROJECT_REPOS.includes(repo.name);
        })
        .map(repo => {
            const enhancement = REPO_CARD_ENHANCEMENTS[repo.name] || {};
            return {
                name: repo.name,
                fullName: repo.full_name,
                description: enhancement.description || repo.description || getFallbackRepoDescription(repo),
                displayName: enhancement.displayName,
                icon: createGeneratedProjectIcon(
                    enhancement.iconLabel || repo.language || repo.name,
                    enhancement.iconVariant || repo.language || 'repo',
                    enhancement.iconSub || repo.language || 'DEV'
                ),
                url: repo.html_url,
                homepage: repo.homepage,
                language: repo.language,
                topics: repo.topics || [],
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                createdAt: new Date(repo.created_at),
                updatedAt: new Date(repo.updated_at),
                pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null
            };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt); // Sort by most recently updated

    githubProjectsCache = projects;
    cacheTimestamp = Date.now();
    
    return projects;
}

/**
 * Get tech stack display from language and topics
 */
function getTechStack(project) {
    const stack = [];
    
    // Add primary language
    if (project.language) {
        stack.push(project.language);
    }
    
    // Add topics (limit to 3 total including language)
    const remainingSlots = 3 - stack.length;
    if (project.topics.length > 0 && remainingSlots > 0) {
        stack.push(...project.topics.slice(0, remainingSlots));
    }
    
    return stack;
}

/**
 * Format date for display
 */
function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short'
    });
}

/**
 * Format repository name for display
 */
function formatDisplayName(name) {
    return name
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Create HTML for a project card
 */
function createProjectCard(project) {
    const techStack = getTechStack(project);
    const displayName = escapeHtml(project.displayName || formatDisplayName(project.name));
    const icon = project.icon || '📦';
    const repoAttr = project.fullName ? ` data-repo="${escapeHtml(project.fullName)}"` : '';
    const internalPage = INTERNAL_PROJECT_PAGES[project.name] || '';
    const description = escapeHtml(project.description);
    const repoUrl = safeExternalUrl(project.url);
    const homepageUrl = safeExternalUrl(project.homepage);
    
    const tagsHTML = techStack.length > 0
        ? techStack.map(tech => `<span class="tag">${escapeHtml(tech)}</span>`).join('')
        : '<span class="tag">General</span>';
    
    return `
        <div class="project-card reveal glass-card" data-github-project="true"${repoAttr}>
            <div class="project-image project-image-iconic project-image-dynamic">
                <div class="project-icon">${icon}</div>
            </div>
	            <div class="project-content">
	                <h3 class="project-title">${displayName}</h3>
	                <p class="project-description">
	                    ${description}
	                </p>
	                <div class="project-meta">
	                    <span class="project-date">Updated: ${formatDate(project.updatedAt)}</span>
	                </div>
	                <div class="project-tags">
	                    ${tagsHTML}
	                </div>
	                <div class="project-actions">
                            <a href="${internalPage || `projects/github-project.html?repo=${encodeURIComponent(project.fullName)}`}" class="btn btn-secondary btn-sm">Details</a>
	                    <a href="${repoUrl}" class="btn btn-secondary btn-sm" target="_blank" rel="noopener noreferrer">Repo</a>
	                    <a href="${repoUrl}#readme" class="btn btn-secondary btn-sm" target="_blank" rel="noopener noreferrer">Docs</a>
	                    <a href="${repoUrl}/releases" class="btn btn-secondary btn-sm" target="_blank" rel="noopener noreferrer">Releases</a>
	                    ${homepageUrl !== '#'
	                        ? `<a href="${homepageUrl}" class="btn btn-secondary btn-sm" target="_blank" rel="noopener noreferrer">Demo</a>`
	                        : `<button class="btn btn-secondary btn-sm" type="button" disabled aria-disabled="true">Demo</button>`
	                    }
	                </div>
	            </div>
        </div>
    `;
}

/**
 * Create skeleton loader for project card
 */
function createProjectSkeleton() {
    return `
        <div class="project-card glass-card skeleton-card">
            <div class="skeleton-image skeleton"></div>
            <div class="project-content">
                <div class="skeleton-title skeleton"></div>
                <div class="skeleton-description skeleton"></div>
                <div class="skeleton-description skeleton short"></div>
                <div class="skeleton-text skeleton" style="width: 40%; margin-top: 16px;"></div>
                <div style="display: flex; gap: 8px; margin-top: 16px;">
                    <div class="skeleton-tag skeleton"></div>
                    <div class="skeleton-tag skeleton"></div>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 16px;">
                    <div class="skeleton-button skeleton"></div>
                    <div class="skeleton-button skeleton"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Create skeleton loader for weekly highlights
 */
function createWeeklyHighlightsSkeleton() {
    return `
        <div class="weekly-stats-row">
            <div class="fun-stat skeleton" style="width: 120px; height: 40px; border-radius: 8px;"></div>
            <div class="fun-stat skeleton" style="width: 120px; height: 40px; border-radius: 8px;"></div>
            <div class="fun-stat skeleton" style="width: 120px; height: 40px; border-radius: 8px;"></div>
        </div>
        <div class="weekly-sections-grid">
            <div class="weekly-section">
                <div class="skeleton-text skeleton" style="width: 100px; height: 14px; margin-bottom: 12px;"></div>
                <ul class="highlight-list">
                    <li class="highlight-item">
                        <span class="skeleton-text skeleton" style="width: 80%; height: 14px;"></span>
                    </li>
                    <li class="highlight-item">
                        <span class="skeleton-text skeleton" style="width: 70%; height: 14px;"></span>
                    </li>
                    <li class="highlight-item">
                        <span class="skeleton-text skeleton" style="width: 85%; height: 14px;"></span>
                    </li>
                </ul>
            </div>
            <div class="weekly-section">
                <div class="skeleton-text skeleton" style="width: 100px; height: 14px; margin-bottom: 12px;"></div>
                <ul class="highlight-list">
                    <li class="highlight-item">
                        <span class="skeleton-text skeleton" style="width: 75%; height: 14px;"></span>
                    </li>
                    <li class="highlight-item">
                        <span class="skeleton-text skeleton" style="width: 90%; height: 14px;"></span>
                    </li>
                </ul>
            </div>
        </div>
    `;
}

function notifyProjectSliderUpdated() {
    document.dispatchEvent(new CustomEvent('atrak:projects-updated'));
}

function getProjectSliderTrack() {
    return document.getElementById('project-slider-track');
}

function createProjectSlidePage(label, isDynamic = true) {
    const page = document.createElement('div');
    page.className = 'project-slide-page';
    page.setAttribute('data-project-slide-page', '');
    if (isDynamic) {
        page.setAttribute('data-dynamic-project-page', 'true');
    }
    if (label) {
        page.setAttribute('aria-label', label);
    }
    return page;
}

function clearDynamicProjectPages(track) {
    track.querySelectorAll('[data-dynamic-project-page="true"]').forEach(page => page.remove());
}

function appendProjectCardsToSlider(track, cardHtmlItems, labelPrefix = 'GitHub projects') {
    cardHtmlItems.forEach((cardHtml, index) => {
        const pageNumber = Math.floor(index / PROJECTS_PER_SLIDER_PAGE) + 1;
        let page = track.querySelector(`[data-dynamic-project-page="true"][data-dynamic-page-index="${pageNumber}"]`);

        if (!page) {
            page = createProjectSlidePage(`${labelPrefix} page ${pageNumber}`);
            page.dataset.dynamicPageIndex = String(pageNumber);
            track.appendChild(page);
        }

        page.insertAdjacentHTML('beforeend', cardHtml);
    });

    notifyProjectSliderUpdated();
}

function appendProjectSliderMessage(track, messageHtml, label) {
    clearDynamicProjectPages(track);
    const page = createProjectSlidePage(label);
    page.classList.add('project-slide-page-message');
    page.innerHTML = messageHtml;
    track.appendChild(page);
    notifyProjectSliderUpdated();
}

/**
 * Render the More Projects section inside the unified project slider
 */
async function renderMoreProjects() {
    const track = getProjectSliderTrack();
    if (!track) {
        console.warn('Project slider track not found');
        return;
    }

    if (
        track.querySelector('.project-card[data-github-project="true"]') ||
        track.querySelector('[data-dynamic-project-page="true"] .skeleton-card')
    ) {
        return;
    }

    const skeletons = Array(PROJECTS_PER_SLIDER_PAGE).fill(0).map(() => createProjectSkeleton());
    clearDynamicProjectPages(track);
    appendProjectCardsToSlider(track, skeletons, 'Loading GitHub projects');
    setMoreProjectsMeta('Loading GitHub data…');

    try {
        const projects = await fetchGitHubRepositories();
        const displayProjects = projects;
        const projectCards = displayProjects.map(project => createProjectCard(project));

        clearDynamicProjectPages(track);

        if (!projectCards.length) {
            setMoreProjectsMeta('No additional GitHub projects found.');
            notifyProjectSliderUpdated();
            return;
        }

        appendProjectCardsToSlider(track, projectCards, 'GitHub projects');

        const newElements = track.querySelectorAll('[data-dynamic-project-page="true"] .reveal:not(.active)');
        if (window.revealObserver) {
            newElements.forEach(el => window.revealObserver.observe(el));
        } else {
            newElements.forEach(el => el.classList.add('active'));
        }
        
        if (lastGitHubFetchSource === 'cache') {
            const meta = await loadCachedMeta();
            if (meta && meta.updatedAt) {
                const sourceText = getGitHubCacheSourceText(meta);
                const updateMsg = `${sourceText} • ${formatUTCDateTime(meta.updatedAt)}`;
                const cacheSource = getGitHubCacheSource(meta);
                const cadenceText = cacheSource === 'github-actions-cache'
                    ? 'Cached daily'
                    : (cacheSource === 'github-live-cache' ? 'Live cache' : 'Local snapshot');
                setMoreProjectsMeta(`${cadenceText} • Last updated ${formatUTCDateTime(meta.updatedAt)}`);
                setFooterSyncStatus(updateMsg);
            } else {
                setMoreProjectsMeta('Cached data loaded.');
                setFooterSyncStatus('GitHub data synced daily');
            }
        } else if (lastGitHubFetchSource === 'api') {
            setMoreProjectsMeta('Live from GitHub API');
            setFooterSyncStatus('Live GitHub data');
        } else if (lastGitHubFetchSource === 'unavailable') {
            setMoreProjectsMeta('GitHub snapshot unavailable.');
            setFooterSyncStatus('GitHub snapshot unavailable');
        } else {
            setMoreProjectsMeta('');
        }
        
    } catch (error) {
        console.error('Failed to render projects:', error);
        appendProjectSliderMessage(
            track,
            '<p class="error-message project-slider-message">Failed to load GitHub projects. Please try again later.</p>',
            'GitHub projects unavailable'
        );
        setMoreProjectsMeta('');
    }
}

/**
 * Get project details for the detail page
 */
async function getProjectDetails(fullRepoName) {
    const normalizedFullName = (fullRepoName || '').trim().toLowerCase();

    // Prefer cached data (avoids GitHub API rate limits on the client).
    const cachedRepos = await loadCachedData();
    if (cachedRepos && normalizedFullName) {
        const cachedRepo = cachedRepos.find(repo => {
            const candidate = typeof repo.full_name === 'string' ? repo.full_name.trim().toLowerCase() : '';
            return candidate === normalizedFullName;
        });

        if (cachedRepo) {
            return {
                name: cachedRepo.name,
                fullName: cachedRepo.full_name,
                description: cachedRepo.description || 'No description available.',
                url: cachedRepo.html_url,
                homepage: cachedRepo.homepage,
                language: cachedRepo.language,
                topics: cachedRepo.topics || [],
                stars: cachedRepo.stargazers_count,
                forks: cachedRepo.forks_count,
                watchers: cachedRepo.watchers_count,
                createdAt: new Date(cachedRepo.created_at),
                updatedAt: new Date(cachedRepo.updated_at),
                pushedAt: cachedRepo.pushed_at ? new Date(cachedRepo.pushed_at) : null,
                license: cachedRepo.license ? cachedRepo.license.name : null,
                defaultBranch: cachedRepo.default_branch || 'main'
            };
        }
    }

    if (!IS_LOCAL_PREVIEW) {
        throw new Error('Project details are unavailable because the cached GitHub snapshot is missing this repository.');
    }

    try {
        const response = await fetch(`${GITHUB_API_BASE}/repos/${fullRepoName}`);
        
        if (!response.ok) {
            throw new Error(`GitHub API returned ${response.status}`);
        }
        
        const repo = await response.json();
        
        return {
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description || 'No description available.',
            url: repo.html_url,
            homepage: repo.homepage,
            language: repo.language,
            topics: repo.topics || [],
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            watchers: repo.watchers_count,
            createdAt: new Date(repo.created_at),
            updatedAt: new Date(repo.updated_at),
            pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
            license: repo.license ? repo.license.name : null,
            defaultBranch: repo.default_branch || 'main'
        };
    } catch (error) {
        console.error('Failed to fetch project details:', error);
        throw error;
    }
}

// ============================================
// WEEKLY HIGHLIGHTS
// ============================================

/**
 * Render Weekly Highlights from GitHub Events
 */
async function renderWeeklyHighlights() {
    const container = document.getElementById('weekly-content');
    const dateRangeEl = document.getElementById('weekly-date-range');
    const titleEl = document.getElementById('weekly-title');
    const iconEl = document.getElementById('weekly-icon');
    const syncPillEl = document.getElementById('weekly-sync-pill');
    const sourceNoteEl = document.getElementById('weekly-source-note');
    
    if (!container) return;
    
    // Show skeleton loader while fetching
    if (container.innerHTML.includes('weekly-loading') || container.innerHTML.trim() === '') {
        container.innerHTML = createWeeklyHighlightsSkeleton();
    }
    
    try {
        let events = [];
        try {
            const response = await fetch(CACHED_EVENTS_PATH);
            if (response.ok) {
                const rawEvents = await response.json();
                events = Array.isArray(rawEvents) ? rawEvents : [];
            } else {
                console.warn('GitHub events cache missing:', response.status);
            }
        } catch (error) {
            console.warn('Failed to load GitHub events cache:', error);
        }
        
        // Filter last 7 days (weekly digest)
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        if (titleEl) titleEl.textContent = 'This Week at Atrak';
        if (iconEl) iconEl.textContent = '📰';
        if (dateRangeEl) dateRangeEl.textContent = `${formatShortDate(weekAgo)} – ${formatShortDate(now)}`;
        if (syncPillEl) {
            syncPillEl.textContent = 'Syncing';
            syncPillEl.dataset.state = 'loading';
            syncPillEl.removeAttribute('title');
        }
        if (sourceNoteEl) {
            sourceNoteEl.textContent = 'Live GitHub activity + weekly archive';
        }

        const weeklyEvents = events
            .filter(e => e && typeof e === 'object' && typeof e.created_at === 'string')
            .filter(e => {
                const created = new Date(e.created_at);
                return !Number.isNaN(created.getTime()) && created >= weekAgo && created <= now;
            });
        
        const repoActivity = new Map();
        const activeRepos = new Set();
        const createdRepos = [];
        const releases = [];
        const commitStream = [];
        const categorizedCommits = {
            feature: [],
            fix: [],
            docs: [],
            refactor: [],
            chore: [],
            other: []
        };
        let totalCommits = 0;
        let totalPushes = 0;
        let starsGained = 0;
        let mostRecentEventAt = null;

        for (const e of weeklyEvents) {
            const createdAt = e && typeof e.created_at === 'string' ? new Date(e.created_at) : null;
            if (createdAt && !Number.isNaN(createdAt.getTime())) {
                if (!mostRecentEventAt || createdAt > mostRecentEventAt) mostRecentEventAt = createdAt;
            }

            const type = e.type;
            const repoFull = e.repo && typeof e.repo.name === 'string' ? e.repo.name : '';
            const repoKey = repoFull ? repoFull.split('/')[1] || repoFull : '';

            if (repoKey) activeRepos.add(repoKey);

            if (type === 'PushEvent') {
                totalPushes += 1;
                const distinct = Number(e.payload && e.payload.distinct_size) || 0;
                totalCommits += distinct;

                if (repoKey) {
                    if (!repoActivity.has(repoKey)) {
                        repoActivity.set(repoKey, {
                            key: repoKey,
                            full: repoFull,
                            name: formatDisplayName(repoKey),
                            url: safeExternalUrl(`https://github.com/${repoFull}`),
                            commits: 0,
                            pushes: 0
                        });
                    }
                    const info = repoActivity.get(repoKey);
                    info.commits += distinct;
                    info.pushes += 1;
                }

                const commits = e.payload && Array.isArray(e.payload.commits) ? e.payload.commits : [];
                commits.forEach(c => {
                    const raw = c && typeof c.message === 'string' ? c.message : '';
                    const firstLine = raw.split('\n')[0].trim();
                    if (!firstLine) return;
                    if (/^merge\b/i.test(firstLine)) return;
                    const repoLabel = repoKey || repoFull || 'repo';
                    commitStream.push({ repo: repoLabel, message: firstLine });
                    const bucket = classifyCommitMessage(firstLine);
                    categorizedCommits[bucket].push({ repo: repoLabel, message: firstLine });
                });
            } else if (type === 'CreateEvent') {
                const refType = e.payload && e.payload.ref_type;
                if (refType === 'repository' && repoFull) {
                    createdRepos.push({
                        name: formatDisplayName(repoKey || repoFull),
                        url: safeExternalUrl(`https://github.com/${repoFull}`)
                    });
                }
            } else if (type === 'WatchEvent') {
                starsGained += 1;
            } else if (type === 'ReleaseEvent') {
                const tag = e.payload && e.payload.release && e.payload.release.tag_name ? e.payload.release.tag_name : 'new release';
                const releaseUrl = e.payload && e.payload.release && e.payload.release.html_url ? e.payload.release.html_url : `https://github.com/${repoFull}/releases`;
                releases.push({
                    repo: formatDisplayName(repoKey || repoFull || 'repo'),
                    tag,
                    url: safeExternalUrl(releaseUrl)
                });
            }
        }

        const uniqueCommitTexts = new Set();
        const notableCommits = [];
        for (const c of commitStream) {
            const msg = c.message.replace(/\s+/g, ' ').trim();
            if (!msg) continue;
            const combined = `${c.repo}: ${msg}`;
            if (uniqueCommitTexts.has(combined)) continue;
            uniqueCommitTexts.add(combined);
            notableCommits.push(combined.length > 96 ? `${combined.slice(0, 96)}…` : combined);
            if (notableCommits.length >= 6) break;
        }

        const topRepos = Array.from(repoActivity.values())
            .sort((a, b) => (b.commits - a.commits) || (b.pushes - a.pushes) || a.name.localeCompare(b.name))
            .slice(0, 5);

        const introPhrases = [
            'Welcome back. Grab a snack — this is the weekly drop.',
            'Another week, another pile of commits. Here’s the digest.',
            'Ship fast, break less. Here’s what the team has been up to.',
            'Weekly briefing time. Let’s get you caught up.'
        ];
        const intro = introPhrases[(totalCommits + totalPushes) % introPhrases.length];
        let kickoff = '';

        const kpi = (value, label) => `
            <div class="weekly-kpi">
                <div class="weekly-kpi-value">${escapeHtml(value)}</div>
                <div class="weekly-kpi-label">${escapeHtml(label)}</div>
            </div>
        `;

        const li = (textHtml) => `
            <li class="weekly-list-item">
                <span class="weekly-bullet"></span>
                <span>${textHtml}</span>
            </li>
        `;

        const startOfUtcWeek = (date) => {
            const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const day = d.getDay(); // Sunday = 0 (local time)
            d.setDate(d.getDate() - day);
            return d;
        };
        const formatWeekKey = (date) => {
            const p2 = (n) => String(n).padStart(2, '0');
            return `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`;
        };
        const summarizeGitHubWeek = (weekEvents, weekStart) => {
            const weekEnd = new Date(weekStart.getTime() + (6 * 24 * 60 * 60 * 1000));
            const repoActivityMap = new Map();
            const activeRepoKeys = new Set();
            const notableMsgs = [];
            const uniqueMsgs = new Set();
            let commits = 0;
            let pushes = 0;
            let releasesCount = 0;
            let stars = 0;
            let lastEventAt = null;

            for (const event of weekEvents) {
                if (!event || typeof event !== 'object') continue;
                const type = event.type;
                const repoFull = event.repo && typeof event.repo.name === 'string' ? event.repo.name : '';
                const repoKey = repoFull ? (repoFull.split('/')[1] || repoFull) : '';
                if (repoKey) activeRepoKeys.add(repoKey);

                const createdAt = typeof event.created_at === 'string' ? new Date(event.created_at) : null;
                if (createdAt && !Number.isNaN(createdAt.getTime())) {
                    if (!lastEventAt || createdAt > lastEventAt) lastEventAt = createdAt;
                }

                if (type === 'PushEvent') {
                    pushes += 1;
                    const distinct = Math.max(0, Number(event.payload && event.payload.distinct_size) || 0);
                    commits += distinct;

                    if (repoKey) {
                        if (!repoActivityMap.has(repoKey)) {
                            repoActivityMap.set(repoKey, {
                                name: formatDisplayName(repoKey),
                                key: repoKey,
                                url: safeExternalUrl(`https://github.com/${repoFull}`),
                                commits: 0,
                                pushes: 0
                            });
                        }
                        const info = repoActivityMap.get(repoKey);
                        info.commits += distinct;
                        info.pushes += 1;
                    }

                    const commitsList = event.payload && Array.isArray(event.payload.commits) ? event.payload.commits : [];
                    commitsList.forEach(c => {
                        const raw = c && typeof c.message === 'string' ? c.message : '';
                        const firstLine = raw.split('\n')[0].trim();
                        if (!firstLine || /^merge\b/i.test(firstLine)) return;
                        const combined = `${repoKey || 'repo'}: ${firstLine}`;
                        if (uniqueMsgs.has(combined)) return;
                        uniqueMsgs.add(combined);
                        notableMsgs.push(combined.length > 96 ? `${combined.slice(0, 96)}…` : combined);
                    });
                } else if (type === 'ReleaseEvent') {
                    releasesCount += 1;
                } else if (type === 'WatchEvent') {
                    stars += 1;
                }
            }

            const topRepos = Array.from(repoActivityMap.values())
                .sort((a, b) => (b.commits - a.commits) || (b.pushes - a.pushes) || a.name.localeCompare(b.name))
                .slice(0, 3);

            return {
                weekKey: formatWeekKey(weekStart),
                weekStart,
                weekEnd,
                label: `${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`,
                commits,
                pushes,
                releases: releasesCount,
                stars,
                activeRepos: activeRepoKeys.size,
                topRepos,
                notableMsgs: notableMsgs.slice(0, 4),
                lastEventAt
            };
        };

        const githubWeekSummaries = (() => {
            const buckets = new Map();
            for (const event of events) {
                if (!event || typeof event !== 'object' || typeof event.created_at !== 'string') continue;
                const createdAt = new Date(event.created_at);
                if (Number.isNaN(createdAt.getTime())) continue;
                const weekStart = startOfUtcWeek(createdAt);
                const key = formatWeekKey(weekStart);
                if (!buckets.has(key)) buckets.set(key, { weekStart, events: [] });
                buckets.get(key).events.push(event);
            }

            return Array.from(buckets.entries())
                .map(([key, bucket]) => ({ key, ...summarizeGitHubWeek(bucket.events, bucket.weekStart) }))
                .sort((a, b) => b.weekStart - a.weekStart)
                .slice(0, 10);
        })();

        const highlights = [];
        highlights.push(`${escapeHtml(totalCommits)} commits across ${escapeHtml(activeRepos.size)} repos`);
        if (topRepos[0]) {
            highlights.push(`Most active: <a class="weekly-inline-link" href="${topRepos[0].url}" target="_blank" rel="noopener">${escapeHtml(topRepos[0].name)}</a> (${escapeHtml(topRepos[0].commits)} commits)`);
        }
        if (createdRepos.length) {
            const names = createdRepos
                .slice(0, 3)
                .map(r => `<a class="weekly-inline-link" href="${r.url}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a>`)
                .join(', ');
            highlights.push(`New repos: ${names}${createdRepos.length > 3 ? '…' : ''}`);
        } else {
            highlights.push('New repos: none this week');
        }
        if (starsGained) {
            highlights.push(`Stars: +${escapeHtml(starsGained)}`);
        }

        const releasesList = releases.length
            ? releases.slice(0, 5).map(r => li(`<a class="weekly-inline-link" href="${r.url}" target="_blank" rel="noopener">${escapeHtml(r.repo)}</a> — ${escapeHtml(r.tag)}`)).join('')
            : li(`No GitHub releases this week. Check <a class="weekly-inline-link" href="releases.html">Release Notes</a>.`);

        const buildList = topRepos.length
            ? topRepos.map(r => {
                const meta = [];
                if (r.commits) meta.push(`${r.commits} commit${r.commits === 1 ? '' : 's'}`);
                if (r.pushes) meta.push(`${r.pushes} push${r.pushes === 1 ? '' : 'es'}`);
                return li(`<a class="weekly-inline-link" href="${r.url}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a> — ${escapeHtml(meta.join(' • ') || 'active')}`);
            }).join('')
            : li('No repo updates found.');

        const notableList = notableCommits.length
            ? notableCommits.map(text => li(escapeHtml(text))).join('')
            : li('No notable commit messages (or all were merges).');

        const take = (arr, n) => (Array.isArray(arr) ? arr.slice(0, n) : []);
        const formatCommit = (c) => `${escapeHtml(c.repo)}: ${escapeHtml(c.message)}`;
        const featureList = take(categorizedCommits.feature, 6).length
            ? take(categorizedCommits.feature, 6).map(c => li(formatCommit(c))).join('')
            : li('No obvious “feature” commits this week. (Commit messages were shy.)');
        const fixList = take(categorizedCommits.fix, 6).length
            ? take(categorizedCommits.fix, 6).map(c => li(formatCommit(c))).join('')
            : li('No obvious “fix/bug” commits this week. Either we’re perfect… or it’s hidden in private repos.');

        const [weeklyArchive, cachedRepos, cachedReleases, cachedWeeklyStats, cachedMeta] = await Promise.all([
            loadWeeklyLogArchive(),
            loadCachedData(),
            loadCachedReleases(),
            loadCachedWeeklyStats(),
            loadCachedMeta()
        ]);
        const cacheSourceText = getGitHubCacheSourceText(cachedMeta);
        const isLocalCacheSource = getGitHubCacheSource(cachedMeta) === 'local-git-refresh';
        const weeklyStatsSourceText = getWeeklyStatsSourceText(cachedWeeklyStats);
        const isLocalWeeklySource = getWeeklyStatsSource(cachedWeeklyStats) === 'local-git-refresh';

        const weeklyStatsSyncDate = (() => {
            const raw = cachedWeeklyStats && typeof cachedWeeklyStats.updatedAt === 'string'
                ? new Date(cachedWeeklyStats.updatedAt)
                : null;
            return raw && !Number.isNaN(raw.getTime()) ? raw : null;
        })();

        if (syncPillEl) {
            if (weeklyStatsSyncDate) {
                syncPillEl.textContent = `Synced ${getTimeAgo(weeklyStatsSyncDate)}`;
                syncPillEl.dataset.state = 'fresh';
                syncPillEl.title = `${cacheSourceText} updated ${formatUTCDateTime(weeklyStatsSyncDate.toISOString())}`;
            } else {
                syncPillEl.textContent = 'Live digest';
                syncPillEl.dataset.state = 'neutral';
            }
        }
        if (sourceNoteEl) {
            sourceNoteEl.textContent = isLocalCacheSource
                ? `${weeklyStatsSourceText} + public releases + weekly archive`
                : `${weeklyStatsSourceText} + weekly archive`;
        }

        const weeklyStatsCommits = (() => {
            const stats = cachedWeeklyStats && typeof cachedWeeklyStats === 'object' ? cachedWeeklyStats : null;
            const val = stats ? Number(stats.totalCommitContributions) : Number.NaN;
            return Number.isFinite(val) ? Math.max(0, Math.round(val)) : null;
        })();

        const commitTotalForKpi = weeklyStatsCommits != null ? weeklyStatsCommits : totalCommits;
        const weeklyRepoTotalForKpi = cachedWeeklyStats && typeof cachedWeeklyStats.totalRepositoryContributions === 'number'
            ? Math.max(0, Number(cachedWeeklyStats.totalRepositoryContributions) || 0)
            : activeRepos.size;
        const weeklyRepoLabel = `${weeklyRepoTotalForKpi} repo${weeklyRepoTotalForKpi === 1 ? '' : 's'}`;

        kickoff = commitTotalForKpi
            ? (isLocalWeeklySource
                ? `We clocked <strong>${escapeHtml(commitTotalForKpi)}</strong> local commits across <strong>${escapeHtml(weeklyRepoLabel)}</strong> in the last 7 days.`
                : (weeklyStatsCommits != null
                    ? `We clocked <strong>${escapeHtml(commitTotalForKpi)}</strong> commit contributions (7d). Public repos in the spotlight: <strong>${escapeHtml(activeRepos.size)}</strong>.`
                    : `We clocked <strong>${escapeHtml(commitTotalForKpi)}</strong> commits across <strong>${escapeHtml(activeRepos.size)}</strong> active repos.`))
            : `Quiet week on public repos — but we might have been building in private 👀`;

        if (highlights.length) {
            highlights[0] = weeklyStatsCommits != null
                ? (isLocalWeeklySource
                    ? `${escapeHtml(commitTotalForKpi)} local commits (7d)`
                    : `${escapeHtml(commitTotalForKpi)} commit contributions (7d)`)
                : `${escapeHtml(commitTotalForKpi)} commits across ${escapeHtml(activeRepos.size)} repos`;
        }

        const diaryEntries = weeklyArchive && Array.isArray(weeklyArchive.entries) ? weeklyArchive.entries : [];

        const requestedWeekKey = (() => {
            const hash = String(window.location.hash || '');
            const match = hash.match(/week=([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
            return match ? match[1] : '';
        })();

        const monthMap = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
        };
        const pad2 = (n) => String(n).padStart(2, '0');

        const parseWeekStart = (weekOf) => {
            const raw = String(weekOf || '').trim();
            if (!raw) return null;

            const startPart = raw
                .split(/[–—-]/)[0]
                .replace(/\s+/g, ' ')
                .trim();
            const m = startPart.match(/^([A-Za-z]{3,9})\s+(\d{1,2})/);
            if (!m) return null;
            const monthKey = m[1].slice(0, 3).toLowerCase();
            const month = Object.prototype.hasOwnProperty.call(monthMap, monthKey) ? monthMap[monthKey] : null;
            const day = Number.parseInt(m[2], 10);
            if (month == null || !Number.isFinite(day) || day <= 0 || day > 31) return null;
            return { month, day };
        };

        const applyWeekKeys = (entries) => {
            if (!Array.isArray(entries) || !entries.length) return;

            const startParts = entries.map(entry => parseWeekStart(entry && entry.weekOf));
            let year = now.getFullYear();

            for (let i = entries.length - 1; i >= 0; i -= 1) {
                const start = startParts[i];
                if (!start) continue;

                const nextStart = i + 1 < startParts.length ? startParts[i + 1] : null;
                if (nextStart && start.month > nextStart.month) {
                    year -= 1;
                }

                const key = `${year}-${pad2(start.month + 1)}-${pad2(start.day)}`;
                entries[i].weekKey = key;
            }
        };

        applyWeekKeys(diaryEntries);

        const latestDiaryEntry = diaryEntries.length ? diaryEntries[diaryEntries.length - 1] : null;
        const archiveProjectTitle = (weeklyArchive && typeof weeklyArchive.projectTitle === 'string' && weeklyArchive.projectTitle.trim())
            ? weeklyArchive.projectTitle.trim()
            : (latestDiaryEntry && latestDiaryEntry.projectTitle ? String(latestDiaryEntry.projectTitle).trim() : '');
        const latestDiaryDate = (() => {
            if (!latestDiaryEntry || !latestDiaryEntry.weekKey) return null;
            const dt = new Date(`${latestDiaryEntry.weekKey}T00:00:00`);
            return Number.isNaN(dt.getTime()) ? null : dt;
        })();
        const diaryArchiveAgeDays = latestDiaryDate
            ? Math.max(0, Math.floor((now.getTime() - latestDiaryDate.getTime()) / (1000 * 60 * 60 * 24)))
            : null;
        const diaryArchiveIsStale = Number.isFinite(diaryArchiveAgeDays) ? diaryArchiveAgeDays > 21 : false;
        const diaryArchiveLooksProjectSpecific = archiveProjectTitle
            ? /basketball|tactics|coach|board/i.test(archiveProjectTitle) && !/atrak|lunar/i.test(archiveProjectTitle)
            : false;
        const diaryArchiveShouldBeLegacy = Boolean(diaryEntries.length && (diaryArchiveIsStale || diaryArchiveLooksProjectSpecific));

        const renderDiaryArchiveNote = (entry) => {
            if (!entry || !entry.weekKey) return '';
            const entryDate = new Date(`${entry.weekKey}T00:00:00`);
            if (Number.isNaN(entryDate.getTime())) return '';

            const diffMs = Math.max(0, now.getTime() - entryDate.getTime());
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const weeksOld = diffDays > 21 ? Math.max(1, Math.round(diffDays / 7)) : 0;
            const syncCutoff = weeklyStatsSyncDate ? formatShortDate(weeklyStatsSyncDate) : formatShortDate(now);
            const parts = [];

            if (diaryArchiveShouldBeLegacy) {
                parts.push(`Legacy project diary${archiveProjectTitle ? ` (${archiveProjectTitle})` : ''}`);
            }
            if (weeksOld > 0) {
                parts.push(`Archive snapshot (${weeksOld}w old)`);
            }

            if (!parts.length) return '';
            return `${parts.join(' • ')}. Live GitHub activity above is current through ${syncCutoff}.`;
        };

        if (sourceNoteEl) {
            if (weeklyStatsSyncDate) {
                if (diaryArchiveShouldBeLegacy) {
                    sourceNoteEl.textContent = `GitHub cache • ${formatUTCDateTime(weeklyStatsSyncDate.toISOString())} • Real weekly log is GitHub-derived • Legacy project diary archived below`;
                } else if (diaryEntries.length) {
                    sourceNoteEl.textContent = `GitHub cache • ${formatUTCDateTime(weeklyStatsSyncDate.toISOString())} • Weekly notes include archive diary entries`;
                } else {
                    sourceNoteEl.textContent = `GitHub cache • ${formatUTCDateTime(weeklyStatsSyncDate.toISOString())} • Real weekly log is GitHub-derived`;
                }
            } else {
                sourceNoteEl.textContent = diaryArchiveShouldBeLegacy
                    ? 'Live GitHub activity + legacy project diary archive'
                    : 'Live GitHub activity + weekly archive';
            }
        }

        renderContentFreshnessStrip('weekly-freshness-strip', {
            kind: 'Weekly log',
            updatedAt: weeklyStatsSyncDate || null,
            latestActivityAt: mostRecentEventAt || null,
            latestLabel: 'Latest activity',
            totalCount: activeRepos.size,
            countLabel: 'active repos',
            thresholds: { freshDays: 2, agingDays: 7 },
            note: diaryArchiveShouldBeLegacy ? 'Legacy diary integrated into history' : 'GitHub-derived weekly timeline'
        });

        const requestedDiaryIndex = requestedWeekKey
            ? diaryEntries.findIndex(entry => entry && entry.weekKey === requestedWeekKey)
            : -1;
        const savedDiaryIndex = (() => {
            try {
                return Number.parseInt(window.localStorage.getItem('atrak_weekly_diary_index') || '', 10);
            } catch (_) {
                return Number.NaN;
            }
        })();
        const defaultDiaryIndex = diaryEntries.length ? diaryEntries.length - 1 : -1;
        const selectedDiaryIndex = requestedDiaryIndex >= 0
            ? requestedDiaryIndex
            : (Number.isFinite(savedDiaryIndex) && savedDiaryIndex >= 0 && savedDiaryIndex < diaryEntries.length
                ? savedDiaryIndex
                : defaultDiaryIndex);
        const selectedDiaryEntry = selectedDiaryIndex >= 0 ? diaryEntries[selectedDiaryIndex] : null;
        const diaryWeekCounter = selectedDiaryEntry && diaryEntries.length ? `${selectedDiaryIndex + 1}/${diaryEntries.length}` : '';

        const githubWeeksByKey = new Map(
            githubWeekSummaries
                .filter(week => week && typeof week.weekKey === 'string')
                .map(week => [week.weekKey, week])
        );
        const diaryEntriesByKey = new Map(
            diaryEntries
                .filter(entry => entry && typeof entry.weekKey === 'string')
                .map(entry => [entry.weekKey, entry])
        );
        const parseWeekKeyDate = (weekKey) => {
            if (!weekKey || typeof weekKey !== 'string') return null;
            const dt = new Date(`${weekKey}T00:00:00`);
            return Number.isNaN(dt.getTime()) ? null : dt;
        };
        const currentGitHubWeekKey = githubWeekSummaries[0] && githubWeekSummaries[0].weekKey
            ? String(githubWeekSummaries[0].weekKey)
            : '';
        const unifiedWeeklyHistory = (() => {
            const keys = new Set([
                ...Array.from(githubWeeksByKey.keys()),
                ...Array.from(diaryEntriesByKey.keys())
            ]);

            return Array.from(keys)
                .map(weekKey => {
                    const github = githubWeeksByKey.get(weekKey) || null;
                    const diary = diaryEntriesByKey.get(weekKey) || null;
                    const weekDate = github && github.weekStart
                        ? new Date(github.weekStart)
                        : parseWeekKeyDate(weekKey);
                    return {
                        weekKey,
                        github,
                        diary,
                        weekDate: weekDate && !Number.isNaN(weekDate.getTime()) ? weekDate : null
                    };
                })
                .sort((a, b) => {
                    const aTime = a.weekDate ? a.weekDate.getTime() : 0;
                    const bTime = b.weekDate ? b.weekDate.getTime() : 0;
                    return bTime - aTime;
                });
        })();
        const requestedHistoryIndex = requestedWeekKey
            ? unifiedWeeklyHistory.findIndex(item => item && item.weekKey === requestedWeekKey)
            : -1;
        const savedHistoryKey = (() => {
            try {
                const raw = window.localStorage.getItem('atrak_weekly_history_key') || '';
                return typeof raw === 'string' ? raw : '';
            } catch (_) {
                return '';
            }
        })();
        const savedHistoryIndex = savedHistoryKey
            ? unifiedWeeklyHistory.findIndex(item => item && item.weekKey === savedHistoryKey)
            : -1;
        const selectedUnifiedHistoryIndex = requestedHistoryIndex >= 0
            ? requestedHistoryIndex
            : (savedHistoryIndex >= 0 ? savedHistoryIndex : 0);

        const currentMonthLabel = (() => {
            try {
                return now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            } catch (_) {
                return 'This month';
            }
        })();

        const releasesThisMonth = (() => {
            const list = Array.isArray(cachedReleases) ? cachedReleases : [];
            const seen = new Set();
            const out = [];

            for (const rel of list) {
                if (!rel || typeof rel !== 'object') continue;
                if (rel.draft) continue;
                const publishedRaw = typeof rel.published_at === 'string' ? rel.published_at : '';
                const publishedAt = publishedRaw ? new Date(publishedRaw) : null;
                if (!publishedAt || Number.isNaN(publishedAt.getTime())) continue;
                if (publishedAt.getFullYear() !== now.getFullYear()) continue;
                if (publishedAt.getMonth() !== now.getMonth()) continue;

                const url = safeExternalUrl(rel.url);
                if (url === '#') continue;
                if (seen.has(url)) continue;
                seen.add(url);

                const repoFull = typeof rel.repo === 'string' ? rel.repo : '';
                const repoName = repoFull ? (repoFull.split('/')[1] || repoFull) : 'repo';
                out.push({
                    repo: repoName,
                    tag: typeof rel.tag === 'string' && rel.tag.trim() ? rel.tag.trim() : 'release',
                    name: typeof rel.name === 'string' ? rel.name.trim() : '',
                    url,
                    date: publishedAt
                });

                if (out.length >= 6) break;
            }

            return out;
        })();

        const spotlightRepo = (() => {
            const repos = Array.isArray(cachedRepos) ? cachedRepos : [];
            const bestKey = topRepos[0] ? topRepos[0].key : '';
            const best = bestKey ? repos.find(r => r && r.name === bestKey) : null;
            if (best) return best;

            // Fallback: most recently pushed repo (excluding the website repo itself if possible)
            const sorted = repos
                .filter(r => r && typeof r.pushed_at === 'string')
                .slice()
                .sort((a, b) => String(b.pushed_at).localeCompare(String(a.pushed_at)));
            const nonSite = sorted.find(r => r && r.name && r.name !== 'atrak-website' && r.name !== 'AtrakWebpage' && r.name !== 'LunarWeb');
            return nonSite || sorted[0] || null;
        })();

        const spotlightHtml = spotlightRepo ? (() => {
            const key = String(spotlightRepo.name || '').trim();
            const display = formatDisplayName(key);
            const githubUrl = safeExternalUrl(spotlightRepo.html_url || ('https://github.com/' + (spotlightRepo.full_name || '')));
            const desc = (spotlightRepo.description || '').trim();
            const lang = spotlightRepo.language ? String(spotlightRepo.language) : '';
            const internal = INTERNAL_PROJECT_PAGES[key] || '';
            const pushed = spotlightRepo.pushed_at ? formatShortDate(new Date(spotlightRepo.pushed_at)) : '';

            return `
                <section class="weekly-section weekly-section-wide weekly-spotlight">
                    <div class="weekly-section-header">
                        <h4 class="weekly-section-title"><span class="weekly-section-icon">🔦</span>Spotlight</h4>
                        <span class="weekly-section-meta">${escapeHtml(lang || 'Project')}${pushed ? ` • Updated ${escapeHtml(pushed)}` : ''}</span>
                    </div>
                    <p class="weekly-briefing-text">
                        <strong>${escapeHtml(display)}</strong>${desc ? ` — ${escapeHtml(desc)}` : ''}
                    </p>
                    <div class="weekly-spotlight-actions">
                        ${internal ? `<a class="btn btn-secondary btn-sm" href="${escapeHtml(internal)}">Project Page</a>` : ''}
                        <a class="btn btn-secondary btn-sm" href="${githubUrl}" target="_blank" rel="noopener noreferrer">GitHub</a>
                        <a class="btn btn-secondary btn-sm" href="${safeExternalUrl((githubUrl.endsWith('/') ? githubUrl.slice(0, -1) : githubUrl) + '/releases')}" target="_blank" rel="noopener noreferrer">Releases</a>
                    </div>
                </section>
            `;
        })() : '';
        const renderDiaryBody = (entry) => {
            if (!entry) return '';

            const blocks = entry.blocks || {};
            const highlights = blocks.Highlights && blocks.Highlights.bullets ? blocks.Highlights.bullets.slice(0, 6) : [];
            const shipped = blocks.Shipped && blocks.Shipped.bullets ? blocks.Shipped.bullets.slice(0, 6) : [];
            const fixes = blocks.Fixes && blocks.Fixes.bullets ? blocks.Fixes.bullets.slice(0, 6) : [];
            const next = blocks.Next && blocks.Next.bullets ? blocks.Next.bullets.slice(0, 6) : [];
            const engineering = blocks.Engineering && blocks.Engineering.bullets ? blocks.Engineering.bullets.slice(0, 6) : [];
            const challenges = blocks.Challenges && blocks.Challenges.bullets ? blocks.Challenges.bullets.slice(0, 6) : [];
            const vibe = blocks.Vibe && blocks.Vibe.paragraphs ? blocks.Vibe.paragraphs.join(' ') : '';

            return `
                ${entry.headline ? `<div class="weekly-diary-headline" id="weekly-diary-headline">${escapeHtml(entry.headline)}</div>` : ''}
                <div class="weekly-diary-grid">
                    <div class="weekly-diary-card">
                        <div class="weekly-diary-card-title">Highlights</div>
                        <ul class="weekly-list">
                            ${(highlights.length ? highlights : ['No highlights logged.']).map(item => li(escapeHtml(item))).join('')}
                        </ul>
                    </div>
                    <div class="weekly-diary-card">
                        <div class="weekly-diary-card-title">Shipped</div>
                        <ul class="weekly-list">
                            ${(shipped.length ? shipped : ['No shipped items logged.']).map(item => li(escapeHtml(item))).join('')}
                        </ul>
                    </div>
                    <div class="weekly-diary-card">
                        <div class="weekly-diary-card-title">Fixes</div>
                        <ul class="weekly-list">
                            ${(fixes.length ? fixes : ['No fixes logged.']).map(item => li(escapeHtml(item))).join('')}
                        </ul>
                    </div>
                    <div class="weekly-diary-card">
                        <div class="weekly-diary-card-title">Next</div>
                        <ul class="weekly-list">
                            ${(next.length ? next : ['No next steps logged.']).map(item => li(escapeHtml(item))).join('')}
                        </ul>
                    </div>
                </div>
                ${vibe ? `
                    <div class="weekly-diary-vibe">
                        <div class="weekly-diary-card-title">Vibe Check</div>
                        <p class="weekly-diary-vibe-text">${escapeHtml(vibe)}</p>
                    </div>
                ` : ''}
                ${(engineering.length || challenges.length) ? `
                    <details class="weekly-diary-more">
                        <summary>More technical notes</summary>
                        <div class="weekly-diary-more-grid">
                            ${engineering.length ? `
                                <div class="weekly-diary-card">
                                    <div class="weekly-diary-card-title">Engineering</div>
                                    <ul class="weekly-list">
                                        ${engineering.map(item => li(escapeHtml(item))).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            ${challenges.length ? `
                                <div class="weekly-diary-card">
                                    <div class="weekly-diary-card-title">Challenges</div>
                                    <ul class="weekly-list">
                                        ${challenges.map(item => li(escapeHtml(item))).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    </details>
                ` : ''}
            `;
        };

        const renderDiaryMetrics = (entry) => {
            if (!entry || !entry.metrics) return '';
            const metrics = entry.metrics;
            if (!metrics || typeof metrics !== 'object') return '';
            const keys = Object.keys(metrics);
            if (!keys.length) return '';
            return Object.entries(metrics).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' • ');
        };

        const renderDiaryPreview = (entry) => {
            if (!entry) return '<div class="weekly-empty">No weekly posts yet.</div>';
            const blocks = entry.blocks || {};
            const highlights = blocks.Highlights && blocks.Highlights.bullets ? blocks.Highlights.bullets.slice(0, 3) : [];
            const shipped = blocks.Shipped && blocks.Shipped.bullets ? blocks.Shipped.bullets.slice(0, 3) : [];

            return `
                <div class="weekly-diary-grid weekly-diary-grid-compact">
                    <div class="weekly-diary-card">
                        <div class="weekly-diary-card-title">Highlights</div>
                        <ul class="weekly-list">
                            ${(highlights.length ? highlights : ['No highlights logged.']).map(item => li(escapeHtml(item))).join('')}
                        </ul>
                    </div>
                    <div class="weekly-diary-card">
                        <div class="weekly-diary-card-title">Shipped</div>
                        <ul class="weekly-list">
                            ${(shipped.length ? shipped : ['No shipped items logged.']).map(item => li(escapeHtml(item))).join('')}
                        </ul>
                    </div>
                </div>
            `;
        };

        const weekChips = diaryEntries.length
            ? diaryEntries
                .map((entry, idx) => ({ entry, idx }))
                .slice()
                .reverse()
                .map(({ entry, idx }) => {
                    const label = entry.weekOf ? `Week of ${entry.weekOf}` : `Week #${idx + 1}`;
                    const shortLabel = entry.weekOf ? entry.weekOf.replace(/\s+/g, ' ') : `Week ${idx + 1}`;
                    const weekKey = entry && entry.weekKey ? String(entry.weekKey) : '';
                    const active = idx === selectedDiaryIndex;
                    return `<button class="weekly-week-chip" type="button" data-weekly-week="${idx}" data-weekly-key="${escapeHtml(weekKey)}" ${active ? 'aria-current="true"' : ''} aria-label="${escapeHtml(label)}">${escapeHtml(shortLabel)}</button>`;
                })
                .join('')
            : '';

        const renderGitHubWeekWindowCard = (week, idx) => {
            const metricChips = [
                `${week.commits} commits`,
                `${week.pushes} pushes`,
                `${week.activeRepos} repos`,
                `${week.releases} rel`,
                week.stars ? `+${week.stars} stars` : '0 stars'
            ].map(text => `<span class="weekly-live-log-chip">${escapeHtml(text)}</span>`).join('');

            const topRepoSummary = (() => {
                const top = week.topRepos[0];
                if (!top) return 'No repo activity in cache for this week.';
                const parts = [];
                if (top.commits) parts.push(`${top.commits} commit${top.commits === 1 ? '' : 's'}`);
                if (top.pushes) parts.push(`${top.pushes} push${top.pushes === 1 ? '' : 'es'}`);
                return `<a class="weekly-inline-link" href="${top.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(top.name)}</a> • ${escapeHtml(parts.join(' • ') || 'activity')}`;
            })();

            const topReposHtml = week.topRepos.length
                ? week.topRepos.slice(0, 2).map(r => {
                    const parts = [];
                    if (r.commits) parts.push(`${r.commits}c`);
                    if (r.pushes) parts.push(`${r.pushes}p`);
                    return li(`<a class="weekly-inline-link" href="${r.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.name)}</a> — ${escapeHtml(parts.join(' • ') || 'activity')}`);
                }).join('')
                : li('No repo activity in cache for this week.');

            const notableSummary = week.notableMsgs.length
                ? escapeHtml(week.notableMsgs[0])
                : 'No notable commit messages.';
            const notableHtml = week.notableMsgs.length
                ? week.notableMsgs.slice(0, 2).map(msg => li(escapeHtml(msg))).join('')
                : li('No notable commit messages.');

            return `
                <article class="weekly-gh-window-card" data-gh-window-card="${idx}" aria-label="GitHub week ${escapeHtml(week.label)}">
                    <div class="weekly-section-header weekly-gh-window-header">
                        <h5 class="weekly-section-title"><span class="weekly-section-icon">📦</span>${escapeHtml(week.label)}</h5>
                        <span class="weekly-section-meta">${week.lastEventAt ? `Last event ${escapeHtml(formatShortDate(week.lastEventAt))}` : 'No events'}</span>
                    </div>
                    <div class="weekly-live-log-chips" aria-label="GitHub week metrics">
                        ${metricChips}
                    </div>
                    <div class="weekly-gh-window-summary">
                        <div class="weekly-gh-window-row">
                            <span class="weekly-gh-window-label">Top</span>
                            <span class="weekly-gh-window-text">${topRepoSummary}</span>
                        </div>
                        <div class="weekly-gh-window-row">
                            <span class="weekly-gh-window-label">Note</span>
                            <span class="weekly-gh-window-text">${notableSummary}</span>
                        </div>
                    </div>
                    <details class="weekly-more weekly-gh-window-more">
                        <summary>Details</summary>
                        <div class="weekly-gh-window-grid">
                            <div class="weekly-diary-card">
                                <div class="weekly-diary-card-title">Top Repos</div>
                                <ul class="weekly-list">${topReposHtml}</ul>
                            </div>
                            <div class="weekly-diary-card">
                                <div class="weekly-diary-card-title">Changes</div>
                                <ul class="weekly-list">${notableHtml}</ul>
                            </div>
                        </div>
                    </details>
                </article>
            `;
        };

        const githubWeekWindowCards = githubWeekSummaries.length
            ? githubWeekSummaries.map((week, idx) => renderGitHubWeekWindowCard(week, idx)).join('')
            : '';
        const githubWeekHistorySection = githubWeekSummaries.length
            ? `
                <section class="weekly-section weekly-section-wide weekly-github-week-history" id="weekly-github-week-history">
                    <div class="weekly-section-header">
                        <h4 class="weekly-section-title"><span class="weekly-section-icon">🧭</span>Past Week Logs (GitHub)</h4>
                        <div class="weekly-section-actions">
                            <span class="weekly-section-meta">Real history • cache-backed</span>
                            <button class="weekly-diary-nav" type="button" id="weekly-gh-prev-btn" aria-label="Previous GitHub week window">‹</button>
                            <button class="weekly-diary-nav" type="button" id="weekly-gh-next-btn" aria-label="Next GitHub week window">›</button>
                        </div>
                    </div>
                    <p class="weekly-briefing-text weekly-live-log-note">Swipe or use arrows to slide through cached GitHub week windows.</p>
                    <div class="weekly-gh-window-shell">
                        <div class="weekly-gh-window-track" id="weekly-gh-window-track" role="region" aria-label="Past GitHub week windows">
                            ${githubWeekWindowCards}
                        </div>
                    </div>
                </section>
            `
            : '';

        const liveLogHighlightsList = (highlights.length ? highlights.slice(0, 2) : ['No public GitHub event highlights this week.']).map(h => li(h)).join('');
        const liveLogSignalChips = (() => {
            const chips = [];
            chips.push(weeklyStatsSyncDate ? `Synced ${getTimeAgo(weeklyStatsSyncDate)}` : 'Cache sync unknown');
            chips.push(mostRecentEventAt ? `Last activity ${formatShortDate(mostRecentEventAt)}` : 'No recent public activity');
            chips.push(`${releases.length} release${releases.length === 1 ? '' : 's'} this week`);
            if (diaryArchiveShouldBeLegacy && diaryEntries.length) {
                chips.push('Legacy diary archived');
            }
            return chips.map(text => `<span class="weekly-live-log-chip">${escapeHtml(text)}</span>`).join('');
        })();
        const liveLogSummaryLine = [
            `${commitTotalForKpi} commit${commitTotalForKpi === 1 ? '' : 's'} (7d)`,
            `${totalPushes} push${totalPushes === 1 ? '' : 'es'}`,
            `${activeRepos.size} repo${activeRepos.size === 1 ? '' : 's'} active`,
            `${releases.length} release${releases.length === 1 ? '' : 's'}`
        ].join(' • ');
        const liveWeeklyLogNote = isLocalCacheSource
            ? 'Built from the local repo snapshot and weekly archive. Public GitHub events/releases are intentionally cleared to avoid stale mixed data.'
            : 'Built from GitHub events/cache (real activity), not hand-written mock notes.';
        const liveWeeklyLogSection = `
            <section class="weekly-section weekly-section-wide weekly-live-log" id="weekly-live-log">
                <div class="weekly-section-header">
                    <h4 class="weekly-section-title"><span class="weekly-section-icon">🗞️</span>Weekly Log</h4>
                    <span class="weekly-section-meta">GitHub • Last 7d</span>
                </div>
                <p class="weekly-briefing-text weekly-live-log-note">${escapeHtml(liveWeeklyLogNote)}</p>
                <p class="weekly-briefing-text weekly-live-log-summary">${escapeHtml(liveLogSummaryLine)}</p>
                <div class="weekly-live-log-chips" aria-label="Weekly log status">
                    ${liveLogSignalChips}
                </div>
                <ul class="weekly-list">
                    ${liveLogHighlightsList}
                </ul>
            </section>
        `;

        const diarySection = `
            <section class="weekly-section weekly-section-wide weekly-diary" id="weekly-diary">
                <div class="weekly-section-header">
                    <h4 class="weekly-section-title"><span class="weekly-section-icon">${diaryArchiveShouldBeLegacy ? '🗂️' : '🗞️'}</span>${diaryArchiveShouldBeLegacy ? 'Legacy Weekly Diary' : 'Weekly Log'}</h4>
                    <div class="weekly-section-actions">
                        <span class="weekly-section-meta" id="weekly-news-meta">${selectedDiaryEntry && selectedDiaryEntry.weekOf ? escapeHtml(selectedDiaryEntry.weekOf) : (diaryArchiveShouldBeLegacy ? 'Archive' : escapeHtml(currentMonthLabel))}</span>
                        <button class="weekly-share-btn" type="button" id="weekly-share-btn" aria-label="Copy link to this week">Share</button>
                    </div>
                </div>
                ${weekChips ? `<div class="weekly-week-strip" role="navigation" aria-label="Browse weekly posts">${weekChips}</div>` : ''}
                <div class="weekly-diary-meta" id="weekly-diary-meta">${selectedDiaryEntry ? `${escapeHtml(selectedDiaryEntry.projectTitle)} • ${escapeHtml(selectedDiaryEntry.weekOf || '')}${diaryWeekCounter ? ` • ${escapeHtml(diaryWeekCounter)}` : ''}` : 'No weekly posts loaded.'}</div>
                <div class="weekly-diary-note" id="weekly-diary-archive-note">${escapeHtml(renderDiaryArchiveNote(selectedDiaryEntry))}</div>
                <div id="weekly-diary-preview">
                    ${renderDiaryPreview(selectedDiaryEntry)}
                </div>
                ${selectedDiaryEntry && !diaryArchiveShouldBeLegacy ? `
                    <details class="weekly-more weekly-post-more" id="weekly-post-more">
                        <summary>Open full week</summary>
                        <div id="weekly-diary-body" class="weekly-diary-body" role="region" aria-label="Weekly post" aria-live="polite">
                            ${renderDiaryBody(selectedDiaryEntry)}
                        </div>
                    </details>
                ` : ''}
                ${selectedDiaryEntry && diaryArchiveShouldBeLegacy ? `
                    <div class="weekly-diary-compact-note">Homepage shows a legacy preview only. Open the log file for the full week write-up.</div>
                ` : ''}
                <div class="weekly-diary-footer">
                    <span class="weekly-diary-metrics" id="weekly-diary-metrics">${escapeHtml(selectedDiaryEntry ? (renderDiaryMetrics(selectedDiaryEntry) || '') : '')}</span>
                    <a class="weekly-link" href="WeeklyLog.txt" target="_blank" rel="noopener">${diaryArchiveShouldBeLegacy ? 'Open legacy log file' : 'Read full log'}</a>
                </div>
            </section>
        `;

        const legacyArchiveSection = (diaryEntries.length && diaryArchiveShouldBeLegacy) ? `
            <details class="weekly-more weekly-legacy-archive-shell" id="weekly-legacy-archive-shell">
                <summary>Legacy Weekly Diary (Project Archive)</summary>
                <div class="weekly-legacy-archive-note">
                    Older project-specific write-ups are kept here as reference. Current weekly updates above come from live GitHub activity.
                </div>
                <div class="weekly-legacy-archive-body">
                    ${diarySection}
                </div>
            </details>
        ` : '';

        const primaryWeeklyLogSection = (diaryEntries.length && !diaryArchiveShouldBeLegacy)
            ? diarySection
            : liveWeeklyLogSection;
        const useCondensedLiveWeeklyLayout = !(diaryEntries.length && !diaryArchiveShouldBeLegacy);

	        const topReposThisWeekList = topRepos.length
	            ? topRepos.slice(0, 4).map(r => {
	                const meta = [];
	                if (r.commits) meta.push(`${r.commits} commit${r.commits === 1 ? '' : 's'}`);
	                if (r.pushes) meta.push(`${r.pushes} push${r.pushes === 1 ? '' : 'es'}`);
	                return li(`<a class="weekly-inline-link" href="${r.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.name)}</a> — ${escapeHtml(meta.join(' • ') || 'active')}`);
	            }).join('')
	            : li('No repo updates found (or cache not ready).');

            const monthReleasesList = releasesThisMonth.length
                ? releasesThisMonth.slice(0, 4).map(r => {
                    const nameSuffix = r.name ? ` <span class="weekly-muted">(${escapeHtml(r.name)})</span>` : '';
                    return li(`<a class="weekly-inline-link" href="${r.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.repo)}</a> — <code>${escapeHtml(r.tag)}</code>${nameSuffix}`);
                }).join('')
                : li(`No releases cached for ${escapeHtml(currentMonthLabel)} yet.`);

            let thisWeekDetailsSection = '';

            const moreGitHubDetails = `
                <details class="weekly-more" id="weekly-github-more">
                    <summary>More from GitHub (last 7 days)</summary>
                    <div class="weekly-sections">
                        <section class="weekly-section weekly-section-wide weekly-briefing">
                            <div class="weekly-section-header">
                                <h4 class="weekly-section-title"><span class="weekly-section-icon">🎙️</span>Weekly Briefing</h4>
                                <span class="weekly-section-meta">${mostRecentEventAt ? `Last ping: ${escapeHtml(formatShortDate(mostRecentEventAt))}` : 'Last 7d'}</span>
                            </div>
                            <p class="weekly-briefing-text">${escapeHtml(intro)} ${kickoff}</p>
                            <p class="weekly-briefing-text">
                                Want in? <a class="weekly-inline-link" href="#contact" data-open-contact-tab="apply">Apply / Contact</a>
                            </p>
                        </section>
                        ${spotlightHtml}
                        <section class="weekly-section">
                            <div class="weekly-section-header">
                                <h4 class="weekly-section-title"><span class="weekly-section-icon">📌</span>Highlights</h4>
                                <span class="weekly-section-meta">Last 7d</span>
                            </div>
                            <ul class="weekly-list">
                                ${highlights.map(h => li(h)).join('')}
                            </ul>
                        </section>
                        <section class="weekly-section">
                            <div class="weekly-section-header">
                                <h4 class="weekly-section-title"><span class="weekly-section-icon">📝</span>Notable Changes</h4>
                                <span class="weekly-section-meta">Commits</span>
                            </div>
                            <ul class="weekly-list">
                                ${notableList}
                            </ul>
                        </section>
                        <section class="weekly-section">
                            <div class="weekly-section-header">
                                <h4 class="weekly-section-title"><span class="weekly-section-icon">🚀</span>Releases (This Week)</h4>
                                <span class="weekly-section-meta">${escapeHtml(releases.length ? `${releases.length}` : '0')}</span>
                            </div>
                            <ul class="weekly-list">
                                ${releasesList}
                            </ul>
                        </section>
                        <section class="weekly-section">
                            <div class="weekly-section-header">
                                <h4 class="weekly-section-title"><span class="weekly-section-icon">✨</span>Patch Notes</h4>
                                <span class="weekly-section-meta">Features</span>
                            </div>
                            <ul class="weekly-list">
                                ${featureList}
                            </ul>
                        </section>
                        <section class="weekly-section">
                            <div class="weekly-section-header">
                                <h4 class="weekly-section-title"><span class="weekly-section-icon">🪲</span>Bug Squash</h4>
                                <span class="weekly-section-meta">Fixes</span>
                            </div>
                            <ul class="weekly-list">
                                ${fixList}
                            </ul>
                        </section>
                    </div>
                </details>
            `;

            thisWeekDetailsSection = `
                <details class="weekly-more weekly-this-week-details" id="weekly-this-week-details">
                    <summary>This Week Details (repos, releases, deep dive)</summary>
                    <div class="weekly-sections weekly-this-week-details-grid">
                        <section class="weekly-section">
                            <div class="weekly-section-header">
                                <h4 class="weekly-section-title"><span class="weekly-section-icon">🔥</span>Top Repos (This Week)</h4>
                                <span class="weekly-section-meta">Public</span>
                            </div>
                            <ul class="weekly-list">
                                ${topReposThisWeekList}
                            </ul>
                        </section>

                        <section class="weekly-section">
                            <div class="weekly-section-header">
                                <h4 class="weekly-section-title"><span class="weekly-section-icon">🚀</span>Latest Releases</h4>
                                <span class="weekly-section-meta">${escapeHtml(currentMonthLabel)}</span>
                            </div>
                            <ul class="weekly-list">
                                ${monthReleasesList}
                            </ul>
                        </section>
                    </div>
                    <div class="weekly-this-week-details-extra">
                        ${moreGitHubDetails}
                    </div>
                </details>
            `;

            const historyAndArchiveSection = (() => {
                if (githubWeekHistorySection && legacyArchiveSection) {
                    return githubWeekHistorySection.replace(
                        '</section>',
                        `<div class="weekly-history-inline-legacy">${legacyArchiveSection}</div></section>`
                    );
                }
                return githubWeekHistorySection || legacyArchiveSection || '';
            })();

	        container.innerHTML = `
	            <div class="weekly-digest weekly-digest-v2">
                    <div id="weekly-unified-history-shell" role="region" aria-live="polite" aria-atomic="true" aria-label="Weekly log history content"></div>

                    <div class="weekly-footer">
                        <a class="btn btn-secondary btn-sm" href="releases.html">Read Release Notes</a>
                        <a class="btn btn-secondary btn-sm" href="${safeExternalUrl('https://github.com/' + GITHUB_USERNAME)}" target="_blank" rel="noopener noreferrer">GitHub</a>
                        <a class="btn btn-secondary btn-sm" href="#updates">Build Log</a>
                    </div>
	            </div>
	        `;

            const renderUnifiedChipList = (texts) => (Array.isArray(texts) ? texts : [])
                .filter(Boolean)
                .map(text => `<span class="weekly-live-log-chip">${escapeHtml(String(text))}</span>`)
                .join('');

            const renderLegacyDiaryIntegratedBlock = (entry) => {
                if (!entry) return '';
                const metaParts = [];
                if (entry.projectTitle) metaParts.push(String(entry.projectTitle));
                if (entry.weekOf) metaParts.push(String(entry.weekOf));
                const metaText = metaParts.join(' • ');
                const archiveNote = renderDiaryArchiveNote(entry);
                const metrics = renderDiaryMetrics(entry);

                return `
                    <details class="weekly-more weekly-legacy-archive-shell">
                        <summary>Legacy Diary Notes (Integrated)</summary>
                        ${metaText ? `<div class="weekly-diary-meta">${escapeHtml(metaText)}</div>` : ''}
                        ${archiveNote ? `<div class="weekly-diary-note">${escapeHtml(archiveNote)}</div>` : ''}
                        <div class="weekly-legacy-archive-note">Legacy project notes are merged here for the same week. This is archive content.</div>
                        <div class="weekly-legacy-archive-body">
                            ${renderDiaryPreview(entry)}
                            <details class="weekly-more weekly-post-more">
                                <summary>Open full legacy diary week</summary>
                                <div class="weekly-diary-body" role="region" aria-label="Legacy weekly diary post">
                                    ${renderDiaryBody(entry)}
                                </div>
                            </details>
                            <div class="weekly-diary-footer">
                                <span class="weekly-diary-metrics">${escapeHtml(metrics || '')}</span>
                                <a class="weekly-link" href="WeeklyLog.txt" target="_blank" rel="noopener">Open legacy log file</a>
                            </div>
                        </div>
                    </details>
                `;
            };

            const buildUnifiedWeekViewModel = (item, index, total) => {
                const githubWeek = item && item.github ? item.github : null;
                const diaryWeek = item && item.diary ? item.diary : null;
                const hasGitHub = Boolean(githubWeek);
                const hasDiary = Boolean(diaryWeek);
                const isCurrentGitHubWeek = Boolean(hasGitHub && currentGitHubWeekKey && item.weekKey === currentGitHubWeekKey);
                const weekLabel = hasGitHub
                    ? githubWeek.label
                    : (diaryWeek && diaryWeek.weekOf ? String(diaryWeek.weekOf) : String(item.weekKey || 'Weekly Log'));

                const topHeaderTitle = isCurrentGitHubWeek ? 'This Week at Atrak' : 'Weekly Log';
                const topHeaderIcon = isCurrentGitHubWeek ? '📰' : (hasDiary ? '🗂️' : '🧭');
                const topHeaderDateRange = weekLabel;

                const cacheStamp = weeklyStatsSyncDate
                    ? `${weeklyStatsSourceText} • ${formatUTCDateTime(weeklyStatsSyncDate.toISOString())}`
                    : weeklyStatsSourceText;
                let topHeaderSourceNote = `${cacheStamp} • Use arrows to browse week history`;
                if (diaryEntries.length && diaryArchiveShouldBeLegacy) {
                    topHeaderSourceNote += ' • legacy diary merged into week history';
                }
                if (hasGitHub && hasDiary) {
                    topHeaderSourceNote += ' • this week includes GitHub + diary notes';
                } else if (hasDiary && !hasGitHub) {
                    topHeaderSourceNote += ' • diary-only archive week';
                }

                const panelIcon = isCurrentGitHubWeek ? '🗞️' : (hasDiary ? '🗂️' : '📦');
                const panelTitle = isCurrentGitHubWeek
                    ? 'Weekly Log'
                    : (hasGitHub ? 'Week Log (Archive)' : 'Legacy Week Diary');

                const panelMetaParts = [];
                if (hasGitHub) panelMetaParts.push(isCurrentGitHubWeek ? `${weeklyStatsSourceText} • Last 7d` : 'GitHub • Archived Week');
                if (hasDiary) panelMetaParts.push(hasGitHub ? 'Legacy diary attached' : 'Legacy diary archive');
                panelMetaParts.push(`${index + 1}/${total}`);
                const panelMeta = panelMetaParts.join(' • ');

                let panelNote = '';
                let panelMainHtml = '';
                let detailsSummary = 'Week Details';
                let detailsBodyHtml = '';

                if (hasGitHub) {
                    const commitCount = isCurrentGitHubWeek ? commitTotalForKpi : Math.max(0, Number(githubWeek.commits) || 0);
                    const pushCount = Math.max(0, Number(githubWeek.pushes) || 0);
                    const activeRepoCount = Math.max(0, Number(githubWeek.activeRepos) || 0);
                    const releaseCount = Math.max(0, Number(githubWeek.releases) || 0);
                    const starCount = Math.max(0, Number(githubWeek.stars) || 0);

                    const summaryLine = isCurrentGitHubWeek && isLocalWeeklySource
                        ? `${commitCount} local commits (7d) • ${weeklyRepoLabel} active • public feed has ${pushCount} pushes • ${releaseCount} release${releaseCount === 1 ? '' : 's'}`
                        : (isCurrentGitHubWeek
                            ? `${commitCount} commits (7d) • ${pushCount} pushes • ${activeRepoCount} repo${activeRepoCount === 1 ? '' : 's'} active • ${releaseCount} release${releaseCount === 1 ? '' : 's'}`
                            : `${commitCount} commits • ${pushCount} pushes • ${activeRepoCount} repos • ${releaseCount} releases${starCount ? ` • +${starCount} stars` : ''}`);

                    const chips = [
                        isCurrentGitHubWeek && weeklyStatsSyncDate ? `Synced ${getTimeAgo(weeklyStatsSyncDate)}` : 'Archived week',
                        githubWeek.lastEventAt ? `Last activity ${formatShortDate(githubWeek.lastEventAt)}` : 'No public events',
                        `${releaseCount} release${releaseCount === 1 ? '' : 's'}`
                    ];
                    if (hasDiary) chips.push('Legacy diary notes available');

                    const githubMainHighlights = (() => {
                        if (isCurrentGitHubWeek) {
                            return liveLogHighlightsList;
                        }

                        const rows = [];
                        if (githubWeek.topRepos && githubWeek.topRepos[0]) {
                            const top = githubWeek.topRepos[0];
                            const parts = [];
                            if (top.commits) parts.push(`${top.commits} commit${top.commits === 1 ? '' : 's'}`);
                            if (top.pushes) parts.push(`${top.pushes} push${top.pushes === 1 ? '' : 'es'}`);
                            rows.push(li(`Top repo: <a class="weekly-inline-link" href="${top.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(top.name)}</a>${parts.length ? ` — ${escapeHtml(parts.join(' • '))}` : ''}`));
                        }
                        if (githubWeek.notableMsgs && githubWeek.notableMsgs[0]) {
                            rows.push(li(`Notable change: ${escapeHtml(githubWeek.notableMsgs[0])}`));
                        }
                        if ((githubWeek.releases || 0) > 0) {
                            rows.push(li(`${escapeHtml(githubWeek.releases)} release event${githubWeek.releases === 1 ? '' : 's'} in this week snapshot`));
                        }
                        if ((githubWeek.stars || 0) > 0) {
                            rows.push(li(`Stars gained: +${escapeHtml(githubWeek.stars)}`));
                        }
                        if (!rows.length) {
                            rows.push(li('No notable public GitHub activity captured for this week.'));
                        }
                        return rows.join('');
                    })();

                    panelNote = isCurrentGitHubWeek && isLocalWeeklySource
                        ? 'Weekly commits are counted from checked-out local repos; releases and repo links stay on the public GitHub cache.'
                        : (isCurrentGitHubWeek
                            ? 'Built from GitHub events/cache (real activity). Use the top arrows to move through older GitHub and legacy weeks.'
                            : 'Archived GitHub week snapshot from cache. Use the top arrows to move across all weeks.');

                    panelMainHtml = `
                        <p class="weekly-briefing-text weekly-live-log-note">${escapeHtml(panelNote)}</p>
                        <p class="weekly-briefing-text weekly-live-log-summary">${escapeHtml(summaryLine)}</p>
                        <div class="weekly-live-log-chips" aria-label="Weekly log status">
                            ${renderUnifiedChipList(chips)}
                        </div>
                        <ul class="weekly-list">
                            ${githubMainHighlights}
                        </ul>
                        ${hasDiary ? '<div class="weekly-diary-compact-note">Legacy diary notes exist for this week. Open Week Details to view them inline.</div>' : ''}
                    `;

                    if (isCurrentGitHubWeek) {
                        detailsSummary = 'Week Details (repos, releases, deep dive)';
                        detailsBodyHtml = `
                            <div class="weekly-sections weekly-this-week-details-grid">
                                <section class="weekly-section">
                                    <div class="weekly-section-header">
                                        <h4 class="weekly-section-title"><span class="weekly-section-icon">🔥</span>Top Repos (This Week)</h4>
                                        <span class="weekly-section-meta">Public</span>
                                    </div>
                                    <ul class="weekly-list">
                                        ${topReposThisWeekList}
                                    </ul>
                                </section>
                                <section class="weekly-section">
                                    <div class="weekly-section-header">
                                        <h4 class="weekly-section-title"><span class="weekly-section-icon">🚀</span>Latest Releases</h4>
                                        <span class="weekly-section-meta">${escapeHtml(currentMonthLabel)}</span>
                                    </div>
                                    <ul class="weekly-list">
                                        ${monthReleasesList}
                                    </ul>
                                </section>
                            </div>
                            <div class="weekly-this-week-details-extra">
                                ${moreGitHubDetails}
                            </div>
                            ${hasDiary ? `<div class="weekly-history-inline-legacy">${renderLegacyDiaryIntegratedBlock(diaryWeek)}</div>` : ''}
                        `;
                    } else {
                        const weekTopReposList = githubWeek.topRepos && githubWeek.topRepos.length
                            ? githubWeek.topRepos.slice(0, 3).map(repo => {
                                const parts = [];
                                if (repo.commits) parts.push(`${repo.commits} commit${repo.commits === 1 ? '' : 's'}`);
                                if (repo.pushes) parts.push(`${repo.pushes} push${repo.pushes === 1 ? '' : 'es'}`);
                                return li(`<a class="weekly-inline-link" href="${repo.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(repo.name)}</a> — ${escapeHtml(parts.join(' • ') || 'activity')}`);
                            }).join('')
                            : li('No repo activity in cache for this week.');
                        const weekNotablesList = githubWeek.notableMsgs && githubWeek.notableMsgs.length
                            ? githubWeek.notableMsgs.slice(0, 4).map(msg => li(escapeHtml(msg))).join('')
                            : li('No notable commit messages captured for this week.');

                        detailsSummary = 'Week Details (archive snapshot)';
                        detailsBodyHtml = `
                            <div class="weekly-sections weekly-this-week-details-grid">
                                <section class="weekly-section">
                                    <div class="weekly-section-header">
                                        <h4 class="weekly-section-title"><span class="weekly-section-icon">🔥</span>Top Repos</h4>
                                        <span class="weekly-section-meta">Cache snapshot</span>
                                    </div>
                                    <ul class="weekly-list">
                                        ${weekTopReposList}
                                    </ul>
                                </section>
                                <section class="weekly-section">
                                    <div class="weekly-section-header">
                                        <h4 class="weekly-section-title"><span class="weekly-section-icon">📝</span>Changes</h4>
                                        <span class="weekly-section-meta">Commits</span>
                                    </div>
                                    <ul class="weekly-list">
                                        ${weekNotablesList}
                                    </ul>
                                </section>
                            </div>
                            ${hasDiary ? `<div class="weekly-history-inline-legacy">${renderLegacyDiaryIntegratedBlock(diaryWeek)}</div>` : ''}
                        `;
                    }
                } else if (hasDiary) {
                    const diaryMetaParts = [];
                    if (diaryWeek.projectTitle) diaryMetaParts.push(String(diaryWeek.projectTitle));
                    if (diaryWeek.weekOf) diaryMetaParts.push(String(diaryWeek.weekOf));
                    const diaryMetaText = diaryMetaParts.join(' • ');
                    const diaryArchiveNote = renderDiaryArchiveNote(diaryWeek);

                    panelNote = 'Legacy weekly diary archive week. No matching GitHub week snapshot is available in the current cache.';
                    panelMainHtml = `
                        <p class="weekly-briefing-text weekly-live-log-note">${escapeHtml(panelNote)}</p>
                        <div class="weekly-live-log-chips" aria-label="Weekly log status">
                            ${renderUnifiedChipList(['Legacy diary archive', 'Diary-only week', diaryWeek.weekKey || ''])}
                        </div>
                        ${diaryMetaText ? `<div class="weekly-diary-meta">${escapeHtml(diaryMetaText)}</div>` : ''}
                        ${diaryArchiveNote ? `<div class="weekly-diary-note">${escapeHtml(diaryArchiveNote)}</div>` : ''}
                        ${renderDiaryPreview(diaryWeek)}
                    `;

                    detailsSummary = 'Week Details (legacy diary)';
                    detailsBodyHtml = renderLegacyDiaryIntegratedBlock(diaryWeek);
                } else {
                    panelNote = 'No data available for this week.';
                    panelMainHtml = `<div class="weekly-empty">No weekly data available.</div>`;
                    detailsSummary = 'Week Details';
                    detailsBodyHtml = '<div class="weekly-empty">No details available.</div>';
                }

                const panelHtml = `
                    <section class="weekly-section weekly-section-wide weekly-live-log" id="weekly-unified-log">
                        <div class="weekly-section-header">
                            <h4 class="weekly-section-title"><span class="weekly-section-icon">${panelIcon}</span>${escapeHtml(panelTitle)}</h4>
                            <div class="weekly-section-actions">
                                <span class="weekly-section-meta" id="weekly-unified-panel-meta">${escapeHtml(panelMeta)}</span>
                                <button class="weekly-share-btn" type="button" id="weekly-share-btn" aria-label="Copy link to this week">Share</button>
                            </div>
                        </div>
                        ${panelMainHtml}
                    </section>
                    <details class="weekly-more weekly-this-week-details" id="weekly-unified-week-details">
                        <summary>${escapeHtml(detailsSummary)}</summary>
                        <div class="weekly-this-week-details-extra">
                            ${detailsBodyHtml}
                        </div>
                    </details>
                `;

                return {
                    topHeaderTitle,
                    topHeaderIcon,
                    topHeaderDateRange,
                    topHeaderSourceNote,
                    panelHtml,
                    weekKey: item && item.weekKey ? String(item.weekKey) : ''
                };
            };

            const headerPrevBtnUnified = document.getElementById('prev-week-btn');
            const headerNextBtnUnified = document.getElementById('next-week-btn');
            const unifiedHistoryShellEl = document.getElementById('weekly-unified-history-shell');

            const animateContentUnified = (direction) => {
                container.classList.remove('slide-left', 'slide-right');
                void container.offsetWidth;
                container.classList.add(direction === 'left' ? 'slide-left' : 'slide-right');
                window.setTimeout(() => container.classList.remove('slide-left', 'slide-right'), 420);
            };

            if (unifiedWeeklyHistory.length && unifiedHistoryShellEl) {
                let currentHistoryIndex = Math.max(0, Math.min(selectedUnifiedHistoryIndex, unifiedWeeklyHistory.length - 1));

                const setHeaderNavControls = () => {
                    if (headerPrevBtnUnified) headerPrevBtnUnified.disabled = currentHistoryIndex >= (unifiedWeeklyHistory.length - 1);
                    if (headerNextBtnUnified) headerNextBtnUnified.disabled = currentHistoryIndex <= 0;
                };

                const bindShareButtonForHistory = (weekKey) => {
                    const shareBtn = document.getElementById('weekly-share-btn');
                    if (!shareBtn || shareBtn.dataset.bound) return;
                    shareBtn.dataset.bound = 'true';
                    const originalLabel = shareBtn.textContent || 'Share';

                    shareBtn.addEventListener('click', async () => {
                        const url = new URL(window.location.href);
                        url.hash = weekKey ? `week=${weekKey}` : 'updates';
                        const shareUrl = url.toString();
                        let copied = false;

                        try {
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                await navigator.clipboard.writeText(shareUrl);
                                copied = true;
                            }
                        } catch (_) {
                            copied = false;
                        }

                        if (!copied) {
                            window.prompt('Copy this link:', shareUrl);
                        }

                        shareBtn.textContent = copied ? 'Copied!' : 'Copy link';
                        window.setTimeout(() => {
                            shareBtn.textContent = originalLabel;
                        }, 1200);
                    });
                };

                const renderUnifiedHistoryAt = (index, direction) => {
                    const safeIndex = Math.max(0, Math.min(Number(index) || 0, unifiedWeeklyHistory.length - 1));
                    currentHistoryIndex = safeIndex;
                    const item = unifiedWeeklyHistory[safeIndex];
                    const view = buildUnifiedWeekViewModel(item, safeIndex, unifiedWeeklyHistory.length);

                    if (unifiedHistoryShellEl) unifiedHistoryShellEl.setAttribute('aria-busy', 'true');

                    if (titleEl) titleEl.textContent = view.topHeaderTitle;
                    if (iconEl) iconEl.textContent = view.topHeaderIcon;
                    if (dateRangeEl) dateRangeEl.textContent = view.topHeaderDateRange;
                    if (sourceNoteEl) sourceNoteEl.textContent = view.topHeaderSourceNote;

                    unifiedHistoryShellEl.innerHTML = view.panelHtml;

                    try {
                        if (view.weekKey) {
                            window.localStorage.setItem('atrak_weekly_history_key', view.weekKey);
                            window.history.replaceState(null, '', `#week=${view.weekKey}`);
                        }
                    } catch (_) {
                        // ignore storage / history errors
                    }

                    bindShareButtonForHistory(view.weekKey);
                    setHeaderNavControls();
                    if (direction) animateContentUnified(direction);
                    if (unifiedHistoryShellEl) {
                        unifiedHistoryShellEl.setAttribute('aria-busy', 'false');
                        unifiedHistoryShellEl.setAttribute('aria-label', `Weekly log history content: ${view.topHeaderTitle} (${view.topHeaderDateRange})`);
                    }
                };

                if (headerPrevBtnUnified && !headerPrevBtnUnified.dataset.weeklyHistoryBound) {
                    headerPrevBtnUnified.dataset.weeklyHistoryBound = 'true';
                    headerPrevBtnUnified.addEventListener('click', () => {
                        renderUnifiedHistoryAt(currentHistoryIndex + 1, 'left');
                    });
                }
                if (headerNextBtnUnified && !headerNextBtnUnified.dataset.weeklyHistoryBound) {
                    headerNextBtnUnified.dataset.weeklyHistoryBound = 'true';
                    headerNextBtnUnified.addEventListener('click', () => {
                        renderUnifiedHistoryAt(currentHistoryIndex - 1, 'right');
                    });
                }

                renderUnifiedHistoryAt(currentHistoryIndex, '');

                if (requestedWeekKey && requestedHistoryIndex >= 0) {
                    const weeklyCard = document.getElementById('weekly-highlights');
                    if (weeklyCard) {
                        window.setTimeout(() => {
                            weeklyCard.scrollIntoView({
                                behavior: (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
                                    ? 'auto'
                                    : 'smooth',
                                block: 'start'
                            });
                        }, 120);
                    }
                }
            } else {
                if (headerPrevBtnUnified) headerPrevBtnUnified.disabled = true;
                if (headerNextBtnUnified) headerNextBtnUnified.disabled = true;
                if (unifiedHistoryShellEl) {
                    unifiedHistoryShellEl.innerHTML = '<div class="weekly-empty">No weekly history available yet.</div>';
                }
            }

            return;
	    } catch (e) {
	        console.error('Failed to render weekly highlights', e);
	        container.innerHTML = '<div class="weekly-empty">Unable to load highlights.</div>';
	    }
}

// ============================================
// LIVE ACTIVITY FEED
// ============================================

/**
 * Get relative time string
 */
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Create HTML for a live activity item
 */
function createLiveActivityItem(repo) {
    const displayName = formatDisplayName(repo.name);
    const timeAgo = getTimeAgo(new Date(repo.pushed_at));
    const icon = repo.language === 'TypeScript' ? '📘' : 
                 repo.language === 'Python' ? '🐍' :
                 repo.language === 'JavaScript' ? '📙' :
                 repo.language === 'Jupyter Notebook' ? '📓' : '📦';
    
    return `
        <div class="live-item">
            <span class="live-item-icon">${icon}</span>
            <div class="live-item-content">
                <div class="live-item-title">
                    <a href="${repo.html_url}" target="_blank" rel="noopener">${displayName}</a>
                </div>
                <div class="live-item-meta">
                    <span class="live-item-time">Updated ${timeAgo}</span>
                    ${repo.language ? `
                        <span class="live-item-lang">
                            <span class="lang-dot" data-lang="${repo.language}"></span>
                            ${repo.language}
                        </span>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the live activity feed from cached repo data
 */
async function renderLiveActivity() {
    const feedEl = document.getElementById('live-activity-feed');
    const syncEl = document.getElementById('timeline-sync-status');
    
    if (!feedEl) return;
    
    try {
        // Load cached repos
        const repos = await loadCachedData();
        const meta = await loadCachedMeta();
        
        if (!repos || repos.length === 0) {
            feedEl.innerHTML = '<div class="live-activity-empty">No activity data available</div>';
            if (syncEl) syncEl.textContent = 'Unable to load';
            return;
        }
        
        // Sort by pushed_at (most recent first) and take top 5
        const recentRepos = repos
            .filter(r => r.pushed_at)
            .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
            .slice(0, 5);
        
        if (recentRepos.length === 0) {
            feedEl.innerHTML = '<div class="live-activity-empty">No recent activity</div>';
        } else {
            feedEl.innerHTML = recentRepos.map(createLiveActivityItem).join('');
        }
        
        // Update sync status
        if (syncEl && meta && meta.updatedAt) {
            const syncTime = getTimeAgo(new Date(meta.updatedAt));
            syncEl.textContent = `Synced ${syncTime} • ${meta.repoCount || repos.length} repos tracked`;
        } else if (syncEl) {
            syncEl.textContent = `${repos.length} repos tracked`;
        }
        
    } catch (error) {
        console.error('Failed to render live activity:', error);
        feedEl.innerHTML = '<div class="live-activity-empty">Failed to load activity</div>';
    }
}

// ============================================
// PROJECT ANALYTICS (UPDATES SECTION)
// ============================================

async function renderProjectAnalytics() {
    const gridEl = document.getElementById('project-analytics-grid');
    const metaEl = document.getElementById('project-analytics-meta');
    if (!gridEl) return;

    try {
        const [repos, meta, weekly] = await Promise.all([
            loadCachedData(),
            loadCachedMeta(),
            loadCachedWeeklyStats()
        ]);

        const repoList = Array.isArray(repos) ? repos : [];
        const repoCount = meta && typeof meta.repoCount === 'number' ? meta.repoCount : repoList.length;
        const totalStars = meta && typeof meta.totalStars === 'number'
            ? meta.totalStars
            : repoList.reduce((sum, r) => sum + (Number(r.stargazers_count) || 0), 0);
        const totalForks = meta && typeof meta.totalForks === 'number'
            ? meta.totalForks
            : repoList.reduce((sum, r) => sum + (Number(r.forks_count) || 0), 0);

        const mostRecentPush = (meta && meta.mostRecentPush)
            ? new Date(meta.mostRecentPush)
            : repoList.reduce((latest, r) => {
                if (!r.pushed_at) return latest;
                const date = new Date(r.pushed_at);
                if (!latest || date > latest) return date;
                return latest;
            }, null);

        const languageCounts = repoList.reduce((acc, r) => {
            if (r.language) acc[r.language] = (acc[r.language] || 0) + 1;
            return acc;
        }, {});
        const topLang = Object.entries(languageCounts).sort((a, b) => b[1] - a[1])[0];

        const weeklyCommits = weekly && typeof weekly.totalCommitContributions === 'number'
            ? weekly.totalCommitContributions
            : null;
        const weeklySourceText = weeklyCommits != null ? getWeeklyStatsSourceText(weekly) : '';

        const cards = [
            { label: 'Repos tracked', value: repoCount },
            { label: 'Total stars', value: totalStars },
            { label: 'Total forks', value: totalForks },
            { label: 'Commits (7d)', value: weeklyCommits != null ? weeklyCommits : '—', note: weeklySourceText },
            { label: 'Top language', value: topLang ? topLang[0] : '—' },
            { label: 'Last push', value: mostRecentPush ? getTimeAgo(mostRecentPush) : '—' }
        ];

        gridEl.innerHTML = cards.map(card => `
            <div class="project-analytics-card">
                <div class="project-analytics-value">${escapeHtml(card.value)}</div>
                <div class="project-analytics-label">${escapeHtml(card.label)}</div>
                ${card.note ? `<div class="project-analytics-note">${escapeHtml(card.note)}</div>` : ''}
            </div>
        `).join('');

        if (metaEl) {
            metaEl.textContent = meta && meta.updatedAt
                ? `Synced ${getTimeAgo(new Date(meta.updatedAt))} • ${repoCount} repos${weeklySourceText ? ` • Weekly: ${weeklySourceText}` : ''}`
                : 'Tracking GitHub activity and repos.';
        }
    } catch (error) {
        console.error('Failed to render project analytics:', error);
        gridEl.innerHTML = '<div class="project-analytics-loading">Unable to load analytics right now.</div>';
        if (metaEl) metaEl.textContent = 'Analytics unavailable.';
    }
}

// ============================================
// RELEASES FEED (CACHED FROM GITHUB ACTIONS)
// ============================================

function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    const value = n / (1024 ** idx);
    return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatLongDate(isoString) {
    try {
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (_) {
        return '';
    }
}

function getReleaseSourceLabel(source) {
    const normalized = String(source || '').trim().toLowerCase();
    if (normalized === 'atrak-download') return 'Atrak download';
    if (normalized === 'github-release') return 'GitHub release';
    return 'Release';
}

function getMonthKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function formatMonthLabel(monthKey) {
    const m = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
    if (!m) return monthKey;
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
    try {
        return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch (_) {
        return monthKey;
    }
}

async function renderReleasesFeed() {
    const listEl = document.getElementById('releases-live-list');
    const controlsEl = document.getElementById('releases-live-controls');
    const metaEl = document.getElementById('releases-live-meta');

    if (!listEl || !controlsEl) return;

    listEl.innerHTML = '<div class="releases-live-empty">Loading releases…</div>';

    const [rawReleases, meta] = await Promise.all([
        loadCachedReleases(),
        loadCachedMeta()
    ]);
    const cacheUpdatedAt = meta && typeof meta.updatedAt === 'string' ? new Date(meta.updatedAt) : null;

    const releases = Array.isArray(rawReleases) ? rawReleases : [];
    if (!releases.length) {
        listEl.innerHTML = '<div class="releases-live-empty">No cached releases yet.</div>';
        if (metaEl) {
            metaEl.textContent = getGitHubCacheSource(meta) === 'local-git-refresh'
                ? 'Local repo snapshot does not include GitHub release metadata.'
                : 'Set up GitHub Actions caching to populate this feed.';
        }
        renderContentFreshnessStrip('releases-freshness-strip', {
            kind: 'Release notes',
            updatedAt: cacheUpdatedAt,
            thresholds: { freshDays: 3, agingDays: 10 },
            note: 'Waiting for cached GitHub releases'
        });
        return;
    }

    const normalized = releases
        .filter(r => r && typeof r === 'object')
        .filter(r => !r.draft)
        .map(r => {
            const publishedRaw = typeof r.published_at === 'string' ? r.published_at : '';
            const publishedAt = publishedRaw ? new Date(publishedRaw) : null;
            const repoFull = typeof r.repo === 'string' ? r.repo : '';
            const repoShort = repoFull ? (repoFull.split('/')[1] || repoFull) : 'repo';
            const url = safeExternalUrl(r.url);
            const repoUrl = safeExternalUrl(repoFull ? `https://github.com/${repoFull}` : '');
            const monthKey = publishedAt && !Number.isNaN(publishedAt.getTime()) ? getMonthKey(publishedAt) : '';

            const assetsRaw = Array.isArray(r.assets) ? r.assets : [];
            const assets = assetsRaw
                .filter(a => a && typeof a === 'object')
                .map(a => ({
                    name: typeof a.name === 'string' ? a.name : '',
                    downloadUrl: safeExternalUrl(a.download_url),
                    size: Number(a.size) || 0,
                    downloads: Number(a.download_count) || 0,
                }))
                .filter(a => a.name && a.downloadUrl !== '#')
                .slice(0, 6);

            return {
                repoFull,
                repoShort,
                name: typeof r.name === 'string' ? r.name : '',
                tag: typeof r.tag === 'string' ? r.tag : '',
                url,
                repoUrl,
                publishedAt,
                monthKey,
                prerelease: Boolean(r.prerelease),
                source: typeof r.source === 'string' ? r.source : 'github-release',
                zipballUrl: safeExternalUrl(typeof r.zipball_url === 'string' ? r.zipball_url : ''),
                tarballUrl: safeExternalUrl(typeof r.tarball_url === 'string' ? r.tarball_url : ''),
                assets,
            };
        })
        .filter(r => r.url !== '#')
        .sort((a, b) => {
            const da = a.publishedAt ? a.publishedAt.getTime() : 0;
            const db = b.publishedAt ? b.publishedAt.getTime() : 0;
            return db - da;
        });

    const months = Array.from(new Set(normalized.map(r => r.monthKey).filter(Boolean)));
    const repos = Array.from(new Set(normalized.map(r => r.repoShort).filter(Boolean))).sort((a, b) => a.localeCompare(b));

    const currentMonthKey = getMonthKey(new Date());
    let selectedMonth = months.includes(currentMonthKey) ? currentMonthKey : (months[0] || '');
    let selectedRepo = '';

    const renderControls = () => {
        const monthOptions = [
            `<option value="">All months</option>`,
            ...months.map(mk => `<option value="${escapeHtml(mk)}" ${mk === selectedMonth ? 'selected' : ''}>${escapeHtml(formatMonthLabel(mk))}</option>`)
        ].join('');

        const repoOptions = [
            `<option value="">All projects</option>`,
            ...repos.map(repo => `<option value="${escapeHtml(repo)}" ${repo === selectedRepo ? 'selected' : ''}>${escapeHtml(formatDisplayName(repo))}</option>`)
        ].join('');

        controlsEl.innerHTML = `
            <div class="releases-filter">
                <label for="releases-month">Month</label>
                <select id="releases-month">${monthOptions}</select>
            </div>
            <div class="releases-filter">
                <label for="releases-project">Project</label>
                <select id="releases-project">${repoOptions}</select>
            </div>
        `;

        const monthEl = document.getElementById('releases-month');
        const projectEl = document.getElementById('releases-project');

        if (monthEl) {
            monthEl.addEventListener('change', () => {
                selectedMonth = String(monthEl.value || '');
                renderList();
            });
        }

        if (projectEl) {
            projectEl.addEventListener('change', () => {
                selectedRepo = String(projectEl.value || '');
                renderList();
            });
        }
    };

    const renderList = () => {
        const filtered = normalized
            .filter(r => !selectedMonth || r.monthKey === selectedMonth)
            .filter(r => !selectedRepo || r.repoShort === selectedRepo);

        const maxItems = 20;
        const shown = filtered.slice(0, maxItems);

        if (!shown.length) {
            listEl.innerHTML = '<div class="releases-live-empty">No releases match those filters.</div>';
            return;
        }

        const cards = shown.map(rel => {
            const dateLabel = rel.publishedAt ? formatLongDate(rel.publishedAt.toISOString()) : '';
            const title = rel.name || rel.tag || 'Release';
            const badges = [
                `<span class="releases-live-badge source">${escapeHtml(getReleaseSourceLabel(rel.source))}</span>`,
                rel.prerelease ? `<span class="releases-live-badge prerelease">Prerelease</span>` : ''
            ].filter(Boolean).join('');

            const assetsHtml = rel.assets.length
                ? `
                    <div class="releases-live-assets">
                        <div class="releases-live-assets-title">Download assets</div>
                        <ul class="releases-live-assets-list">
                            ${rel.assets.map(a => `
                                <li class="releases-live-assets-item">
                                    <a href="${a.downloadUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.name)}</a>
                                    <span class="releases-live-assets-meta">${escapeHtml(formatBytes(a.size))}${a.downloads ? ` • ${escapeHtml(a.downloads)} dl` : ''}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `
                : `
                    <div class="releases-live-assets">
                        <div class="releases-live-assets-title">Downloads</div>
                        <div class="releases-live-empty">No release assets uploaded — source only.</div>
                    </div>
                `;

            const sourceLinks = [
                rel.zipballUrl !== '#' ? `<a class="btn btn-secondary btn-sm" href="${rel.zipballUrl}" target="_blank" rel="noopener noreferrer">Source (zip)</a>` : '',
                rel.tarballUrl !== '#' ? `<a class="btn btn-secondary btn-sm" href="${rel.tarballUrl}" target="_blank" rel="noopener noreferrer">Source (tar)</a>` : '',
            ].filter(Boolean).join('');

            return `
                <article class="releases-live-item">
                    <div class="releases-live-item-header">
                        <div>
                            <div class="releases-live-repo">${escapeHtml(formatDisplayName(rel.repoShort))}</div>
                            <div class="releases-live-name">${escapeHtml(title)}</div>
                            <div class="releases-live-tag">
                                ${rel.tag ? `<code>${escapeHtml(rel.tag)}</code>` : ''}
                                <span class="releases-live-badges">${badges}</span>
                            </div>
                        </div>
                        <div class="releases-live-date">${escapeHtml(dateLabel)}</div>
                    </div>

                    <div class="releases-live-actions">
                        <a class="btn btn-primary btn-sm" href="${rel.url}" target="_blank" rel="noopener noreferrer">View</a>
                        ${rel.repoUrl !== '#' ? `<a class="btn btn-secondary btn-sm" href="${rel.repoUrl}" target="_blank" rel="noopener noreferrer">Repo</a>` : ''}
                        ${sourceLinks}
                    </div>
                    ${assetsHtml}
                </article>
            `;
        }).join('');

        const truncated = filtered.length > maxItems
            ? `<div class="releases-live-empty">Showing ${escapeHtml(maxItems)} of ${escapeHtml(filtered.length)} releases. Narrow filters to see more.</div>`
            : '';

        listEl.innerHTML = cards + truncated;
    };

    if (metaEl) {
        metaEl.textContent = meta && meta.updatedAt ? `${getGitHubCacheSourceText(meta)} • Updated ${formatUTCDateTime(meta.updatedAt)}` : 'GitHub release cache';
    }

    renderContentFreshnessStrip('releases-freshness-strip', {
        kind: 'Release feed',
        updatedAt: cacheUpdatedAt,
        latestPublishedAt: normalized[0] && normalized[0].publishedAt ? normalized[0].publishedAt : null,
        latestLabel: 'Latest release',
        totalCount: normalized.length,
        countLabel: 'cached releases',
        thresholds: { freshDays: 3, agingDays: 10 },
        note: meta ? getGitHubCacheSourceText(meta) : 'GitHub cache-backed'
    });

    renderControls();
    renderList();
}

// Export functions for use in other scripts
window.GitHubProjects = {
    renderMoreProjects,
    renderLiveActivity,
    renderProjectAnalytics,
    renderWeeklyHighlights,
    renderReleasesFeed,
    getProjectDetails,
    fetchGitHubRepositories,
    getTechStack,
    formatDate,
    formatDisplayName,
    getTimeAgo,
    GITHUB_USERNAME
};

// Load sync status on page load (even if More Projects tab is hidden)
async function loadSyncStatus() {
    try {
        const meta = await loadCachedMeta();
        if (meta && meta.updatedAt) {
            setFooterSyncStatus(`GitHub data synced • ${formatUTCDateTime(meta.updatedAt)}`);
        }
    } catch (e) {
        // Ignore errors loading sync status
    }
}

// Auto-initialize
function initGitHubFeatures() {
    const schedule = (fn) => {
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            window.requestIdleCallback(() => fn(), { timeout: 1200 });
        } else {
            setTimeout(fn, 0);
        }
    };

    // Always load sync status (cheap)
    loadSyncStatus();
    
    // Defer heavier rendering to idle time so core interactions feel instant
    schedule(renderLiveActivity);
    schedule(renderWeeklyHighlights);
    schedule(renderReleasesFeed);
    schedule(renderProjectAnalytics);
    
    // Auto-load GitHub projects into the unified project slider when present
    const projectSliderTrack = document.getElementById('project-slider-track');
    if (projectSliderTrack) {
        schedule(renderMoreProjects);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGitHubFeatures);
} else {
    initGitHubFeatures();
}

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

const GITHUB_CACHE_VERSION = '20260727a';
const FRESH_GITHUB_CACHE_FETCH = { cache: 'no-store' };
const withCacheVersion = (url) => `${url}${url.includes('?') ? '&' : '?'}v=${GITHUB_CACHE_VERSION}`;
const CACHED_REPOS_BASE_PATH = SITE_BASE_URL ? `${SITE_BASE_URL}data/github-repos.json` : 'data/github-repos.json'; // Updated by GitHub Actions
const CACHED_DATA_PATH = withCacheVersion(CACHED_REPOS_BASE_PATH);
const CACHED_EVENTS_PATH = withCacheVersion(SITE_BASE_URL ? `${SITE_BASE_URL}data/github-events.json` : 'data/github-events.json'); // Updated by GitHub Actions
const CACHED_META_PATH = withCacheVersion(SITE_BASE_URL ? `${SITE_BASE_URL}data/github-meta.json` : 'data/github-meta.json'); // Updated by GitHub Actions
const CACHED_RELEASES_PATH = withCacheVersion(SITE_BASE_URL ? `${SITE_BASE_URL}data/github-releases.json` : 'data/github-releases.json'); // Updated by GitHub Actions
const CACHED_WEEKLY_PATH = withCacheVersion(SITE_BASE_URL ? `${SITE_BASE_URL}data/github-weekly.json` : 'data/github-weekly.json'); // Updated by GitHub Actions
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

/**
 * Try to load pre-cached data from GitHub Actions
 */
async function loadCachedData() {
    try {
        const response = await fetch(CACHED_DATA_PATH, FRESH_GITHUB_CACHE_FETCH);
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
        const response = await fetch(CACHED_META_PATH, FRESH_GITHUB_CACHE_FETCH);
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
        const response = await fetch(CACHED_RELEASES_PATH, FRESH_GITHUB_CACHE_FETCH);
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
        const response = await fetch(CACHED_WEEKLY_PATH, FRESH_GITHUB_CACHE_FETCH);
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

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
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
    if (!container) return;

    if (window.AtrakWeeklyLog && typeof window.AtrakWeeklyLog.render === 'function') {
        await window.AtrakWeeklyLog.render();
        return;
    }

    container.innerHTML = `
        <div class="weekly-briefing__error">
            <strong>The weekly briefing module is unavailable.</strong>
            <p>The full release archive is still available.</p>
            <a href="releases.html" aria-label="Open releases">Open releases</a>
        </div>
    `;
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

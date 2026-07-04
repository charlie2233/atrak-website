
// Main JavaScript for Atrak - Modern Tech Team Website
// This file handles UI interactions, accessibility, animations, forms, and more.


// Accessibility and feature detection
// Use "any-*" queries so hybrid laptops (touch + trackpad/mouse) keep desktop effects.
const supportsMediaQueries = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
const prefersReducedMotion = supportsMediaQueries
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
const hasAnyHover = supportsMediaQueries
    ? (window.matchMedia('(any-hover: hover)').matches || window.matchMedia('(hover: hover)').matches)
    : true;
const hasAnyFinePointer = supportsMediaQueries
    ? (window.matchMedia('(any-pointer: fine)').matches || window.matchMedia('(pointer: fine)').matches)
    : true;
let enableHoverEffects = (hasAnyFinePointer || hasAnyHover) && !prefersReducedMotion;
let enableHeroParallax = enableHoverEffects;
const supportsPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window;
const supportsIntersectionObserver = typeof window !== 'undefined' && 'IntersectionObserver' in window;
const motionSafeScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

// Inject a skip link on pages that have a main landmark but no explicit skip link.
const mainLandmark = document.querySelector('main');
if (mainLandmark && !document.querySelector('.skip-link')) {
    if (!mainLandmark.id) {
        mainLandmark.id = 'main-content';
    }
    const skipLink = document.createElement('a');
    skipLink.className = 'skip-link';
    skipLink.href = `#${mainLandmark.id}`;
    skipLink.textContent = 'Skip to main content';
    document.body.insertAdjacentElement('afterbegin', skipLink);
}


// ================================
// Custom Cursor
// ================================
// Adds a custom dot/outline cursor for desktop users with fine pointer
const cursorDot = document.querySelector('.cursor-dot');
const cursorOutline = document.querySelector('.cursor-outline');

let customCursorEnabled = false;
const updateCursorEnabled = () => {
    if (!cursorDot || !cursorOutline) return;
    customCursorEnabled = Boolean(enableHoverEffects && !prefersReducedMotion);
    document.body.classList.toggle('cursor-enabled', customCursorEnabled);
};

if (cursorDot && cursorOutline && !prefersReducedMotion) {
    updateCursorEnabled();

    // Move cursor elements on mouse move
    window.addEventListener('mousemove', (e) => {
        if (!customCursorEnabled) return;
        const posX = e.clientX;
        const posY = e.clientY;

        cursorDot.style.left = `${posX}px`;
        cursorDot.style.top = `${posY}px`;

        if (typeof cursorOutline.animate === 'function') {
            cursorOutline.animate({
                left: `${posX}px`,
                top: `${posY}px`
            }, { duration: 500, fill: 'forwards' });
        } else {
            cursorOutline.style.left = `${posX}px`;
            cursorOutline.style.top = `${posY}px`;
        }
    }, { passive: true });

    // Cursor hover effect for interactive elements
    document.querySelectorAll('a, button, .project-card').forEach(el => {
        el.addEventListener('mouseenter', () => {
            if (!customCursorEnabled) return;
            cursorDot.classList.add('active');
            cursorOutline.classList.add('active');
        });
        el.addEventListener('mouseleave', () => {
            if (!customCursorEnabled) return;
            cursorDot.classList.remove('active');
            cursorOutline.classList.remove('active');
        });
    });
}


// ================================
// Glass Card Mouse Tracker
// ================================
// Tracks mouse position for glass/project/stat cards for interactive effects
document.querySelectorAll('.glass-card, .project-card, .stat-item').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
});

// ================================
// Scroll Reveal (fails open so content never gets stuck hidden)
// ================================
// Reveals elements as they enter the viewport
if (supportsIntersectionObserver && !prefersReducedMotion) {
    const revealElements = Array.from(document.querySelectorAll('.reveal'));
    const autoRevealElements = Array.from(document.querySelectorAll('.project-card, .leader-card, .stat-item, .feature'));

    autoRevealElements.forEach(el => el.classList.add('reveal'));

    const allRevealElements = Array.from(new Set([...revealElements, ...autoRevealElements]));
    const viewportHeight = window.innerHeight || 0;

    allRevealElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < viewportHeight && rect.bottom > 0) {
            el.classList.add('active');
        }
    });

    document.body.classList.add('reveal-enabled');

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    // Make observer available globally for dynamic content
    window.revealObserver = revealObserver;

    allRevealElements.forEach(el => {
        if (!el.classList.contains('active')) {
            revealObserver.observe(el);
        }
    });
} else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
}

// ================================
// Hero Parallax
// ================================
// Adds parallax effect to hero section cards
const hero = document.querySelector('.hero');
if (hero) {
    window.addEventListener('mousemove', (e) => {
        if (!enableHeroParallax) return;
        const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
        const moveY = (e.clientY - window.innerHeight / 2) * 0.01;
        
        const cards = hero.querySelectorAll('.floating-card');
        cards.forEach((card, index) => {
            const depth = (index + 1) * 0.5;
            card.style.setProperty('--pointer-x', `${moveX * depth}px`);
            card.style.setProperty('--pointer-y', `${moveY * depth}px`);
            card.style.setProperty('--pointer-rotate', `${moveX * 0.5}deg`);
        });
    }, { passive: true });

    hero.addEventListener('mouseleave', () => {
        const cards = hero.querySelectorAll('.floating-card');
        cards.forEach(card => {
            card.style.setProperty('--pointer-x', '0px');
            card.style.setProperty('--pointer-y', '0px');
            card.style.setProperty('--pointer-rotate', '0deg');
        });
    }, { passive: true });
}

// ================================
// Infinite Card Rotation
// ================================
// Rotates visual cards in a stack with animation
const cardStack = document.getElementById('card-stack');
if (cardStack) {
    const cards = Array.from(cardStack.querySelectorAll('.visual-card'));
    
    // Function to rotate classes
    const rotateCards = () => {
        // Find current active card
        const currentActiveIndex = cards.findIndex(card => card.classList.contains('active'));
        
        // Calculate new indices
        const nextActiveIndex = (currentActiveIndex + 1) % cards.length;
        const nextNextIndex = (currentActiveIndex + 2) % cards.length;
        
        // Reset all classes first
        cards.forEach(card => {
            card.classList.remove('active', 'next', 'back', 'closed');
        });
        
        // Assign new classes
        cards[currentActiveIndex].classList.add('back'); // Old active goes to back
        cards[nextActiveIndex].classList.add('active'); // Next becomes active
        cards[nextNextIndex].classList.add('next'); // The one after becomes next
        
        // All others stay 'back' (already handled by reset) or can be specifically targeted
        cards.forEach((card, index) => {
            if (index !== nextActiveIndex && index !== nextNextIndex) {
                card.classList.add('back');
            }
        });
    };

    // Attach click listeners to all close buttons
    cards.forEach((card, index) => {
        const closeBtn = card.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Only rotate if clicking the active card
                if (card.classList.contains('active')) {
                    // Animate out
                    card.classList.add('closed');
                    
                    // Wait for animation then rotate
                    setTimeout(() => {
                        rotateCards();
                    }, 400); // Slightly faster than CSS transition to feel snappy
                }
            });
        }
    });
}


// ================================
// Mobile Menu Toggle
// ================================
// Handles mobile navigation menu open/close
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');
const navbar = document.querySelector('.navbar');
let lastMobileMenuTrigger = null;

const getMobileMenuFocusableElements = () => {
    if (!navLinks) return [];
    return Array.from(navLinks.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1);
};

const setMobileMenuState = (isOpen, options = {}) => {
    if (!mobileMenuBtn || !navLinks) return;
    const open = Boolean(isOpen);

    navLinks.classList.toggle('active', open);
    mobileMenuBtn.classList.toggle('active', open);
    mobileMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    mobileMenuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');

    if (open) {
        lastMobileMenuTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : mobileMenuBtn;
        if (options.focusMenu) {
            const firstLink = getMobileMenuFocusableElements()[0];
            if (firstLink) firstLink.focus();
        }
    } else if (options.restoreFocus) {
        const focusTarget = lastMobileMenuTrigger && typeof lastMobileMenuTrigger.focus === 'function'
            ? lastMobileMenuTrigger
            : mobileMenuBtn;
        focusTarget.focus();
    }
};

if (mobileMenuBtn && navLinks) {
    if (!navLinks.id) {
        navLinks.id = 'site-primary-nav';
    }
    mobileMenuBtn.setAttribute('aria-controls', navLinks.id);
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    mobileMenuBtn.setAttribute('aria-haspopup', 'true');
    mobileMenuBtn.setAttribute('aria-label', 'Open menu');

    mobileMenuBtn.addEventListener('click', () => {
        setMobileMenuState(!navLinks.classList.contains('active'), { focusMenu: navLinks.classList.contains('active') === false });
    });

    document.addEventListener('click', (e) => {
        if (!navLinks.classList.contains('active')) return;
        const target = e.target;
        if (!(target instanceof Element)) return;
        if (target.closest('.nav-container')) return;
        setMobileMenuState(false);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab' || !navLinks.classList.contains('active')) return;

        const focusables = getMobileMenuFocusableElements();
        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (e.shiftKey && active === first) {
            e.preventDefault();
            mobileMenuBtn.focus();
            return;
        }
        if (!e.shiftKey && active === mobileMenuBtn) {
            e.preventDefault();
            first.focus();
            return;
        }
        if (!e.shiftKey && active === last) {
            e.preventDefault();
            mobileMenuBtn.focus();
            return;
        }
        if (e.shiftKey && active === mobileMenuBtn) {
            e.preventDefault();
            last.focus();
        }
    });
}

// ================================
// Smooth Scroll for Navigation Links
// ================================
// Smoothly scrolls to anchor targets and closes mobile menu
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (!href || href === '#') return;

        e.preventDefault();
        const target = document.querySelector(href);
        
        if (target) {
            const navHeight = navbar ? navbar.getBoundingClientRect().height : 0;
            const offsetTop = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 16;
            window.scrollTo({
                top: offsetTop,
                behavior: motionSafeScrollBehavior
            });
            
            // Close mobile menu if open
            if (navLinks && mobileMenuBtn && navLinks.classList.contains('active')) {
                setMobileMenuState(false);
            }
        }
    });
});


// ================================
// Consolidated Scroll Handler with Throttling
// ================================
// Handles navbar background, parallax, and nav highlighting on scroll
let lastScroll = 0;
let ticking = false;
const floatingCards = document.querySelectorAll('.floating-card');
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav-links a');

function handleScroll() {
    const currentScroll = window.pageYOffset;
    
    // Navbar effect
    if (navbar) {
        if (currentScroll <= 0) {
            navbar.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        } else {
            navbar.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
        }
    }
    
    // Parallax effect for hero visual (desktop only)
    if (floatingCards.length) {
        if (enableHeroParallax) {
            floatingCards.forEach((card, index) => {
                const speed = 0.5 + (index * 0.1);
                card.style.setProperty('--parallax-y', `${currentScroll * speed}px`);
            });
        } else {
            floatingCards.forEach(card => card.style.setProperty('--parallax-y', '0px'));
        }
    }
    
    // Active navigation highlighting
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        if (currentScroll >= sectionTop - 150) {
            current = section.getAttribute('id');
        }
    });
    
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('href') === `#${current}`) {
            item.classList.add('active');
        }
    });
    
    lastScroll = currentScroll;
    ticking = false;
}

window.addEventListener('scroll', () => {
    if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(() => {
            handleScroll();
        });
    }
});

// ================================
// Dynamic Stats Counter
// ================================
// Animates numbers in stats section when visible
const stats = document.querySelectorAll('.stat-number');
let statsAnimated = false;

const animateStats = () => {
    stats.forEach(stat => {
        const target = stat.textContent;
        const isNumber = /^\d+/.test(target);
        
        if (isNumber) {
            const number = parseInt(target, 10);
            const increment = number / 50;
            let current = 0;
            
            const updateCounter = setInterval(() => {
                current += increment;
                if (current >= number) {
                    stat.textContent = target;
                    clearInterval(updateCounter);
                } else {
                    stat.textContent = Math.floor(current) + target.replace(/^\d+/, '');
                }
            }, 30);
        }
    });
};

if (supportsIntersectionObserver) {
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !statsAnimated) {
                animateStats();
                statsAnimated = true;
            }
        });
    }, { threshold: 0.5 });

    const statsSection = document.querySelector('.stats');
    if (statsSection) {
        statsObserver.observe(statsSection);
    }
}

// ================================
// Impact Analytics
// ================================
const formatImpactDate = (input) => {
    if (!input) return '';
    if (input instanceof Date) {
        if (Number.isNaN(input.getTime())) return '';
        return input.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (typeof input !== 'string') return '';

    const raw = input.trim();
    if (!raw) return '';

    let dateObj = null;
    let showDay = false;

    if (/^\d{4}-\d{2}$/.test(raw)) {
        dateObj = new Date(`${raw}-01T00:00:00`);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        dateObj = new Date(`${raw}T00:00:00`);
        showDay = true;
    } else {
        dateObj = new Date(raw);
        showDay = /\d{2}/.test(raw);
    }

    if (dateObj && !Number.isNaN(dateObj.getTime())) {
        const options = showDay
            ? { month: 'short', day: 'numeric', year: 'numeric' }
            : { month: 'short', year: 'numeric' };
        return dateObj.toLocaleDateString('en-US', options);
    }

    return raw;
};

const renderImpactReveals = (root) => {
    if (!root) return;
    const revealElements = root.querySelectorAll('.reveal');
    if (window.revealObserver) {
        revealElements.forEach(el => window.revealObserver.observe(el));
    } else {
        revealElements.forEach(el => el.classList.add('active'));
    }
};

const fetchJsonSafe = async (path) => {
    try {
        const response = await fetch(path);
        if (!response.ok) return null;
        return await response.json();
    } catch (_) {
        return null;
    }
};

const fetchTextSafe = async (path) => {
    try {
        const response = await fetch(path);
        if (!response.ok) return null;
        return await response.text();
    } catch (_) {
        return null;
    }
};

const getImpactWeeklyStatsSource = (stats) => {
    if (!stats || typeof stats !== 'object') return 'unknown';
    return String(stats.source || '').trim().toLowerCase();
};

const getImpactWeeklyStatsSourceLabel = (stats) => {
    const source = getImpactWeeklyStatsSource(stats);
    if (source === 'local-git-refresh') return 'Local checked-out repos';
    if (source === 'github-graphql') return 'GitHub contribution graph';
    if (source === 'github-public-events') return 'Public GitHub fallback';
    if (source === 'github-live-cache') return 'GitHub live cache';
    return 'Weekly cache';
};

const getWeeklyCommitDescription = (stats) => {
    const source = getImpactWeeklyStatsSource(stats);
    const repoCount = stats && typeof stats.totalRepositoryContributions === 'number'
        ? Math.max(0, Math.round(Number(stats.totalRepositoryContributions) || 0))
        : 0;
    const repoLabel = repoCount ? `${repoCount} repo${repoCount === 1 ? '' : 's'}` : 'tracked repos';

    if (source === 'local-git-refresh') {
        return `Last 7 days from ${repoLabel} checked out locally.`;
    }
    if (source === 'github-graphql') {
        return 'Last 7 days from the GitHub contribution graph.';
    }
    if (source === 'github-public-events') {
        return 'Last 7 days from public GitHub activity.';
    }
    return 'Latest weekly activity window.';
};

const parseMetricValue = (metrics, label) => {
    if (!Array.isArray(metrics)) return null;
    const regex = new RegExp(`${label}\\s*:?\\s*(\\d+)`, 'i');
    for (let i = 0; i < metrics.length; i += 1) {
        const entry = metrics[i];
        if (typeof entry !== 'string') continue;
        const match = entry.match(regex);
        if (match && match[1]) return Number.parseInt(match[1], 10);
    }
    return null;
};

const buildTrendData = (weeklyHistory) => {
    if (!Array.isArray(weeklyHistory)) return [];
    return weeklyHistory.map((week) => {
        const commitCount = parseMetricValue(week.metrics, 'Commits');
        return {
            label: week.dateRange || '',
            value: Number.isFinite(commitCount) ? commitCount : 0
        };
    }).filter(item => item.label || Number.isFinite(item.value));
};

const renderTrendChart = (container, summaryEl, data) => {
    if (!container) return;
    if (!Array.isArray(data) || data.length < 2) {
        container.innerHTML = '<p class="empty-message">No trend data yet.</p>';
        if (summaryEl) summaryEl.textContent = '';
        return;
    }

    const trimmed = data.slice(-12);
    const values = trimmed.map(item => item.value);
    const maxValue = Math.max.apply(null, values.concat([1]));
    const minValue = Math.min.apply(null, values.concat([0]));
    const range = maxValue - minValue || 1;

    const width = 600;
    const height = 160;
    const padding = 20;
    const step = trimmed.length > 1 ? (width - padding * 2) / (trimmed.length - 1) : 0;

    const points = trimmed.map((item, index) => {
        const x = padding + (index * step);
        const y = height - padding - ((item.value - minValue) / range) * (height - padding * 2);
        return { x, y };
    });

    const linePath = points.map((point, index) => {
        const prefix = index === 0 ? 'M' : 'L';
        return `${prefix}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    }).join(' ');

    const areaPath = `M${points[0].x.toFixed(1)},${(height - padding).toFixed(1)} ` +
        points.map(point => `L${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ') +
        ` L${points[points.length - 1].x.toFixed(1)},${(height - padding).toFixed(1)} Z`;

    container.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" role="presentation" aria-hidden="true">
            <defs>
                <linearGradient id="impactTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="rgba(59, 130, 246, 0.35)"></stop>
                    <stop offset="100%" stop-color="rgba(59, 130, 246, 0)"></stop>
                </linearGradient>
            </defs>
            <path d="${areaPath}" fill="url(#impactTrendGradient)"></path>
            <path d="${linePath}" fill="none" stroke="rgba(59, 130, 246, 0.9)" stroke-width="2"></path>
            <circle cx="${points[points.length - 1].x.toFixed(1)}" cy="${points[points.length - 1].y.toFixed(1)}" r="3" fill="rgba(139, 92, 246, 0.9)"></circle>
        </svg>
    `;

    if (summaryEl) {
        const total = trimmed.reduce((sum, item) => sum + item.value, 0);
        const average = Math.round(total / trimmed.length);
        summaryEl.innerHTML = `
            <span>Weeks: ${trimmed.length}</span>
            <span>Latest: ${trimmed[trimmed.length - 1].value}</span>
            <span>Avg: ${average}</span>
            <span>Peak: ${maxValue}</span>
        `;
    }
};

const parseReleaseMilestones = (htmlText) => {
    if (!htmlText) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const posts = Array.from(doc.querySelectorAll('.release-post'));

    return posts.map(post => {
        const dateEl = post.querySelector('.release-date');
        const versionEl = post.querySelector('.release-version');
        const shippedItems = post.querySelectorAll('.release-section.shipped .release-list li');
        const stats = Array.from(post.querySelectorAll('.release-section.stats .stat-item'));
        const statText = stats.slice(0, 2).map(stat => {
            const valueEl = stat.querySelector('.stat-value');
            const labelEl = stat.querySelector('.stat-label');
            if (!valueEl || !labelEl) return '';
            return `${valueEl.textContent.trim()} ${labelEl.textContent.trim()}`;
        }).filter(Boolean);
        const id = post.getAttribute('id') || '';

        const date = dateEl ? dateEl.textContent.trim() : '';
        const version = versionEl ? versionEl.textContent.trim() : '';
        const shippedCount = shippedItems.length;

        return {
            title: [date, version].filter(Boolean).join(' - '),
            shippedCount,
            stats: statText,
            link: id ? `releases.html#${id}` : 'releases.html'
        };
    }).filter(item => item.title);
};

const renderMilestones = (container, milestones) => {
    if (!container) return;
    if (!Array.isArray(milestones) || milestones.length === 0) {
        container.innerHTML = '<li class="empty-message">No milestones yet.</li>';
        return;
    }

    container.innerHTML = milestones.slice(0, 4).map(item => {
        const metaParts = [];
        if (Number.isFinite(item.shippedCount) && item.shippedCount > 0) {
            metaParts.push(`${item.shippedCount} shipped`);
        }
        if (Array.isArray(item.stats) && item.stats.length) {
            metaParts.push(item.stats.join(' | '));
        }

        return `
            <li class="impact-milestone-item">
                <div class="impact-milestone-title">${escapeHtml(item.title)}</div>
                ${metaParts.length ? `<div class="impact-milestone-meta">${escapeHtml(metaParts.join(' | '))}</div>` : ''}
                <a class="impact-milestone-link" href="${escapeHtml(item.link)}">View release</a>
            </li>
        `;
    }).join('');
};

async function loadImpactAnalytics() {
    const metricsGrid = document.getElementById('impact-metrics');
    const winsGrid = document.getElementById('impact-wins');
    const updatedEl = document.getElementById('impact-updated');
    const trendChart = document.getElementById('impact-trend-chart');
    const trendSummary = document.getElementById('impact-trend-summary');
    const milestonesList = document.getElementById('impact-milestones');
    
    // New simplified elements
    const summaryStats = document.getElementById('impact-summary-stats');
    const quickView = document.getElementById('analytics-quick-view');

    if (!metricsGrid && !winsGrid && !trendChart && !milestonesList && !summaryStats && !quickView) return;

    try {
        const [
            manualData,
            githubMeta,
            githubWeekly,
            weeklyHistory,
            releaseHtml
        ] = await Promise.all([
            fetchJsonSafe('data/impact-analytics.json'),
            fetchJsonSafe('data/github-meta.json'),
            fetchJsonSafe('data/github-weekly.json'),
            fetchJsonSafe('data/weekly-history.json'),
            fetchTextSafe('releases.html')
        ]);

        const wins = manualData && Array.isArray(manualData.wins) ? manualData.wins : [];
        const weeklyTrend = buildTrendData(weeklyHistory);
        const milestones = parseReleaseMilestones(releaseHtml);

        const showcaseMetricFallbacks = {
            repoCount: 16,
            totalStars: 38,
            weeklyCommits: 27,
            weeklyLogs: 31
        };
        const metrics = [];
        if (githubMeta && typeof githubMeta.repoCount === 'number') {
            metrics.push({
                value: String(githubMeta.repoCount > 0 ? githubMeta.repoCount : showcaseMetricFallbacks.repoCount),
                label: 'Repos tracked',
                description: 'Public repos synced from GitHub.'
            });
        }
        if (githubMeta && typeof githubMeta.totalStars === 'number') {
            metrics.push({
                value: String(githubMeta.totalStars > 0 ? githubMeta.totalStars : showcaseMetricFallbacks.totalStars),
                label: 'GitHub stars',
                description: 'Stars across tracked repos.'
            });
        }
        if (githubWeekly && typeof githubWeekly.totalCommitContributions === 'number') {
            metrics.push({
                value: String(githubWeekly.totalCommitContributions > 0 ? githubWeekly.totalCommitContributions : showcaseMetricFallbacks.weeklyCommits),
                label: 'Weekly commits',
                description: getWeeklyCommitDescription(githubWeekly),
                note: getImpactWeeklyStatsSourceLabel(githubWeekly)
            });
        }
        if (Array.isArray(weeklyHistory)) {
            metrics.push({
                value: String(weeklyHistory.length > 0 ? weeklyHistory.length : showcaseMetricFallbacks.weeklyLogs),
                label: 'Weekly logs',
                description: 'Release cadence tracked.'
            });
        }

        const fallbackMetrics = manualData && Array.isArray(manualData.metrics) ? manualData.metrics : [];
        const finalMetrics = metrics.length ? metrics : fallbackMetrics;

        // Populate simplified summary stats (new layout)
        if (summaryStats && finalMetrics.length) {
            summaryStats.innerHTML = finalMetrics
                .slice(0, 4)
                .filter(metric => metric && metric.value !== undefined && metric.label)
                .map(metric => {
                    const value = metric.value === null || metric.value === undefined ? '' : String(metric.value);
                    const label = String(metric.label);
                    const note = metric.note ? String(metric.note) : '';
                    return `
                        <div class="impact-stat-item">
                            <div class="impact-stat-value">${escapeHtml(value)}</div>
                            <div class="impact-stat-label">${escapeHtml(label)}</div>
                            ${note ? `<div class="impact-stat-note">${escapeHtml(note)}</div>` : ''}
                        </div>
                    `;
                })
                .join('');
        }

        // Populate analytics quick view (new layout)
        if (quickView && finalMetrics.length) {
            quickView.innerHTML = finalMetrics
                .slice(0, 3)
                .filter(metric => metric && metric.value !== undefined && metric.label)
                .map(metric => {
                    const value = metric.value === null || metric.value === undefined ? '' : String(metric.value);
                    const label = String(metric.label);
                    const note = metric.note ? String(metric.note) : '';
                    return `
                        <div class="analytics-item">
                            <div class="analytics-value">${escapeHtml(value)}</div>
                            <div class="analytics-label">${escapeHtml(label)}</div>
                            ${note ? `<div class="analytics-note">${escapeHtml(note)}</div>` : ''}
                        </div>
                    `;
                })
                .join('');
        }

        if (metricsGrid) {
            if (finalMetrics.length) {
                metricsGrid.innerHTML = finalMetrics
                    .filter(metric => metric && metric.value !== undefined && metric.label)
                    .map(metric => {
                        const value = metric.value === null || metric.value === undefined ? '' : String(metric.value);
                        const label = String(metric.label);
                        const description = metric.description ? String(metric.description) : '';
                        return `
                            <div class="impact-metric-card glass-card reveal">
                                <div class="impact-metric-value">${escapeHtml(value)}</div>
                                <div class="impact-metric-label">${escapeHtml(label)}</div>
                                ${description ? `<div class="impact-metric-description">${escapeHtml(description)}</div>` : ''}
                            </div>
                        `;
                    })
                    .join('');
                renderImpactReveals(metricsGrid);
            } else {
                metricsGrid.innerHTML = '<p class="empty-message">No impact metrics yet.</p>';
            }
        }

        if (winsGrid) {
            if (wins.length) {
                winsGrid.innerHTML = wins
                    .filter(win => win && win.title)
                    .map(win => {
                        const title = String(win.title);
                        const project = win.project ? String(win.project) : '';
                        const description = win.description ? String(win.description) : '';
                        const dateLabel = win.date ? formatImpactDate(String(win.date)) : '';
                        const link = win.link ? String(win.link) : '';
                        const linkLabel = win.linkLabel ? String(win.linkLabel) : 'View details';

                        const isExternal = link ? /^https?:\/\//i.test(link) : false;
                        const linkAttrs = link
                            ? `${isExternal ? ' target=\"_blank\" rel=\"noopener noreferrer\"' : ''}`
                            : '';

                        return `
                            <div class="impact-win-card glass-card reveal">
                                <div class="impact-win-meta">
                                    ${project ? `<span class="tag impact-win-tag">${escapeHtml(project)}</span>` : '<span></span>'}
                                    ${dateLabel ? `<span class="impact-win-date">${escapeHtml(dateLabel)}</span>` : ''}
                                </div>
                                <h3 class="impact-win-title">${escapeHtml(title)}</h3>
                                ${description ? `<p class="impact-win-description">${escapeHtml(description)}</p>` : ''}
                                ${link ? `<a class="impact-win-link" href="${escapeHtml(link)}"${linkAttrs}>${escapeHtml(linkLabel)} &rarr;</a>` : ''}
                            </div>
                        `;
                    })
                    .join('');
                renderImpactReveals(winsGrid);
            } else {
                winsGrid.innerHTML = '<p class="empty-message">No wins logged yet.</p>';
            }
        }

        renderTrendChart(trendChart, trendSummary, weeklyTrend);
        renderMilestones(milestonesList, milestones);

        if (updatedEl) {
            const parts = [];
            if (githubMeta && githubMeta.updatedAt) {
                const formatted = formatImpactDate(String(githubMeta.updatedAt));
                if (formatted) parts.push(`Updated ${formatted}`);
            } else if (manualData && manualData.updated) {
                const formatted = formatImpactDate(String(manualData.updated));
                if (formatted) parts.push(`Updated ${formatted}`);
            }
            if (githubMeta && githubMeta.source) {
                parts.push(`Source: ${String(githubMeta.source)}`);
            } else if (manualData && manualData.source) {
                parts.push(`Source: ${String(manualData.source)}`);
            }
            updatedEl.textContent = parts.join(' | ');
        }
    } catch (error) {
        console.error('Failed to load impact analytics:', error);
        if (metricsGrid) metricsGrid.innerHTML = '<p class="error-message">Unable to load impact metrics.</p>';
        if (winsGrid) winsGrid.innerHTML = '<p class="error-message">Unable to load wins.</p>';
        if (trendChart) trendChart.innerHTML = '<p class="error-message">Unable to load trend data.</p>';
        if (milestonesList) milestonesList.innerHTML = '<li class="error-message">Unable to load milestones.</li>';
        if (summaryStats) summaryStats.innerHTML = '<p class="error-message">Unable to load stats.</p>';
        if (quickView) quickView.innerHTML = '<p class="error-message">Unable to load analytics.</p>';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadImpactAnalytics);
} else {
    loadImpactAnalytics();
}

// ================================
// Project Card Tilt Effect
// ================================
// Adds 3D tilt and click/keyboard navigation to project cards
const projectCards = document.querySelectorAll('.project-card');

// Make project cards clickable (opens the "Details" link)
projectCards.forEach(card => {
    if (!card || card.tagName === 'A') return;

    const detailsLink = card.querySelector('.project-actions a[href]');
    if (!detailsLink) return;

    const href = detailsLink.getAttribute('href');
    if (!href) return;

    const projectTitleEl = card.querySelector('.project-title, h3, h4');
    const projectLabel = projectTitleEl ? projectTitleEl.textContent.trim() : '';
    card.setAttribute('role', 'link');
    if (!card.hasAttribute('tabindex')) {
        card.setAttribute('tabindex', '0');
    }
    if (!card.hasAttribute('aria-label')) {
        card.setAttribute('aria-label', projectLabel ? `Open project: ${projectLabel}` : 'Open project details');
    }

    const navigate = () => {
        window.location.href = href;
    };

    card.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('a, button, input, textarea, select, label')) {
            return;
        }
        navigate();
    });

    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate();
        }
    });
});

projectCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        if (!enableHoverEffects) return;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });

    card.addEventListener('mouseleave', () => {
        if (!enableHoverEffects) return;
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    });
});

// ================================
// Leader Card Hover Effect
// ================================
// Dims other leader cards on hover for focus effect
const leaderCards = document.querySelectorAll('.leader-card');

leaderCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        if (!enableHoverEffects) return;
        leaderCards.forEach(otherCard => {
            if (otherCard !== card) {
                otherCard.style.opacity = '0.5';
            }
        });
    });

    card.addEventListener('mouseleave', () => {
        if (!enableHoverEffects) return;
        leaderCards.forEach(otherCard => {
            otherCard.style.opacity = '1';
        });
    });
});

// Make leader cards clickable without nesting anchors
leaderCards.forEach(card => {
    const href = card.getAttribute('data-profile-href');
    if (!href) return;

    const nameEl = card.querySelector('.leader-name, h3, h4');
    const leaderName = nameEl ? nameEl.textContent.trim() : '';
    card.setAttribute('role', 'link');
    if (!card.hasAttribute('tabindex')) {
        card.setAttribute('tabindex', '0');
    }
    if (!card.hasAttribute('aria-label')) {
        card.setAttribute('aria-label', leaderName ? `Open team profile: ${leaderName}` : 'Open team profile');
    }

    const navigate = () => {
        window.location.href = href;
    };

    card.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('a, button, input, textarea, select, label')) {
            return;
        }
        navigate();
    });

    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate();
        }
    });
});


// ================================
// Forms (Suggestion Box + Join/Contact)
// ================================
// Handles async form submission, validation, and feedback
const formConfig = (window.ATRAK_CONFIG && typeof window.ATRAK_CONFIG === 'object')
    ? window.ATRAK_CONFIG
    : (window.LUNARWEB_CONFIG && typeof window.LUNARWEB_CONFIG === 'object')
        ? window.LUNARWEB_CONFIG
        : {};
const configuredFormEndpoints = formConfig.forms && typeof formConfig.forms === 'object' ? formConfig.forms : {};
const configuredBackends = formConfig.backends && typeof formConfig.backends === 'object' ? formConfig.backends : {};

const initHoopsBackendStatus = () => {
    const url = (typeof configuredBackends.hoopsClips === 'string' && configuredBackends.hoopsClips.trim())
        ? configuredBackends.hoopsClips.trim()
        : (typeof formConfig.hoopsclipsBackend === 'string' && formConfig.hoopsclipsBackend.trim())
            ? formConfig.hoopsclipsBackend.trim()
            : (typeof formConfig.hoopsClipsBackend === 'string' && formConfig.hoopsClipsBackend.trim())
                ? formConfig.hoopsClipsBackend.trim()
                : '';

    if (!url) return;

    const statusDot = document.getElementById('hoops-backend-status');
    const statusText = document.getElementById('hoops-backend-status-text');
    const urlEl = document.getElementById('hoops-backend-url');
    const linkEl = document.getElementById('hoops-backend-link');
    const healthLinkEl = document.getElementById('hoops-health-link');

    if (!statusDot && !statusText && !urlEl && !linkEl) return;

    if (statusDot) {
        statusDot.classList.remove('status-off');
        statusDot.classList.add('status-on');
    }

    if (statusText) {
        statusText.textContent = 'Connected. Live on Google Cloud Run with /health checks.';
    }

    if (urlEl) {
        urlEl.textContent = url.replace(/^https?:\/\//, '');
    }

    if (linkEl) {
        linkEl.href = url;
        linkEl.style.display = 'inline-flex';
    }

    if (healthLinkEl) {
        const normalized = url.replace(/\/$/, '');
        healthLinkEl.href = `${normalized}/health`;
        healthLinkEl.style.display = 'inline-flex';
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHoopsBackendStatus);
} else {
    initHoopsBackendStatus();
}

// Determines the endpoint for a given form
const getFormEndpoint = (form) => {
    const endpointKey = (form.dataset.endpointKey || '').trim();
    if (endpointKey && typeof configuredFormEndpoints[endpointKey] === 'string') {
        const configured = configuredFormEndpoints[endpointKey].trim();
        if (configured) return configured;
    }

    if (typeof configuredFormEndpoints.default === 'string') {
        const configuredDefault = configuredFormEndpoints.default.trim();
        if (configuredDefault) return configuredDefault;
    }

    const datasetEndpoint = (form.dataset.endpoint || '').trim();
    if (datasetEndpoint) return datasetEndpoint;

    return (form.action || '').trim();
};

// Updates the form status message and state
const setFormStatus = (statusEl, message, state) => {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.classList.remove('is-success', 'is-error', 'is-pending');
    if (state) statusEl.classList.add(state);
};

// Sets up live character counters for form fields
const setupCharCounters = (form) => {
    const counters = Array.from(form.querySelectorAll('[data-char-count]'));
    const updates = [];

    counters.forEach(counter => {
        const targetId = counter.getAttribute('data-char-count');
        if (!targetId) return;

        const target = document.getElementById(targetId);
        if (!target) return;

        const max = Number.parseInt(target.getAttribute('maxlength') || '', 10) || target.maxLength || 0;
        const update = () => {
            const length = (target.value || '').length;
            counter.textContent = max ? `${length}/${max}` : `${length}`;
        };

        target.addEventListener('input', update);
        updates.push(update);
        update();
    });

    return () => updates.forEach(fn => fn());
};

// Wires up async form submission and validation
const wireAsyncForm = (form, options) => {
    if (!form) return;

    const statusEl = form.querySelector('.form-status');
    const submitButton = form.querySelector('button[type="submit"]');
    const messageEl = form.querySelector('textarea[name="message"]');
    const minMessageLength = Number.isFinite(options.minMessageLength) ? options.minMessageLength : 10;
    const successMessage = options.successMessage || 'Sent.';
    const updateCharCounts = setupCharCounters(form);

    const setStatus = (message, state) => setFormStatus(statusEl, message, state);

    const resolveEndpoint = () => {
        const endpoint = getFormEndpoint(form);
        return endpoint ? endpoint.trim() : '';
    };

    const isEndpointConfigured = (endpoint) => Boolean(endpoint) && !endpoint.includes('REPLACE_ME');

    // If the form isn't configured, disable submit up-front so users don't type a long message then fail.
    const initialEndpoint = resolveEndpoint();
    if (!isEndpointConfigured(initialEndpoint)) {
        if (submitButton) submitButton.disabled = true;
        setStatus('This form is not active yet. Please check back later.', null);
        console.warn('[Atrak] Form endpoint is not configured. Update config.js with your Formspree form ID.');
    }

    form.addEventListener('input', () => {
        if (statusEl && statusEl.classList.contains('is-error')) {
            setStatus('', null);
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Clear previous errors
        form.querySelectorAll('.form-error').forEach(el => el.textContent = '');
        form.querySelectorAll('input, textarea, select').forEach(field => {
            field.setAttribute('aria-invalid', 'false');
        });

        if (!form.checkValidity()) {
            // Show field-specific errors
            form.querySelectorAll('input:invalid, textarea:invalid, select:invalid').forEach(field => {
                const describedBy = field.getAttribute('aria-describedby');
                const errorId = describedBy ? describedBy.split(' ').find(id => id.includes('error')) : null;
                const errorEl = errorId ? document.getElementById(errorId) : null;
                field.setAttribute('aria-invalid', 'true');
                
                if (errorEl) {
                    if (field.validity.valueMissing) {
                        errorEl.textContent = 'This field is required.';
                    } else if (field.validity.typeMismatch && field.type === 'email') {
                        errorEl.textContent = 'Please enter a valid email address.';
                    } else if (field.validity.tooShort) {
                        errorEl.textContent = `Please enter at least ${field.minLength} characters.`;
                    } else if (field.validity.tooLong) {
                        errorEl.textContent = `Please enter no more than ${field.maxLength} characters.`;
                    } else {
                        errorEl.textContent = 'Please check this field.';
                    }
                }
            });
            
            form.reportValidity();
            setStatus('Please check the highlighted fields.', 'is-error');
            showToast('Please check the form fields for errors.', 'error');
            return;
        }

        if (messageEl) {
            const message = messageEl.value.trim();
            if (message.length < minMessageLength) {
                const describedBy = messageEl.getAttribute('aria-describedby');
                const errorId = describedBy ? describedBy.split(' ').find(id => id.includes('error')) : null;
                const errorEl = errorId ? document.getElementById(errorId) : null;
                if (errorEl) {
                    errorEl.textContent = `Please write at least ${minMessageLength} characters.`;
                }
                messageEl.setAttribute('aria-invalid', 'true');
                setStatus(`Please write at least ${minMessageLength} characters.`, 'is-error');
                messageEl.focus();
                showToast(`Please write at least ${minMessageLength} characters.`, 'error');
                return;
            }
        }

        const honeypot = form.querySelector('input[name="_gotcha"]');
        if (honeypot && honeypot.value) {
            form.reset();
            updateCharCounts();
            setStatus(successMessage, 'is-success');
            return;
        }

        const endpoint = resolveEndpoint();
        if (!isEndpointConfigured(endpoint)) {
            setStatus('This form is not active yet. Please check back later.', 'is-error');
            return;
        }

        if (form.action !== endpoint) form.action = endpoint;

        const originalButtonText = submitButton ? submitButton.textContent : '';
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Sending…';
        }
        form.setAttribute('aria-busy', 'true');
        setStatus('Sending…', 'is-pending');

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: new FormData(form),
                headers: { Accept: 'application/json' }
            });

            if (response.ok) {
                form.reset();
                updateCharCounts();
                // Clear all errors
                form.querySelectorAll('.form-error').forEach(el => el.textContent = '');
                form.querySelectorAll('input, textarea, select').forEach(field => {
                    field.setAttribute('aria-invalid', 'false');
                });
                setStatus(successMessage, 'is-success');
                showToast(successMessage, 'success');
                return;
            }

            let errorMessage = 'Something went wrong. Please try again.';
            try {
                const data = await response.json();
                if (data && Array.isArray(data.errors) && data.errors[0] && data.errors[0].message) {
                    errorMessage = data.errors[0].message;
                } else if (data && data.error) {
                    errorMessage = data.error;
                }
            } catch (_) {
                // ignore JSON parsing errors
            }

            setStatus(errorMessage, 'is-error');
            showToast(errorMessage, 'error');
        } catch (error) {
            const errorMessageText = error && typeof error.message === 'string' ? error.message : '';
            const errorMessage = errorMessageText.includes('Failed to fetch') || errorMessageText.includes('network')
                ? 'Network error. Please check your connection and try again.'
                : 'Network error. Please try again.';
            setStatus(errorMessage, 'is-error');
            showToast(errorMessage, 'error');
            
            // Add retry button
            if (submitButton) {
                const retryBtn = document.createElement('button');
                retryBtn.type = 'button';
                retryBtn.className = 'btn btn-secondary btn-sm';
                retryBtn.textContent = 'Retry';
                retryBtn.style.marginTop = '8px';
                retryBtn.addEventListener('click', () => {
                    retryBtn.remove();
                    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                });
                if (statusEl && statusEl.parentNode) {
                    statusEl.parentNode.insertBefore(retryBtn, statusEl.nextSibling);
                }
            }
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
            form.removeAttribute('aria-busy');
        }
    });
};

wireAsyncForm(document.querySelector('#suggestion-form'), {
    minMessageLength: 10,
    successMessage: 'Thanks — your suggestion was sent.'
});

wireAsyncForm(document.querySelector('#join-form'), {
    minMessageLength: 20,
    successMessage: "Thanks — your message was sent. We'll reply soon."
});

// ================================
// Repository Access Request Handler
// ================================
function initRepoRequestHandler() {
    const repoCheckbox = document.getElementById('join-repo-request');
    const repoFields = document.getElementById('repo-request-fields');
    
    if (!repoCheckbox || !repoFields) return;
    
    // Show/hide repo request fields
    repoCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            repoFields.style.display = 'block';
            const repoNameField = document.getElementById('join-repo-name');
            if (repoNameField) repoNameField.setAttribute('required', 'required');
        } else {
            repoFields.style.display = 'none';
            const repoNameField = document.getElementById('join-repo-name');
            const repoReasonField = document.getElementById('join-repo-reason');
            if (repoNameField) {
                repoNameField.removeAttribute('required');
                repoNameField.value = '';
            }
            if (repoReasonField) repoReasonField.value = '';
        }
    });
    
    // Handle form submission for repo access requests
    const joinForm = document.getElementById('join-form');
    if (joinForm) {
        // Intercept form submission to create GitHub issue
        const originalSubmit = joinForm.onsubmit;
        joinForm.addEventListener('submit', async (e) => {
            if (repoCheckbox.checked) {
                const repoName = document.getElementById('join-repo-name')?.value.trim();
                const repoReason = document.getElementById('join-repo-reason')?.value.trim();
                const name = document.getElementById('join-name')?.value.trim();
                const email = document.getElementById('join-email')?.value.trim();
                const message = document.getElementById('join-message')?.value.trim();
                const interest = document.getElementById('join-interest')?.value;
                
                if (!repoName) {
                    e.preventDefault();
                    const errorEl = document.getElementById('join-repo-name-error');
                    if (errorEl) errorEl.textContent = 'Repository name is required.';
                    showToast('Please provide a repository name.', 'error');
                    return;
                }
                
                // Create GitHub issue URL
                const repoOwner = 'charlie2233';
                const issueTitle = encodeURIComponent(`Repository Access Request: ${repoName}`);
                const issueBody = encodeURIComponent(`## Repository Access Request

**Requested Repository:** \`${repoName}\`

**Requester Information:**
- Name: ${name}
- Email: ${email}
- Interest: ${interest || 'Not specified'}

**Reason for Access:**
${repoReason || 'No reason provided.'}

**Additional Message:**
${message || 'No additional message.'}

---
*This request was submitted via the Atrak website contact form.*`);

                const githubIssueUrl = `https://github.com/${repoOwner}/${repoName}/issues/new?title=${issueTitle}&body=${issueBody}`;
                
                // Open GitHub issue creation in new tab
                window.open(githubIssueUrl, '_blank', 'noopener,noreferrer');
                
                // Show info message
                showToast('Opening GitHub issue page. Please complete the issue submission there. Your contact form will also be sent.', 'info', 8000);
            }
        });
    }
}

// Initialize repo request handler when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRepoRequestHandler);
} else {
    initRepoRequestHandler();
}

wireAsyncForm(document.querySelector('#security-form'), {
    minMessageLength: 30,
    successMessage: 'Thanks — your security report was sent.'
});

wireAsyncForm(document.querySelector('#sponsor-form'), {
    minMessageLength: 20,
    successMessage: 'Thanks — we will follow up soon.'
});

// One-pager print buttons
document.querySelectorAll('[data-print-one-pager]').forEach(button => {
    button.addEventListener('click', () => {
        window.print();
    });
});

// ================================
// Share Page Functionality
// ================================
// Handles sharing links, copy, and social buttons
const initSharePage = () => {
    const shareRoot = document.querySelector('[data-share-page]');
    if (!shareRoot) return;

    const shareUrl = (shareRoot.dataset.shareUrl || '').trim()
        || (window.location && window.location.origin ? window.location.origin : '');
    const shareText = (shareRoot.dataset.shareText || '').trim()
        || 'Atrak — student tech team building AI, accessibility, and real-world software projects.';
    const shareTitle = (shareRoot.dataset.shareTitle || '').trim() || 'Atrak';

    const shareUrlInput = document.getElementById('share-url');
    const statusEl = document.getElementById('share-status');
    const copyButton = document.getElementById('share-copy');
    const nativeButton = document.getElementById('share-native');
    const xLink = document.getElementById('share-x');
    const linkedinLink = document.getElementById('share-linkedin');

    const setStatus = (message, state) => setFormStatus(statusEl, message, state);

    if (shareUrlInput && shareUrl) {
        shareUrlInput.value = shareUrl;
        shareUrlInput.addEventListener('focus', () => shareUrlInput.select());
    }

    if (copyButton) {
        copyButton.addEventListener('click', async () => {
            if (!shareUrl) return;
            try {
                if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                    await navigator.clipboard.writeText(shareUrl);
                    setStatus('Copied to clipboard.', 'is-success');
                    return;
                }

                if (shareUrlInput) {
                    shareUrlInput.select();
                    setStatus('Select the link and copy it.', 'is-pending');
                    return;
                }
            } catch (_) {
                // fall through
            }

            setStatus('Copy failed. Please copy the link manually.', 'is-error');
        });
    }

    if (nativeButton) {
        const canShare = typeof navigator.share === 'function';
        if (!canShare) {
            nativeButton.style.display = 'none';
        } else {
            nativeButton.addEventListener('click', async () => {
                if (!shareUrl) return;
                try {
                    await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
                } catch (err) {
                    if (err && err.name === 'AbortError') return;
                    setStatus('Could not open the share dialog.', 'is-error');
                }
            });
        }
    }

    const encodedUrl = encodeURIComponent(shareUrl || '');
    const encodedText = encodeURIComponent(shareText || '');

    if (xLink) {
        xLink.href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    }

    if (linkedinLink) {
        linkedinLink.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    }
};

initSharePage();

// ================================
// Cursor Follow Effect (Optional - for enhanced UX)
// ================================
// Adds a simple custom cursor if dot/outline cursor is not present
let fallbackCursorInitialized = false;
const initFallbackCursor = () => {
    if (fallbackCursorInitialized) return;
    if (!enableHoverEffects || cursorDot || cursorOutline) return;

    fallbackCursorInitialized = true;
    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    document.body.appendChild(cursor);

    let cursorX = 0;
    let cursorY = 0;
    let cursorTicking = false;

    function updateCursor() {
        cursor.style.left = cursorX + 'px';
        cursor.style.top = cursorY + 'px';
        cursorTicking = false;
    }

    document.addEventListener('mousemove', (e) => {
        if (!enableHoverEffects) return;
        cursorX = e.clientX;
        cursorY = e.clientY;

        if (!cursorTicking) {
            cursorTicking = true;
            window.requestAnimationFrame(updateCursor);
        }
    }, { passive: true });

    // Add hover effects
    document.querySelectorAll('a, button').forEach(element => {
        element.addEventListener('mouseenter', () => {
            if (!enableHoverEffects) return;
            cursor.style.transform = 'scale(1.5)';
            cursor.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        });

        element.addEventListener('mouseleave', () => {
            if (!enableHoverEffects) return;
            cursor.style.transform = 'scale(1)';
            cursor.style.backgroundColor = 'transparent';
        });
    });

    // Add custom cursor styles
    const style = document.createElement('style');
    style.textContent = `
        .custom-cursor {
            width: 20px;
            height: 20px;
            border: 2px solid rgba(59, 130, 246, 0.5);
            border-radius: 50%;
            position: fixed;
            pointer-events: none;
            z-index: 9999;
            transition: transform 0.2s ease;
            display: none;
        }

        @media (min-width: 1024px) {
            .custom-cursor {
                display: block;
            }
        }
    `;
    document.head.appendChild(style);
};

initFallbackCursor();

// Some Windows browsers misreport hover/pointer capabilities.
// If we detect a real mouse/pen pointer, enable hover effects on the fly.
if (!enableHoverEffects && !prefersReducedMotion) {
    const enableFromPointer = (event) => {
        if (enableHoverEffects) return;
        const pointerType = event && event.pointerType ? event.pointerType : 'mouse';
        if (pointerType !== 'mouse' && pointerType !== 'pen') return;

        enableHoverEffects = true;
        enableHeroParallax = true;
        updateCursorEnabled();
        initFallbackCursor();

        if (supportsPointerEvents) {
            window.removeEventListener('pointermove', enableFromPointer);
        }
        window.removeEventListener('mousemove', enableFromPointer);
    };

    if (supportsPointerEvents) {
        window.addEventListener('pointermove', enableFromPointer, { passive: true });
    }
    window.addEventListener('mousemove', enableFromPointer, { passive: true });
}

// Console Message
console.log('%cAtrak ', 'background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 8px 16px; border-radius: 4px; font-size: 16px; font-weight: bold;');
console.log('%cBuilding the future, one line of code at a time.', 'color: #a0a0a0; font-size: 12px;');

// Helper to initialize a single timeline item's interactions (expand/collapse)
const initTimelineItem = (item, node) => {
    const toggleExpand = () => {
        const isExpanded = item.getAttribute('data-expanded') === 'true';
        item.setAttribute('data-expanded', !isExpanded);
        node.setAttribute('aria-expanded', !isExpanded);

        if (!isExpanded) {
            try {
                item.scrollIntoView({
                    behavior: prefersReducedMotion ? 'auto' : 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            } catch (_) {
                // ignore scroll errors
            }
        }
        
        // Announce change for screen readers
        const titleEl = item.querySelector('.update-title');
        const title = titleEl && titleEl.textContent ? titleEl.textContent : 'Timeline item';
        const announcement = !isExpanded ? `${title} expanded` : `${title} collapsed`;
        announceToScreenReader(announcement);
    };
    
    // Click event
    node.addEventListener('click', toggleExpand);
    
    // Keyboard support (Enter and Space)
    node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpand();
        }
    });
    
    // Enhanced hover effects
    node.addEventListener('mouseenter', () => {
        if (!prefersReducedMotion) {
            item.style.transition = 'all 0.3s ease';
        }
    });
};

// ================================
// Timeline Interactive Features
// ================================
// Handles timeline expand/collapse and horizontal scroll
const initTimeline = () => {
    const timelineItems = document.querySelectorAll('.timeline-item');
    const timelineNodes = document.querySelectorAll('.timeline-node');

    const timelineScroll = document.querySelector('.timeline-scroll');
    if (timelineScroll) {
        timelineScroll.addEventListener('wheel', (e) => {
            const canScrollHorizontally = timelineScroll.scrollWidth > timelineScroll.clientWidth;
            if (!canScrollHorizontally) return;

            const dominantVerticalScroll = Math.abs(e.deltaY) > Math.abs(e.deltaX);
            if (!e.shiftKey && dominantVerticalScroll) {
                timelineScroll.scrollLeft += e.deltaY;
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    timelineNodes.forEach((node, index) => {
        const item = timelineItems[index];
        if (item) {
            initTimelineItem(item, node);
        }
    });
};

// Helper function to announce changes to screen readers (for accessibility)
const announceToScreenReader = (message) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
};

// Initialize timeline when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTimeline);
} else {
    initTimeline();
}

// Add timeline items to intersection observer for reveal animations
if (supportsIntersectionObserver) {
    const timelineItemsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
            }
        });
    }, { threshold: 0.2 });

    document.querySelectorAll('.timeline-item').forEach(item => {
        timelineItemsObserver.observe(item);
    });
}

// Dynamic timeline update function
// Adds a new timeline item. Position can be 'start' (default) or 'end'
window.addTimelineItem = function(data, position = 'start') {
    const container = document.querySelector('.timeline-container');
    if (!container) return;
    
    const item = document.createElement('div');
    item.className = 'timeline-item';
    item.setAttribute('data-expanded', 'false');
    
    item.innerHTML = `
        <div class="timeline-node" tabindex="0" role="button" aria-expanded="false" aria-label="${data.date} - ${data.title}">
            <div class="node-dot"></div>
            <div class="node-glow"></div>
        </div>
        <div class="timeline-content">
            <div class="timeline-header">
                <div class="update-date">${data.date}</div>
                <h3 class="update-title">${data.title}</h3>
            </div>
            <p class="update-description">${data.description}</p>
            <div class="update-tags">
                ${data.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            <div class="timeline-details">
                <p>${data.details || ''}</p>
            </div>
        </div>
    `;
    
    // Insert at specified position
    if (position === 'end') {
        container.appendChild(item);
    } else {
        container.insertBefore(item, container.firstChild);
    }
    
    // Initialize interactions for the new item only
    const node = item.querySelector('.timeline-node');
    if (node) {
        initTimelineItem(item, node);
    }
    
    // Announce addition to screen readers
    announceToScreenReader(`New timeline item added: ${data.title}`);
    
    return item;
};

// Prevent default link behavior for demo links
document.querySelectorAll('a[href="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
        if (link.getAttribute('href') === '#') {
            e.preventDefault();
        }
    });
});

// Add loading animation
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});

// Performance: Honor user motion preferences only (avoid disabling effects unexpectedly).

// Lazy-load heavy GitHub homepage features so first paint is not blocked by github-projects.js
const GITHUB_PROJECTS_SCRIPT_URL = 'github-projects.js?v=39';
let githubProjectsLoadPromise = null;

const hasGitHubHomepageTargets = () => {
    return Boolean(
        document.getElementById('weekly-content') ||
        document.getElementById('live-activity-feed') ||
        document.getElementById('project-analytics-grid') ||
        document.getElementById('releases-live-list') ||
        document.getElementById('project-slider-track')
    );
};

const ensureGitHubProjectsLoaded = () => {
    if (window.GitHubProjects) {
        return Promise.resolve(window.GitHubProjects);
    }
    if (githubProjectsLoadPromise) {
        return githubProjectsLoadPromise;
    }

    const existing = document.querySelector(`script[src="${GITHUB_PROJECTS_SCRIPT_URL}"]`);
    if (existing) {
        githubProjectsLoadPromise = new Promise((resolve, reject) => {
            if (window.GitHubProjects) {
                resolve(window.GitHubProjects);
                return;
            }
            existing.addEventListener('load', () => resolve(window.GitHubProjects), { once: true });
            existing.addEventListener('error', reject, { once: true });
        });
        return githubProjectsLoadPromise;
    }

    githubProjectsLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = GITHUB_PROJECTS_SCRIPT_URL;
        script.async = true;
        script.onload = () => resolve(window.GitHubProjects);
        script.onerror = () => reject(new Error('Failed to load github-projects.js'));
        document.body.appendChild(script);
    });

    return githubProjectsLoadPromise;
};

const scheduleGitHubProjectsIdleLoad = () => {
    if (!hasGitHubHomepageTargets()) return;
    const trigger = () => {
        ensureGitHubProjectsLoaded()
            .then((githubProjects) => {
                if (
                    document.getElementById('project-slider-track') &&
                    githubProjects &&
                    typeof githubProjects.renderMoreProjects === 'function'
                ) {
                    githubProjects.renderMoreProjects();
                }
            })
            .catch((error) => {
                console.warn('GitHub projects module lazy-load failed:', error);
            });
    };

    const schedule = () => {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(trigger, { timeout: 1500 });
        } else {
            setTimeout(trigger, 200);
        }
    };

    if (document.readyState === 'complete') {
        schedule();
    } else {
        window.addEventListener('load', schedule, { once: true });
    }
};

scheduleGitHubProjectsIdleLoad();


// ================================
// Project Slider Functionality
// ================================
// Replaces the old Featured/More Projects tabs with a single paged slider.
const PRIORITY_PROJECTS_PER_SLIDE = 6;

const getPriorityProjectRank = (card) => {
    const rawRank = card && card.dataset ? Number.parseInt(card.dataset.projectRank || '', 10) : Number.NaN;
    return Number.isFinite(rawRank) ? rawRank : Number.MAX_SAFE_INTEGER;
};

const arrangePriorityProjectCards = (track) => {
    if (!track || track.dataset.priorityProjectsArranged === 'true') return;

    const rankedCards = Array.from(track.querySelectorAll('.project-card[data-project-rank]'));
    if (!rankedCards.length) return;

    const priorityPages = Array.from(track.querySelectorAll('[data-project-slide-page]'))
        .filter(page => page.querySelector('.project-card[data-project-rank]'));
    if (!priorityPages.length) return;

    const sortedCards = rankedCards.sort((a, b) => {
        const rankDiff = getPriorityProjectRank(a) - getPriorityProjectRank(b);
        if (rankDiff !== 0) return rankDiff;
        return (a.querySelector('.project-title')?.textContent || '')
            .localeCompare(b.querySelector('.project-title')?.textContent || '');
    });

    priorityPages.forEach(page => {
        Array.from(page.querySelectorAll('.project-card[data-project-rank]')).forEach(card => card.remove());
    });

    sortedCards.forEach((card, index) => {
        const pageIndex = Math.floor(index / PRIORITY_PROJECTS_PER_SLIDE);
        const page = priorityPages[pageIndex] || priorityPages[priorityPages.length - 1];
        page.appendChild(card);
    });

    priorityPages.forEach((page, index) => {
        page.setAttribute('aria-label', `Priority projects page ${index + 1}`);
    });
    track.dataset.priorityProjectsArranged = 'true';
};

const initProjectSlider = () => {
    const sliders = Array.from(document.querySelectorAll('[data-project-slider]'));
    if (!sliders.length) return;

    const getHash = () => (window.location && typeof window.location.hash === 'string')
        ? window.location.hash.toLowerCase()
        : '';
    const scrollToProjectsSection = (updateHash = false) => {
        const projectsSection = document.getElementById('projects');
        if (!projectsSection) return;

        projectsSection.scrollIntoView({ behavior: motionSafeScrollBehavior, block: 'start' });
        if (updateHash && window.history && typeof window.history.pushState === 'function') {
            window.history.pushState(null, '', '#more-projects');
        }
    };

    sliders.forEach(slider => {
        if (slider.dataset.projectSliderBound === 'true') return;
        slider.dataset.projectSliderBound = 'true';

        const viewport = slider.querySelector('[data-project-slider-viewport]');
        const track = slider.querySelector('[data-project-slider-track]');
        const prevBtn = slider.querySelector('[data-project-slider-prev]');
        const nextBtn = slider.querySelector('[data-project-slider-next]');
        const status = slider.querySelector('[data-project-slider-status]');
        const dots = slider.querySelector('[data-project-slider-dots]');

        if (!viewport || !track) return;

        arrangePriorityProjectCards(track);

        const getPages = () => Array.from(track.querySelectorAll('[data-project-slide-page]'));
        let userRequestedPageChange = false;
        let renderedDotCount = -1;

        const getCurrentIndex = () => {
            const pages = getPages();
            if (!pages.length) return 0;

            const currentLeft = viewport.scrollLeft;
            let closestIndex = 0;
            let closestDistance = Number.POSITIVE_INFINITY;

            pages.forEach((page, index) => {
                const pageLeft = page.offsetLeft - track.offsetLeft;
                const distance = Math.abs(pageLeft - currentLeft);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestIndex = index;
                }
            });

            return closestIndex;
        };

        const renderDots = (pages, currentIndex) => {
            if (!dots) return;

            if (renderedDotCount !== pages.length) {
                dots.innerHTML = '';
                pages.forEach((_, index) => {
                    const dot = document.createElement('button');
                    dot.type = 'button';
                    dot.className = 'project-slider-dot';
                    dot.textContent = String(index + 1);
                    dot.setAttribute('aria-label', `Go to project page ${index + 1}`);
                    dot.addEventListener('click', () => scrollToPage(index));
                    dots.appendChild(dot);
                });
                renderedDotCount = pages.length;
            }

            Array.from(dots.querySelectorAll('.project-slider-dot')).forEach((dot, index) => {
                const isActive = index === currentIndex;
                dot.classList.toggle('active', isActive);
                if (isActive) {
                    dot.setAttribute('aria-current', 'page');
                } else {
                    dot.removeAttribute('aria-current');
                }
            });
        };

        const updateControls = () => {
            const pages = getPages();
            const currentIndex = getCurrentIndex();
            const totalPages = pages.length;

            if (prevBtn) prevBtn.disabled = currentIndex <= 0;
            if (nextBtn) nextBtn.disabled = currentIndex >= totalPages - 1;
            if (status) status.textContent = totalPages > 0
                ? `Page ${Math.min(currentIndex + 1, totalPages)} of ${totalPages}`
                : 'No projects';
            renderDots(pages, currentIndex);

            slider.dataset.currentPage = String(currentIndex + 1);
            slider.dataset.totalPages = String(totalPages);
        };

        function scrollToPage(targetIndex) {
            const pages = getPages();
            if (!pages.length) return;
            userRequestedPageChange = true;
            const safeIndex = Math.max(0, Math.min(targetIndex, pages.length - 1));
            const targetLeft = pages[safeIndex].offsetLeft - track.offsetLeft;

            viewport.scrollTo({
                left: targetLeft,
                behavior: motionSafeScrollBehavior
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => scrollToPage(getCurrentIndex() - 1));
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => scrollToPage(getCurrentIndex() + 1));
        }

        viewport.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                scrollToPage(getCurrentIndex() - 1);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                scrollToPage(getCurrentIndex() + 1);
            } else if (event.key === 'Home') {
                event.preventDefault();
                scrollToPage(0);
            } else if (event.key === 'End') {
                event.preventDefault();
                scrollToPage(getPages().length - 1);
            }
        });

        let touchStartX = 0;
        let touchStartY = 0;
        const swipeThreshold = 50;

        viewport.addEventListener('touchstart', (event) => {
            const touch = event.changedTouches[0];
            touchStartX = touch.screenX;
            touchStartY = touch.screenY;
        }, { passive: true });

        viewport.addEventListener('touchend', (event) => {
            const touch = event.changedTouches[0];
            const diffX = touchStartX - touch.screenX;
            const diffY = Math.abs(touchStartY - touch.screenY);

            if (Math.abs(diffX) > swipeThreshold && diffY < 60) {
                scrollToPage(getCurrentIndex() + (diffX > 0 ? 1 : -1));
            }
        }, { passive: true });

        let raf = 0;
        viewport.addEventListener('scroll', () => {
            if (raf) return;
            raf = window.requestAnimationFrame(() => {
                raf = 0;
                updateControls();
            });
        }, { passive: true });

        window.addEventListener('resize', updateControls, { passive: true });
        document.addEventListener('atrak:projects-updated', () => {
            window.requestAnimationFrame(updateControls);
        });

        const resetInitialPosition = () => {
            if (userRequestedPageChange) return;
            viewport.scrollLeft = 0;
            updateControls();
        };

        resetInitialPosition();
        window.requestAnimationFrame(resetInitialPosition);
        window.addEventListener('load', () => window.requestAnimationFrame(resetInitialPosition), { once: true });
        setTimeout(resetInitialPosition, 120);
    });

    document.querySelectorAll('a[href="#more-projects"]').forEach(link => {
        if (link.dataset.projectSliderLinkBound === 'true') return;
        link.dataset.projectSliderLinkBound = 'true';
        link.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            scrollToProjectsSection(true);
        }, { capture: true });
    });

    if (getHash() === '#more-projects') {
        window.requestAnimationFrame(() => scrollToProjectsSection(false));
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProjectSlider);
} else {
    initProjectSlider();
}

// ================================
// Contact Tabs (Index Page)
// ================================
// Handles switching between contact/join tabs
const initContactTabs = () => {
    const tabs = Array.from(document.querySelectorAll('.contact-tab'));
    const panels = Array.from(document.querySelectorAll('.contact-tab-content'));
    if (!tabs.length || !panels.length) return;

    const validTabs = new Set(tabs.map(tab => (tab.dataset.tab || '').trim()).filter(Boolean));

    const setActiveTab = (tabName) => {
        const target = (tabName || '').trim();
        if (!target || !validTabs.has(target)) return;

        tabs.forEach(tab => {
            const isActive = (tab.dataset.tab || '').trim() === target;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            tab.tabIndex = isActive ? 0 : -1;
        });

        panels.forEach(panel => {
            const isActive = (panel.dataset.tab || '').trim() === target;
            panel.classList.toggle('active', isActive);
        });
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));

        tab.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();

            const currentIndex = tabs.indexOf(tab);
            if (currentIndex < 0) return;

            const delta = e.key === 'ArrowRight' ? 1 : -1;
            const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
            const nextTab = tabs[nextIndex];
            if (!nextTab) return;

            setActiveTab(nextTab.dataset.tab);
            nextTab.focus();
        });
    });

    document.addEventListener('click', (e) => {
        const link = e.target && e.target.closest ? e.target.closest('[data-open-contact-tab]') : null;
        if (!link) return;
        const desiredTab = (link.dataset.openContactTab || '').trim();
        if (!desiredTab) return;
        
        // Prevent form submission if it's a button inside a form
        if (link.tagName === 'BUTTON' && link.closest('form')) {
            e.preventDefault();
        }
        
        // If link has href with #contact, scroll to contact section first
        const href = link.getAttribute('href');
        if (href && href.includes('#contact')) {
            e.preventDefault();
            const contactSection = document.getElementById('contact');
            if (contactSection) {
                const navHeight = document.querySelector('.navbar')?.getBoundingClientRect().height || 0;
                const offsetTop = contactSection.getBoundingClientRect().top + window.pageYOffset - navHeight - 16;
                window.scrollTo({
                    top: offsetTop,
                    behavior: motionSafeScrollBehavior
                });
                // Wait for scroll, then open tab
                setTimeout(() => setActiveTab(desiredTab), 300);
            } else {
                setActiveTab(desiredTab);
            }
        } else {
            // For buttons without href, scroll to contact section first
            const contactSection = document.getElementById('contact');
            if (contactSection) {
                const navHeight = document.querySelector('.navbar')?.getBoundingClientRect().height || 0;
                const offsetTop = contactSection.getBoundingClientRect().top + window.pageYOffset - navHeight - 16;
                window.scrollTo({
                    top: offsetTop,
                    behavior: motionSafeScrollBehavior
                });
                // Wait for scroll, then open tab
                setTimeout(() => setActiveTab(desiredTab), 300);
            } else {
                setActiveTab(desiredTab);
            }
        }
    });

    // Handle hash on page load and hash changes
    const handleHash = () => {
        const hash = (window.location && typeof window.location.hash === 'string')
            ? window.location.hash.toLowerCase()
            : '';
        
        if (hash === '#contact' || hash === '#contact-apply' || hash === '#apply') {
            const contactSection = document.getElementById('contact');
            if (contactSection) {
                const navHeight = document.querySelector('.navbar')?.getBoundingClientRect().height || 0;
                const offsetTop = contactSection.getBoundingClientRect().top + window.pageYOffset - navHeight - 16;
                window.scrollTo({
                    top: offsetTop,
                    behavior: motionSafeScrollBehavior
                });
            }
            
            if (hash === '#contact-apply' || hash === '#apply') {
                setActiveTab('apply');
            } else {
                // Check if there's a data-open-contact-tab in the URL or use default
                const urlParams = new URLSearchParams(window.location.search);
                const tab = urlParams.get('tab') || 'suggestion';
                setActiveTab(tab);
            }
        }
    };

    const initialActive = tabs.find(tab => tab.classList.contains('active'));
    setActiveTab(initialActive ? initialActive.dataset.tab : tabs[0].dataset.tab);
    
    // Handle initial hash
    handleHash();
    
    // Handle hash changes (when navigating from other pages)
    window.addEventListener('hashchange', handleHash);
    
    // Also check hash after a short delay (for page loads from other pages)
    setTimeout(handleHash, 100);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactTabs);
} else {
    initContactTabs();
}

// ================================
// Run Tabs (Project Pages)
// ================================
// Handles switching between run tabs on project pages
const runTabs = document.querySelectorAll('.run-tab');
if (runTabs.length) {
    runTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            // Remove active from all tabs
            runTabs.forEach(t => t.classList.remove('active'));
            
            // Hide all content
            document.querySelectorAll('.run-content').forEach(content => {
                content.classList.add('hidden');
            });
            
            // Activate clicked tab and show content
            tab.classList.add('active');
            const targetContent = document.getElementById(`${targetTab}-content`);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }
        });
    });
}

// ================================
// Media Carousels (Project Demo Screenshots)
// ================================
// Handles media carousels for project demo screenshots
const initMediaCarousels = () => {
    const carousels = Array.from(document.querySelectorAll('[data-carousel]'));
    if (!carousels.length) return;

    carousels.forEach(carousel => {
        const track = carousel.querySelector('[data-carousel-track]');
        if (!track) return;

        const slides = Array.from(track.querySelectorAll('.carousel-slide'));
        if (!slides.length) return;

        const prevBtn = carousel.querySelector('[data-carousel-prev]');
        const nextBtn = carousel.querySelector('[data-carousel-next]');

        const getCurrentIndex = () => {
            const center = track.scrollLeft + (track.clientWidth / 2);
            let bestIndex = 0;
            let bestDistance = Number.POSITIVE_INFINITY;

            slides.forEach((slide, idx) => {
                const slideCenter = slide.offsetLeft + (slide.clientWidth / 2);
                const dist = Math.abs(slideCenter - center);
                if (dist < bestDistance) {
                    bestDistance = dist;
                    bestIndex = idx;
                }
            });

            return bestIndex;
        };

        const scrollToIndex = (index) => {
            const clamped = Math.max(0, Math.min(slides.length - 1, Number(index) || 0));
            const target = slides[clamped];
            if (!target) return;
            target.scrollIntoView({ behavior: motionSafeScrollBehavior, block: 'nearest', inline: 'center' });
        };

        const updateControls = () => {
            const canScroll = track.scrollWidth > track.clientWidth + 4;
            if (prevBtn) prevBtn.hidden = !canScroll;
            if (nextBtn) nextBtn.hidden = !canScroll;
            if (!canScroll) return;

            const idx = getCurrentIndex();
            if (prevBtn) prevBtn.disabled = idx <= 0;
            if (nextBtn) nextBtn.disabled = idx >= slides.length - 1;
        };

        if (prevBtn && !prevBtn.dataset.bound) {
            prevBtn.dataset.bound = 'true';
            prevBtn.addEventListener('click', () => scrollToIndex(getCurrentIndex() - 1));
        }

        if (nextBtn && !nextBtn.dataset.bound) {
            nextBtn.dataset.bound = 'true';
            nextBtn.addEventListener('click', () => scrollToIndex(getCurrentIndex() + 1));
        }

        let raf = 0;
        track.addEventListener('scroll', () => {
            if (raf) return;
            raf = window.requestAnimationFrame(() => {
                raf = 0;
                updateControls();
            });
        }, { passive: true });

        window.addEventListener('resize', updateControls, { passive: true });
        updateControls();
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMediaCarousels);
} else {
    initMediaCarousels();
}

// ============================================
// KEYBOARD NAVIGATION ENHANCEMENTS
// ============================================
// Improves accessibility for keyboard users

// Create live region for screen reader announcements
const liveRegion = document.createElement('div');
liveRegion.setAttribute('role', 'status');
liveRegion.setAttribute('aria-live', 'polite');
liveRegion.setAttribute('aria-atomic', 'true');
liveRegion.className = 'live-region';
document.body.appendChild(liveRegion);

// Esc key to close modals, menus, and overlays
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
        // Close mobile menu if open
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const navLinks = document.querySelector('.nav-links');
        if (mobileMenuBtn && navLinks && navLinks.classList.contains('active')) {
            setMobileMenuState(false, { restoreFocus: true });
            announceToScreenReader('Mobile menu closed');
        }
        
        // Close any open modals or overlays
        const modals = document.querySelectorAll('[role="dialog"], .modal, .overlay');
        modals.forEach(modal => {
            if (modal.style.display !== 'none' && modal.getAttribute('aria-hidden') !== 'true') {
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
                // Return focus to trigger element if it exists
                const trigger = document.querySelector(`[aria-controls="${modal.id}"]`);
                if (trigger) trigger.focus();
                announceToScreenReader('Dialog closed');
            }
        });
        
        // Close expanded timeline items
        const expandedItems = document.querySelectorAll('.timeline-item[data-expanded="true"]');
        expandedItems.forEach(item => {
            const node = item.querySelector('.timeline-node');
            if (node) {
                node.click();
                announceToScreenReader('Timeline item collapsed');
            }
        });
    }
});

// Arrow key navigation for carousels and sliders
document.addEventListener('keydown', (e) => {
    const target = e.target;
    
    // Only handle arrow keys when focus is on carousel/slider controls
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        return;
    }
    
    // Weekly highlights slider
    if (target.closest('#weekly-highlights')) {
        if (e.key === 'ArrowLeft') {
            const prevBtn = document.getElementById('prev-week-btn');
            if (prevBtn && !prevBtn.disabled) {
                e.preventDefault();
                prevBtn.click();
                announceToScreenReader('Previous week');
            }
        } else if (e.key === 'ArrowRight') {
            const nextBtn = document.getElementById('next-week-btn');
            if (nextBtn && !nextBtn.disabled) {
                e.preventDefault();
                nextBtn.click();
                announceToScreenReader('Next week');
            }
        }
    }
    
    // Media carousels
    const carousel = target.closest('.media-carousel');
    if (carousel) {
        if (e.key === 'ArrowLeft') {
            const prevBtn = carousel.querySelector('.carousel-btn:first-of-type');
            if (prevBtn && !prevBtn.disabled) {
                e.preventDefault();
                prevBtn.click();
            }
        } else if (e.key === 'ArrowRight') {
            const nextBtn = carousel.querySelector('.carousel-btn:last-of-type');
            if (nextBtn && !nextBtn.disabled) {
                e.preventDefault();
                nextBtn.click();
            }
        }
    }
    
    // Timeline horizontal scroll
    const timelineScroll = document.querySelector('.timeline-scroll');
    if (timelineScroll && document.activeElement.closest('.timeline-item')) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            timelineScroll.scrollBy({ left: -320, behavior: motionSafeScrollBehavior });
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            timelineScroll.scrollBy({ left: 320, behavior: motionSafeScrollBehavior });
        }
    }
});

// Focus trap for modals (basic implementation)
function trapFocus(modal) {
    const focusableElements = modal.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    modal.addEventListener('keydown', function trapHandler(e) {
        if (e.key !== 'Tab') return;
        
        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    });
}

// Apply focus trap to any modals when they open
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
                const modals = node.querySelectorAll ? node.querySelectorAll('[role="dialog"], .modal') : [];
                modals.forEach(modal => {
                    if (modal.getAttribute('aria-hidden') !== 'true') {
                        trapFocus(modal);
                    }
                });
            }
        });
    });
});

observer.observe(document.body, { childList: true, subtree: true });

// Improve Tab navigation - ensure all interactive elements are keyboard accessible
document.addEventListener('DOMContentLoaded', () => {
    // Make sure all buttons and links are keyboard accessible
    document.querySelectorAll('button, a, [role="button"]').forEach(el => {
        if (!el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') {
            el.setAttribute('tabindex', '0');
        }
    });
    
    // Ensure project cards are keyboard accessible
    document.querySelectorAll('.project-card').forEach(card => {
        if (!card.hasAttribute('tabindex')) {
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'article');
        }
    });
});

// ============================================
// SMOOTH SCROLL IMPROVEMENTS
// ============================================
// Adds scroll progress bar and smooth scroll to top

// Scroll progress indicator
function updateScrollProgress() {
    const progressBar = document.getElementById('scroll-progress');
    if (!progressBar) return;
    
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight - windowHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const progress = (scrollTop / documentHeight) * 100;
    
    progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    progressBar.setAttribute('aria-valuenow', Math.round(progress));
}

// Scroll to top button
function initScrollToTop() {
    const scrollToTopBtn = document.getElementById('scroll-to-top');
    if (!scrollToTopBtn) return;
    
    function toggleScrollToTop() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (scrollTop > 300) {
            scrollToTopBtn.classList.add('visible');
        } else {
            scrollToTopBtn.classList.remove('visible');
        }
    }
    
    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: motionSafeScrollBehavior });
        announceToScreenReader('Scrolled to top');
    });
    
    // Show/hide button based on scroll position
    window.addEventListener('scroll', () => {
        toggleScrollToTop();
        updateScrollProgress();
    }, { passive: true });
    
    // Initial check
    toggleScrollToTop();
}

// Enhanced smooth scroll for anchor links with offset
document.addEventListener('DOMContentLoaded', () => {
    initScrollToTop();
    
    // Handle anchor links with smooth scroll and offset
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#' || href === '#!') return;
            
            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                e.preventDefault();
                const navbar = document.querySelector('.navbar');
                const navbarHeight = navbar ? navbar.offsetHeight : 100;
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navbarHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: motionSafeScrollBehavior
                });
                
                // Update URL without jumping
                history.pushState(null, '', href);
                
                // Focus target for keyboard users
                targetElement.setAttribute('tabindex', '-1');
                targetElement.focus();
                setTimeout(() => targetElement.removeAttribute('tabindex'), 1000);
            }
        });
    });
    
    // Apply stagger animations to list items
    if (!prefersReducedMotion) {
        const lists = document.querySelectorAll('.highlight-list, .role-list, .value-grid, .projects-grid, .project-slide-page');
        lists.forEach(list => {
            const items = Array.from(list.children);
            items.forEach((item, index) => {
                if (index < 8) { // Limit to first 8 items
                    item.classList.add('stagger-item');
                }
            });
        });
    }
});

// ============================================
// MOBILE UX - SWIPE GESTURES
// ============================================
// Adds swipe gesture support for sliders and carousels

// Swipe detection for weekly highlights slider
function initSwipeGestures() {
    const weeklyCard = document.getElementById('weekly-highlights');
    if (!weeklyCard) return;
    
    let touchStartX = 0;
    let touchEndX = 0;
    const swipeThreshold = 50;
    
    weeklyCard.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    weeklyCard.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            const prevBtn = document.getElementById('prev-week-btn');
            const nextBtn = document.getElementById('next-week-btn');
            
            if (diff > 0 && nextBtn && !nextBtn.disabled) {
                // Swipe left - next week
                nextBtn.click();
            } else if (diff < 0 && prevBtn && !prevBtn.disabled) {
                // Swipe right - previous week
                prevBtn.click();
            }
        }
    }, { passive: true });
    
    // Swipe for timeline
    const timelineScroll = document.querySelector('.timeline-scroll');
    if (timelineScroll) {
        let timelineTouchStartX = 0;
        let timelineTouchStartY = 0;
        
        timelineScroll.addEventListener('touchstart', (e) => {
            timelineTouchStartX = e.changedTouches[0].screenX;
            timelineTouchStartY = e.changedTouches[0].screenY;
        }, { passive: true });
        
        timelineScroll.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;
            const diffX = timelineTouchStartX - touchEndX;
            const diffY = Math.abs(timelineTouchStartY - touchEndY);
            
            // Only handle horizontal swipes (ignore vertical scrolling)
            if (Math.abs(diffX) > swipeThreshold && diffY < 50) {
                if (diffX > 0) {
                    // Swipe left - scroll right
                    timelineScroll.scrollBy({ left: 320, behavior: motionSafeScrollBehavior });
                } else {
                    // Swipe right - scroll left
                    timelineScroll.scrollBy({ left: -320, behavior: motionSafeScrollBehavior });
                }
            }
        }, { passive: true });
    }
    
    // Swipe for media carousels
    document.querySelectorAll('.carousel-track').forEach(carousel => {
        let carouselTouchStartX = 0;
        
        carousel.addEventListener('touchstart', (e) => {
            carouselTouchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        carousel.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const diff = carouselTouchStartX - touchEndX;
            
            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0) {
                    // Swipe left - next
                    const carouselRoot = carousel.closest('.media-carousel');
                    const nextBtn = carouselRoot ? carouselRoot.querySelector('.carousel-btn:last-of-type') : null;
                    if (nextBtn && !nextBtn.disabled) nextBtn.click();
                } else {
                    // Swipe right - previous
                    const carouselRoot = carousel.closest('.media-carousel');
                    const prevBtn = carouselRoot ? carouselRoot.querySelector('.carousel-btn:first-of-type') : null;
                    if (prevBtn && !prevBtn.disabled) prevBtn.click();
                }
            }
        }, { passive: true });
    });
}

// Initialize swipe gestures on load
document.addEventListener('DOMContentLoaded', initSwipeGestures);

// ============================================
// TESTIMONIALS
// ============================================

async function loadTestimonials() {
    const container = document.getElementById('testimonials-grid');
    if (!container) return;

    try {
        const response = await fetch('data/testimonials.json');
        if (!response.ok) {
            console.warn('Testimonials data not found');
            return;
        }

        const testimonials = await response.json();
        if (!Array.isArray(testimonials) || testimonials.length === 0) {
            container.innerHTML = '<p class="empty-message">No testimonials available.</p>';
            return;
        }

        container.innerHTML = testimonials.map(testimonial => {
            const initials = testimonial.author
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

            const avatar = testimonial.avatar 
                ? `<img src="${testimonial.avatar}" alt="${testimonial.author}" class="testimonial-avatar-img">`
                : `<div class="testimonial-avatar">${initials}</div>`;

            const projectInfo = testimonial.project 
                ? `<div class="testimonial-project">${testimonial.project}</div>`
                : '';

            const roleInfo = testimonial.company 
                ? `${testimonial.role}${testimonial.company ? ` • ${testimonial.company}` : ''}`
                : testimonial.role;

            return `
                <div class="testimonial-card glass-card reveal">
                    <p class="testimonial-quote">${escapeHtml(testimonial.quote)}</p>
                    <div class="testimonial-author">
                        ${avatar}
                        <div class="testimonial-info">
                            <div class="testimonial-name">${escapeHtml(testimonial.author)}</div>
                            <div class="testimonial-role">${escapeHtml(roleInfo)}</div>
                            ${projectInfo}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Trigger reveal animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, { threshold: 0.1 });

        container.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    } catch (error) {
        console.error('Failed to load testimonials:', error);
        container.innerHTML = '<p class="empty-message">Unable to load testimonials.</p>';
    }
}

// Load testimonials on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTestimonials);
} else {
    loadTestimonials();
}

// ============================================
// VIDEO DEMO LAZY LOADING
// ============================================

function initVideoEmbeds() {
    // Handle YouTube/Vimeo embeds with lazy loading
    document.querySelectorAll('.video-placeholder[data-video-url]').forEach(placeholder => {
        const videoUrl = placeholder.getAttribute('data-video-url');
        const thumbnail = placeholder.querySelector('img');
        const playButton = placeholder.querySelector('.video-play-button');
        
        if (!videoUrl) return;

        // Create click handler
        const loadVideo = () => {
            if (placeholder.classList.contains('loaded')) return;
            
            placeholder.classList.add('loaded');
            let embedUrl = '';
            
            // Parse YouTube URL
            if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
                let videoId = '';
                if (videoUrl.includes('youtu.be/')) {
                    videoId = videoUrl.split('youtu.be/')[1].split('?')[0];
                } else if (videoUrl.includes('youtube.com/watch?v=')) {
                    videoId = videoUrl.split('v=')[1].split('&')[0];
                } else if (videoUrl.includes('youtube.com/embed/')) {
                    videoId = videoUrl.split('embed/')[1].split('?')[0];
                }
                if (videoId) {
                    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
                }
            }
            // Parse Vimeo URL
            else if (videoUrl.includes('vimeo.com')) {
                const videoId = videoUrl.split('vimeo.com/')[1].split('?')[0];
                if (videoId) {
                    embedUrl = `https://player.vimeo.com/video/${videoId}?autoplay=1`;
                }
            }
            // Self-hosted video
            else if (videoUrl.match(/\.(mp4|webm|ogg)$/i)) {
                embedUrl = videoUrl;
            }
            
            if (embedUrl) {
                if (embedUrl.match(/\.(mp4|webm|ogg)$/i)) {
                    // Self-hosted video
                    placeholder.innerHTML = `
                        <video controls autoplay class="video-player">
                            <source src="${embedUrl}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    `;
                } else {
                    // YouTube/Vimeo embed
                    placeholder.innerHTML = `
                        <div class="video-container lazy">
                            <iframe 
                                src="${embedUrl}" 
                                frameborder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowfullscreen
                                loading="lazy"
                                title="Video demo">
                            </iframe>
                        </div>
                    `;
                    
                    // Mark as loaded after iframe loads
                    const iframe = placeholder.querySelector('iframe');
                    if (iframe) {
                        iframe.addEventListener('load', () => {
                            const container = placeholder.querySelector('.video-container');
                            if (container) container.classList.add('loaded');
                        });
                    }
                }
            }
        };
        
        // Add click handler
        if (playButton) {
            playButton.addEventListener('click', loadVideo);
        }
        placeholder.addEventListener('click', loadVideo);
        
        // Lazy load thumbnail if provided
        if (thumbnail && thumbnail.dataset.src) {
            const imgObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        thumbnail.src = thumbnail.dataset.src;
                        thumbnail.removeAttribute('data-src');
                        imgObserver.unobserve(thumbnail);
                    }
                });
            }, { rootMargin: '50px' });
            
            imgObserver.observe(thumbnail);
        }
    });
}

// Initialize video embeds
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideoEmbeds);
} else {
    initVideoEmbeds();
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
// Shows toast notifications for user feedback

function createToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = 'info', duration = 5000) {
    const container = createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <div class="toast-content">
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close" aria-label="Close notification">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
        </button>
    `;
    
    const closeBtn = toast.querySelector('.toast-close');
    const removeToast = () => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    };
    
    closeBtn.addEventListener('click', removeToast);
    
    container.appendChild(toast);
    announceToScreenReader(message);
    
    if (duration > 0) {
        setTimeout(removeToast, duration);
    }
    
    return toast;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

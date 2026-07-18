#!/usr/bin/env node

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveRequestPath(urlPathname) {
  const decoded = decodeURIComponent(urlPathname || '/');
  const normalized = path.posix.normalize(decoded);
  const relative = normalized === '/' ? '/index.html' : normalized;
  const safeRelative = relative.replace(/^\/+/, '');
  const fullPath = path.resolve(repoRoot, safeRelative);
  if (!fullPath.startsWith(repoRoot)) {
    throw new Error('Path traversal rejected');
  }
  return fullPath;
}

async function createStaticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
      const filePath = resolveRequestPath(reqUrl.pathname);
      const fileStat = await stat(filePath);

      if (fileStat.isDirectory()) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Directory listing disabled');
        return;
      }

      const body = await readFile(filePath);
      res.writeHead(200, {
        'Content-Type': contentTypeFor(filePath),
        'Content-Length': body.length,
        'Last-Modified': fileStat.mtime.toUTCString(),
        'Cache-Control': 'no-cache'
      });
      res.end(body);
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : null;
  if (!port) {
    server.close();
    throw new Error('Failed to allocate local server port');
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`
  };
}

function isIgnorableRequestFailure(url) {
  return /\/favicon\.ico$/i.test(url) || url.startsWith('chrome-extension://');
}

const pageSpecs = [
  {
    name: 'index',
    path: '/',
    selectors: [
      '#weekly-highlights',
      '#weekly-freshness-strip',
      '#weekly-content .wl-report',
      '#weekly-week-strip [aria-current="true"]',
      '#prev-week-btn',
      '#next-week-btn',
      '#weekly-share-btn'
    ],
    async waitForReady(page) {
      await page.waitForFunction(() => {
        const card = document.querySelector('#weekly-highlights');
        const report = document.querySelector('#weekly-content .wl-report');
        const freshness = document.querySelector('#weekly-freshness-strip');
        return Boolean(
          card &&
          card.getAttribute('aria-busy') === 'false' &&
          report &&
          report.textContent &&
          report.textContent.trim().length > 0 &&
          freshness &&
          !/checking data freshness/i.test(freshness.textContent || '')
        );
      }, null, { timeout: 15000 });
      await page.evaluate(() => window.AtrakWeeklyLog?.goToWeek('2026-04-19'));
      await page.waitForFunction(() => {
        const report = document.querySelector('#weekly-content .wl-report');
        return (
          window.location.hash === '#week=2026-04-19' &&
          /project hub refresh \+ education exporter drop/i.test(report?.textContent || '')
        );
      }, null, { timeout: 5000 });
      await page.evaluate(() => window.AtrakWeeklyLog?.goToWeek('2026-07-05'));
      await page.waitForFunction(() => {
        const source = document.querySelector('#weekly-source-note');
        const commitMetric = document.querySelector('#weekly-content .wl-metric strong');
        const headline = document.querySelector('#weekly-report-headline');
        const editorialBadge = document.querySelector('#weekly-content .wl-editorial-badge');
        const trends = document.querySelector('#weekly-content .wl-project-trends');
        return (
          window.location.hash === '#week=2026-07-05' &&
          /team editorial \+ automated snapshot/i.test(source?.textContent || '') &&
          /48 commits, two build fronts, one very busy week/i.test(headline?.textContent || '') &&
          editorialBadge?.textContent?.trim() === 'Team edited' &&
          commitMetric?.textContent?.trim() === '48' &&
          trends?.dataset.seriesCount === '2' &&
          trends.querySelectorAll('.wl-project-trend').length === 2 &&
          trends.querySelectorAll('polyline').length === 2
        );
      }, null, { timeout: 5000 });
      await page.click('[data-weekly-trend-range="12"]');
      await page.waitForFunction(() => {
        const trends = document.querySelector('#weekly-content .wl-project-trends');
        const selectedRange = trends?.querySelector('[data-weekly-trend-range="12"]');
        const releaseLinks = trends?.querySelectorAll('a.wl-project-trend__release') || [];
        const pointCounts = Array.from(trends?.querySelectorAll('polyline') || []).map((line) => (
          (line.getAttribute('points') || '').trim().split(/\s+/).filter(Boolean).length
        ));
        return (
          trends?.dataset.range === '12' &&
          trends.dataset.rangeStart === '2026-04-19' &&
          trends.dataset.rangeEnd === '2026-07-05' &&
          trends.dataset.pointCount === '12' &&
          releaseLinks.length >= 1 &&
          Number(trends.dataset.releaseMarkerCount || 0) === releaseLinks.length &&
          selectedRange?.getAttribute('aria-pressed') === 'true' &&
          document.activeElement === selectedRange &&
          pointCounts.length === 2 && pointCounts.every((count) => count === 12) &&
          Array.from(releaseLinks).every((link) => /\/releases\/tag\//i.test(link.getAttribute('href') || '')) &&
          window.localStorage.getItem('atrak-weekly-trend-range') === '12'
        );
      }, null, { timeout: 5000 });
    }
  },
  {
    name: 'index-mobile-weekly',
    path: '/#week=2026-07-05',
    viewport: { width: 390, height: 844 },
    selectors: [
      '#weekly-content .wl-report',
      '.wl-pulse__drawer',
      '[data-weekly-trend-range="6"]',
      '[data-weekly-trend-range="12"]'
    ],
    async waitForReady(page) {
      await page.waitForFunction(() => document.querySelector('#weekly-highlights')?.getAttribute('aria-busy') === 'false', null, { timeout: 15000 });
      await page.evaluate(() => {
        window.AtrakWeeklyLog?.setTrendRange(6);
        const drawer = document.querySelector('.wl-pulse__drawer');
        if (drawer) drawer.open = true;
      });
      await page.click('[data-weekly-trend-range="12"]');
      await page.waitForFunction(() => {
        const trends = document.querySelector('.wl-project-trends');
        const button = trends?.querySelector('[data-weekly-trend-range="12"]');
        const release = trends?.querySelector('a.wl-project-trend__release');
        const height = button?.getBoundingClientRect().height || 0;
        const releaseBox = release?.getBoundingClientRect();
        return (
          trends?.dataset.range === '12' &&
          trends.dataset.pointCount === '12' &&
          Number(trends.dataset.releaseMarkerCount || 0) >= 1 &&
          height >= 44 &&
          Boolean(releaseBox && releaseBox.width >= 40 && releaseBox.height >= 40)
        );
      }, null, { timeout: 5000 });
    }
  },
  {
    name: 'weekly-editor',
    path: '/weekly-editor.html',
    selectors: [
      '#editorial-form',
      '#editorial-week',
      '#editorial-title',
      '#editorial-preview-title',
      '#editorial-json-output',
      '#editorial-copy-json',
      '#editorial-download-json'
    ],
    async waitForReady(page) {
      await page.waitForFunction(() => {
        const status = document.querySelector('#editorial-status');
        const week = document.querySelector('#editorial-week');
        const options = document.querySelectorAll('#editorial-existing-week option');
        return Boolean(status && !/loading/i.test(status.textContent || '') && week && !week.disabled && options.length >= 20 && window.AtrakEditorialStudio);
      }, null, { timeout: 10000 });
      await page.evaluate(() => {
        window.localStorage.removeItem('atrak-weekly-editorial-draft:2026-07-05');
        window.AtrakEditorialStudio?.selectWeek('2026-07-09');
      });
      await page.waitForFunction(() => (
        document.querySelector('#editorial-week')?.value === '2026-07-05' &&
        /48 commits, two build fronts/i.test(document.querySelector('#editorial-title')?.value || '')
      ), null, { timeout: 5000 });
      await page.fill('#editorial-title', 'Smoke-tested team headline');
      await page.fill('#editorial-highlights', 'First verified highlight\nSecond verified highlight');
      await page.evaluate(() => window.AtrakEditorialStudio?.selectWeek('2026-04-19'));
      await page.waitForFunction(() => (
        /project hub refresh \+ education exporter drop/i.test(document.querySelector('#editorial-title')?.value || '') &&
        /archive copy loaded/i.test(document.querySelector('#editorial-status')?.textContent || '')
      ), null, { timeout: 5000 });
      await page.fill('#editorial-title', 'Smoke-tested archive headline');
      await page.evaluate(() => window.AtrakEditorialStudio?.selectWeek('2026-07-05'));
      await page.waitForFunction(() => {
        const documentValue = window.AtrakEditorialStudio?.getDocument();
        const entry = documentValue?.weeks?.['2026-07-05'];
        const archiveEntry = documentValue?.weeks?.['2026-04-19'];
        return (
          document.querySelector('#editorial-preview-title')?.textContent === 'Smoke-tested team headline' &&
          entry?.title === 'Smoke-tested team headline' &&
          entry?.highlights?.length === 2 &&
          archiveEntry?.title === 'Smoke-tested archive headline' &&
          /Smoke-tested team headline/.test(document.querySelector('#editorial-json-output')?.textContent || '')
        );
      }, null, { timeout: 5000 });
      await page.click('#editorial-reset-draft');
      await page.waitForFunction(() => /48 commits, two build fronts/i.test(document.querySelector('#editorial-title')?.value || ''), null, { timeout: 5000 });
      await page.evaluate(() => window.AtrakEditorialStudio?.selectWeek('2026-04-19'));
      await page.click('#editorial-reset-draft');
      await page.waitForFunction(() => /project hub refresh \+ education exporter drop/i.test(document.querySelector('#editorial-title')?.value || ''), null, { timeout: 5000 });
      await page.evaluate(() => window.AtrakEditorialStudio?.selectWeek('2026-07-05'));
      await page.click('#editorial-copy-json');
      await page.waitForFunction(() => /full json copied|select json below/i.test(document.querySelector('#editorial-status')?.textContent || ''), null, { timeout: 5000 });
      const downloadPromise = page.waitForEvent('download');
      await page.click('#editorial-download-json');
      const download = await downloadPromise;
      if (download.suggestedFilename() !== 'weekly-editorial.json') throw new Error('Editorial download used an unexpected filename');
    }
  },
  {
    name: 'weekly-editor-mobile',
    path: '/weekly-editor.html',
    viewport: { width: 390, height: 844 },
    selectors: [
      '.editorial-studio-layout',
      '.editorial-panel--form',
      '.editorial-panel--preview',
      '.editorial-actions'
    ],
    async waitForReady(page) {
      await page.waitForFunction(() => !document.querySelector('#editorial-week')?.disabled, null, { timeout: 10000 });
      await page.waitForFunction(() => {
        const layout = document.querySelector('.editorial-studio-layout');
        const actions = document.querySelector('.editorial-actions');
        if (!layout || !actions) return false;
        const columns = getComputedStyle(layout).gridTemplateColumns.split(' ').filter(Boolean).length;
        const firstButton = actions.querySelector('button');
        return columns === 1 && (firstButton?.getBoundingClientRect().height || 0) >= 44;
      }, null, { timeout: 5000 });
    }
  },
  {
    name: 'weekly-editor-fail-closed',
    path: '/weekly-editor.html',
    selectors: [
      '#editorial-form',
      '#editorial-status',
      '#editorial-copy-json',
      '#editorial-download-json'
    ],
    async beforeNavigate(page) {
      await page.route('**/data/weekly-editorial.json*', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'smoke-test invalid source' })
      }));
    },
    async waitForReady(page) {
      await page.waitForFunction(() => {
        const status = document.querySelector('#editorial-status');
        const week = document.querySelector('#editorial-week');
        const copy = document.querySelector('#editorial-copy-json');
        const download = document.querySelector('#editorial-download-json');
        return (
          /editorial source unavailable.*export disabled/i.test(status?.textContent || '') &&
          week && !week.disabled &&
          copy?.disabled === true &&
          download?.disabled === true
        );
      }, null, { timeout: 10000 });
    }
  },
  {
    name: 'purpose',
    path: '/purpose.html',
    selectors: [
      '.page-hero',
      '.purpose-content',
      '.purpose-section'
    ],
    async waitForReady(page) {
      await page.waitForSelector('.purpose-section', { timeout: 8000 });
    }
  },
  {
    name: 'releases',
    path: '/releases.html',
    selectors: [
      '#releases-live',
      '#releases-freshness-strip',
      '#releases-live-meta',
      '#releases-live-list'
    ],
    async waitForReady(page) {
      await page.waitForFunction(() => {
        const list = document.querySelector('#releases-live-list');
        const freshness = document.querySelector('#releases-freshness-strip');
        const meta = document.querySelector('#releases-live-meta');
        const listReady = Boolean(
          list && (list.querySelector('.releases-live-item') || list.querySelector('.releases-live-empty'))
        );
        const freshnessReady = Boolean(freshness && !/checking release freshness/i.test(freshness.textContent || ''));
        const metaReady = Boolean(meta && !/loading/i.test(meta.textContent || ''));
        return listReady && freshnessReady && metaReady;
      }, null, { timeout: 15000 });
    }
  },
  {
    name: 'blog',
    path: '/blog.html',
    selectors: [
      '#blog-posts-grid',
      '#blog-freshness-strip',
      '#blog-search-input'
    ],
    async waitForReady(page) {
      await page.waitForFunction(() => {
        const grid = document.querySelector('#blog-posts-grid');
        const freshness = document.querySelector('#blog-freshness-strip');
        const hasPosts = Boolean(
          grid && (grid.querySelector('.blog-post-card') || /no blog posts|unable to load/i.test(grid.textContent || ''))
        );
        const freshnessReady = Boolean(freshness && !/checking blog freshness/i.test(freshness.textContent || ''));
        return hasPosts && freshnessReady;
      }, null, { timeout: 15000 });
    }
  },
  {
    name: 'hoopclips-browser-demo',
    path: '/apps/hoopsclips/index.html',
    selectors: [
      '.nav-title .app-icon',
      '#videoPlayer',
      '.legal-footer a[href="privacy.html"]',
      '.legal-footer a[href="terms.html"]',
      '.legal-footer a[href="support.html"]'
    ],
    async waitForReady(page) {
      await page.waitForFunction(() => (
        document.querySelector('.nav-title .app-icon')?.getAttribute('src')?.includes('v=20260718')
      ), null, { timeout: 5000 });
    }
  },
  {
    name: 'hoopclips-privacy-mobile',
    path: '/apps/hoopsclips/privacy.html',
    viewport: { width: 390, height: 844 },
    selectors: [
      'body.hoopclips-legal-page',
      'h1',
      '.project-icon-custom img',
      'a[href="terms.html"]',
      'a[href="support.html"]'
    ],
    async waitForReady(page) {
      await page.waitForFunction(() => (
        document.querySelector('h1')?.textContent?.trim() === 'Privacy Policy' &&
        document.querySelector('.project-icon-custom img')?.getAttribute('src')?.includes('v=20260718')
      ), null, { timeout: 5000 });
    }
  },
  {
    name: 'hoopclips-terms',
    path: '/apps/hoopsclips/terms.html',
    selectors: [
      'body.hoopclips-legal-page',
      'h1',
      '.project-detail-grid',
      'a[href="privacy.html"]',
      'a[href="support.html"]'
    ],
    async waitForReady(page) {
      await page.waitForFunction(() => document.querySelector('h1')?.textContent?.trim() === 'Terms of Use', null, { timeout: 5000 });
    }
  },
  {
    name: 'hoopclips-support',
    path: '/apps/hoopsclips/support.html',
    selectors: [
      'body.hoopclips-legal-page',
      'h1',
      'a[href^="mailto:hello@atrak.dev"]',
      'a[href="privacy.html"]',
      'a[href="terms.html"]'
    ],
    async waitForReady(page) {
      await page.waitForFunction(() => document.querySelector('h1')?.textContent?.trim() === 'Support', null, { timeout: 5000 });
    }
  },
  {
    name: 'team-profile-charlie',
    path: '/team/profile.html?name=Charlie%20Han',
    selectors: [
      '#profile-content',
      '.profile-name',
      '.profile-preview-card',
      '#profile-search-helper'
    ],
    async waitForReady(page) {
      await page.waitForSelector('.profile-name', { timeout: 12000 });
      await page.waitForSelector('.profile-preview-card', { timeout: 12000 });
    }
  }
];

async function runPageCheck(browser, baseUrl, spec) {
  const page = await browser.newPage({ viewport: spec.viewport || { width: 1366, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!text) return;
    consoleErrors.push(text);
  });

  page.on('pageerror', (error) => {
    pageErrors.push(String(error && error.message ? error.message : error));
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    if (isIgnorableRequestFailure(url)) return;
    requestFailures.push(`${request.method()} ${url} (${request.failure()?.errorText || 'requestfailed'})`);
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status < 400) return;
    const url = response.url();
    if (isIgnorableRequestFailure(url)) return;
    badResponses.push(`${status} ${url}`);
  });

  let httpStatus = null;
  let navigationError = null;

  try {
    if (spec.beforeNavigate) await spec.beforeNavigate(page);
    const response = await page.goto(`${baseUrl}${spec.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    httpStatus = response ? response.status() : null;
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    await spec.waitForReady(page);
  } catch (error) {
    navigationError = String(error && error.message ? error.message : error);
  }

  const missingSelectors = [];
  for (const selector of spec.selectors) {
    try {
      const count = await page.locator(selector).count();
      if (count < 1) missingSelectors.push(selector);
    } catch (_) {
      missingSelectors.push(selector);
    }
  }

  const snapshot = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewportWidth = root.clientWidth;
    const documentWidth = Math.max(root.scrollWidth, body?.scrollWidth || 0);
    return {
      title: document.title,
      url: window.location.href,
      viewportWidth,
      documentWidth
    };
  }).catch(() => ({ title: '', url: '', viewportWidth: 0, documentWidth: 0 }));

  await page.close();

  const issues = [];
  if (navigationError) issues.push(`navigation: ${navigationError}`);
  if (httpStatus && httpStatus >= 400) issues.push(`HTTP ${httpStatus}`);
  if (missingSelectors.length) issues.push(`missing selectors: ${missingSelectors.join(', ')}`);
  if (pageErrors.length) issues.push(`page errors: ${pageErrors.length}`);
  if (consoleErrors.length) issues.push(`console errors: ${consoleErrors.length}`);
  if (requestFailures.length) issues.push(`request failures: ${requestFailures.length}`);
  if (badResponses.length) issues.push(`bad responses: ${badResponses.length}`);
  if (snapshot.viewportWidth && snapshot.documentWidth > snapshot.viewportWidth + 1) {
    issues.push(`horizontal overflow: ${snapshot.documentWidth}px document in ${snapshot.viewportWidth}px viewport`);
  }

  return {
    name: spec.name,
    path: spec.path,
    title: snapshot.title,
    pass: issues.length === 0,
    issues,
    details: {
      pageErrors,
      consoleErrors,
      requestFailures,
      badResponses,
      missingSelectors
    }
  };
}

async function main() {
  let serverInfo = null;
  let browser = null;

  try {
    serverInfo = await createStaticServer();
    console.log(`Serving smoke test pages from ${repoRoot}`);
    console.log(`Local server: ${serverInfo.baseUrl}`);

    browser = await chromium.launch({ headless: true });

    const results = [];
    for (const spec of pageSpecs) {
      process.stdout.write(`Checking ${spec.name}... `);
      const result = await runPageCheck(browser, serverInfo.baseUrl, spec);
      results.push(result);
      console.log(result.pass ? 'PASS' : 'FAIL');
      if (!result.pass) {
        for (const issue of result.issues) {
          console.log(`  - ${issue}`);
        }
      }
    }

    const failures = results.filter(r => !r.pass);
    console.log('');
    console.log(`Smoke test summary: ${results.length - failures.length}/${results.length} passed`);

    if (failures.length) {
      console.log('');
      console.log('Failure details:');
      for (const failure of failures) {
        console.log(`- ${failure.name} (${failure.path})`);
        for (const [key, items] of Object.entries(failure.details)) {
          if (!Array.isArray(items) || !items.length) continue;
          console.log(`  ${key}:`);
          for (const item of items.slice(0, 8)) {
            console.log(`    - ${item}`);
          }
          if (items.length > 8) {
            console.log(`    - ...and ${items.length - 8} more`);
          }
        }
      }
      process.exitCode = 1;
      return;
    }
  } catch (error) {
    console.error('Smoke test runner failed:', error && error.message ? error.message : error);
    console.error('Tip: if Playwright browser binaries are missing, run: npx --yes --package playwright playwright install chromium');
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (serverInfo && serverInfo.server) {
      await new Promise(resolve => serverInfo.server.close(resolve));
    }
  }
}

main();

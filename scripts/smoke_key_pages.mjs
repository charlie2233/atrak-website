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
      }, { timeout: 15000 });
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
      }, { timeout: 15000 });
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
      }, { timeout: 15000 });
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
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
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

  const snapshot = await page.evaluate(() => ({
    title: document.title,
    url: window.location.href
  })).catch(() => ({ title: '', url: '' }));

  await page.close();

  const issues = [];
  if (navigationError) issues.push(`navigation: ${navigationError}`);
  if (httpStatus && httpStatus >= 400) issues.push(`HTTP ${httpStatus}`);
  if (missingSelectors.length) issues.push(`missing selectors: ${missingSelectors.join(', ')}`);
  if (pageErrors.length) issues.push(`page errors: ${pageErrors.length}`);
  if (consoleErrors.length) issues.push(`console errors: ${consoleErrors.length}`);
  if (requestFailures.length) issues.push(`request failures: ${requestFailures.length}`);
  if (badResponses.length) issues.push(`bad responses: ${badResponses.length}`);

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

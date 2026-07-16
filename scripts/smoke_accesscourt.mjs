#!/usr/bin/env node

import http from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const expectedSharedFormEndpoint = 'https://formspree.io/f/mvzqdnov';
const macChromeExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8'
};

function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

async function resolveFilePath(urlPathname) {
  const normalized = path.posix.normalize(decodeURIComponent(urlPathname || '/'));
  const relative = normalized.replace(/^\/+/, '');
  let filePath = path.resolve(repoRoot, relative || 'index.html');
  if (!filePath.startsWith(repoRoot)) throw new Error('Path traversal rejected');

  const fileStat = await stat(filePath);
  if (fileStat.isDirectory()) filePath = path.join(filePath, 'index.html');
  return filePath;
}

async function createStaticServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const filePath = await resolveFilePath(url.pathname);
      const body = await readFile(filePath);
      response.writeHead(200, {
        'Content-Type': contentTypeFor(filePath),
        'Content-Length': body.length,
        'Cache-Control': 'no-cache'
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address !== 'object') throw new Error('Unable to allocate test port');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function listHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.html') ? [entryPath] : [];
  }));
  return nested.flat();
}

async function assertAtrakNavigationCoverage() {
  const htmlFiles = await listHtmlFiles(repoRoot);
  const navFiles = [];
  const missing = [];
  for (const filePath of htmlFiles) {
    const html = await readFile(filePath, 'utf8');
    if (!html.includes('<ul class="nav-links">')) continue;
    navFiles.push(path.relative(repoRoot, filePath));
    const matches = html.match(/<a href="\/accesscourt\/" class="nav-impact-link">🏀 AccessCourt<\/a>/g) || [];
    if (matches.length !== 1) missing.push(path.relative(repoRoot, filePath));
  }
  assert(navFiles.length > 0, 'No Atrak primary navigation files found');
  assert(missing.length === 0, `Atrak AccessCourt nav link missing or duplicated in: ${missing.join(', ')}`);
}

async function auditPage(page, label) {
  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  }));
  assert(layout.documentWidth <= layout.viewportWidth + 1, `${label} has horizontal overflow (${layout.documentWidth}px in ${layout.viewportWidth}px)`);
}

async function runHomeCheck(browser, baseUrl, viewport, label) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseUrl}/accesscourt/`, { waitUntil: 'networkidle' });

  assert(await page.title() === 'AccessCourt | Inclusive sports technology by Atrak', `${label} title mismatch`);
  assert(await page.locator('link[rel="canonical"]').getAttribute('href') === 'https://atrak.dev/accesscourt/', `${label} canonical mismatch`);
  assert(await page.locator('.status-rail').textContent().then(text => /not yet an independent 501\(c\)\(3\)/i.test(text)), `${label} status disclosure missing`);
  assert(await page.locator('.contact-form').getAttribute('action') === expectedSharedFormEndpoint, `${label} shared Atrak Formspree endpoint mismatch`);
  assert(await page.locator('input[name="_subject"]').getAttribute('value') === 'AccessCourt partnership inquiry', `${label} Formspree _subject field mismatch`);
  assert(await page.locator('input[name="source"]').getAttribute('value') === 'AccessCourt website', `${label} Formspree source field mismatch`);
  assert(await page.locator('select[name="interest"] option').count() === 7, `${label} project-interest options mismatch`);
  assert(await page.locator('input[name="_next"]').count() === 0, `${label} should not rely on an unverified Formspree _next field`);
  assert(await page.locator('input[name="adult_confirmation"]').getAttribute('required') !== null, `${label} adult confirmation is not required`);
  assert(await page.locator('.site-nav a[href="https://atrak.dev/"]').count() === 1, `${label} Atrak return link missing from primary navigation`);
  assert(await page.locator('.site-footer a[href="https://atrak.dev/"]').count() === 1, `${label} Atrak return link missing from footer`);
  assert(await page.locator('.project-bridge').count() === 7, `${label} Atrak project ecosystem should show seven connections`);
  assert(await page.locator('.project-bridge[data-stage="live"]').count() === 2, `${label} live project-connection count mismatch`);
  assert(await page.locator('.project-bridge[data-stage="adapt"]').count() === 3, `${label} adapt-next project-connection count mismatch`);
  assert(await page.locator('.project-bridge[data-stage="research"]').count() === 2, `${label} research project-connection count mismatch`);
  assert(await page.locator('.project-bridge a[href^="https://atrak.dev/projects/"]').count() === 4, `${label} absolute Atrak project links mismatch`);
  assert(await page.locator('.hero-media img').evaluate(image => image.complete && image.naturalWidth > 0), `${label} hero asset did not load`);

  if (viewport.width <= 980) {
    await page.click('[data-menu-button]');
    assert(await page.locator('[data-menu-button]').getAttribute('aria-expanded') === 'true', `${label} mobile menu did not open`);
    assert(await page.locator('[data-nav]').evaluate(node => node.classList.contains('is-open')), `${label} mobile menu class missing`);
    assert(await page.locator('.site-nav a[href="https://atrak.dev/"]').isVisible(), `${label} Atrak link is not visible in the open menu`);
  }

  await auditPage(page, label);
  assert(errors.length === 0, `${label} emitted browser errors: ${errors.join(' | ')}`);
  await page.close();
}

async function runCoachCheck(browser, baseUrl, viewport, label) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseUrl}/accesscourt/coach.html`, { waitUntil: 'networkidle' });

  assert(await page.locator('link[rel="canonical"]').getAttribute('href') === 'https://atrak.dev/accesscourt/coach.html', `${label} canonical mismatch`);
  assert(await page.locator('#sequence-list li').count() === 6, `${label} should render six drill steps`);
  assert(await page.locator('.coach-settings a[href="https://atrak.dev/"]').count() === 1, `${label} Atrak return link missing`);
  assert(await page.locator('#step-title').textContent() === 'Get ready', `${label} initial step mismatch`);

  await page.click('#next');
  assert(await page.locator('#step-title').textContent() === 'Hold the ball', `${label} next step did not update`);
  await page.selectOption('#language', 'zh');
  assert(await page.locator('#step-title').textContent() === '拿住篮球', `${label} Chinese translation did not update`);
  assert(await page.locator('html').getAttribute('lang') === 'zh', `${label} document language did not update`);

  await page.click('#complexity');
  assert(await page.locator('#complexity').getAttribute('aria-pressed') === 'false', `${label} detailed mode did not activate`);
  await page.check('#seated');
  assert(await page.locator('#step-instruction').textContent().then(text => /坐姿选择/.test(text)), `${label} seated cue did not appear`);
  await page.click('#contrast');
  assert(await page.locator('body').evaluate(node => node.classList.contains('high-contrast')), `${label} high contrast mode did not activate`);
  assert(await page.locator('#contrast').getAttribute('aria-pressed') === 'true', `${label} high contrast state is not announced`);

  await auditPage(page, label);
  assert(errors.length === 0, `${label} emitted browser errors: ${errors.join(' | ')}`);
  await page.close();
}

async function runSupportingPageChecks(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await page.goto(`${baseUrl}/accesscourt/privacy.html`, { waitUntil: 'networkidle' });
  assert(await page.locator('link[rel="canonical"]').getAttribute('href') === 'https://atrak.dev/accesscourt/privacy.html', 'Privacy canonical mismatch');
  assert(await page.locator('header a[href="https://atrak.dev/"]').count() === 1, 'Privacy page Atrak return link missing');
  assert(await page.locator('main').textContent().then(text => /will not be transferred into Atrak commercial systems/i.test(text)), 'Atrak data-separation statement missing');
  assert(await page.locator('main').textContent().then(text => /same endpoint and Atrak-managed inbox used by Atrak’s public forms/i.test(text)), 'Shared Atrak Formspree disclosure missing');
  assert(await page.locator('main').textContent().then(text => /Identifiable participant or program data must remain with the host organization/i.test(text)), 'Participant-data host-retention boundary missing');
  await auditPage(page, 'privacy');

  await page.goto(`${baseUrl}/accesscourt/success.html`, { waitUntil: 'networkidle' });
  assert(await page.locator('meta[name="robots"]').getAttribute('content') === 'noindex,follow', 'Success page should be noindex');
  assert(await page.locator('header a[href="https://atrak.dev/"]').count() === 1, 'Success page Atrak return link missing');
  assert(await page.locator('h1').textContent().then(text => /Thank you for helping shape the pilot/i.test(text)), 'Success confirmation copy missing');
  await auditPage(page, 'success');

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  assert(await page.locator('a[href="accesscourt/"]').count() >= 2, 'Atrak homepage is missing AccessCourt links');
  assert(await page.locator('.nav-links .nav-impact-link[href="/accesscourt/"]').count() === 1, 'Atrak primary navigation AccessCourt link missing');
  assert(await page.locator('.project-title').filter({ hasText: 'AccessCourt — Atrak’s Inclusive Sports Initiative' }).count() === 1, 'Atrak homepage AccessCourt ecosystem card missing');
  const rootFormActions = await page.locator('form[action*="formspree.io"]').evaluateAll(forms => forms.map(form => form.getAttribute('action')));
  assert(rootFormActions.length >= 2 && rootFormActions.every(action => action === expectedSharedFormEndpoint), 'Atrak and AccessCourt no longer share the public Formspree endpoint');
  assert(await page.locator('#suggestion-form').getAttribute('data-endpoint-key') === 'suggestion', 'Atrak suggestion form endpoint key mismatch');

  await page.goto(`${baseUrl}/purpose.html`, { waitUntil: 'domcontentloaded' });
  assert(await page.locator('h2').filter({ hasText: 'Atrak Impact: AccessCourt' }).count() === 1, 'Purpose page AccessCourt relationship section missing');
  assert(await page.locator('.purpose-content').textContent().then(text => /not yet an independent 501\(c\)\(3\)/i.test(text)), 'Purpose page status disclosure missing');
  assert(await page.locator('.purpose-content').textContent().then(text => /GuidePup accessibility patterns/i.test(text) && /AI Hoops Board/i.test(text)), 'Purpose page Atrak project bridge copy missing');
  await page.close();
}

async function runAtrakResponsiveNavCheck(browser, baseUrl) {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desktop.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  const desktopLayout = await desktop.evaluate(() => {
    const logo = document.querySelector('.navbar .logo')?.getBoundingClientRect();
    const nav = document.querySelector('.nav-links')?.getBoundingClientRect();
    return {
      navDisplay: getComputedStyle(document.querySelector('.nav-links')).display,
      separated: Boolean(logo && nav && logo.right + 12 <= nav.left),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  });
  assert(desktopLayout.navDisplay === 'flex', 'Atrak desktop navigation should be visible at 1280px');
  assert(desktopLayout.separated, 'Atrak desktop navigation overlaps the logo at 1280px');
  assert(!desktopLayout.overflow, 'Atrak desktop navigation creates horizontal overflow at 1280px');
  await desktop.close();

  const compact = await browser.newPage({ viewport: { width: 1180, height: 800 } });
  await compact.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  assert(await compact.locator('.mobile-menu-btn').evaluate(node => getComputedStyle(node).display === 'flex'), 'Atrak compact menu button should appear at 1180px');
  assert(await compact.locator('.nav-links').evaluate(node => getComputedStyle(node).display === 'none'), 'Atrak compact navigation should start closed');
  await compact.click('.mobile-menu-btn');
  assert(await compact.locator('.nav-links').evaluate(node => node.classList.contains('active')), 'Atrak compact navigation did not open');
  assert(await compact.locator('.nav-impact-link').isVisible(), 'AccessCourt link is not visible in the open Atrak compact menu');
  await auditPage(compact, 'Atrak compact navigation');
  await compact.close();
}

async function main() {
  let serverInfo;
  let browser;
  try {
    await assertAtrakNavigationCoverage();
    serverInfo = await createStaticServer();
    const requestedExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
    const executablePath = requestedExecutable || (existsSync(macChromeExecutable) ? macChromeExecutable : undefined);
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

    await runHomeCheck(browser, serverInfo.baseUrl, { width: 1366, height: 900 }, 'AccessCourt desktop');
    console.log('PASS AccessCourt desktop');
    await runHomeCheck(browser, serverInfo.baseUrl, { width: 390, height: 844 }, 'AccessCourt mobile');
    console.log('PASS AccessCourt mobile');
    await runCoachCheck(browser, serverInfo.baseUrl, { width: 1366, height: 900 }, 'Coach desktop');
    console.log('PASS Coach desktop interactions');
    await runCoachCheck(browser, serverInfo.baseUrl, { width: 390, height: 844 }, 'Coach mobile');
    console.log('PASS Coach mobile interactions');
    await runSupportingPageChecks(browser, serverInfo.baseUrl);
    await runAtrakResponsiveNavCheck(browser, serverInfo.baseUrl);
    console.log('PASS privacy, confirmation, homepage, and purpose integration');
    console.log('AccessCourt smoke summary: 5/5 passed; no form was submitted.');
  } catch (error) {
    console.error(`FAIL ${error?.message || error}`);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (serverInfo?.server) await new Promise(resolve => serverInfo.server.close(resolve));
  }
}

main();

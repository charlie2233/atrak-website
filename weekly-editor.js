(() => {
    'use strict';

    const CACHE_VERSION = '20260714a';
    const DRAFT_PREFIX = 'atrak-weekly-editorial-draft:';
    const EMPTY_DOCUMENT = { version: 1, weeks: {} };
    const sectionFields = ['highlights', 'shipped', 'engineering', 'fixes', 'next'];
    const sectionLabels = {
        highlights: 'Highlights',
        shipped: 'What shipped',
        engineering: 'Engineering',
        fixes: 'Fixes & challenges',
        next: 'What’s next'
    };

    const state = {
        source: EMPTY_DOCUMENT,
        archiveWeeks: {},
        workingWeeks: {},
        activeKey: '',
        saveTimer: null,
        pendingDraft: null,
        loaded: false
    };

    const refs = {
        form: document.getElementById('editorial-form'),
        existing: document.getElementById('editorial-existing-week'),
        week: document.getElementById('editorial-week'),
        author: document.getElementById('editorial-author'),
        published: document.getElementById('editorial-published'),
        title: document.getElementById('editorial-title'),
        titleCount: document.getElementById('editorial-title-count'),
        status: document.getElementById('editorial-status'),
        copy: document.getElementById('editorial-copy-json'),
        download: document.getElementById('editorial-download-json'),
        reset: document.getElementById('editorial-reset-draft'),
        previewDate: document.getElementById('editorial-preview-date'),
        previewTitle: document.getElementById('editorial-preview-title'),
        previewState: document.getElementById('editorial-preview-state'),
        previewSections: document.getElementById('editorial-preview-sections'),
        liveLink: document.getElementById('editorial-live-link'),
        output: document.getElementById('editorial-json-output')
    };

    sectionFields.forEach((field) => {
        refs[field] = document.getElementById(`editorial-${field}`);
    });

    if (!refs.form || !refs.week || !refs.output) return;

    const localDateKey = (date = new Date()) => {
        const pad = (value) => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };

    const dateFromKey = (value) => {
        const date = new Date(`${String(value || '').trim()}T12:00:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    };

    const sundayKey = (value) => {
        const date = dateFromKey(value);
        if (!date) return '';
        date.setDate(date.getDate() - date.getDay());
        return localDateKey(date);
    };

    const formatRange = (key) => {
        const start = dateFromKey(key);
        if (!start) return 'Choose a week';
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${startLabel} – ${endLabel}`;
    };

    const lines = (value) => String(value || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 8);

    const safeStorageGet = (key) => {
        try {
            const value = window.localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (_) {
            return null;
        }
    };

    const safeStorageSet = (key, value) => {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (_) {
            return false;
        }
    };

    const safeStorageRemove = (key) => {
        try {
            window.localStorage.removeItem(key);
        } catch (_) {
        }
    };

    const storedDrafts = () => {
        const drafts = {};
        try {
            for (let index = 0; index < window.localStorage.length; index += 1) {
                const storageKey = window.localStorage.key(index) || '';
                if (!storageKey.startsWith(DRAFT_PREFIX)) continue;
                const week = storageKey.slice(DRAFT_PREFIX.length);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) continue;
                const entry = safeStorageGet(storageKey);
                if (entry && typeof entry === 'object' && !Array.isArray(entry)) drafts[week] = entry;
            }
        } catch (_) {
        }
        return drafts;
    };

    const setStatus = (message, status = 'ready') => {
        refs.status.textContent = message;
        refs.status.dataset.state = status;
    };

    const flushPendingDraft = ({ announce = false } = {}) => {
        const pending = state.pendingDraft;
        if (!pending) return true;
        window.clearTimeout(state.saveTimer);
        state.saveTimer = null;
        state.pendingDraft = null;
        const saved = safeStorageSet(`${DRAFT_PREFIX}${pending.key}`, pending.entry);
        if (announce && state.activeKey === pending.key) {
            setStatus(saved ? 'Draft saved locally' : 'Preview updated', saved ? 'saved' : 'ready');
        }
        return saved;
    };

    const entryFromForm = () => {
        const entry = {
            published: Boolean(refs.published.checked),
            updatedAt: localDateKey()
        };
        const author = refs.author.value.trim();
        const title = refs.title.value.trim();
        if (author) entry.author = author;
        if (title) entry.title = title;
        sectionFields.forEach((field) => {
            const items = lines(refs[field].value);
            if (items.length) entry[field] = items;
        });
        return entry;
    };

    const sortedDocument = () => {
        const weeks = { ...(state.source.weeks || {}), ...state.workingWeeks };
        if (state.activeKey) weeks[state.activeKey] = entryFromForm();
        const sortedWeeks = {};
        Object.keys(weeks).sort().forEach((key) => {
            sortedWeeks[key] = weeks[key];
        });
        return { version: 1, weeks: sortedWeeks };
    };

    const renderPreviewSections = (entry) => {
        refs.previewSections.replaceChildren();
        sectionFields.forEach((field) => {
            const items = Array.isArray(entry[field]) ? entry[field] : [];
            if (!items.length) return;
            const section = document.createElement('section');
            section.className = 'editorial-preview-section';
            const copy = document.createElement('div');
            const heading = document.createElement('strong');
            const body = document.createElement('p');
            heading.textContent = sectionLabels[field];
            body.textContent = items.slice(0, 2).join(' • ');
            copy.append(heading, body);
            section.append(copy);
            refs.previewSections.append(section);
        });

        if (!refs.previewSections.children.length) {
            const section = document.createElement('section');
            section.className = 'editorial-preview-section';
            const copy = document.createElement('div');
            const heading = document.createElement('strong');
            const body = document.createElement('p');
            heading.textContent = 'Start with the story';
            body.textContent = 'Add highlights, shipped work, engineering notes, fixes, or what comes next.';
            copy.append(heading, body);
            section.append(copy);
            refs.previewSections.append(section);
        }
    };

    const render = () => {
        const entry = entryFromForm();
        refs.titleCount.textContent = String(refs.title.value.length);
        refs.previewDate.textContent = formatRange(state.activeKey);
        refs.previewTitle.textContent = entry.title || 'Your headline will appear here.';
        refs.previewState.textContent = entry.published ? 'Ready to publish' : 'Draft only';
        refs.liveLink.href = state.activeKey ? `index.html#week=${state.activeKey}` : 'index.html#weekly-highlights';
        renderPreviewSections(entry);
        refs.output.textContent = `${JSON.stringify(sortedDocument(), null, 2)}\n`;
    };

    const fillForm = (entry = {}) => {
        refs.author.value = typeof entry.author === 'string' ? entry.author : 'Atrak Team';
        refs.published.checked = entry.published !== false;
        refs.title.value = typeof entry.title === 'string' ? entry.title : '';
        sectionFields.forEach((field) => {
            refs[field].value = Array.isArray(entry[field]) ? entry[field].join('\n') : '';
        });
        render();
    };

    const selectWeek = (requestedKey, { announce = true } = {}) => {
        const key = sundayKey(requestedKey) || sundayKey(localDateKey());
        if (state.loaded && state.activeKey && state.activeKey !== key) flushPendingDraft();
        state.activeKey = key;
        refs.week.value = key;
        refs.existing.value = Array.from(refs.existing.options).some((option) => option.value === key) ? key : '';
        const draft = state.workingWeeks[key] || safeStorageGet(`${DRAFT_PREFIX}${key}`);
        if (draft) state.workingWeeks[key] = draft;
        const publishedEntry = state.source.weeks && state.source.weeks[key];
        const archiveEntry = state.archiveWeeks[key];
        fillForm(draft || publishedEntry || archiveEntry || {});
        if (announce) {
            const message = draft
                ? 'Local draft restored'
                : (publishedEntry ? 'Published copy loaded' : (archiveEntry ? 'Archive copy loaded' : 'New edition ready'));
            setStatus(message, draft ? 'saved' : 'ready');
        }
    };

    const queueDraftSave = () => {
        if (!state.activeKey) return;
        const key = state.activeKey;
        const entry = entryFromForm();
        state.workingWeeks[key] = entry;
        window.clearTimeout(state.saveTimer);
        state.pendingDraft = { key, entry };
        state.saveTimer = window.setTimeout(() => flushPendingDraft({ announce: true }), 320);
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

    const enableForm = ({ exportEnabled = true } = {}) => {
        refs.form.querySelectorAll('input, select, textarea, button').forEach((control) => {
            control.disabled = false;
        });
        refs.copy.disabled = !exportEnabled;
        refs.download.disabled = !exportEnabled;
    };

    const optionLabel = (key, hasEditorial, hasDraft) => `${formatRange(key)}${hasDraft ? ' • local draft' : (hasEditorial ? ' • team edited' : '')}`;

    const historyWeekEntries = (history) => {
        const entries = Array.isArray(history) ? history : [];
        const monthIndex = (name) => {
            const date = new Date(`${name} 1, 2000`);
            return Number.isNaN(date.getTime()) ? -1 : date.getMonth();
        };
        const firstMonthDay = (range) => {
            const match = String(range || '').match(/([A-Za-z]{3,9})\s+(\d{1,2})/);
            return match ? { month: monthIndex(match[1]), day: Number(match[2]) } : null;
        };
        const firstLegacy = entries.find((entry) => !entry?.weekStart && firstMonthDay(entry?.dateRange));
        const first = firstLegacy ? firstMonthDay(firstLegacy.dateRange) : null;
        let year = new Date().getFullYear();
        if (first) {
            const candidate = new Date(year, first.month, first.day);
            if (candidate.getTime() > Date.now() + (30 * 24 * 60 * 60 * 1000)) year -= 1;
        }
        let previousMonth = first ? first.month : -1;

        return entries.map((entry) => {
            const explicit = sundayKey(entry && entry.weekStart);
            if (explicit) return { key: explicit, entry };
            const monthDay = firstMonthDay(entry && entry.dateRange);
            if (!monthDay || monthDay.month < 0) return null;
            if (previousMonth >= 9 && monthDay.month < previousMonth) year += 1;
            previousMonth = monthDay.month;
            return {
                key: sundayKey(localDateKey(new Date(year, monthDay.month, monthDay.day))),
                entry
            };
        }).filter((item) => item && item.key);
    };

    const populateWeekOptions = (history) => {
        const sourceKeys = Object.keys(state.source.weeks || {});
        const draftKeys = Object.keys(state.workingWeeks);
        const historyEntries = historyWeekEntries(history);
        state.archiveWeeks = Object.fromEntries(historyEntries.map(({ key, entry }) => [key, {
            published: true,
            author: 'Atrak Team',
            title: typeof entry.title === 'string' ? entry.title : '',
            ...Object.fromEntries(sectionFields.map((field) => [field, Array.isArray(entry[field]) ? entry[field] : []]))
        }]));
        const historyKeys = historyEntries.map(({ key }) => key);
        const keys = Array.from(new Set([...sourceKeys, ...draftKeys, ...historyKeys])).sort().reverse();
        refs.existing.replaceChildren();
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Choose or start a week';
        refs.existing.append(placeholder);
        keys.forEach((key) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = optionLabel(key, Boolean(state.source.weeks && state.source.weeks[key]), Boolean(state.workingWeeks[key]));
            refs.existing.append(option);
        });
        return keys;
    };

    const downloadDocument = () => {
        flushPendingDraft();
        const contents = `${JSON.stringify(sortedDocument(), null, 2)}\n`;
        const blob = new Blob([contents], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'weekly-editorial.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setStatus('JSON file downloaded', 'saved');
    };

    refs.form.addEventListener('submit', (event) => event.preventDefault());
    refs.form.addEventListener('input', () => {
        if (!state.loaded) return;
        render();
        queueDraftSave();
    });
    refs.existing.addEventListener('change', () => {
        if (refs.existing.value) selectWeek(refs.existing.value);
    });
    refs.week.addEventListener('change', () => {
        const normalized = sundayKey(refs.week.value);
        if (!normalized) {
            setStatus('Choose a valid date', 'error');
            return;
        }
        const adjusted = normalized !== refs.week.value;
        selectWeek(normalized, { announce: false });
        setStatus(adjusted ? 'Adjusted to the previous Sunday' : 'Week loaded', 'ready');
    });
    refs.copy.addEventListener('click', async () => {
        flushPendingDraft();
        const copied = await copyText(`${JSON.stringify(sortedDocument(), null, 2)}\n`);
        setStatus(copied ? 'Full JSON copied' : 'Select JSON below to copy', copied ? 'saved' : 'error');
    });
    refs.download.addEventListener('click', downloadDocument);
    refs.reset.addEventListener('click', () => {
        if (!state.activeKey) return;
        if (state.pendingDraft?.key === state.activeKey) {
            window.clearTimeout(state.saveTimer);
            state.saveTimer = null;
            state.pendingDraft = null;
        }
        delete state.workingWeeks[state.activeKey];
        safeStorageRemove(`${DRAFT_PREFIX}${state.activeKey}`);
        fillForm((state.source.weeks && state.source.weeks[state.activeKey]) || state.archiveWeeks[state.activeKey] || {});
        setStatus('Local draft reset', 'ready');
    });

    const load = async () => {
        try {
            const suffix = `?v=${CACHE_VERSION}`;
            const [editorialResponse, historyResponse] = await Promise.all([
                fetch(`data/weekly-editorial.json${suffix}`),
                fetch(`data/weekly-history.json${suffix}`)
            ]);
            if (!editorialResponse.ok) throw new Error(`Editorial source returned HTTP ${editorialResponse.status}`);
            const editorial = await editorialResponse.json();
            if (!editorial || editorial.version !== 1 || !editorial.weeks || typeof editorial.weeks !== 'object' || Array.isArray(editorial.weeks)) {
                throw new Error('Editorial source failed schema validation');
            }
            const history = historyResponse.ok ? await historyResponse.json() : [];
            state.source = editorial;
            state.workingWeeks = storedDrafts();
            const keys = populateWeekOptions(history);
            enableForm({ exportEnabled: true });
            state.loaded = true;
            selectWeek(keys[0] || sundayKey(localDateKey()));
        } catch (error) {
            console.warn('Editorial Studio source unavailable:', error);
            state.source = EMPTY_DOCUMENT;
            state.workingWeeks = storedDrafts();
            populateWeekOptions([]);
            enableForm({ exportEnabled: false });
            state.loaded = true;
            selectWeek(sundayKey(localDateKey()), { announce: false });
            setStatus('Editorial source unavailable — export disabled', 'error');
        }
    };

    window.AtrakEditorialStudio = {
        getDocument: sortedDocument,
        selectWeek
    };

    window.addEventListener('pagehide', () => flushPendingDraft());

    load();
})();

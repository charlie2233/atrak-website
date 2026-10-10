// Formspree must enforce Turnstile server-side before this is considered protection.
// Only public site keys belong in data-turnstile-sitekey; secrets stay in Formspree.
(() => {
  const forms = [...document.querySelectorAll('form[data-turnstile-sitekey]')]
    .filter(form => form.dataset.turnstileSitekey.trim());
  const states = new Map();
  let loading = false;
  let loader;
  let loadTimer;

  const report = (state, message) => { state.status.textContent = message; };
  const fail = (state, message) => {
    state.verified = false;
    state.retry.hidden = false;
    report(state, message);
  };

  const render = () => {
    loading = false;
    clearTimeout(loadTimer);
    for (const [form, state] of states) {
      if (state.widgetId !== undefined) continue;
      try {
        state.widgetId = window.turnstile.render(state.container, {
          sitekey: form.dataset.turnstileSitekey.trim(),
          size: 'flexible',
          callback: () => {
            state.verified = true;
            state.retry.hidden = true;
            report(state, 'Spam check complete. You can send your message.');
          },
          'expired-callback': () => fail(state, 'Spam check expired. Please retry the check before sending.'),
          'timeout-callback': () => fail(state, 'Spam check timed out. Please retry the check.'),
          'error-callback': () => {
            fail(state, 'Spam check could not finish. Check your connection and retry the check.');
            return true;
          }
        });
      } catch {
        fail(state, 'Spam check could not load. Please retry the check.');
      }
    }
  };

  const load = () => {
    if (loading) return;
    if (window.turnstile?.render) { render(); return; }
    loading = true;
    loader?.remove();
    loader = document.createElement('script');
    loader.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    loader.async = true;
    const current = loader;
    const unavailable = () => {
      if (loader !== current) return;
      loading = false;
      clearTimeout(loadTimer);
      for (const state of states.values()) {
        fail(state, 'Spam check could not load. Check your connection or content blocker, then retry the check. Your message stays here.');
      }
    };
    loader.onerror = unavailable;
    loader.onload = () => {
      if (loader !== current) return;
      // The script load event guarantees the API is present.
      // ready() is not supported with an async Turnstile script.
      if (window.turnstile?.render) render();
      else unavailable();
    };
    loadTimer = setTimeout(unavailable, 15000);
    document.head.append(loader);
  };

  const reset = form => {
    const state = states.get(form);
    if (!state) return;
    state.verified = false;
    state.retry.hidden = true;
    report(state, 'Checking for spam…');
    try {
      if (state.widgetId !== undefined && window.turnstile?.reset) {
        window.turnstile.reset(state.widgetId);
      } else {
        load();
      }
    } catch {
      fail(state, 'Spam check could not restart. Please retry the check.');
    }
  };

  window.formTurnstile = {
    validate(form) {
      const state = states.get(form);
      if (!state) return false;
      let valid = false;
      try {
        valid = state.verified && Boolean(window.turnstile?.getResponse(state.widgetId)) && !window.turnstile.isExpired(state.widgetId);
      } catch {
        fail(state, 'Spam check is unavailable. Please retry the check.');
      }
      if (!valid) {
        report(state, 'Please complete the spam check before sending. Your message stays here.');
        state.container.focus();
        return false;
      }
      return true;
    },
    reset
  };

  for (const form of forms) {
    const region = document.createElement('div');
    region.className = 'form-verification';
    const container = document.createElement('div');
    container.tabIndex = -1;
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', 'Spam verification');
    const status = document.createElement('p');
    status.className = 'form-verification-status';
    status.id = `form-verification-status-${states.size + 1}`;
    container.setAttribute('aria-describedby', status.id);
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.textContent = 'Checking for spam…';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'form-verification-retry';
    retry.textContent = 'Retry spam check';
    retry.hidden = true;
    retry.addEventListener('click', () => reset(form));
    region.append(container, status, retry);
    form.querySelector('button[type="submit"]').before(region);
    states.set(form, {container, status, retry, verified: false});
  }
  if (forms.length) load();
})();

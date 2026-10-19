const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const site = 'atrak';
const rawScript = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const source = site === 'atrak'
  ? 'const configuredFormEndpoints = {}; const showToast = () => {};\n' + rawScript.slice(rawScript.indexOf('// Determines the endpoint'), rawScript.indexOf('// One-pager print buttons'))
  : rawScript.slice(rawScript.indexOf('const waitlistForm ='));

async function setup(t, {file = 'index.html', selector, local = false, query = '', protectedForm = true, verified = true} = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8'), {
    url: `https://${local ? 'localhost' : `${site}.example`}/${file}${query}`, runScripts: 'outside-only'
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  const calls = [];
  const opened = [];
  let respond = async () => ({ok: true, status: 200});
  let timeout;
  let timerCleared = false;
  w.setTimeout = (callback, delay) => { assert.equal(delay, 20000); timeout = callback; return 1; };
  w.clearTimeout = () => { timerCleared = true; };
  w.fetch = async (url, options) => {
    calls.push({url, options, fields: Object.fromEntries(options.body)});
    return respond(options);
  };
  w.open = (...args) => opened.push(args);
  // No resources or scripts are loaded by jsdom; every submission uses this mock.
  await new Promise(resolve => w.addEventListener('load', resolve, {once: true}));
  w.eval(source);
  const form = w.document.querySelector(selector || (site === 'atrak' ? '#join-form' : '.waitlist-form'));
  let resets = 0;
  if (protectedForm) {
    form.dataset.turnstileSitekey = 'public-key-fixture';
    w.formTurnstile = {
      validate: () => verified,
      reset: () => { resets++; }
    };
    if (verified) {
      const token = w.document.createElement('input');
      token.type='hidden';token.name='cf-turnstile-response';token.value='mock-token';form.append(token);
    }
  }
  const field = name => form.elements.namedItem(name);
  const fill = () => {
    if (field('name')) field('name').value = 'Local QA';
    if (field('email')) field('email').value = 'qa@example.invalid';
    for (const name of ['interest','role','severity','project','focus']) {
      if (field(name)) field(name).selectedIndex = 1;
    }
    if (field('message')) field('message').value = 'A sufficiently detailed local test message. No live submission.';
    if (field('consent')) field('consent').checked = true;
  };
  fill();
  const submit = () => form.dispatchEvent(new w.Event('submit', {cancelable:true,bubbles:true}));
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return {w,form,field,fill,submit,settle,calls,opened,
    button: form.querySelector('button[type=submit]'),
    status: form.querySelector('.form-status'), resets: () => resets,
    respond: fn => {respond = fn;}, expire: () => timeout(), cleared: () => timerCleared};
}

test('invalid email is blocked without a request', async t => {
  const x = await setup(t); x.field('email').value = 'invalid'; x.submit(); await x.settle();
  assert.equal(x.calls.length, 0);
});

test('honeypot does not send, clear user content, or claim success', async t => {
  const x = await setup(t); x.field('_gotcha').value = 'bot'; x.submit(); await x.settle();
  assert.equal(x.calls.length,0); assert.match(x.field('message').value,/local test/);
  assert.match(x.status.textContent,/Unable to send/);
  assert.equal(x.status.classList.contains('is-error'),true);
});

test('one pending request and one success; optional referral and consent remain explicit', async t => {
  const x = await setup(t); let release;
  x.respond(() => new Promise(resolve => {release=resolve;}));
  assert.equal(x.field('referral_source').required,false);
  x.field('referral_source').selectedIndex=1;
  x.submit(); x.submit();
  assert.equal(x.calls.length,1); assert.equal(x.button.disabled,true);
  assert.equal(x.form.getAttribute('aria-busy'),'true');
  assert.ok(x.calls[0].fields.referral_source);
  assert.equal(x.calls[0].fields._gotcha,'');
  if (site === 'hoopclips') assert.equal(x.calls[0].fields.consent,'yes');
  release({ok:true,status:200}); await x.settle();
  assert.equal(x.field('email').value,''); assert.equal(x.button.disabled,false);
  assert.equal(x.form.hasAttribute('aria-busy'),false); assert.equal(x.cleared(),true);
  assert.match(x.status.textContent,/sent|received/);
});

test('blank optional referral is accepted', async t => {
  const x=await setup(t); x.submit(); await x.settle();
  assert.equal(x.calls.length,1); assert.equal(x.calls[0].fields.referral_source,'');
});

for (const [file, selector] of [
  ['index.html', '#join-form'],
  ['index.html', '#suggestion-form'],
  ['join.html', '#join-form'],
  ['security.html', '#security-form'],
  ['press-kit.html', '#sponsor-form']
]) {
  test(`${file} ${selector}: a confirmed send preserves newer edits without sending them`, async t => {
    const x = await setup(t, {file, selector});
    let release;
    x.respond(() => new Promise(resolve => { release = resolve; }));
    const sentMessage = x.field('message').value;
    x.submit();
    const newerMessage = 'This newer draft was written while the earlier request was pending.';
    x.field('message').value = newerMessage;
    x.field('message').dispatchEvent(new x.w.Event('input', {bubbles: true}));
    x.submit();
    assert.equal(x.calls.length, 1);
    assert.equal(x.calls[0].fields.message, sentMessage);
    release({ok: true, status: 200});
    await x.settle();
    assert.equal(x.field('message').value, newerMessage);
    assert.match(x.status.textContent, /earlier message was sent/i);
    assert.match(x.status.textContent, /have not been sent/i);
    assert.equal(x.status.getAttribute('role'), 'status');
    assert.equal(x.button.disabled, false);
    assert.equal(x.form.hasAttribute('aria-busy'), false);
    assert.equal(x.resets(), 1);
    assert.equal(x.calls.length, 1);
    const counter = x.form.querySelector(`[data-char-count="${x.field('message').id}"]`);
    if (counter) assert.ok(counter.textContent.startsWith(`${newerMessage.length}/`));
    x.respond(async () => ({ok: true, status: 200}));
    x.submit();
    await x.settle();
    assert.equal(x.calls.length, 2);
    assert.equal(x.calls[1].fields.message, newerMessage);
    assert.equal(x.field('message').value, '');
  });
}

test('a contact-only change while sending is retained even without an input event', async t => {
  const x = await setup(t);
  let release;
  x.respond(() => new Promise(resolve => { release = resolve; }));
  x.submit();
  x.field('email').value = 'new-draft@example.invalid';
  release({ok: true, status: 200});
  await x.settle();
  assert.equal(x.calls[0].fields.email, 'qa@example.invalid');
  assert.equal(x.field('email').value, 'new-draft@example.invalid');
  assert.match(x.field('message').value, /local test/);
  assert.match(x.status.textContent, /have not been sent/i);
});

test('new repository-request selections remain intact after the earlier send succeeds', async t => {
  const x = await setup(t);
  let release;
  x.respond(() => new Promise(resolve => { release = resolve; }));
  x.submit();
  x.field('repo_request').checked = true;
  x.field('repo_request').dispatchEvent(new x.w.Event('change', {bubbles: true}));
  x.field('repo_name').value = 'new-repository-request';
  x.field('referral_source').selectedIndex = 1;
  release({ok: true, status: 200});
  await x.settle();
  assert.equal(x.calls[0].fields.repo_request, undefined);
  assert.equal(x.calls[0].fields.referral_source, '');
  assert.equal(x.field('repo_request').checked, true);
  assert.equal(x.field('repo_name').value, 'new-repository-request');
  assert.equal(x.field('repo_name').required, true);
  assert.notEqual(x.field('referral_source').value, '');
  assert.match(x.status.textContent, /have not been sent/i);
});

test('a refreshed challenge token alone still clears the successfully sent draft', async t => {
  const x = await setup(t);
  let release;
  x.respond(() => new Promise(resolve => { release = resolve; }));
  x.submit();
  x.field('cf-turnstile-response').value = 'refreshed-mock-token';
  release({ok: true, status: 200});
  await x.settle();
  assert.equal(x.calls[0].fields['cf-turnstile-response'], 'mock-token');
  assert.equal(x.field('message').value, '');
  assert.equal(x.field('email').value, '');
  assert.doesNotMatch(x.status.textContent, /have not been sent/i);
  assert.equal(x.resets(), 1);
});

for (const status of [400,429,500]) {
  test(`HTTP ${status} preserves input, unlocks form and never claims success`, async t => {
    const x=await setup(t);
    x.respond(async()=>({ok:false,status,json:async()=>({errors:[{message:'Provider rejected request'}]})}));
    x.submit(); await x.settle();
    assert.match(x.field('message').value,/local test/); assert.equal(x.button.disabled,false);
    assert.equal(x.status.classList.contains('is-error'),true);
    if(status===429) assert.match(x.status.textContent,/wait a few minutes/);
  });
}

test('network failure keeps input and manual retry does not add duplicate retry controls', async t => {
  const x=await setup(t); x.respond(async()=>{throw new TypeError('Failed to fetch');});
  x.submit(); await x.settle(); x.submit(); await x.settle();
  assert.equal(x.calls.length,2); assert.match(x.field('message').value,/local test/);
  assert.match(x.status.textContent,/could not be confirmed/);
  assert.equal(x.form.querySelectorAll('button').length,1);
  x.respond(async()=>({ok:true,status:200})); x.submit(); await x.settle();
  assert.equal(x.field('email').value,'');
});

test('20 second timeout aborts and unlocks without automatic retry', async t => {
  const x=await setup(t);
  x.respond(({signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('AbortError')))));
  x.submit(); x.expire(); await x.settle();
  assert.equal(x.calls.length,1); assert.equal(x.calls[0].options.signal.aborted,true);
  assert.equal(x.button.disabled,false); assert.equal(x.cleared(),true);
  assert.match(x.field('message').value,/local test/); assert.match(x.status.textContent,/could not be confirmed/);
});

if (site === 'atrak') {
  for(const file of ['index.html','join.html']) {
    test(`${file}: access request remains private and reset clears conditional requirement`,async t=>{
      const x=await setup(t,{file}); x.field('repo_request').checked=true;
      x.field('repo_request').dispatchEvent(new x.w.Event('change',{bubbles:true}));
      assert.equal(x.field('repo_name').required,true);
      x.submit(); await x.settle(); assert.equal(x.calls.length,0);
      x.field('repo_name').value='example-repo'; x.field('repo_reason').value='Local test reason';
      x.submit(); await x.settle();
      assert.equal(x.calls.length,1); assert.equal(x.calls[0].fields.repo_request,'yes');
      assert.equal(x.calls[0].fields.repo_name,'example-repo'); assert.deepEqual(x.opened,[]);
      assert.equal(x.field('repo_name').required,false); assert.equal(x.field('repo_request').checked,false);
      x.fill(); x.submit(); await x.settle(); assert.equal(x.calls.length,2);
    });
  }
  for(const [file,selector] of [['index.html','#suggestion-form'],['security.html','#security-form'],['press-kit.html','#sponsor-form']]) {
    test(`${selector}: existing form is usable with the same endpoint and honeypot`,async t=>{
      const x=await setup(t,{file,selector}); x.submit(); await x.settle();
      assert.equal(x.calls.length,1); assert.equal(x.calls[0].url,'https://formspree.io/f/mvzqdnov');
      assert.equal(x.calls[0].fields._gotcha,'');
      if(selector==='#suggestion-form') {
        assert.equal(x.field('email'),null); assert.equal(x.field('name'),null); assert.equal(x.field('referral_source'),null);
      }
    });
  }
  test('trimmed minimum length still blocks whitespace messages',async t=>{
    const x=await setup(t); x.field('message').value='                       ';x.submit();await x.settle();assert.equal(x.calls.length,0);
  });
} else {
  test('consent is initially unchecked and required',async t=>{
    const x=await setup(t);assert.equal(x.field('consent').defaultChecked,false);
    x.field('consent').checked=false; x.submit(); await x.settle(); assert.equal(x.calls.length,0);
  });
  test('local preview preserves content and truthfully reports no delivery',async t=>{
    const x=await setup(t,{local:true});x.submit();await x.settle(); assert.equal(x.calls.length,0);
    assert.match(x.status.textContent,/Nothing was sent/);assert.match(x.field('message').value,/local test/);
    assert.equal(x.form.querySelector('[data-form-thanks]').hidden,true);
  });
  test('joined query cannot manufacture a delivery confirmation',async t=>{
    const x=await setup(t,{query:'?joined=true'});assert.equal(x.status.textContent,'');
    assert.equal(x.form.querySelector('[data-form-thanks]').hidden,true);assert.equal(x.calls.length,0);
  });
}

for (const missingHelper of [false,true]) {
  test(`configured protection blocks unverified sends (missing helper: ${missingHelper})`,async t=>{
    const x=await setup(t,{protectedForm:true,verified:false});
    if(missingHelper) delete x.w.formTurnstile;
    x.submit(); await x.settle(); assert.equal(x.calls.length,0);
    assert.match(x.status.textContent,/spam check/);assert.match(x.field('message').value,/local test/);
  });
}
for(const outcome of ['success','rejected','network']) {
  test(`verified token is forwarded and reset after ${outcome}`,async t=>{
    const x=await setup(t,{protectedForm:true,verified:true});
    x.respond(async()=>{
      if(outcome==='network') throw new Error('network');
      return {ok:outcome==='success',status:outcome==='success'?200:400,json:async()=>({error:'Invalid CAPTCHA'})};
    });
    x.submit();await x.settle();assert.equal(x.calls.length,1);
    assert.equal(x.calls[0].fields['cf-turnstile-response'],'mock-token');
    assert.equal(x.resets(),1);
    if(outcome!=='success') assert.match(x.field('message').value,/local test/);
  });
}

test('every public form has the correct production widget and helper', () => {
  const pages = ['index.html', 'join.html', 'security.html', 'press-kit.html'];
  const expectedKey = '0x4AAAAAAFTZXFn4g2nxivZR';
  let formCount = 0;
  for (const file of pages) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const dom = new JSDOM(html);
    const forms = [...dom.window.document.querySelectorAll('form[action^="https://formspree.io/f/"]')];
    formCount += forms.length;
    for (const form of forms) {
      assert.equal(form.dataset.turnstileSitekey, expectedKey, file);
      assert.ok(form.querySelector('input[name="_gotcha"]'), file);
      assert.ok(form.querySelector('noscript'), file);
    }
    const scripts = [...dom.window.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src').split('?')[0]);
    assert.ok(scripts.includes('turnstile.js'));
    assert.ok(scripts.indexOf('turnstile.js') < scripts.indexOf('script.js'));
    dom.window.close();
  }
  assert.equal(formCount, 5);
});

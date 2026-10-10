const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(path.resolve(__dirname,'../turnstile.js'),'utf8');
function setup(t,{enabled=true}={}) {
  const dom=new JSDOM(`<form data-turnstile-sitekey="${enabled?'public-test-fixture':''}"><textarea name="message">Keep this message</textarea><button type="submit">Send</button></form>`,{url:'https://site.example/',runScripts:'outside-only'});
  t.after(()=>dom.window.close());
  const w=dom.window, form=w.document.querySelector('form');
  let timeout,options,resets=0,response='',expired=false;
  w.setTimeout=(fn,delay)=>{assert.equal(delay,15000);timeout=fn;return 1;};
  w.clearTimeout=()=>{};
  w.eval(source);
  const ready=()=>{
    w.turnstile={
      ready:()=>{throw new Error('ready() cannot be used with async scripts');},
      render:(container,opts)=>{options=opts;return 'widget-0';},
      getResponse:id=>{assert.equal(id,'widget-0');return response;},
      isExpired:()=>expired,
      reset:()=>{resets++;response='';}
    };
    w.document.querySelector('script').dispatchEvent(new w.Event('load'));
  };
  return {w,form,ready,options:()=>options,
    pass:()=>{response='mock-token';options.callback('mock-token');},
    expire:()=>{expired=true;options['expired-callback']();},
    timeout:()=>timeout(),resets:()=>resets,
    status:()=>form.querySelector('[role=status]')?.textContent,
    retry:()=>form.querySelector('button[type=button]')};
}
test('empty key loads no third-party script or widget',t=>{
  const x=setup(t,{enabled:false});assert.equal(x.w.document.querySelectorAll('script').length,0);
  assert.equal(x.form.querySelector('.form-verification'),null);
});
test('initially blocks, then accepts only a completed unexpired challenge',t=>{
  const x=setup(t);assert.equal(x.w.formTurnstile.validate(x.form),false);
  x.ready();assert.equal(x.options().size,'flexible');assert.equal(x.w.formTurnstile.validate(x.form),false);
  x.pass();assert.equal(x.w.formTurnstile.validate(x.form),true);
  x.expire();assert.equal(x.w.formTurnstile.validate(x.form),false);assert.equal(x.retry().hidden,false);
  x.retry().click();assert.equal(x.resets(),1);assert.equal(x.form.elements.message.value,'Keep this message');
});
test('blocked loading allows retry without losing input',t=>{
  const x=setup(t);x.w.document.querySelector('script').dispatchEvent(new x.w.Event('error'));
  assert.equal(x.retry().hidden,false);assert.match(x.status(),/could not load/);
  x.retry().click();assert.equal(x.w.document.querySelectorAll('script').length,1);
  x.ready();x.pass();assert.equal(x.w.formTurnstile.validate(x.form),true);
  assert.equal(x.form.elements.message.value,'Keep this message');
});
test('script loading timeout exposes retry and stays closed',t=>{
  const x=setup(t);x.timeout();assert.equal(x.retry().hidden,false);
  assert.equal(x.w.formTurnstile.validate(x.form),false);
});
for(const callback of ['error-callback','timeout-callback']) {
  test(`${callback} clears previous success and can recover`,t=>{
    const x=setup(t);x.ready();x.pass();x.options()[callback]();
    assert.equal(x.w.formTurnstile.validate(x.form),false);assert.equal(x.retry().hidden,false);
    x.retry().click();x.pass();assert.equal(x.w.formTurnstile.validate(x.form),true);
  });
}
test('reset prevents token reuse and keeps user input',t=>{
  const x=setup(t);x.ready();x.pass();x.w.formTurnstile.reset(x.form);
  assert.equal(x.resets(),1);assert.equal(x.w.formTurnstile.validate(x.form),false);
  assert.equal(x.form.elements.message.value,'Keep this message');
});
test('unavailable API fails closed with a retry',t=>{
  const x=setup(t);x.ready();x.pass();x.w.turnstile.getResponse=()=>{throw new Error('Unavailable');};
  assert.equal(x.w.formTurnstile.validate(x.form),false);assert.equal(x.retry().hidden,false);
});

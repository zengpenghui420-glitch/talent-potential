// Mocked order-unlock checks for talent-potential. Synthetic ids only.
// Chrome is pinned to 127.0.0.1 for the API and Mantle hosts, so a missed
// mock cannot redeem a real order or code.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire('/tmp/ppt/package.json');
const puppeteer = require('puppeteer-core');

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const API_HOST = 'snappy-tundra-7uesdvk-zengpenghui420-glitch.vercel.app';
const ORDER = 'P847291038475610293';
const ORDER2 = 'P847291038475610294';
const CODE = 'TPABCD';
const PORT = 8934;
const BASE = `http://127.0.0.1:${PORT}/`;
const ART = '/opt/cursor/artifacts';
const USES_KEY = 'talent_potential_order_uses';

function patternError(id) {
  if (!/^P\d{18}$/.test(id)) return 'shape';
  const d = id.slice(1);
  for (const size of [1, 2, 3, 6, 9]) {
    if (d.slice(0, size).repeat(d.length / size) === d) return 'repeat';
  }
  const step = (d.charCodeAt(1) - d.charCodeAt(0) + 10) % 10;
  if (step === 1 || step === 9) {
    let seq = true;
    for (let i = 1; i < d.length; i++) {
      if ((d.charCodeAt(i) - d.charCodeAt(i - 1) + 10) % 10 !== step) seq = false;
    }
    if (seq) return 'sequence';
  }
  return '';
}
if (patternError(ORDER)) throw new Error('synthetic order is not a legal id: ' + patternError(ORDER));
if (patternError(ORDER2)) throw new Error('synthetic order 2 is not a legal id: ' + patternError(ORDER2));
if (!/^TP[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/.test(CODE)) throw new Error('synthetic code shape');

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Content-Type,Authorization,X-Device-Id,X-Fingerprint,X-Mantle-Key',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'content-type': 'application/json',
};

function freshState() {
  return {
    mantleRemaining: 3,
    mantleMissing: false,
    mantleDown: false,
    mantleDecrResult: null,
    vaultPosts: 0,
    vaultGets: 0,
    mantleGets: 0,
    mantleDecr: 0,
    mantleIncr: 0,
    bodies: [],
    urls: [],
    unexpected: [],
  };
}

async function send(req, status, obj) {
  await req.respond({ status, headers: CORS, body: JSON.stringify(obj) });
}

async function handleApi(req, u, state) {
  if (req.method() === 'OPTIONS') {
    await req.respond({ status: 204, headers: CORS, body: '' });
    return;
  }
  state.urls.push(req.method() + ' ' + u.pathname + u.search);
  state.unexpected.push('vercel ' + req.method() + ' ' + u.pathname);
  if (u.pathname === '/redeem' && req.method() === 'POST') state.vaultPosts++;
  if (u.pathname === '/get') state.vaultGets++;
  await req.abort('failed');
}

async function handleMantle(req, u, state) {
  if (req.method() === 'OPTIONS') {
    await req.respond({ status: 204, headers: CORS, body: '' });
    return;
  }
  state.urls.push(req.method() + ' mantle ' + u.pathname);
  if (u.pathname.includes('/orders/') || u.pathname.includes('/order/')) {
    state.unexpected.push('mantle-order ' + u.pathname);
    await req.abort('failed');
    return;
  }
  if (!u.pathname.includes('/tp/')) {
    state.unexpected.push('mantle-col ' + u.pathname);
    await req.abort('failed');
    return;
  }
  if (req.method() === 'GET') {
    state.mantleGets++;
    if (state.mantleDown) return send(req, 500, { error: 'down' });
    if (state.mantleMissing) return send(req, 404, { error: 'not_found' });
    return send(req, 200, { remaining: state.mantleRemaining, max: 3 });
  }
  if (req.method() === 'POST' && u.pathname.includes('/increment/')) {
    const body = JSON.parse(req.postData() || '{}');
    state.bodies.push(body);
    if (body.by === -1) {
      state.mantleDecr++;
      if (state.mantleDecrResult != null) return send(req, 200, { remaining: state.mantleDecrResult });
      state.mantleRemaining -= 1;
    } else if (body.by === 1) {
      state.mantleIncr++;
      state.mantleRemaining += 1;
    } else {
      state.unexpected.push('mantle by ' + body.by);
    }
    return send(req, 200, { remaining: state.mantleRemaining });
  }
  state.unexpected.push('mantle ' + req.method() + ' ' + u.pathname);
  await req.abort('failed');
}

async function arm(page, state) {
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    try {
      const u = new URL(req.url());
      if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') {
        await req.continue();
        return;
      }
      if (u.hostname === API_HOST) return await handleApi(req, u, state);
      if (u.hostname === 'mantledb.sh') return await handleMantle(req, u, state);
      state.unexpected.push(u.hostname + ' ' + u.pathname);
      await req.abort('failed');
    } catch (e) {
      state.unexpected.push('handler ' + e.message);
      try { await req.abort('failed'); } catch (err) {}
    }
  });
}

function assert(cond, msg, state) {
  if (!cond) {
    const extra = state ? '\n' + JSON.stringify({
      vaultPosts: state.vaultPosts, vaultGets: state.vaultGets,
      mantleGets: state.mantleGets, mantleDecr: state.mantleDecr, mantleIncr: state.mantleIncr,
      bodies: state.bodies, urls: state.urls, unexpected: state.unexpected,
    }, null, 2) : '';
    throw new Error(msg + extra);
  }
}

async function openAndSubmit(page, value) {
  await page.click('#btnStart');
  await page.waitForSelector('#codeMask.show');
  await page.$eval('#codeInput', (el, v) => { el.value = v; }, value);
  await page.click('#btnCodeOk');
}

async function clearToast(page) {
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
}

async function waitQuiz(page) {
  await page.waitForFunction(() => document.getElementById('quiz').classList.contains('active'), { timeout: 8000 });
}

async function waitResult(page) {
  await page.waitForFunction(() => document.getElementById('result').classList.contains('active'), { timeout: 8000 });
}

async function fastFinish(page) {
  await page.evaluate(() => {
    ans = Array(QS.length).fill(3);
    qi = QS.length - 1;
    finish();
  });
  await waitResult(page);
}

async function answerOne(page) {
  const before = await page.$eval('#qno', (el) => el.textContent);
  await page.click('#opts .opt');
  await page.waitForFunction((prev) => document.getElementById('qno').textContent !== prev, { timeout: 3000 }, before);
}

async function overflow(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    let max = 0;
    let min = 0;
    let offender = '';
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.right > max) {
        max = r.right;
        offender = (el.id || el.className || el.tagName).toString().slice(0, 80);
      }
      if (r.left < min) min = r.left;
    }
    const input = document.getElementById('codeInput');
    const inputFit = !input || input.getClientRects().length === 0
      ? null
      : input.scrollWidth <= input.clientWidth + 2;
    return { vw, max: Math.round(max), min: Math.round(min), offender, inputFit, overflow: max > vw + 1 || min < -1 };
  });
}

async function shot(page, name) {
  await mkdir(ART, { recursive: true });
  await page.screenshot({ path: join(ART, name), fullPage: false });
}

async function newPage(browser, state, opts = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.setCacheEnabled(false);
  await page.evaluateOnNewDocument(() => {
    try {
      if (sessionStorage.getItem('__test_ready')) return;
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('__test_ready', '1');
    } catch (e) {}
  });
  await page.setViewport(opts.viewport || { width: 390, height: 844, isMobile: true, hasTouch: true });
  await arm(page, state);
  await page.goto(BASE + (opts.path || ''), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof redeemOrder === 'function' && typeof redeemCode === 'function');
  return { page, errors };
}

async function shownUses(page, orderId = ORDER) {
  return page.evaluate((id) => shownOrderUses(id), orderId);
}

function assertNoOrderNet(state, msg) {
  const hit = state.urls.filter((u) => /order|vercel|\/redeem|\/get\?/.test(u));
  assert(hit.length === 0 && state.unexpected.length === 0, msg, state);
  assert(state.vaultPosts === 0 && state.vaultGets === 0, msg, state);
  assert(state.mantleGets === 0 && state.mantleDecr === 0 && state.mantleIncr === 0, msg, state);
}

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

test('format helpers reject patterns and keep the count per order id', async (browser) => {
  const state = freshState();
  const { page, errors } = await newPage(browser, state);
  const out = await page.evaluate((order, order2, usesKey) => {
    const html = document.documentElement.innerHTML;
    const first = redeemOrder(order);
    const second = redeemOrder(order2);
    redeemOrder(order);
    return {
      good: orderFormatError(order),
      repeat: orderFormatError('P111111111111111111'),
      seq: orderFormatError('P123456789012345678'),
      pasted: classifyInput(' 「p8472-9103-8475-610293」 '),
      code: classifyInput(' tp ab cd '),
      junk: classifyInput('hello'),
      badCode: classifyInput('TPIIII'),
      shortP: classifyInput('P12345'),
      quiz: QUIZ_KEY,
      usesKey: ORDER_USES_KEY,
      p19: orderFormatError('P9900000000000001378'),
      p19c: classifyInput('P9900000000000001378').type,
      copy: orderSuccessText({ ok: true, uses: 1, remaining: 2 }),
      lastCopy: orderSuccessText({ ok: true, uses: 3, remaining: 0 }),
      laterCopy: orderSuccessText({ ok: true, uses: 4, remaining: 0 }),
      first,
      secondUses: shownOrderUses(order2),
      firstUses: shownOrderUses(order),
      stored: localStorage.getItem(usesKey),
      foreign: localStorage.getItem('soft_persimmon_order_uses'),
      paid: first.paidVerified,
      noVercel: !html.includes('vercel.app') && !html.includes('/order/redeem') && !html.includes('/order/get'),
      noForeignKey: !html.includes('soft_persimmon_order_uses'),
      heading: document.querySelector('.code-panel h3').textContent,
    };
  }, ORDER, ORDER2, USES_KEY);
  assert(out.good === '', 'legal synthetic id rejected ' + out.good);
  assert(out.repeat === 'invalid' && out.seq === 'invalid', 'pattern ids should be invalid');
  assert(out.pasted.type === 'order' && out.pasted.orderId === ORDER, 'paste normalize ' + JSON.stringify(out.pasted));
  assert(out.code.type === 'code' && out.code.code === CODE, 'spaced TP code ' + JSON.stringify(out.code));
  assert(out.junk.type === 'code' && out.badCode.type === 'code' && out.shortP.type === 'code', 'classifier mixed ' + JSON.stringify(out));
  assert(out.quiz === 'talent' && out.usesKey === USES_KEY, 'quiz/storage constants');
  assert(out.p19 === 'invalid' && out.p19c === 'order-invalid', '19-digit id must stay invalid');
  assert(out.copy === '验证成功，还可以测 2 次', out.copy);
  assert(out.lastCopy === '验证成功，这是最后一次', out.lastCopy);
  assert(out.laterCopy === '验证成功', out.laterCopy);
  assert(out.first.ok === true && out.first.uses === 1 && out.first.paidVerified === false && out.paid === false, 'first record ' + JSON.stringify(out.first));
  assert(out.firstUses === 2 && out.secondUses === 1, 'counts are per order id');
  assert(out.foreign == null && out.stored && out.stored.includes(ORDER) && !out.stored.includes('soft_persimmon'), 'storage key');
  assert(out.noVercel && out.noForeignKey, 'page still names an order service');
  assert(out.heading === '输入订单号', out.heading);
  assertNoOrderNet(state, 'format checks must not hit the network');
  assert(errors.length === 0, errors.join('\n'));
  await page.close();
});

test('first redeem, refresh, continue', async (browser) => {
  const state = freshState();
  const { page, errors } = await newPage(browser, state);
  const visible = await page.evaluate(() => document.body.innerText);
  assert(!visible.includes('验证码') && !visible.includes('已付款') && !visible.includes('paidVerified'), 'start copy');
  assert(visible.includes('天赋潜能测试'), 'product title');
  await openAndSubmit(page, ' 「p8472-9103-8475-610293」 ');
  await waitQuiz(page);
  assert(await shownUses(page) === 1, 'first start should display one use');
  assertNoOrderNet(state, 'first start must not call the network');
  const toast = await page.$eval('#toast', (el) => el.textContent);
  assert(toast.includes('还可以测 2 次') && !toast.includes('付款'), 'success copy ' + toast);
  const q1 = await page.$eval('#qtext', (el) => el.textContent);
  assert(q1.startsWith('把一件复杂的事讲给别人听时'), 'first question changed: ' + q1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitQuiz(page);
  assert(await shownUses(page) === 1, 'refresh at question 1 must not change the display count');
  assertNoOrderNet(state, 'refresh must not call the network');
  await answerOne(page);
  await answerOne(page);
  const prog = await page.$eval('#qprog', (el) => el.textContent);
  assert(prog === '3 / 18', 'progress ' + prog);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitQuiz(page);
  const resumed = await page.evaluate(() => ({
    prog: document.getElementById('qprog').textContent,
    qi,
    a0: ans[0],
    a1: ans[1],
  }));
  assert(resumed.prog === '3 / 18' && resumed.qi === 2 && resumed.a0 === 1 && resumed.a1 === 1, 'mid refresh ' + JSON.stringify(resumed));
  assert(await shownUses(page) === 1, 'mid refresh must not change the display count');
  assertNoOrderNet(state, 'mid refresh must not call the network');
  await page.click('#qback');
  await page.click('#qback');
  await page.click('#qback');
  await page.waitForFunction(() => document.getElementById('start').classList.contains('active'));
  await page.click('#btnStart');
  await waitQuiz(page);
  const cont = await page.evaluate(() => ({
    prog: document.getElementById('qprog').textContent,
    sel: document.querySelectorAll('#opts .opt.sel').length,
    a0: ans[0],
  }));
  assert(cont.prog === '1 / 18' && cont.sel === 1 && cont.a0 === 1, 'continue reset the attempt ' + JSON.stringify(cont));
  assert(await shownUses(page) === 1, 'continue must not change the display count');
  assertNoOrderNet(state, 'continue must not call the network');
  assert(errors.length === 0, errors.join('\n'));
  await page.close();
});

test('result refresh and view-last do not deduct; retest does; later entry still starts', async (browser) => {
  const state = freshState();
  const { page, errors } = await newPage(browser, state);
  await openAndSubmit(page, ORDER);
  await waitQuiz(page);
  await fastFinish(page);
  const firstIndex = await page.$eval('.index-num', (el) => el.textContent);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitResult(page);
  const peeked = await page.$eval('.index-num', (el) => el.textContent);
  assert(peeked === firstIndex, 'result refresh changed the index');
  assert(await shownUses(page) === 1, 'result refresh changed the display count');
  assertNoOrderNet(state, 'result refresh must not call the network');

  await page.click('#btnViewLast');
  await page.waitForFunction(() => document.getElementById('toast').textContent.includes('不扣次'));
  assert(await shownUses(page) === 1, 'view last changed the display count');
  assertNoOrderNet(state, 'view last must not call the network for an order');

  await clearToast(page);
  await page.click('#btnRetry');
  await waitQuiz(page);
  assert(await shownUses(page) === 2, 'retest should display the second use');
  const secondToast = await page.$eval('#toast', (el) => el.textContent);
  assert(secondToast.includes('还可以测 1 次'), secondToast);
  const restarted = await page.evaluate(() => ({ prog: document.getElementById('qprog').textContent, len: ans.length }));
  assert(restarted.prog === '1 / 18' && restarted.len === 0, 'retest should open a new attempt ' + JSON.stringify(restarted));
  await fastFinish(page);
  await clearToast(page);
  await page.click('#btnRetry');
  await waitQuiz(page);
  assert(await shownUses(page) === 3, 'third displayed use');
  const thirdToast = await page.$eval('#toast', (el) => el.textContent);
  assert(thirdToast.includes('这是最后一次'), thirdToast);
  await fastFinish(page);
  await clearToast(page);
  await page.click('#btnRetry');
  await waitQuiz(page);
  await page.waitForFunction(() => document.getElementById('toast').textContent === '验证成功');
  const after = await page.evaluate((id) => ({
    quiz: document.getElementById('quiz').classList.contains('active'),
    toast: document.getElementById('toast').textContent,
    uses: shownOrderUses(id),
  }), ORDER);
  assert(after.quiz, 'a later entry must still open the quiz');
  assert(after.toast === '验证成功' && !after.toast.includes('用完') && !after.toast.includes('暂时验证不了'), after.toast);
  assert(await shownUses(page) === 4, 'later entry still records a display count');
  assertNoOrderNet(state, 'later entry must not call the network');
  assert(errors.length === 0, errors.join('\n'));
  await page.close();
});

test('invalid orders are rejected on the page and never call the network', async (browser) => {
  const state = freshState();
  const { page, errors } = await newPage(browser, state);
  await openAndSubmit(page, 'P123456789012345678');
  await page.waitForFunction(() => document.getElementById('toast').textContent.includes('格式不对'));
  await clearToast(page);
  await page.$eval('#codeInput', (el) => { el.value = 'P111111111111111111'; });
  await page.click('#btnCodeOk');
  await page.waitForFunction(() => document.getElementById('toast').textContent.includes('格式不对'));
  await clearToast(page);
  await page.$eval('#codeInput', (el) => { el.value = 'P9900000000000001378'; });
  await page.click('#btnCodeOk');
  await page.waitForFunction(() => document.getElementById('toast').textContent.includes('格式不对'));
  await clearToast(page);
  await page.$eval('#codeInput', (el) => { el.value = 'hello'; });
  await page.click('#btnCodeOk');
  await page.waitForFunction(() => document.getElementById('toast').textContent.includes('订单号不对'));
  const onQuiz = await page.$eval('#quiz', (el) => el.classList.contains('active'));
  assert(!onQuiz, 'invalid input started the quiz');
  assert(await shownUses(page) === 0, 'invalid input recorded a display count');
  assertNoOrderNet(state, 'invalid input reached the network');
  assert(errors.length === 0, errors.join('\n'));
  await page.close();
});

test('query string still starts an order id with no network', async (browser) => {
  const state = freshState();
  const { page, errors } = await newPage(browser, state, { path: '?code=' + ORDER });
  await waitQuiz(page);
  assert(await shownUses(page) === 1, 'query order should display one use');
  const toast = await page.$eval('#toast', (el) => el.textContent);
  assert(toast.includes('还可以测 2 次'), toast);
  assertNoOrderNet(state, 'query order must not call the network');
  assert(errors.length === 0, errors.join('\n'));
  await page.close();
});

test('saved order result stays available with no server', async (browser) => {
  const state = freshState();
  const { page, errors } = await newPage(browser, state);
  await openAndSubmit(page, ORDER);
  await waitQuiz(page);
  await fastFinish(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitResult(page);
  const revealed = await page.evaluate(() => document.getElementById('result').classList.contains('active') && isUnlocked());
  assert(revealed, 'saved order result did not come back');
  assert(await shownUses(page) === 1, 'restoring a result changed the display count');
  assertNoOrderNet(state, 'restoring a result must not call the network');
  assert(errors.length === 0, errors.join('\n'));
  await page.close();
});

test('TP codes still decrement Mantle tp and do not call the vault or orders', async (browser) => {
  const state = freshState();
  const { page, errors } = await newPage(browser, state);
  await openAndSubmit(page, 'tp ab cd');
  await waitQuiz(page);
  assert(state.mantleGets === 1 && state.mantleDecr === 1 && state.mantleIncr === 0, 'mantle redeem', state);
  assert(state.mantleRemaining === 2, 'remaining after decr', state);
  assert(state.bodies.length === 1 && state.bodies[0].key === 'remaining' && state.bodies[0].by === -1, 'increment body', state);
  assert(state.urls.some((u) => u.includes('/tp/' + CODE)), 'mantle collection', state);
  assert(state.vaultPosts === 0 && state.vaultGets === 0, 'issued codes stay off the vault', state);
  assert(state.unexpected.length === 0, 'unexpected', state);
  const toast = await page.$eval('#toast', (el) => el.textContent);
  assert(toast.includes('还可以测 2 次'), toast);
  assert(await shownUses(page) === 0, 'a code must not write an order display count');
  await fastFinish(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitResult(page);
  assert(state.mantleGets === 1 && state.mantleDecr === 1, 'result refresh redeemed again', state);
  await page.click('#btnViewLast');
  await page.waitForFunction(() => document.getElementById('toast').textContent.includes('不扣次'));
  assert(state.mantleGets === 1 && state.mantleDecr === 1 && state.vaultGets === 0, 'view last redeemed or peeked', state);
  await page.click('#btnRetry');
  await page.waitForFunction(() => document.getElementById('start').classList.contains('active'));
  await page.click('#btnStart');
  await waitQuiz(page);
  assert(state.mantleGets === 1 && state.mantleDecr === 1 && state.vaultPosts === 0, 'same-tab retry redeemed again', state);
  assert(errors.length === 0, errors.join('\n'));
  await page.close();
});

test('exhausted Mantle code does not start, and a negative decrement rolls back', async (browser) => {
  const done = freshState();
  done.mantleRemaining = 0;
  const first = await newPage(browser, done);
  await openAndSubmit(first.page, CODE);
  await first.page.waitForFunction(() => document.getElementById('toast').textContent.includes('次数已经用完'));
  const onQuiz = await first.page.$eval('#quiz', (el) => el.classList.contains('active'));
  assert(!onQuiz && done.mantleGets === 1 && done.mantleDecr === 0 && done.vaultPosts === 0, 'exhausted code started', done);
  await first.page.close();

  const rollback = freshState();
  rollback.mantleRemaining = 1;
  rollback.mantleDecrResult = -1;
  const second = await newPage(browser, rollback);
  await openAndSubmit(second.page, CODE);
  await second.page.waitForFunction(() => document.getElementById('toast').textContent.includes('次数已经用完'));
  const still = await second.page.$eval('#quiz', (el) => el.classList.contains('active'));
  assert(!still && rollback.mantleDecr === 1 && rollback.mantleIncr === 1, 'rollback', rollback);
  await second.page.close();

  const down = freshState();
  down.mantleDown = true;
  const third = await newPage(browser, down);
  await openAndSubmit(third.page, CODE);
  await third.page.waitForFunction(() => document.getElementById('toast').textContent.includes('网络异常'));
  assert(await third.page.evaluate(() => !isUnlocked()), 'network failure unlocked');
  assert(down.vaultPosts === 0 && down.mantleDecr === 0, 'outage left the code path', down);
  await third.page.close();
});

test('layout at 320 and 390', async (browser) => {
  for (const width of [320, 390]) {
    const state = freshState();
    const { page, errors } = await newPage(browser, state, { viewport: { width, height: 780, isMobile: true, hasTouch: true } });
    let box = await overflow(page);
    assert(!box.overflow, width + ' start overflow ' + JSON.stringify(box));
    await page.click('#btnStart');
    await page.waitForSelector('#codeMask.show');
    await page.$eval('#codeInput', (el, v) => { el.value = v; }, ORDER);
    box = await overflow(page);
    assert(!box.overflow, width + ' modal overflow ' + JSON.stringify(box));
    assert(box.inputFit === true, width + ' order id clipped in the field ' + JSON.stringify(box));
    const hint = await page.$eval('.code-hint', (el) => el.innerText);
    const title = await page.$eval('.code-panel h3', (el) => el.textContent);
    assert(title === '输入订单号', title);
    assert(hint.includes('我的订单') && hint.includes('3 次'), hint);
    assert(!hint.includes('本地') && !hint.includes('假'), hint);
    await shot(page, `talent-${width}-order.png`);
    await page.evaluate(() => {
      closeCodeModal();
      const scores = {};
      for (const id of DIM_IDS) scores[id] = 60;
      renderResult(analyze(scores));
      show('result');
    });
    box = await overflow(page);
    assert(!box.overflow, width + ' result overflow ' + JSON.stringify(box));
    const retry = await page.$eval('#btnRetry', (el) => el.textContent);
    assert(retry === '再测一次', retry);
    await shot(page, `talent-${width}-result.png`);
    assert(errors.length === 0, errors.join('\n'));
    await page.close();
  }
});

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  cwd: ROOT,
  stdio: 'ignore',
});
await new Promise((resolve) => setTimeout(resolve, 300));

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    `--host-resolver-rules=MAP ${API_HOST} 127.0.0.1, MAP mantledb.sh 127.0.0.1`,
  ],
});

let failed = 0;
try {
  for (const c of cases) {
    try {
      await c.fn(browser);
      console.log('ok  ' + c.name);
    } catch (e) {
      failed++;
      console.error('FAIL ' + c.name);
      console.error(e && e.stack || e);
    }
  }
} finally {
  await browser.close();
  server.kill();
}
if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log(cases.length + ' passed');

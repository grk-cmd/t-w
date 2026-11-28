/* ═══ 🔁 sim-api-recover.js — api-client + api-health + load-state 를 함께 30분 돌려 요청 수를 센다(B-1128-1 · B-1128-2) ═══
   [왜] 세 모듈이 따로는 맞아도 이어 붙이면 돌 수 있다 — 한 endpoint 만 봉투 붙은 500 을 계속 주고 /v2/config 는 200 이면
     «닿지 않음 → 확인 성공 → 복귀 → 다시 받기 → 500 → 닿지 않음 …» 으로 10초마다 끝없이 돌았다(검증자 실측 30분에 진척 GET 182 · 확인 181).
     진짜 세 모듈을 가짜 fetch · 가짜 시계 위에 잇고 30분을 흘려 요청 수가 작은 상한 안인지 본다.
   ・1절: 진척만 봉투 500 · /v2/config 200 — 닿지 않음이 아니다(진척 GET 1 · 확인 0)
   ・2절: 진척만 네트워크로 계속 실패 · /v2/config 200 — 복귀 다시 받기는 실패 한 묶음에 한 번(진척 GET 2 · 확인 2 · 그 뒤 멈춤)
   ・3절: 켤 때 45초 동안 전부 닿지 않음 → 돌아옴 — 확인 10 · 30 · 60초 뒤 복귀 → 진척을 한 번 다시 받아 ready · 타이머 0
   ・4절: mutation test — 봉투 5xx 를 닿지 않음으로 세면 · 복귀 다시 받기를 묶음마다 한 번으로 안 막으면 빨강 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const DIRS = ['.', 'parts', path.join('parts', 'shared'), 'app', path.join('app', 'parts', 'shared'), path.join('apps', 'desktop', 'app', 'parts', 'shared')];
const read = (f) => { for(const d of DIRS){ try{ return fs.readFileSync(path.join(d, f), 'utf8'); }catch(_){} } return null; };
const SRC0 = { client: read('api-client.js'), health: read('api-health.js'), ls: read('load-state.js') };
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ say('  ? 원본 못 찾음 — ' + k); process.exit(2); }

const settle = async () => { for(let i = 0; i < 30; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };
const mod = (src) => { const m = { exports: {} }; vm.runInNewContext(src, { module: m, console, setTimeout, clearTimeout, AbortController, Promise, Map, Set, Error, String, Date, Math, encodeURIComponent, atob: (x) => Buffer.from(x, 'base64').toString('binary') }); return m.exports; };
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => { if(body instanceof Error) throw body; return body; } });

/* 한 판 — mode(path, t) 가 그 시각의 답을 정한다: 'ok' · 'env500'(봉투 붙은 500) · 'net'(네트워크) */
async function run(S, mode, ms){
  const C = mod(S.client), H = mod(S.health), L = mod(S.ls);
  const clk = { t: 0, q: [] };
  clk.set = (fn, d) => { const h = { at: clk.t + d, fn }; clk.q.push(h); return h; };
  clk.clear = (h) => { clk.q = clk.q.filter((x) => x !== h); };
  const n = { focus: 0, config: 0 };
  const fetch = async (url) => {
    const p = url.replace(C.API_BASE_PROD, '');
    if(p === '/v2/me/focus') n.focus++; else if(p === '/v2/config') n.config++;
    const m = mode(p, clk.t);
    if(m === 'net') throw new TypeError('Failed to fetch');
    if(m === 'env500') return res(500, { success: false, code: 'INTERNAL_ERROR', message: 'x' });
    return res(200, { success: true, data: { ok: 1 } });
  };
  let client = null;
  const health = H.createApiHealth({ probe: () => client.get('/v2/config'), setTimeout: clk.set, clearTimeout: clk.clear });
  client = C.createApiClient({ baseUrl: C.API_BASE_PROD, fetch, getToken: async () => 'h.e30.s', backoffMs: 0, gate: true, random: () => 0.5, now: () => clk.t, setTimeout: clk.set, health });
  const notes = [];
  const ls = L.createLoadState({ fetch: () => client.get('/v2/me/focus', { auth: true }), health, notifyOnce: () => notes.push('once'), notifyRetry: () => notes.push('retry') });
  ls.load('start'); await settle();
  const end = clk.t + ms;
  for(;;){
    clk.q.sort((a, b) => a.at - b.at);
    const h = clk.q[0];
    if(!h || h.at > end) break;
    clk.q.shift(); clk.t = h.at; h.fn(); await settle();
  }
  return { n, state: ls.state(), timers: clk.q.length, notes };
}

const MIN30 = 30 * 60 * 1000;
async function judge(S){
  const r = [], t = (ok, msg) => r.push([!!ok, msg]);
  let x = await run(S, (p) => (p === '/v2/me/focus' ? 'env500' : 'ok'), MIN30);
  t(x.n.focus === 1 && x.n.config === 0 && x.state === 'failed' && x.timers === 0 && x.notes.join() === 'once',
    '★ 진척만 봉투 500 · /v2/config 200 · 30분 — 닿지 않음이 아니다: 진척 GET ' + x.n.focus + ' · 확인 ' + x.n.config + '(상한 1 · 0) · 번호 한 번 · 타이머 0');
  x = await run(S, (p) => (p === '/v2/me/focus' ? 'net' : 'ok'), MIN30);
  t(x.n.focus <= 2 && x.n.config <= 2 && x.timers === 0 && x.state === 'failed',
    '★ 진척만 네트워크로 계속 실패 · /v2/config 200 · 30분 — 복귀 다시 받기는 한 묶음에 한 번: 진척 GET ' + x.n.focus + ' · 확인 ' + x.n.config + '(상한 2 · 2) · 그 뒤 멈춤');
  x = await run(S, (p, now) => (now < 45000 ? 'net' : 'ok'), MIN30);
  t(x.state === 'ready' && x.n.focus === 2 && x.n.config === 3 && x.timers === 0,
    '★ 켤 때 45초 동안 닿지 않음 → 돌아옴 — 확인 ' + x.n.config + '번(10 · 30 · 60초 간격) 뒤 복귀 → 진척 다시 받기 한 번(GET ' + x.n.focus + ') → ready · 타이머 0');
  return r;
}

(async () => {
  say('── 1~3. 세 모듈을 이어 30분 흘린다');
  (await judge(SRC0)).forEach(([ok, m]) => chk(ok, m));
  say('── 4. mutation test');
  const BREAKS = [
    ['client', "e.kind === 'unavailable' && !e.answered && e.code !== 'NOT_MODIFIED';", "e.kind === 'unavailable' && e.code !== 'NOT_MODIFIED';", '① 봉투로 답한 5xx 도 닿지 않음으로 셈'],
    ['ls', "    if(st !== 'failed' || !recoverArmed) return;", "    if(st !== 'failed') return;", '② 복귀 다시 받기를 실패 묶음마다 한 번으로 안 막음'],
    ['health', "    const ms = delays[Math.min(sent, delays.length - 1)];", "    const ms = delays[0];", '확인 간격이 늘지 않음(10초마다 — 3절 확인 수가 늘어 빨강)'],
    ['client', "    const q = health ? p.then((data) => { health.ok(); return data; }", "    const q = health ? p.then((data) => { return data; }", '성공을 health 에 안 알림(복귀가 안 옴)'],
  ];
  const missed = [];
  for(const [where, from, to, what] of BREAKS){
    if(SRC0[where].indexOf(from) < 0){ missed.push('글 못 찾음: ' + what); continue; }
    const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
    let red = false;
    try{ const rows = await Promise.race([judge(S), new Promise((rr) => setTimeout(() => rr(null), 20000))]); red = !rows || rows.some(([o]) => !o); }catch(_){ red = true; }
    if(!red) missed.push(what);
  }
  chk(!missed.length, 'mutation test ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { say('  ✗ 검사 자체가 죽음: ' + (e && e.stack || e)); process.exit(1); });

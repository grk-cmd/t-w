/* sim-user-local.js — 🗂️ 이 계정이 이 PC 에서 고른 것을 확인 뒤에 읽는 한 칸(launcher/user-local.js · app-boot STEPS 맨 앞 userLocal)
   실행:  node sim-user-local.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 모듈이 «만들 때» 계정 값을 PC 칸에서 읽으면 로그인 전에 앞 사람 값이 메모리에 올라온다. 만들 때는 처음 값으로 만들고,
     계정 칸이 열린 뒤 한 칸이 읽어 채우고, 세션이 끝나면 처음 값으로 되돌려야 «A 로그인 → 로그아웃 → B 로그인» 에서 A 의 값이 B 화면에 안 보인다.
   ・1절: user-local.js 를 실제로 돌려 — start 가 조각마다 load 를 한 번씩(차례대로) · 세션이 끝나면 reset 을 거꾸로 · 한 조각이 던져도 다음은 돈다 · 모양이 틀린 조각 · 같은 이름은 만들 때 던진다
   ・2절: 조각으로 건 모듈(꾸미기 파츠 보이기 · 좌석 평준화 · 반응 이모지)을 실제로 돌려 — 만들 때 계정 칸 읽기 0번 · load 가 읽는다 · reset 이 처음 값 · A 값이 B 로 안 넘어간다
   ・3절: 연결 — app.js 의 starts 맨 앞이 userLocal · 조각 목록 · 키가 옮긴 표(MOVED_KEYS)에 있다 · 모듈 소스가 PC 칸(localStorage)을 직접 읽지 않는다
   ・4절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) { try { return fs.readFileSync(c, 'utf8'); } catch (_) {} } return null; };
const SRC = {
  UL: read('launcher/user-local.js'), APP: read('app.js'), STORE: read('shared/account-store.js'),
  DECO: read('character/deco-parts-visibility.js'), EQ: read('character/seat-equalize.js'), FLT: read('room/floaters.js'), SET: read('launcher/settings-panel.js'),
};
for (const k of Object.keys(SRC)) if (!SRC[k]) { say('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

function anything() {
  const f = function () { return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
const loadUL = (src) => { const w = {}; new Function('window', src)(w); return w.TwUserLocal; };
function fakeSession() {
  const resets = [];
  return { resets, onReset: (fn) => { resets.push(fn); }, dispose: () => { resets.splice(0).reverse().forEach((fn) => fn()); } };
}
/* 계정 칸 가짜 — 열린 계정 코드가 바뀌면 다른 칸. 읽은 키를 센다 */
function fakeStore() {
  const cells = { A: {}, B: {} }; let cur = 'A'; const reads = [];
  return { reads, cells, setCode: (c) => { cur = c; }, get: (k) => { reads.push(k); return k in cells[cur] ? cells[cur][k] : null; }, set: (k, v) => { cells[cur][k] = String(v); return true; } };
}

function judge(UL) {
  const r = []; const t = (ok, msg) => r.push([!!ok, msg]);
  const M = loadUL(UL);
  const log = [];
  const part = (name, o) => ({ name, load: () => { log.push('load:' + name); if (o && o.throwLoad) throw new Error('깨짐'); }, reset: () => { log.push('reset:' + name); } });
  /* 1 */
  const ul = M.createUserLocal({ parts: [part('a'), part('b'), part('c')] });
  t(log.length === 0, '만들기만 하면 아무것도 안 읽는다(load 0번)');
  const s = fakeSession(); ul.start(s);
  t(log.join() === 'load:a,load:b,load:c', 'start — 조각마다 load 를 한 번씩, 차례대로');
  s.dispose();
  t(log.join() === 'load:a,load:b,load:c,reset:c,reset:b,reset:a', '세션이 끝나면 reset 을 거꾸로 한 번씩');
  log.length = 0;
  const w0 = console.warn; const warns = []; console.warn = (...a) => warns.push(a.join(' '));
  const ul2 = M.createUserLocal({ parts: [part('x', { throwLoad: true }), part('y')] });
  const s2 = fakeSession(); ul2.start(s2);
  console.warn = w0;
  t(log.join() === 'load:x,load:y' && warns.some((w) => /x load 실패/.test(w)), '한 조각의 load 가 던져도 다음 조각은 돈다 · 어느 조각인지 경고');
  let e1 = null, e2 = null;
  try { M.createUserLocal({ parts: [{ name: 'z', load: () => {} }] }); } catch (e) { e1 = e; }
  try { M.createUserLocal({ parts: [part('d'), part('d')] }); } catch (e) { e2 = e; }
  t(e1 && e2, '모양이 틀린 조각(reset 없음) · 같은 이름 둘은 만들 때 던진다');
  t(JSON.stringify(ul.names) === '["a","b","c"]', '조각 이름 목록을 내놓는다');
  return r;
}

function mods() {
  const any = anything();
  const run = (src, glob, pre) => { const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
    const ls = { getItem: () => { throw new Error('PC 칸을 읽었다'); }, setItem: () => { throw new Error('PC 칸에 썼다'); } };
    return new Function('window', 'document', 'localStorage', 'navigator', 'THREE', 'module', src + '\nreturn window.' + glob + ';')(win, any, ls, any, any, undefined); };
  return { run };
}

function judgeMods(S) {
  const r = []; const t = (ok, msg) => r.push([!!ok, msg]);
  const { run } = mods();
  const st = fakeStore();
  st.cells.A['tw.decoParts'] = '0'; st.cells.A['tw.seatEq'] = '1'; st.cells.A['tw.emojiReactions'] = '0';
  const deco = run(S.DECO, 'TwDecoPartsVisibility').createDecoPartsVisibility({ premiumMod: () => ({}), decoAccountStore: st });
  const eq = run(S.EQ, 'TwSeatEqualize').createSeatEqualize({ seatEqAccountStore: st, ANIMAL_RUN_SCALE: 0.4, seats: [], clampCharY: () => 0, findMySeat: () => null, fitModel: () => {}, setDeskPos: () => {}, setDeskScale: () => {}, syncSeatDeskZ: () => {} });
  const flt = run(S.FLT, 'TwFloaters').createFloaters({ floatersAccountStore: st, ANIMAL_RUN_SCALE: 0.4, focusCharScale: () => 1, scene: any0() });
  t(st.reads.length === 0 && deco.decoPartsVisible() === true && eq.seatEqualizeOn() === false && flt.emojiReactionsEnabled() === true, '★ 만들 때 계정 칸을 읽지 않는다(0번) — 처음 값(파츠 보임 · 평준화 꺼짐 · 반응 이모지 켜짐)으로 선다');
  deco.loadLocal(); eq.loadLocal(); flt.loadLocal();
  t(st.reads.join() === 'tw.decoParts,tw.seatEq,tw.emojiReactions' && deco.decoPartsVisible() === false && eq.seatEqualizeOn() === true && flt.emojiReactionsEnabled() === false, 'loadLocal — 계정 칸에서 한 번씩 읽어 앉힌다(A 가 꺼 둔 파츠 · 켜 둔 평준화 · 꺼 둔 반응 이모지)');
  deco.resetLocal(); eq.resetLocal(); flt.resetLocal();
  t(deco.decoPartsVisible() === true && eq.seatEqualizeOn() === false && flt.emojiReactionsEnabled() === true, 'resetLocal(세션 끝) — 처음 값으로 돌아간다');
  st.setCode('B'); deco.loadLocal(); eq.loadLocal(); flt.loadLocal();
  t(deco.decoPartsVisible() === true && eq.seatEqualizeOn() === false && flt.emojiReactionsEnabled() === true, '★ A → B: B 의 계정 칸에 값이 없으면 A 가 고른 것이 아니라 처음 값이다(A 값이 안 넘어간다)');
  st.setCode('A'); deco.loadLocal(); eq.loadLocal(); flt.loadLocal();
  t(deco.decoPartsVisible() === false && eq.seatEqualizeOn() === true && flt.emojiReactionsEnabled() === false, '  ↳ 다시 A: A 의 값이 돌아온다');
  return r;
}
function any0() { return { add() {}, remove() {} }; }

say('── 1. user-local.js 를 실제로 돌려 본다');
judge(SRC.UL).forEach(([ok, m]) => chk(ok, m));
say('── 2. 조각으로 건 모듈을 실제로 돌려 본다');
{ let rows; try { rows = judgeMods(SRC); } catch (e) { rows = [[false, '모듈 실행이 던짐 — ' + e.message]]; } rows.forEach(([ok, m]) => chk(ok, m)); }

say('── 3. 연결');
{
  const starts = (SRC.APP.match(/const appBoot = TwAppBoot\.createAppBoot\(\{[\s\S]*?\n {2}starts: \{\n([\s\S]*?)\n {2}\},\n\}\);/) || [])[1] || '';
  chk(/^ {4}userLocal: \(code, me, session\)=>userLocalMod\.start\(session\),\n {4}focusTotal:/.test(starts), 'app.js 의 starts 맨 앞이 userLocal — 모든 계정 기능보다 먼저 읽는다');
  const parts = (SRC.APP.match(/const userLocalMod = TwUserLocal\.createUserLocal\(\{ parts: \[([\s\S]*?)\n\] \}\);/) || [])[1] || '';
  const names = [...parts.matchAll(/\{ name: '(\w+)'/g)].map((m) => m[1]);
  chk(['seatEq', 'decoParts', 'emojiReactions'].every((n) => names.includes(n)), 'app.js 의 조각 목록 — ' + names.join(' · '));
  const moved = (SRC.STORE.match(/const MOVED_KEYS = Object\.freeze\(\[([\s\S]*?)\]\);/) || [])[1] || '';
  chk(['tw.decoParts', 'tw.seatEq', 'tw.emojiReactions'].every((k) => moved.includes("'" + k + "'")), '세 키가 옮긴 표(MOVED_KEYS)에 있다 — 0.12 의 PC 값이 들어간 계정 칸으로 간다');
  const noPc = (src, re) => !re.test(strip(src));
  chk(noPc(SRC.DECO, /localStorage/) && noPc(SRC.EQ, /localStorage/) && noPc(SRC.FLT, /localStorage/), '세 모듈이 PC 칸(localStorage)을 직접 읽거나 쓰지 않는다');
  chk(noPc(SRC.SET, /localStorage\.(get|set|remove)Item\('tw\.(decoParts|seatEq|emojiReactions)'/) && /settingsAccountStore\.set\('tw\.decoParts'/.test(SRC.SET) && /settingsAccountStore\.set\('tw\.seatEq'/.test(SRC.SET) && /settingsAccountStore\.set\('tw\.emojiReactions'/.test(SRC.SET), '설정 창이 세 값을 계정 칸에 쓴다(PC 칸 0)');
}

say('── 4. 일부러 깨 보기 — 빨강이 나야 한다');
{
  const breaks = [
    ['UL', 'start 가 load 를 안 부름', (m) => m.replace("for(const p of parts) run(p, 'load');", '')],
    ['UL', '세션이 끝나도 reset 을 안 부름', (m) => m.replace('session.onReset(() => { for(const p of parts.slice().reverse()) run(p, \'reset\'); });', '')],
    ['UL', 'reset 이 앞에서부터', (m) => m.replace('parts.slice().reverse()', 'parts.slice()')],
    ['UL', '한 조각이 던지면 멈춤', (m) => m.replace("catch(e){ console.warn('[user-local] ' + p.name + ' ' + what + ' 실패', e); }", 'catch(e){ throw e; }')],
    ['UL', '같은 이름을 받음', (m) => m.replace("if(new Set(names).size !== names.length) throw new Error('[user-local] 같은 이름의 조각이 둘이에요');", '')],
    ['DECO', '만들 때 계정 칸을 읽음', (m) => m.replace("let decoPartsVisible = true;", "let decoPartsVisible = (decoAccountStore.get('tw.decoParts') !== '0');")],
    ['EQ', 'reset 이 값을 안 되돌림', (m) => m.replace('resetLocal: ()=>{ seatEqualizeOn = false; }', 'resetLocal: ()=>{}')],
    ['FLT', 'loadLocal 이 읽지 않음', (m) => m.replace("emojiReactionsEnabled = (floatersAccountStore.get(EMOJI_REACTIONS_KEY) !== '0');", '')],
    ['DECO', 'PC 칸을 읽음', (m) => m.replace("decoAccountStore.get(DECO_PARTS_KEY)", "localStorage.getItem(DECO_PARTS_KEY)")],
  ];
  for (const [k, name, fm] of breaks) {
    const bad = Object.assign({}, SRC); bad[k] = fm(SRC[k]);
    if (bad[k] === SRC[k]) { chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    let red = false;
    try { red = judge(bad.UL).concat(judgeMods(bad)).some(([ok]) => !ok); } catch (_) { red = true; }
    chk(red, name);
  }
  const app2 = SRC.APP.replace('    userLocal: (code, me, session)=>userLocalMod.start(session),\n', '');
  chk(!/^ {4}userLocal: /m.test(app2), '깨 보기 — app.js starts 에서 userLocal 이 빠지면 연결 판정이 빨강(위 3절 첫 줄 정규식이 못 찾는다)');
}

say(pass + ' · ' + fail);
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);

/* sim-user-local.js — 🗂️ 이 계정이 이 PC 에서 고른 것을 확인 뒤에 읽는 한 칸(launcher/user-local.js · app-boot STEPS 맨 앞 userLocal)
   실행:  node sim-user-local.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 모듈이 «만들 때» 계정 값을 PC 칸에서 읽으면 로그인 전에 앞 사람 값이 메모리에 올라온다. 만들 때는 처음 값으로 만들고,
     계정 칸이 열린 뒤 한 칸이 읽어 채우고, 세션이 끝나면 처음 값으로 되돌려야 «A 로그인 → 로그아웃 → B 로그인» 에서 A 의 값이 B 화면에 안 보인다.
   ・1절: user-local.js 를 실제로 돌려 — start 가 조각마다 load 를 한 번씩(차례대로) · 세션이 끝나면 reset 을 거꾸로 · 한 조각이 던져도 다음은 돈다 · 모양이 틀린 조각 · 같은 이름은 만들 때 던진다
   ・2절: 조각으로 건 모듈(꾸미기 파츠 보이기 · 좌석 평준화 · 반응 이모지)을 실제로 돌려 — 만들 때 계정 칸 읽기 0번 · load 가 읽는다 · reset 이 처음 값 · A 값이 B 로 안 넘어간다
   ・2b절: 현재 슬롯(app.js _loadCurSlot) · 자리 추가 슬롯(settings-panel.js loadExtraSeatSlots)을 가짜 계정 칸 위에서 돌려 — 만들 때 읽기 0 · load 가 읽음 · 범위 밖 · 깨진 값은 처음 값
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
  DECO: read('character/deco-parts-visibility.js'), EQ: read('character/seat-equalize.js'), FLT: read('room/floaters.js'), SET: read('launcher/settings-panel.js'), ACC: read('account/account.js'), HID: read('room/hidden-seats.js'), UST: read('status/user-status-table.js'), PRES: read('room/presence.js'),
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
  /* 신고로 숨긴 사람 · 커스텀 상태 문구 */
  const st2 = fakeStore();
  st2.cells.A['tw.reportHidden'] = JSON.stringify(['uxx1', 'uxx2', 7]); st2.cells.A['tw.customStatus'] = JSON.stringify({ emo: '🐱', text: '회의 중' });
  const hid = run(S.HID, 'TwHiddenSeats').createHiddenSeats({ hiddenAccountStore: st2, _flyActive: () => false, seatFromObject: () => null, seats: [] });
  const ust = run(S.UST, 'TwUserStatusTable').createUserStatusTable({ statusAccountStore: st2 });
  t(st2.reads.length === 0 && hid._reportHiddenUids.size === 0 && ust.customStatusConf().text === '', '★ 숨긴 사람 · 커스텀 상태도 만들 때 계정 칸을 읽지 않는다(0번) — 빈 값으로 선다');
  hid.loadReportHidden(); ust.loadCustomStatusFromStorage();
  t(hid._reportHiddenUids.has('uxx1') && hid._reportHiddenUids.has('uxx2') && hid._reportHiddenUids.size === 2 && ust.customStatusConf().text === '회의 중', 'load — A 의 숨긴 사람(글자만) · 커스텀 상태 문구를 읽어 앉힌다');
  hid._reportHiddenSave();
  t(JSON.parse(st2.cells.A['tw.reportHidden']).join() === 'uxx1,uxx2', '숨긴 사람 저장은 계정 칸으로(A 칸)');
  st2.setCode('B'); hid.loadReportHidden();
  t(hid._reportHiddenUids.size === 0, '★ A → B: B 칸에 값이 없으면 A 의 숨긴 사람이 비워진다(남지 않는다)');
  return r;
}
function any0() { return { add() {}, remove() {} }; }

say('── 1. user-local.js 를 실제로 돌려 본다');
judge(SRC.UL).forEach(([ok, m]) => chk(ok, m));
say('── 2. 조각으로 건 모듈을 실제로 돌려 본다');
{ let rows; try { rows = judgeMods(SRC); } catch (e) { rows = [[false, '모듈 실행이 던짐 — ' + e.message]]; } rows.forEach(([ok, m]) => chk(ok, m)); }

function judgeConn(S) {
  const r = []; const t = (ok, msg) => r.push([!!ok, msg]);
/* 2b. 현재 슬롯 · 자리 추가 슬롯 */
{
  const fnText = (S.APP.match(/function _loadCurSlot\(\)\{[^\n]*\n/) || [''])[0].replace(/\/\/.*$/, '');
  const exSrc = (S.SET.match(/function loadExtraSeatSlots\(\)\{[\s\S]*?\n\}\n/) || [''])[0];
  t(!!fnText && !!exSrc, '원본에서 _loadCurSlot · loadExtraSeatSlots 를 찾았다');
  const mkCur = (store) => new Function('accountStoreMod', 'CUR_SLOT_KEY', 'CHAR_SLOT_MAX', fnText + '\nreturn _loadCurSlot;')({ get: (k) => (k in store ? store[k] : null) }, 'tw.curSlot', 5);
  t(mkCur({ 'tw.curSlot': '3' })() === 3 && mkCur({})() === 0 && mkCur({ 'tw.curSlot': '9' })() === 0 && mkCur({ 'tw.curSlot': '-1' })() === 0 && mkCur({ 'tw.curSlot': 'x' })() === 0, '_loadCurSlot — 계정 칸 값 · 없으면 0 · 범위 밖(9 · -1) · 깨진 값은 0');
  const runEx = (store) => { const o = new Function('settingsAccountStore', 'EXTRA_SEAT_KEY', 'let extraSeatSlots = [];\n' + exSrc + '\nreturn { load: loadExtraSeatSlots, get: () => extraSeatSlots, put: (v) => { extraSeatSlots = v; } };')({ get: (k) => (k in store ? store[k] : null) }, 'tw.extraSeatSlots'); return o; };
  const e1 = runEx({ 'tw.extraSeatSlots': '[1,2,"x",3.5]' }); e1.load();
  t(e1.get().join() === '1,2', 'loadExtraSeatSlots — 정수만 앉힌다(문자 · 소수 제외)');
  const e2 = runEx({ 'tw.extraSeatSlots': '{깨짐' }); e2.put([4]); e2.load();
  t(e2.get().length === 0, '  깨진 JSON · 없는 값이면 앞에 있던 것도 비우고 빈 목록(앞 계정 값이 남지 않는다)');
}

/* 3. 연결 */
{
  const starts = (S.APP.match(/const appBoot = TwAppBoot\.createAppBoot\(\{[\s\S]*?\n {2}starts: \{\n([\s\S]*?)\n {2}\},\n\}\);/) || [])[1] || '';
  t(/^ {4}userLocal: \(code, me, session\)=>userLocalMod\.start\(session\),\n {4}focusTotal:/.test(starts), 'app.js 의 starts 맨 앞이 userLocal — 모든 계정 기능보다 먼저 읽는다');
  const parts = (S.APP.match(/const userLocalMod = TwUserLocal\.createUserLocal\(\{ parts: \[([\s\S]*?)\n\] \}\);/) || [])[1] || '';
  const names = [...parts.matchAll(/\{ name: '(\w+)'/g)].map((m) => m[1]);
  t(['seatEq', 'decoParts', 'emojiReactions'].every((n) => names.includes(n)), 'app.js 의 조각 목록 — ' + names.join(' · '));
  const moved = (S.STORE.match(/const MOVED_KEYS = Object\.freeze\(\[([\s\S]*?)\]\);/) || [])[1] || '';
  t(['tw.decoParts', 'tw.seatEq', 'tw.emojiReactions'].every((k) => moved.includes("'" + k + "'")), '세 키가 옮긴 표(MOVED_KEYS)에 있다 — 0.12 의 PC 값이 들어간 계정 칸으로 간다');
  const noPc = (src, re) => !re.test(strip(src));
  t(['tw.curSlot', 'tw.extraSeatSlots'].every((k) => moved.includes("'" + k + "'")), '현재 슬롯 · 자리 추가 슬롯도 옮긴 표(MOVED_KEYS)에 있다');
  t(/^let curSlot=0;/m.test(S.APP) && /function _loadCurSlot\(\)\{[^\n]*accountStoreMod\.get\(CUR_SLOT_KEY\)/.test(S.APP) && /function saveCurSlot\(\)\{[^\n]*accountStoreMod\.set\(CUR_SLOT_KEY/.test(S.APP) && noPc(S.APP, /localStorage\.(get|set|remove)Item\(CUR_SLOT_KEY/),
    '현재 슬롯 — 만들 때 0 · 계정 칸에서 읽고 쓴다(PC 칸 0)');
  t(/\{ name: 'curSlot', load: \(\)=>\{ curSlot = _loadCurSlot\(\); \}, reset: \(\)=>\{ curSlot = 0; \}/.test(parts) && /\{ name: 'extraSeats', load: \(\)=>settingsMod\.loadExtraSeatSlots\(\), reset: \(\)=>settingsMod\.setExtraSeatSlots\(\[\]\)/.test(parts), '조각 curSlot · extraSeats — load 가 읽고 reset 이 처음 값');
  t(!/\(function _loadExtraSeatSlots\(\)/.test(S.SET) && /settingsAccountStore\.get\(EXTRA_SEAT_KEY\)/.test(S.SET) && /settingsAccountStore\.set\(EXTRA_SEAT_KEY/.test(S.SET) && noPc(S.SET, /localStorage\.(get|set|remove)Item\(EXTRA_SEAT_KEY/), '자리 추가 슬롯 — 만들 때 읽지 않고(즉시 실행 걷음) 계정 칸에서 읽고 쓴다');
  t(/\{ name: 'status', load: \(\)=>\{ userStatusTableMod\.loadCustomStatusFromStorage\(\); loadUserStatusFromStorage\(\); Presence\.restoreBootStatus\(\);/.test(parts) && /reset: \(\)=>\{ userStatusTableMod\.setCustomStatusConf\(\{ emo:'', text:'' \}\); userStatus = null; Presence\.resetBootStatus\(\);/.test(parts) && /\{ name: 'reportHidden', load: \(\)=>hiddenSeatsMod\.loadReportHidden\(\), reset: \(\)=>hiddenSeatsMod\._reportHiddenUids\.clear\(\)/.test(parts), '조각 status · reportHidden — load 가 읽고 reset 이 비운다');
  t(['tw.userStatus', 'tw.customStatus', 'tw.awayKind', 'tw.reportHidden'].every((k) => moved.includes("'" + k + "'")), '상태 · 커스텀 상태 · 자리비움 종류 · 숨긴 사람도 옮긴 표(MOVED_KEYS)에 있다');
  t(noPc(S.APP, /localStorage\.(get|set|remove)Item\(('tw\.userStatus'|userStatusTableMod\.CUSTOM_STATUS_KEY)/) && /accountStoreMod\.set\('tw\.userStatus'/.test(S.APP) && /accountStoreMod\.get\('tw\.userStatus'\)/.test(S.APP) && /accountStoreMod\.set\(userStatusTableMod\.CUSTOM_STATUS_KEY/.test(S.APP), 'app.js — 상태 · 커스텀 상태를 계정 칸에서 읽고 쓴다(PC 칸 0)');
  t(noPc(S.PRES, /localStorage\.(get|set|remove)Item/) && /presenceAccountStore\.get\('tw\.userStatus'\)/.test(S.PRES) && /presenceAccountStore\.set\(AWAY_KIND_KEY/.test(S.PRES) && !/\(function _restoreBootStatus\(\)/.test(S.PRES), 'Presence — 켤 때 상태 복원이 만들 때(즉시 실행)가 아니라 restoreBootStatus 이고 계정 칸을 쓴다(PC 칸 0)');
  t(noPc(S.HID, /localStorage\.(get|set|remove)Item/) && noPc(S.UST, /localStorage\.(get|set|remove)Item/), '숨긴 사람 · 커스텀 상태 모듈이 PC 칸을 안 읽는다');
  const wipe = (S.ACC.match(/const ACCOUNT_LOCAL_KEYS = \(\)=>\[[\s\S]*?\n\];/) || [''])[0];
  t(wipe && !/CUR_SLOT_KEY|EXTRA_SEAT_KEY|CUSTOM_STATUS_KEY|tw\.(curSlot|extraSeatSlots|userStatus|customStatus|awayKind|reportHidden)/.test(strip(wipe)), '로그아웃 지움 목록에 이 PR 이 옮긴 키가 없다 — 계정 칸은 로그아웃해도 지우지 않는다(같은 계정이 돌아오면 이어진다)');
  t(noPc(S.DECO, /localStorage/) && noPc(S.EQ, /localStorage/) && noPc(S.FLT, /localStorage/), '세 모듈이 PC 칸(localStorage)을 직접 읽거나 쓰지 않는다');
  t(noPc(S.SET, /localStorage\.(get|set|remove)Item\('tw\.(decoParts|seatEq|emojiReactions)'/) && /settingsAccountStore\.set\('tw\.decoParts'/.test(S.SET) && /settingsAccountStore\.set\('tw\.seatEq'/.test(S.SET) && /settingsAccountStore\.set\('tw\.emojiReactions'/.test(S.SET), '설정 창이 세 값을 계정 칸에 쓴다(PC 칸 0)');
}
  return r;
}

say('── 2b~3. 현재 슬롯 · 자리 추가 슬롯 · 연결');
judgeConn(SRC).forEach(([ok, m]) => chk(ok, m));

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
    ['APP', 'starts 에서 userLocal 이 빠짐', (m) => m.replace('    userLocal: (code, me, session)=>userLocalMod.start(session),\n', '')],
    ['APP', '현재 슬롯을 만들 때 읽음', (m) => m.replace('let curSlot=0;', 'let curSlot=_loadCurSlot();')],
    ['APP', '현재 슬롯을 PC 칸에서 읽음', (m) => m.replace('accountStoreMod.get(CUR_SLOT_KEY)', 'localStorage.getItem(CUR_SLOT_KEY)')],
    ['APP', '현재 슬롯 조각이 값을 안 채움', (m) => m.replace('load: ()=>{ curSlot = _loadCurSlot(); }', 'load: ()=>{}')],
    ['SET', '자리 추가 슬롯을 PC 칸에서 읽음', (m) => m.replace('settingsAccountStore.get(EXTRA_SEAT_KEY)', 'localStorage.getItem(EXTRA_SEAT_KEY)')],
    ['SET', '자리 추가 슬롯이 앞 값을 안 비움', (m) => m.replace('function loadExtraSeatSlots(){\n  extraSeatSlots = [];', 'function loadExtraSeatSlots(){')],
    ['ACC', '로그아웃이 현재 슬롯을 지움', (m) => m.replace("  'tw.slotGlbUrls', 'tw.roomFaceUrls',", "  CUR_SLOT_KEY, 'tw.slotGlbUrls', 'tw.roomFaceUrls',")],
    ['APP', '상태를 PC 칸에서 읽음', (m) => m.replace("accountStoreMod.get('tw.userStatus')", "localStorage.getItem('tw.userStatus')")],
    ['APP', '상태 조각이 Presence 복원을 안 부름', (m) => m.replace('Presence.restoreBootStatus(); refreshMyStatusUI();', 'refreshMyStatusUI();')],
    ['PRES', '상태 복원을 즉시 실행으로 되돌림', (m) => m.replace('function restoreBootStatus(){', '(function _restoreBootStatus(){').replace('function resetBootStatus(){', '})();\n  function resetBootStatus(){')],
    ['PRES', '자리비움 종류를 PC 칸에 씀', (m) => m.replace('presenceAccountStore.set(AWAY_KIND_KEY', 'localStorage.setItem(AWAY_KIND_KEY')],
    ['HID', '숨긴 사람을 만들 때 읽음', (m) => m.replace("const _reportHiddenUids = new Set();", "const _reportHiddenUids = new Set(); try{ JSON.parse(hiddenAccountStore.get('tw.reportHidden') || '[]').forEach(u=>_reportHiddenUids.add(u)); }catch(_){}")],
    ['HID', '숨긴 사람 load 가 앞 값을 안 비움', (m) => m.replace('  _reportHiddenUids.clear();\n  try{ const _rh', '  try{ const _rh')],
    ['UST', '커스텀 상태를 PC 칸에서 읽음', (m) => m.replace('statusAccountStore.get(CUSTOM_STATUS_KEY)', 'localStorage.getItem(CUSTOM_STATUS_KEY)')],
    ['ACC', '로그아웃이 상태를 지움', (m) => m.replace("  USER_NAME_KEY,   //", "  USER_NAME_KEY, 'tw.userStatus',   //")],
    ['DECO', 'PC 칸을 읽음', (m) => m.replace("decoAccountStore.get(DECO_PARTS_KEY)", "localStorage.getItem(DECO_PARTS_KEY)")],
  ];
  for (const [k, name, fm] of breaks) {
    const bad = Object.assign({}, SRC); bad[k] = fm(SRC[k]);
    if (bad[k] === SRC[k]) { chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    let red = false;
    try { red = judge(bad.UL).concat(judgeMods(bad), judgeConn(bad)).some(([ok]) => !ok); } catch (_) { red = true; }
    chk(red, name);
  }
}

say(pass + ' · ' + fail);
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);

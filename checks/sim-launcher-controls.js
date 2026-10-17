/* ═══ 🎛️ sim-launcher-controls.js — 🎛️ 런처 컨트롤 모듈 (2026-10-16 신설 · C 구역 떼기 · w3) ═══════════════
   app.js 의 런처 컨트롤 구역 본문 을 parts/launcher/launcher-controls.js 로 옮겼다(글자 그대로 · 바뀐 줄 21 — 읽는 · 쓰는 함수로 바꾼 자리).
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(closeGearMenu)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 만드는 줄 · deps 13줄 그대로 · 부르는 곳은 launcherCtlMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   ・4절: 동작 — 가짜 DOM · deps 로 모듈을 만들어 입력 → 결과(경계값 포함)를 본다
   [실행] app.js · desk-companion-prototype.html · launcher-controls.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["launcher-controls.js","parts/launcher/launcher-controls.js","app/parts/launcher/launcher-controls.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — launcher-controls.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["launchApp","openCreator","renderLauncher","saveCurSlot","toast"];
const VAL_DEPS = ["CHAR_SLOT_MAX","settingsMod","slots"];
const GET_DEPS = ["charsMod","curSlot","racePickerMod","slotSaveMod"];
const SET_DEPS = ["curSlot"];
const EXPORTS = ["closeGearMenu"];
const MOVED = ["gearMenu","closeGearMenu","lcDeleteAskEnd","lcDeleteAskStart","previewWrap","doDeleteCurSlot","_moveToBoxBusy","doMoveCurSlotToBox"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  CHAR_SLOT_MAX: CHAR_SLOT_MAX,","  charsMod: ()=>charsMod,","  curSlot: ()=>curSlot,","  launchApp: (...a)=>launchApp(...a),","  openCreator: (...a)=>openCreator(...a),","  racePickerMod: ()=>racePickerMod,","  renderLauncher: (...a)=>renderLauncher(...a),","  saveCurSlot: (...a)=>saveCurSlot(...a),","  settingsMod: settingsMod,","  slotSaveMod: ()=>slotSaveMod,","  slots: slots,","  toast: (...a)=>toast(...a),","  setCurSlot: (v)=>{ curSlot = v; },"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다. */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
/* over: deps 덮어쓰기 · env: 전역 덮어쓰기(document · window · THREE …) */
function build(src, over, env){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  Object.assign(deps, over || {});
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const E = Object.assign({ window: win, document: any, localStorage: ls, navigator: any, firebaseAPI: any, companion: any, setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => {}, clearInterval: () => {},
    requestAnimationFrame: () => 0, THREE: any, addEventListener: () => {}, removeEventListener: () => {}, module: undefined, MutationObserver: class { observe(){} disconnect(){} }, ResizeObserver: class { observe(){} disconnect(){} },
    performance: { now: () => 0 }, console: { log(){}, warn(){}, error(){} }, Image: any, confirm: () => true, devicePixelRatio: 1 }, env || {});
  const keys = Object.keys(E);
  const api = new Function(...keys, src + '\nreturn window.TwLauncherControls;')(...keys.map(k => E[k]));
  return api.createLauncherControls(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwLauncherControls = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwLauncherControls(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(app.includes("const launcherCtlMod = TwLauncherControls.createLauncherControls({"), '만드는 줄(가드 없이 — 모듈은 늘 싣는다)');
  const mk = (app.match(new RegExp("const launcherCtlMod = TwLauncherControls\\.createLauncherControls\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);")) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(new RegExp("const launcherCtlMod = [\\s\\S]*?\\n\\}\\);"), '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));
  t(!bare.length, '부르는 곳은 launcherCtlMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/launcher/launcher-controls.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/launcher/launcher-controls.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/launcher/launcher-controls.js"></script>', '')],
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const launcherCtlMod = TwLauncherControls.createLauncherControls({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const launcherCtlMod = TwLauncherControls.createLauncherControls({", "const launcherCtlMod = TwLauncherControls.createLauncherControls({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwLauncherControls = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith("const launcherCtlMod =")) continue; const n = EXPORTS.filter(x => ![].includes(x)).find(x => ls[i].includes("launcherCtlMod." + x)); if(n){ ls[i] = ls[i].replace("launcherCtlMod." + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createLauncherControls(deps){', 'function createLauncherControls(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [nm, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), nm + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('── 4. 동작');
/* 동작 검사용 작은 가짜 DOM — id 로 찾은 요소를 기억하고 style · classList · onclick · 이벤트를 받는다. */
function fakeDom(absent){   // absent: 처음엔 없는(코드가 만들어 붙이는) id 목록
  const gone = new Set(absent || []);
  const els = {};
  const mkEl = (id, tag) => {
    const cls = new Set();
    const ev = {};
    const el = {
      id: id || '', tagName: (tag || 'div').toUpperCase(), style: {}, dataset: {}, textContent: '', innerHTML: '', value: '', title: '', disabled: false, children: [], parentElement: null,
      classList: { add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), contains: (c) => cls.has(c), toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; v ? cls.add(c) : cls.delete(c); return v; } },
      addEventListener: (t, f) => { (ev[t] = ev[t] || []).push(f); }, removeEventListener: () => {},
      appendChild: (c) => { el.children.push(c); c.parentElement = el; if(c.id) els[c.id] = c; return c; },
      getContext: () => new Proxy({}, { get: () => () => {} }), querySelector: () => null, querySelectorAll: () => [],
      fire: (t, e) => { (ev[t] || []).forEach(f => f(Object.assign({ stopPropagation(){}, preventDefault(){}, currentTarget: el }, e || {}))); },
      click: () => { if(typeof el.onclick === 'function') el.onclick({ stopPropagation(){}, preventDefault(){}, currentTarget: el }); el.fire('click'); },
    };
    return el;
  };
  const docEv = {};
  const document = {
    getElementById: (id) => els[id] || (gone.has(id) ? null : (els[id] = mkEl(id))),
    createElement: (tag) => mkEl('', tag),
    querySelector: (s) => els['q:' + s] || (els['q:' + s] = mkEl('q:' + s)),
    querySelectorAll: () => [],
    addEventListener: (t, f) => { (docEv[t] = docEv[t] || []).push(f); },
    removeEventListener: () => {},
    body: mkEl('body'),
    fire: (t) => (docEv[t] || []).forEach(f => f({})),
  };
  return { document, els, mkEl };
}

/* 슬롯 · 좌석 상태를 가짜로 쥐고 버튼을 눌러 본다 — 앞뒤 넘기기(감아 돌기) · [＋] · 삭제 되묻기 · 당기기 · 보관함 이동 */
function rig(slotsInit, cur, extra, opt){
  const D = fakeDom(['lcDeleteAsk', 'lcDelYes', 'lcDelNo']); opt = opt || {};
  const st = { slots: slotsInit.slice(), cur, extra: extra ? extra.slice() : extra, calls: [] };
  const log = (n) => (...a) => { st.calls.push([n, ...a]); };
  const chars = { _charsBoxFull: () => !!opt.boxFull, _charsDeleteWords: () => ({ ask: '정말 지울까요?', btn: '삭제', gear: '톱니' }), _charsTrashMove: () => !!opt.trash,
    _charsDeskToBox: opt.toBox || (async () => ({ ok: true })), _charsMoveFailLog: log('failLog'), _charsMoveMsg: (r) => '못 옮김:' + r.why };
  const settings = { extraSeatSlots: () => st.extra, setExtraSeatSlots: (v) => { st.extra = v; }, _saveExtraSeatSlots: log('saveExtra') };
  const over = { CHAR_SLOT_MAX: st.slots.length, slots: st.slots, curSlot: () => st.cur, setCurSlot: (v) => { st.cur = v; }, settingsMod: settings,
    charsMod: () => chars, racePickerMod: () => ({ openRacePicker: log('race') }), slotSaveMod: () => ({ saveSlots: log('save') }),
    saveCurSlot: log('saveCur'), renderLauncher: log('render'), toast: log('toast'), openCreator: log('creator'), launchApp: log('launch') };
  const api = build(MOD, over, { document: D.document });
  return { D, st, api, el: (id) => D.document.getElementById(id), n: (k) => st.calls.filter(c => c[0] === k).length, last: (k) => (st.calls.filter(c => c[0] === k).pop() || [])[1] };
}
const tick = () => new Promise(r => setImmediate(r));
(async () => {
  { const r = rig(['a', 'b', null, null, null], 0);
    r.el('lcPrev').click(); chk(r.st.cur === 4 && r.n('saveCur') === 1 && r.n('render') === 1, '◀ 첫 칸에서 누르면 마지막 칸으로 감아 돈다(0 → 4) · 저장 · 다시 그림');
    r.el('lcNext').click(); chk(r.st.cur === 0, '▶ 마지막 칸에서 누르면 첫 칸으로(4 → 0)');
    r.el('lcNext').click(); chk(r.st.cur === 1, '▶ 한 칸 앞으로(0 → 1)'); }
  { const r = rig(['a', null, null], 0);
    r.el('lcEmpty').click(); chk(r.n('race') === 0, '[＋] — 캐릭터가 있는 칸이면 무시');
    r.st.cur = 2; r.el('lcEmpty').click(); chk(r.last('race') === 2, '[＋] — 빈 칸이면 그 칸 번호로 종족 선택창'); }
  { const r = rig(['a', 'b'], 0); r.st.slots[0] = null; r.st.slots[0] = 'a';
    const full = rig(['a', 'b'], 1); full.st.slots[1] = 'b';
    full.st.cur = 1; full.st.slots[1] = null; full.st.slots.fill('x'); full.st.slots[1] = null;
    full.el('lcEmpty').click(); chk(full.n('race') === 1, '[＋] — 빈 칸이 하나라도 있으면 연다');
    const all = rig(['a', 'b'], 0); all.el('lcEmpty').click(); chk(all.n('race') === 0 && all.n('toast') === 0, '[＋] — 꽉 찬 칸에선 아무것도 안 함(그 칸은 캐릭터가 있다)');
    const boxFull = rig(['a', null], 1, null, { boxFull: true }); boxFull.el('lcEmpty').click(); chk(boxFull.n('race') === 0, '[＋] — 보관함 문턱이 차면 막는다'); }
  { const r = rig(['a', null], 1); r.st.slots[0] = 'a'; r.st.slots[1] = null;
    const z = rig([null, null], 0); z.st.slots[0] = null; z.el('lcEmpty').click(); chk(z.last('race') === 0, '[＋] — 전부 빈 칸이면 0번 칸'); }
  /* 삭제 — 되묻고 [네] 일 때만 당긴다 · 자리 추가 번호도 같이 당긴다 */
  { const r = rig(['a', 'b', 'c', 'd', null], 1, [1, 2, 3]);
    r.el('lcDelete').click();
    const ask = r.el('lcDeleteAsk');
    chk(ask.style.display === 'flex' && r.el('lcEdit').style.display === 'none' && r.el('lcDelAskText').textContent === '정말 지울까요?', '[삭제] — 바로 지우지 않고 메뉴 안에서 되묻는다(문구는 보관함 스위치에서)');
    chk(r.st.slots.join() === 'a,b,c,d,', '되묻는 동안 슬롯은 그대로');
    r.el('lcDelNo').click(); chk(ask.style.display === 'none' && r.el('lcEdit').style.display === '', '[아니오] — 묻기를 닫고 메뉴 버튼을 되살린다');
    r.el('lcDelete').click(); r.el('lcDelYes').click();
    chk(r.st.slots.join() === 'a,c,d,,' && r.st.slots.length === 5, '[네] — 지운 칸 뒤를 앞으로 당기고 끝은 빈 칸(b 삭제 → a,c,d)');
    chk(JSON.stringify(r.st.extra) === '[1,2]' && r.n('saveExtra') === 1, '자리 추가 번호 — 지운 번호는 빼고 뒤 번호는 하나씩 당긴다([1,2,3] → [1,2])');
    chk(r.st.cur === 1 && r.n('save') === 1 && r.n('saveCur') === 1 && r.last('toast') === '삭제했어요', '현재 칸은 당겨진 캐릭터(c) · 저장 · «삭제했어요»'); }
  { const r = rig(['a', 'b', null], 1, null, { trash: true }); r.el('lcDelete').click(); r.el('lcDelYes').click();
    chk(r.st.slots.join() === 'a,,' && r.st.cur === 0 && r.last('toast') === '휴지통으로 옮겼어요', '마지막 캐릭터를 지우면 현재 칸은 남은 마지막 캐릭터로 · 휴지통 켜짐이면 «휴지통으로»'); }
  { const r = rig(['a', null], 0); r.el('lcDelete').click(); r.el('lcDelYes').click();
    chk(r.st.slots.join() === ',' && r.st.cur === 0, '하나뿐인 캐릭터를 지우면 현재 칸 0'); }
  { const r = rig([null, 'b'], 0); r.el('lcDelete').click(); r.el('lcDelYes').click();
    chk(r.n('save') === 0 && r.st.slots.join() === ',b', '빈 칸에서 [네] — 아무것도 안 한다'); }
  /* 톱니 — 메뉴 토글 · 문서 클릭이면 닫히며 되묻기도 취소 */
  { const r = rig(['a'], 0); r.el('lcGear').click();
    chk(r.el('lcGearMenu').classList.contains('on') && r.el('lcDelete').textContent === '삭제', '톱니 — 메뉴를 열고 삭제 버튼 문구를 스위치에 맞춘다');
    r.el('lcDelete').click(); r.D.document.fire('click');
    chk(!r.el('lcGearMenu').classList.contains('on') && r.el('lcDeleteAsk').style.display === 'none', '바깥 클릭 — 메뉴를 닫고 되묻기도 취소');
    r.el('lcGear').click(); r.api.closeGearMenu(); chk(!r.el('lcGearMenu').classList.contains('on'), 'closeGearMenu — 밖에서 불러도 닫힌다');
    r.el('lcEdit').click(); chk(JSON.stringify(r.last('creator')) === '{"kind":"slot","edit":true,"slot":0}', '[수정] — 지금 칸을 수정 모드로 생성기에');
    r.el('lcPreview').fire('click'); chk(JSON.stringify(r.last('launch')) === '{"mode":"run"}', '미리보기 클릭 — 실행'); }
  /* 보관함 이동 — 성공이면 그 캐릭터 자리를 다시 찾아 당긴다 · 실패면 이유 문구 · 진행 중이면 다시 안 들어간다 */
  { let release; const r = rig(['a', 'b', 'c'], 0, [0, 2], { toBox: () => new Promise(res => { release = res; }) });
    r.el('lcToBox').click(); r.el('lcToBox').click();
    chk(r.last('toast') === '보관함으로 옮기는 중이에요 — 잠시만요', '보관함 이동 — 진행 중에 또 누르면 막는다');
    r.st.slots.splice(0, 0, 'z'); r.st.slots.length = 3;   // 기다리는 사이 칸이 밀렸다(a 가 1번으로)
    release({ ok: true }); await tick(); await tick();
    chk(r.st.slots.join() === 'z,b,' && JSON.stringify(r.st.extra) === '[0,1]', '기다린 뒤엔 번호가 아니라 그 캐릭터로 칸을 다시 찾아 당긴다(a 가 1번 → z,b · 자리 추가 [0,2] → [0,1])');
    chk(r.last('toast') === '보관함으로 옮겼어요', '«보관함으로 옮겼어요»'); }
  { const r = rig(['a', 'b'], 0, null, { toBox: async () => ({ ok: false, why: 'nocid' }) });
    r.el('lcToBox').click(); await tick(); await tick();
    chk(r.st.slots.join() === 'a,b' && r.last('toast') === '못 옮김:nocid' && r.n('failLog') === 1, '보관함 이동 실패 — 칸은 그대로 · 이유 문구 · 실패 기록'); }
  { const r = rig(['a', 'b'], 0, null, { toBox: async () => { throw new Error('x'); } });
    r.el('lcToBox').click(); await tick(); await tick();
    chk(r.last('toast') === '못 옮김:err', '보관함 이동 중 던짐 — err 로 받아 안내'); }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
return;

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

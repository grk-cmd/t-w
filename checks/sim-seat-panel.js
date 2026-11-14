/* ═══ 🎚️ sim-seat-panel.js — 🎚️ 좌석 탭 · 상태 버튼 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w1) ═══════════════
   app.js 의 좌석 패널 본문 을 parts/character/seat-panel.js 로 옮겼다(글자 그대로 · 바뀐 줄 3 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 가짜 DOM 으로 탭 · 버튼 · 슬라이더).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(dot · manual · renderSeatTabs · selectSeat · setInfo · setManual · sliders · stateLabel)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 5줄 그대로 · 부르는 곳은 seatPanelMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · seat-panel.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["seat-panel.js","parts/character/seat-panel.js","app/parts/character/seat-panel.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — seat-panel.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["activity","triggerPet"];
const VAL_DEPS = ["seats"];
const GET_DEPS = ["selected"];
const SET_DEPS = ["selected"];
const EXPORTS = ["dot","manual","renderSeatTabs","selectSeat","setInfo","setManual","sliders","stateLabel"];
const MOVED = ["dot","stateLabel","autoTag","btnWrap","modelInfo","sliders","seatsEl","setInfo","renderSeatTabs","selectSeat","manual","setManual"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  activity: (...a)=>activity(...a),","  seats: seats,","  selected: ()=>selected,","  triggerPet: (...a)=>triggerPet(...a),","  setSelected: (v)=>{ selected = v; },"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'MutationObserver', 'ResizeObserver',
    src + '\nreturn window.TwSeatPanel;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createSeatPanel(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwSeatPanel = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwSeatPanel(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("SEAT_PANEL_MOD_OFF") && app.includes("const seatPanelMod = TwSeatPanel.createSeatPanel({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const seatPanelMod = TwSeatPanel\\.createSeatPanel\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => !["dot","manual"].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const seatPanelMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 seatPanelMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/seat-panel.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/seat-panel.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/seat-panel.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const seatPanelMod = TwSeatPanel.createSeatPanel({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const seatPanelMod = TwSeatPanel.createSeatPanel({", "const seatPanelMod = TwSeatPanel.createSeatPanel({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwSeatPanel = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const seatPanelMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('seatPanelMod.' + x)); if(n){ ls[i] = ls[i].replace('seatPanelMod.' + n, n); return ls.join('\n'); } } return a + '\n' + EXPORTS[0] + '(true);'; }, null],   // app.js 에 부르는 자리가 없으면(다른 모듈만 부른다) 옛 이름 부름을 끼워 본다
  ['만들 때 던짐', m => m.replace('function createSeatPanel(deps){', 'function createSeatPanel(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
/* ── 4. 동작 — 가짜 DOM 으로 좌석 탭 · 상태 버튼 · 안내(옮기기 전 app.js 글로도 같은 판정) */
say('── 4. 동작 — 좌석 탭 · 상태 버튼 · 안내');
{
  function el(tag){
    const e = { tagName: tag, children: [], value: null, textContent: '', innerHTML: '', className: '', dataset: {}, _ls: {}, min: null, max: null, step: null, title: '',
      cls: new Set(),
      addEventListener(t, f){ (this._ls[t] = this._ls[t] || []).push(f); },
      fire(t, ev){ (this._ls[t] || []).forEach(f => f(Object.assign({ target: this }, ev || {}))); },
      appendChild(c){ this.children.push(c); c.parentNode = this; return c; },
      closest(sel){ return this.tagName === 'button' ? this : null; } };
    e.classList = { add: (c) => e.cls.add(c), remove: (c) => e.cls.delete(c), contains: (c) => e.cls.has(c), toggle: (c, on) => { const v = on === undefined ? !e.cls.has(c) : !!on; if(v) e.cls.add(c); else e.cls.delete(c); return v; } };
    Object.defineProperty(e, 'innerHTML', { get(){ return e._h || ''; }, set(v){ e._h = v; if(v === '') e.children = []; } });
    return e;
  }
  function mk(){
    const ids = {}; const doc = { getElementById: (id) => (ids[id] = ids[id] || el(id === 'btns' ? 'div' : 'x')), createElement: (t) => el(t) };
    const btns = doc.getElementById('btns');
    ['auto', 'focus', 'pet'].forEach(s => { const b = el('button'); b.dataset.s = s; btns.appendChild(b); });
    const log = [];
    const V = {
      CHAR_Y_MAX: 0.5, seats: [], slots: {}, sizeFactor: 1, selected: null,
      seatModelLoadMod: { handleFiles: (f, s) => log.push('files:' + f + ':' + (s && s.n)), resetSeat: (s) => log.push('reset:' + (s && s.n)) },
      slotSaveMod: { saveSlots: () => log.push('saveSlots') },
      activity: () => log.push('activity'), triggerPet: (s) => log.push('pet:' + s.n), fitModel: (s) => log.push('fit:' + s.n), layoutSeats: () => log.push('layout'),
      clampCharY: (y) => Math.max(0, Math.min(0.5, +y || 0)),
    };
    let api;
    if(typeof MOD === 'string' && MOD){
      const deps = {};
      for(const m of MOD.matchAll(/^const ([\w$]+) = deps\.([\w$]+);(.*)$/gm)){
        if(/^set[A-Z]/.test(m[1]) && /쓰는 함수/.test(m[3])){ const k = m[1].replace(/^set/, ''); const key = Object.keys(V).find(n => n.toLowerCase() === k.toLowerCase()); deps[m[2]] = (v) => { V[key] = v; }; }
        else deps[m[2]] = /읽는 함수/.test(m[3]) ? (() => V[m[1]]) : V[m[1]];
      }
      const win = {}; new Function('window', 'module', 'document', MOD)(win, undefined, doc);
      const m = win.TwSeatPanel.createSeatPanel(deps);
      api = { setInfo: m.setInfo, renderSeatTabs: m.renderSeatTabs, selectSeat: m.selectSeat, setManual: m.setManual, manual: () => m.manual(), sel: () => V.selected, setSel: (v) => { V.selected = v; }, sf: () => V.sizeFactor };
    } else {
      const a = SRC.indexOf('const dot=document.getElementById'), b = SRC.indexOf("document.getElementById('glbInput')");   // 파일 입력 · 슬라이더 연결은 app.js 에 남는다
      const names = Object.keys(V).filter(n => n !== 'selected' && n !== 'sizeFactor');
      api = new Function(...names, 'document', 'let selected = null, sizeFactor = 1;\n' + SRC.slice(a, b) + '\nreturn { setInfo, renderSeatTabs, selectSeat, setManual, manual: () => manual, sel: () => selected, setSel: (v) => { selected = v; }, sf: () => sizeFactor };')(...names.map(n => V[n]), doc);
    }
    return { api, V, ids, log, btns };
  }
  const T = mk(); const D = (id) => T.ids[id];
  const me = { n: 'me', isMe: true, userScale: 1.1, userY: 0.2, userZ: 0, userRot: 3, isPlaceholder: false, charDef: {}, slot: 0 };
  const fr = { n: 'fr', remote: true, friendName: '도토리', remoteState: 'sleep', isPlaceholder: true };
  const ex = { n: 'ex', isPlaceholder: true };
  T.V.seats.push(me, fr, ex);
  T.api.selectSeat(me);
  const tabs = D('seats').children;
  chk(T.api.sel() === me && tabs.length === 3 && tabs[0].textContent === '나' && tabs[0].className === 'seat sel' && tabs[1].textContent === '도토리 💤' && tabs[1].className === 'seat friend' && tabs[2].textContent === '친구2', '좌석 탭 — 나 · 친구 이름 + 상태 이모지 · 이름 없으면 «친구i» · 고른 좌석 sel · 친구 friend');
  chk(D('modelInfo').innerHTML === '모델 로드됨' && D('sliders').cls.has('on') && D('sScale').value === 1.1 && D('sY').value === 0.2 && D('sRot').value === 3, '고르기 — 안내 · 슬라이더 켬 · 값 채움(슬라이더 이벤트는 app.js)');
  tabs[1].onclick();
  chk(T.api.sel() === fr && D('modelInfo').innerHTML.includes('기본 도형 캐릭터') && !D('sliders').cls.has('on'), '  탭 누르기 — 자리 표시 좌석이면 안내 · 슬라이더 끔');
  T.api.setInfo(me, 'X'); chk(D('modelInfo').innerHTML.includes('기본 도형'), 'setInfo — 고른 좌석이 아니면 안 쓴다');
  T.api.setInfo(fr, '<b>Y</b>'); chk(D('modelInfo').innerHTML === '<b>Y</b>', '  고른 좌석이면 쓴다');
  /* 상태 버튼 */
  T.api.setManual('focus');
  chk(T.api.manual() === 'focus' && T.btns.children[1].cls.has('active') && !T.btns.children[0].cls.has('active') && D('autoTag').textContent === '수동' && D('autoTag').cls.has('manual'), '수동 — 그 버튼만 active · «수동»');
  T.log.length = 0; T.btns.fire('click', { target: T.btns.children[0] });
  chk(T.api.manual() === null && T.btns.children[0].cls.has('active') && D('autoTag').textContent === '자동' && T.log.includes('activity'), '  자동 버튼 — 수동 풀고 활동 알림');
  T.log.length = 0; T.btns.fire('click', { target: T.btns.children[2] });
  chk(T.api.manual() === 'pet' && T.log.filter(l => l.startsWith('pet:')).length === 3, '  쓰다듬기 버튼 — 모든 좌석 쓰다듬기');
  T.btns.fire('click', { target: { closest: () => null } }); chk(T.api.manual() === 'pet', '  버튼 밖을 누르면 그대로');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

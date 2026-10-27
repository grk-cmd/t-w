/* ═══ ⚙ sim-settings-panel.js — ⚙ 설정 창 하나(런처 · 실행 화면 공용 · 탭 다섯) · 캐릭터 탭(캐릭터 교체 · 자리 추가) 모듈 구조와 여닫기 동작 ═══════════════
   app.js 의 ⚙ 설정 패널 구역 본문 을 parts/launcher/settings-panel.js 로 옮겼다(글자 그대로 · 바뀐 줄 62 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(설정 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(EXTRA_SEAT_KEY · MY_AD_BANNER_KEY · _saveExtraSeatSlots · addExtraSeat · applyExtraSeatForMode · extraSeatSlots · setExtraSeatSlots · loadAdBannerSlides · refreshFsAdBanner · renderCharSlots)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 60줄 그대로 · 부르는 곳은 settingsMod.이름 · html(app.js 앞)
   ・3절: 여닫기 · 탭 · ⓘ · 이름표 크기 — 작은 가짜 DOM 위에서 실제로 불러 본다(런처면 가운데 · 마지막 탭 기억 · 연 클릭이 바로 닫지 않음)
   ・4절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · settings-panel.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["settings-panel.js","parts/launcher/settings-panel.js","app/parts/launcher/settings-panel.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — settings-panel.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_chatEsc","allDeskItems","applyCharToSeat","applyChipOrientation","applyClothVisibility","backToLauncher","bringWinToFront","createSeat","drawFaceThumb","equipDeskItem","escRegisterWindow","findMySeat","layoutSeats","refreshCharScaleForCurrentDisplay","refreshInviteUI","isLauncherShown","removeSeatLabels","saveCharScale","saveCurSlot","saveGap","saveSlots","toast","updateCameraOnly"];
const VAL_DEPS = ["GAP_MAX","GAP_MIN","GAP_STEPS","plMod","scene","seats"];
const GET_DEPS = ["MULTIPLAYER_SPACING","Presence","SPACING","_moveModeJustToggled","chipHorizontal","curSlot","decoPartsVisible","dotRenderEnabled","emojiReactionsEnabled","focusCharScale","isPremium","moveMode","nameplateEnabled","roomSeatMode","seatEqualizeOn","slots","wardrobeMod"];
const SET_DEPS = ["MULTIPLAYER_SPACING","SPACING","_moveModeJustToggled","chipHorizontal","curSlot","decoPartsVisible","dotRenderEnabled","emojiReactionsEnabled","focusCharScale","moveMode","nameplateEnabled","roomSeatMode","seatEqualizeOn"];
const EXPORTS = ["openSettings","closeSettings","onTabShown","nameplateClamp","nameplatePct","EXTRA_SEAT_KEY","MY_AD_BANNER_KEY","_saveExtraSeatSlots","addExtraSeat","applyExtraSeatForMode","extraSeatSlots","setExtraSeatSlots","loadAdBannerSlides","refreshFsAdBanner","renderCharSlots"];
const MOVED = ["MY_AD_BANNER_KEY","loadAdBannerSlides","_fsAdSlides","_fsAdIdx","_fsAdTimer","refreshFsAdBanner","EXTRA_SEAT_KEY","extraSeatSlots","_saveExtraSeatSlots","clearSeatDeskItems","switchMainCharacter","removeExtraSeat","addExtraSeat","toggleExtraSeat","applyExtraSeatForMode","makeCharThumbEl","renderCharSlots","_fsBindSlotNav","_fsSyncSlotNav","_fsRevealSlot"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  GAP_MAX: GAP_MAX,","  GAP_MIN: GAP_MIN,","  GAP_STEPS: GAP_STEPS,","  MULTIPLAYER_SPACING: ()=>MULTIPLAYER_SPACING,","  Presence: ()=>Presence,","  SPACING: ()=>SPACING,","  _chatEsc: (...a)=>_chatEsc(...a),","  _moveModeJustToggled: ()=>_moveModeJustToggled,","  allDeskItems: (...a)=>allDeskItems(...a),","  applyCharToSeat: (...a)=>applyCharToSeat(...a),","  applyChipOrientation: (...a)=>applyChipOrientation(...a),","  applyClothVisibility: (...a)=>applyClothVisibility(...a),","  backToLauncher: (...a)=>backToLauncher(...a),","  bringWinToFront: (...a)=>bringWinToFront(...a),","  chipHorizontal: ()=>chipHorizontal,","  createSeat: (...a)=>createSeat(...a),","  curSlot: ()=>curSlot,","  decoPartsVisible: ()=>decoPartsVisible,","  dotRenderEnabled: ()=>dotRenderEnabled,","  drawFaceThumb: (...a)=>drawFaceThumb(...a),","  emojiReactionsEnabled: ()=>emojiReactionsEnabled,","  equipDeskItem: (...a)=>equipDeskItem(...a),","  escRegisterWindow: (...a)=>escRegisterWindow(...a),","  findMySeat: (...a)=>findMySeat(...a),","  focusCharScale: ()=>focusCharScale,","  isPremium: ()=>isPremium,","  isLauncherShown: (...a)=>isLauncherShown(...a),","  layoutSeats: (...a)=>layoutSeats(...a),","  moveMode: ()=>moveMode,","  nameplateEnabled: ()=>nameplateEnabled,","  plMod: plMod,","  refreshCharScaleForCurrentDisplay: (...a)=>refreshCharScaleForCurrentDisplay(...a),","  refreshInviteUI: (...a)=>refreshInviteUI(...a),","  removeSeatLabels: (...a)=>removeSeatLabels(...a),","  roomSeatMode: ()=>roomSeatMode,","  saveCharScale: (...a)=>saveCharScale(...a),","  saveCurSlot: (...a)=>saveCurSlot(...a),","  saveGap: (...a)=>saveGap(...a),","  saveSlots: (...a)=>saveSlots(...a),","  scene: scene,","  seatEqualizeOn: ()=>seatEqualizeOn,","  seats: seats,","  slots: ()=>slots,","  toast: (...a)=>toast(...a),","  updateCameraOnly: (...a)=>updateCameraOnly(...a),","  wardrobeMod: ()=>wardrobeMod,","  setMULTIPLAYER_SPACING: (v)=>{ MULTIPLAYER_SPACING = v; },","  setSPACING: (v)=>{ SPACING = v; },","  setMoveModeJustToggled: (v)=>{ _moveModeJustToggled = v; },","  setChipHorizontal: (v)=>{ chipHorizontal = v; },","  setCurSlot: (v)=>{ curSlot = v; },","  setDecoPartsVisible: (v)=>{ decoPartsVisible = v; },","  setDotRenderEnabled: (v)=>{ dotRenderEnabled = v; },","  setEmojiReactionsEnabled: (v)=>{ emojiReactionsEnabled = v; },","  setFocusCharScale: (v)=>{ focusCharScale = v; },","  setMoveMode: (v)=>{ moveMode = v; },","  setNameplateEnabled: (v)=>{ nameplateEnabled = v; },","  setRoomSeatMode: (v)=>{ roomSeatMode = v; },","  setSeatEqualizeOn: (v)=>{ seatEqualizeOn = v; },"];

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
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'TwMyHomeHooks',   // 🪝 마이홈 고리판(myhome-hooks.js) — 받는 줄이 던지지 않게 가짜로
    src + '\nreturn window.TwSettingsPanel;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, any);
  return api.createSettingsPanel(deps);
}

/* 작은 가짜 DOM — id 로 부르면 그 자리에서 요소를 만든다. classList · 속성 · 듣기만 진짜처럼 */
function fakeDom(){
  const els = {}, docOn = [];
  const mk = (id) => {
    const cls = new Set(), attrs = {}, on = {};
    return els[id] = { id, cls, hidden:false, textContent:'', value:'', innerHTML:'', dataset:{}, style:{ setProperty(){} },
      classList:{ add:(c)=>cls.add(c), remove:(c)=>cls.delete(c), contains:(c)=>cls.has(c),
        toggle:(c, f)=>{ const v = f === undefined ? !cls.has(c) : !!f; v ? cls.add(c) : cls.delete(c); return v; } },
      setAttribute:(k, v)=>{ attrs[k] = String(v); }, getAttribute:(k)=>(k in attrs ? attrs[k] : null),
      addEventListener:(type, fn)=>{ (on[type] = on[type] || []).push(fn); }, on,
      querySelector:()=>null, querySelectorAll:()=>[], appendChild(){}, closest:()=>null };
  };
  const document = { getElementById:(id)=>els[id] || mk(id), querySelector:()=>null, querySelectorAll:()=>[],
    createElement:()=>mk('_' + Object.keys(els).length), addEventListener:(type, fn, cap)=>docOn.push({ type, fn, cap:!!cap }) };
  return { els, document, docOn };
}
/* 여닫기 · 탭 · ⓘ · 이름표 크기를 실제로 불러 본다 */
function behave(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const any = anything();
  const { els, document, docOn } = fakeDom();
  let launcher = true; const shown = [];
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  deps.isLauncherShown = () => launcher;
  deps.focusCharScale = () => 1;
  const win = { companion: undefined, _fsPanelDragged: false, TwSeatPin: undefined };
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  let api;
  try{
    api = new Function('window', 'document', 'localStorage', 'companion', 'setTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'TwMyHomeHooks', 'TwSafeHtml', 'innerWidth', 'innerHeight', 'module',
      src + '\nreturn window.TwSettingsPanel;')(win, document, ls, undefined, () => 0, () => 0, () => {}, () => 0, any, { safeUrl: () => '', text: (x) => String(x) }, 1000, 800, undefined)
      .createSettingsPanel(deps);
  }catch(e){ t(false, '가짜 DOM 위에서 만들기 — ' + String(e.message || e).slice(0, 80)); return r; }
  api.onTabShown((k) => shown.push(k));
  const panel = els.focusSettingsPanel;
  const pageOn = (id) => !!els[id] && els[id].style.display === 'block';
  const click = (target) => {   // 문서 클릭 한 번 — 캡처 먼저, 그다음 누른 버튼, 그다음 버블
    const ev = { target, composedPath: () => target.path };
    docOn.filter(h => h.type === 'click' && h.cap).forEach(h => h.fn(ev));
    if(target.onClick) target.onClick();
    docOn.filter(h => h.type === 'click' && !h.cap).forEach(h => h.fn(ev));
  };
  try{
    api.openSettings();
    t(panel.classList.contains('on') && panel.classList.contains('fs-in-launcher'), '런처에서 열면 가운데(.fs-in-launcher)로 뜬다');
    t(pageOn('fsTabDisplay') && !pageOn('fsTabInfo') && els.fsTabBtnDisplay.classList.contains('on'), '처음 탭은 디스플레이');
    t(shown[shown.length - 1] === 'display', '탭을 보이면 걸어 둔 것(onTabShown — 프로그램 칸 다시 그리기)을 부른다');
    api.openSettings('info');
    t(pageOn('fsTabInfo') && !pageOn('fsTabDisplay'), '탭을 정해 열면 그 탭(정보)');
    api.closeSettings();
    t(!panel.classList.contains('on'), '닫기');
    launcher = false; api.openSettings();
    t(panel.classList.contains('on') && !panel.classList.contains('fs-in-launcher'), '실행 화면에서 열면 가운데 표시가 풀린다(머리 위)');
    t(pageOn('fsTabInfo'), '탭을 안 정하면 마지막에 본 탭(정보)');
    els.fsTabBtnSize.onclick();
    t(pageOn('fsTabSize') && shown[shown.length - 1] === 'char', '탭 버튼 — 캐릭터');
    api.openSettings('없는탭');
    t(pageOn('fsTabDisplay'), '모르는 탭 이름이면 디스플레이');
    api.closeSettings();
    click({ path: [], onClick: () => api.openSettings() });   // 다른 곳 버튼(런처 ⚙️ 설정)이 연 그 클릭
    t(panel.classList.contains('on'), '★ 창을 연 그 클릭은 «바깥 클릭» 으로 닫지 않는다');
    click({ path: [panel] });
    t(panel.classList.contains('on'), '창 안 클릭은 안 닫는다');
    const invite = { id: 'inviteOverlay', matches: (sel) => sel.split(',').map(x => x.trim()).includes('#inviteOverlay') };
    click({ path: [invite] });
    t(panel.classList.contains('on'), '방 연결 탭에서 연 방 목록 창(#inviteOverlay) 안 클릭은 설정을 안 닫는다');
    click({ path: [] });
    t(!panel.classList.contains('on'), '다음 바깥 클릭은 닫는다');
    const desc = document.getElementById('fsDescX'); desc.hidden = true;
    const info = document.getElementById('fsInfoX'); info.setAttribute('aria-controls', 'fsDescX');
    const ev = { target: { closest: (sel) => (sel === '.fs-info' ? info : null) } };
    (panel.on.click || []).forEach(fn => fn(ev));
    t(desc.hidden === false && info.getAttribute('aria-expanded') === 'true', 'ⓘ 누르면 설명이 열린다');
    (panel.on.click || []).forEach(fn => fn(ev));
    t(desc.hidden === true && info.getAttribute('aria-expanded') === 'false', 'ⓘ 다시 누르면 닫힌다');
    els.fsNameplateSizeIn.onclick();
    t(store['tw.nameplateSize'] === '16' && els.fsNameplateSizePct.textContent === '107%', '이름표 [+] — 1px 커지고 % 로 보인다(16px · 107%)');
    for(let i = 0; i < 30; i++) els.fsNameplateSizeIn.onclick();
    t(store['tw.nameplateSize'] === '26', '이름표 크기 위 끝 26px 에서 멈춘다');
    for(let i = 0; i < 30; i++) els.fsNameplateSizeOut.onclick();
    t(store['tw.nameplateSize'] === '10' && els.fsNameplateSizePct.textContent === '67%', '이름표 크기 아래 끝 10px(67%) 에서 멈춘다');
    els.fsNameplateSizeReset.onclick();
    t(store['tw.nameplateSize'] === '15' && els.fsNameplateSizePct.textContent === '100%', '↺ — 기본 15px = 100%');
    t(api.nameplatePct(15) === 100 && api.nameplatePct(26) === 173 && api.nameplateClamp(9) === 10 && api.nameplateClamp('x') === 15, '이름표 규칙 — 경계 · 이상한 값');
  }catch(e){ t(false, '동작 판정 중 던짐 — ' + String(e.message || e).slice(0, 80)); }
  return r;
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwSettingsPanel = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwSettingsPanel(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("SETTINGS_MOD_OFF") && app.includes("const settingsMod = TwSettingsPanel.createSettingsPanel({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const settingsMod = TwSettingsPanel\\.createSettingsPanel\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = mk.split('\n').map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const settingsMod = [\s\S]*?\n\}\);/, '')));
  t(!bare.length, '부르는 곳은 settingsMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/launcher/settings-panel.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/launcher/settings-panel.js 를 app.js 보다 먼저 싣는다');
  for(const row of behave(mod)) r.push(row);
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); if(i === 8) say('── 3. 여닫기 · 탭 · ⓘ · 이름표 크기'); chk(ok, msg); });
say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/launcher/settings-panel.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const settingsMod = TwSettingsPanel.createSettingsPanel({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwSettingsPanel = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const settingsMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('settingsMod.' + x)); if(n){ ls[i] = ls[i].replace('settingsMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createSettingsPanel(deps){', 'function createSettingsPanel(deps){ throw new Error("깨 봄");'), null, null],
  ['연 클릭이 바로 닫음', m => m.replace('if(!_openBeforeClick || !panel.classList', 'if(!panel.classList'), null, null],
  ['런처 표시 안 함', m => m.replace("panel.classList.toggle('fs-in-launcher', inLauncher);", ''), null, null],
  ['마지막 탭 잊음', m => m.replace('showTab(tab || _curTab);', "showTab(tab || 'display');"), null, null],
  ['이름표 끝 안 막음', m => m.replace('Math.max(NAMEPLATE_SIZE.min, Math.min(NAMEPLATE_SIZE.max, ', '(('), null, null],
  ['방 목록 창 예외 빠짐', m => m.replace(/\n[^\n]*'#inviteOverlay',[^\n]*/, ''), null, null],
  ['ⓘ 안 열림', m => m.replace('desc.hidden = !desc.hidden;', ''), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

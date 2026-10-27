/* ═══ 🏷️ sim-program-settings.js — 🏷️ 닉네임 저장(제자리 편집이 부르는 한 벌) · ⚙️ 프로그램 설정 창(열기 · 닫기 · 회사원 · 피규어 모드) 모듈 구조 (2026-10-14 신설 · 앱 FSD 40번) ═══════════════
   app.js 의 닉네임 저장 · 프로그램 설정 창 구역 본문 을 parts/launcher/program-settings.js 로 옮겼다(글자 그대로 · 바뀐 줄 14 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(닉네임 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(USER_NAME_MAX · closeProgramSettings · commitUserName · openProgramSettings)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 26줄 그대로 · 부르는 곳은 progSettingsMod.이름 · html(app.js 앞)
     2-2: 창은 settings-panel.js 하나 — 옛 탭 이름(license · system)으로 여는 부탁이 새 탭(정보 · 디스플레이)으로 · 런처 ⚙️ 설정은 마지막 탭 · 탭을 보일 때 이 모듈 칸을 다시 그린다(refreshTab)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   ・4절: 버전 표시 — 만들 때 data-app-version 칸(설정 › 프로그램 정보 · 첫 화면 맨 아래)을 모두 «v버전» 으로 · 못 받으면 «-» ·
     첫 화면 맨 아래 개인정보 처리방침 링크 — 주소가 다른 두 링크와 같고 room-entry.js 가 시스템 브라우저로 연다(깨 보기 포함)
   [실행] app.js · desk-companion-prototype.html · program-settings.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["program-settings.js","parts/launcher/program-settings.js","app/parts/launcher/program-settings.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — program-settings.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_applyChatSfxUI","_focusShowPush","_lsSet","refreshLicenseUI","refreshOfficeChipUI","refreshThemeUI","toast","applyRunPixelRatio","openSettings","closeSettings","onTabShown"];
const VAL_DEPS = ["chatUiMod","purikuraUi","tricksMod","twNav","renderAntialias"];
const GET_DEPS = ["FIGURE_MODE_KEY","OFFICE_MODE_KEY","figureMode","focusGateSleep","officeMode","renderQuality"];
const SET_DEPS = ["figureMode","focusGateSleep","officeMode","renderQuality"];
const EXPORTS = ["closeProgramSettings","openProgramSettings","refreshTab"];
const MOVED = ["USER_NAME_MAX","commitUserName","renderProgMonitors","setProgSettingsTab","refreshAutoLaunchUI","refreshFigureModeUI","refreshOfficeModeUI","_labVideoShow","LAB_VIDEO_BLOCKED_GUIDE","_labVideoWarn","refreshLabVideoUI","refreshAppVersionUI","openProgramSettings","closeProgramSettings"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  FIGURE_MODE_KEY: ()=>FIGURE_MODE_KEY,","  OFFICE_MODE_KEY: ()=>OFFICE_MODE_KEY,","  _applyChatSfxUI: (...a)=>chatPrefsMod._applyChatSfxUI(...a),","  _focusShowPush: (...a)=>focusShareMod._focusShowPush(...a),","  _lsSet: (...a)=>_lsSet(...a),","  chatUiMod: chatUiMod,","  figureMode: ()=>figureMode,","  focusGateSleep: ()=>focusGateSleep,","  officeMode: ()=>officeMode,","  purikuraUi: purikuraUi,","  refreshLicenseUI: (...a)=>licenseUiMod.refreshLicenseUI(...a),","  refreshOfficeChipUI: (...a)=>refreshOfficeChipUI(...a),","  refreshThemeUI: (...a)=>themeUiMod.refreshThemeUI(...a),","  toast: (...a)=>toast(...a),","  tricksMod: tricksMod,","  setFigureMode: (v)=>{ figureMode = v; },","  setFocusGateSleep: (v)=>{ focusGateSleep = v; },","  setOfficeMode: (v)=>{ officeMode = v; },","  twNav: twNav,","  renderQuality: ()=>_renderQuality,","  setRenderQuality: (v)=>{ _renderQuality = v; },","  renderAntialias: _renderAA,","  applyRunPixelRatio: (...a)=>seatCameraMod.updateCameraOnly(...a),","  openSettings: (...a)=>settingsMod.openSettings(...a),","  closeSettings: (...a)=>settingsMod.closeSettings(...a),","  onTabShown: (...a)=>settingsMod.onTabShown(...a),"];

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
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    src + '\nreturn window.TwProgramSettings;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  return api.createProgramSettings(deps);
}

/* 창은 settings-panel.js 하나 — 옛 탭 이름으로 여는 부탁이 새 탭으로 가는가 · 탭을 보일 때 이 모듈 칸을 다시 그리는가 */
function behave(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const any = anything();
  const calls = [];
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  deps.openSettings = (tab) => calls.push(['open', tab]);
  deps.closeSettings = () => calls.push(['close']);
  let tabShown = null;
  deps.onTabShown = (fn) => { tabShown = fn; };
  deps.refreshLicenseUI = () => calls.push(['license']);
  deps.refreshThemeUI = () => calls.push(['theme']);
  const els = {};
  const doc = new Proxy({}, { get: (tg, k) => k === 'getElementById' ? (id) => (els[id] = els[id] || { id, style:{}, classList:{ toggle(){}, contains:()=>false }, textContent:'' })
    : k === 'querySelectorAll' ? () => [] : any });
  let api;
  try{
    api = new Function('window', 'document', 'localStorage', 'companion', 'setTimeout', 'FrameBudget', 'module',
      src + '\nreturn window.TwProgramSettings;')({}, doc, any, undefined, () => 0, any, undefined).createProgramSettings(deps);
  }catch(e){ t(false, '가짜 DOM 위에서 만들기 — ' + String(e.message || e).slice(0, 80)); return r; }
  const last = () => calls[calls.length - 1] || [];
  api.openProgramSettings('license');
  t(last()[0] === 'open' && last()[1] === 'info', "옛 'license' 로 열면 정보 탭(꾸미기 라이선스 안내)");
  api.openProgramSettings('system');
  t(last()[1] === 'display', "옛 'system' 은 디스플레이 탭");
  api.openProgramSettings('char');
  t(last()[1] === 'char', '새 탭 이름은 그대로 넘긴다');
  els.lcProgSettingsBtn.onclick();
  t(last()[0] === 'open' && last()[1] === undefined, '런처 ⚙️ 설정 — 탭을 정하지 않고 연다(마지막에 본 탭)');
  api.closeProgramSettings();
  t(last()[0] === 'close', '닫기는 설정 창 닫기');
  t(tabShown === api.refreshTab, '만들 때 탭 다시 그리기(refreshTab)를 설정 창에 건다(onTabShown — 한 방향)');
  calls.length = 0; tabShown('info');
  t(calls.some(c => c[0] === 'license') && !calls.some(c => c[0] === 'theme'), '정보 탭을 보이면 라이선스 칸을 다시 그린다(테마 칸은 안)');
  calls.length = 0; tabShown('display');
  t(calls.some(c => c[0] === 'theme') && !calls.some(c => c[0] === 'license'), '디스플레이 탭이면 테마 칸');
  return r;
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwProgramSettings = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwProgramSettings(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("PROG_SETTINGS_MOD_OFF") && app.includes("const progSettingsMod = TwProgramSettings.createProgramSettings({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const progSettingsMod = TwProgramSettings\\.createProgramSettings\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = mk.split('\n').map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const progSettingsMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 progSettingsMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/launcher/program-settings.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/launcher/program-settings.js 를 app.js 보다 먼저 싣는다');
  for(const row of behave(mod)) r.push(row);
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); if(i === 8) say('── 2-2. 한 창으로 — 옛 탭 이름 · 탭 다시 그리기'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/launcher/program-settings.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const progSettingsMod = TwProgramSettings.createProgramSettings({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwProgramSettings = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const progSettingsMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('progSettingsMod.' + x)); if(n){ ls[i] = ls[i].replace('progSettingsMod.' + n, n); return ls.join('\n'); } } return a + "\nopenProgramSettings('license');\n"; }, null],   /* app.js 에 부르는 곳이 없으면(창 열기는 통로 nav.js — 모듈 순환 끊기 6 · 7) 옛 이름 부름 한 줄을 넣어 본다 */
  ['만들 때 던짐', m => m.replace('function createProgramSettings(deps){', 'function createProgramSettings(deps){ throw new Error("깨 봄");'), null, null],
  ['옛 탭 이름 안 이음', m => m.replace("license:'info', ", ''), null, null],
  ['탭 다시 그리기 안 걺', m => m.replace('onTabShown(refreshTab);', ''), null, null],
  ['라이선스 칸 안 그림', m => m.replace("if(key==='info'){ refreshLicenseUI(); ", "if(key==='info'){ "), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
/* 4절 — 버전 칸 채우기(실제로 만들어 본다) */
say('── 4. 버전 표시 · 첫 화면 링크');
function buildWith(src, comp){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const els = [{ textContent: '확인 중…' }, { textContent: '…' }];
  const doc = new Proxy({}, { get: (t, k) => k === 'querySelectorAll' ? (sel) => (sel === '[data-app-version]' ? els : []) : any });
  const win = { companion: comp };
  new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    src + '\nreturn window.TwProgramSettings;')(win, doc, any, any, any, comp, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined).createProgramSettings(deps);
  return els;
}
const tick = () => new Promise(r => setImmediate(r));
async function versionCases(src){
  const ok = buildWith(src, { getAppVersion: () => Promise.resolve('0.12.0') });
  const none = buildWith(src, undefined);
  const bad = buildWith(src, { getAppVersion: () => Promise.reject(new Error('ipc')) });
  const empty = buildWith(src, { getAppVersion: () => Promise.resolve('') });
  await tick(); await tick();
  return { ok: ok.map(e => e.textContent), none: none.map(e => e.textContent), bad: bad.map(e => e.textContent), empty: empty.map(e => e.textContent) };
}
const ROOM_ENTRY = ["room-entry.js","parts/room/room-entry.js","app/parts/room/room-entry.js"].map(read).find(Boolean);
function linkJudge(html, roomEntry){
  const r = [];
  const hrefOf = (id) => (html.match(new RegExp('<a id="' + id + '" href="([^"]+)"')) || [])[1];
  const gate = hrefOf('gatePrivacyLink'), prog = hrefOf('progPrivacyLink'), mi = hrefOf('miPrivacyLink');
  r.push([!!gate && gate === prog && gate === mi && /^https:\/\/help\.together-working\.com\//.test(gate), '첫 화면 링크 주소 = 설정 · 내 정보 링크 주소(우리 도메인)']);
  const ov = html.indexOf('<div id="inviteGateOverlay"'), foot = html.indexOf('id="inviteGateFoot"'), next = html.indexOf('<div id="signupDoneOverlay"');
  const footBlk = foot > 0 ? html.slice(foot, html.indexOf('</div>', foot)) : '';
  r.push([ov > 0 && foot > ov && (next < 0 || foot < next) && /data-app-version/.test(footBlk) && /id="gatePrivacyLink"/.test(footBlk), '첫 화면(초대 게이트 오버레이) 맨 아래 줄에 버전 칸 · 링크']);
  r.push([!!roomEntry && /_bindDonate\(document\.getElementById\('gatePrivacyLink'\)\)/.test(strip(roomEntry)), 'room-entry.js 가 첫 화면 링크를 시스템 브라우저로 연다(_bindDonate)']);
  return r;
}
(async () => {
  const v = await versionCases(MOD);
  chk(v.ok.every(t => t === 'v0.12.0'), '버전 칸 둘 다 «v0.12.0» — 만들 때 한 번 채운다 (' + v.ok.join(' · ') + ')');
  chk(v.none.every(t => t === '-') && v.bad.every(t => t === '-') && v.empty.every(t => t === '-'), 'companion 없음 · 실패 · 빈 값이면 «-»');
  const v2 = await versionCases(MOD.replace(/\nrefreshAppVersionUI\(\);\nreturn \{/, '\nreturn {'));
  chk(!v2.ok.every(t => t === 'v0.12.0'), '깨 보기 — 만들 때 안 부르면 빨강(첫 화면은 설정 창을 못 연다)');
  linkJudge(HTML, ROOM_ENTRY).forEach(([ok, msg]) => chk(ok, msg));
  const lb = [
    ['첫 화면 링크 주소가 다름', HTML.replace('<a id="gatePrivacyLink" href="https://help.together-working.com/privacy"', '<a id="gatePrivacyLink" href="https://example.com/privacy"'), ROOM_ENTRY],
    ['첫 화면 줄 빠짐', HTML.replace('id="inviteGateFoot"', 'id="x"'), ROOM_ENTRY],
    ['링크 안 엶', HTML, (ROOM_ENTRY || '').replace("_bindDonate(document.getElementById('gatePrivacyLink'));", '')],
  ];
  for(const [name, h, re] of lb){ const changed = h !== HTML || re !== ROOM_ENTRY; chk(changed && linkJudge(h, re).some(([ok]) => !ok), '깨 보기 — ' + name + (changed ? '' : ' — 바꿀 글을 못 찾음')); }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

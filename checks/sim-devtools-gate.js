/* ═══ 🔒 sim-devtools-gate.js — 설치본 개발자 도구(F12) 막기 · 관리자 모드만 허용(devtools-gate.js · 2026-10-17 신설) ═══════════════
   [왜] 열려 있으면 누구나 콘솔 한 줄(isPremium = true 등)로 앱 안 판정을 바꾼다. 설치본에서는 닫고 관리자 모드 창에서만 연다.
   ・1절: 여는 조건 — 개발 실행 · dev 빌드는 늘 · 설치본 운영은 관리자 모드일 때만 · 끄면 다시 막힘
   ・2절: 가짜 창 위에서 — F12 토글은 허용일 때만 · 다른 키는 무시 · 다른 길로 열리면 바로 닫음 · 관리자 끄면 열린 것 닫음 · 닫힌 창은 잊음
   ・3절: 배선 — main.js(게이트 · 관리자 모드 IPC 는 메인 창이 보낸 것만 · 메인 창 · 팝업 · 보조 창 둘) · preload(setAdminMode) · admin-mode.js(켜고 끌 때 알림) · 설치 목록
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const DIRS = ['.', '..', 'app', path.join('app', 'parts'), path.join('app', 'parts', 'admin'), path.join('..', 'app', 'parts', 'admin'), 'parts', path.join('parts', 'admin')];
const find = (f) => { for(const d of DIRS){ const p = path.join(d, f); if(fs.existsSync(p)) return p; } return null; };
const read = (f) => { const p = find(f); return p ? fs.readFileSync(p, 'utf8') : null; };
const GATE = find('devtools-gate.js'), MAIN = read('main.js'), PRE = read('preload.js'), ADM = read('admin-mode.js'), PKG = read('package.json');
for(const [n, v] of [['devtools-gate.js', GATE], ['main.js', MAIN], ['preload.js', PRE], ['admin-mode.js', ADM], ['package.json', PKG]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const { createDevtoolsGate } = require(path.resolve(GATE));

/* 가짜 webContents — 이벤트 처리기를 담고 · 개발자 도구 열림 상태를 흉내 낸다 */
function mkWc(){
  const h = {};
  const wc = { open: false, destroyed: false, toggles: 0, closes: 0,
    on(ev, fn){ (h[ev] = h[ev] || []).push(fn); },
    emit(ev, ...a){ (h[ev] || []).forEach((f) => f(...a)); },
    isDestroyed(){ return this.destroyed; }, isDevToolsOpened(){ return this.open; },
    toggleDevTools(){ this.toggles++; this.open = !this.open; if(this.open) this.emit('devtools-opened'); },
    closeDevTools(){ this.closes++; this.open = false; },
    openFromMenu(){ this.open = true; this.emit('devtools-opened'); } };
  return wc;
}
const F12 = { type: 'keyDown', key: 'F12' };

say('── 1. 여는 조건');
{
  const dev = createDevtoolsGate({ packaged: false, env: 'prod' }), beta = createDevtoolsGate({ packaged: true, env: 'dev' }), prod = createDevtoolsGate({ packaged: true, env: 'prod' });
  chk(dev.always && dev.allowed() && beta.always && beta.allowed(), '개발 실행(npm start) · dev 빌드는 늘 연다');
  chk(!prod.always && !prod.allowed(), '★ 설치본 운영은 기본으로 막힌다');
  prod.setAdmin(true);
  chk(prod.allowed() && !prod.always, '  ↳ 관리자 모드면 연다(보조 창용 always 는 그대로 false)');
  prod.setAdmin(false);
  chk(!prod.allowed(), '  ↳ 관리자 모드를 끄면 다시 막힌다');
  chk(!createDevtoolsGate().allowed() === false, '  ↳ 옵션이 없으면 개발 실행으로 본다(설치본 판정은 main.js 가 app.isPackaged 로 넘김)');
}

say('── 2. 가짜 창 위에서');
{
  const g = createDevtoolsGate({ packaged: true, env: 'prod' }), wc = mkWc();
  g.attach(wc);
  wc.emit('before-input-event', {}, F12);
  chk(wc.toggles === 0 && !wc.open, '★ 설치본 · 관리자 아님 — F12 를 눌러도 안 열린다');
  wc.openFromMenu();
  chk(!wc.open && wc.closes === 1, '★ 다른 길(메뉴 · 원격 디버깅)로 열려도 바로 닫는다');
  g.setAdmin(true);
  wc.emit('before-input-event', {}, F12);
  chk(wc.open && wc.toggles === 1, '관리자 모드 — F12 로 열린다');
  wc.emit('before-input-event', {}, { type: 'keyUp', key: 'F12' }); wc.emit('before-input-event', {}, { type: 'keyDown', key: 'F11' });
  chk(wc.open && wc.toggles === 1, '  ↳ F12 를 뗄 때 · 다른 키는 무시');
  g.setAdmin(false);
  chk(!wc.open && wc.closes === 2, '★ 관리자 모드를 끄면 열려 있던 개발자 도구를 닫는다');
  const wc2 = mkWc(); g.attach(wc2); wc2.emit('destroyed'); wc2.destroyed = true;
  g.setAdmin(true); g.setAdmin(false);
  chk(wc2.closes === 0, '  ↳ 닫힌 창은 잊는다(닫힌 창을 건드려 던지지 않는다)');
  const d = createDevtoolsGate({ packaged: false }), wc3 = mkWc(); d.attach(wc3);
  wc3.emit('before-input-event', {}, F12);
  chk(wc3.open, '개발 실행 — 관리자 아니어도 F12 로 열린다(지금과 같음)');
}

say('── 3. 배선');
{
  const m = MAIN.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/[^\n]*$/gm, ' ');   // 블록 주석 · 줄 주석(꺼 둔 openDevTools 줄) 빼고
  chk(/const devtoolsGate = createDevtoolsGate\(\{ packaged: app\.isPackaged, env: FIREBASE_ENV \}\);/.test(m), 'main.js — 설치본 여부 · 빌드 환경으로 게이트를 만든다');
  chk(/ipcMain\.on\('companion:setAdminMode', \(e, on\) => \{\s*if\(mainWindow && !mainWindow\.isDestroyed\(\) && e\.sender === mainWindow\.webContents\) devtoolsGate\.setAdmin\(!!on\);/.test(m), '  ↳ 관리자 모드 알림은 메인 창이 보낸 것만 받는다(팝업 · 다른 페이지가 켜지 못하게)');
  chk(/devtoolsGate\.attach\(mainWindow\.webContents\);/.test(m) && /'did-create-window', \(child\) => \{ devtoolsGate\.attach\(child\.webContents\); \}/.test(m), '  ↳ 메인 창 · 팝업(window.open) 창에 건다');
  chk((m.match(/devTools: devtoolsGate\.always,/g) || []).length === 2, '  ↳ 보조 창 둘(구글 로그인 · 음악)은 webPreferences.devTools = always(관리자 예외 없음)');
  chk(!/toggleDevTools\(\)/.test(m) && !/\.openDevTools\(/.test(m), '  ↳ main.js 가 게이트를 거치지 않고 개발자 도구를 여는 곳이 없다');
  chk(/setAdminMode\(on\) \{\s*ipcRenderer\.send\('companion:setAdminMode', !!on\);/.test(PRE), 'preload — companion.setAdminMode');
  chk((ADM.match(/companion\.setAdminMode\((true|false)\)/g) || []).length >= 2, 'admin-mode.js — 관리자 모드 켤 때 · 끌 때 알린다');
  let files = []; try{ files = JSON.parse(PKG).build.files; }catch(_){}
  chk(files.includes('devtools-gate.js'), '설치 파일 목록(package.json build.files)에 devtools-gate.js — 빠지면 설치본이 켜지지 않는다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

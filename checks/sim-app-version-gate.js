/*
 * 앱 최소 버전(config/minAppVer) — 이 앱이 낮으면 «업데이트해 주세요» 로 앱 전체를 막는가.
 * 1. app-version-gate.js 비교 — 숫자 비교(0.10.0 > 0.9.8) · 꼬리 무시 · 모르는 값으로는 안 막음
 * 2. 게이트를 그대로 돌린다 — 낮으면 막음 · 같거나 높으면 · 값 없음 · 읽기 실패 · 시간 초과 · 버전 모름은 안 막음
 * 3. 단추 — 받기 끝(재시작 설치) · 맥(릴리스 열기) · 받는 중(누를 수 없음) · 실패(다시 시도) · 링크(다운로드 페이지) · 막기 전에 온 상태 기억
 * 4. 화면 — 닫기 없음 · textContent 만 · id 가 app.js 클릭 통과 목록에 있음
 * 5. 연결 — firebase-init 가 config/minAppVer 를 한 번 읽어 게이트를 켠다 · main/preload 다시 확인 채널 · 다운로드 주소 = package.json 저장소
 * 6. 규칙 — config/minAppVer 관리자만 쓰기 · 누구나 읽기 · 문자열 20자
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (...names) => { for(const n of names){ const s = read(n); if(s != null) return s; } say('  ? 원본 못 찾음 — ' + names[0]); process.exit(2); };
const GATE = need('app-version-gate.js', 'parts/app-version-gate.js', 'app/parts/app-version-gate.js');
const FI = need('firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js');
const APP = need('app.js', 'parts/app.js', 'app/parts/app.js');
const MAIN = need('main.js');
const PRE = need('preload.js');
const PKG = JSON.parse(need('package.json'));
const RULES = JSON.parse(need('firebase-database-rules.json')).rules;
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const M = new Function(GATE.replace(/^export (function|const) /mg, '$1 ') +
  '\nreturn { parseVer, isBelow, viewOf, createAppVersionGate, createAppVersionGateDom, MIN_APP_VER_PATH, MIN_APP_VER_MAX, RELEASES_URL, GATE_ID };')();

// 가짜 companion — onUpdateStatus 로 상태를 밀어 넣고, 부른 것을 적는다
function fakeCompanion(){
  const calls = []; let cb = null;
  return {
    calls, push: (info) => cb && cb(info),
    onUpdateStatus: (f) => { cb = f; },
    installUpdate: () => calls.push(['install']),
    checkUpdate: () => calls.push(['check']),
    openBrowser: (u) => calls.push(['open', u]),
  };
}
function fakeUi(){ const shown = []; return { shown, show: (v) => shown.push(v), update: (v) => shown.push(v) }; }

(async () => {
  const { parseVer, isBelow, viewOf, createAppVersionGate, createAppVersionGateDom, MIN_APP_VER_PATH, MIN_APP_VER_MAX, RELEASES_URL, GATE_ID } = M;

  say('── 1. 버전 비교');
  chk(isBelow('0.9.8', '0.10.0') && !isBelow('0.10.0', '0.9.8'), '★ 숫자로 비교한다 — 0.9.8 < 0.10.0 (문자열 비교면 거꾸로)');
  chk(isBelow('0.10.2', '0.10.3') && !isBelow('0.10.3', '0.10.3') && !isBelow('0.10.4', '0.10.3'), '  ↳ 낮을 때만 true · 같거나 높으면 false');
  chk(!isBelow('0.10.3-beta.1', '0.10.3') && isBelow('0.10.2-beta.9', '0.10.3') && !isBelow('v0.10.3', '0.10.3'), '  ↳ 꼬리(-beta) · 앞의 v 는 보지 않는다');
  chk(isBelow('0.10', '0.10.1') && !isBelow('1', '0.99.99'), '  ↳ 빠진 자리는 0');
  chk([null, undefined, '', 'abc', '0.10.x', 103, 'x'.repeat(21), '1.2.3.4'].every(v => !isBelow(v, '9.9.9') && !isBelow('0.0.1', v)),
    '★ 못 읽는 값(빈칸 · 글자 · 숫자형 · 21자)으로는 막지 않는다');
  chk(MIN_APP_VER_MAX === 20 && parseVer('x'.repeat(21)) === null, '  ↳ 길이 상한 20 — 규칙과 같다');

  say('── 2. 게이트 — 막을 때 · 안 막을 때');
  const run = async (my, min, extra) => {
    const ui = fakeUi(), comp = fakeCompanion();
    const g = createAppVersionGate(Object.assign({ readMin: () => min, getVersion: () => my, companion: comp, ui }, extra || {}));
    const r = await g.start();
    return { r, ui, comp, g };
  };
  let t = await run('0.10.2', '0.10.3');
  chk(t.r.blocked && t.g.isBlocked() && t.ui.shown.length === 1, '★ 내 버전 < minAppVer 이면 막고 화면을 한 번 띄운다');
  chk(t.ui.shown[0].title === '업데이트해 주세요' && /0\.10\.2/.test(t.ui.shown[0].body) && /0\.10\.3/.test(t.ui.shown[0].body), '  ↳ 제목 · 지금 버전 · 필요한 버전');
  t = await run('0.10.3', '0.10.3');
  chk(!t.r.blocked && t.ui.shown.length === 0, '★ 같으면 안 막는다');
  t = await run('0.11.0', '0.10.3');
  chk(!t.r.blocked && t.r.why === 'ok', '  ↳ 높으면 안 막는다');
  t = await run('0.10.2', null);
  chk(!t.r.blocked && t.r.why === 'no-min', '★ 값이 없으면(지금 운영) 안 막는다');
  t = await run('0.10.2', undefined, { readMin: () => Promise.reject(new Error('PERMISSION_DENIED')) });
  chk(!t.r.blocked && t.r.why === 'read-failed' && t.ui.shown.length === 0, '★ 읽기 실패(거부 · 오류)는 안 막는다');
  t = await run('0.10.2', undefined, { readMin: () => new Promise(() => {}), timeoutMs: 30 });
  chk(!t.r.blocked && t.r.why === 'read-failed', '★ 오프라인(응답 없음)은 시간 초과 뒤 안 막는다');
  t = await run(null, '0.10.3');
  chk(!t.r.blocked && t.r.why === 'no-version', '★ 버전을 모르면(웹 · 검사) 안 막는다');
  t = await run('0.10.2', '0.10.3', { getVersion: () => { throw new Error('ipc'); } });
  chk(!t.r.blocked, '  ↳ 버전 조회가 던져도 안 막는다');
  t = await run('0.10.2', '0.10.3', { companion: null, ui: null });
  chk(t.r.blocked, '  ↳ companion · 화면이 없어도 판정은 한다(깨지지 않는다)');

  say('── 3. 단추');
  t = await run('0.10.2', '0.10.3');
  chk(t.ui.shown[0].button.action === 'open' && t.ui.shown[0].button.url === RELEASES_URL, '★ 업데이트 상태를 아직 모르면 — 다운로드 페이지 열기');
  t.g.press('button');
  chk(t.comp.calls.length === 1 && t.comp.calls[0][0] === 'open' && t.comp.calls[0][1] === RELEASES_URL, '  ↳ 누르면 시스템 브라우저로 연다');
  t.comp.push({ status: 'downloading', percent: 42 });
  const dl = t.ui.shown[t.ui.shown.length - 1];
  chk(dl.button.action === 'wait' && /42%/.test(dl.button.label), '★ 받는 중이면 진행률 · 누를 수 없음(wait)');
  t.comp.calls.length = 0; t.g.press('button');
  chk(t.comp.calls.length === 0, '  ↳ 받는 중에 눌러도 아무것도 안 한다');
  t.comp.push({ status: 'downloaded', version: '0.10.3' });
  chk(t.ui.shown[t.ui.shown.length - 1].button.action === 'install', '★ 받기 끝 — «지금 재시작해서 업데이트»');
  t.g.press('button');
  chk(t.comp.calls.length === 1 && t.comp.calls[0][0] === 'install', '  ↳ 누르면 installUpdate(기존 자동 업데이트 흐름)');
  t.comp.push({ status: 'error', message: 'x' });
  const er = t.ui.shown[t.ui.shown.length - 1];
  chk(er.button.action === 'retry' && !!er.note, '★ 실패 — «다시 시도» · 직접 받기 안내');
  t.comp.calls.length = 0; t.g.press('button');
  chk(t.comp.calls.length === 1 && t.comp.calls[0][0] === 'check', '  ↳ 다시 시도는 checkUpdate');
  t.comp.calls.length = 0; t.g.press('link');
  chk(t.comp.calls.length === 1 && t.comp.calls[0][1] === RELEASES_URL, '★ 링크는 언제나 다운로드 페이지');
  t.comp.push({ status: 'mac-available', version: '0.10.3', url: 'https://github.com/grk-cmd/t-w/releases/tag/v0.10.3' });
  t.comp.calls.length = 0; t.g.press('button');
  chk(t.comp.calls[0] && t.comp.calls[0][0] === 'open' && /tag\/v0\.10\.3$/.test(t.comp.calls[0][1]), '★ 맥 — 받으러 가기는 main 이 보낸 릴리스 주소');
  {
    // 막기 전에 온 상태도 기억한다 — 윈도우는 켜고 3초 뒤 받기 시작
    const comp = fakeCompanion(), ui = fakeUi();
    let release; const minP = new Promise(r => { release = r; });
    const g = createAppVersionGate({ readMin: () => minP, getVersion: () => '0.10.2', companion: comp, ui });
    const p = g.start();
    comp.push({ status: 'downloaded', version: '0.10.3' });
    chk(ui.shown.length === 0, '  ↳ 막기 전에는 화면을 안 그린다');
    release('0.10.3'); await p;
    chk(ui.shown[0] && ui.shown[0].button.action === 'install', '★ 막기 전에 온 «받기 끝» 을 기억한다');
    const g2 = createAppVersionGate({ readMin: () => null, getVersion: () => '0.10.2', companion: fakeCompanion(), ui: fakeUi() });
    await g2.start(); g2.press('button'); g2.press('link');
    chk(!g2.isBlocked(), '  ↳ 막지 않았으면 단추를 눌러도 아무 일 없음');
  }
  chk(viewOf('0.1.0', '0.2.0', { status: 'checking' }).button.action === 'wait' && viewOf('0.1.0', '0.2.0', { status: 'none' }).button.action === 'open',
    '  ↳ 확인 중은 기다림 · 새 버전 없음은 다운로드 페이지');

  say('── 4. 화면');
  {
    const made = [];
    const el = (tag) => { const e = { tag, style: {}, children: [], appendChild(c){ this.children.push(c); return c; }, textContent: '', disabled: false }; made.push(e); return e; };
    const doc = { createElement: el, body: el('body') };
    const ui = createAppVersionGateDom(doc);
    const presses = [];
    ui.show(viewOf('0.10.2', '0.10.3', { status: 'downloading', percent: 5 }), (k) => presses.push(k));
    const ov = doc.body.children[0];
    chk(ov && ov.id === GATE_ID && /z-index:100000/.test(ov.style.cssText), '★ 전체를 덮는 화면 하나(id ' + GATE_ID + ') · 다른 게이트보다 위');
    const buttons = made.filter(e => e.tag === 'button');
    chk(buttons.length === 1, '★ 닫기 단추 없음 — 단추는 업데이트 하나뿐');
    chk(buttons[0].disabled === true && /5%/.test(buttons[0].textContent), '  ↳ 받는 중이면 누를 수 없음');
    ui.update(viewOf('0.10.2', '0.10.3', { status: 'downloaded' }));
    chk(buttons[0].disabled === false && /재시작/.test(buttons[0].textContent), '  ↳ 상태가 바뀌면 같은 단추를 고쳐 그린다');
    buttons[0].onclick(); made.find(e => e.tag === 'a').onclick({ preventDefault(){} });
    chk(presses.join() === 'button,link', '  ↳ 단추 · 링크가 press 로 간다');
    ui.show(viewOf('0.10.2', '0.10.3', null), () => {});
    chk(doc.body.children.length === 1, '  ↳ 두 번 띄워도 한 장');
    chk(!/innerHTML/.test(strip(GATE)), '★ innerHTML 을 안 쓴다 — DB 값(버전 문자열)을 HTML 로 해석하지 않는다');
    const hit = (APP.match(/const UI_HIT_SEL = '([^']*)'/) || [])[1] || '';
    chk(hit.split(',').map(s => s.trim()).includes('#' + GATE_ID), '★ app.js UI_HIT_SEL 에 #' + GATE_ID + ' — 투명 창에서도 클릭을 받는다');
  }

  say('── 5. 연결');
  {
    const code = strip(FI);
    chk(/import \{ createAppVersionGate, createAppVersionGateDom \} from "\.\/app-version-gate\.js";/.test(code), 'firebase-init 가 모듈을 들여온다');
    const i = code.indexOf('createAppVersionGate({');
    const block = i >= 0 ? code.slice(i, code.indexOf('.start()', i) + 8) : '';
    chk(/readMin: \(\) => get\(ref\(db, 'config\/minAppVer'\)\)\.then\(s => s\.val\(\)\)/.test(block) && MIN_APP_VER_PATH === 'config/minAppVer',
      '★ config/minAppVer 하나만 get 한 번(구독 아님 · 작은 읽기)');
    chk(/getVersion: \(\) => _appVer\.ready/.test(block) && /ui: createAppVersionGateDom\(document\)/.test(block) && /\.start\(\)$/.test(block), '  ↳ 앱 버전 · 화면 · 켤 때 시작');
    chk(i > 0 && i < code.indexOf('createVisitPing({') && i < code.indexOf('window.firebaseAPI = {'), '  ↳ DB 가 생기자마자 — 다른 일보다 먼저');
    chk((code.match(/config\/minAppVer/g) || []).length === 1 && !/onValue\(ref\(db, 'config\/minAppVer'/.test(code), '  ↳ 읽는 곳은 한 곳 · 구독하지 않는다');
    chk(/ipcMain\.on\('companion:checkUpdate', \(\) => \{ startUpdateCheck\(\); \}\);/.test(MAIN), '★ main — 다시 확인은 startUpdateCheck 한 입구(맥 갈래 그대로)');
    chk(/checkUpdate\(\) \{\s*ipcRenderer\.send\('companion:checkUpdate'\);/.test(PRE) && /installUpdate\(\) \{\s*ipcRenderer\.send\('companion:installUpdate'\);/.test(PRE), '  ↳ preload checkUpdate · installUpdate');
    const pub = [].concat(PKG.build && PKG.build.publish || []).find(p => p && p.provider === 'github') || {};
    chk(RELEASES_URL === `https://github.com/${pub.owner}/${pub.repo}/releases/latest`, '★ 다운로드 주소 = package.json build.publish 저장소');
  }

  say('── 6. 규칙');
  {
    const n = (RULES.config || {}).minAppVer || {};
    chk(typeof n['.write'] === 'string' && /admins/.test(n['.write']) && /auth\.uid/.test(n['.write']), '★ config/minAppVer 쓰기는 관리자만');
    chk(n['.read'] === true, '★ 읽기는 누구나(로그인 전 · 가입 전에도 읽어야 한다)');
    const ok = (v) => { try{ return !!new Function('newData', 'return (' + n['.validate'] + ');')({ isString: () => typeof v === 'string', val: () => v }); }catch(_){ return false; } };
    chk(ok('0.10.3') && ok('x'.repeat(20)) && !ok('x'.repeat(21)) && !ok(103), '  ↳ 문자열 20자까지 · 숫자 거절');
    const r = (RULES.config || {}).minRoomVer || {};
    chk(r['.write'] === n['.write'] && r['.validate'] === n['.validate'], '  ↳ minRoomVer 와 같은 모양');
  }

  say(`\n판정: 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

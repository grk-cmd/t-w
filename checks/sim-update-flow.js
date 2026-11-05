/*
 * 켤 때 업데이트 흐름(shared/update-flow.js) — 업데이트 창 → 공지 창 → 로그인.
 * 1. 판정 — 버전 비교(숫자) · 모르는 값은 건너뜀 · 강제 > 선택 > 없음
 * 2. 켜는 흐름을 그대로 돌린다 — 강제(로그인으로 안 넘어감) · 선택([업데이트] [나중에]) · 없음 · 읽기 실패 · 시간 초과 · 버전 모름
 * 3. 순서 — 업데이트 창이 닫힌 뒤에야 공지 · 공지가 닫힌 뒤에야 로그인(proceed) · 공지 못 받으면 넘어감
 * 4. 켜 둔 동안 — 최소 버전이 올라가면 바로 강제 창 · 내 버전 이하면 아무 일 없음 · 새 요청(폴링)을 만들지 않는다
 * 5. 단추 — 받기 끝(재시작 설치) · 받는 중 · 실패(다시 시도 = 사용자가 누를 때만 확인) · 맥(릴리스 열기) · 링크
 * 6. 화면 — 강제는 단추 하나·닫기 없음 · 선택은 둘 · textContent 만 · id 가 UI_HIT_SEL 에 있음
 * 6-2. 통신 판이 다름(realtime 4003) — forceProtocol: 최소 버전 없이 강제 창 · 한 번 묻기 · 선택 창을 강제로
 * 7. 연결 — app.js(초대 게이트 앞에서 흐름 → 강제면 로그인 안 함) · firebase-init 에 옛 게이트 없음 · main 이 타이머로 혼자 확인하지 않음 · 규칙 config/minAppVer
 * 8. 깨 보기 — 일부러 틀린 사본이 빨강이 나는가
 */
'use strict';
const { stripReadGate } = require('./sim-rules-src.js');
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (...names) => { for(const n of names){ const s = read(n); if(s != null) return s; } say('  ? 원본 못 찾음 — ' + names[0]); process.exit(2); };
const SRC = need('update-flow.js', 'parts/shared/update-flow.js', 'app/parts/shared/update-flow.js');
const FI = need('firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js');
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');
const APP = _joinRenderer(need('app.js', 'parts/app.js', 'app/parts/app.js'));
const MAIN = need('main.js');
const PRE = need('preload.js');
const PKG = JSON.parse(need('package.json'));
const RULES = JSON.parse(stripReadGate(need('firebase-database-rules.json'))).rules;
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const load = (src) => new Function('window', 'module', src + '\nreturn module.exports;')(undefined, { exports: {} });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
function fakeUi(){ const log = []; return { log, hidden: 0, show(v){ log.push(v); }, update(v){ log.push(v); }, hide(){ this.hidden++; } }; }

async function suite(M, label){
  const { parseVer, isBelow, stageOf, STAGE, RELEASES_URL, VER_MAX } = M;
  const before = fail;

  say('── 1. 판정 (' + label + ')');
  chk(isBelow('0.9.8', '0.10.0') && !isBelow('0.10.0', '0.9.8'), '★ 숫자로 비교한다 — 0.9.8 < 0.10.0 (문자열 비교면 거꾸로)');
  chk(isBelow('0.10.2', '0.10.3') && !isBelow('0.10.3', '0.10.3') && !isBelow('0.10.4', '0.10.3'), '  ↳ 낮을 때만 true · 같거나 높으면 false');
  chk(!isBelow('0.10.3-beta.1', '0.10.3') && isBelow('0.10.2-beta.9', '0.10.3') && !isBelow('v0.10.3', '0.10.3'), '  ↳ 꼬리(-beta) · 앞의 v 는 보지 않는다');
  chk([null, undefined, '', 'abc', '0.10.x', 103, 'x'.repeat(21), '1.2.3.4'].every(v => !isBelow(v, '9.9.9') && !isBelow('0.0.1', v)), '★ 못 읽는 값으로는 막지 않는다');
  chk(VER_MAX === 20 && parseVer('x'.repeat(21)) === null, '  ↳ 길이 상한 20 — 규칙과 같다');
  chk(stageOf('0.12.0', '0.13.0', '0.13.1') === STAGE.FORCE, '★ 최소 미만이면 강제 — 새 판이 있어도 강제가 먼저');
  chk(stageOf('0.13.0', '0.12.0', '0.13.1') === STAGE.OPTIONAL && stageOf('0.13.0', null, '0.13.0') === STAGE.NONE, '  ↳ 새 판만 있으면 선택 · 같으면 없음');
  chk(stageOf('0.13.0', '0.13.0', null) === STAGE.NONE && stageOf(null, '9.0.0', '9.0.0') === STAGE.NONE && stageOf('0.13.0', '', null) === STAGE.NONE, '  ↳ 최소 = 내 버전이면 안 막음 · 내 버전을 모르면 없음 · 빈 최소는 없음');
  return fail - before;
}

(async () => {
  const M = load(SRC);
  const { STAGE, RELEASES_URL, createUpdateFlow, createUpdateDom, viewOf, OVERLAY_ID } = M;
  await suite(M, '실제 모듈');

  // 켜는 흐름 도구 — 공지는 기록만 남긴다
  const make = (o) => {
    o = o || {};
    const comp = o.noComp ? null : fakeCompanion(), ui = fakeUi();
    let minNow = o.min === undefined ? null : o.min;
    const minSubs = [];
    const order = [];
    let noticeCb = null;
    const f = createUpdateFlow({
      readMin: o.readMin || (() => minNow), getMin: () => minNow, onMinChange: (fn) => { minSubs.push(fn); return () => {}; },
      getVersion: o.getVersion || (() => (o.my === undefined ? '0.13.0' : o.my)), companion: comp, ui,
      noticeOnce: (fn) => { order.push('noticeWait'); noticeCb = fn; if(o.notice !== 'never') Promise.resolve().then(() => fn(o.notice === undefined ? { ts: 1 } : o.notice)); },
      showNotice: (n, done) => { order.push('notice'); if(o.noticeStays) { o.release = done; } else done(); },
      timeoutMs: o.timeoutMs || 200, updateWaitMs: o.updateWaitMs || 60, noticeWaitMs: o.noticeWaitMs || 60,
    });
    return { f, comp, ui, order, setMin: (v) => { minNow = v; minSubs.forEach(fn => fn()); }, o };
  };

  say('── 2. 켜는 흐름');
  let t = make({ my: '0.12.0', min: '0.13.0' });
  let r = await t.f.runBeforeLogin();
  chk(r.proceed === false && r.stage === STAGE.FORCE && t.f.isForced() && t.ui.log.length === 1, '★ 강제 — 로그인으로 안 넘어가고 창을 한 번 띄운다');
  chk(t.ui.log[0].title === '업데이트가 필요해요' && /0\.12\.0/.test(t.ui.log[0].body) && /0\.13\.0/.test(t.ui.log[0].body) && t.ui.log[0].buttons.length === 1, '  ↳ 문구 · 단추는 [업데이트] 하나(닫기 없음)');
  chk(!t.order.includes('notice') && !t.order.includes('noticeWait'), '★ 강제면 공지 창도 안 띄운다');
  chk(t.comp.calls.length === 1 && t.comp.calls[0][0] === 'check', '  ↳ 강제여도 새 판 확인은 켤 때 한 번 묻는다(받기를 막지 않는다)');

  t = make({ my: '0.13.0', min: '0.12.0' });
  let p = t.f.runBeforeLogin();
  await sleep(5); t.comp.push({ status: 'available', version: '0.13.1' });
  await sleep(5);
  chk(t.f.current() === STAGE.OPTIONAL && t.comp.calls[0][0] === 'check', '★ 선택 — 새 판 확인을 묻고 «새 버전» 창');
  const v = t.ui.log[t.ui.log.length - 1];
  chk(v.title === '새 버전 0.13.1' && v.buttons.length === 2 && v.buttons[1].label === '나중에' && !/공지/.test(v.body), '  ↳ 버전만 보인다 · [업데이트] [나중에]');
  chk(/지금 업데이트할까요/.test(v.body) && v.buttons[0].label === '업데이트', '  ↳ 윈도우는 «지금 업데이트할까요?» · [업데이트]');
  chk(!t.order.includes('notice'), '★ 업데이트 창이 떠 있는 동안은 공지를 안 띄운다 (로그인도 안 풀림)');
  t.f.press('later');
  r = await p;
  chk(r.proceed && r.stage === STAGE.OPTIONAL && t.order.join() === 'noticeWait,notice' && t.ui.hidden === 1, '★ [나중에] → 공지 → 로그인 순서로 풀린다');

  t = make({ my: '0.13.0', min: null });
  p = t.f.runBeforeLogin(); await sleep(5); t.comp.push({ status: 'none' });
  r = await p;
  chk(r.proceed && r.stage === STAGE.NONE && t.ui.log.length === 0 && t.order.join() === 'noticeWait,notice', '★ 새 판 없음 — 창 없이 공지만 → 로그인');
  t = make({ my: '0.13.0', min: null, notice: null });
  p = t.f.runBeforeLogin(); await sleep(5); t.comp.push({ status: 'none' });
  chk((await p).proceed, '  ↳ 보여 줄 공지가 없어도(null) 바로 로그인');
  t = make({ my: '0.13.0', min: '0.12.0', updateWaitMs: 80 });
  const t0 = Date.now();
  r = await t.f.runBeforeLogin();
  const waited = Date.now() - t0;
  chk(waited >= 70 && waited < 400, '  ↳ checkUpdate 를 불러도 답이 없으면 상한(updateWaitMs) 만큼만 기다린다(' + waited + 'ms)');
  chk(r.proceed && t.ui.log.length === 0, '★ 새 판 확인 답이 시간 안에 안 오면 «없음» 으로 보고 넘어간다(혼자 다시 묻지 않는다)');
  chk(t.comp.calls.filter(c => c[0] === 'check').length === 1, '  ↳ 확인 요청은 한 번뿐');
  t = make({ my: '0.13.0', min: '0.12.0' });
  p = t.f.runBeforeLogin(); await sleep(5); t.comp.push({ status: 'error', message: 'x' });
  chk((await p).proceed && t.ui.log.length === 0, '★ 확인 실패(오류)도 막지 않는다');

  t = make({ my: '0.12.0', readMin: () => Promise.reject(new Error('net')) });
  p = t.f.runBeforeLogin();
  chk((await p).proceed && !t.f.isForced(), '★ 최소 버전 읽기 실패는 안 막는다');
  t = make({ my: '0.12.0', readMin: () => new Promise(() => {}), timeoutMs: 30 });
  chk((await t.f.runBeforeLogin()).proceed, '★ 오프라인(응답 없음)은 시간 초과 뒤 안 막는다');
  t = make({ my: null, min: '9.9.9' });
  r = await t.f.runBeforeLogin();
  chk(r.proceed && r.stage === STAGE.NONE && t.ui.log.length === 0 && t.order.includes('notice'), '★ 버전을 모르면(웹 · 검사) 업데이트 단계 없이 공지부터');
  t = make({ my: '0.12.0', min: '0.13.0', getVersion: () => { throw new Error('ipc'); } });
  chk((await t.f.runBeforeLogin()).proceed, '  ↳ 버전 조회가 던져도 안 막는다');
  t = make({ my: '0.13.0', min: null, noComp: true });
  chk((await t.f.runBeforeLogin()).proceed, '  ↳ companion 이 없어도(웹) 깨지지 않는다');

  say('── 2-b. 새 판 확인은 읽기와 따로 — 어느 갈래든 켤 때 정확히 한 번');
  const checks = (c) => c.calls.filter(x => x[0] === 'check').length;
  const never = () => new Promise(() => {});
  const cases = [
    ['버전 모름', { my: null, min: '9.9.9' }],
    ['최소 버전 못 읽음(실패)', { my: '0.12.0', readMin: () => Promise.reject(new Error('net')) }],
    ['최소 버전 시간 초과', { my: '0.12.0', readMin: never, timeoutMs: 30 }],
    ['버전 조회 시간 초과', { my: '0.12.0', min: null, getVersion: never, timeoutMs: 30 }],
    ['둘 다 시간 초과', { my: '0.12.0', readMin: never, getVersion: never, timeoutMs: 30 }],
    ['버전 조회가 던짐', { my: '0.12.0', min: null, getVersion: () => { throw new Error('ipc'); } }],
    ['정상(강제 아님)', { my: '0.13.0', min: '0.12.0' }],
    ['정상(강제)', { my: '0.12.0', min: '0.13.0' }],
  ];
  for(const [name, o] of cases){
    t = make(o); await t.f.runBeforeLogin();
    chk(checks(t.comp) === 1, name + ' — checkUpdate 정확히 1번');
  }
  t = make({ my: '0.12.0', readMin: never, getVersion: () => '0.13.0', timeoutMs: 30, min: null });
  r = await t.f.runBeforeLogin();
  chk(r.proceed && t.f.current() === null, '★ 최소 버전 읽기가 늦어도 버전 읽기는 산다(상한이 따로) — 막지 않고 넘어감');
  t = make({ my: '0.13.0', min: null });
  p = t.f.runBeforeLogin(); await sleep(5); t.comp.push({ status: 'available', version: '0.13.1' }); await sleep(5);
  chk(t.f.current() === STAGE.OPTIONAL, '  ↳ 읽기와 따로 물어도 선택 창은 그대로 뜬다');
  t.f.press('later'); await p;

  say('── 3. 순서 · 공지');
  t = make({ my: '0.13.0', min: null, noticeStays: true });
  p = t.f.runBeforeLogin(); await sleep(5); t.comp.push({ status: 'none' });
  let settled = false; p.then(() => { settled = true; });
  await sleep(100);
  chk(!settled && t.order.includes('notice'), '★ 공지 창이 열려 있는 동안 로그인은 안 풀린다 (시간 초과로 풀리지 않는다)');
  t.o.release(); await p;
  chk(settled, '  ↳ 공지를 닫으면 풀린다');
  t = make({ my: '0.13.0', min: null, notice: 'never' });
  p = t.f.runBeforeLogin(); await sleep(5); t.comp.push({ status: 'none' });
  chk((await p).proceed && !t.order.includes('notice'), '★ 공지를 못 받으면 기다리다 로그인으로 넘어간다');

  say('── 4. 켜 둔 동안');
  t = make({ my: '0.13.0', min: null });
  p = t.f.runBeforeLogin(); await sleep(5); t.comp.push({ status: 'none' }); await p;
  t.setMin('0.13.0');
  chk(t.f.current() === null && t.ui.log.length === 0, '★ 최소 버전이 내 버전과 같으면 아무 일 없음');
  t.setMin('0.14.0');
  chk(t.f.isForced() && t.f.current() === STAGE.FORCE && t.ui.log.length === 1, '★ 최소 버전이 올라가면 바로 강제 창');
  t = make({ my: '0.13.0', min: null });
  t.setMin('0.14.0');
  chk(!t.f.isForced(), '  ↳ 버전을 읽기 전(켜는 중)의 바뀜은 켜는 흐름이 본다');
  t = make({ my: '0.13.0', min: '0.12.0' });
  p = t.f.runBeforeLogin(); await sleep(5); t.comp.push({ status: 'available', version: '0.13.1' }); await sleep(5);
  t.setMin('0.14.0'); r = await p;
  chk(r.proceed === false && t.f.current() === STAGE.FORCE, '★ 선택 창이 떠 있을 때 최소가 올라가면 강제 창으로 바뀌고 로그인은 안 풀린다');
  chk(!/setInterval|setTimeout\([^)]*\b(check|refresh)/.test(strip(SRC)) && !/setInterval/.test(strip(SRC)), '★ 새 주기 요청(setInterval)이 없다');

  say('── 4-b. 공지 기다리는 사이 · 켜 둔 동안 강제로 바뀜');
  t = make({ my: '0.13.0', min: null, noticeStays: true });
  p = t.f.runBeforeLogin(); await sleep(5); t.comp.push({ status: 'none' }); await sleep(20);
  chk(t.order.includes('notice'), '  (공지 창이 열려 있다)');
  t.setMin('0.14.0'); t.o.release(); r = await p;
  chk(r.proceed === false && r.stage === STAGE.FORCE && t.f.current() === STAGE.FORCE, '★ 공지를 기다리는 사이 최소 버전이 올라 강제 창이 뜨면 로그인으로 넘기지 않는다');
  for(const st of ['none', 'error', null]){
    t = make({ my: '0.13.0', min: null });
    p = t.f.runBeforeLogin(); await sleep(5); t.comp.push(st ? { status: st } : { status: 'none' }); await p;
    if(!st) t.comp.push(null);
    const n0 = checks(t.comp);
    t.setMin('0.14.0');
    chk(checks(t.comp) === n0 + 1, '★ 켜 둔 동안 강제로 바뀔 때 업데이트 상태가 «' + (st || '모름') + '» 이면 checkUpdate 를 한 번 더 부른다');
    t.setMin('0.15.0');
    chk(checks(t.comp) === n0 + 1, '  ↳ 이미 강제 창이면 또 묻지 않는다');
  }
  for(const st of ['downloading', 'downloaded', 'available', 'checking']){
    t = make({ my: '0.13.0', min: null, updateWaitMs: 20 });
    p = t.f.runBeforeLogin(); await sleep(5); t.comp.push({ status: 'none' }); await p;
    t.comp.push({ status: st, version: '0.14.0', percent: 5 });
    const n0 = checks(t.comp);
    t.setMin('0.14.0');
    chk(checks(t.comp) === n0, '  ↳ 업데이트 상태가 «' + st + '» 이면 강제로 바뀌어도 다시 묻지 않는다(받기가 이미 돌고 있다)');
  }

  // 켤 때 묻고 답을 기다리는 중에 최소 버전이 오르면 — 또 묻지 않는다(이미 물었다)
  t = make({ my: '0.13.0', min: null, updateWaitMs: 200 });
  p = t.f.runBeforeLogin(); await sleep(10);
  t.setMin('0.14.0');
  chk(checks(t.comp) === 1 && t.f.current() === STAGE.FORCE, '★ 켤 때 새 판 답을 기다리는 중에 최소 버전이 올라도 checkUpdate 는 1번뿐(강제 창은 뜬다)');
  r = await p;
  chk(r.proceed === false, '  ↳ 로그인은 안 풀린다');
  t = make({ my: '0.13.0', min: null, updateWaitMs: 20 });
  p = t.f.runBeforeLogin(); await p;   // 답 없이 시간 초과로 넘어감
  const n1 = checks(t.comp); t.setMin('0.14.0');
  chk(n1 === 1 && checks(t.comp) === 2, '  ↳ 시간 초과로 넘어간 뒤에 올라가면 받기 확인을 한 번 더 한다');
  // 강제 창은 checking · available 에서도 누를 곳이 없다 — 받는 중으로 그린다
  for(const st of ['checking', 'available']){
    const vv = viewOf(STAGE.FORCE, '0.12.0', '0.13.0', null, { status: st, version: '0.13.0' });
    chk(vv.buttons.length === 1 && vv.buttons[0].action === 'wait' && /받는 중/.test(vv.buttons[0].label), '★ 강제 창은 «' + st + '» 에서 «받는 중…»(누를 수 없음) — 반응 없는 [업데이트] 를 안 그린다');
  }
  chk(viewOf(STAGE.OPTIONAL, '0.13.0', null, '0.13.1', { status: 'available', version: '0.13.1' }).buttons[0].action === 'update', '  ↳ 선택 창은 available 에서 [업데이트](누르면 받는 중)');

  say('── 5. 단추');
  t = make({ my: '0.12.0', min: '0.13.0' });
  await t.f.runBeforeLogin();
  t.comp.calls.length = 0;
  chk(t.ui.log[0].buttons[0].action === 'open' && t.ui.log[0].buttons[0].url === RELEASES_URL, '★ 상태를 아직 모르면 — 다운로드 페이지 열기');
  t.f.press('open');
  chk(t.comp.calls[0][0] === 'open' && t.comp.calls[0][1] === RELEASES_URL, '  ↳ 시스템 브라우저로 연다');
  t.comp.push({ status: 'downloading', percent: 42 });
  let last = t.ui.log[t.ui.log.length - 1];
  chk(last.buttons[0].action === 'wait' && /42%/.test(last.buttons[0].label), '★ 받는 중이면 진행률 · 누를 수 없음');
  t.comp.calls.length = 0; t.f.press('wait');
  chk(t.comp.calls.length === 0, '  ↳ 받는 중에 눌러도 아무 일 없음');
  t.comp.push({ status: 'downloaded', version: '0.13.0' });
  t.f.press('install');
  chk(t.comp.calls.length === 1 && t.comp.calls[0][0] === 'install', '★ 받기 끝 — 재시작 설치');
  t.comp.push({ status: 'error', message: 'x' });
  last = t.ui.log[t.ui.log.length - 1];
  chk(last.buttons[0].action === 'retry' && !!last.note, '★ 실패 — «다시 시도» · 직접 받기 안내');
  { const ov = viewOf(STAGE.OPTIONAL, '0.13.0', null, '0.13.1', { status: 'error', message: 'x' });
    chk(!!ov.note && ov.linkUrl === RELEASES_URL && viewOf(STAGE.OPTIONAL, '0.13.0', null, '0.13.1', { status: 'available', version: '0.13.1' }).linkUrl === null, '  ↳ 선택 창도 실패면 안내가 가리키는 링크(다운로드 페이지)를 같이 보인다 · 실패가 아니면 링크 없음'); }
  t.comp.calls.length = 0; t.f.press('retry');
  chk(t.comp.calls.length === 1 && t.comp.calls[0][0] === 'check', '  ↳ 다시 시도는 사용자가 누를 때만 checkUpdate');
  t.comp.calls.length = 0; t.f.press('link');
  chk(t.comp.calls[0][1] === RELEASES_URL, '  ↳ 링크는 언제나 다운로드 페이지');
  t.comp.push({ status: 'mac-available', version: '0.13.1', url: 'https://github.com/grk-cmd/t-w/releases/tag/v0.13.1' });
  t.comp.calls.length = 0; t.f.press('open');
  chk(/tag\/v0\.13\.1$/.test(t.comp.calls[0][1]) && t.f.current() === STAGE.FORCE, '★ 맥 강제 — main 이 보낸 릴리스 주소를 열고 창은 그대로');

  // 선택 창 윈도우: [업데이트] → 받는 중 → 받기 끝나면 저절로 설치
  t = make({ my: '0.13.0', min: null });
  p = t.f.runBeforeLogin(); await sleep(5); t.comp.push({ status: 'available', version: '0.13.1' }); await sleep(5);
  chk(t.ui.log[t.ui.log.length - 1].buttons[0].action === 'update', '★ 선택(윈도우) — 받기 전 단추는 «업데이트»');
  t.f.press('update');
  last = t.ui.log[t.ui.log.length - 1];
  chk(last.buttons[0].action === 'wait' && last.buttons[1].action === 'later', '  ↳ 누르면 받는 중(누를 수 없음) · [나중에] 는 그대로');
  t.comp.calls.length = 0; t.comp.push({ status: 'downloaded', version: '0.13.1' });
  chk(t.comp.calls.length === 1 && t.comp.calls[0][0] === 'install', '★ [업데이트] 를 눌러 뒀으면 받기가 끝나는 순간 재시작 설치');
  t.f.press('later'); await p;
  t = make({ my: '0.13.0', min: null });
  p = t.f.runBeforeLogin(); await sleep(5); t.comp.push({ status: 'downloaded', version: '0.13.1' }); await sleep(5);
  t.comp.calls.length = 0; t.comp.push({ status: 'downloaded', version: '0.13.1' });
  chk(t.comp.calls.length === 0, '  ↳ [업데이트] 를 안 눌렀으면 받기가 끝나도 저절로 설치하지 않는다');
  t.f.press('later'); await p;
  // 선택 창 맥
  t = make({ my: '0.13.0', min: null });
  p = t.f.runBeforeLogin(); await sleep(5); t.comp.push({ status: 'mac-available', version: '0.13.1', url: 'https://github.com/x/y/releases/tag/v0.13.1' }); await sleep(5);
  last = t.ui.log[t.ui.log.length - 1];
  chk(/받아 설치해 주세요/.test(last.body) && !/업데이트할까요/.test(last.body) && last.buttons[0].label === '다운로드 페이지 열기', '★ 선택(맥) — 앱이 설치하지 않으니 «받아 설치해 주세요» · [다운로드 페이지 열기]');
  t.f.press('open'); r = await p;
  chk(t.comp.calls.some(c => c[0] === 'open') && r.proceed, '★ 선택(맥) — [업데이트] 는 브라우저로 열고 다음 단계(공지)로');
  let called = 0; t.f.whenStageDone(() => called++);
  chk(called === 1, '  ↳ 단계가 끝난 뒤의 whenStageDone 은 바로 부른다(띠)');
  t = make({ my: '0.12.0', min: '0.13.0' });
  await t.f.runBeforeLogin(); called = 0; t.f.whenStageDone(() => called++);
  chk(called === 0, '★ 강제 중에는 띠를 미룬다(끝나지 않는다)');
  t = make({ my: '0.13.0', min: null }); t.f.press('later'); t.f.press('install');
  chk(t.comp.calls.length === 0, '  ↳ 창이 없을 때 단추는 아무 일 없음');

  say('── 6. 화면');
  {
    const made = [];
    const el = (tag) => { const e = { tag, style: {}, children: [], appendChild(c){ this.children.push(c); return c; }, textContent: '', disabled: false }; made.push(e); return e; };
    const doc = { createElement: el, body: el('body') };
    const ui = createUpdateDom(doc);
    const presses = [];
    ui.show(viewOf(STAGE.FORCE, '0.12.0', '0.13.0', null, { status: 'downloading', percent: 5 }), (k) => presses.push(k));
    const ov = doc.body.children[0];
    chk(ov && ov.id === OVERLAY_ID && /z-index:100000/.test(ov.style.cssText), '★ 전체를 덮는 화면 하나 · 다른 게이트보다 위');
    let buttons = made.filter(e => e.tag === 'button');
    chk(buttons.length === 1 && buttons[0].disabled === true && /5%/.test(buttons[0].textContent), '★ 강제 — 단추 하나뿐(닫기 없음) · 받는 중이면 누를 수 없음');
    ui.update(viewOf(STAGE.FORCE, '0.12.0', '0.13.0', null, { status: 'downloaded' }));
    chk(buttons[0].disabled === false && /재시작/.test(buttons[0].textContent), '  ↳ 상태가 바뀌면 같은 단추를 고쳐 그린다');
    buttons[0].onclick(); made.find(e => e.tag === 'a').onclick({ preventDefault(){} });
    chk(presses.join() === 'install,link', '  ↳ 단추 · 링크가 press 로 간다');
    ui.update(viewOf(STAGE.OPTIONAL, '0.13.0', null, '0.13.1', { status: 'available', version: '0.13.1' }));
    buttons = made.filter(e => e.tag === 'button');
    chk(buttons.length === 2 && buttons.every(b => b.style.display !== 'none') && buttons[1].textContent === '나중에', '★ 선택 — 단추 둘');
    buttons[1].onclick();
    chk(presses[presses.length - 1] === 'later', '  ↳ [나중에] 가 press(later)');
    ui.update(viewOf(STAGE.FORCE, '0.12.0', '0.13.0', null, null));
    chk(buttons[1].style.display === 'none', '  ↳ 다시 강제로 바뀌면 둘째 단추는 숨긴다');
    ui.hide(); ui.show(viewOf(STAGE.FORCE, '0.12.0', '0.13.0', null, null), () => {});
    chk(doc.body.children.length === 1 && ov.style.display === 'flex', '  ↳ 닫았다 다시 띄워도 한 장');
    {
      // 실제로 그려 본다 — 서버 값(버전 문자열)에 태그가 들어 있어도 글자 그대로 들어가고 innerHTML 은 한 번도 안 쓰인다
      const htmlSets = [];
      const el2 = (tag) => { const e = { tag, style: {}, children: [], appendChild(c){ this.children.push(c); return c; }, textContent: '' }; Object.defineProperty(e, 'innerHTML', { set(v){ htmlSets.push(v); }, get(){ return ''; } }); return e; };
      const doc2 = { createElement: el2, body: el2('body') };
      const ui2 = createUpdateDom(doc2);
      ui2.show(viewOf(STAGE.FORCE, '0.1.0', '<img src=x onerror=alert(1)>', null, null), () => {});
      const bodyEl = doc2.body.children[0].children[0].children[1].children[0];
      chk(htmlSets.length === 0 && /<img src=x/.test(bodyEl.textContent), '★ 서버 값(버전)에 태그가 있어도 글자 그대로(textContent) — innerHTML 을 안 쓴다');
    }
    const hit = (APP.match(/const UI_HIT_SEL = '([^']*)'/) || [])[1] || '';
    chk(hit.split(',').map(s => s.trim()).includes('#' + OVERLAY_ID), '★ app.js UI_HIT_SEL 에 #' + OVERLAY_ID + ' — 투명 창에서도 클릭을 받는다');
  }

  say('── 6-2. 통신 판이 다름(realtime 4003) — forceProtocol');
  {
    let t2 = make({ my: '0.13.0', min: null });
    let p2 = t2.f.runBeforeLogin(); await sleep(5); t2.comp.push({ status: 'none' }); await p2;
    const n0 = t2.comp.calls.length;
    t2.f.forceProtocol();
    const fv = t2.ui.log[t2.ui.log.length - 1];
    chk(t2.f.isForced() && t2.f.current() === STAGE.FORCE && fv.title === '업데이트가 필요해요' && fv.buttons.length === 1 && /서버와 맞지 않아/.test(fv.body) && !/null/.test(fv.body),
      '★ 최소 버전을 몰라도 강제 창(«서버와 맞지 않아» · 단추 하나 · 닫기 없음) — ' + fv.body);
    chk(t2.comp.calls.length === n0 + 1 && t2.comp.calls[n0][0] === 'check', '  ↳ 받기가 안 돌고 있으면 새 판 확인을 한 번 묻는다');
    t2.f.forceProtocol();
    chk(t2.comp.calls.length === n0 + 1, '  ↳ 이미 강제 창이면 다시 묻지 않는다');
    t2 = make({ my: '0.13.0', min: '0.12.0' });
    p2 = t2.f.runBeforeLogin(); await sleep(5); t2.comp.push({ status: 'available', version: '0.13.1' }); await sleep(5);
    t2.f.forceProtocol();
    const r2 = await p2;
    chk(r2.proceed === false && t2.f.current() === STAGE.FORCE, '  ↳ 선택 창이 떠 있어도 강제 창으로 바뀌고 로그인으로 안 넘긴다');
    chk(t2.comp.calls.filter(c => c[0] === 'check').length === 1, '  ↳ 받는 중(available)이면 또 묻지 않는다');
  }

  say('── 7. 연결');
  {
    // 아래 7절 정규식은 app.js · main.js · preload.js 의 «배선»(어디서 무엇을 부르나)이라 실제로 불러 볼 수 없어 글자로 본다. 동작은 2~5절이 맡는다.
    const code = strip(FI);
    chk(!/app-version-gate|createAppVersionGate/.test(code), 'firebase-init 에 옛 게이트가 없다');
    const app = strip(APP);
    const i = app.indexOf('const updateFlowMod = TwUpdateFlow.createUpdateFlow({');
    const j = app.indexOf('(function initInviteGate(){');
    chk(i > 0 && j > i, 'app.js 가 초대 게이트 앞에서 흐름을 만든다');
    const run = app.slice(j, app.indexOf('TwNetReady.whenNetReady(run)', j));
    const runBody = run.slice(run.indexOf('const run = async'));
    chk(/const flowP = updateFlowMod\.runBeforeLogin\(\);\s*const run = async/.test(run), '★ 흐름은 Firebase 준비(whenNetReady) 밖에서 바로 시작한다 — firebase-init 이 깨져도 새 판 확인 · 받기가 돈다');
    chk(/const flow = await flowP;\s*if\(!flow\.proceed\) return;/.test(runBody) && runBody.indexOf('flowP') < runBody.indexOf('checkInviteGate()') && !/runBeforeLogin/.test(runBody), '★ 로그인(checkInviteGate) 앞에서 흐름을 기다리고 · 강제면 로그인하지 않는다');
    const blk = app.slice(i, j);
    chk(/readMin: \(\)=> _updRc \? _updRc\.ready\(null, MIN_APP_VER_WAIT_MS\)\.then\(\(\)=>_updRc\.minAppVer\(\)\) : null/.test(blk) && /key === 'minVersion'/.test(blk) && /const _updRc = (?:acctStateMod\.)?_rcStore\(\);/.test(app), '★ 최소 버전 = 원격 설정 첫 답(API 값만) · 바뀜은 minVersion 칸 알림 · 원격 설정 한 벌은 한 번만 받는다');
    const w = +(app.match(/const MIN_APP_VER_WAIT_MS = (\d+);/) || [])[1];
    chk(w > 0 && w < M.MIN_READ_TIMEOUT_MS, '  ↳ 첫 답 기다림은 읽기 상한(8초)보다 짧게');
    chk(/noticeOnce: \(fn\)=>noticeFeed\.onceReady\(fn\)/.test(blk) && !/noticeFeed\.onceReady\(_showUpdateNoticeOnce\)/.test(app), '★ 공지 창은 흐름 한 곳에서만 띄운다(따로 띄우지 않는다)');
    const fnNotice = app.slice(app.indexOf('function _showUpdateNoticeOnce('), app.indexOf('function _showUpdateNoticeOnce(') + 1500);
    chk((fnNotice.match(/done\(\)/g) || []).length >= 4, '  ↳ 공지 창은 없을 때 · 이미 본 때 · 닫을 때 모두 done()');
    const m = strip(MAIN);
    chk(/ipcMain\.on\('companion:checkUpdate', \(\) => \{ startUpdateCheck\(\); \}\);/.test(m), '★ main — 확인은 startUpdateCheck 한 입구');
    chk(!/setTimeout\(\s*\(\)\s*=>\s*\{\s*startUpdateCheck\(\)/.test(m), '  ↳ main 이 켜고 몇 초 뒤 혼자 확인하지 않는다(렌더러가 묻는다)');
    chk(/checkUpdate\(\) \{\s*ipcRenderer\.send\('companion:checkUpdate'\);/.test(PRE) && /installUpdate\(\) \{\s*ipcRenderer\.send\('companion:installUpdate'\);/.test(PRE), '  ↳ preload checkUpdate · installUpdate');
    const dr = strip(read('app/parts/launcher/desktop-run.js') || read('parts/launcher/desktop-run.js') || '');
    chk(/whenUpdateStageDone\(\(\)=>showUpdateReadyBanner\(version\)\)/.test(dr) && /whenUpdateStageDone\(\(\)=>showUpdateReadyBanner\(version, info&&info\.url\)\)/.test(dr), '★ 런처 띠는 업데이트 창 단계가 끝난 뒤에 건다(유지)');
    const pub = [].concat(PKG.build && PKG.build.publish || []).find(p => p && p.provider === 'github') || {};
    chk(RELEASES_URL === `https://github.com/${pub.owner}/${pub.repo}/releases/latest`, '★ 다운로드 주소 = package.json build.publish 저장소');
    const n = (RULES.config || {}).minAppVer || {};
    chk(typeof n['.write'] === 'string' && /admins/.test(n['.write']) && n['.read'] === true, '  ↳ 규칙 config/minAppVer(옛 앱용) — 관리자만 쓰기 · 누구나 읽기');
  }

  say('── 8. 깨 보기');
  {
    // 동기 판정만으로 충분한 것은 suite 의 판정을 직접 부른다
    const chkBroken = (from, to, name, probe) => {
      const m = SRC.replace(from, to);
      if(m === SRC){ chk(false, name + ' — 바꿀 자리를 못 찾음'); return; }
      let ok = false; try{ ok = !probe(load(m)); }catch(_){ ok = true; }
      chk(ok, '깨 보기 — ' + name + ' → 판정이 빨강');
    };
    chkBroken('if(a[i] !== b[i]) return a[i] < b[i];', 'if(a[i] !== b[i]) return a[i] > b[i];', '비교 방향을 거꾸로', (X) => X.isBelow('0.9.8', '0.10.0') && !X.isBelow('0.10.0', '0.9.8'));
    chkBroken("if(min != null && min !== '' && isBelow(my, String(min))) return STAGE.FORCE;", '', '강제 판정을 지움', (X) => X.stageOf('0.12.0', '0.13.0', null) === 'force');
    chkBroken("if(latest != null && isBelow(my, String(latest))) return STAGE.OPTIONAL;", '', '선택 판정을 지움', (X) => X.stageOf('0.13.0', null, '0.13.1') === 'optional');
    // 흐름 깨 보기 — 사본을 만들어 같은 시나리오를 돌린다
    const flowOf = (src, o) => {
      const X = load(src), comp = fakeCompanion(), ui = fakeUi(), order = [], hold = {}; let minNow = o.min;
      const subs = [];
      const f = X.createUpdateFlow({ readMin: () => minNow, getMin: () => minNow, onMinChange: (fn) => { subs.push(fn); return () => {}; }, getVersion: () => o.my, companion: comp, ui,
        noticeOnce: (fn) => fn({ ts: 1 }), showNotice: (n, d) => { order.push('notice'); if(o.stay) hold.d = d; else d(); }, updateWaitMs: 10, noticeWaitMs: 10, timeoutMs: 50 });
      return { f, comp, ui, order, hold, setMin: (v) => { minNow = v; subs.forEach(g => g()); } };
    };
    const mutate = (from, to) => { const m = SRC.split(from).join(to); return m === SRC ? null : m; };
    const redIf = (name, m, probe) => { if(!m){ chk(false, '깨 보기 — ' + name + ' — 바꿀 자리를 못 찾음'); return; } let red = false; return probe(m).then(ok => { red = !ok; chk(red, '깨 보기 — ' + name + ' → 빨강'); }, () => chk(true, '깨 보기 — ' + name + ' → 빨강(던짐)')); };
    // 강제면 공지 안 돎 (판정: 강제인데 공지 창이 한 번도 안 뜬다)
    await redIf('강제인데 공지가 돈다', mutate('if(enforce(min)) return { proceed: false, stage: STAGE.FORCE };', 'enforce(min);') && mutate('if(enforce(min)) return { proceed: false, stage: STAGE.FORCE };', 'enforce(min);').split('if(forced) return { proceed: false, stage: STAGE.FORCE };   // 기다리는 사이 최소 버전이 올랐다').join(''),
      async (m) => { const x = flowOf(m, { my: '0.12.0', min: '0.13.0' }); await x.f.runBeforeLogin(); return !x.order.includes('notice'); });
    // 켤 때 답을 기다리는 중 강제로 바뀌면 또 묻는 옛 구조
    await redIf('답을 기다리는 중에도 또 묻는다', mutate('    if(updateAnswer) return;\n    const st', '    const st'),
      async (m) => { const x = flowOf(m, { my: '0.13.0', min: null }); const p = x.f.runBeforeLogin(); await sleep(2); x.setMin('0.14.0'); await p; return x.comp.calls.filter(c => c[0] === 'check').length === 1; });
    // 강제 창이 checking 에서 [업데이트] 를 그린다
    await redIf('강제 창이 checking 에서 [업데이트] 를 그린다', mutate('buttons: [mainButton(u, true)],', 'buttons: [mainButton(u, false)],'),
      async (m) => { const X = load(m); return X.viewOf(X.STAGE.FORCE, '0.12.0', '0.13.0', null, { status: 'checking' }).buttons[0].action === 'wait'; });
    // 맥 선택 창이 «업데이트할까요?» 로 묻는다
    await redIf('맥 선택 창이 «업데이트할까요?» 로 묻는다', mutate("u.status === 'mac-available' ? '다운로드 페이지에서 받아 설치해 주세요.' :", "false ? '' :"),
      async (m) => { const X = load(m); return !/업데이트할까요/.test(X.viewOf(X.STAGE.OPTIONAL, '0.13.0', null, '0.13.1', { status: 'mac-available', version: '0.13.1', url: 'u' }).body); });
    // 켤 때 checkUpdate 1번 (판정: 두 번 부르면 빨강)
    await redIf('checkUpdate 를 두 번 부른다', mutate('companion.checkUpdate();\n    });', 'companion.checkUpdate(); companion.checkUpdate();\n    });'),
      async (m) => { const x = flowOf(m, { my: '0.13.0', min: null }); await x.f.runBeforeLogin(); return x.comp.calls.filter(c => c[0] === 'check').length === 1; });
    // [업데이트] 눌러 뒀으면 받기 끝에 설치
    await redIf('받기가 끝나도 설치하지 않는다', mutate('if(up && up.status === \'downloaded\' && wantUpdate && shown && !forced) companion.installUpdate();', ''),
      async (m) => { const x = flowOf(m, { my: '0.13.0', min: null }); const p = x.f.runBeforeLogin(); await sleep(2); x.comp.push({ status: 'available', version: '0.13.1' }); await sleep(2);
        x.f.press('update'); x.comp.calls.length = 0; x.comp.push({ status: 'downloaded', version: '0.13.1' }); const ok = x.comp.calls.some(c => c[0] === 'install'); x.f.press('later'); await p; return ok; });
    // 공지 뒤 강제 확인
    await redIf('공지 뒤 강제를 안 본다', mutate('function end(stage){ return forced ?', 'function end(stage){ return false ?'),
      async (m) => { const x = flowOf(m, { my: '0.13.0', min: null, stay: true }); const p = x.f.runBeforeLogin(); await sleep(2); x.comp.push({ status: 'none' }); await sleep(20); x.setMin('0.14.0'); x.hold.d(); const r2 = await p; return r2.proceed === false; });
    // 켜 둔 동안 강제 → 한 번 묻기
    await redIf('켜 둔 동안 강제로 바뀔 때 묻지 않는다', mutate('if(companion && !BUSY_OR_READY.includes(st)) companion.checkUpdate();', ''),
      async (m) => { const x = flowOf(m, { my: '0.13.0', min: null }); const p = x.f.runBeforeLogin(); await sleep(2); x.comp.push({ status: 'none' }); await p; const n = x.comp.calls.length; x.setMin('0.14.0'); return x.comp.calls.length === n + 1; });
    // 갈래에서 checkUpdate 를 빼면 빨강 (위 2-b 와 같은 사본)
    {
      const m3 = SRC.replace('const answer = askUpdate();', 'const answer = Promise.resolve();').replace('await answer;', 'await askUpdate();');
      let n = -1;
      try{
        const X = load(m3); const c = fakeCompanion();
        const f = X.createUpdateFlow({ readMin: () => '9.9.9', getMin: () => '9.9.9', onMinChange: () => () => {}, getVersion: () => null, companion: c, ui: fakeUi(), noticeOnce: (fn) => fn(null), showNotice: (n2, d) => d(), updateWaitMs: 10, noticeWaitMs: 10 });
        await f.runBeforeLogin(); n = c.calls.filter(x => x[0] === 'check').length;
      }catch(_){ n = -1; }
      chk(m3 !== SRC && n !== 1, '깨 보기 — 버전을 모를 때 새 판 확인이 빠지면 빨강(checkUpdate ' + n + '번)');
    }
    await redIf('4003 에 강제 창을 안 띄운다', mutate('    showWindow(STAGE.FORCE, null);\n', ''),
      async (m) => { const x = flowOf(m, { my: '0.13.0', min: null }); const p = x.f.runBeforeLogin(); await sleep(2); x.comp.push({ status: 'none' }); await p; x.f.forceProtocol(); return x.f.current() === 'force'; });
    await redIf('4003 강제 창 글에 최소 버전 자리(null)', mutate("        : '이 버전' + (my ? '(' + my + ')' : '') + '은 서버와 맞지 않아", "        : '이 버전(' + my + ')은 ' + min + ' 서버와 맞지 않아"),
      async (m) => { const X = load(m); return !/null/.test(X.viewOf(X.STAGE.FORCE, '0.13.0', null, null, null).body); });
    // 강제인데 로그인으로 넘기기
    {
      const m2 = SRC.split('return { proceed: false, stage: STAGE.FORCE };').join('return { proceed: true, stage: STAGE.FORCE };');
      let red = false;
      try{ const x = flowOf(m2, { my: '0.12.0', min: '0.13.0' }); red = (await x.f.runBeforeLogin()).proceed === true; }catch(_){ red = true; }
      chk(m2 !== SRC && red, '깨 보기 — 강제인데 로그인으로 넘기면 빨강');
    }
  }

  say(`\n판정: 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

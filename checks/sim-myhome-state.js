/* sim-myhome-state.js — 🏠 마이홈 공용 상태 읽는 창구(myhome-state.js — 지금 그리는 마이홈 페이지 · 불러옴 · 관람 중 코드 · 이름 · 👁 미리보기 깃발)
   실행:  node sim-myhome-state.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 값의 주인은 myhome-store.js(D2-2)다. 마이홈 창 · 페이지 · 편집 · 스티커 · 방명록 · 스케줄러 · 채팅 · 내 정보가 «예전 이름 그대로» 읽을 수 있게
     이 파일은 읽는 함수만 내놓는다(쓰는 함수 없음 — 바꾸려면 store 의 동작 함수). 친구 홈 구경(myhome-visit.js)에 두면 읽는 모듈이 모두 visit 을 바라보고 순환이 됐다(sim-dep-cycles).
   ・1절: 처음 값 · 읽는 함수가 store 를 그대로 비춘다(쓰는 함수 없음) · 이름 창구(친구 목록 → 힌트 → «친구»)
   ・2절: HTML 순서(미리보기 깃발을 읽는 · 바꾸는 파일 · app.js 보다 먼저) · 만드는 줄
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('myhome/myhome-state.js'), HTML = read('desk-companion-prototype.html'), APP = read('app.js');
if (!MOD || !HTML || !APP) { say('  ? 원본 못 찾음 — myhome-state.js · desk-companion-prototype.html · app.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const PREVIEW_WRITERS = ['myhome/myhome-state.js', 'myhome/myhome-ui.js', 'myhome/myhome-visit.js'];

/* 가짜 store — 읽는 함수만 받는다(진짜는 sim-myhome-store.js 가 본다) */
function fakeStore(o) {
  const st = Object.assign({ load: 'idle', page: { bio: '' }, owner: null, name: null }, o);
  return { st, store: { page: () => st.page, mine: () => ({ load: st.load }), viewing: () => st.owner, viewName: () => st.name, LOAD: { READY: 'ready' } } };
}
function build(mod, friends, fs_) {
  const win = {};
  const api = new Function('window', 'module', mod + '\nreturn window.TwMyHomeState;')(win, undefined);
  return { win, st: api.createMyHomeState({ _myHomeFriends: () => friends, myhomeStore: fs_.store }) };
}
function judge(mod, html, files, app) {
  const r = {};
  try {
    const friends = {};
    const fs_ = fakeStore();
    const { win, st } = build(mod, friends, fs_);
    r.init = win._mhPreviewMode === false && st._myHomeData() === fs_.st.page && st._myHomeLoaded() === false && st._mhViewingUserId() === null && st._mhViewingName() === null;
    r.notViewing = st._mhViewingDisplayName() === '';
    fs_.st.owner = 'u9'; r.fallback = st._mhViewingDisplayName() === '친구';
    fs_.st.name = '힌트'; r.hint = st._mhViewingDisplayName() === '힌트' && st._mhViewingName() === '힌트';
    friends.u9 = { name: '친구목록' }; r.friend = st._mhViewingDisplayName() === '친구목록';
    const nd = { bio: 'b' }; fs_.st.page = nd; fs_.st.load = 'ready';
    r.mirror = st._myHomeData() === nd && st._myHomeLoaded() === true && st._mhViewingUserId() === 'u9';
    r.noSetters = Object.keys(st).filter((k) => /^set/.test(k)).length === 0 && !('_mhHomeFromServer' in st) && !('_myHomeUid' in st);
  } catch (e) { r.err = String(e && e.message || e); }
  const order = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
  const at = order.indexOf('myhome/myhome-state.js'), atApp = order.indexOf('app.js');
  const users = files.filter(([f, t]) => f !== 'myhome/myhome-state.js' && /\b_mhPreviewMode\b/.test(strip(t))).map(([f]) => f);
  r.late = at < 0 ? ['(myhome-state.js 를 안 싣는다)'] : users.filter(f => order.indexOf(f) >= 0 && order.indexOf(f) < at).concat(atApp >= 0 && atApp < at ? ['app.js'] : []);
  r.users = users.length;
  r.previewWriters = files.filter(([f, t]) => !PREVIEW_WRITERS.includes(f) && /window\._mhPreviewMode\s*=[^=]/.test(strip(t))).map(([f]) => f);
  r.setCalls = files.filter(([f, t]) => /\bmhStateMod\.set\w+\(/.test(strip(t))).map(([f]) => f);
  r.made = /const mhStateMod = TwMyHomeState\.createMyHomeState\(\{\n  _myHomeFriends: \(\)=>_myHomeFriends,\n  myhomeStore: myhomeStoreMod,\n\}\);/.test(app)
    && app.indexOf('const mhStateMod =') < app.indexOf('const mhVisitMod =') && app.indexOf('const myhomeStoreMod =') < app.indexOf('const mhStateMod =');
  return r;
}

const ORDER = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
const FILES = ORDER.map(f => [f, f === 'app.js' ? APP : read(f)]).filter(([, t]) => t);
const R = judge(MOD, HTML, FILES, APP);

say('── 1. 처음 값 · 읽기');
chk(!R.err && R.init, '싣고 만들면 미리보기 깃발 false · store 의 페이지 · 안 불러옴 · 관람 · 이름 null' + (R.err ? ' — ' + R.err : ''));
chk(R.notViewing && R.fallback && R.hint && R.friend, '이름 창구 — 관람 안 하면 빈 글 · 친구 목록 → 진입 힌트 → «친구» 차례');
chk(R.mirror, '읽는 함수는 store 가 바뀌면 그대로 따라간다(사본 없음)');
chk(R.noSetters, '쓰는 함수 · 서버 모양 맞추기 · 계정 칸이 없다(값의 주인은 store)');

say('── 2. 싣는 순서 · 만드는 줄');
chk(FILES.length >= 100, 'HTML 이 싣는 parts/ 파일 ' + FILES.length + '개를 읽었다');
chk(R.users >= 4 && !R.late.length, '미리보기 깃발을 읽는 · 바꾸는 파일 ' + R.users + '개 · app.js 보다 myhome-state.js 를 먼저 싣는다' + (R.late.length ? ' — 먼저 실리는 것: ' + R.late.join(' · ') : ''));
chk(!R.previewWriters.length, '미리보기 깃발을 바꾸는 파일은 myhome-ui · myhome-visit 뿐' + (R.previewWriters.length ? ' — 그 밖: ' + R.previewWriters.join(' · ') : ''));
chk(!R.setCalls.length && !/\bmhStateMod\.set\w+\(/.test(strip(APP)) && !/\bset(?:MyHomeData|MyHomeLoaded|MhViewingUserId|MhViewingName)\b/.test(strip(APP)), '상태를 바꾸는 쓰는 함수가 어디에도 없다 — 바꾸려면 store 동작 함수' + (R.setCalls.length ? ' — ' + R.setCalls.join(' · ') : ''));
chk(R.made, 'app.js 는 store 를 먼저 만들고 그다음 상태 모듈(store 를 받음) · 친구 홈 구경보다 먼저 만든다');

say('── 3. 일부러 깨 보기');
const line = '<script src="parts/myhome/myhome-state.js"></script>';
const lateHtml = HTML.indexOf(line) < 0 ? HTML : HTML.replace(line, '').replace('<script src="parts/app.js"></script>', '<script src="parts/app.js"></script>\n' + line);
chk(judge(MOD, lateHtml, FILES, APP).late.length > 0, 'myhome-state.js 를 app.js 뒤로 옮기면 빨강');
chk(!judge(MOD.replace('window._mhPreviewMode = false;', ''), HTML, FILES, APP).init, '미리보기 깃발 처음 값을 빼면 빨강');
chk(!judge(MOD.replace("  const hint = myhomeStore.viewName();\n  if(hint) return hint;\n", ''), HTML, FILES, APP).hint, '이름 창구에서 진입 힌트를 빼면 빨강');
chk(!judge(MOD.replace('_myHomeData: ()=>myhomeStore.page(),', '_myHomeData: ()=>({}),'), HTML, FILES, APP).mirror, 'store 를 안 비추고 따로 들면 빨강');
const extra = FILES.map(([f, t]) => [f, f === 'myhome/guestbook.js' ? t + '\nwindow._mhPreviewMode = true;\nmhStateMod.setMyHomeData({});\n' : t]);
const E = judge(MOD, HTML, extra, APP);
chk(E.previewWriters.includes('myhome/guestbook.js') && E.setCalls.includes('myhome/guestbook.js'), '다른 파일이 깃발 · 상태를 바꾸면 빨강');
chk(/\bmhStateMod\.set\w+\(/.test(strip(APP + '\nmhStateMod.setMyHomeLoaded(false);\n')), 'app.js 다른 자리에서 상태를 바꾸면 빨강');

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 마이홈 공용 상태는 store 를 비추는 읽기 창구'));
process.exit(fail ? 1 : 0);

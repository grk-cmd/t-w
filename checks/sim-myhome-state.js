/* sim-myhome-state.js — 🏠 마이홈 공용 상태(myhome-state.js — 내 마이홈 데이터 · 불러옴 · 계정 · 관람 중 uid · 이름 · 👁 미리보기 깃발)
   실행:  node sim-myhome-state.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 마이홈 데이터 · 관람 중 uid 는 마이홈 창 · 페이지 · 편집 · 스티커 · 방명록 · 스케줄러 · 플레이리스트 · 채팅 · 내 정보가 읽는다.
     친구 홈 구경(myhome-visit.js)에 두면 읽는 모듈이 모두 visit 을 바라보고 visit 도 그 모듈들을 불러 순환이 됐다(sim-dep-cycles).
     처음 값은 맨 아래 myhome-state.js 한 곳 · 읽는 모듈보다 먼저 싣는다 · 바꾸는 곳은 정해진 셋(페이지 불러오기 · 친구 홈 구경 · 편집의 계정 바뀜)뿐.
   ・1절: 처음 값 · 읽는 함수 · 쓰는 함수 · 이름 창구(친구 목록 → 힌트 → «친구») · 서버 모양 맞추기
   ・2절: HTML 순서(미리보기 깃발을 읽는 · 바꾸는 파일 · app.js 보다 먼저) · 바꾸는 곳
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
const SET_WRITERS = ['myhome/myhome-page.js'];                       // mhStateMod.set… 을 직접 부르는 모듈
const SET_GLUE = ['createMyHomeVisit', 'createMyHomeEdit'];          // app.js 가 쓰는 함수를 넘기는 만드는 줄

function build(mod, friends) {
  const win = {};
  const api = new Function('window', 'module', mod + '\nreturn window.TwMyHomeState;')(win, undefined);
  return { win, st: api.createMyHomeState({ _myHomeFriends: () => friends }) };
}
function judge(mod, html, files, app) {
  const r = {};
  try {
    const friends = {};
    const { win, st } = build(mod, friends);
    const d = st._myHomeData();
    r.init = win._mhPreviewMode === false && d && d.bio === '' && d.post === '' && d.stickers && Object.keys(d.stickers).length === 0
      && st._myHomeLoaded() === false && st._myHomeUid() === null && st._mhViewingUserId() === null && st._mhViewingName() === null;
    r.notViewing = st._mhViewingDisplayName() === '';
    st.setMhViewingUserId('u9'); r.fallback = st._mhViewingDisplayName() === '친구';
    st.setMhViewingName('힌트'); r.hint = st._mhViewingDisplayName() === '힌트';
    friends.u9 = { name: '친구목록' }; r.friend = st._mhViewingDisplayName() === '친구목록';
    const nd = { bio: 'b' }; st.setMyHomeData(nd); st.setMyHomeLoaded(true); st.setMyHomeUid('me');
    r.set = st._myHomeData() === nd && st._myHomeLoaded() === true && st._myHomeUid() === 'me';
    const h = st._mhHomeFromServer({ bio: 'x', themePresets: { a: 1 }, themePresetCur: 0 });
    r.fromServer = h.bio === 'x' && h.post === '' && h.themePresets && h.themePresets.a === 1 && h.themePresetCur === 0 && h.stickers && h.bgm === null
      && st._mhHomeFromServer(null).themePresetCur === null;
  } catch (e) { r.err = String(e && e.message || e); }
  const order = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
  const at = order.indexOf('myhome/myhome-state.js'), atApp = order.indexOf('app.js');
  const users = files.filter(([f, t]) => f !== 'myhome/myhome-state.js' && /\b_mhPreviewMode\b/.test(strip(t))).map(([f]) => f);
  r.late = at < 0 ? ['(myhome-state.js 를 안 싣는다)'] : users.filter(f => order.indexOf(f) >= 0 && order.indexOf(f) < at).concat(atApp >= 0 && atApp < at ? ['app.js'] : []);
  r.users = users.length;
  r.previewWriters = files.filter(([f, t]) => !PREVIEW_WRITERS.includes(f) && /window\._mhPreviewMode\s*=[^=]/.test(strip(t))).map(([f]) => f);
  r.setWriters = files.filter(([f, t]) => f !== 'app.js' && !SET_WRITERS.includes(f) && /\bmhStateMod\.set\w+\(/.test(strip(t))).map(([f]) => f);
  /* app.js 의 mhStateMod.set… 은 visit · edit 만드는 줄 안에서만(쓰는 함수로 넘기기) */
  const blocks = SET_GLUE.map(n => { const i = app.indexOf('.' + n + '({'); return i < 0 ? [0, 0] : [i, app.indexOf('\n});', i)]; });
  r.appWriters = [...app.matchAll(/\bmhStateMod\.set\w+\(/g)].filter(m => !blocks.some(([i, j]) => m.index > i && m.index < j)).length;
  r.made = /const mhStateMod = \(typeof TwMyHomeState === 'undefined'\) \? MH_STATE_MOD_OFF : TwMyHomeState\.createMyHomeState\(\{\n  _myHomeFriends: \(\)=>_myHomeFriends,\n\}\);/.test(app)
    && app.indexOf('const mhStateMod =') < app.indexOf('const mhVisitMod =');
  return r;
}

const ORDER = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
const FILES = ORDER.map(f => [f, f === 'app.js' ? APP : read(f)]).filter(([, t]) => t);
const R = judge(MOD, HTML, FILES, APP);

say('── 1. 처음 값 · 읽고 쓰기');
chk(!R.err && R.init, '싣고 만들면 미리보기 깃발 false · 빈 마이홈 데이터 · 안 불러옴 · 계정 · 관람 · 이름 null' + (R.err ? ' — ' + R.err : ''));
chk(R.notViewing && R.fallback && R.hint && R.friend, '이름 창구 — 관람 안 하면 빈 글 · 친구 목록 → 진입 힌트 → «친구» 차례');
chk(R.set, '쓰는 함수로 바꾼 값을 읽는 함수가 그대로 돌려준다(데이터 · 불러옴 · 계정)');
chk(R.fromServer, '서버 모양 맞추기 — 빈 칸 기본값 · 디자인 프리셋(themePresets · themePresetCur)까지 싣는다');

say('── 2. 싣는 순서 · 바꾸는 곳');
chk(FILES.length >= 100, 'HTML 이 싣는 parts/ 파일 ' + FILES.length + '개를 읽었다');
chk(R.users >= 4 && !R.late.length, '미리보기 깃발을 읽는 · 바꾸는 파일 ' + R.users + '개 · app.js 보다 myhome-state.js 를 먼저 싣는다' + (R.late.length ? ' — 먼저 실리는 것: ' + R.late.join(' · ') : ''));
chk(!R.previewWriters.length, '미리보기 깃발을 바꾸는 파일은 myhome-ui · myhome-visit 뿐' + (R.previewWriters.length ? ' — 그 밖: ' + R.previewWriters.join(' · ') : ''));
chk(!R.setWriters.length && R.appWriters === 0, '상태를 바꾸는 곳은 페이지 불러오기(myhome-page.js) · 친구 홈 구경 · 편집(만드는 줄이 쓰는 함수를 넘김)뿐' + (R.setWriters.length ? ' — 그 밖: ' + R.setWriters.join(' · ') : '') + (R.appWriters ? ' — app.js 다른 자리 ' + R.appWriters : ''));
chk(R.made, 'app.js 는 친구 홈 구경보다 먼저 상태 모듈을 만든다(친구 목록은 읽는 함수로)');

say('── 3. 일부러 깨 보기');
const line = '<script src="parts/myhome/myhome-state.js"></script>';
const lateHtml = HTML.indexOf(line) < 0 ? HTML : HTML.replace(line, '').replace('<script src="parts/app.js"></script>', '<script src="parts/app.js"></script>\n' + line);
chk(judge(MOD, lateHtml, FILES, APP).late.length > 0, 'myhome-state.js 를 app.js 뒤로 옮기면 빨강');
chk(!judge(MOD.replace('window._mhPreviewMode = false;', ''), HTML, FILES, APP).init, '미리보기 깃발 처음 값을 빼면 빨강');
chk(!judge(MOD.replace("  if(_mhViewingName) return _mhViewingName;\n", ''), HTML, FILES, APP).hint, '이름 창구에서 진입 힌트를 빼면 빨강');
const extra = FILES.map(([f, t]) => [f, f === 'myhome/guestbook.js' ? t + '\nwindow._mhPreviewMode = true;\nmhStateMod.setMyHomeData({});\n' : t]);
const E = judge(MOD, HTML, extra, APP);
chk(E.previewWriters.includes('myhome/guestbook.js') && E.setWriters.includes('myhome/guestbook.js'), '다른 파일이 깃발 · 상태를 바꾸면 빨강');
chk(judge(MOD, HTML, FILES, APP + '\nmhStateMod.setMyHomeLoaded(false);\n').appWriters > 0, 'app.js 다른 자리에서 상태를 바꾸면 빨강');

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 마이홈 공용 상태는 myhome-state.js 한 곳에서 시작'));
process.exit(fail ? 1 : 0);

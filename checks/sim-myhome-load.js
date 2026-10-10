/* sim-myhome-load.js — 🏠 마이홈 불러오기가 저장한 칸을 빠짐없이 되살리는지
   실행:  node sim-myhome-load.js   (app.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 제보 «[마이홈] 수정 — 제목 바꿨는데 다시 마이홈 수정 눌러보면 1 2 3 으로만 뜹니다».
     👑 디자인 프리셋(themePresets · themePresetCur)은 저장(saveMyHome = 홈 노드 통째 set)에는 실려 갔지만,
     불러오기(loadMyHomePage)가 _myHomeData 를 칸 이름을 하나하나 적어 새로 만들면서 그 둘을 빠뜨렸다.
     그래서 창을 다시 열면 프리셋 이름이 자리 번호(1 2 3)로 돌아가고, 다음 자동 저장이 서버의 프리셋까지 지웠다.
   ★ 무엇을 보는가
     §1 불러오기 두 곳(내 홈 · 친구 홈)이 같은 함수 _mhHomeFromServer 를 쓴다(칸 목록을 따로 적지 않는다)
     §2 app.js 에서 _myHomeData.X = … 로 쓰는 칸이 전부 _mhHomeFromServer 결과에 들어 있다
     §3 저장 → 불러오기 한 바퀴: 프리셋 이름 · 고른 칸이 그대로, 빈 홈은 기본값, 프리셋 표시 이름이 되살아남
     §4 옛 불러오기(프리셋 칸 없음)를 넣으면 §2 · §3 이 빨강이 된다(검사가 실제로 잡는지) */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const APP = read('app.js');
if (!APP) { say('  ? 원본 못 찾음 — app.js'); process.exit(2); }
/* 마이홈 페이지 편집 묶음 · 👑 디자인 스튜디오 · 프리셋은 myhome-edit.js 로 옮겼다(앱 FSD 7-2).
   거기서는 _myHomeData 가 app.js 의 let 을 읽는 함수라 _myHomeData().X 로 쓴다. */
const EDIT = read('myhome-edit.js');
if (!EDIT) { say('  ? 원본 못 찾음 — myhome-edit.js'); process.exit(2); }

/* 이름으로 함수 본문을 중괄호 짝으로 떼어 온다(문자열 속 중괄호는 이 함수들에 없다). */
function fnSrc(src, name){
  const s = src.indexOf('function ' + name + '(');
  if (s < 0) return null;
  let i = src.indexOf('{', s), d = 0;
  for (; i < src.length; i++){ if (src[i] === '{') d++; else if (src[i] === '}'){ d--; if (d === 0) return src.slice(s, i + 1); } }
  return null;
}
const constVal = (src, name) => { const m = src.match(new RegExp('const ' + name + '\\s*=\\s*(\\d+)')); return m ? +m[1] : null; };

/* app.js · myhome-edit.js 에서 _myHomeData 에 쓰는 칸 이름 전부(모듈 쪽은 _myHomeData().X = …) */
const writtenKeys = [...new Set([...(APP + '\n' + EDIT).matchAll(/_myHomeData(?:\(\))?\.([A-Za-z_]\w*)\s*=(?!=)/g)].map(m => m[1]))];

function judge(fromSrc, quiet){
  let bad = 0;
  const c = quiet ? (ok) => { if (!ok) bad++; } : (ok, msg) => { if (!ok) bad++; chk(ok, msg); };
  let from = null;
  try { from = new Function(fromSrc + '\nreturn _mhHomeFromServer;')(); } catch (e) { c(false, '_mhHomeFromServer 평가 실패 — ' + e.message); return bad; }

  if (!quiet) say('§2 쓰는 칸이 불러오기에도 있다 (' + writtenKeys.length + '칸: ' + writtenKeys.join(' · ') + ')');
  const empty = from({});
  writtenKeys.forEach(k => c(Object.prototype.hasOwnProperty.call(empty, k), '불러오기 결과에 «' + k + '» 칸'));

  if (!quiet) say('§3 저장 → 불러오기 한 바퀴');
  const mine = {
    avatar: 'https://x/a.jpg', bio: '안녕', postTitle: '제목', post: '글',
    theme: { tab: '#112233' }, stickers: { s1: { x: 1 } }, bgm: { url: 'u', title: 't' }, bg: { color: '#000000' },
    themePresets: [{ name: '봄', theme: { tab: '#ff0000' }, bg: null }, null, { name: '겨울', theme: {}, bg: { color: '#fff' } }],
    themePresetCur: 2,
  };
  /* 이번 세션에서 꾸민 _myHomeData(mine)가 저장됐다 — saveMyHome 이 JSON 으로 씻어 set 하고,
     RTDB 는 빈 자리 있는 배열을 객체로 돌려준다. 그걸 다시 연 창이 불러온다. */
  const stored = JSON.parse(JSON.stringify(mine));
  stored.themePresets = { 0: stored.themePresets[0], 2: stored.themePresets[2] };
  const back = from(stored);
  Object.keys(mine).forEach(k => c(JSON.stringify(back[k] && k === 'themePresets' ? [back[k][0], back[k][2]] : back[k])
    === JSON.stringify(k === 'themePresets' ? [mine[k][0], mine[k][2]] : mine[k]), '«' + k + '» 가 그대로 돌아온다'));
  /* 다시 저장해도(두 번째 바퀴) 프리셋이 안 지워진다 */
  const again = JSON.parse(JSON.stringify(from(back)));
  c(!!again.themePresets && again.themePresets[2] && again.themePresets[2].name === '겨울', '두 번째 저장에도 프리셋이 남는다');

  /* 디자인 스튜디오가 칸 이름을 그리는 함수를 그대로 떼어 와 돌린다 */
  const presetFns = ['_mhPresets', '_mhPresetCur', '_mhPresetLabel'].map(n => fnSrc(EDIT, n));
  if (presetFns.every(Boolean)){
    const lab = new Function('_myHomeData', 'MH_PRESET_MAX', 'MH_PRESET_NAME_MAX',
      presetFns.join('\n') + '\nreturn { label:_mhPresetLabel, cur:_mhPresetCur };')(() => back, constVal(EDIT, 'MH_PRESET_MAX') || 3, constVal(EDIT, 'MH_PRESET_NAME_MAX') || 8);
    c(lab.label(0) === '봄' && lab.label(1) === '2' && lab.label(2) === '겨울', '★ 다시 연 디자인 스튜디오 프리셋 이름 — 봄 · 2 · 겨울 (지금: ' + [0, 1, 2].map(lab.label).join(' · ') + ')');
    c(lab.cur() === 2, '고른 칸(themePresetCur)이 되살아난다');
  } else c(false, '프리셋 함수(_mhPresets · _mhPresetCur · _mhPresetLabel)를 못 찾음');

  const blank = from(null);
  c(blank.bio === '' && blank.avatar === null && blank.themePresets === null && blank.themePresetCur === null
    && JSON.stringify(blank.stickers) === '{}', '빈 홈은 기본값(프리셋 없음)');
  c(!JSON.stringify(blank).includes('undefined') && Object.values(blank).every(v => v !== undefined), 'undefined 칸 없음(RTDB set 이 거부한다)');
  return bad;
}

say('§1 불러오기 두 곳이 같은 함수를 쓴다');
const FROM = fnSrc(APP, '_mhHomeFromServer');
chk(!!FROM, '_mhHomeFromServer 가 있다');
const LOAD = fnSrc(APP, 'loadMyHomePage'), VISIT = fnSrc(APP, 'openFriendHomeView');
chk(!!LOAD && /_myHomeData\s*=\s*_mhHomeFromServer\(data\)/.test(LOAD), 'loadMyHomePage(내 홈)가 _mhHomeFromServer 로 만든다');
chk(!!VISIT && /_myHomeData\s*=\s*_mhHomeFromServer\(data\)/.test(VISIT), 'openFriendHomeView(친구 홈)가 _mhHomeFromServer 로 만든다');
chk(!/_myHomeData\s*=\s*\{\s*avatar\s*:\s*data\./.test(APP), '칸 이름을 하나하나 적어 data 에서 새로 만드는 곳이 남아 있지 않다');
chk(writtenKeys.includes('themePresets') && writtenKeys.includes('themePresetCur'), '프리셋 칸을 쓰는 곳을 찾았다(§2 가 헛돌지 않게)');

if (FROM) judge(FROM, false);

say('§4 옛 불러오기(프리셋 칸 없음)를 넣으면 빨강');
const OLD = "function _mhHomeFromServer(data){ data = data || {};\n  return { avatar:data.avatar||null, bio:data.bio||'', postTitle:data.postTitle||'', post:data.post||'',\n    theme:data.theme||null, stickers:data.stickers||{}, bgm:data.bgm||null, bg:data.bg||null }; }";
const oldBad = judge(OLD, true);
chk(oldBad >= 3, '옛 판은 빨강 ' + oldBad + '건 (프리셋 칸 둘 · 왕복 · 이름 표시)');

say('');
say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — 다시 열어도 프리셋 이름 · 고른 칸이 그대로, 다음 저장이 지우지 않는다');
process.exit(fail ? 1 : 0);

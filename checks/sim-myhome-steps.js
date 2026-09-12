/* sim-myhome-steps.js — 🏠 마이홈 열기·닫기가 한 칸의 사고로 무너지지 않는가
   실행:  node sim-myhome-steps.js   (app.js · mallang.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 제보: "친구창·우편함을 정리했는데 **말랑이 폴더**가 안 보인다."
     정체는 말랑이가 아니었다. `open()` 이 이렇게 생겨 있었다:
         renderMyHomeFriendList();      ← 맨몸. 끝에서 renderInbox() 를 부른다
         loadMyHomePage();              ← 맨몸
         myHomeOpen = true; …
         window._mallangOnOpen(…)       ← 맨 끝
     **우편함 렌더가 던지면 open() 이 거기서 멈추고 뒤가 통째로 안 돈다.** 그중 눈에 보이는 것이
     말랑이 폴더 하나뿐이라, 손댄 곳(친구창)과 증상이 난 곳(말랑이)이 달라서 엉뚱한 파일을 뒤졌다.

   ★ 닫기는 더 위험했다 — `_mallangOnClose()` 가 `commitMyHomePage(true)` **앞**에 맨몸으로 있었다.
     말랑이 정리가 한 번 던지면 **마이홈 마지막 저장이 통째로 건너뛰어진다**(편집한 것이 조용히 사라진다).
     그래서 닫기는 순서까지 바꿨다: **저장이 맨 먼저다.**

   ★ 이 파일이 지키는 것은 기능이 아니라 **격리**다.
     "앞 칸이 죽어도 뒤 칸이 돈다" · "저장이 정리보다 먼저다" · "async 훅은 .catch 로 받는다".
     기능 검사가 아니므로 무엇이 그려지는지는 안 본다.

   ⚠ 실제 화면은 여기서 못 본다. 콘솔의 `[마이홈 열기] … 실패` / `[말랑이] 폴더 …` 줄이 눈으로 볼 단서다. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');
const ML  = fs.readFileSync('mallang.js', 'utf8');
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* open()/close() 는 함수 선언이 아니라 `const open=()=>{…}` 다 — 중괄호 짝맞추기로 떼어낸다. */
function cutArrow(name){
  const i = SRC.indexOf('const ' + name + '=()=>{');
  if (i < 0) throw new Error(name + ' 를 못 찾음');
  let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++){
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}'){ d--; if (d === 0) return SRC.slice(i, k + 1); }
  }
  throw new Error(name + ' 의 끝을 못 찾음');
}
const OPEN  = cutArrow('open');
const CLOSE = cutArrow('close');

say('=== 🏠 마이홈 열기·닫기 격리 검사 ===');
say('');

/* ── §1. 열기 ────────────────────────────────────────────────────── */
say('· §1 열기 — 앞 칸이 죽어도 말랑이까지 도달하는가');

chk(/const\s+_step\s*=/.test(OPEN), '칸을 감싸는 _step 이 있다');
chk(/_step\([\s\S]{0,40}renderMyHomeFriendList/.test(OPEN),
    '★ 친구 목록이 감싸져 있다 — 여기서 던져도 열기가 멈추지 않는다');
chk(/_step\([\s\S]{0,40}loadMyHomePage/.test(OPEN),
    '★ 마이홈 페이지 로드가 감싸져 있다');
/* 맨몸 호출이 되돌아왔는지 — 줄 앞에 _step 없이 바로 부르는 형태를 잡는다 */
chk(!/^\s*renderMyHomeFriendList\(\)/m.test(OPEN),
    '   맨몸 renderMyHomeFriendList() 가 되돌아오지 않았다');
chk(/console\.error\([^)]*마이홈 열기/.test(OPEN),
    '★ 죽은 칸을 콘솔에 남긴다 — 다음 제보 때 첫 단서가 된다');

/* async 훅은 try/catch 로 안 잡힌다 — 반환된 Promise 를 받아야 한다 */
chk(/Promise\.resolve\(\s*window\._mallangOnOpen/.test(OPEN),
    '★ _mallangOnOpen 은 async 다 — Promise 를 .catch 로 받는다(try/catch 로는 못 잡는다)');
chk(/_mallangOnOpen[\s\S]{0,300}\.catch\(/.test(OPEN), '   그 .catch 가 실제로 붙어 있다');
chk(/mallang\.js/.test(OPEN),
    '   훅이 아예 없을 때(스크립트 미로드)도 안내한다');

say('');

/* ── §2. 닫기 ────────────────────────────────────────────────────── */
say('· §2 닫기 — 저장이 정리에 인질로 잡히지 않는가');

/* ⚠️ 순서를 indexOf 로 볼 때 **주석을 먼저 지운다.** 위 머리말이 `_mallangOnClose` 를
   경위 설명으로 언급하고 있어서, 안 지우면 그 주석을 '호출 자리'로 착각해 순서가 뒤집혀 보인다
   (이 검사를 처음 돌렸을 때 실제로 그렇게 잡혔다). */
const CLOSE_CODE = CLOSE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const iSave  = CLOSE_CODE.indexOf('commitMyHomePage');
const iMl    = CLOSE_CODE.indexOf('_mallangOnClose');
const iOff   = CLOSE_CODE.indexOf("overlay.classList.remove('on')");
chk(iSave > -1 && iMl > -1 && iSave < iMl,
    '★ 마지막 저장이 말랑이 정리보다 **먼저**다 — 정리가 던져도 편집분이 남는다');
chk(iOff > -1 && iOff < iMl,
    '★ 창 닫기도 정리보다 먼저다 — 정리가 던져도 창이 남지 않는다');
chk(/_step\([\s\S]{0,40}commitMyHomePage/.test(CLOSE), '저장도 감싸져 있다 — 저장 실패가 창을 못 닫게 하지 않는다');
chk(/_step\([\s\S]{0,40}_mallangOnClose/.test(CLOSE), '말랑이 정리가 감싸져 있다');
chk(/console\.error\([^)]*마이홈 닫기/.test(CLOSE), '죽은 칸을 콘솔에 남긴다');

say('');

/* ── §3. 관람모드 훅 — 두 파일이 나란히 서는 자리 ───────────────── */
say('· §3 관람모드 — 서로 다른 파일의 훅이 서로를 굶기지 않는가');

const VISIT = (()=>{
  const i = SRC.indexOf('function _mhApplyVisitUI(');
  let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++){
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}'){ d--; if (d === 0) return SRC.slice(i, k + 1); }
  }
  throw new Error('_mhApplyVisitUI 의 끝을 못 찾음');
})();
chk(/try\{[\s\S]{0,160}_advApplyVisitUI/.test(VISIT),
    '★ 바탕화면 훅(myhome-desktop.js)이 감싸져 있다 — 던져도 말랑이 재판정이 돈다');
chk(/try\{[\s\S]{0,200}_mallangApplyVisit/.test(VISIT), '★ 말랑이 훅(mallang.js)도 감싸져 있다');
chk(/Promise\.resolve\(\s*window\._mallangApplyVisit/.test(VISIT),
    '   이쪽도 async 라 Promise 로 받는다');

say('');

/* ── §4. 진단 — 폴더가 안 뜨는 이유를 말해주는가 ─────────────────── */
say('· §4 진단 — "폴더가 안 보인다"를 한 줄로 가를 수 있는가');

chk(/\[말랑이\] 폴더/.test(ML),
    '★ mallang.js 가 폴더 표시/숨김과 그 이유를 콘솔에 남긴다');
chk(/라이선스/.test(ML) && /이미지/.test(ML),
    '   내 집(라이선스)과 방문(이미지 수)을 갈라서 말한다 — 숨는 길이 둘이다');
chk(/mhRoomPreview 를 못 찾음|mhRoomPreview/.test(ML),
    '   붙일 자리(#mhRoomPreview)를 못 찾은 경우도 구분한다');
/* 판정식 자체는 바뀌지 않았다 — 진단이 동작을 바꿨다면 그게 더 큰 사고다 */
chk(/wantFolder\s*=\s*visiting\s*\?\s*\(imgs\.length>0\)\s*:\s*hasLicense\(\)/.test(ML),
    '★ 판정식은 예전 그대로다 — 진단을 넣으면서 동작을 바꾸지 않았다');

say('');
if (fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('전부 통과 ✅ — 한 칸이 죽어도 마이홈은 열리고 닫히고, 저장이 먼저다');
process.exit(0);

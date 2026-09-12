/* sim-win-layers.js — 🪟 창 앞뒤(z)와 자동 닫힘 규약 검사
   실행:  node sim-win-layers.js   (app.js · desk-companion-prototype.html 과 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 제보 다섯 개가 전부 **같은 뿌리** 하나였다.
     "창끼리의 앞뒤와 여닫힘이 CSS 에 박힌 숫자와 '한 번에 하나만' 규칙으로만 정해져 있었다."
       · 채팅창(82)이 꾸미기창(54) 위라 꾸미기가 뒤에 깔렸다
       · 설정(58)·채팅(82)·플레이리스트(칩 55)는 눌러도 앞뒤가 안 바뀌었다
       · ▼ 드롭메뉴를 열면 음악창이 닫혔다
       · 옆 창을 누르면 설정창이 닫혔다
     그래서 이 검사가 지키는 것은 **숫자 하나하나가 아니라 층의 순서**다.

   ★ 이 파일이 막는 사고 — 이 규약은 **두 파일에 나뉘어 있다.**
     창 층(83~92)은 app.js 의 상수이고, 꾸미기창(93)은 HTML 의 CSS 값이다.
     한쪽만 고치면 그 순간 조용히 어긋난다(꾸미기가 다시 뒤로 가거나, 창이 가챠 위로 튀어나온다).
     §1 이 두 파일을 **맞대어** 본다. 이게 이 파일의 존재 이유다.

   ★ 무엇을 보는가
     §1 소스 대조 — 층의 순서(채팅 기본 < 창 층 < 꾸미기 < 가챠) · 세 창이 열 때 앞으로 나오는가 ·
        옛 :has() 내리기 규칙이 되살아나지 않았는가
     §2 런타임 — bringWinToFront 를 떼어내 실제로 눌러 본다(맨 앞·천장·순서 보존)
     §3 자동 닫힘 — _closeChipPopups 를 떼어내 "드롭메뉴를 열어도 음악창은 그대로"를 확인

   ⚠ 실제 화면의 겹침은 여기서 못 본다 — 그건 눈으로 볼 것. 여기서 지키는 것은 규약뿐이다. */
'use strict';
const fs = require('fs');
const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

function cut(name){
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) throw new Error(name + ' 를 못 찾음');
  let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++){
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}'){ d--; if (d === 0) return SRC.slice(i, k + 1); }
  }
  throw new Error(name + ' 의 끝을 못 찾음');
}
/* CSS 규칙 하나에서 z-index 를 읽는다. 셀렉터가 여러 줄에 걸쳐 있어도 블록 안만 본다. */
function cssZ(sel){
  const i = HTML.indexOf(sel + '{');
  if (i < 0) return null;
  const j = HTML.indexOf('}', i);
  const m = /z-index:\s*(\d+)/.exec(HTML.slice(i, j));
  return m ? +m[1] : null;
}

say('=== 🪟 창 앞뒤(z)·자동 닫힘 규약 검사 ===');
say('');

/* ── §1. 소스 대조 ───────────────────────────────────────────────── */
say('· §1 소스 대조 — app.js 의 층과 HTML 의 층이 맞물리는가');

const Z_MIN = +(/const\s+WIN_Z_MIN\s*=\s*(\d+)/.exec(SRC) || [])[1];
const Z_MAX = +(/WIN_Z_MAX\s*=\s*(\d+)/.exec(SRC) || [])[1];
chk(isFinite(Z_MIN) && isFinite(Z_MAX) && Z_MIN <= Z_MAX,
    '창 층을 읽었다 (' + Z_MIN + '~' + Z_MAX + ')');

const zChat = cssZ('#chatOverlay');
const zWard = cssZ('#wardrobePanel');
const zPrev = cssZ('#wdPreviewPanel');
const zChip = cssZ('#myStatusChip');

chk(zChat === Z_MIN - 1,
    '★ 창 층의 시작이 채팅창 기본값 바로 위다 (채팅 ' + zChat + ' → 첫 raise ' + Z_MIN + ')');
chk(zWard === zPrev, '꾸미기 패널과 미리보기가 같은 층이다 (' + zWard + ' · ' + zPrev + ')');
chk(zWard > Z_MAX,
    '★ 꾸미기창이 창 층보다 위다 (' + zWard + ' > ' + Z_MAX + ') — 셋 중 무엇을 눌러도 못 넘는다');
chk(zChip < Z_MIN,
    '상태칩 기본값은 창 층 아래다 (' + zChip + ') — 눌러야 올라온다');

/* 위층은 그대로 남아야 한다 — 창을 올리다 가챠·모달을 덮으면 그게 다음 제보가 된다. */
[['.gacha-ov', '가챠'], ['.idesk-ov', '아이템 책상'], ['#mhPromptOverlay', '마이홈 팝업']].forEach(([sel, name]) => {
  const z = cssZ(sel);
  chk(z != null && z > zWard, name + '(' + z + ')은 여전히 꾸미기창 위다 — 창 층이 침범하지 않았다');
});

/* 옛 해법이 되살아나면 인라인 z 와 싸운다(플레이리스트가 앞으로 안 나온다) */
chk(!/#wdPreviewPanel\.on\)\s*#myStatusChip/.test(HTML) && !/#wardrobePanel\.on\)\s*#myStatusChip/.test(HTML),
    '★ 옛 :has() 상태칩 내리기 규칙이 없다 — 있으면 인라인 z 와 서로 덮어쓴다');

/* 세 창이 '열 때' 앞으로 나오는가 — 클릭만 처리하면 "열었는데 안 보인다"가 남는다 */
chk(/bringWinToFront\('chatOverlay'\)/.test(cut('openChatWindow')),
    '★ 대화창은 열 때 맨 앞으로 나온다');
chk(/bringWinToFront\('myStatusChip'\)/.test(SRC), '★ 플레이리스트는 열 때 맨 앞으로 나온다(칩째)');
chk(/bringWinToFront\('focusSettingsPanel'\)/.test(SRC), '★ 설정창은 열 때 맨 앞으로 나온다');
chk(/addEventListener\('pointerdown'[\s\S]{0,400}?bringWinToFront/.test(SRC),
    '★ 누를 때도 올라온다 — pointerdown 캡처로 잡는다(버튼이 전파를 끊어도 지나간다)');

/* 💬 토글 — 열려 있으면 닫는다 */
chk(/_chatWindowIsOpen\(\)[\s\S]{0,120}closeChatWindow\(\)/.test(SRC),
    '★ 💬 버튼이 토글이다 — 열려 있으면 닫는다');

/* 설정창 바깥클릭 예외 */
{
  const fs_ = /FS_KEEP_OPEN_SEL\s*=\s*\[([\s\S]*?)\]/.exec(SRC);
  chk(!!fs_, '설정창의 "닫지 않을 창" 목록이 있다');
  if (fs_){
    ['#myStatusChip', '#chatOverlay', '#wardrobePanel'].forEach(s => {
      chk(fs_[1].includes(s), '   ' + s + ' 위의 클릭으로는 설정창이 안 닫힌다');
    });
  }
}

say('');

/* ── §2. 런타임 — 창 앞뒤 ────────────────────────────────────────── */
say('· §2 런타임 — 떼어낸 bringWinToFront 를 실제로 눌러 본다');

const zSrc = SRC.slice(SRC.indexOf('const WIN_Z_MIN'), SRC.indexOf('function bringWinToFront') + cut('bringWinToFront').length);
const els = {
  chatOverlay:        { style:{} },
  focusSettingsPanel: { style:{} },
  myStatusChip:       { style:{} },
};
const bringWinToFront = new Function('document',
  zSrc + '\n;return bringWinToFront;')({ getElementById: id => els[id] || null });

const zOf = id => parseInt(els[id].style.zIndex, 10) || 0;

bringWinToFront('focusSettingsPanel');
chk(zOf('focusSettingsPanel') === Z_MIN,
    '★ 처음 누른 창이 채팅 기본값 위로 온다 (' + zOf('focusSettingsPanel') + ')');
bringWinToFront('myStatusChip');
chk(zOf('myStatusChip') > zOf('focusSettingsPanel'), '★ 그 다음에 누른 창이 그 위로 온다');
bringWinToFront('chatOverlay');
chk(zOf('chatOverlay') > zOf('myStatusChip'), '★ 셋째도 마찬가지 — 누른 순서가 곧 앞뒤다');

// 이미 맨 앞인 것을 또 눌러도 번호가 낭비되지 않는다(천장이 금방 오는 걸 막는다)
{
  const before = zOf('chatOverlay');
  bringWinToFront('chatOverlay');
  chk(zOf('chatOverlay') === before, '이미 맨 앞이면 번호를 안 쓴다 (' + before + ')');
}

// 천장 — 번갈아 눌러도 절대 창 층 밖으로 안 나간다. 그리고 앞뒤 순서는 보존된다.
{
  const seq = ['chatOverlay', 'myStatusChip', 'focusSettingsPanel'];
  for (let i = 0; i < 60; i++) bringWinToFront(seq[i % 3]);
  const zs = Object.keys(els).map(k => zOf(k));
  chk(Math.max(...zs) <= Z_MAX,
      '★ 60번을 눌러도 천장(' + Z_MAX + ')을 안 넘는다 (최대 ' + Math.max(...zs) + ') — 가챠·모달을 안 덮는다');
  chk(Math.min(...zs) >= Z_MIN, '   바닥(' + Z_MIN + ') 아래로도 안 내려간다 (최소 ' + Math.min(...zs) + ')');
  chk(new Set(zs).size === 3, '   세 창의 번호가 서로 겹치지 않는다 (' + zs.join(', ') + ')');
  // 마지막으로 누른 것이 여전히 맨 앞이어야 한다 — 재정렬이 순서를 뒤집으면 안 된다
  const last = seq[(60 - 1) % 3];
  chk(zOf(last) === Math.max(...zs), '★ 재정렬을 거쳐도 마지막에 누른 창이 맨 앞이다 (' + last + ')');
}

chk((() => { try{ bringWinToFront('없는창'); return true; }catch(_){ return false; } })(),
    '없는 id 를 불러도 안 죽는다 (창이 아직 안 그려진 프레임)');

say('');

/* ── §3. 런타임 — 자동 닫힘 ─────────────────────────────────────── */
say('· §3 런타임 — 드롭메뉴를 열어도 음악창은 그대로인가');

const boxes = {};
const mkBox = () => ({ hidden:true, style:{},
  classList:{ add(c){ if(c==='hidden') this._o.hidden = true; },
              remove(){}, } });
function fakeDoc(){
  const ids = ['myStatusMenu','myChipMore','myChatBox','myCustomStatusBox','bellWin','myDemojiBox','myPlaylistBox',
               'myStatusChipBtn','myChipMoreBtn','myChatBtn','myCustomStatusBtn','myBellBtn','myDemojiBtn','myPlBtn'];
  ids.forEach(id => {
    const o = { style:{}, hidden:false, on:true };
    o.classList = { add:c => { if(c==='hidden') o.hidden = true; }, remove:c => { if(c==='on') o.on = false; } };
    boxes[id] = o;
  });
  return { getElementById: id => boxes[id] || null };
}
const closeChipPopups = new Function('document', 'userStatus',
  SRC.slice(SRC.indexOf('const _CHIP_POPUPS'), SRC.indexOf('function _closeChipPopups') + cut('_closeChipPopups').length)
  + '\n;return _closeChipPopups;')(fakeDoc(), 'online');

// ▼ 더보기(드롭메뉴)를 여는 상황 — 음악창은 살아 있어야 한다
closeChipPopups('myChipMore');
chk(boxes.myPlaylistBox.hidden === false,
    '★ ▼ 드롭메뉴를 열어도 🎵 플레이리스트는 안 닫힌다 — 제보 그 자리');
chk(boxes.myPlaylistBox.on === true, '   🎵 버튼의 눌림 표시도 그대로다');
chk(boxes.myStatusMenu.hidden === true, '   지나가는 메뉴(상태 메뉴)는 예전처럼 닫힌다');
chk(boxes.myDemojiBox.hidden === true, '   😊 이모티콘 팔레트도 예전처럼 닫힌다');

// 오피스 숨김만은 전부 닫는다 — 안 닫으면 유튜브 자식창이 숨긴 화면에 남는다
closeChipPopups(null, true);
chk(boxes.myPlaylistBox.hidden === true,
    '★ force=true(오피스 숨김)에서는 음악창도 닫힌다 — 재생 창이 남지 않는다');
chk(/_closeChipPopups\(null,\s*true\)/.test(SRC), '   그리고 그 자리가 실제로 force 로 부른다');

say('');
if (fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('전부 통과 ✅ — 누른 창이 앞으로 오고, 꾸미기창은 그 위에 남고, 음악창은 드롭메뉴에 안 닫힌다');
say('⚠ 실제 겹침은 눈으로 볼 것 — 설정·채팅·플레이리스트를 다 열고 번갈아 눌러 보면 된다');
process.exit(0);

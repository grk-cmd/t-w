/* sim-chip-chat-ui.js — ✨▁ 상태칩 정리 · 대화창 최소화 검사
   실행:  node sim-chip-chat-ui.js   (app.js · desk-companion-prototype.html 과 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 이번 변경 둘 다 **"기존 규칙이 새 요소를 잘못 집어가는"** 종류의
     사고를 안고 있다. 실제로 만들면서 두 번 밟았다:

       ① `#myStatusMenu .stItem` 을 전부 도는 코드가 두 곳 있는데, ✨ 항목에는 data-st 가 없다.
          거르지 않으면 `(b.dataset.st||'') === (userStatus||'')` 가 **''===''** 로 참이 되어
          '온라인'과 ✨ 두 줄에 ● 표식이 붙고, 클릭 핸들러는 setUserStatus(null) 을 불러
          **상태가 조용히 풀린다.**
       ② 대화창 크기는 px 로 저장된다. 최소화한 높이가 저장되면 다음에 열 때 그 높이로 복원돼
          **펼쳐도 메시지 영역이 없는 창**이 뜬다.

   ★ 무엇을 보는가 — 마크업·CSS·소스 대조 (런타임 DOM 은 보지 않는다)
     §1 ✨ 커스텀 상태가 드롭다운으로 갔는가 · 칩 전용 스타일에서 빠졌는가 · 두 핸들러가 거르는가
     §2 대화창 최소화 — 버튼이 있는가 · 접었을 때 남길 것만 남는가 · 높이·드래그·닫기 처리가 짝을 이루는가

   ⚠ 눈으로 볼 것은 따로 있다(핸드오프 7절). 여기서 지키는 건 규약뿐이다. */
'use strict';
const fs = require('fs');
const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

say('=== ✨▁ 상태칩 정리 · 대화창 최소화 ===');
say('');

/* ── §1. ✨ 커스텀 상태 ──────────────────────────────────────────── */
say('· §1 ✨ 커스텀 상태가 상태 드롭다운 안으로');

const chipGroup = (HTML.match(/<div id="myChipGroup">[\s\S]*?<\/div>/) || [''])[0];
const statusMenu = (HTML.match(/<div id="myStatusMenu"[\s\S]*?\n  <\/div>/) || [''])[0];
chk(chipGroup.length > 0 && statusMenu.length > 0, '칩 그룹·상태 메뉴 블록을 찾았다');

chk(!/id="myCustomStatusBtn"/.test(chipGroup), '★ 칩 그룹에서 빠졌다 (칩 줄이 한 칸 줄었다)');
chk(/id="myCustomStatusBtn"/.test(statusMenu), '★ 상태 드롭다운 안에 있다');

const item = (HTML.match(/<button class="stItem" id="myCustomStatusBtn"[\s\S]*?<\/button>/) || [''])[0];
chk(item.length > 0, '항목을 찾았다');
chk(!/data-st=/.test(item), '★ data-st 가 없다 (있으면 상태 목록 클릭이 먼저 집어간다)');
chk(/class="csEmo"/.test(item) && /class="csLabel"/.test(item),
    '이모지·글자 자리가 따로 있다 (textContent 로 통째로 갈아치우지 않는다)');

// 두 곳이 data-st 없는 항목을 거르는가 — ①의 사고 지점
chk(/querySelectorAll\('#myStatusMenu \.stItem\[data-st\]'\)/.test(SRC),
    "★ ● 표식 루프가 [data-st] 로 좁혀져 있다 (안 그러면 '온라인'과 같이 켜진다)");
const menuClick = (SRC.match(/menu\.addEventListener\('click'[\s\S]*?\n  \}\);/) || [''])[0];
chk(/hasAttribute\('data-st'\)/.test(menuClick),
    '★ 상태 목록 클릭 핸들러가 data-st 없는 항목을 되돌려보낸다 (setUserStatus(null) 사고 방지)');

// 칩 전용 스타일에서 빠졌는가 — 남아 있으면 메뉴 안에서 28x26 네모 버튼으로 뜬다
const chipRules = (HTML.match(/#myChatBtn[^{}]*\{/g) || []).join('\n');
chk(!/#myCustomStatusBtn/.test(chipRules),
    '★ 칩 버튼 공용 CSS 선택자에서 빠졌다 (' + (HTML.match(/#myChatBtn[^{}]*\{/g) || []).length + '개 규칙)');
chk(!/bubble"\]\s*#myCustomStatusBtn/.test(HTML), '버블 테마의 칩 버튼 목록에서도 빠졌다');
chk(/#myStatusMenu \.stItem \.csEmo\{/.test(HTML), '메뉴 항목용 이모지 자리 규칙이 있다');
chk(/#myStatusMenu \.stItem\.on::before\{/.test(HTML),
    "'지금 이 상태를 쓰는 중'(.on) 표식 규칙이 있다 — 칩에서 쓰던 눌린 표시를 대신한다");

// id 는 그대로여야 한다 — 여닫기·바깥클릭 예외·_CHIP_POPUPS 가 전부 이 id 로 잡는다
chk(/\{ box:'myCustomStatusBox', btn:'myCustomStatusBtn' \}/.test(SRC), '_CHIP_POPUPS 항목이 그대로다');
chk(/closest\('#myCustomStatusBtn'\)/.test(SRC), '바깥 클릭 닫기 예외가 그대로다');

say('');

/* ── §2. 대화창 최소화 ───────────────────────────────────────────── */
say('· §2 대화창 최소화 — 입력칸과 😊🎲💣 만 남기기');

const titlebar = (HTML.match(/<div class="chat-titlebar">[\s\S]*?<\/div>/) || [''])[0];
chk(/id="chatMinBtn"/.test(titlebar), '★ 타이틀바에 최소화 버튼이 있다');
chk(titlebar.indexOf('chatMinBtn') < titlebar.indexOf('chatCloseBtn'), '   닫기 왼쪽에 있다');

// 접었을 때 감추는 것 넷 — 하나라도 빠지면 그 줄만 덩그러니 남는다
['chat-menubar', 'chat-memberbar', 'chat-messages', 'chat-profile'].forEach(c => {
  chk(new RegExp('#chatWindow\\.min[^{]*\\.' + c).test(HTML), '접으면 .' + c + ' 가 숨는다');
});
// 남겨야 하는 것 — 이게 숨으면 최소화의 의미가 없다
chk(!/#chatWindow\.min[^{]*\.chat-inputrow[^{]*\{[^}]*display\s*:\s*none/.test(HTML),
    '★ 입력줄(.chat-inputrow)은 남는다');
chk(!/#chatWindow\.min[^{]*\.chat-toolbar[^{]*\{[^}]*display\s*:\s*none/.test(HTML),
    '★ 😊🎲💣 줄(.chat-toolbar)도 남는다');
chk(/#chatWindow\.min\{[^}]*height:auto !important[^}]*min-height:0/.test(HTML),
    '★ 접으면 높이가 풀린다 (인라인 height 와 min-height 를 둘 다 이겨야 한다)');
chk(/#chatWindow\.min .chat-rz\.n,/.test(HTML), '세로 리사이즈 손잡이는 접는 동안 숨는다');

// ②의 사고 지점 — 최소화 높이가 저장되면 다음에 찌그러진 창이 뜬다
const savePos = (SRC.match(/function _saveChatWinPos\(\)[\s\S]*?\n\}/) || [''])[0];
chk(/_chatIsMinimized\(\)\s*&&\s*_chatPreMinH/.test(savePos),
    '★ 저장 높이가 접기 전 높이다 (지금 높이를 저장하면 다음에 메시지 영역 없는 창이 뜬다)');

const close = (SRC.match(/function closeChatWindow\(\)[\s\S]*?\n\}/) || [''])[0];
chk(/_setChatMinimized\(false\)/.test(close),
    '★ 창을 닫으면 최소화가 풀린다 (안 풀면 다음에 입력칸만 뜨고 "채팅창이 사라졌다"가 된다)');

chk(/#chatCloseBtn, #chatMinBtn, #chatOpacity/.test(SRC),
    '최소화 버튼이 타이틀바 드래그 예외에 들어 있다 (누를 때 창이 안 따라온다)');

// 접혀 있는 동안의 알림 — 메시지가 안 보이니 뱃지가 유일한 통로다
chk(/function _syncChatMinBadge\(\)/.test(SRC), '접힌 동안 새 메시지를 세는 함수가 있다');
const render = (SRC.match(/function _renderChatLog\(list\)[\s\S]*?\n\}/) || [''])[0];
chk(/_syncChatMinBadge\(\)/.test(render), '★ 렌더 끝에서 그 뱃지를 갱신한다');
const syncSub = (SRC.match(/function _syncChatBadgeSub\([\s\S]*?\n\}/) || [''])[0];
chk(/_chatWindowIsOpen\(\) && _chatIsMinimized\(\)/.test(syncSub),
    '★ 매 프레임 도는 뱃지 정리가 접힌 동안의 뱃지를 0 으로 지우지 않는다');

say('');
if (fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('전부 통과 ✅ — 새 요소가 옛 규칙에 잘못 집히지 않는다');
process.exit(0);

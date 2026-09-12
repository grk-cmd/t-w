/* sim-chat-log-persist.js — 💬 방이 비어도 대화 기록이 남는가
   실행:  node sim-chat-log-persist.js   (app.js · desk-companion-prototype.html 과 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 제보: **"재부팅하면 모두가 처음으로 돌아간다."**
     정체는 입장 컷(app.js `tw_chat_join:`)이 아니라 **서버 기록이 지워지고 있던 것**이었다.
     `rooms/{방}/chatLog` 를 지우는 자리가 둘이었고, 둘 다 "살아있는 멤버가 없으면"이 조건이라
     다 같이 앱을 껐다 켜는 순간(= 아무도 안 남은 순간) 기록이 통째로 날아갔다:
       ① 입장 첫 스냅샷 청소 — **재부팅 직후 첫 사람**이 정확히 여기를 지난다
       ② 마지막 퇴장 청소 — `_finalCleanup`

   ★ 이 검사가 지키는 것 — 셋이 한 묶음이다. 하나만 어긋나도 제보가 그대로 돌아온다.
     §1 두 청소 자리가 chatLog 를 안 지운다 (플래그 한 곳으로 묶여 있다)
     §2 _meta · roomIndex 삭제는 **살아 있다** — 그게 죽으면 유령 방·채널 오염이 돌아온다
     §3 기록만 남은 방은 여전히 '빈 방'이다 (인원 세는 곳이 chatLog 를 멤버로 안 센다)
     §4 '처음 입장한 사람은 이전 기록을 못 본다'는 규칙이 **localStorage 에** 남아 있다
        — 기록을 지우는 것으로 대신하고 있었으므로, 지금부터는 이쪽이 유일한 담당이다

   ⚠ 소스 대조만 한다(런타임 RTDB 는 안 본다). 눈으로 볼 것은 핸드오프의 확인표에 있다. */
'use strict';
const fs = require('fs');
const SRC  = fs.readFileSync('app.js', 'utf8');
/* 🔒 CSP(3절) — 예전엔 firebase 초기화가 HTML 안의 인라인 모듈이었다. `script-src` 에서
   'unsafe-inline' 을 버리려고 `parts/firebase-init.js` 로 뺐다. 이 검사는 chatLog 보존 상수를
   **HTML 안에서** 찾으므로, 파일이 있으면 이어 붙여 외부화 전과 같은 시야를 만든다.
   ⚠️ 이 검사가 갑자기 "상수가 없다"고 하면 코드가 아니라 **이 두 줄**을 먼저 볼 것. */
let HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
for (const c of ['firebase-init.js', 'parts/firebase-init.js']) {
  if (fs.existsSync(c)) { HTML += '\n' + fs.readFileSync(c, 'utf8'); break; }
}
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  \u2713 ' : '  \u2717 ') + m); if (!c) fail++; };

say('=== 방이 비어도 대화 기록이 남는가 ===');
say('');

/* ── §1. 지우는 자리 둘 ─────────────────────────────────────────── */
say('· §1 chatLog 를 지우던 두 자리');

const flagDecl = /const\s+KEEP_CHAT_LOG_ON_EMPTY\s*=\s*(true|false)\s*;/.exec(HTML);
chk(!!flagDecl, '보존 여부가 상수 하나로 묶여 있다 (KEEP_CHAT_LOG_ON_EMPTY — 한 줄로 뒤집는 자리)');
chk(!!flagDecl && flagDecl[1] === 'true', '\u2605 지금 켜져 있다 (false 면 제보가 그대로 돌아온다)');
chk((HTML.match(/KEEP_CHAT_LOG_ON_EMPTY/g) || []).length >= 3,
    '두 청소 자리가 **같은** 상수를 읽는다 (한쪽만 고치면 나머지 한쪽이 계속 지운다)');

// 모든 chatLog 삭제 호출이 플래그 뒤에 있는가 — 조건 없는 삭제가 하나라도 남으면 실패
const delLines = HTML.split('\n')
  .map((l, i) => ({ n: i + 1, l }))
  .filter(o => /remove\(ref\(db,\s*`rooms\/\$\{[^`]*\}\/chatLog`\)\)/.test(o.l));
chk(delLines.length === 2, 'chatLog 를 지우는 자리는 둘 그대로다 (찾은 수: ' + delLines.length + ')');
delLines.forEach(o => {
  chk(/KEEP_CHAT_LOG_ON_EMPTY/.test(o.l) || /if\s*\(\s*!KEEP_CHAT_LOG_ON_EMPTY/.test(o.l)
      || /!_otherAlive && !KEEP_CHAT_LOG_ON_EMPTY/.test(HTML.split('\n')[o.n - 3] || '')
      || /KEEP_CHAT_LOG_ON_EMPTY/.test(HTML.split('\n').slice(Math.max(0, o.n - 4), o.n).join('\n')),
      '\u2605 ' + o.n + '행의 삭제가 플래그 뒤에 있다');
});

// ①의 자리 — 재부팅 직후 첫 사람이 지난다. 여기가 뚫리면 매 부팅마다 날아간다.
chk(/if\(!_otherAlive && !KEEP_CHAT_LOG_ON_EMPTY\)/.test(HTML),
    '\u2605 입장 첫 스냅샷 청소가 막혀 있다 (재부팅 직후 첫 사람이 지나는 자리)');
// ②의 자리 — 마지막 퇴장
chk(/!KEEP_CHAT_LOG_ON_EMPTY && keys && keys\.chatLog/.test(HTML),
    '\u2605 마지막 퇴장 청소(_finalCleanup)가 막혀 있다');

say('');

/* ── §2. 같이 지우면 안 되는 것 / 계속 지워야 하는 것 ───────────── */
say('· §2 _meta · roomIndex 는 그대로 지운다');

const finalCleanup = (HTML.match(/const _finalCleanup = async \(keys\)=>\{[\s\S]*?\};/) || [''])[0];
chk(finalCleanup.length > 0, '_finalCleanup 블록을 찾았다');
chk(/rooms\/\$\{roomCodeForCleanup\}\/_meta/.test(finalCleanup) && !/KEEP_CHAT_LOG_ON_EMPTY[\s\S]*_meta`/.test(finalCleanup),
    '\u2605 _meta 삭제는 조건 없이 남아 있다 (안 지우면 다음 사람이 남의 채널·방장을 물려받는다)');
chk(/roomIndex\/\$\{roomCodeForCleanup\}/.test(finalCleanup),
    '\u2605 roomIndex 삭제도 남아 있다 (\uD83D\uDCB0 요약 노드가 영구 잔류하면 카운트 비용이 는다)');

say('');

/* ── §3. 기록만 남은 방은 빈 방인가 ─────────────────────────────── */
say('· §3 기록만 남은 방을 사람이 있는 방으로 세지 않는가');

const memberKey = (HTML.match(/const _isMemberKey = [^\n]*/) || [''])[0];
chk(/k\.charAt\(0\) !== '_'/.test(memberKey) && /k !== 'chatLog'/.test(memberKey),
    "\u2605 퇴장 청소의 멤버 판정이 chatLog 를 뺀다 (안 빼면 기록 남은 방이 영원히 '사람 있는 방')");

// 인원/정원 계산에서도 같은 규칙이어야 한다 — 여기가 틀리면 빈 방이 만석으로 보인다
const capacityFilters = (HTML.match(/id !== 'chatLog'|id\.charAt\(0\) !== '_' && id !== 'chatLog'/g) || []).length;
chk(capacityFilters >= 3,
    '인원 계산 쪽도 chatLog 를 멤버에서 뺀다 (' + capacityFilters + '곳) — 빈 방이 만석으로 보이지 않는다');

// 유령 방 판정도 같은 규칙 (관리자 청소가 유일한 배출구라 여기가 틀리면 아무것도 못 걷는다)
const ghost = (HTML.match(/async cleanGhostRooms\(\)\{[\s\S]*?\n    \},/) || [''])[0];
chk(/k === '_meta' \|\| k === 'chatLog'/.test(ghost),
    '유령 방 판정도 chatLog 를 멤버로 세지 않는다 (관리자 청소가 용량 배출구다)');

say('');

/* ── §4. '처음 입장'은 이제 여기가 유일한 담당 ──────────────────── */
say("· §4 '처음 입장한 사람은 이전 기록을 못 본다' — 담당이 옮겨졌다");

chk(/const CHAT_JOIN_KEY_PREFIX = 'tw_chat_join:'/.test(SRC),
    '입장 컷 저장 키가 있다 (localStorage — 재부팅해도 남는다)');
const joinCut = (SRC.match(/function _chatJoinCut\(room\)\{[\s\S]*?\n\}/) || [''])[0];
chk(/localStorage\.getItem/.test(joinCut), '입장 컷을 localStorage 에서 읽는다 (세션 변수가 아니다)');

const note = (SRC.match(/function _noteChatJoin\(room, list\)\{[\s\S]*?\n\}/) || [''])[0];
chk(/_chatJoinCut\(room\) !== null\) return;/.test(note),
    "\u2605 이미 들어와 본 방이면 컷을 **다시 안 찍는다** (다시 찍으면 재부팅마다 과거가 잘린다)");
chk(/!== null/.test(note),
    "'' (빈 방에 입장) 과 null (아직 안 들어와 봄) 을 구분한다");

const since = (SRC.match(/function _chatSinceJoin\(list\)\{[\s\S]*?\n\}/) || [''])[0];
chk(/if\(!cut\) return list/.test(since), '컷이 없으면 아무것도 안 가린다');
chk(/_chatMsgKey\(m\) > cut/.test(since), '컷보다 뒤(push key 순서)만 그린다');

say('');
if (fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('전부 통과 \u2705 — 방이 비어도 기록이 남고, 처음 온 사람에게는 여전히 안 보인다');
process.exit(0);

/* sim-chat-log-persist.js — 💬 방이 비어도 대화 기록이 남는가
   실행:  node sim-chat-log-persist.js   (app.js · desk-companion-prototype.html 과 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 제보: **"재부팅하면 모두가 처음으로 돌아간다."**
     정체는 입장 컷(app.js `tw_chat_join:`)이 아니라 **서버 기록이 지워지고 있던 것**이었다.
     `rooms/{방}/chatLog` 를 지우는 자리가 둘이었고, 둘 다 "살아있는 멤버가 없으면"이 조건이라
     다 같이 앱을 껐다 켜는 순간(= 아무도 안 남은 순간) 기록이 통째로 날아갔다:
       ① 입장 첫 스냅샷 청소 — **재부팅 직후 첫 사람**이 정확히 여기를 지난다
       ② 마지막 퇴장 청소 — `_finalCleanup`

   ★ 이 검사가 지키는 것 — (§1~§3 은 0.13 에서 걷었다: 앱이 Firebase 방에 들어가지 않아 청소 자리 자체가 없다 · 방은 realtime 서버)
     §4 '처음 입장한 사람은 이전 기록을 못 본다'는 규칙이 **localStorage 에** 남아 있다
        — 기록을 지우는 것으로 대신하고 있었으므로, 지금부터는 이쪽이 유일한 담당이다

   ⚠ 소스 대조만 한다(런타임 RTDB 는 안 본다). 눈으로 볼 것은 핸드오프의 확인표에 있다. */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const SRC  = _joinRenderer(fs.readFileSync('app.js', 'utf8'));
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

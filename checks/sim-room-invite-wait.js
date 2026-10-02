/* ═══ ⏳ sim-room-invite-wait.js — 방 초대 팝업이 화면을 막지 않는다 · 3분 뒤 자동 거절 (개정 76 신설) ═══════════
   [제보] «친구가 방에 초대하면 알림이 뜨는 동안 수락·거절 말고 아무것도 못 한다.»
     팝업이 화면 전체를 덮는 어두운 판(pointer-events:auto)이라, 실행 화면(전체화면 투명 오버레이)에서는
     화면 전체가 클릭을 막았다.
   ・1절: 껍데기는 pointer-events:none · 배경 없음 · 상자만 auto (클릭 통과 영역 수집 _uiRegions 는 none 껍데기를 건너뛴다)
   ・2절: 3분 대기 → 거절과 같은 길(done(false)) · done 은 한 번만 · 남은 시간 표시 · 깜빡임은 done 에서 끈다
   ・3절: 오래된 초대(10분 — 보낸 쪽 시계 오차 여유)는 띄우지 않고 지운다
   ⚠️ 실제 동작(밖 클릭 통과 · 만료 · 수락)은 2026-10-02 헤드리스 크로미움에서 함수 원문으로 확인했다.
   [실행] app.js 가 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
let SRC = null; try{ SRC = fs.readFileSync('app.js', 'utf8'); }catch(_){}
if(!SRC){ say('  ? 원본 못 찾음 — app.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const grab = (name) => { const i = SRC.indexOf('function ' + name + '('); if(i < 0) return ''; let k = SRC.indexOf('{', i), d = 0;
  for(; k < SRC.length; k++){ if(SRC[k] === '{') d++; else if(SRC[k] === '}' && --d === 0) return SRC.slice(i, k + 1); } return ''; };
const P = strip(grab('showRoomInvitePopup')), R = strip(grab('_bindRoomInviteReceiver'));

say('── 1. 화면을 막지 않는다');
chk(!!P, 'showRoomInvitePopup 을 찾았다');
chk(/ov\.className = 'app-popup-ov';/.test(P), '껍데기는 여전히 app-popup-ov(화이트리스트 매칭)');
chk(/ov\.style\.cssText = '[^']*pointer-events:none;'/.test(P) && !/ov\.style\.cssText = '[^']*pointer-events:auto/.test(P), '껍데기 = pointer-events:none');
chk(/ov\.style\.cssText = '[^']*background:none;/.test(P) && !/ov\.style\.cssText = '[^']*background:rgba/.test(P), '어두운 배경 판 없음');
chk(/box\.style\.cssText = 'pointer-events:auto;/.test(P), '상자만 클릭을 받는다');

say('── 2. 3분 대기 · 자동 거절');
chk(/const ROOM_INVITE_WAIT_MS\s*= 3 \* 60 \* 1000;/.test(SRC), '대기 3분');
chk(/const due = Date\.now\(\) \+ ROOM_INVITE_WAIT_MS;/.test(P), '팝업이 뜬 순간부터 잰다');
chk(/if\(ms <= 0\)\{ done\(false\);/.test(P), '시간이 지나면 거절과 같은 길');
chk(/if\(finished\) return; finished = true;/.test(P) && /clearInterval\(tick\)/.test(P), 'done 은 한 번만 · 타이머 정리');
chk(/_flashTaskbar\(true\);/.test(P) && /_flashTaskbar\(false\);/.test(P), '깜빡임은 팝업과 수명을 같이 한다');
chk(/data-a="left"/.test(grab('showRoomInvitePopup')), '남은 시간 줄');

say('── 3. 오래된 초대');
chk(/const ROOM_INVITE_STALE_MS = 10 \* 60 \* 1000;/.test(SRC), '오래됨 문턱 10분(보낸 쪽 시계 오차 여유)');
chk(/_now - invites\[id\]\.ts > ROOM_INVITE_STALE_MS/.test(R) && /clearRoomInvite\(myId, id\)/.test(R), '오래된 초대는 띄우지 않고 지운다');
chk(!/_now - invites\[id\]\.ts > ROOM_INVITE_WAIT_MS/.test(R), '3분으로 버리지 않는다(시계 오차로 새 초대를 버리게 된다)');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

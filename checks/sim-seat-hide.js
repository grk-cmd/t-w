/* ═══ 🙈 sim-seat-hide.js — 워킹룸 캐릭터 숨기기 (2026-09-23 · handoff-2026-09-21-features §5) ═══════════════════════
   [무엇을 지키나] 워킹룸(채널 1)에서 상대 캐릭터 우클릭 → «🙈 숨기기» / 숨긴 좌석은 «🙉 다시 보이기».
     내 화면에서만 · 그 방에 있는 동안만 · 서버·규칙·localStorage 무관.
   ・1절: 메뉴 — 줄이 seat.remote 갈래 안 · _activeChannel === 1 조건 안에만 · 내 좌석 갈래에 없음 · 숨긴 좌석엔 때리기 줄 없음.
   ・2절: 기억 — Set 하나 · localStorage/서버에 안 씀 · 방 입장 직전(Presence.start 앞)과 doLeaveRoom 에서 비움.
   ・3절: 클릭 — 좌클릭 잡기 · 💣 조준 · 🪄 때리기 조준 세 곳이 _hitsSkipHidden 으로 거름 · 우클릭 경로는 안 거름.
   ・4절: 적용 — 프레임 루프가 rig.visible · 말풍선 · 책상 이모지를 매 프레임 판정. 판정 함수를 떼어 와 돌림.
   [실행] app.js 가 있는 폴더에서. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const grabFn = (name, from) => { const S = from || SRC; const i = S.indexOf('function ' + name + '('); if(i < 0) return ''; let k = S.indexOf('{', i), d = 0; for(; k < S.length; k++){ if(S[k] === '{') d++; else if(S[k] === '}' && --d === 0) return S.slice(i, k + 1); } return ''; };
const CODE = strip(SRC);

say('── 1. 메뉴');
{
  const menu = strip(grabFn('_seatCtxMenu'));
  const iR = menu.indexOf('if(seat.remote){'), iE = menu.lastIndexOf('} else {', menu.indexOf('openCreator'));
  const remote = menu.slice(iR, iE), mine = menu.slice(iE, menu.indexOf('if(_premiumOn()', iE));
  chk(iR > 0 && iE > iR, '_seatCtxMenu 의 remote / 내 좌석 갈래를 찾았다');
  const iC = remote.indexOf('window._activeChannel === 1');
  chk(iC > 0 && remote.indexOf('🙈 숨기기') > iC && remote.lastIndexOf('🙉 다시 보이기') > iC, '숨기기 · 다시 보이기 줄이 remote 갈래의 _activeChannel === 1 조건 안');
  chk(/const _rptHid = [^;]*_reportHiddenUids\.has\(seat\.friendUserId\)/.test(remote) && remote.indexOf('🙉 다시 보이기') < iC, '🚩 신고로 숨긴 사람은 채널 조건 앞에서 «다시 보이기» 하나로 푼다(개정 60)');
  chk((menu.match(/🙈 숨기기/g) || []).length === 1 && !/숨기기|다시 보이기/.test(mine), '내 좌석 갈래에는 없다');
  chk(/if\(_premiumOn\(\) && !_seatHidden\(seat\)\)/.test(menu), '숨긴 좌석에는 때리기 줄을 안 넣는다');
}

say('── 2. 기억');
{
  chk(/const _hiddenSeatIds = new Set\(\);/.test(CODE), '모듈 변수 Set 하나');
  const uses = CODE.split('\n').filter(l => /_hiddenSeatIds/.test(l));
  chk(uses.length > 0 && !uses.some(l => /localStorage|_lsSet|firebaseAPI|Presence\./.test(l)), 'localStorage · 서버에 안 쓴다');
  chk(/_clearHiddenSeats\(\);[^\n]*\n\s*await Presence\.start\(/.test(SRC), '방 입장 직전에 비운다');
  const leave = grabFn('doLeaveRoom');
  chk(/_clearHiddenSeats\(\)/.test(leave), 'doLeaveRoom 에서 비운다');
  chk(/add\(seat\.friendId\)/.test(CODE) && /delete\(seat\.friendId\)/.test(CODE), '키 = seat.friendId(방 세션 memberId)');
}

say('── 3. 클릭 경로');
{
  const fly = strip(grabFn('_flyAimClick')), bonk = strip(grabFn('_bonkAimClick'));
  chk(/_hitsSkipHidden\(ray\.intersectObjects/.test(fly), '💣 조준이 거른다');
  chk(/_hitsSkipHidden\(ray\.intersectObjects/.test(bonk), '🪄 때리기 조준이 거른다');
  const iPD = CODE.indexOf("canvas.addEventListener('pointerdown'");
  const pd = CODE.slice(iPD, CODE.indexOf('drag={', iPD));
  chk(iPD > 0 && /_hitsSkipHidden\(ray\.intersectObjects/.test(pd), '좌클릭 잡기(흔들기·쓰다듬기)가 거른다');
  const iCM = CODE.lastIndexOf('_seatCtxMenu(e, seat);');
  const cm = CODE.slice(CODE.lastIndexOf("addEventListener('contextmenu'", iCM), iCM);
  chk(iCM > 0 && /intersectObjects/.test(cm) && !/_hitsSkipHidden/.test(cm), '우클릭 메뉴 경로는 거르지 않는다(책상 → 다시 보이기)');
}

say('── 4. 적용 · 판정');
{
  chk(/const _hidden = _seatHidden\(seat\);/.test(CODE) && /seat\.rig\.visible = !_hidden/.test(CODE), '프레임 루프: rig.visible 을 매 프레임 판정');
  chk(/!_hidden(?: && !_awayPic)?\) \? _conf\.emo : null/.test(CODE), '프레임 루프: 책상 위 상태 이모지 숨김');
  chk(/if\(_hidden\)\{ setSeatHeadBubble\(seat, null\); \}/.test(CODE), '프레임 루프: 머리 위 말풍선 숨김');
  const fns = grabFn('_seatHidden') + '\n' + grabFn('_hitsSkipHidden');
  const env = { window: { _activeChannel: 1 } };
  const T = new Function('window', 'seatFromObject', 'const _hiddenSeatIds = new Set(); const _reportHiddenUids = new Set();\n' + fns + '\nreturn { set: _hiddenSeatIds, rset: _reportHiddenUids, hid: _seatHidden, skip: _hitsSkipHidden };')(env.window, (o) => o.seat || null);
  const A = { remote: true, friendId: 'mA' }, B = { remote: true, friendId: 'mB' }, ME = { isMe: true, friendId: 'mA' };
  T.set.add('mA');
  chk(T.hid(A) && !T.hid(B) && !T.hid(ME) && !T.hid(null), '숨긴 원격 좌석만 참 · 내 좌석 · 없음은 거짓');
  env.window._activeChannel = 2; chk(!T.hid(A), '투게더룸(채널 2)에서는 효력 없음');
  env.window._activeChannel = 1;
  const hits = [{ object: { seat: A } }, { object: { seat: B } }, { object: {} }];
  const out = T.skip(hits);
  chk(out.length === 2 && out[0].object.seat === B, '숨긴 좌석 히트만 빠지고 뒤에 있는 것이 잡힌다');
  T.set.clear(); chk(T.skip(hits) === hits, '숨긴 것이 없으면 그대로 돌려준다');
  /* 🚩 신고로 숨김(개정 60) — 계정(friendUserId) 기준 · 채널 무관 */
  const C = { remote: true, friendId: 'mC', friendUserId: 'uC' };
  T.rset.add('uC');
  env.window._activeChannel = 2; chk(T.hid(C) && !T.hid(B), '신고로 숨긴 사람은 투게더룸에서도 숨는다(계정 기준)');
  chk(T.skip([{ object: { seat: C } }]).length === 0, '신고로 숨긴 사람도 클릭에서 빠진다');
  chk(!T.hid({ isMe: true, friendUserId: 'uC' }), '내 좌석은 신고 목록과 무관');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

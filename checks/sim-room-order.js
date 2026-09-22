/* ═══ 🕒 sim-room-order.js — 입장순은 서버 시계로 · 시크릿룸 옛 uid 는 말해 준다 (2026-09-17 제보 2·4) ═══════
   [무엇을 지키나]
   ・1절: firebase-init.js joinRoom — memberId 앞부분이 `_svNow()`(서버 시계 보정본)다. 정원 초과 자기 퇴장이
          «memberId 오름차순 = 입장순» 으로 늦게 온 사람을 가르는데, 각자 PC 시계(Date.now)로 만들면 시계가 앞선
          사람이 방이 찰 때마다 «늦게 온 사람» 으로 계산돼 쫓겨난다(제보 2). 정렬 로직·id 형식은 안 바뀐다.
          _svNow 를 흉내내 «시계가 5분 앞선 먼저 온 사람» 이 보정 뒤에는 앞자리에 서는지 실제로 돌려 본다.
   ・2절: app.js 관리자 시크릿룸 발급 — friendCodes 로 푼 uid 의 거울(users/{uid}/friendCode)이 입력 코드와
          다르면 7일 게이트와 같은 «한 번 더 누르기» 경고(제보 4). uid 직접 입력은 게이트 없음(예전 그대로).
   ・3절: app.js startRoom — pub.owner 가 내가 버린 uid 면 재발급 안내 토스트. 방장으로 쳐 주지는 않는다.
   [실행] app.js · firebase-init.js 가 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');
const FB  = fs.readFileSync('firebase-init.js', 'utf8');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/* ── 1. memberId ── */
say('── 1. firebase-init.js joinRoom — memberId 는 서버 시계 보정본으로');
{
  const code = strip(FB);
  const i = code.indexOf('joinRoom(room, me, onChange, onPoked)');
  const body = code.slice(i, i + 600);
  chk(i >= 0, 'joinRoom 을 찾았다');
  chk(/const memberId = 'm' \+ _svNow\(\)\.toString\(36\) \+ Math\.random\(\)\.toString\(36\)\.slice\(2, 8\);/.test(body), '★ memberId = \'m\' + _svNow().toString(36) + … (Date.now 가 아니다)');
  chk(!/const memberId = 'm' \+ Date\.now\(\)/.test(body), '  Date.now 로 만드는 줄은 없다');
  chk(/const _svNow = \(\) => Date\.now\(\) \+ _svTimeOffset;/.test(code), '  _svNow 는 .info/serverTimeOffset 보정본 그대로');
  /* 정렬 판정이 그대로다 */
  chk(/_aliveIds\.concat\(\[memberId\]\)\.sort\(\)\.indexOf\(memberId\)/.test(code), '  정원 초과 판정은 여전히 memberId 문자열 정렬 — 로직 무변경');
  /* 모형: A 가 먼저(시계 +5분), B 가 3초 뒤(정상). 보정 없이는 B 가 앞, 보정하면 A 가 앞. */
  const mk = (t) => 'm' + t.toString(36) + 'zzzzzz';
  const T = 1_800_000_000_000;
  const A_local = T + 300_000, B_local = T + 3_000;                        // 각자 Date.now
  const A_srv = A_local + (-300_000), B_srv = B_local + 0;                   // 각자의 _svNow (오프셋 보정)
  const before = [mk(A_local), mk(B_local)].sort();
  const after  = [mk(A_srv),   mk(B_srv)].sort();
  chk(before[0] === mk(B_local), '① 보정 전: 시계 앞선 A 가 뒤로 밀린다 — 방이 차면 먼저 있던 A 가 나간다(제보)');
  chk(after[0] === mk(A_srv) && after[1] === mk(B_srv), '★ ② 보정 후: 먼저 온 A 가 앞 — 늦게 온 B 가 나간다');
  chk(mk(A_srv).length === mk(A_local).length, '  id 길이 그대로(구버전 클라이언트와 같은 정렬 공간)');
}

/* ── 2. 관리자 발급 거울 대조 ── */
say('── 2. app.js 시크릿룸 발급 — 거울(users/{uid}/friendCode) 불일치 경고');
{
  const i = SRC.indexOf('if(!isUid && firebaseAPI.getUserLastSeen){');
  const gate = SRC.slice(i, i + 3000);
  chk(i >= 0, '7일 게이트를 찾았다');
  chk(/mirror = await firebaseAPI\.getUserFriendCode\(uid\)/.test(gate), '★ 거울을 읽는다');
  chk(/const mirrorOff = \(mirror !== undefined\) && \(String\(mirror \|\| ''\)\.toUpperCase\(\) !== code\);/.test(gate), '  조회 실패(undefined)는 경고 안 함 · 없음(null)·다름은 경고');
  chk(/if\(days === null \|\| days >= SR_STALE_DAYS \|\| mirrorOff\)/.test(gate), '  7일 게이트와 같은 자리·같은 «한 번 더 누르기»');
  chk(/이 계정에 적힌 친추코드는/.test(gate), '  경고 문구가 거울 값을 보여 준다');
  chk(/getUserFriendCode\(uid\)\{/.test(FB), '  firebase-init.js 에 getUserFriendCode 가 있다(있는 API 만 쓴다)');
}

/* ── 3. 입장 — «버린 uid» 안내는 걷었다 (개정 56 · 회원가입 설계 §6-⑥) ──
   예전엔 pub.owner 가 «이 기기가 버린 uid» 면 재발급 안내 토스트를 띄웠다. 그 목록(tw.myPrevUserIds)이 걷혔다 —
   이 기기의 이전 uid 는 이제 다른 계정이다. 방장 판정은 그대로 pub.owner 문자열 하나로 방 전원이 같은 계산을 한다. */
say('── 3. app.js startRoom — 방장 판정은 문자열 하나 · «버린 uid» 안내 없음');
{
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/mg, '');
  const i = code.indexOf('const _iAmSrOwner = !!(_isSecret && _secretOwner && _secretOwner === getMyUserId());');
  const after = code.slice(i, i + 1500);
  chk(i >= 0, '_iAmSrOwner 판정을 찾았다 (pub.owner === 내 uid 하나)');
  chk(!/_isMyPrevUserId/.test(code) && !/재발급을 요청해 주세요/.test(after), '★ «버린 uid» 로 방장을 알아보는 갈래가 없다 (개정 56)');
  chk(!/function _isMyPrevUserId\(|tw\.myPrevUserIds['"]\)\s*\|\|/.test(code), '  _isMyPrevUserId · 버린 uid 목록이 없다');
  chk(/window\._srOwnerUid = _isSecret \? \(_secretOwner \|\| null\) : null;/.test(after), '  자기 퇴장 게이트가 읽는 방장 값은 그대로');
}

say('\n결과: 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);

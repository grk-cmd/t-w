/* ═══ 🚪 sim-room-channel.js — 방 채널 표지(`_meta.channel`) 복구 (제보 2 · 2026-09-16) ═══════════
   [무엇이 터졌나] `_meta` 를 지우는 코드는 퇴장 정리 한 곳뿐인데, 동시 퇴장 대비 **시차 재조회**와
     누군가의 재입장이 겹치면 「멤버는 있는데 `_meta` 만 없는」 방이 남는다. 입장 경로는
     «빈 방이면 선점, 아니면 서버 채널을 읽기만» 이라 **아무도 표지를 다시 안 썼다** — 그 방은
     멤버도 방장도 워킹룸으로 떨어지고 영원히 못 돌아온다(실제 방 `COZY-42W5`).
   ・1절: firebase-init — `getRoomChannelEx` 가 «있음/없음/읽기실패» 셋을 가른다.
   ・2절: `recoverRoomChannel` — **채널이 없을 때만** 쓴다. 있으면 한 글자도 안 건드린다(트랜잭션으로 실행해 본다).
   ・3절: app.js 입장 분기 — 표지 없음 → 복구 · 읽기 실패 → 아무것도 안 함 · 있음 → 그대로.
   ・4절: 되돌리면 안 되는 것 — 여기서 `claimEmptyRoom` 을 쓰면 남의 투게더룸이 덮인다.
   [실행] app.js · firebase-init.js 가 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');
const FI  = fs.readFileSync('firebase-init.js', 'utf8');

let pass = 0, fail = 0, huhs = 0;
const say = s => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const huh = msg => { huhs++; say('  ? ' + msg); };
function grabFn(src, name, kw){
  const i = src.indexOf((kw || 'function ') + name + '(');
  if(i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  return null;
}

/* ── 1. 셋을 가른다 ── */
say('── 1. getRoomChannelEx — 있음 / 없음 / 읽기 실패');
const ex = grabFn(FI, 'getRoomChannelEx', 'async ') || '';
const old = grabFn(FI, 'getRoomChannel', 'async ') || '';
chk(!!ex, 'getRoomChannelEx 가 있다');
chk(/return \{ channel: \(meta && meta\.channel\) \? meta\.channel : null \}/.test(ex), '★ 표지가 없으면 channel:null — 워킹룸으로 뭉개지 않는다');
chk(/catch[^)]*\)\{[^}]*return null;/.test(ex), '★ 읽기 실패는 null — «표지 없음»(객체)과 다른 값이다');
chk(/return 'workingroom'/.test(old), '옛 getRoomChannel 은 그대로 남아 있다(구버전 폴백 호환)');

/* ── 2. 복구는 «없을 때만» ── */
say('── 2. recoverRoomChannel — 있으면 안 건드린다');
const rec = grabFn(FI, 'recoverRoomChannel', 'async ') || '';
if(!rec){ huh('recoverRoomChannel 을 못 떼어 옴'); }
else{
  chk(/runTransaction\(ref\(db, `rooms\/\$\{room\}\/_meta`\)/.test(rec), '★ 트랜잭션이다 — 로컬 읽기가 낡았어도 서버 값으로 다시 돈다');
  chk(/if\(cur && cur\.channel\)\{[^}]*return;\s*\}/.test(rec), '★ 채널이 이미 있으면 중단(undefined 반환) — 남의 채널을 덮지 않는다');
  chk(/if\(!meta\.host && myUserId\)/.test(rec), '  방장은 비었을 때만 채운다 — 남의 방장을 뺏지 않는다');
  chk(!/openTs/.test(rec), '★ openTs 를 안 쓴다 — 쓰면 직후 보유자의 정상 선점(justOpened)이 막힌다');

  /* 트랜잭션 함수만 떼어 실제로 돌려 본다 — 문자열 검사로는 «중단» 이 진짜 중단인지 알 수 없다. */
  /* 트랜잭션 콜백의 본문만 떼어 함수로 다시 짠다 — 화살표 함수를 문자열로 자르면 꼬리 괄호가 어긋난다. */
  const _bs = rec.indexOf('cur => {'), _be = rec.indexOf('\n        });', _bs);
  const body = rec.slice(rec.indexOf('{', _bs) + 1, _be);
  const fn = new Function('cur', 'licensed', 'myUserId', '_svNow', body);
  const NOW = 1800000000000, now = () => NOW;
  const run = (cur, licensed, uid) => fn(cur, licensed, uid || 'me', now);

  const r1 = run(null, true);
  chk(r1 && r1.channel === 'togetherroom' && r1.host === 'me' && r1.ts === NOW, '· _meta 가 통째로 없음 + 보유자 → 투게더룸으로 세운다');
  const r2 = run({}, false);
  chk(r2 && r2.channel === 'workingroom', '· 표지만 없음 + 미보유자 → 워킹룸');
  const r3 = run({ channel:'togetherroom', host:'other' }, false);
  chk(r3 === undefined, '★ 이미 투게더룸인 방에 미보유자가 들어와도 **중단** — 여기가 무너지면 남의 방이 워킹룸이 된다');
  const r4 = run({ channel:'workingroom', host:'other' }, true);
  chk(r4 === undefined, '★ 이미 워킹룸인 방에 보유자가 들어와도 중단 — 복구지 승격이 아니다');
  const r5 = run({ host:'other' }, true);
  chk(r5 && r5.channel === 'togetherroom' && r5.host === 'other', '· 방장만 남고 표지가 없으면 채널만 세우고 방장은 그대로');
  const r6 = run({ channel:'' }, true);
  chk(r6 && r6.channel === 'togetherroom', '· 빈 문자열 채널도 «없음»으로 본다');
}

/* ── 3. 입장 분기 ── */
say('── 3. app.js 입장 — 사람이 있는 방');
const fEnter = SRC.slice(SRC.indexOf('let _channel = window._pendingRoomChannel || null;'));
const seg = fEnter.slice(0, fEnter.indexOf('window._activeChannel ='));
if(!seg){ huh('입장 분기를 못 떼어 옴'); }
else{
  chk(/getRoomChannelEx\(code\)/.test(seg), '★ 사람이 있는 방은 Ex 로 읽는다(셋을 가르는 판)');
  chk(/if\(_ex && _ex\.channel\)\{\s*_channel = _ex\.channel;/.test(seg), '· 표지가 있으면 그대로 따른다 — 방장도 채널도 안 건드림');
  chk(/_ex && !_ex\.channel[\s\S]*recoverRoomChannel\(code, getMyUserId\(\), _iAmLicensed2\)/.test(seg), '★ 표지가 없을 때만 복구를 부른다');
  chk(/\} else \{\s*_channel = await firebaseAPI\.getRoomChannel\(code\);/.test(seg), '★ 읽기 실패(null)면 복구를 안 부른다 — 옛 경로로 떨어질 뿐 표지를 잘못 세우지 않는다');
  chk(/_rec && _rec\.recovered/.test(seg) && /console\.log\('\[방\] 표지가 없어/.test(seg), '· 되살렸을 때만 로그를 남긴다(«있어서 그대로» 와 구분)');
  chk(/claimEmptyRoom/.test(seg) === true, '  (참고) 빈 방 승격 경로는 그대로 같은 함수 안에 있다');
  /* ⚠️ 이 줄이 이 검사의 핵심이다 — 복구를 claimEmptyRoom 으로 바꾸면 조용히 사고가 된다. */
  const recBranch = seg.slice(seg.indexOf('_ex && !_ex.channel'), seg.indexOf('window._activeChannel') >= 0 ? undefined : undefined);
  chk(!/!_ex\.channel[\s\S]{0,400}claimEmptyRoom/.test(seg), '★ 복구 분기에서 claimEmptyRoom 을 부르지 않는다 — 그건 있는 채널도 덮는다');
  void recBranch;
}

/* ── 4. 지켜야 할 경계 ── */
say('── 4. 경계');
chk(/_meta` 를 지우는 코드는 퇴장 정리/.test(FI) || /_finalCleanup/.test(FI), '퇴장 정리(_finalCleanup)는 그대로 있다 — 복구는 그것을 대신하지 않는다');
chk(/_touchRoomIndex\(room, \{ channel \}\)/.test(grabFn(FI, 'recoverRoomChannel', 'async ') || ''), '  되살린 채널은 roomIndex 에도 반영한다(개수 집계가 같은 값을 본다)');

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs);
process.exit(fail ? 1 : 0);

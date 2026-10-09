/* ═══ 🚪 sim-room-channel.js — 방 채널 표지(`_meta.channel`) 복구 (제보 2 · 2026-09-16) ═══════════
   [무엇이 터졌나] `_meta` 를 지우는 코드는 퇴장 정리 한 곳뿐인데, 동시 퇴장 대비 **시차 재조회**와
     누군가의 재입장이 겹치면 「멤버는 있는데 `_meta` 만 없는」 방이 남는다. 입장 경로는
     «빈 방이면 선점, 아니면 서버 채널을 읽기만» 이라 **아무도 표지를 다시 안 썼다** — 그 방은
     멤버도 방장도 워킹룸으로 떨어지고 영원히 못 돌아온다(실제 방 `COZY-42W5`).
   ・1절: firebase-init — `getRoomChannelEx` 가 «있음/없음/읽기실패» 셋을 가른다.
   ・2절: `recoverRoomChannel` — **채널이 없을 때만** 쓴다. 있으면 한 글자도 안 건드린다(트랜잭션으로 실행해 본다).
   ・3절: app.js 입장 분기 — 표지 없음 → 복구 · 읽기 실패 → 아무것도 안 함 · 있음 → 그대로.
   ・4절: 되돌리면 안 되는 것 — 여기서 `claimEmptyRoom` 을 쓰면 남의 투게더룸이 덮인다.
   [2026-10-10 제보] 표지를 잃은 PLAY- 방에 무료 사용자가 먼저 들어와 워킹룸으로 굳고(PLAY-FVNJ),
     그 뒤에 들어온 사람만 채팅 대신 이모티콘 버튼을 봤다. 다시 들어와도 그대로였다.
   ・2절 뒷부분 · 5절: 되살릴 채널은 코드 접두어대로(room-channel.js recoverChannelFor). 투게더룸 방장은 보유자만.
   ・6절: 방장 칸이 빈 투게더룸 — 보유자가 이어받고, 없으면 해산하지 않는다.
   ・7절: Firebase 방도 _meta.channel 이 바뀌면 _activeChannel 이 따라간다(같은 방 안에서 갈리지 않게).
   [실행] app.js · firebase-init.js 가 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');
const FI  = fs.readFileSync('firebase-init.js', 'utf8');
/* room-channel.js(ES 모듈)를 함수로 불러온다 — export 만 떼면 된다(다른 import 없음). */
const RC = new Function(fs.readFileSync('room-channel.js', 'utf8').replace(/^export (function|const) /mg, '$1 ')
  + '\nreturn { CHANNEL, channelFromRoomCode, recoverChannelFor };')();

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
  chk(/if\(!meta\.host && myUserId && \(want !== 'togetherroom' \|\| licensed\)\)/.test(rec), '  방장은 비었을 때만 채운다(남의 방장을 뺏지 않는다) · 투게더룸은 보유자만');
  chk(/const want = recoverChannelFor\(room, licensed\);/.test(rec), '★ 되살릴 채널은 recoverChannelFor(코드, 라이선스) — 접두어가 먼저다');
  chk(!/openTs/.test(rec), '★ openTs 를 안 쓴다 — 쓰면 직후 보유자의 정상 선점(justOpened)이 막힌다');

  /* 트랜잭션 함수만 떼어 실제로 돌려 본다 — 문자열 검사로는 «중단» 이 진짜 중단인지 알 수 없다. */
  /* 트랜잭션 콜백의 본문만 떼어 함수로 다시 짠다 — 화살표 함수를 문자열로 자르면 꼬리 괄호가 어긋난다. */
  const _bs = rec.indexOf('cur => {'), _be = rec.indexOf('\n        });', _bs);
  const body = rec.slice(rec.indexOf('{', _bs) + 1, _be);
  const fn = new Function('cur', 'licensed', 'myUserId', '_svNow', 'want', body);
  const NOW = 1800000000000, now = () => NOW;
  const run = (cur, licensed, uid, code) => fn(cur, licensed, uid || 'me', now, RC.recoverChannelFor(code || 'COZY-AB12', licensed));

  const r1 = run(null, true);
  chk(r1 && r1.channel === 'togetherroom' && r1.host === 'me' && r1.ts === NOW, '· (옛 COZY-) _meta 가 통째로 없음 + 보유자 → 투게더룸으로 세운다');
  const r2 = run({}, false);
  chk(r2 && r2.channel === 'workingroom', '· (옛 COZY-) 표지만 없음 + 미보유자 → 워킹룸');
  const r3 = run({ channel:'togetherroom', host:'other' }, false);
  chk(r3 === undefined, '★ 이미 투게더룸인 방에 미보유자가 들어와도 **중단** — 여기가 무너지면 남의 방이 워킹룸이 된다');
  const r4 = run({ channel:'workingroom', host:'other' }, true);
  chk(r4 === undefined, '★ 이미 워킹룸인 방에 보유자가 들어와도 중단 — 복구지 승격이 아니다');
  const r5 = run({ host:'other' }, true);
  chk(r5 && r5.channel === 'togetherroom' && r5.host === 'other', '· 방장만 남고 표지가 없으면 채널만 세우고 방장은 그대로');
  const r6 = run({ channel:'' }, true);
  chk(r6 && r6.channel === 'togetherroom', '· 빈 문자열 채널도 «없음»으로 본다');

  /* 2026-10-10 제보 — PLAY-FVNJ: 표지를 잃은 투게더룸에 무료 사용자가 먼저 들어와 워킹룸으로 굳었다.
     그 뒤에 들어온 사람만 이모티콘 버튼(채팅 없음)을 보고, 다시 들어와도 그대로였다. */
  const p1 = run(null, false, 'free', 'PLAY-FVNJ');
  chk(p1 && p1.channel === 'togetherroom', '★ PLAY- 방은 무료 사용자가 되살려도 투게더룸 — 들어오는 사람 라이선스로 정하지 않는다');
  chk(p1 && p1.host === undefined, '★ 무료 사용자는 투게더룸 방장이 되지 않는다 — 나갈 때 해산이 나지 않게 비워 둔다');
  const p2 = run(null, true, 'lic', 'PLAY-FVNJ');
  chk(p2 && p2.channel === 'togetherroom' && p2.host === 'lic', '· PLAY- 방을 보유자가 되살리면 투게더룸 + 그 사람이 방장');
  const w1 = run(null, true, 'lic', 'WORK-AB12');
  chk(w1 && w1.channel === 'workingroom' && w1.host === 'lic', '★ WORK- 방은 보유자가 되살려도 워킹룸 — 접두어대로');
  const w2 = run(null, false, 'free', 'WORK-AB12');
  chk(w2 && w2.channel === 'workingroom' && w2.host === 'free', '· WORK- 방 + 무료 사용자 → 워킹룸 · 방장은 예전처럼 채운다');
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

/* ── 5. 접두어 → 채널 ── */
say('── 5. room-channel.js — 코드 접두어가 채널을 정한다 (2026-10-10)');
chk(RC.channelFromRoomCode('PLAY-AB12') === 'togetherroom', 'PLAY- → 투게더룸');
chk(RC.channelFromRoomCode('WORK-AB12') === 'workingroom', 'WORK- → 워킹룸');
chk(RC.channelFromRoomCode('SCRT-AB12') === 'togetherroom', 'SCRT- → 투게더룸(시크릿룸)');
chk(RC.channelFromRoomCode('COZY-AB12') === null && RC.channelFromRoomCode('') === null, '옛 COZY- · 빈 값 → 모름(null)');
chk(RC.recoverChannelFor('COZY-AB12', true) === 'togetherroom' && RC.recoverChannelFor('COZY-AB12', false) === 'workingroom', '  접두어로 모를 때만 라이선스로 정한다(예전 규칙)');
chk(/import \{ recoverChannelFor \} from "\.\/room-channel\.js";/.test(FI), 'firebase-init 이 room-channel.js 에서 가져다 쓴다');

/* ── 6. 방장 칸이 빈 투게더룸 ── */
say('── 6. _maybeSucceedHost — 방장 칸이 비면 보유자가 이어받고, 없으면 해산하지 않는다');
const msh = grabFn(FI, '_maybeSucceedHost', 'async function ');
if(!msh){ huh('_maybeSucceedHost 를 못 떼어 옴'); }
else{
  const mk = () => {
    const log = { disband: 0, claim: [] };
    const win = {
      _onRoomDisbanded: () => { log.disband++; },
      firebaseAPI: { claimHostIfVacant: async (room, uid, alive) => { log.claim.push({ uid, alive }); return { ok: false }; } },
    };
    const f = new Function('window', '_svNow', 'ROOM_RESTORE_GRACE_MS', 'let _lastSuccessionAt = 0;\n' + msh + '\nreturn _maybeSucceedHost;')(win, () => 0, 60000);
    return { f, log };
  };
  const friendsFree = { m1: { userId: 'a', lic: false }, m2: { userId: 'b', lic: false } };
  const friendsLic  = { m1: { userId: 'a', lic: false }, m2: { userId: 'b', lic: true } };
  const t1 = mk(); t1.f('PLAY-X', 'm1', { channel: 'togetherroom' }, friendsFree);
  chk(t1.log.disband === 0, '★ 방장 칸이 빈 투게더룸 + 보유자 없음 → 해산하지 않는다(되살린 방에서 전원이 튕기지 않게)');
  const t2 = mk(); t2.f('PLAY-X', 'm2', { channel: 'togetherroom' }, friendsLic);
  chk(t2.log.claim.length === 1 && t2.log.claim[0].uid === 'b', '★ 방장 칸이 빈 투게더룸 + 안에 보유자 → 그 보유자가 방장을 가져간다');
  const t3 = mk(); t3.f('PLAY-X', 'm1', { channel: 'togetherroom', host: 'gone' }, friendsFree);
  chk(t3.log.disband === 1, '  방장이 있었는데 나갔고 보유자가 없으면 예전처럼 해산(설계 그대로)');
  const t4 = mk(); t4.f('PLAY-X', 'm1', { channel: 'togetherroom', host: 'a' }, friendsFree);
  chk(t4.log.disband === 0 && t4.log.claim.length === 0, '  방장이 안에 있으면 아무것도 안 한다');
  const t5 = mk(); t5.f('PLAY-X', 'm1', null, friendsFree);
  chk(t5.log.disband === 0 && t5.log.claim.length === 0, '  표지가 아예 없으면(null) 아무것도 안 한다');
}

/* ── 7. 채널이 표지를 따라간다 ── */
say('── 7. app.js _onRoomMeta — Firebase 방도 _meta.channel 이 바뀌면 _activeChannel 이 따라간다');
const om = (() => { const i = SRC.indexOf('window._onRoomMeta = function('); return i < 0 ? '' : SRC.slice(i, SRC.indexOf('\n};', i) + 3); })();
if(!om){ huh('_onRoomMeta 를 못 떼어 옴'); }
else{
  const head = om.slice(0, om.indexOf('try{'));
  const w = { _activeChannel: 1 };
  const f = new Function('window', head.replace('window._onRoomMeta = function(meta){', 'return function(meta){') + '};')(w);
  f({ channel: 'togetherroom' }); chk(w._activeChannel === 2, '★ 표지가 투게더룸이면 2(채팅)');
  f({ channel: 'workingroom' });  chk(w._activeChannel === 1, '· 워킹룸이면 1(이모티콘)');
  w._activeChannel = 2; f(null);  chk(w._activeChannel === 2, '★ 표지가 잠깐 비면(null) 그대로 둔다 — 깜빡이지 않게');
  f({ host: 'x' });               chk(w._activeChannel === 2, '  channel 칸이 없어도 그대로');
  chk(/window\._onRoomMeta\(_roomMetaVal\)/.test(FI), 'firebase-init _meta 구독이 값을 넘겨 부른다');
}

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs);
process.exit(fail ? 1 : 0);

/* ═══ 📊 sim-room-stats.js — 방 개수 서버 요약(roomStats) (2026-10-03 · RTDB 트래픽 분석 §2-1) ═══════════════
   [무엇을 보는가] 30초마다 roomIndex 전체(약 24KB)를 받아 세던 것을 서버 함수가 1분마다 세어 roomStats 에 둔다.
   ・1절: functions/index.js roomStatsFrom — 앱 getRoomCounts 와 같은 기준으로 세는가 · 10분 지난 줄만 지우는가
   ・2절: firebase-init.js — 정리된 줄이 하트비트로 되살아날 때 channel · open 을 같이 싣는가
          (안 실으면 투게더룸이 워킹룸으로 세어지고 랜덤 참여 방이 후보에서 빠진다)
   ・3절: 앱이 roomStats 를 읽는 자리 — 화면 표시(quick)만 쓰고 정원 검사는 안 쓴다 · 규칙은 읽기만
   [실행] 스테이징(run.js)에서 — firebase-init.js · firebase-database-rules.json · functions/index.js 가 있는 폴더. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const FI = read('firebase-init.js'), FN = read('functions/index.js'), RULES = read('firebase-database-rules.json');
if(!FI){ say('  ? 원본 못 찾음 — firebase-init.js'); process.exit(2); }
if(!RULES){ say('  ? 원본 못 찾음 — firebase-database-rules.json'); process.exit(2); }
if(!FN){ say('  ? 원본 못 찾음 — functions/index.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(FI);

say('── 1. functions/index.js roomStatsFrom (순수 함수를 떼어 돌린다)');
{
  const m = FN.match(/const ROOM_LIVE_MS[\s\S]*?\nfunction roomStatsFrom[\s\S]*?\n}\n/);
  chk(!!m, 'roomStatsFrom 과 상수를 찾았다');
  if(m){
    const f = new Function(m[0] + '\nreturn { roomStatsFrom, ROOM_LIVE_MS, ROOM_INDEX_DROP_MS, ROOM_OPEN_MAX };')();
    const now = 1e9;
    chk(f.ROOM_LIVE_MS === 90 * 1000, '살아 있는 방 기준 90초 — 앱 getRoomCounts 의 STALE 과 같다');
    chk(/const STALE = 90\*1000;/.test(CODE), '  ↳ 앱 쪽도 아직 90초다 (한쪽만 바꾸면 숫자가 어긋난다)');
    const { stats, drop } = f.roomStatsFrom({
      W1: { lastSeen: now - 1000, channel: 'workingroom', open: true },
      W2: { lastSeen: now - 1000 },                                   // channel 없음 → 워킹룸(앱과 같음)
      T1: { lastSeen: now - 1000, channel: 'togetherroom', open: true }, // 투게더룸은 랜덤 후보 아님
      S1: { lastSeen: now - 100 * 1000, channel: 'workingroom', open: true }, // 90초 넘음 — 안 셈 · 안 지움
      D1: { lastSeen: now - 11 * 60 * 1000, channel: 'togetherroom' },     // 10분 넘음 — 지움
      'SCRT-A': { lastSeen: now - 1000, channel: 'togetherroom' },        // 시크릿룸 — 안 셈
      'SCRT-B': { lastSeen: now - 11 * 60 * 1000 },                        // 낡은 시크릿룸 줄 — 지움
      BAD: 'x', NOTS: { channel: 'workingroom' },
    }, now, () => 0);
    chk(stats.workingroom === 2 && stats.togetherroom === 1, `채널별 개수 (워킹 ${stats.workingroom} · 투게더 ${stats.togetherroom}) = 2 · 1`);
    chk(stats.at === now, 'at = 센 시각 (앱이 3분 넘게 낡으면 무시)');
    chk(JSON.stringify(stats.open) === '["W1"]', `랜덤 후보 = 열린 워킹룸만 (${JSON.stringify(stats.open)})`);
    chk(JSON.stringify(drop.sort()) === '["D1","SCRT-B"]', `지울 줄 = 10분 넘은 것만 (${JSON.stringify(drop)})`);
    const many = {}; for(let i = 0; i < 50; i++) many['R' + i] = { lastSeen: now, open: true };
    chk(f.roomStatsFrom(many, now).stats.open.length === f.ROOM_OPEN_MAX, `랜덤 후보는 ${f.ROOM_OPEN_MAX}개까지만 싣는다`);
  }
  chk(/transaction\(cur => \{\s*if \(cur === null\) return null;\s*if \(Number\(cur\.lastSeen\) < cutoff\) return null;\s*return;/.test(FN),
      '지우기는 트랜잭션 — 그새 lastSeen 이 새로워졌으면 그만둔다');
  chk(/exports\.roomStats = onSchedule\(\{ schedule: 'every 1 minutes'/.test(FN), '1분마다 도는 예약 함수로 내보낸다');
}

say('── 2. firebase-init.js — 되살아난 줄에 channel · open');
{
  chk(/update\(ref\(db, `roomIndex\/\$\{room\}`\), Object\.assign\(\{ lastSeen: serverTimestamp\(\) \}, _roomIndexKeep\(room\), extra \|\| \{\}\)\)/.test(CODE),
      '_touchRoomIndex 가 _roomIndexKeep 을 섞는다 (하트비트 · 재접속 · 유령 복구가 모두 이 길)');
  // _roomIndexKeep · _rememberRoomOpen 을 떼어 가짜 상태로 돌린다
  const k = CODE.match(/let _roomOpenMemo = [\s\S]*?\n  function _rememberRoomOpen\(room\)\{[\s\S]*?\n  \}\n/);
  chk(!!k, '_roomIndexKeep · _rememberRoomOpen 을 찾았다');
  if(k){
    const mk = new Function('env', `let _roomCode = env.room, _roomMetaVal = env.meta;
      const ref = (_d, p) => p, db = null;
      const get = (p) => { env.reads.push(p); return Promise.resolve({ val: () => env.open }); };
      ${k[0]}
      return { keep: _roomIndexKeep, remember: _rememberRoomOpen, setMemo: (m) => { _roomOpenMemo = m; }, setRoom: (r) => { _roomCode = r; } };`);
    const run = async () => {
      let env = { room: 'COZY-1', meta: { channel: 'togetherroom' }, open: true, reads: [] };
      let t = mk(env);
      chk(JSON.stringify(t.keep('COZY-1')) === '{"channel":"togetherroom"}', 'open 을 모를 때는 channel 만 싣는다 (false 로 덮지 않는다)');
      t.remember('COZY-1'); await new Promise(r => setTimeout(r, 0));
      chk(env.reads.length === 1 && env.reads[0] === 'roomIndex/COZY-1/open', '입장 때 open 한 칸만 읽는다');
      chk(JSON.stringify(t.keep('COZY-1')) === '{"channel":"togetherroom","open":true}', '읽은 뒤엔 channel · open 을 같이 싣는다');
      chk(JSON.stringify(t.keep('OTHER')) === '{}', '지금 방이 아닌 코드에는 아무것도 덧붙이지 않는다');
      env = { room: 'COZY-1', meta: null, open: null, reads: [] }; t = mk(env);
      t.remember('COZY-1'); await new Promise(r => setTimeout(r, 0));
      chk(JSON.stringify(t.keep('COZY-1')) === '{}', '메타 도착 전 · open 없음 → 예전처럼 lastSeen 만');
      env = { room: 'COZY-1', meta: { channel: 'workingroom' }, open: true, reads: [] }; t = mk(env);
      t.setMemo({ room: 'COZY-1', open: false }); t.remember('COZY-1'); await new Promise(r => setTimeout(r, 0));
      chk(env.reads.length === 0 && t.keep('COZY-1').open === false, 'setRoomChannel 이 먼저 기억한 값이 있으면 읽지 않고 그 값을 쓴다');
      env = { room: 'COZY-1', meta: null, open: true, reads: [] }; t = mk(env);
      t.remember('COZY-1'); t.setRoom(null); await new Promise(r => setTimeout(r, 0)); t.setRoom('COZY-1');
      chk(t.keep('COZY-1').open === undefined, '읽는 사이 방을 나갔으면 기억하지 않는다');
    };
    module.exports = run;
  }
  chk(/if\(open === true \|\| open === false\)\{ extra\.open = open; _roomOpenMemo = \{ room, open \}; \}/.test(CODE), 'setRoomChannel 이 쓴 open 을 기억한다');
  chk(/_touchRoomIndex\(room\);[^\n]*\n\s*_rememberRoomOpen\(room\);/.test(CODE), '입장(joinRoom) 때 open 을 읽어 둔다');
  chk(/_roomLastFriends=null;\s*_roomOpenMemo = \{ room: null, open: null \};/.test(CODE), '나가면(leaveRoom) 기억을 비운다');
}

say('── 3. 읽는 자리 · 규칙');
{
  chk(/async getRoomCounts\(opts\)\{\s*if\(opts && opts\.quick\)\{\s*const st = await _readRoomStats\(\);/.test(CODE), 'getRoomCounts 는 quick 일 때만 roomStats 를 본다');
  chk(!/async getRoomCount\([^)]*\)\{[\s\S]{0,600}_readRoomStats/.test(CODE), '정원 검사(getRoomCount)는 roomStats 를 쓰지 않는다');
  chk(/\(_svNow\(\) - s\.at\) >= ROOM_STATS_FRESH_MS\) return null;/.test(CODE) && /const ROOM_STATS_FRESH_MS = 3\*60\*1000;/.test(CODE), '3분 넘게 낡으면 무시하고 roomIndex 로 물러난다');
  let r = null; try{ r = JSON.parse(RULES).rules.roomStats; }catch(_){}
  chk(!!r && r['.read'] === true && !('.write' in r) && Object.keys(r).length === 1, '규칙: roomStats 는 읽기만 — 쓰기는 서버(Admin SDK)만');
}

(async () => {
  if(typeof module.exports === 'function') await module.exports();
  say(`\n${pass} · ${fail}`);
  process.exit(fail ? 1 : 0);
})();

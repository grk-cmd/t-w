/* ═══ 👻 sim-ghost-heal.js — 방 «유령» 복구 (2026-10-03 · 프로파일러 실측) ═══════════════════════════
   [무엇을 보는가] 연결이 살아 있는 채로 내 멤버 노드가 사라지면(옛 소켓의 onDisconnect 가 늦게 실행 ·
     같은 계정의 다른 기기가 정리) 하트비트 update 가 name/state 필수 규칙에 걸려 영원히 거부된다.
     room-ghost-heal.js 가 «거부될 때만» 확인하고 재등록하는가, firebase-init.js 가 그걸 제대로 연결했는가를 본다.
   ・1절: firebase-init.js — import · 상태 넘기기 · 하트비트 / updateMe 거부 → 복구 호출
   ・2절: room-ghost-heal.js — 복구 판단을 가짜 DB 로 돌려 본다
   [실행] firebase-init.js · room-ghost-heal.js 가 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const FI = read('firebase-init.js'), GH = read('room-ghost-heal.js');
if(!FI){ say('  ? 원본 못 찾음 — firebase-init.js'); process.exit(2); }
if(!GH){ say('  ? 원본 못 찾음 — room-ghost-heal.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(FI);

say('── 1. firebase-init.js 연결');
{
  chk(/import \{ createGhostHeal \} from "\.\/room-ghost-heal\.js";/.test(CODE), 'room-ghost-heal.js 를 import 한다');
  chk(/const _healMyMemberNode = createGhostHeal\(\{[\s\S]{0,400}state: \(\) => \(\{ room: _roomCode, mid: _memberId, memberRef: _myMemberRef, data: _myMemberData,\s*friends: _roomLastFriends, meta: _roomMetaVal \}\)/.test(CODE),
      '방 상태를 «부를 때마다» 읽는 함수로 넘긴다 (leaveRoom 이 비우는 값들)');
  chk(/update\(_myMemberRef, _hb\)\.catch\(\(\)=>_healMyMemberNode\('heartbeat'\)\)/.test(CODE), '하트비트 update 거부 → 복구 호출');
  chk(/update\(_myMemberRef, \{ \.\.\.payload, lastSeen: serverTimestamp\(\) \}\)\.catch\(\(\)=>_healMyMemberNode\('updateMe'\)\)/.test(CODE), 'updateMe update 거부 → 복구 호출');
  chk(!/from ["']https:\/\/www\.gstatic\.com/.test(strip(GH)), 'room-ghost-heal.js 는 Firebase 를 직접 import 하지 않는다');
}

say('── 2. 복구 판단 (가짜 DB 로 돌려 본다)');
(async () => {
  // ESM 파일을 그대로 함수로 — export 만 떼어 낸다
  const createGhostHeal = new Function(GH.replace(/^export function createGhostHeal/m, 'function createGhostHeal') + '\nreturn createGhostHeal;')();
  const mk = (o) => {
    const st = Object.assign({ room:'COZY-1', mid:'mABC', memberRef:'rooms/COZY-1/mABC', data:{ name:'철수', state:'idle' },
      friends:{ mX:{} }, meta:{ channel:'workingroom' } }, o.state || {});
    const env = { log:[], exists: !!o.exists, st, clock: 0 };
    env.heal = createGhostHeal({
      db:{}, ref:(_d, p) => p,
      get: async (p) => { env.log.push(['get', p]); if(o.leaveDuringGet) env.st.room = null; return { exists: () => env.exists }; },
      set: async (r, v) => { env.log.push(['set', r, v]); if(o.leaveDuringSet) env.st.room = null; },
      onDisconnect: (r) => ({ remove: () => env.log.push(['onDisconnect', r]) }),
      serverTimestamp: () => 'TS',
      touchRoomIndex: (r) => env.log.push(['roomIndex', r]),
      state: () => env.st, win: o.win || {}, now: () => env.clock,
    });
    return env;
  };
  const sets = (log) => log.filter(x => x[0] === 'set');
  const quiet = console.warn; console.warn = () => {};
  try{
    let e = mk({}); await e.heal('t');
    chk(sets(e.log).length === 1 && sets(e.log)[0][2].name === '철수' && sets(e.log)[0][2].state === 'idle' && sets(e.log)[0][2].lastSeen === 'TS',
        '노드 없음 + 방 살아 있음 → 전체(name·state) + lastSeen 으로 재등록');
    chk(e.log.some(x => x[0] === 'onDisconnect') && e.log.some(x => x[0] === 'roomIndex'), '  ↳ onDisconnect 재예약 · roomIndex 갱신');
    chk(e.log.filter(x => x[0] === 'get').length === 1 && /\/name$/.test(e.log.find(x => x[0] === 'get')[1]), '  ↳ 확인 읽기는 name 한 칸뿐');

    e = mk({ exists:true }); await e.heal('t');
    chk(sets(e.log).length === 0, '노드가 있으면(값 형식 문제) 재등록하지 않는다');

    e = mk({ state:{ meta:null, friends:{} } }); await e.heal('t');
    chk(sets(e.log).length === 0, '_meta 도 없고 다른 멤버도 없으면(방이 닫힘) 되살리지 않는다');

    e = mk({ state:{ meta:null } }); await e.heal('t');
    chk(sets(e.log).length === 1, '_meta 가 없어도 다른 멤버가 살아 있으면 재등록');

    e = mk({ win:{ _deviceSessionLost:true } }); await e.heal('t');
    chk(e.log.length === 0, '한 계정 한 기기에서 밀려났으면 아무것도 하지 않는다(읽기도 없음)');

    e = mk({ state:{ room:null } }); await e.heal('t');
    chk(e.log.length === 0, '방에 없으면 아무것도 하지 않는다');

    e = mk({ leaveDuringGet:true }); await e.heal('t');
    chk(sets(e.log).length === 0, '확인하는 사이 방을 나갔으면 재등록하지 않는다');

    e = mk({ leaveDuringSet:true }); await e.heal('t');
    chk(!e.log.some(x => x[0] === 'onDisconnect' || x[0] === 'roomIndex'), '재등록을 기다리는 사이 나갔으면 예약 · 방 목록 갱신을 건너뛴다');

    e = mk({}); await e.heal('a'); await e.heal('b');
    chk(sets(e.log).length === 1, '15초 안에 다시 불려도 한 번만 확인한다');
    e.clock = 15000; await e.heal('c');
    chk(sets(e.log).length === 2, '  ↳ 15초가 지나면 다시 확인한다');
  }finally{ console.warn = quiet; }
  done();
})().catch(err => { chk(false, '실행 오류 — ' + (err && err.message)); done(); });

function done(){
  say(fail ? `\n✗ 실패 ${fail}건` : `\n전부 통과 ✅ (${pass}건)`);
  process.exit(fail ? 1 : 0);
}

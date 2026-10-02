/* ═══ 👻 sim-ghost-heal.js — 방 «유령» 복구 (2026-10-03 · 프로파일러 실측) ═══════════════════════════
   [무엇을 보는가] 연결이 살아 있는 채로 내 멤버 노드가 사라지면(옛 소켓의 onDisconnect 가 늦게 실행 ·
     같은 계정의 다른 기기가 정리) 하트비트 update 가 name/state 필수 규칙에 걸려 영원히 거부된다.
     firebase-init.js 의 _healMyMemberNode 가 «거부될 때만» 확인하고 재등록하는가를 본다.
   ・1절: 하트비트 · updateMe 의 update 가 거부되면 복구를 부른다
   ・2절: 복구 판단 — 노드가 없고 방이 살아 있으면 재등록, 그 밖에는 손대지 않는다
   [실행] firebase-init.js 가 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const FI = read('firebase-init.js');
if(!FI){ say('  ? 원본 못 찾음 — firebase-init.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
const CODE = strip(FI);

say('── 1. 거부되면 복구를 부른다');
{
  chk(/update\(_myMemberRef, _hb\)\.catch\(\(\)=>_healMyMemberNode\('heartbeat'\)\)/.test(CODE), '하트비트 update 거부 → _healMyMemberNode(heartbeat)');
  chk(/update\(_myMemberRef, \{ \.\.\.payload, lastSeen: serverTimestamp\(\) \}\)\.catch\(\(\)=>_healMyMemberNode\('updateMe'\)\)/.test(CODE), 'updateMe update 거부 → _healMyMemberNode(updateMe)');
  chk(/let _ghostHealAt = 0, _ghostHealBusy = false;/.test(CODE), '확인 간격 · 중복 실행 표식이 모듈 범위에 있다');
}

say('── 2. 복구 판단 (가짜 DB 로 돌려 본다)');
(async () => {
  const fn = grab(FI, '_healMyMemberNode');
  chk(!!fn, '_healMyMemberNode 를 찾았다');
  if(!fn){ done(); return; }
  const mk = (env) => new Function('env', `
    let _roomCode = env.room, _memberId = env.mid, _myMemberRef = env.ref0, _myMemberData = env.data;
    let _roomLastFriends = env.friends, _roomMetaVal = env.meta;
    let _ghostHealAt = 0, _ghostHealBusy = false;
    const db = {}, window = env.window;
    const ref = (_d, p) => p;
    const get = async (p) => { env.log.push(['get', p]); return { exists: () => env.exists }; };
    const set = async (r, v) => { env.log.push(['set', r, v]); };
    const onDisconnect = (r) => ({ remove: () => env.log.push(['onDisconnect', r]) });
    const serverTimestamp = () => 'TS';
    const _touchRoomIndex = (r) => env.log.push(['roomIndex', r]);
    async ${fn}
    return _healMyMemberNode;`)(env);
  const base = (o) => Object.assign({ room:'COZY-1', mid:'mABC', ref0:'rooms/COZY-1/mABC', data:{ name:'철수', state:'idle' },
    friends:{ mX:{} }, meta:{ channel:'workingroom' }, window:{}, exists:false, log:[] }, o);
  const run = async (o) => { const e = base(o); await mk(e)('test'); return e.log; };
  const sets = (log) => log.filter(x => x[0] === 'set');

  let log = await run({});
  chk(sets(log).length === 1 && sets(log)[0][2].name === '철수' && sets(log)[0][2].state === 'idle' && sets(log)[0][2].lastSeen === 'TS',
      '노드 없음 + 방 살아 있음 → 전체(name·state) + lastSeen 으로 재등록');
  chk(log.some(x => x[0] === 'onDisconnect') && log.some(x => x[0] === 'roomIndex'), '  ↳ onDisconnect 재예약 · roomIndex 갱신');
  chk(log.filter(x => x[0] === 'get').length === 1 && /\/name$/.test(log.find(x => x[0] === 'get')[1]), '  ↳ 확인 읽기는 name 한 칸뿐');

  log = await run({ exists:true });
  chk(sets(log).length === 0, '노드가 있으면(값 형식 문제로 거부) 재등록하지 않는다');

  log = await run({ meta:null, friends:{} });
  chk(sets(log).length === 0, '_meta 도 없고 다른 멤버도 없으면(방이 닫힘) 되살리지 않는다');

  log = await run({ meta:null, friends:{ mX:{} } });
  chk(sets(log).length === 1, '_meta 가 없어도 다른 멤버가 살아 있으면 재등록');

  log = await run({ window:{ _deviceSessionLost:true } });
  chk(log.length === 0, '한 계정 한 기기에서 밀려났으면 아무것도 하지 않는다(읽기도 없음)');

  log = await run({ room:null });
  chk(log.length === 0, '방에 없으면 아무것도 하지 않는다');

  const e = base({}); const h = mk(e);
  await h('a'); await h('b');
  chk(sets(e.log).length === 1, '15초 안에 다시 불려도 한 번만 확인한다');
  done();
})().catch(err => { chk(false, '실행 오류 — ' + (err && err.message)); done(); });

function done(){
  say(fail ? `\n✗ 실패 ${fail}건` : `\n전부 통과 ✅ (${pass}건)`);
  process.exit(fail ? 1 : 0);
}

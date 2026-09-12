/* sim-fly-replay.js — 🪑 "/80 을 눌렀는데 예전에 폭탄으로 날린 사람들이 다시 날아간다"
   실행: node sim-fly-replay.js  (app.js · smoke.js 와 같은 폴더에서)

   제보(A 화면): 폭탄으로 B·C 를 날린 적이 있으면, 그 뒤 /80 을 칠 때마다 B·C 가 또 날아간다.
   원인 가설: poke 는 사람마다 한 칸뿐이고 값이 지워지지 않는다 → 낡은 스냅샷에 그 fly 가
     그대로 들어 있고, 방 스냅샷을 푸는 콜백이 async 라 늦게 끝난 낡은 것이 새 것을 덮어썼다. */
'use strict';
const fs = require('fs'), vm = require('vm');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
const cut = smokeSrc.indexOf('/* ── 실행');
smokeSrc = smokeSrc.slice(0, cut).split('\n')
  .filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

const realST = require('timers').setTimeout;
globalThis.setTimeout = (fn, ms) => realST(fn, ms || 0);
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};

const probe = `
;globalThis.__P = {
  seats,
  sync: f=>syncFriendSeats(f),
  provider: ()=>makeFirebaseProvider(),
  idFp: d=>_charIdentityFingerprint(d),
  deskFp: d=>_deskStateFingerprint(d),
  setDeser: fn=>{ deserializeDefFromNetwork = fn; },
};`;

const say = console.log; console.log = ()=>{}; console.warn = ()=>{};
try { vm.runInThisContext(fs.readFileSync('app.js', 'utf8') + probe, { filename: 'app.js' }); }
catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e).toString().split('\n').slice(0,5).join('\n')); process.exit(1); }
console.log = say;

const P = globalThis.__P;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const wait = ms => new Promise(r=>realST(r, ms));

/* 친구 좌석 두 개(B·C)를 미리 심어 둔다 — createSeat/GLB 경로를 타지 않게 직접 만든다 */
function seatFor(id){
  const s = {
    remote:true, friendId:id, friendUserId:'u_'+id, isMe:false,
    charDef:{}, group:{ children:[], getWorldPosition(v){ if(v){v.x=0;v.y=0;v.z=0;} return v; } },
    rig:{ updateMatrixWorld(){}, getWorldPosition(v){ if(v){v.x=0;v.y=0;v.z=0;} return v; },
          rotation:{x:0,y:0,z:0}, position:{x:0,y:0,z:0} },
    _lastPokeTs:null, _lastChatTs:null, _lastEquipJSON:'{}',
  };
  /* 좌석 재빌드(applyCharToSeat) 경로를 타지 않게 지문을 미리 맞춰 둔다 —
     이 검증기가 보는 것은 poke 재생 여부지 캐릭터 렌더가 아니다. */
  s._lastIdentityJSON = P.idFp({});
  s._lastDeskJSON = P.deskFp({});
  return s;
}
function world(){
  P.seats.length = 0;
  const me = { isMe:true, remote:false, charDef:{},
               group:{ children:[], getWorldPosition(v){ if(v){v.x=0;v.y=0;v.z=0;} return v; } },
               rig:{ updateMatrixWorld(){}, getWorldPosition(v){ if(v){v.x=0;v.y=0;v.z=0;} return v; },
                     rotation:{x:0,y:0,z:0}, position:{x:0,y:0,z:0} } };
  const B = seatFor('mB'), C = seatFor('mC');
  P.seats.push(me, B, C);
  return { me, B, C };
}
const snap = (pokes)=>({
  mB:{ name:'B', state:'idle', def:{}, poke: pokes.mB || null },
  mC:{ name:'C', state:'idle', def:{}, poke: pokes.mC || null },
});

(async ()=>{
const T0 = Date.now();

say('\n── 1. 폭탄으로 B·C 를 날린다');
{
  const w = world();
  w.B._lastPokeTs = T0 - 60000; w.C._lastPokeTs = T0 - 60000;
  P.sync(snap({ mB:{type:'fly:111', ts:T0-1000}, mC:{type:'fly:222', ts:T0-900} }));
  chk(!!w.B.fly && !!w.C.fly, '둘 다 날아간다 (폭탄은 정상 동작)');
  w.B.fly = null; w.C.fly = null;                     // 10초 뒤 착지했다고 치자
}

say('\n── 2. /80 — 새 poke(dance) 뒤에 낡은 스냅샷이 늦게 도착');
{
  const w = world();
  w.B._lastPokeTs = T0 - 1000; w.C._lastPokeTs = T0 - 900;
  // 새 스냅샷: 둘 다 dance
  P.sync(snap({ mB:{type:'dance:sway', ts:T0+10}, mC:{type:'dance:sway', ts:T0+11} }));
  chk(!w.B.fly && !w.C.fly, 'dance 는 아무도 날리지 않는다');
  // 늦게 도착한 낡은 스냅샷 — C 칸에 예전 fly 가 그대로 들어 있다
  P.sync(snap({ mB:{type:'dance:sway', ts:T0+10}, mC:{type:'fly:222', ts:T0-900} }));
  chk(!w.C.fly, '낡은 fly 가 다시 재생되지 않는다 ★ 제보의 그 증상');
}

say('\n── 3. 재접속처럼 아주 오래된 값이 다시 배달될 때');
{
  const w = world();
  w.B._lastPokeTs = null;                              // 좌석이 새로 생겨 아직 아무것도 못 본 상태
  P.sync(snap({ mB:{type:'fly:111', ts:T0-300000} }));  // 5분 전 값
  chk(!w.B.fly, '유통기한이 지난 값은 재생하지 않는다');
}

say('\n── 3-2. 같은 일이 때리기(bonk)에도 일어난다 — /80 이 때리기를 부르는 것처럼 보이던 것');
{
  const w = world();
  w.B._lastPokeTs = T0 - 1000;
  // 예전에 한 번 맞았다 → B 의 poke 칸에 bonk 가 남아 있다
  P.sync(snap({ mB:{ type:'bonk:u_me:3', ts:T0-800 } }));
  const bonked1 = !!w.B.bonkStart;
  w.B.bonkStart = 0;
  // /80 — 새 dance 가 들어간 뒤, 낡은 스냅샷이 늦게 도착
  P.sync(snap({ mB:{ type:'dance:sway', ts:T0+10 } }));
  P.sync(snap({ mB:{ type:'bonk:u_me:3', ts:T0-800 } }));
  say('    (예전 때리기가 실제로 재생되긴 하는가: ' + bonked1 + ')');
  chk(!w.B.bonkStart, '낡은 bonk 이 /80 때 다시 재생되지 않는다 ★ 제보의 그 증상');
}

say('\n── 4. 진짜 새 poke 는 여전히 정상 재생');
{
  const w = world();
  w.B._lastPokeTs = T0 - 1000;
  P.sync(snap({ mB:{type:'fly:333', ts:Date.now()} }));
  chk(!!w.B.fly, '새로 던진 폭탄은 그대로 날아간다');
}

say('\n── 5. 스냅샷 순서 보장 (makeFirebaseProvider)');
{
  let delivered = [];
  const api = {
    joinRoom(room, payload, onFriends){ api._onFriends = onFriends; },
    updateMe(){}, poke(){}, pokeSelf(){}, leaveRoom(){ return Promise.resolve(); },
  };
  globalThis.window = globalThis.window || globalThis;
  const prevApi = window.firebaseAPI;
  window.firebaseAPI = api; globalThis.firebaseAPI = api;

  /* def 푸는 시간을 일부러 어긋나게 만든다 — 낡은 스냅샷이 **늦게** 끝나는 상황이 사고의 조건이다 */
  let call = 0;
  P.setDeser(d=>new Promise(r=>realST(()=>r(d), (++call === 1) ? 40 : 1)));

  const pv = P.provider();
  pv.join('TEST', { def:{}, name:'나' }, fr=>{ delivered.push(fr); });

  // 낡은 스냅샷(느리게 풀림) → 새 스냅샷(빠르게 풀림) 순으로 던진다
  const slow = api._onFriends(snap({ mB:{type:'fly:222', ts:T0-900} }));
  await wait(5);
  const fast = api._onFriends(snap({ mB:{type:'dance:sway', ts:T0+10} }));
  await Promise.all([slow, fast]);
  await wait(20);

  const last = delivered[delivered.length-1];
  chk(delivered.length >= 1, '스냅샷이 전달된다 (' + delivered.length + '건)');
  chk(!!last && last.mB && last.mB.poke && last.mB.poke.type === 'dance:sway',
      '마지막으로 전달된 것이 **새** 스냅샷이다 (낡은 것이 덮어쓰지 않는다)');

  window.firebaseAPI = prevApi; globalThis.firebaseAPI = prevApi;
}

say(fail ? '\n✗ 실패 ' + fail + '건' : '\n✓ 전부 통과');
})();

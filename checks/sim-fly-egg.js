/* sim-fly-egg.js — 💃💥 깜짝쇼: 같은 춤 명령 세 번
   · /80 ×3  → 나는 춤추고 나머지는 폭발
   · /150 ×3 → 아무도 안 날아가고 회전만 두 배(터보)
   `/80/80/80` 이어쓰기 · `/80` 세 번 따로 보내기 둘 다 인정. 춤추기 버튼은 세지 않는다.
   실행: node sim-fly-egg.js  (app.js · smoke.js 와 같은 폴더에서) */
'use strict';
const fs = require('fs'), vm = require('vm');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
const cut = smokeSrc.indexOf('/* ── 실행');
smokeSrc = smokeSrc.slice(0, cut).split('\n')
  .filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

globalThis.setTimeout = (fn)=>0;      // 토스트·플로터 예약은 이 검증기의 관심사가 아니다
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};

const probe = `
;globalThis.__P = {
  seats,
  throwAt: (s,q)=>throwFlyAt(s,q),
  endFlight: (s,n)=>endFlight(s,n),
  ready: ()=>_eggReady(),
  count: ()=>_eggCmdAt.length,
  setLog: arr=>{ _eggCmdAt = arr; },
  N: EGG_DANCE_N,
  parse: t=>_parseDanceCmdChain(t),
  cmd: (c, rep)=>{ const d=_danceByCmd(c); return startMyDance(d, {cmd:c, repeat:rep||1}); },
  btn: ()=>startMyDance(DANCE_MOVES[0]),
  style: ()=>{ const m=seats.find(s=>s.isMe); return m && m.danceStyle; },
  turbo: TRICK_TURBO_STYLE,
  turns: st=>_trickTurns(st),
  TURNS: TRICK_TURNS,
  WINDOW: EGG_WINDOW_MS,
  setAdmin: v=>{ isAdmin = v; },
  setFocus: sec=>{ _focusTotalSec = sec; },
};`;

const say = console.log; console.log = ()=>{}; console.warn = ()=>{};
try { vm.runInThisContext(fs.readFileSync('app.js', 'utf8') + probe, { filename: 'app.js' }); }
catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e).toString().split('\n').slice(0,5).join('\n')); process.exit(1); }
console.log = say;

const P = globalThis.__P;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* 방을 흉내낸다 — poke 는 서버로 나가는 대신 여기 쌓인다 */
let sent = [], chatLog = [];
globalThis.window = globalThis.window || globalThis;
window._activeChannel = 2;
const api = {
  serverNow: ()=>Date.now(),
  sendChatLog: (room, m)=>{ chatLog.push(m); },
  poke: ()=>{}, joinRoom(){}, updateMe(){}, leaveRoom(){ return Promise.resolve(); },
};
window.firebaseAPI = api; globalThis.firebaseAPI = api;

vm.runInThisContext(`
  Presence.active = ()=>true;
  Presence.roomCode = ()=>'TEST';
  Presence.poke = (id,type)=>{ globalThis.__sent.push({id,type}); };
  Presence.setState = ()=>{};
  Presence.broadcastRide = ()=>{};
`, { filename: 'sim-presence-stub.js' });
globalThis.__sent = sent;

function seatFor(id){
  return { remote:true, friendId:id, friendUserId:'u_'+id, isMe:false, charDef:{},
           group:{ children:[] },
           rig:{ updateMatrixWorld(){}, getWorldPosition(v){ if(v){v.x=0;v.y=0;v.z=0;} return v; },
                 rotation:{x:0,y:0,z:0}, position:{ set(){} } } };
}
function world(n){
  P.seats.length = 0;
  const me = { isMe:true, remote:false, charDef:{}, group:{children:[]},
               rig:{ updateMatrixWorld(){}, getWorldPosition(v){ if(v){v.x=0;v.y=0;v.z=0;} return v; },
                     rotation:{x:0,y:0,z:0}, position:{ set(){} } } };
  const others = [];
  for(let i=0;i<n;i++) others.push(seatFor('m'+i));
  P.seats.push(me, ...others);
  return { me, others };
}
const flyTypes = ()=>sent.filter(x=>String(x.type).indexOf('fly:')===0);
const danceTypes = ()=>sent.filter(x=>String(x.type).indexOf('dance')===0);
const reset = ()=>{ sent.length = 0; chatLog.length = 0; };

/* 폭탄으로 전원 날리고 전원 착지시키는 흐름 */
function bombAll(w){
  w.others.forEach(s=>{ P.throwAt(s); s.fly = {}; });     // 던지고 비행 중으로 표시
  w.others.forEach(s=>{ P.endFlight(s, 0); });            // 제자리로 돌아옴
}

P.setAdmin(false); P.setFocus(3600*100);   // 레벨 충분(춤 해금)
const D = '80';                            // 검증에 쓰는 춤 명령

say('\n── 0. 한 줄 파싱');
{
  chk(!!P.parse('/80') && P.parse('/80').repeat === 1, '/80 — 평범한 춤 한 번');
  const c = P.parse('/80/80/80');
  chk(!!c && c.repeat === 3 && c.cmd === '80', '/80/80/80 — 한 줄이 세 번으로 읽힌다');
  const c2 = P.parse('/150/150/150');
  chk(!!c2 && c2.repeat === 3, '/150/150/150 도 같다');
  chk(P.parse('/80/150') === null, '섞인 줄은 명령이 아니다 — 채팅으로 흘러간다');
  chk(P.parse('/999') === null, '춤이 아닌 숫자는 그대로 둔다');
  chk(P.parse('/80/80/80 hi') === null, '뒤에 글자가 붙으면 명령이 아니다');
}

say('\n── 1. 한 번·두 번째 명령은 평범한 춤이다');
{
  const w = world(2); reset(); P.setLog([]);
  P.cmd(D);
  chk(danceTypes().length === 2 && flyTypes().length === 0, '첫 번째 — 전원에게 춤만 간다');
  reset(); P.cmd(D);
  chk(danceTypes().length === 2 && flyTypes().length === 0, '두 번째 — 아직 아무 일도 없다');
  say('    (여기까지 아무 표시도 하지 않는다 — 예고하면 깜짝쇼가 아니다)');
}

say('\n── 2. 세 번째 명령');
{
  reset();
  P.cmd(D);
  chk(flyTypes().length === 2, '나머지 전원이 날아간다 (폭탄 버튼 없이)');
  chk(danceTypes().length === 0, '춤 poke 는 안 나간다 — 한 칸을 두 값이 다투지 않게');
  chk(P.seats[0].danceUntil > 0, '나는 춤을 춘다');
  chk(chatLog.length === 0, '대화 기록을 남기지 않는다 (깜짝쇼)');
}

say('\n── 3. 터진 뒤에는 처음부터 다시 센다');
{
  chk(P.count() === 0, '카운터가 비워진다');
  reset(); P.cmd(D);
  chk(flyTypes().length === 0 && danceTypes().length === 2, '네 번째 명령은 평범한 춤이다');
  reset(); P.cmd(D); reset(); P.cmd(D);
  chk(flyTypes().length === 2, '거기서 두 번 더 치면 다시 터진다');
}

say('\n── 4. 한 줄 이어쓰기(/80/80/80)는 한 번에 터진다');
{
  const w = world(2); reset(); P.setLog([]);
  const c = P.parse('/80/80/80');
  P.cmd(c.cmd, c.repeat);
  chk(flyTypes().length === 2, '한 번 보내면 그 자리에서 전원이 날아간다');
  chk(danceTypes().length === 0, '춤 poke 는 안 나간다');
  chk(P.count() === 0, '카운터는 비워진 채로 남는다');
}

say('\n── 5. 두 번짜리 이어쓰기(/80/80)는 아직 아니다');
{
  const w = world(2); reset(); P.setLog([]);
  P.cmd(D, 2);
  chk(flyTypes().length === 0 && danceTypes().length === 2, '두 번은 평범한 춤이다');
  chk(P.count() === 2, '두 번이 쌓인다');
  reset(); P.cmd(D);
  chk(flyTypes().length === 2, '한 번만 더 치면 터진다 — 이어쓰기와 따로 보내기가 함께 센다');
}

say('\n── 6. 다른 명령이 끼면 흐름이 끊긴다');
{
  const w = world(2); reset(); P.setLog([]);
  P.cmd('80'); P.cmd('80');
  reset(); P.cmd('150');
  chk(flyTypes().length === 0, '/150 은 /80 두 번을 이어받지 않는다');
  chk(P.count() === 1, '새 명령부터 다시 센다');
}

say('\n── 7. 춤추기 버튼은 세지 않는다');
{
  const w = world(2); reset(); P.setLog([]);
  P.btn(); P.btn(); P.btn();
  chk(flyTypes().length === 0, '버튼만 눌러서는 터지지 않는다');
  chk(P.count() === 0, '카운터가 오르지 않는다');
  P.cmd(D); P.btn(); P.cmd(D);
  reset(); P.cmd(D);
  chk(flyTypes().length === 2, '사이에 버튼을 눌러도 명령 세 번이면 터진다 (흐름을 끊지 않는다)');
}

say('\n── 8. 1분이 지나면 연속이 끊긴다');
{
  const w = world(2); reset();
  P.setLog([{cmd:D, t:Date.now() - 61000}, {cmd:D, t:Date.now() - 60500}]);
  P.cmd(D);
  chk(flyTypes().length === 0 && danceTypes().length === 2, '오래된 명령은 세지 않는다');
  chk(P.count() === 1, '이번 명령 하나만 남는다');
}

say('\n── 9. 방에 아무도 없을 때 친 명령은 세지 않는다');
{
  const w = world(0); reset(); P.setLog([]);
  P.cmd(D); P.cmd(D); P.cmd(D);
  chk(P.count() === 0, '혼자 친 명령으로는 카운터가 오르지 않는다');
  say('    (세어 두면 친구가 들어오자마자 한 번에 터진다)');
}

say('\n── 10. 회사원 모드 / 다른 채널');
{
  const w = world(2); reset(); P.setLog([]);
  window._activeChannel = 1;
  P.cmd(D); P.cmd(D); P.cmd(D);
  chk(flyTypes().length === 0, '투게더룸이 아니면 터지지 않는다');
  chk(P.count() === 0, '카운터도 오르지 않는다');
  window._activeChannel = 2;
}

say('\n── 11. 쉬는 중인 사람은 건너뛴다');
{
  const w = world(2); reset(); P.setLog([]);
  w.others[0].remoteFlyCool = Date.now() + 60000;   // 연속 3회 맞아 쉬는 중
  P.cmd(D); reset(); P.cmd(D); reset(); P.cmd(D);
  chk(flyTypes().length === 1, '쉬는 사람을 빼고 한 명만 날아간다 (실제: ' + flyTypes().length + '명)');
}

say('\n── 12. /150 세 번 — 터지지 않고 회전만 두 배');
{
  const w = world(2); reset(); P.setLog([]);
  P.cmd('150'); P.cmd('150');
  chk(flyTypes().length === 0, '두 번째까지는 평범한 묘기 회전');
  chk(P.style() === 'trick', '스타일도 평범하다');
  reset(); P.cmd('150');
  chk(flyTypes().length === 0, '★ 아무도 날아가지 않는다');
  chk(P.style() === P.turbo, '★ 내 춤이 터보로 바뀐다');
  chk(danceTypes().length === 2 && danceTypes().every(x=>x.type === 'dance:'+P.turbo),
      '친구에게도 터보 스타일이 그대로 간다 — 남의 화면에서도 두 배로 돈다');
  chk(P.count() === 0, '터진 뒤 카운터는 비워진다');
  reset(); P.cmd('150');
  chk(P.style() === 'trick', '네 번째는 다시 평범한 회전이다');
}

say('\n── 13. 바퀴 수');
{
  chk(P.turns('trick') === P.TURNS, '평소 ' + P.TURNS + '바퀴');
  chk(P.turns(P.turbo) === P.TURNS * 2, '터보는 그 두 배 (' + P.turns(P.turbo) + '바퀴)');
  chk(Number.isInteger(P.turns(P.turbo)), '정수여야 시작 방향으로 정확히 돌아온다');
  const d = DANCE_MOVES.find(x=>x.cmd==='150');
  chk(!!d && d.dur === 6000, '춤 길이는 그대로 6초 — 시간이 아니라 바퀴 수가 두 배다');
}

say('\n── 14. 터보는 혼자여도 걸린다 (폭발과 달리 상대가 필요 없다)');
{
  const w = world(0); reset(); P.setLog([]);
  P.cmd('150'); P.cmd('150'); P.cmd('150');
  chk(P.style() === P.turbo, '방에 아무도 없어도 세 번이면 터보');
  const w2 = world(0); reset(); P.setLog([]);
  P.cmd('80'); P.cmd('80'); P.cmd('80');
  chk(P.count() === 0, '폭발은 여전히 혼자일 때 세지 않는다 (날릴 상대가 없다)');
}

say('\n── 15. 회사원 모드 / 다른 채널에서는 터보도 안 걸린다');
{
  const w = world(2); reset(); P.setLog([]);
  window._activeChannel = 1;
  P.cmd('150'); P.cmd('150'); P.cmd('150');
  chk(P.style() !== P.turbo, '투게더룸이 아니면 평범한 회전');
  window._activeChannel = 2;
}

say(fail ? '\n✗ 실패 ' + fail + '건' : '\n✓ 전부 통과');

/* sim-gacha-prune.js — 🎰 미보유 가챠 파츠 자동 해제(pruneUnownedGachaParts) 검증기
   실행: node sim-gacha-prune.js  (app.js · smoke.js 와 같은 폴더에서)

   제보 재현:
     · A기기에서 뽑아 착용 → B기기 연동 → 보관함은 ❔인데 화면엔 그대로 붙어 있다
     · 패치 전부터 켜져 있던 PC에서 초기화된 욕조가 계속 보인다(보관함에도 없어 해제 불가) */
'use strict';
const fs = require('fs'), vm = require('vm');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
const cut = smokeSrc.indexOf('/* ── 실행');
smokeSrc = smokeSrc.slice(0, cut).split('\n')
  .filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

const realST = require('timers').setTimeout;
globalThis.setTimeout = (fn, ms) => realST(fn, ms || 0);
globalThis.clearTimeout = require('timers').clearTimeout;
globalThis.setInterval = () => 0;          // 10분 tick 은 돌리지 않는다
globalThis.clearInterval = () => {};

const probe = `
;globalThis.__P = {
  seats, slots,
  getSaved: ()=>savedParts, setSaved: v=>{ savedParts = v; },
  getOwned: ()=>gachaOwned,  setOwned: v=>{ gachaOwned = v; },
  prune: ()=>pruneUnownedGachaParts(),
  merge: o=>mergeCatalogIntoSavedParts(o),
  stubScene: fn=>{ getPartScene = fn; },
  sync: (r,m)=>syncGachaToServer(r,m),
  catIds: (d,c)=>catEquippedIds(d,c),
  addEntry: (d,c,e)=>addEntryToCat(d,c,e),
  setAdmin: v=>{ isAdmin = v; },
};`;

const say = console.log; console.log = ()=>{}; console.warn = ()=>{};
try { vm.runInThisContext(fs.readFileSync('app.js', 'utf8') + probe, { filename: 'app.js' }); }
catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e).toString().split('\n').slice(0,5).join('\n')); process.exit(1); }
console.log = say;

const P = globalThis.__P;
/* 🪪 [CHECKS 개정 38] 이 기기는 «이미 쓰던 사용자» 다 — uid 를 심는다(부팅 **뒤**라 HAD_USER_ID_AT_BOOT 는 옛날처럼 false).
   예전엔 app.js getMyUserId() 가 첫 호출에서 uid 를 만들어 줘서 준비가 필요 없었다(회원가입 설계 §6-①).
   판정은 한 글자도 안 바꿨다. */
globalThis.localStorage.setItem('tw.myUserId', 'usimdevice0001');
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

const CAT = 'hat';
const REC = { id:'g_bath', cat:CAT, name:'욕조', gacha:true, season:'summer', stackable:true };

function freshWorld(){
  P.seats.length = 0;
  const seat = {
    isMe:true, remote:false,
    charDef:{ equippedParts:{}, partXfMemory:{} },
    group:{ children:[], add(){}, remove(){}, traverse(){} },
    equippedPartObjs:{}, stackedPartObjs:{},
  };
  P.addEntry(seat.charDef, CAT, { id:REC.id, xf:null });
  P.seats.push(seat);
  return seat;
}
const wearing = seat => P.catIds(seat.charDef, CAT).includes(REC.id);

/* 서버 스텁 — owned 를 비운 채 읽기에 성공한다(= B기기 / 초기화된 계정) */
function serverStub({ readOk = true, owned = {}, ts = 0, delay = 0 } = {}){
  globalThis.window = globalThis.window || globalThis;
  window.firebaseAPI = {
    loadGachaOwned: () => new Promise(res => realST(()=>res(readOk ? { owned, ts } : null), delay)),
    saveGachaOwned: () => Promise.resolve(true),
  };
  globalThis.firebaseAPI = window.firebaseAPI;
}

(async ()=>{
say('\n── 1. 카탈로그가 준비된 상태 (정상 경로)');
{
  P.setSaved([REC]); P.setOwned({}); P.setAdmin(false);
  const seat = freshWorld();
  serverStub({ owned:{}, ts: Date.now() });
  await P.sync('inv-open');
  await new Promise(r=>realST(r, 30));
  chk(!wearing(seat), '보유 0인 가챠 파츠가 착용 목록에서 빠진다');
}

say('\n── 2. 부팅 경쟁 — 카탈로그(savedParts)가 아직 안 내려왔을 때');
{
  P.setSaved([]); P.setOwned({}); P.setAdmin(false);
  P.stubScene(()=>Promise.reject(new Error('GLB 없음')));   // 부착은 이 검증기의 관심사가 아니다
  const seat = freshWorld();
  serverStub({ owned:{}, ts: Date.now() });
  await P.sync('boot');
  await new Promise(r=>realST(r, 30));
  say('    (이 시점엔 카탈로그가 없어 회수가 물러난다 — 착용 유지: ' + wearing(seat) + ')');

  // 카탈로그가 뒤늦게 도착하는 실제 경로(구독 콜백)로 넣는다
  try{ P.merge({ [REC.id]: { cat:REC.cat, name:REC.name, gacha:true, season:REC.season, stackable:true } }); }
  catch(e){ say('    ⚠ mergeCatalogIntoSavedParts 실패: ' + e.message); }
  await new Promise(r=>realST(r, 30));
  chk(!wearing(seat), '카탈로그가 도착한 그 순간 정리된다');
}

say('\n── 3. 서버 읽기 실패 (오프라인 부팅) — 설계상 정리하지 않는 것이 맞다');
{
  P.setSaved([REC]); P.setOwned({}); P.setAdmin(false);
  const seat = freshWorld();
  serverStub({ readOk:false });
  await P.sync('boot');
  await new Promise(r=>realST(r, 30));
  chk(wearing(seat), '보유분을 모르면 벗기지 않는다(의도된 동작)');
}

say('\n── 4. 재진입 가드 — 느린 부팅 동기화 중에 보관함을 열면');
{
  P.setSaved([REC]); P.setOwned({}); P.setAdmin(false);
  const seat = freshWorld();
  serverStub({ owned:{}, ts: Date.now(), delay: 300 });
  const boot = P.sync('boot');            // 진행 중
  await new Promise(r=>realST(r, 50));
  await P.sync('inv-open');               // 사용자가 T키를 누른 순간 — 삼켜지지만 적어 둔다
  await new Promise(r=>realST(r, 20));
  say('    (읽기가 끝나기 전엔 판단하지 않는다 — 착용 유지: ' + wearing(seat) + ')');
  await boot; await new Promise(r=>realST(r, 100));
  chk(!wearing(seat), '읽기가 끝나는 즉시 맞춰진다(삼켜진 요청이 재시도된다)');
}

say('\n── 5. 카탈로그에서 사라진 파츠 (시즌 종료·이관 중) — 의도된 미지원');
{
  P.setSaved([{ id:'other', cat:CAT, gacha:true }]);   // g_bath 레코드가 없다
  P.setOwned({}); P.setAdmin(false);
  const seat = freshWorld();
  serverStub({ owned:{}, ts: Date.now() });
  await P.sync('inv-open');
  await new Promise(r=>realST(r, 30));
  say((wearing(seat) ? '  · ' : '  ✓ ') + '카탈로그에 없는 착용 파츠 — 조회 실패를 「가챠 아님」으로 단정하지 않는 관례라 남는다');
}

say('\n── 6. gacha 플래그가 지워진 파츠 (migrate 사고 흔적) — 의도된 미지원');
{
  P.setSaved([{ id:'g_bath', cat:CAT, name:'욕조' }]);  // gacha:false
  P.setOwned({}); P.setAdmin(false);
  const seat = freshWorld();
  serverStub({ owned:{}, ts: Date.now() });
  await P.sync('inv-open');
  await new Promise(r=>realST(r, 30));
  say((wearing(seat) ? '  · ' : '  ✓ ') + 'gacha 플래그를 잃은 파츠 — 같은 이유로 남는다(카탈로그 완료 신호가 생기면 열 수 있다)');
}

say('\n── 7. 서버 ts 가 미래로 오염된 상태 — 내 파츠를 벗기면 안 된다');
{
  P.setSaved([REC]); P.setOwned({ [REC.id]: 2 }); P.setAdmin(false);
  const seat = freshWorld();
  serverStub({ owned:{}, ts: Date.now() + 60*60*1000 });   // 서버는 비었고 ts 만 1시간 미래
  await P.sync('boot');
  await new Promise(r=>realST(r, 60));
  chk(wearing(seat), '오염된 서버 값에 속아 착용을 벗기지 않는다');
  chk((P.getOwned()[REC.id]|0) === 2, '보유분도 그대로 남는다');
}

say(fail ? '\n✗ 실패 ' + fail + '건' : '\n✓ 전부 통과');
})();

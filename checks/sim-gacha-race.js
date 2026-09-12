/* sim-gacha-race.js — 🎰 가챠 파츠 재장착 검증기 (핸드오프 §2)
   실행:  node sim-gacha-race.js   (app.js · smoke.js 와 같은 폴더에서)

   ★ 무엇을 잡았는가 — 핸드오프의 "비동기 커밋 경쟁" 가설이 아니라 결정론적 버그였다.
     equipPartOnSeat 도입부가 stackedPartObjs[cat]={} 를 보장해도, 바로 아래
     unequipStackablePart(같은 id 재장착 정리)가 카테고리의 마지막 파츠를 지우면서 맵째
     delete 한다. 부착 지점의 대입이 TypeError → try/catch 가 삼켜 재장착이 조용히 실패.
     가챠 파츠(stackable 강제 + 카테고리에 보통 혼자)는 커밋(창 닫기)마다
     붙음↔사라짐이 번갈았다 — 수정 전 판본에서 이 검증기가 1✓ 2✗ 3✓ 4✗ 를 그대로 찍는다.

   ★ 무엇을 보는가
     · 순차 커밋과 세 가지 겹침(파싱 지연 조합)에서 파츠가 끝까지 붙어 있는가
     · 커밋 4연속(보관함 닫기 → 꾸미기 열닫 → 보관함 열닫의 실사용 사이클)
   ⚠ smoke.js 의 스텁을 빌려 쓴다 — smoke.js 와 같은 폴더에 있어야 한다.
   ⚠ getPartScene 은 지연 조절용 스텁이다. 실제 GLB 파싱·렌더링은 여기서 확인하지 않는다. */
'use strict';
const fs = require('fs'), vm = require('vm');

/* smoke.js 에서 "실행" 구간 앞까지(스텁 정의)만 잘라 평가 */
let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
const cut = smokeSrc.indexOf('/* ── 실행');
smokeSrc = smokeSrc.slice(0, cut)
  .split('\n')
  .filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l))
  .join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

/* 진짜 타이머가 필요하다 — 경쟁은 시간 위에서 일어난다 */
const realST = require('timers').setTimeout;
globalThis.setTimeout = (fn, ms) => realST(fn, ms || 0);
globalThis.clearTimeout = require('timers').clearTimeout;

const probe = `
;globalThis.__P = {
  seats, findMySeat, commitWdDraft, ensureWdDraft, addEntryToCat, partCatInfo,
  getSaved: ()=>savedParts, setSaved: v=>{ savedParts=v; },
  stubScene: fn=>{ getPartScene = fn; },
  draft: ()=>wdDraftDef,
};`;

const say = console.log; console.log = ()=>{}; console.warn = ()=>{};
try {
  vm.runInThisContext(fs.readFileSync('app.js', 'utf8') + probe, { filename: 'app.js' });
} catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e).toString().split('\n').slice(0,4).join('\n')); process.exit(1); }
console.log = say;

const P = globalThis.__P;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* ── 가짜 좌석 ── */
function makeSeat(){
  return {
    isMe: true, remote: false,
    charDef: { equippedParts: {}, partXfMemory: {} },
    bones: { head: { add(){}, }, spine: { add(){} } },
    boneRest: { ear: [] },
    group: { children: [], add(){}, remove(){}, traverse(){} },
    equippedPartObjs: {}, stackedPartObjs: {},
  };
}

const CAT = (P.partCatInfo('hat') && 'hat') || (typeof PART_CATS !== 'undefined' && PART_CATS[0].cat);
if(!P.partCatInfo(CAT)){ say('✗ 카테고리 정보를 못 찾음'); process.exit(1); }

const REC = { id: 'g1', cat: CAT, name: '가챠모자', glb: 'AAAA', gacha: true, stackable: true };
P.setSaved([REC]);

/* getPartScene 스텁 — 호출마다 지연을 다르게 줄 수 있다 */
let delays = [], calls = 0;
P.stubScene(async rec => {
  const d = delays[calls++] != null ? delays[calls-1] : 5;
  await new Promise(r => realST(r, d));
  return { scene: globalThis.THREE.Group(), animations: [] };
});

async function scenario(d1, d2, gapMs, label){
  P.seats.length = 0;
  const seat = makeSeat(); P.seats.push(seat);
  /* draft 를 새로 세우고 파츠를 얹는다 */
  const old = P.draft(); if(old) old._srcDef = null;   // 강제 재생성
  const def = P.ensureWdDraft();
  def.equippedParts = {}; P.addEntryToCat(def, CAT, { id: 'g1', xf: { scale:1, pos:[0,0,0], rot:[0,0,0] } });
  delays = [d1, d2]; calls = 0;
  const c1 = P.commitWdDraft(true);
  await new Promise(r => realST(r, gapMs));
  const c2 = P.commitWdDraft(true);
  await Promise.all([c1, c2]);
  await new Promise(r => realST(r, Math.max(d1, d2) + 30));
  const attached = !!(seat.stackedPartObjs[CAT] && seat.stackedPartObjs[CAT]['g1']);
  say('  · ' + label + ' → 부착 ' + (attached ? '있음' : '없음') + ' (getPartScene ' + calls + '회)');
  return attached;
}

(async () => {
  say('=== §2 commitWdDraft — 수정 검증 ===');
  chk(await scenario(5, 5, 40, '순차(겹침 없음)'), '순차 커밋 — 파츠가 붙는다');
  chk(await scenario(50, 5, 10, '겹침 A'), '겹침 A — 파츠가 붙는다');
  chk(await scenario(50, 60, 10, '겹침 B'), '겹침 B — 파츠가 붙는다');
  chk(await scenario(80, 5, 40, '겹침 C'), '겹침 C — 파츠가 붙는다');

  /* 실사용 사이클 — 보관함 닫기 → 꾸미기 열닫 → 보관함 열닫 = 커밋 4연속.
     예전 코드는 홀수 번째만 붙고 짝수 번째는 사라졌다(번갈이 증상). */
  P.seats.length = 0;
  const seat = makeSeat(); P.seats.push(seat);
  const old = P.draft(); if(old) old._srcDef = null;
  const def = P.ensureWdDraft();
  def.equippedParts = {}; P.addEntryToCat(def, CAT, { id:'g1', xf:{ scale:1, pos:[0,0,0], rot:[0,0,0] } });
  delays = []; calls = 0;
  for(let i = 1; i <= 4; i++){
    await P.commitWdDraft(true);
    await new Promise(r => realST(r, 30));
    chk(!!(seat.stackedPartObjs[CAT] && seat.stackedPartObjs[CAT]['g1']),
        i + '번째 커밋 뒤에도 파츠가 붙어 있다');
  }
  say('');
  if(fail){ say('문제 ' + fail + '건'); process.exit(1); }
  say('§2 전부 통과 ✅');
  process.exit(0);
})().catch(e => { say('✗ 실험 자체가 죽음: ' + (e && e.stack || e)); process.exit(1); });

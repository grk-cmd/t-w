/* sim-part-color-entry.js — 🎨 꾸미기창 하단 색상 영역: "색칠 대상 메쉬"와 "저장 대상 entry" 가
   같은 파츠를 가리키는가 (핸드오프 ② 후보 ⓐ)

   실행:  node sim-part-color-entry.js   (app.js · smoke.js 와 같은 폴더에서)

   ★ 무엇을 보는가
     refreshWdPreviewColorSection 은 두 값을 **서로 다른 근거로** 고른다.
       저장 대상 entry  = activeWdAdj 의 id  또는  firstEntryForCat(카테고리의 첫 entry)
       색칠 대상 wrapper = stackedPartObjs[activeWdAdj.id]  또는  equippedPartObjs[cat](non-stackable 메인)
     우클릭을 안 한 상태(activeWdAdj=null)에서는 앞은 "첫 entry", 뒤는 "메인 wrapper" 라
     **카테고리에 파츠가 둘 이상 있으면 어긋난다.** 어긋나면 화면에서는 A 가 물들고
     저장은 B 에 붙는다 = "바꿀 때는 되는데 저장하면 초기화".

   ★ 왜 유저마다 다른가 — 어긋남의 조건이 **착용 조합과 착용 순서**다. 카테고리에 파츠가
     하나뿐이면 항상 일치하므로 개발자 화면에서는 멀쩡하다.

   ⚠ smoke.js 의 스텁을 빌려 쓴다 — smoke.js 와 같은 폴더에 있어야 한다.
   ⚠ 렌더링·머티리얼은 확인하지 않는다. 이 검증기가 보는 것은 "짝이 맞는가" 하나다. */
'use strict';
const fs = require('fs'), vm = require('vm');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
smokeSrc = smokeSrc.slice(0, smokeSrc.indexOf('/* ── 실행'))
  .split('\n').filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

const probe = `
;globalThis.__P = {
  refresh: ()=>refreshWdPreviewColorSection(),
  setSaved: v=>{ savedParts = v; },
  setPreview: v=>{ wdPreviewBase = v; },
  setTab: v=>{ currentWdTab = v; },
  setAdj: v=>{ activeWdAdj = v; },
  setGachaOpen: fn=>{ _gachaInvOpen = fn; },
  setGachaSel: v=>{ _gachaSelId = v; },
  setOwned: v=>{ gachaOwned = v; },
  wrapBuildColorRows: fn=>{ const o = buildColorRows; buildColorRows = (...a)=>{ fn(...a); return o(...a); }; },
};`;

const say = console.log; console.log = () => {}; console.warn = () => {};
try { vm.runInThisContext(fs.readFileSync('app.js', 'utf8') + probe, { filename: 'app.js' }); }
catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e)); process.exit(1); }
console.log = say;

const P = globalThis.__P;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* ── 관측: buildColorRows 가 받은 (xf, wrapper) 를 기록한다 ────────────── */
let seen = null;
P.wrapBuildColorRows((cat, xf, wrapper) => {
  seen = { cat, xfOwner: xf && xf.__owner, wrapperOwner: wrapper && wrapper.userData && wrapper.userData.partId };
});

/* ── 가짜 파츠 · 가짜 wrapper ─────────────────────────────────────────── */
const mesh = () => ({ material: { color: { set(){} }, userData: {} }, userData: { origColor: 'ffffff' } });
const wrap = id => ({ userData: { partId: id, cat: 'hat', colorGroups: { col1: [mesh()] } } });
const entry = id => ({ id, xf: { scale: 1, pos: [0,0,0], rot: [0,0,0], color: {}, __owner: id } });

/* rec 목록 — 귀 파츠는 🔗 stackable, 평범한 모자는 일반 */
P.setSaved([
  { id: 'ear',  cat: 'hat', name: '귀',   stackable: true  },
  { id: 'cap',  cat: 'hat', name: '모자', stackable: false },
]);

function scene({ entries, main, stacked }) {
  seen = null;
  P.setPreview({
    charDef: { equippedParts: { hat: entries } },
    equippedPartObjs: main ? { hat: wrap(main) } : {},
    stackedPartObjs: stacked ? { hat: Object.fromEntries(stacked.map(id => [id, wrap(id)])) } : {},
  });
  P.setTab('hat'); P.setAdj(null); P.setGachaOpen(() => false);
  P.refresh();
  return seen;
}

say('\n=== 1. 귀 파츠만 착용 (카테고리에 하나) ===');
{
  const r = scene({ entries: entry('ear'), main: null, stacked: ['ear'] });
  chk(!!r, '색상 영역이 뜬다');
  if (r) chk(r.xfOwner === r.wrapperOwner, '저장 대상(' + r.xfOwner + ') = 색칠 대상(' + r.wrapperOwner + ')');
}

say('\n=== 2. 평범한 모자만 착용 ===');
{
  const r = scene({ entries: entry('cap'), main: 'cap', stacked: null });
  chk(!!r, '색상 영역이 뜬다');
  if (r) chk(r.xfOwner === r.wrapperOwner, '저장 대상(' + r.xfOwner + ') = 색칠 대상(' + r.wrapperOwner + ')');
}

say('\n=== 3. 귀 파츠를 먼저 쓰고 모자를 덧썼다 (entry 순서 [귀, 모자]) ===');
{
  const r = scene({ entries: [entry('ear'), entry('cap')], main: 'cap', stacked: ['ear'] });
  chk(!!r, '색상 영역이 뜬다');
  if (r) chk(r.xfOwner === r.wrapperOwner,
    '저장 대상(' + r.xfOwner + ') = 색칠 대상(' + r.wrapperOwner + ')');
}

say('\n=== 4. 모자를 먼저 쓰고 귀 파츠를 덧썼다 (entry 순서 [모자, 귀]) ===');
{
  const r = scene({ entries: [entry('cap'), entry('ear')], main: 'cap', stacked: ['ear'] });
  chk(!!r, '색상 영역이 뜬다');
  if (r) chk(r.xfOwner === r.wrapperOwner,
    '저장 대상(' + r.xfOwner + ') = 색칠 대상(' + r.wrapperOwner + ')');
}

say('\n=== 5. 🎰 보관함(T)에서 귀 파츠를 고른 상태 — 모자도 같이 착용 중 ===');
{
  seen = null;
  P.setSaved([
    { id: 'ear', cat: 'hat', name: '귀', stackable: true, gacha: true },
    { id: 'cap', cat: 'hat', name: '모자', stackable: false },
  ]);
  P.setPreview({
    charDef: { equippedParts: { hat: [entry('cap'), entry('ear')] } },
    equippedPartObjs: { hat: wrap('cap') },
    stackedPartObjs: { hat: { ear: wrap('ear') } },
  });
  P.setTab('hat'); P.setAdj(null);
  P.setOwned({ ear: 99 });   // 색상 게이트(4개 수집)는 통과시킨다 — 여기서 보려는 건 게이트가 아니다
  P.setGachaOpen(() => true); P.setGachaSel('ear');
  try { P.refresh(); } catch (e) { say('  (refresh 예외: ' + e.message + ')'); }
  const r = seen;
  if (!r) { chk(false, '색상 영역이 뜬다 (색상 게이트에 막혔으면 이 검사 자체가 무의미하다)'); }
  else chk(r.xfOwner === r.wrapperOwner,
    '저장 대상(' + r.xfOwner + ') = 색칠 대상(' + r.wrapperOwner + ')');
}

say('');
/* ⚠️ 마지막 줄은 러너가 읽는다 — run.js 의 FAIL_LINE 은 **줄 전체가 그 말일 때만**,
     PASS_LINE 은 `전부 통과` 라는 말로 가른다. 설명은 윗줄에 두고 판정만 마지막에 남긴다.
     옛 판은 설명과 숫자를 한 줄에 붙여 놔서 둘 다 안 걸렸고 종료코드로만 갈렸다. */
say(fail ? '  저장 대상과 색칠 대상이 어긋나는 착용 조합이 있다'
         : '  모든 착용 조합에서 저장 대상과 색칠 대상이 같은 파츠를 가리킨다');
if (fail){ say('✗ 실패 ' + fail + '건'); process.exit(1); }
say('전부 통과 ✅');

/* ═══ 🪑 sim-license-leak.js — 라이선스 전용 자산이 새는 자리 (제보 2 · 2026-09-18) ═════════
   [무엇을 지키나]
     [제보] 제보자(맥·보유자) 화면에서 친구(윈도우·미보유)가 가판대 책상을 착용한 것으로 보인다.
       친구 화면에는 안 보이고, 재입장·재시작에도 유지된다.
     [원인] 게이트가 **그리기만 막고 저장·전파는 안 막았다.** 게이트에 걸린 쪽이
       charDef.deskCatalogId 를 그대로 들고 있었고, 그 값이 serializeDefForNetwork
       (Object.assign 통째 복사)를 타고 방으로 나갔다. 받는 쪽은 seat.remote 라 게이트 없이 그린다.
     [대응] 지우지 않고 **접어 둔다** — deskCatalogId → deskLicenseHold 로 옮겨 적고,
       전파에서는 뺀다. 라이선스가 켜지면 restoreLicenseHeldAssets 가 되돌린다.

   ・1절: 접기 함수를 **떼어 와 실행한다** — 카탈로그 미도착엔 물러나고, 보유자·관리자는 건너뛰고,
          전용 자산만 옮기고, 남의 좌석은 안 건드린다.
   ・2절: 접기 ↔ 되돌리기가 **한 쌍**이고 왕복이 손실 없이 돈다.
   ・3절: 전파 차단 — serializeDefForNetwork 가 접어 둔 두 필드를 뺀다.
   ・4절: 입구 — 공유 코드 · 슬롯 복원 · 프리셋 · 카탈로그 도착 넷에서 부른다.
   ・5절: 되돌아가면 안 되는 것들 — 남의 좌석 게이트 없음 유지 · 지우지 않고 옮기기 · 위조 방어 아님.
   ・6절: A안 이전 — 전용 책상은 꾸미기창 «책상» 탭에만, 5단계에는 무료 책상만(관리자는 예외).

   ⚠️ 이 검사는 `sim-premium-desk.js` 와 짝이다. 그쪽은 «그리기 게이트가 옳은가»,
      이쪽은 «게이트에 걸린 뒤 저장값이 어떻게 되는가» 를 본다. 한쪽만 보면 제보가 되살아난다.
   [실행] app.js 가 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const vm = require('vm');
const SRC = fs.readFileSync('app.js', 'utf8');

let pass = 0, fail = 0, huhs = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const huh = (msg) => { huhs++; say('  ? ' + msg); };

function grabFn(name){
  const i = SRC.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let k = SRC.indexOf('{', i), d = 0;
  for(; k < SRC.length; k++){
    if(SRC[k] === '{') d++;
    else if(SRC[k] === '}' && --d === 0) return SRC.slice(i, k + 1);
  }
  return null;
}

/* ── 0. 재료가 다 있나 ── */
const fnPrune   = grabFn('pruneUnownedLicenseAssets');
const fnRestore = grabFn('restoreLicenseHeldAssets');
const fnLockD   = grabFn('_licenseLockedDeskId');
const fnLockI   = grabFn('_licenseLockedItemId');
const constHold = /const DESK_LICENSE_HOLD = '([^']+)';\s*\nconst ITEM_LICENSE_HOLD = '([^']+)';/.exec(SRC);

/* ── 1. 접기 — 떼어 와 실행한다 ── */
say('── 1. 접기(pruneUnownedLicenseAssets) — 실제로 돌려서 본다');
let ctx = null;
if(!fnPrune || !fnRestore || !fnLockD || !fnLockI || !constHold){
  huh('접기/되돌리기 함수나 HOLD 상수를 못 찾음 — 이름이 바뀌었으면 이 검사도 같이 고칠 것');
} else {
  const makeCtx = (opts) => {
    const c = {
      console: { warn(){}, log(){} },
      isPremium: !!opts.premium,
      isAdmin: !!opts.admin,
      savedDesks: opts.desks || [],
      savedItems: opts.items || [],
      seats: opts.seats || [],
      slots: opts.slots || [],
      cBase: opts.cBase || null,
      DEFAULT_DESK_OVERRIDE_ID: '__default_desk__',
      _redrawn: [], _unequipped: [], _saved: 0, _pushed: 0,
    };
    c.applyDeskCatalogRefToSeat = (s, def) => { c._redrawn.push(def.deskCatalogId); };
    c.deskItemDef = (id) => ({ id, name: id });
    c.equipDeskItem = (h, d, on) => { if(!on) c._unequipped.push(d.id); };
    c.saveSlots = () => { c._saved++; };
    c.findMySeat = () => (c.seats.find(s => s && s.isMe) || null);
    c.Presence = { active: () => true, updateDef: () => { c._pushed++; } };
    vm.createContext(c);
    vm.runInContext(constHold[0] + '\n' + fnLockD + '\n' + fnLockI + '\n' + fnPrune + '\n' + fnRestore, c);
    return c;
  };
  ctx = makeCtx;

  const LOCKED = [{ id: 'desk_gaming', licenseOnly: true }, { id: 'desk_wood' }];
  const LOCKI  = [{ id: 'item_neon', licenseOnly: true }, { id: 'item_cup' }];
  const mkDef  = () => ({ deskCatalogId: 'desk_gaming', deskItems: { item_neon: { adj: {} }, item_cup: { adj: {} } } });

  /* (가) 카탈로그가 아직 안 왔으면 아무 일도 없어야 한다 — 가장 중요한 가드 */
  {
    const d = mkDef();
    const c = makeCtx({ desks: [], items: [], slots: [d] });
    const n = vm.runInContext('pruneUnownedLicenseAssets()', c);
    chk(n === 0 && d.deskCatalogId === 'desk_gaming',
      '★ 카탈로그 미도착 → 아무것도 안 접는다 (조회 실패를 «전용 아님»으로도 «전용»으로도 단정하지 않는다)');
  }
  /* (나) 라이선스 보유자·관리자는 통째로 건너뛴다 */
  {
    const d = mkDef();
    const c = makeCtx({ premium: true, desks: LOCKED, items: LOCKI, slots: [d] });
    chk(vm.runInContext('pruneUnownedLicenseAssets()', c) === 0 && d.deskCatalogId === 'desk_gaming',
      '라이선스 보유자는 건드리지 않는다');
    const d2 = mkDef();
    const c2 = makeCtx({ admin: true, desks: LOCKED, items: LOCKI, slots: [d2] });
    chk(vm.runInContext('pruneUnownedLicenseAssets()', c2) === 0 && d2.deskCatalogId === 'desk_gaming',
      '관리자도 건드리지 않는다 (등록·검수 절차가 보유 없이 착용한다)');
  }
  /* (다) 미보유자 — 전용만 접고 무료는 그대로 */
  {
    const d = mkDef();
    const c = makeCtx({ desks: LOCKED, items: LOCKI, slots: [d] });
    const n = vm.runInContext('pruneUnownedLicenseAssets()', c);
    chk(n === 2, '전용 책상 1 + 전용 아이템 1 = 2개를 접었다 (실제 ' + n + ')');
    chk(d.deskCatalogId === null, '내 저장값에서 전용 책상 참조가 빠졌다');
    chk(d[constHold[1]] === 'desk_gaming', '★ 지운 것이 아니라 ' + constHold[1] + ' 로 옮겨 적었다 (라이선스가 오면 돌아와야 한다)');
    chk(!(d.deskItems && d.deskItems.item_neon), '전용 아이템도 빠졌다');
    chk(!!(d.deskItems && d.deskItems.item_cup), '★ 무료 아이템은 그대로다');
    chk(d[constHold[2]] && d[constHold[2]].item_neon, '전용 아이템도 ' + constHold[2] + ' 로 옮겨 적었다');
    chk(c._saved > 0, '접은 뒤 저장한다 (다음 부팅에도 유지)');
  }
  /* (라) 남의 좌석은 절대 건드리지 않는다 — 되돌리면 옛 제보가 되살아난다 */
  {
    const mine  = { isMe: true,  charDef: mkDef() };
    const other = { remote: true, charDef: mkDef() };
    const c = makeCtx({ desks: LOCKED, items: LOCKI, seats: [mine, other] });
    vm.runInContext('pruneUnownedLicenseAssets()', c);
    chk(mine.charDef.deskCatalogId === null, '내 좌석은 접힌다');
    chk(other.charDef.deskCatalogId === 'desk_gaming',
      '★ 친구 좌석(remote)은 그대로다 — 남의 라이선스는 남의 기기가 판단한다 (예전 제보)');
    chk(c._redrawn.length === 1 && c._redrawn[0] === '__default_desk__',
      '내 좌석만 기본 책상으로 다시 그렸다');
    chk(c._unequipped.length === 1 && c._unequipped[0] === 'item_neon',
      '내 좌석의 전용 아이템만 내렸다');
    chk(c._pushed > 0, '★ 방에 있으면 즉시 다시 내보낸다 — 이 한 줄이 친구 화면에서 사라지게 한다');
  }
  /* (마) 멱등 — 좌석과 슬롯이 같은 객체여도 두 번 세지 않는다 */
  {
    const d = mkDef();
    const c = makeCtx({ desks: LOCKED, items: LOCKI, seats: [{ isMe: true, charDef: d }], slots: [d] });
    const n1 = vm.runInContext('pruneUnownedLicenseAssets()', c);
    const n2 = vm.runInContext('pruneUnownedLicenseAssets()', c);
    chk(n1 === 2 && n2 === 0, '★ 같은 객체(seat.charDef === slots[i])를 두 번 세지 않고, 다시 불러도 0이다');
  }
}

/* ── 2. 접기 ↔ 되돌리기는 한 쌍 ── */
say('── 2. 되돌리기(restoreLicenseHeldAssets) — 라이선스가 오면 그대로 돌아온다');
if(!ctx){ huh('1절에서 재료를 못 찾아 건너뜀'); }
else{
  const LOCKED = [{ id: 'desk_gaming', licenseOnly: true }];
  const LOCKI  = [{ id: 'item_neon', licenseOnly: true }];
  const d = { deskCatalogId: 'desk_gaming', deskItems: { item_neon: { adj: { scale: 3 } } } };
  const c = ctx({ desks: LOCKED, items: LOCKI, slots: [d] });
  vm.runInContext('pruneUnownedLicenseAssets()', c);
  vm.runInContext('isPremium = true;', c);                   // 키 등록 · 계정 복원 · 재검증 성공
  const n = vm.runInContext('restoreLicenseHeldAssets()', c);
  chk(n === 2, '되돌린 개수 2 (실제 ' + n + ')');
  chk(d.deskCatalogId === 'desk_gaming', '★ 책상 참조가 그대로 돌아왔다');
  chk(!!(d.deskItems && d.deskItems.item_neon && d.deskItems.item_neon.adj.scale === 3),
    '★ 아이템은 조정값(크기·위치)까지 그대로다 — 접어 둘 때 통째로 옮겼기 때문');
  chk(d[constHold[1]] === undefined && d[constHold[2]] === undefined, '접어 둔 필드는 비워진다 (두 번 돌아오지 않는다)');
}
const refresh = grabFn('_refreshPremiumGatedUI') || '';
chk(/restoreLicenseHeldAssets\(\)/.test(refresh), '_refreshPremiumGatedUI 가 되돌리기를 부른다');
chk(/pruneUnownedLicenseAssets\(\)/.test(refresh), '_refreshPremiumGatedUI 가 접기를 부른다');
{
  const ri = refresh.indexOf('restoreLicenseHeldAssets()');
  const pi = refresh.indexOf('pruneUnownedLicenseAssets()');
  chk(ri > 0 && pi > ri, '★ 되돌리기가 접기보다 **먼저**다 — 거꾸로면 라이선스를 켠 순간 접은 것을 다시 접는다');
  const ai = refresh.indexOf('applyDeskCatalogRefToSeat');
  chk(ai > pi, '  둘 다 «다시 그리기»보다 앞이다 (저장값을 맞춘 뒤에 그린다)');
}

/* ── 3. 전파 차단 ── */
say('── 3. 접어 둔 값은 방으로 안 나간다');
const ser = grabFn('serializeDefForNetwork') || '';
if(!ser){ huh('serializeDefForNetwork 를 못 찾음'); }
else{
  chk(/delete out\[DESK_LICENSE_HOLD\]/.test(ser), '★ 책상 hold 를 전송 payload 에서 뺀다');
  chk(/delete out\[ITEM_LICENSE_HOLD\]/.test(ser), '★ 아이템 hold 를 전송 payload 에서 뺀다');
  chk(/Object\.assign\(\{\}, def\)/.test(ser),
    '  통째 복사 구조는 그대로다 — 새 로컬 필드를 def 에 추가하면 여기서도 지워야 한다는 뜻');
}

/* ── 4. 입구 넷에서 부른다 ── */
say('── 4. 불러오기·도착 자리에서 부른다');
const callSites = [...SRC.matchAll(/pruneUnownedLicenseAssets\(\)/g)].length;
chk(callSites >= 6, '호출 ' + callSites + '곳 (정의 1 + _refreshPremiumGatedUI + 책상/아이템 카탈로그 + 슬롯 + 코드 = 6 이상)');
const around = (needle, span) => {
  const i = SRC.indexOf(needle);
  return i < 0 ? '' : SRC.slice(i, i + span);
};
chk(/pruneUnownedLicenseAssets/.test(around('function loadSlots()', 6000)),
  '★ 슬롯 복원 — 저장값에 남아 있던 전용 자산을 접는다');
chk(/pruneUnownedLicenseAssets[\s\S]{0,400}saveSlots\(\);saveCurSlot\(\)/.test(SRC),
  '★ 공유 코드 불러오기 — **저장 전에** 접는다 (받는 쪽에 라이선스 검사가 없었다)');
chk(/pruneUnownedLicenseAssets/.test(around('function mergeCatalogIntoSavedDesks', 4000)),
  '★ 책상 카탈로그 도착 — licenseOnly 를 알 수 있는 첫 순간');
chk(/pruneUnownedLicenseAssets/.test(around('function mergeCatalogIntoSavedItems', 4000)),
  '★ 아이템 카탈로그 도착 — 같은 이유');
const preset = grabFn('applyDeskPreset') || '';
chk(/_licenseLockedDeskId\(p\.deskCatalogId\)/.test(preset),
  '★ 프리셋 — 전용 책상이면 activeCustomDeskId 를 세우지 않는다 (crDone 이 그것을 굳힌다)');
/* ⚠️ 주석에도 «licenseOnly:false» 라는 글자가 나온다(그 결정을 뒤집은 경위가 적혀 있다).
   그래서 낱말이 아니라 **등록 리터럴의 모양**을 본다. */
chk(!/deskItem:true,\s*licenseOnly:false/.test(preset),
  '★ 프리셋이 커스텀 아이템에 licenseOnly:false 를 **박지 않는다** — 박으면 장착 게이트가 통째로 안 걸린다');
chk(/licenseOnly:\s*!!\(_rec/.test(preset),
  '  대신 카탈로그 레코드(savedItems)에서 읽는다 — 원본은 그쪽이다');

/* ── 5. 되돌아가면 안 되는 것 ── */
say('── 5. 경계 — 되돌아가면 제보가 되살아나는 것들');
const gate = grabFn('applyDeskCatalogRefToSeat') || '';
chk(/!seat\.remote/.test(gate),
  '★ 그리기 게이트에 !seat.remote 가 **그대로 있다** — 빼면 보유자 친구의 책상이 내 화면에서만 기본으로 보인다');
chk(!new RegExp('delete\\s+def\\.deskCatalogId').test(fnPrune || ''),
  '★ 접기가 deskCatalogId 를 delete 하지 않는다 (옮겨 적기만 한다 — 라이선스 재등록이 복구 경로다)');
const equip = grabFn('equipDeskItem') || '';
chk(/savedItems/.test(equip.slice(0, equip.indexOf('holder.deskItems'))),
  '★ 아이템 장착 게이트가 카탈로그 레코드(savedItems)도 본다 — def.licenseOnly 만 보면 캐릭터에 딸려온 사본이 false 로 덮는다');
chk(!/firebase-database-rules|\.write/.test(fnPrune || ''),
  '  서버 규칙으로 막으려 들지 않는다 — 라이선스는 localStorage 라 위조 방어가 아니라 «남은 저장값 청소»다');
chk(!/toast\(/.test(fnPrune || '') && !/toast\(/.test(fnRestore || ''),
  '  조용히 돈다 — 못 쓰는 것을 원래대로 되돌리는 일이라 알림이 없다(2026-09-18 결정)');
chk(/console\.warn/.test(fnPrune || ''),
  '  대신 콘솔에는 남긴다 — 다음 제보 때 첫 단서');

/* ── 6. A안 이전 — 전용 책상은 꾸미기창에만, 5단계에는 무료 책상만 ── */
say('── 6. 전용 책상을 🎨 꾸미기 › 책상 으로 옮긴 자리');
/* (가) 가상 탭 — PART_CATS 를 오염시키지 않았나 */
chk(/const WD_DESK_TAB = '__desk_model__';/.test(SRC), '«책상» 가상 탭 상수가 있다');
chk(!/cat:'desk'[,\s]/.test(SRC.slice(SRC.indexOf('const BUILTIN_PART_CATS'), SRC.indexOf('const BUILTIN_PART_CATS') + 2500)),
  "★ BUILTIN_PART_CATS 에 책상 본체 카테고리를 **넣지 않았다** — 넣으면 파츠 등록·카테고리 상한·장착 배관이 전부 가짜 카테고리를 센다");
chk(/\{cat:'deskitem'/.test(SRC), '  같은 그룹의 «책상 위»(deskitem)는 그대로다 — 그쪽은 진짜 파츠 배관을 탄다');
const wd = grabFn('renderWardrobe') || '';
chk(/currentWdTab === WD_DESK_TAB[\s\S]{0,80}renderWdDeskSection/.test(wd),
  '★ 그 탭이면 파츠 그리드 대신 renderWdDeskSection 으로 갈라진다');
chk(/currentWdTab !== WD_DESK_TAB && \(!currentWdTab \|\| !PART_CATS\.find/.test(wd),
  '  탭 유효성 검사가 가상 탭을 예외로 둔다 (안 그러면 고르는 순간 모자 탭으로 튕긴다)');
chk(/g\.group === 'desk'\)\{ currentWdTab = WD_DESK_TAB/.test(wd),
  '  책상 그룹을 누르면 «책상»이 첫 칸이다 (시안 순서: ◉ 책상 · ○ 책상 위)');
chk(/_wdLicenseDesks\(\)\.length/.test(wd),
  '  파츠가 하나도 없어도 전용 책상이 있으면 창이 열린다');
/* (나) 꾸미기창 책상 섹션 */
const deskSec = grabFn('renderWdDeskSection') || '';
if(!deskSec){ huh('renderWdDeskSection 을 못 찾음'); }
else{
  chk(/기본 책상/.test(deskSec) && /deskCatalogId=null/.test(deskSec),
    '★ «쓰지 않음 / 기본 책상» 칸이 있다 — 없으면 전용 책상을 고른 사람이 벗을 길이 없다');
  chk(/캐릭터 만들기/.test(deskSec),
    '  기본·무료 책상이 어디 있는지 알려 준다 (옮긴 뒤 «사라졌다» 가 되지 않게)');
  chk(/wdDeskScale/.test(deskSec) && /wdDeskLenX/.test(deskSec) && /wdDeskColor/.test(deskSec),
    '  조절 3종(색·크기·길이)이 같이 왔다');
  chk(!/deskPosGz|기즈모로 옮기기/.test(deskSec),
    '  위치 기즈모는 안 가져왔다 — 생성기 미리보기 카메라와 한 벌이라 5단계에 남는다');
}
const applyFn = grabFn('_wdApplyDeskChange') || '';
chk(/Presence\.updateDef\(def\)/.test(applyFn), '★ 꾸미기창에서 책상을 바꾸면 방에도 바로 나간다');
chk(/saveSlots/.test(applyFn), '  바로 저장한다 (꾸미기창은 «닫는 것이 곧 저장» 이지만 책상은 draft 대상이 아니다)');
chk(/wdDraftDef/.test(applyFn), '  미리보기가 보는 draft 에도 같은 값을 적는다');
const commit = grabFn('_commitWdDraftNow') || '';
chk(!/def\.deskCatalogId\s*=/.test(commit),
  '★ 창을 닫을 때(commit)가 책상 필드를 덮지 않는다 — 덮으면 방금 고른 책상이 옛 값으로 돌아간다');
/* (다) 생성기 5단계 — 필터를 떼어 와 돌린다 */
const filtM = /savedDesks\.filter\(rec=>(rec\.id!==DEFAULT_DESK_OVERRIDE_ID[^)]*\))\)\.forEach/.exec(SRC);
if(!filtM){ huh('5단계 책상 목록 필터를 못 찾음'); }
else{
  const f = new Function('rec', 'DEFAULT_DESK_OVERRIDE_ID', 'isAdmin', 'return !!(' + filtM[1] + ');');
  const shown = (lic, admin) => f({ id: 'd1', licenseOnly: lic }, '__default_desk__', admin);
  chk(shown(false, false) === true,  '무료 책상은 5단계에 그대로 있다');
  chk(shown(true,  false) === false, '★ 전용 책상은 5단계 목록에서 빠졌다 (꾸미기창으로 갔다)');
  chk(shown(true,  true)  === true,  '★ 관리자에게는 그대로 보인다 — 등록·검수·순서 재배치 손잡이가 이 카드에만 있다');
  chk(f({ id: '__default_desk__' }, '__default_desk__', false) === false, '기본 책상 오버라이드는 따로 그린다(중복 방지)');
}
const rcAll = grabFn('renderCrItems') || '';
chk(/const deskLocked = !!\(rec\.licenseOnly && !isPremium && !isAdmin\)/.test(rcAll),
  '★ deskLocked 갈래는 **지우지 않았다** — 관리자 화면과, 카탈로그가 늦어 licenseOnly 를 아직 모르는 순간의 안전망');
chk(/crDeskLicenseHint/.test(rcAll), '5단계에 «어디로 갔는지» 안내 줄을 켠다');
let HTML = '';
try{ HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8'); }catch(_){}
if(!HTML){ huh('desk-companion-prototype.html 을 못 읽음 — 안내 줄 마크업 확인 못함'); }
else{
  chk(/id="crDeskLicenseHint"/.test(HTML), '  그 안내 줄이 마크업에 있다');
  const hintBlock = HTML.slice(HTML.indexOf('id="crDeskLicenseHint"'), HTML.indexOf('id="crDeskLicenseHint"') + 700);
  chk(!/<button/.test(hintBlock),
    '  ★ 안내 줄에 버튼이 없다 — 꾸미기창은 실행 화면의 창이라 이 작은 창에서 열 자리가 없다(눌러도 안 되는 버튼 금지)');
}

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs);
process.exit(fail ? 1 : 0);

/* ═══ 🔒 sim-premium-desk.js — 라이선스 전용 책상 (제보 3 · 2026-09-15) ═══════════════════
   [무엇을 지키나]
     ・제보 3: 전용 책상이 남에겐 보이고 본인에겐 기본 책상으로 떨어지던 것. isPremium 이 뒤늦게 바뀌는
       통로(계정 이전 복원 · 온라인 재검증 · 활성화/해제)가 내 좌석을 다시 그리지 않았다.
       → 대입은 `_setPremium` 한 통로, 바뀌면 `_refreshPremiumGatedUI` 가 내 좌석을 다시 적용.
     ・추가 요청: 라이선스 없으면 전용 책상을 **고르지 못하게** — 생성기 카드 🔒 + 클릭 차단 + 슬롯 불러오기 차단.
   ・1절: 그리기 게이트(applyDeskCatalogRefToSeat)의 조건을 떼어 와 진리표로 돌린다 — 남의 좌석은 안 막고 내 좌석만 막는다.
   ・2절: isPremium 대입이 한 통로다.
   ・3절: 바뀌면 내 좌석을 다시 그린다(남의 좌석은 안 건드린다).
   ・4절: 생성기에서 고르지 못한다.
   [실행] app.js 가 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
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
const lineOf = (i) => SRC.slice(0, i).split('\n').length;

/* ── 1. 그리기 게이트 진리표 ── */
say('── 1. 그리기 게이트 — 내 좌석만 막고, 남의 좌석은 라이선스와 무관하게 보인다');
const gateM = /if\((rec\.licenseOnly[^)]*)\)\{\s*\n\s*swapDeskVisual\(seat\.desk,null\)/.exec(SRC);
if(!gateM){ huh('applyDeskCatalogRefToSeat 의 게이트 조건을 못 찾음'); }
else{
  const cond = new Function('rec', 'seat', 'isPremium', 'isAdmin', 'return !!(' + gateM[1] + ');');
  const blocked = (lic, remote, prem, admin) => cond({ licenseOnly: lic }, { remote, isMe: !remote }, prem, admin);
  chk(blocked(true,  false, false, false) === true,  '전용 책상 · 내 좌석 · 라이선스 없음 → 기본 책상');
  chk(blocked(true,  true,  false, false) === false, '★ 전용 책상 · 남의 좌석 · 내 라이선스 없음 → 그대로 보인다 (예전 제보)');
  chk(blocked(true,  false, true,  false) === false, '전용 책상 · 내 좌석 · 라이선스 있음 → 보인다');
  chk(blocked(true,  false, false, true)  === false, '관리자는 라이선스 없이도 보인다');
  chk(blocked(false, false, false, false) === false, '일반 책상은 게이트를 안 탄다');
  const gateBody = SRC.slice(gateM.index, SRC.indexOf('return;', gateM.index));
  chk(!/deskCatalogId\s*=\s*null/.test(gateBody), '★ 게이트가 charDef.deskCatalogId 를 지우지 않는다 — 나중에 라이선스가 오면 같은 참조로 돌아와야 한다');
}

/* ── 2. 대입 한 통로 ── */
say('── 2. isPremium 은 _setPremium 으로만 바뀐다');
const direct = [...SRC.matchAll(/\bisPremium\s*=\s*(true|false)\b/g)]
  .map(m => ({ i: m.index, decl: /(let|var|const)\s+$/.test(SRC.slice(Math.max(0, m.index - 6), m.index)) }))
  .filter(m => !m.decl);
chk(direct.length === 0, '★ 직접 대입 ' + direct.length + '곳 (선언 제외 · 기준 0)' + (direct.length ? ' — 줄 ' + direct.map(m => lineOf(m.i)).join(',') : ''));
const setCalls = (SRC.match(/_setPremium\(/g) || []).length - 1;
chk(setCalls >= 5, '_setPremium 호출 ' + setCalls + '곳 (로컬 키 · 활성화 · 해제 · 재검증 실패 · 계정 이전 복원 = 5)');
const setSrc = grabFn('_setPremium') || '';
chk(/if\(isPremium === v\) return;/.test(setSrc), '같은 값이면 다시 그리지 않는다');
chk(/_refreshPremiumGatedUI\(\)/.test(setSrc), '바뀌면 _refreshPremiumGatedUI 를 부른다');
const xfer = grabFn('_applyTransferSnapshot') || '';
chk(/r\.license[\s\S]{0,120}_setPremium\(true\)/.test(xfer), '★ 계정 이전 복원이 키 저장과 함께 isPremium 을 올린다 (예전엔 키만 저장 — 재시작 전까지 기본 책상)');
const verifyFail = /if\(!r\.ok && !r\.offline\)\{.{0,200}/.exec(SRC);   // 한 줄 — 안에 catch(e){} 가 있어 [^}] 로는 못 잡는다
chk(!!verifyFail && /_setPremium\(false\)/.test(verifyFail[0]), '온라인 재검증 실패도 같은 통로 (회수된 키 → 내 책상도 기본으로)');
chk(!!verifyFail && /r\.offline/.test(verifyFail[0]), '오프라인은 회수로 치지 않는다 (기존 조건 유지)');

/* ── 3. 다시 그리기 ── */
say('── 3. 바뀌면 내 좌석을 다시 그린다');
const refresh = grabFn('_refreshPremiumGatedUI') || '';
chk(/seats\.forEach/.test(refresh), '좌석을 순회한다');
chk(/!s\.isMe \|\| s\.remote/.test(refresh), '★ 내 좌석만 (남의 좌석은 애초에 게이트를 안 탄다 — 건드리면 남의 책상이 깜빡인다)');
chk(/applyDeskCatalogRefToSeat\(s, s\.charDef\)/.test(refresh), '카탈로그 참조 책상을 다시 적용한다');
chk(/DEFAULT_DESK_OVERRIDE_ID/.test(refresh), '기본 책상 오버라이드도 다시 적용한다 (mergeCatalogIntoSavedDesks 와 같은 두 갈래)');
chk(/applyDeskItemsTo\(s, s\.charDef\.deskItems\)/.test(refresh), '전용 아이템도 다시 장착한다 (equipDeskItem 게이트가 같은 isPremium 을 본다)');
chk(/creatorOpen[\s\S]{0,60}renderCrItems\(\)/.test(refresh), '생성기가 열려 있으면 🔒 카드도 다시 그린다');
chk(/refreshCustomStatusMenuItem/.test(refresh), '원래 하던 일(커스텀 상태 메뉴)은 그대로다');

/* ── 4. 고르지 못한다 ── */
say('── 4. 생성기에서 라이선스 없이는 전용 책상을 고르지 못한다');
const rc = grabFn('renderCrItems') || '';
const deskPart = rc.slice(0, rc.indexOf("document.getElementById('deskColor')"));
chk(/const deskLocked = !!\(rec\.licenseOnly && !isPremium && !isAdmin\)/.test(deskPart), '★ 책상 카드에 잠금 조건이 있다 (아이템 카드와 같은 조건)');
chk(/if\(deskLocked\)\{[\s\S]*?textContent='🔒'/.test(deskPart), '잠긴 책상에 🔒 표시');
chk(/card\.onclick=async\(\)=>\{[\s\S]*?if\(deskLocked\)\{[^}]*return; \}/.test(deskPart), '★ 잠긴 책상은 클릭해도 활성 책상이 안 된다 (toast 후 return)');
const clickIdx = deskPart.indexOf('card.onclick=');
const lockIdx  = deskPart.indexOf('if(deskLocked){ toast');
const fetchIdx = deskPart.indexOf('resolveCatalogGlb(rec)');
chk(clickIdx > 0 && lockIdx > clickIdx && lockIdx < fetchIdx, '  차단이 GLB fetch **앞**이다 (막을 책상을 내려받지 않는다)');
const loadGate = /m && m\.licenseOnly && !isPremium && !isAdmin[\s\S]{0,200}else if\(m\)\{/.exec(SRC);
chk(!!loadGate, '★ 슬롯을 생성기로 불러올 때 라이선스 없는 전용 책상 참조는 안 싣는다 (저장 때 참조가 다시 굳는 것을 막는다)');
const itemGate = /if\(def\.licenseOnly && !isPremium && !isAdmin\)\{\s*\n\s*const lock=/.test(rc);
chk(itemGate, '아이템 카드의 기존 🔒 는 그대로다');

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs);
process.exit(fail ? 1 : 0);

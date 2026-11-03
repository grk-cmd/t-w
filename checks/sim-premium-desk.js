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
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const SRC = _joinRenderer(fs.readFileSync('app.js', 'utf8'));

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

/* ── 1. 전용 자산 막기 판단 — 한 함수(account-state.js licenseAssetBlocked)를 진짜로 불러 진리표로 본다 ── */
const PASRC = ['account-state.js', 'parts/account/account-state.js', 'app/parts/account/account-state.js'].map(f => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean);
function buildPA(src, st){
  const mod = new Function('window', 'companion', 'localStorage', 'setTimeout', 'module', src + '\nreturn window.TwAccountState;')({}, {}, { getItem: () => null, setItem(){}, removeItem(){} }, (f) => f(), undefined);
  return mod.createAccountState({ isPremium: () => st.premium, isAdmin: () => st.admin, setIsPremium: (v) => { st.premium = v; } });
}
say('── 1. 전용 자산을 지금 막아야 하나 — 판단 함수 한 벌');
if(!PASRC){ huh('account-state.js 를 못 읽음'); }
else{
  /* known=false 는 서버가 아직 프리미엄을 확인해 주지 않은 상태(_setPremium 을 부른 적 없음) — isPremium 의 false 는 «모름» */
  const blocked = (item, prem, admin, known) => {
    const st = { premium: !!prem, admin: !!admin };
    const pa = buildPA(PASRC, st);
    if(known !== false) pa._setPremium(!!prem);
    return pa.licenseAssetBlocked(item);
  };
  chk(blocked({ licenseOnly: true }, false, false) === true, '전용 · 라이선스 없음 · 관리자 아님 · 확인됨 → 막는다');
  chk(blocked({ licenseOnly: true }, false, false, false) === false, '★ 같은 경우라도 서버가 확인해 주기 전(모름)이면 막지 않는다 — 프리미엄 사용자의 책상이 깜빡이지 않게(확인이 오면 알림이 다시 그린다)');
  chk(blocked({ licenseOnly: true }, true, false) === false, '전용 · 라이선스 있음 → 안 막는다');
  chk(blocked({ licenseOnly: true }, false, true) === false, '전용 · 관리자 → 안 막는다(등록 · 검수는 보유 없이 쓴다)');
  chk(blocked({ licenseOnly: false }, false, false) === false && blocked({}, false, false) === false, '일반 자산은 막지 않는다');
  chk(blocked(null, false, false) === false && blocked(undefined, false, false) === false, '경계: 레코드가 없으면(null · undefined) 막지 않는다');
  chk(blocked({ licenseOnly: 1 }, false, false) === true && blocked({ licenseOnly: 0 }, false, false) === false, '경계: licenseOnly 는 참 · 거짓으로만 읽는다');
  chk(typeof blocked({ licenseOnly: true }, false, false) === 'boolean' && typeof blocked({ licenseOnly: true }, false, false, false) === 'boolean', '돌려주는 값은 true · false');
  /* 깨 보기 — 각 조건을 빼면 위 판정이 빨강이어야 한다(진리표 전체를 다시 돌려 한 칸이라도 달라지면 잡음) */
  const table = (src) => { const out = []; for(const it of [{ licenseOnly: true }, { licenseOnly: false }, null]) for(const pr of [false, true]) for(const ad of [false, true]) for(const kn of [true, false]){
    try{ const st = { premium: pr, admin: ad }; const pa = buildPA(src, st); if(kn) pa._setPremium(pr); out.push(pa.licenseAssetBlocked(it)); }catch(_){ out.push('x'); } } return out.join(); };
  const base = table(PASRC);
  const brk = (a, b) => PASRC.includes(a) && table(PASRC.replace(a, b)) !== base;
  chk(brk('&& !isPremium() && !isAdmin();', '&& !isPremium();'), '  ↳ 깨 보기: 관리자 예외를 빼면 빨강');
  chk(brk('&& !isPremium() && !isAdmin();', '&& !isAdmin();'), '  ↳ 깨 보기: 프리미엄 예외를 빼면 빨강');
  chk(brk('!!(item && item.licenseOnly) && _premiumKnown', '_premiumKnown'), '  ↳ 깨 보기: 전용인지 안 보면 빨강');
  chk(brk('&& _premiumKnown && !isPremium()', '&& !isPremium()'), '  ↳ 깨 보기: «모름» 을 안 보면 빨강');
}
say('── 1-2. 부르는 곳 — 복사된 조건이 없고 모두 그 함수를 부른다');
{
  const strip2 = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  const FILES = [['character/desk-visual.js', 'desk-visual.js'], ['creator/desk-setup.js', 'desk-setup.js'], ['creator/desk-preset.js', 'desk-preset.js']].map(([f, g]) => [f, ['parts/' + f, 'app/parts/' + f, g].map(x => { try{ return fs.readFileSync(x, 'utf8'); }catch(_){ return null; } }).find(Boolean)]);
  const copies = [];
  for(const [f, t] of FILES.concat([['app.js', fs.readFileSync('app.js', 'utf8')]])){ if(!t) { huh(f + ' 를 못 읽음'); continue; } if(/licenseOnly[^\n]{0,80}!\s*isPremium|!\s*isPremium\(?\)?\s*&&\s*!\s*isAdmin/.test(strip2(t))) copies.push(f); }
  chk(!copies.length, '★ 「전용 && !isPremium && !isAdmin」 복사본이 없다' + (copies.length ? ' — ' + copies.join(' · ') : ''));
  const COPY_RE = /licenseOnly[^\n]{0,80}!\s*isPremium|!\s*isPremium\(?\)?\s*&&\s*!\s*isAdmin/;
  chk(COPY_RE.test('if(rec.licenseOnly && !isPremium() && !isAdmin()){') && COPY_RE.test('if(on && x && !isPremium && !isAdmin){') && !COPY_RE.test('if(licenseAssetBlocked(rec)){'), '  ↳ 깨 보기: 옛 조건을 다시 쓰면 위 검사가 빨강이 된다');
  const T = Object.fromEntries(FILES);
  chk(/!seat\.remote && licenseAssetBlocked\(rec\)/.test(strip2(T['character/desk-visual.js'] || '')), '책상 그리기 — 내 좌석(!remote)만 · 판단 함수');
  chk(/licenseAssetBlocked\(rec\)/.test(strip2(T['creator/desk-setup.js'] || '')) && /if\(licenseAssetBlocked\(def\)\)\{/.test(strip2(T['creator/desk-setup.js'] || '')), '생성기 — 책상 카드 · 아이템 카드');
  chk(/licenseAssetBlocked\(\{ licenseOnly: premiumMod\._licenseLockedDeskId/.test(strip2(T['creator/desk-preset.js'] || '')), '프리셋 — 전용 책상');
  chk(/(?:premiumMod\.)?licenseAssetBlocked\(m\)/.test(SRC) && /!\(holder && holder\.remote\) && (?:premiumMod\.)?licenseAssetBlocked\(\{ licenseOnly: _itemLicenseOnly \}\)/.test(SRC), '슬롯 불러오기 · 아이템 장착(친구 좌석은 안 막음)');
}

/* ── 2. 대입 한 통로 ── */
say('── 2. isPremium 은 _setPremium 으로만 바뀐다');
const direct = [...SRC.matchAll(/\bisPremium\s*=\s*(true|false)\b/g)]
  .map(m => ({ i: m.index, decl: /(let|var|const)\s+$/.test(SRC.slice(Math.max(0, m.index - 6), m.index)) }))
  .filter(m => !m.decl);
chk(direct.length === 0, '★ 직접 대입 ' + direct.length + '곳 (선언 제외 · 기준 0)' + (direct.length ? ' — 줄 ' + direct.map(m => lineOf(m.i)).join(',') : ''));
const setCalls = (SRC.match(/_setPremium\(/g) || []).length - 1;
chk(setCalls === 1, '_setPremium 을 부르는 곳은 app.js 에서 서버 확인을 반영하는 모듈에 잇는 줄 하나뿐 (' + setCalls + '곳 — 로컬 키로 미리 켜기 · 활성화 · 해제가 직접 부르던 길은 0.13 에서 걷음)');
const setSrc = grabFn('_setPremium') || '';
chk(/if\(isPremium === v && wasKnown\) return;/.test(setSrc), '같은 값이면 다시 그리지 않는다 (단 서버가 처음 확인해 줄 때는 같은 값이어도 — 모르는 동안 건너뛴 접기가 돈다)');
chk(/_premiumChanged\(\)/.test(setSrc) && /^onPremiumChanged\(_refreshPremiumGatedUI\);/m.test(SRC), '바뀌면 _refreshPremiumGatedUI 가 돈다(계정 핵심 상태의 «프리미엄이 바뀌었다» 알림에 초대 게이트가 건다 — 모듈 순환 끊기 5)');
chk(!grabFn('_applyTransferSnapshot'), '계정 이전 복원(키만 저장하던 통로)은 0.13 에서 걷었다 — isPremium 을 바꾸는 통로는 서버 확인 하나');
const LP = ['license-premium.js', 'parts/account/license-premium.js', 'app/parts/account/license-premium.js'].map(f => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean) || '';
chk(!!LP && /setPremium\(me\.premium === true\)/.test(LP), '서버가 «아님» 이라고 해도(회수된 키 → 내 책상도 기본으로) 같은 통로로 알린다 — 판정은 sim-license-premium 이 돌려 본다');

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
chk(/refreshLauncherPreview\(\)/.test(refresh), '★ 런처 미리보기도 다시 그린다 — 서버 확인 전에 그려진 전용 책상 · 아이템을 지금 값으로');

/* ── 4. 고르지 못한다 ── */
say('── 4. 생성기에서 라이선스 없이는 전용 책상을 고르지 못한다');
const rc = grabFn('renderCrItems') || '';
const deskPart = rc.slice(0, rc.indexOf("document.getElementById('deskColor').value"));   // 책상 카드 부분 = 색 칸에 값 넣는 줄 앞까지(머리의 입구 가드에도 deskColor 가 있다)
chk(/const deskLocked = (?:premiumMod\.)?licenseAssetBlocked\(rec\)/.test(deskPart), '★ 책상 카드에 잠금 조건이 있다 (아이템 카드와 같은 조건)');
chk(/if\(deskLocked\)\{[\s\S]*?textContent='🔒'/.test(deskPart), '잠긴 책상에 🔒 표시');
chk(/card\.onclick=async\(\)=>\{[\s\S]*?if\(deskLocked\)\{[^}]*return; \}/.test(deskPart), '★ 잠긴 책상은 클릭해도 활성 책상이 안 된다 (toast 후 return)');
const clickIdx = deskPart.indexOf('card.onclick=');
const lockIdx  = deskPart.indexOf('if(deskLocked){ toast');
const fetchIdx = deskPart.indexOf('resolveCatalogGlb(rec)');
chk(clickIdx > 0 && lockIdx > clickIdx && lockIdx < fetchIdx, '  차단이 GLB fetch **앞**이다 (막을 책상을 내려받지 않는다)');
const loadGate = /m && (?:premiumMod\.)?licenseAssetBlocked\(m\)[\s\S]{0,200}else if\(m\)\{/.exec(SRC);
chk(!!loadGate, '★ 슬롯을 생성기로 불러올 때 라이선스 없는 전용 책상 참조는 안 싣는다 (저장 때 참조가 다시 굳는 것을 막는다)');
const itemGate = /if\((?:premiumMod\.)?licenseAssetBlocked\(def\)\)\{\s*\n\s*const lock=/.test(rc);
chk(itemGate, '아이템 카드의 기존 🔒 는 그대로다');

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs);
process.exit(fail ? 1 : 0);

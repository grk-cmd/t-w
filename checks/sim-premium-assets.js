/* ═══ 🎀 sim-premium-assets.js — 🎀 캐릭터 꾸미기 파츠(프리미엄) · 🪑 라이선스 전용 책상(꾸미기 «책상» 탭) · 라이선스 없는 기기의 전용 자산 접기 모듈 구조 (2026-10-14 신설 · 앱 FSD 37번) ═══════════════
   app.js 의 프리미엄 파츠 · 라이선스 책상 · 전용 자산 접기 세 구역 본문 을 parts/character/premium-assets.js 로 옮겼다(글자 그대로 · 바뀐 줄 18 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(프리미엄 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(DESK_LICENSE_HOLD · ITEM_LICENSE_HOLD · MAX_GACHA_PARTS_PER_CAT · MAX_PARTS_PER_CAT · PART_CATS · PART_GROUPS · WD_DESK_TAB · _licenseLockedDeskId · _normPartRec · _wdLicenseDesks · addEntryToCat · addPartEntryInstance · catEquippedIds · customPartCats · setCustomPartCats · defaultPartXf · entriesForCat · findEntryById · firstEntryForCat · getRecHides · groupOfCat · isDeskPartCat · loadSavedParts · partAttachTarget · partCatInfo · partCatLimit · partCatOverrides · setPartCatOverrides · partEntryId · partEntryInstanceCount · partEntryInstances · partEntryXf · partsInCat · partsInCatFor · partsInGroup · persistSavedParts · pruneUnownedLicenseAssets · rebuildPartCats · removeEntryFromCat · removePartEntryInstance · renderWdDeskSection · reorderSavedPart · restoreLicenseHeldAssets · savedParts · setSavedParts · setPartEntryInstanceXf · toHidesForSave · wdEar)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 32줄 그대로 · 부르는 곳은 premiumMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · premium-assets.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["premium-assets.js","parts/character/premium-assets.js","app/parts/character/premium-assets.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — premium-assets.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["applyDeskCatalogRefToSeat","deskItemDef","deskPartAnchorOf","equipDeskItem","findMySeat","saveSlots","toast"];
const VAL_DEPS = ["DEFAULT_DESK_OVERRIDE_ID","accountStore","seats"];
const GET_DEPS = ["Presence","cBase","isAdmin","isPremium","savedDesks","savedItems","slots"];
const SET_DEPS = [];
const EXPORTS = ["DESK_LICENSE_HOLD","ITEM_LICENSE_HOLD","MAX_GACHA_PARTS_PER_CAT","MAX_PARTS_PER_CAT","PART_CATS","PART_GROUPS","WD_DESK_TAB","_licenseLockedDeskId","_normPartRec","_wdLicenseDesks","addEntryToCat","addPartEntryInstance","catEquippedIds","customPartCats","setCustomPartCats","defaultPartXf","entriesForCat","findEntryById","firstEntryForCat","getRecHides","groupOfCat","isDeskPartCat","isGachaPart","loadLocal","resetLocal","partAttachTarget","partCatInfo","partCatLimit","partCatOverrides","setPartCatOverrides","partEntryId","partEntryInstanceCount","partEntryInstances","partEntryXf","partsInCat","partsInCatFor","partsInGroup","persistSavedParts","pruneUnownedLicenseAssets","rebuildPartCats","removeEntryFromCat","removePartEntryInstance","reorderSavedPart","restoreLicenseHeldAssets","savedParts","setSavedParts","setPartEntryInstanceXf","toHidesForSave"];
const MOVED = ["WD_DESK_TAB","WD_EAR_OFF","wdEar","_wdLicenseDesks","_wdApplyDeskChange","renderWdDeskSection","DESK_LICENSE_HOLD","ITEM_LICENSE_HOLD","_licenseLockedDeskId","_licenseLockedItemId","pruneUnownedLicenseAssets","restoreLicenseHeldAssets","SAVED_PARTS_KEY","MAX_PARTS_PER_CAT","MAX_GACHA_PARTS_PER_CAT","PART_GROUPS","BUILTIN_PART_CATS","GROUP_TO_BONE","customPartCats","partCatOverrides","PART_CATS","rebuildPartCats","partCatInfo","isDeskPartCat","partAttachTarget","partsInGroup","groupOfCat","defaultPartXf","partEntryId","isPartEntryContainer","partEntryXf","normalizePartEntryInstances","partEntryInstances","partEntryInstanceCount","entriesForCat","firstEntryForCat","findEntryById","catEquippedIds","HIDES_NONE_SENTINEL","toHidesForSave","getRecHides","_flattenCatContainer","addEntryToCat","removeEntryFromCat","setPartEntryInstanceXf","addPartEntryInstance","removePartEntryInstance","savedParts","loadSavedParts","_normPartRec","persistSavedParts","partsInCat","partsInCatFor","partCatLimit","reorderSavedPart"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,","  accountStore: accountStoreMod,","  Presence: ()=>Presence,","  applyDeskCatalogRefToSeat: (...a)=>applyDeskCatalogRefToSeat(...a),","  cBase: ()=>cBase,","  deskItemDef: (...a)=>deskItemDef(...a),","  deskPartAnchorOf: (...a)=>deskPartAnchorOf(...a),","  equipDeskItem: (...a)=>equipDeskItem(...a),","  findMySeat: (...a)=>findMySeat(...a),","  isAdmin: ()=>isAdmin,","  isPremium: ()=>isPremium,","  licenseAssetBlocked: (...a)=>acctStateMod.licenseAssetBlocked(...a),","  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),","  savedDesks: ()=>commissionMod.savedDesks(),","  savedItems: ()=>commissionMod.savedItems(),","  seats: seats,","  slots: ()=>slots,","  toast: (...a)=>toast(...a),"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src, over){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    src + '\nreturn window.TwPremiumAssets;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  return api.createPremiumAssets(Object.assign(deps, over || {}));
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwPremiumAssets = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwPremiumAssets(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("PREMIUM_MOD_OFF") && app.includes("const premiumMod = TwPremiumAssets.createPremiumAssets({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const premiumMod = TwPremiumAssets\\.createPremiumAssets\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = mk.split('\n').map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const premiumMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 premiumMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/premium-assets.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/premium-assets.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 2-2. 저장 파츠 — 카탈로그 몫은 서버가 원본 · 코드로 추가한 몫만 계정 칸(loadLocal · resetLocal · persist)');
function behave(mod){
  const cells = {}; let open = true; const toasts = [];
  const accountStore = { get: (k) => (open && k in cells) ? cells[k] : null, set: (k, v) => { if(!open) return false; cells[k] = String(v); return true; } };
  const m = build(mod, { accountStore, toast: (x) => toasts.push(x) });
  const r = {};
  m.setSavedParts([{ id: 'P-cat', fromCatalog: true, glbUrl: 'u', cat: 'hat', name: '카탈로그' }]);   // 구독이 확인보다 먼저 왔다
  cells['tw.savedParts'] = JSON.stringify([{ id: 'P-cat', fromCatalog: true, cat: 'hat', name: '옛 사본(덮으면 안 된다)' }, { id: 'P-gone', fromCatalog: true, cat: 'hat', name: '지워진 사본' }, { id: 'P-mine', cat: 'hat', name: '내 파츠', gacha: true }]);
  m.loadLocal();
  r.load = m.savedParts().map(p => p.id + ':' + p.name).join() === 'P-cat:카탈로그,P-mine:내 파츠' && m.savedParts()[1].stackable === true;   // 가챠는 겹쳐 입는다(_normPartRec)
  m.persistSavedParts();
  r.persist = JSON.parse(cells['tw.savedParts']).map(p => p.id).join() === 'P-mine' && !toasts.length;   // 카탈로그 몫은 쓰지 않는다
  m.resetLocal();
  r.reset = m.savedParts().map(p => p.id).join() === 'P-cat';
  open = false; m.persistSavedParts();
  r.closedLoud = toasts.length === 1;
  open = true; cells['tw.savedParts'] = '{깨짐';
  try{ m.loadLocal(); r.corruptThrows = false; }catch(_){ r.corruptThrows = true; }   // 깨진 칸은 던진다 — 빈 목록으로 숨기지 않는다
  return r;
}
{
  const R = behave(MOD);
  chk(R.load, '확인 뒤 읽기 — 카탈로그 몫(구독이 먼저 와 있음)은 덮지 않고 이 계정 몫만 더한다 · 옛 칸에 섞인 카탈로그 사본은 읽지 않는다');
  chk(R.persist, '쓰기 — 이 계정 몫만 계정 칸에 쓴다 · 카탈로그 몫은 쓰지 않는다');
  chk(R.corruptThrows === true, '계정 칸 값이 깨져 있으면 던진다(빈 목록으로 숨기지 않는다)');
  chk(R.reset && R.closedLoud, '세션이 끝나면 이 계정 몫만 비운다 · 계정 칸이 닫혀 있으면 쓰기를 알린다');
  const br = (from, to) => MOD.includes(from) ? behave(MOD.replace(from, to)) : null;
  const b1 = br("savedParts = savedParts.concat(a.filter(p=>!have.has(p.id)).map(_normPartRec));", "savedParts = a.map(_normPartRec);");
  chk(b1 && !b1.load, '깨 보기 — 로그인 때 읽은 값으로 카탈로그 몫을 덮으면 빨강');
  const b2 = br("JSON.parse(raw).filter(p=>!p.fromCatalog)", "JSON.parse(raw)");
  chk(b2 && !b2.load, '깨 보기 — 옛 칸의 카탈로그 사본까지 읽으면 빨강');
  const b3 = br("JSON.stringify(savedParts.filter(p=>!p.fromCatalog))", "JSON.stringify(savedParts)");
  chk(b3 && !b3.persist, '깨 보기 — 카탈로그 몫까지 계정 칸에 쓰면 빨강');
}
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/premium-assets.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const premiumMod = TwPremiumAssets.createPremiumAssets({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwPremiumAssets = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const premiumMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('premiumMod.' + x)); if(n){ ls[i] = ls[i].replace('premiumMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createPremiumAssets(deps){', 'function createPremiumAssets(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

/* ═══ 🛠️ sim-admin-part-register.js — 파츠 · 책상 · 아이템 등록 창 모듈 (2026-10-14 신설 · 관리자 코드 admin 폴더 4번) ═══════════
   app.js «🗂️ 카탈로그 파츠 페이로드 · 파츠 삭제(관리자)» · «🛠️ 파츠 · 책상 · 아이템 등록 모달(관리자)» 를 parts/admin/admin-part-register.js 로
   옮겼다. 동작은 그대로여야 한다. 배포 필드(buildPartPublishData)는 sim-publish-fields.js 가 본다.
   ・1절: 만들 때 — 책상 · 아이템 등록 버튼 둘을 건다 · 내놓는 이름(다섯 + 검사용 PART_PUBLISH_FIELDS) · 서버 안 부름
   ・2절: 파츠 삭제 — 지금 목록(다시 대입된 뒤)을 읽고 setSavedParts 로 바꿔 끼움 · 캐시 비움 · 입은 좌석에서 벗김 · 카탈로그에서 내림 · 꾸미기 다시 그림
   ・3절: 값 열세 개는 읽는 함수로만 — 모듈 안에 이름만 쓴 자리(값으로 붙잡는 자리)가 없다
   ・4절: app.js 연결 — 본문이 안 남음 · 빈 껍데기 · 원래 자리 · deps 42(함수 26 · 좌석 1 · 읽는 함수 13 · 쓰는 함수 1 · 꾸미기에 거는 함수 1) · 부르는 곳 13 · 🎰 gacha deps 셋 · html
   ・5절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · admin-part-register.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = _joinRenderer(read('app.js')), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ['admin-part-register.js', 'parts/admin/admin-part-register.js', 'app/parts/admin/admin-part-register.js'].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — admin-part-register.js'); process.exit(2); }
/* 🎨 꾸미기 창은 wardrobe.js 로 옮겼다(앱 FSD 29번) — 꾸미기의 «＋ 파츠 등록» 부르는 곳은 그 파일에 있다(adminPartReg 를 읽는 함수로 받아 adminPartReg().이름) */
const WARD = ['wardrobe.js', 'parts/character/wardrobe.js', 'app/parts/character/wardrobe.js'].map(read).find(Boolean) || '';
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const noStr = (s) => s.replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, '""');

const VALUES = ['MAX_CUSTOM_ASSETS', 'MAX_CUSTOM_ITEMS', 'MAX_GACHA_PARTS_PER_CAT', 'MAX_GLB_BYTES', 'MAX_PARTS_PER_CAT',
  'PART_CATS', 'gachaMod', 'partSceneCache', 'savedDesks', 'savedItems', 'savedParts', 'wdGizmo', 'wdPreviewBase'];
const FNS = ['_b64', 'applyClothVisibility', 'catEquippedIds', 'equipPartOnSeat', 'findEntryById', 'generatePartThumbnail', 'getPartScene',
  'getRecHides', 'parseGlbBytes', 'partCatInfo', 'partCatLimit', 'partEntryXf', 'partsInCat', 'partsInCatFor', 'persistSavedParts', 'refitSeatAfterParts', 'removeEntryFromCat',
  'renderCrItems', 'renderWardrobe', 'resolveCatalogGlb', 'saveSlots', 'syncWdGizmoToXf', 'toHidesForSave', 'toast', 'unequipPartFromSeat', 'unequipStackablePart'];
const EXPORTS = ['openPartRegister', 'openDeskRegister', 'deletePart', 'buildPartPublishData', 'syncPartRegGachaLock'];

/* 가짜 DOM · 가짜 deps 위에서 모듈을 만든다 */
function build(src, st){
  const calls = [];
  const els = {};
  const mk = (id) => ({ id, style: {}, value: '', checked: false, disabled: false, textContent: '', innerHTML: '', children: [], _on: {}, onclick: null, onchange: null,
    classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); }, toggle(){} },
    appendChild(c){ this.children.push(c); return c; }, addEventListener(t, f){ (this._on[t] = this._on[t] || []).push(f); }, focus(){}, querySelectorAll(){ return []; } });
  const document = { getElementById: (id) => els[id] || (els[id] = mk(id)), createElement: () => mk(''), querySelectorAll: () => [] };
  const fb = { unpublishPart: async (id) => { calls.push(['unpublishPart', id]); } };
  const win = { firebaseAPI: fb };
  const fn = (name) => (...a) => { calls.push([name, ...a]); return name === 'catEquippedIds' ? (st.equipped[a[1]] || []) : undefined; };
  const deps = { setSavedParts: (v) => { calls.push(['setSavedParts', v.map(p => p.id).join()]); st.parts = v; }, seats: st.seats,
    setAdminPartActions: (a) => { calls.push(['setAdminPartActions', Object.keys(a).sort().join()]); } };
  FNS.forEach(n => { deps[n] = fn(n); });
  VALUES.forEach(n => { deps[n] = () => st[n] !== undefined ? st[n] : (n === 'savedParts' ? st.parts : n === 'partSceneCache' ? st.cache : null); });
  const api = new Function('window', 'document', 'firebaseAPI', 'confirm', 'module', src + '\nreturn window.TwAdminPartRegister;')(win, document, fb, () => true, undefined);
  const out = api.createAdminPartRegister(deps);
  return { out, calls, els, st };
}

async function judgeAll(src, app, html, ward = WARD){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  /* 1. 만들 때 */
  const st = { parts: [{ id: 'p1' }, { id: 'p2' }], cache: new Map([['p1', 1], ['p2', 2]]), seats: [], equipped: {} };
  let B = null;
  try{ B = build(src, st); }catch(e){ t(false, '모듈을 만들 수 없다 — ' + e.message); }
  if(B){
    t(typeof B.els.deskRegBtn.onclick === 'function' && typeof B.els.itemRegBtn.onclick === 'function', '만들 때 책상 · 아이템 등록 버튼 둘을 건다');
    t(EXPORTS.every(n => typeof B.out[n] === 'function') && Array.isArray(B.out.PART_PUBLISH_FIELDS) && Object.keys(B.out).length === 6,
      '내놓는 이름 — 다섯(등록 창 · 책상 창 · 삭제 · 배포 데이터 · 가챠 잠금) + 검사용 PART_PUBLISH_FIELDS');
    t(B.calls.filter(c => c[0] !== 'setAdminPartActions').length === 0, '만들 때는 서버 · app.js 함수를 안 부른다(꾸미기에 거는 것만)');
    /* 2. 파츠 삭제 — app.js 가 목록을 다시 대입한 뒤 */
    const seat = { charDef: { equippedParts: { hat: 'p9' } }, stackedPartObjs: {} };
    st.parts = [{ id: 'p8' }, { id: 'p9' }]; st.cache = new Map([['p9', 1]]); st.seats.push(seat); st.equipped = { hat: ['p9'] };
    B.out.deletePart('p9');
    await new Promise(res => setImmediate(res));
    const names = B.calls.map(c => c[0]);
    t(B.calls.some(c => c[0] === 'setAdminPartActions' && c[1] === 'deletePart,openPartRegister'), '만들 때 꾸미기 창에 등록 · 삭제를 건다(setAdminPartActions — 꾸미기는 관리자 모듈을 부르지 않는다)');
    t(B.calls.some(c => c[0] === 'setSavedParts' && c[1] === 'p8'), '파츠 삭제 — 다시 대입된 뒤의 목록을 읽고 setSavedParts 로 바꿔 끼운다');
    t(!st.cache.has('p9') && names.includes('persistSavedParts'), '파츠 삭제 — 파싱 캐시를 비우고 저장한다');
    t(names.includes('removeEntryFromCat') && names.includes('applyClothVisibility'), '파츠 삭제 — 입은 좌석에서 벗긴다');
    t(B.calls.some(c => c[0] === 'unpublishPart' && c[1] === 'p9') && names[names.length - 1] === 'renderWardrobe', '파츠 삭제 — 카탈로그에서 내리고 꾸미기를 다시 그린다');
    const n0 = B.calls.length; B.out.deletePart('없는id');
    t(B.calls.length === n0, '없는 파츠는 아무것도 안 한다');
  }
  /* 3. 값은 읽는 함수로만 */
  const body = noStr(strip(src.slice(src.indexOf('function createAdminPartRegister(deps){'))));
  const bare = [];
  for(const v of VALUES){
    const re = new RegExp('(^|[^.\\w$])' + v + '\\b(?!\\s*\\()', 'g');
    for(const m of body.matchAll(re)){
      const line = body.slice(body.lastIndexOf('\n', m.index) + 1, body.indexOf('\n', m.index));
      if(new RegExp('^const ' + v + ' = deps\\.' + v + ';').test(line.trim())) continue;
      bare.push(v);
    }
  }
  t(bare.length === 0, '값 열세 개는 모듈 안에서 늘 이름() 으로 읽는다 — 값으로 붙잡는 자리 없음' + (bare.length ? ' (' + [...new Set(bare)].join(' · ') + ')' : ''));
  t(!/[^.\w$]savedParts\s*=[^=]/.test(body.replace(/const savedParts = deps\.savedParts;/, '')), '모듈은 app.js 의 savedParts 에 직접 쓰지 않는다(setSavedParts 로)');
  /* 4. app.js 연결 */
  const A = strip(app);
  t(!EXPORTS.some(n => new RegExp('function ' + n + '\\(').test(A)) && !/const PART_PUBLISH_FIELDS/.test(A), 'app.js 에 옮긴 본문이 남지 않았다');
  t(!/\bADMIN_PART_REG_OFF\b/.test(app), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차)');
  const mk = (app.match(/const adminPartReg = TwAdminPartRegister\.createAdminPartRegister\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = mk.split('\n').map(l => l.trim()).filter(Boolean);
  /* 오른쪽은 그 이름이 다른 모듈로 옮겨 가면 «mod.이름» 으로 바뀐다 — 키와 넘기는 방식만 본다 */
  const reEsc = (x) => x.replace(/[$]/g, '\\$');
  t(deps.length === 42 && FNS.every(n => deps.some(d => new RegExp('^' + reEsc(n) + ': \\(\\.\\.\\.a\\)=>(?:[\\w$]+\\.)?' + reEsc(n) + '\\(\\.\\.\\.a\\),$').test(d)))
    && VALUES.every(n => deps.some(d => new RegExp('^' + reEsc(n) + ': \\(\\)=>(?:[\\w$]+\\.)?' + reEsc(n) + '(?:\\(\\))?,$').test(d)))
    && deps.includes('seats,') && deps.includes('setSavedParts: (v)=>{ savedParts = v; },') && deps.some(d => /^setAdminPartActions: (wardrobeMod\.)?setAdminPartActions,$/.test(d)),
    'deps 42 — 함수 26 화살표 · 좌석 1 · 값 13 읽는 함수 · 쓰는 함수 1 · 꾸미기에 거는 함수 1 (' + deps.length + ')');
  const h81 = app.indexOf('/* ═══ 🗂️ 카탈로그 파츠 페이로드 · 파츠 삭제(관리자) ═══ */'), h82 = app.indexOf('/* ═══ 🛠️ 파츠 · 책상 · 아이템 등록 모달(관리자) ═══ */');
  t(h81 > 0 && h82 > h81 && app.indexOf('const adminPartReg =') > h82, '만드는 줄은 원래 자리(두 구역 머리 아래)');
  /* app.js 를 공용 도우미로 되살려 읽으면 꾸미기 본문이 이미 app.js 글 안에 있다 — 그때는 wardrobe.js 를 따로 세지 않는다(두 번 세기 방지) */
  const W = /function renderWardrobe\(/.test(A) ? '' : strip(ward);
  const callers = (A.match(/(?:adminPartReg|_adminPartActions)\.(openPartRegister|openDeskRegister|deletePart|buildPartPublishData|syncPartRegGachaLock)\(/g) || []).length
    + (W.match(/adminPartReg\(\)\.(openPartRegister|openDeskRegister|deletePart|buildPartPublishData|syncPartRegGachaLock)\(/g) || []).length;
  const oldCalls = (A.match(/(^|[^.\w$])(openPartRegister|openDeskRegister|deletePart|buildPartPublishData|syncPartRegGachaLock)\(/g) || []).length
    + (W.match(/(^|[^.\w$])(openPartRegister|openDeskRegister|deletePart|buildPartPublishData|syncPartRegGachaLock)\(/g) || []).length;
  t(callers === 13 && oldCalls === 0, '부르는 곳 13 — 모두 adminPartReg.이름 (꾸미기 — wardrobe.js 는 건네받은 _adminPartActions · 책상 · 아이템 · 썸네일 굽기 · 🎰 gacha setPartEditor 셋)');
  t(/openPartRegister: \(\.\.\.a\)=>adminPartReg\.openPartRegister\(\.\.\.a\),/.test(app) && /syncPartRegGachaLock: \(\.\.\.a\)=>adminPartReg\.syncPartRegGachaLock\(\.\.\.a\),/.test(app)
    && /deletePart: \(\.\.\.a\)=>adminPartReg\.deletePart\(\.\.\.a\),/.test(app), '🎰 gacha.js 에는 setPartEditor 로 — adminPartReg 을 거친다');
  t(/window\.TwAdminPartRegister = api;/.test(src) && /module\.exports = api;/.test(src), '전역 이름 TwAdminPartRegister(Tw 접두사)');
  const iM = html.indexOf('<script src="parts/admin/admin-part-register.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — admin/admin-part-register.js 를 app.js 보다 먼저 싣는다');
  return r;
}

(async () => {
  const rows = await judgeAll(MOD, SRC, HTML);
  const heads = { 0: '── 1 · 2. 만들 때 · 파츠 삭제', 8: '── 3. 값은 읽는 함수로만', 10: '── 4. app.js 연결' };
  rows.forEach(([ok, msg], i) => { if(heads[i]) say(heads[i]); chk(ok, msg); });

  say('── 5. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['목록을 값으로 붙잡음', { mod: s => s.replace('const rec=savedParts().find(p=>p.id===id); if(!rec)return;', 'const rec=savedParts.find(p=>p.id===id); if(!rec)return;') }],
    ['삭제가 목록을 안 바꿔 끼움', { mod: s => s.replace('  setSavedParts(savedParts().filter(p=>p.id!==id));\n', '') }],
    ['캐시를 안 비움', { mod: s => s.replace('  partSceneCache().delete(id);\n  // 모든 좌석에서', '  // 모든 좌석에서') }],
    ['카탈로그에서 안 내림', { mod: s => s.replace('window.firebaseAPI.unpublishPart(id).catch(()=>{});', '') }],
    ['책상 등록 버튼 안 걺', { mod: s => s.replace("document.getElementById('deskRegBtn').onclick=", "document.getElementById('deskRegBtnX').onclick=") }],
    ['옛 이름으로 부름', { app: s => s.replace("adminPartReg.openDeskRegister('desk', DEFAULT_DESK_OVERRIDE_ID)", "openDeskRegister('desk', DEFAULT_DESK_OVERRIDE_ID)") }],
    /* 꾸미기 본문은 되살린 app.js 글 안에 있다(공용 도우미) — 거기서 옛 이름으로 바꿔 본다 */
    ['꾸미기에서 옛 이름으로 부름', { app: s => s.replace('_adminPartActions.openPartRegister(info.cat)', 'openPartRegister(info.cat)') }],
    ['gacha deps 가 옛 이름', { app: s => s.replace('  deletePart: (...a)=>adminPartReg.deletePart(...a),', '  deletePart: (...a)=>deletePart(...a),') }],
    ['html 줄 빠짐', { html: s => s.replace('<script src="parts/admin/admin-part-register.js"></script>', '') }],
    ['app.js 에 본문이 남음', { app: s => s + '\nfunction deletePart(id){}' }],
    /* 같은 deps 줄이 다른 모듈(파츠 그림 part-paint.js)을 만드는 줄에도 있다 — 파츠 등록 창을 만드는 줄 안의 것을 지운다 */
    ['deps 하나 빠짐', { app: s => s.replace(/(const adminPartReg = [^\n]*\n(?:  [^\n]*\n)*?)  wdPreviewBase: \(\)=>[^\n]*\n/, '$1') }],
  ];
  for(const [name, f] of breaks){
    const s2 = f.mod ? f.mod(MOD) : MOD, a2 = f.app ? f.app(SRC) : SRC, h2 = f.html ? f.html(HTML) : HTML, w2 = f.ward ? f.ward(WARD) : WARD;
    const changed = s2 !== MOD || a2 !== SRC || h2 !== HTML || w2 !== WARD;
    let rows2; try{ rows2 = await judgeAll(s2, a2, h2, w2); }catch(_){ rows2 = [[false, '던짐']]; }
    chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

/* ═══ 🧍 sim-creator-open.js — 생성기 여는 입구 · 런처 다시 그리기(creator/creator-open.js · app.js 분리 M21) ═══════════════
   ・1절: openCreator — 3D 를 못 만들면(ensureCreatorPreview false) 아무것도 안 바꿈 · 꾸미기 창을 닫아 저장 · 모드 기억 · 런처에서 왔는지 기억 · 동물 편집은 동물 생성기로 돌려보냄 · 새로 열기 값 · 열림 표시
   ・2절: renderLauncher — 런처 미리보기 · 초대 버튼 · 칸 번호 · 빈 칸 · 톱니 · 미리보기 표시 · 연동 띠가 던져도 이어 감
   ・3절: 연결 — deps 모양 · 옛 이름 · 만드는 줄
   ・4절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const depPairs = (APP, mod, glob, create) => { const m = APP.match(new RegExp('const ' + mod + ' = ' + glob + '\\.' + create + '\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')); return m ? m[1].split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(x => [x[1], x[2]]) : null; };
const SRC = read('creator/creator-open.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음'); process.exit(2); }
function anything(){ const f = function(){ return p; }; const p = new Proxy(f, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : p), apply: () => p, set: () => true, construct: () => p }); return p; }
function mkEl(id, log){ const cl = new Set(); return { id, style: {}, dataset: {}, textContent: '', value: '', children: [], classList: { add: (c) => cl.add(c), remove: (c) => { cl.delete(c); log.push('rm:' + id + ':' + c); }, contains: (c) => cl.has(c), toggle: (c, on) => { on ? cl.add(c) : cl.delete(c); } } }; }
function build(src, o){
  o = o || {};
  const log = [], els = {}; const any = anything();
  const el = (id) => (els[id] = els[id] || mkEl(id, log));
  if(o.launcherOn) el('launcher').classList.add('on'); if(o.wardrobeOn){ el('wardrobePanel').classList.add('on'); }
  const doc = { getElementById: el };
  const st = { mode: null, open: false, preview: o.preview !== false, curSlot: o.curSlot || 0, route: o.route || null };
  const faceCtx = { clearRect(){ log.push('clear:face'); }, drawImage(){} }, blinkCtx = { clearRect(){ log.push('clear:blink'); }, drawImage(){} };
  const crState = { cXform: null, cBase: null, cDesk: null, crStep: 1, skinIndex: 0 };
  const deps = new Proxy({}, { get: (t, k) => (k in t ? t[k] : any) });
  const mix = (obj) => new Proxy(obj, { get: (t, k) => (k in t ? t[k] : any) });
  Object.assign(deps, { creatorPrevMod: mix({ ensureCreatorPreview: () => { log.push('ensure'); return st.preview; }, crFlatView: null, updateCreatorLights: () => log.push('lights'), applyCreatorXform(){}, clearCreatorItems(){}, clearCreatorParts(){} }),
    closeWardrobe: () => log.push('closeWardrobe'), setCreatorMode: (m) => { st.mode = m; log.push('setMode'); }, creatorMode: () => st.mode, setCreatorOpen: (v) => { st.open = v; }, creatorOpen: () => st.open,
    _editRoute: o.noRoute ? null : { entryRoute: () => st.route, deskStep: () => 5 }, reopenAnimalFromCreator: (t) => { log.push('reopenAnimal:' + t); return true; },
    faceC: { getContext: () => faceCtx }, blinkC: { getContext: () => blinkCtx }, CANVAS_SZ: 512, histF: [1], histB: [1], redoF: [1], redoB: [1], crState,
    slots: o.slots || [null, { face: {}, blink: {}, top: '#111', bot: '#222' }], curSlot: () => st.curSlot, CHAR_SLOT_MAX: 5, clampCharY: (v) => v, clampDeskScale: (v) => v, DESK_SCALE_DEFAULT: 0.175,
    _syncCrColorSwatches: () => log.push('swatches'), setCustomItems(){}, isPremium: () => true, isAdmin: () => true, toast: (m) => log.push('toast:' + m),
    licenseGateMod: { refreshInviteBtn: () => log.push('invite') }, launcherPrevMod: () => ({ ensureLauncherPreview: () => log.push('ensureLauncher'), sizeLauncherPreview: () => log.push('sizeLauncher'), setLauncherChar: (d) => log.push('char:' + (d ? 'def' : 'none')) }),
    launcherCtlMod: () => ({ closeGearMenu: () => log.push('ctl') }), slotSyncMod: () => ({ _slotsRenderBand: () => { if(o.bandThrows) throw new Error('x'); log.push('band'); } }) }, o.deps || {});
  const g = { window: {}, document: doc, setTimeout, requestAnimationFrame: () => 0, module: undefined, console: { log(){}, warn(){}, error(){} } };
  const names = Object.keys(g);
  new Function(...names, src)(...names.map(n => g[n]));
  const mod = g.window.TwCreatorOpen.createCreatorOpen(deps);
  return { mod, log, els, st, crState };
}
say('§1 openCreator');
{
  let b = build(SRC, { preview: false, launcherOn: true, wardrobeOn: true });
  b.mod.openCreator({ kind: 'slot', edit: false });
  chk(b.log.join() === 'ensure' && b.st.mode === null && b.st.open === false && b.els.launcher.classList.contains('on') && b.els.wardrobePanel.classList.contains('on'), '★ 3D 미리보기를 못 만들면(false) 아무것도 안 바꾸고 돌아간다 — 꾸미기 창 · 런처 · 모드 · 열림 표시 그대로');
  b = build(SRC, { launcherOn: true, wardrobeOn: true });
  b.mod.openCreator({ kind: 'slot', edit: false });
  chk(b.log.indexOf('closeWardrobe') > b.log.indexOf('ensure') && b.log.includes('closeWardrobe') && !b.els.wardrobePanel.classList.contains('on'), '꾸미기 창이 켜져 있으면 closeWardrobe 로 닫아 저장하고 패널을 끈다');
  chk(b.st.mode && b.st.mode.kind === 'slot' && b.st.mode.cameFromLauncher === true, '모드를 기억하고 «런처에서 왔는지» 를 적는다(완료 · 닫기 때 되돌리려고)');
  chk(b.st.open === true && b.els.creatorOverlay.classList.contains('on') && !b.els.launcher.classList.contains('on'), '생성기 열림 · 오버레이 켬 · 런처 끔');
  chk(b.log.includes('clear:face') && b.log.includes('clear:blink') && b.log.includes('swatches') && b.log.includes('lights'), '새로 열 때 그림 레이어를 비우고 색 스와치 · 조명을 맞춘다');
  chk(b.crState.cXform && b.crState.cXform.s === 0.7 && b.crState.cTopColor === '#9dba8a' && b.crState.skinIndex === 0, '새 캐릭터 기본값 — 크기 0.7 · 옷 색 · 피부 0');
  b = build(SRC, { launcherOn: false });
  b.mod.openCreator();
  chk(b.st.mode.kind === 'slot' && b.st.mode.edit === false && b.st.mode.cameFromLauncher === false, '모드를 안 주면 새 슬롯 · 런처가 안 보였으면 cameFromLauncher false');
  const def = { face: {}, blink: {}, top: '#abc', bot: '#def', xf: { s: 0, y: 9, rot: 1 } };
  b = build(SRC, { slots: [def], curSlot: 0 }); b.mod.openCreator({ kind: 'slot', edit: true, slot: 0 });
  chk(b.crState.currentCreatorDef === def && b.crState.cTopColor === '#abc' && b.crState.cXform.s === 0.7 && b.crState.blinkEdited === true, '수정 — 저장된 def 의 색을 싣고 · 크기가 0 이면 기본 0.7 으로 · 감은눈은 편집된 것으로');
  b = build(SRC, { route: 'animal', slots: [def] });
  b.mod.openCreator({ kind: 'slot', edit: true, slot: 0 });
  chk(b.log.includes('reopenAnimal:face') && !b.log.includes('clear:face') && b.st.open === false, '동물 편집은 동물 생성기(모양부터)로 돌려보내고 여기서는 더 안 한다');
}
say('§2 renderLauncher');
{
  let b = build(SRC, { slots: [null, null], curSlot: 1 }); b.mod.renderLauncher();
  chk(b.log.slice(0, 2).join() === 'ensureLauncher,invite' && b.els.lcCount.textContent === '(2/5)' && b.els.lcEmpty.style.display === 'flex' && b.els.lcGear.style.display === 'none' && b.els.lcPreview.style.display === 'none', '미리보기 → 초대 버튼 · 칸 번호 (2/5) · 빈 칸이면 «만들기» 보이고 톱니 · 미리보기 숨김');
  chk(b.log.includes('sizeLauncher') && b.log.includes('char:none') && b.log.includes('band'), '크기를 맞추고 빈 캐릭터를 올리고 연동 띠를 다시 그린다');
  const def = { face: {} };
  b = build(SRC, { slots: [def], curSlot: 0 }); b.mod.renderLauncher();
  chk(b.els.lcEmpty.style.display === 'none' && b.els.lcGear.style.display === 'block' && b.els.lcPreview.style.display === 'block' && b.log.includes('char:def') && b.els.lcCount.textContent === '(1/5)', '캐릭터가 있으면 반대로');
  b = build(SRC, { slots: [def], curSlot: 0, bandThrows: true }); let th = null; try{ b.mod.renderLauncher(); }catch(e){ th = e; }
  chk(!th, '연동 띠가 던져도 런처 그리기는 끝난다');
}
say('§3 연결');
{
  const iM = HTML.indexOf('<script src="parts/creator/creator-open.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
  chk(iM > 0 && iA > iM, 'html — creator-open.js 를 app.js 보다 먼저 싣는다');
  const code = stripC(APP);
  const pairs = depPairs(APP, 'creatorOpenMod', 'TwCreatorOpen', 'createCreatorOpen');
  const READ = ['assetCodeMod', 'catalogGlbMod', 'commissionMod', 'creatorOpen', 'curSlot', 'customItems', 'deskItemsMod', 'deskPlaceMod', 'deskVisualMod', 'isAdmin', 'launcherCtlMod', 'launcherPrevMod', 'slotSyncMod'];
  const SET = { setCreatorMode: '(v)=>{ crState.creatorMode = v; }',   // creatorMode 의 주인은 생성기 상태(creator-state.js — app.js 분리 F6)
  setCreatorOpen: '(v)=>{ creatorOpen = v; }', setCustomItems: '(v)=>{ customItems = v; }' };
  const FN = ['loadSavedItemsIntoSession', 'toast', 'applyDesktopRunClass'];
  const shape = (n, v) => SET[n] ? v === SET[n] : n === 'closeWardrobe' ? v === '(...a)=>window.closeWardrobe(...a)' : n === 'isPremium' ? v === '()=>acctStateMod.isPremium()' : n === 'creatorMode' ? v === '()=>crState.creatorMode' : READ.includes(n) ? v === '()=>' + n : FN.includes(n) ? v === '(...a)=>' + n + '(...a)' : v === n;
  const bad1 = (pairs || []).filter(([n, v]) => !shape(n, v)).map(p => p.join('='));
  chk(!!pairs && pairs.length >= 40 && !bad1.length, '★ deps ' + (pairs ? pairs.length : 0) + '개 모양 — 읽는 함수 · 쓰는 함수 · 함수 · window 고리(closeWardrobe) · 값' + (bad1.length ? ' — 어긋남: ' + bad1.join(' · ') : ''));
  const bad = pairs ? pairs.map(([n, v]) => n === 'curSlot' ? [n, 'curSlot'] : [n, v]) : [];
  chk(!bad.every(([n, v]) => shape(n, v)), '  깨 보기: 읽는 함수를 값으로 넘기면 빨강');
  chk(/^const openCreator = creatorOpenMod\.openCreator;/m.test(code) && /^const renderLauncher = creatorOpenMod\.renderLauncher;/m.test(code) && !/function (openCreator|renderLauncher)\b/.test(code), '옛 이름 둘을 const 로 받고 본문이 안 남음');
}
say('§4 일부러 깨 보기');
{
  const brk = (a, c) => { const m = SRC.replace(a, c); return m === SRC ? null : m; };
  const m1 = brk("if(!creatorPrevMod.ensureCreatorPreview()) return;", "creatorPrevMod.ensureCreatorPreview();");
  chk(!!m1 && (() => { const b = build(m1, { preview: false, launcherOn: true }); b.mod.openCreator({ kind: 'slot', edit: false }); return b.st.open === true; })(), '3D 못 만들 때 돌아가는 줄을 빼면 빨강');
  const m2 = brk("try{ closeWardrobe(); }catch(_){}", "");
  chk(!!m2 && (() => { const b = build(m2, { wardrobeOn: true }); b.mod.openCreator({ kind: 'slot', edit: false }); return !b.log.includes('closeWardrobe'); })(), '꾸미기 창 저장 닫기를 빼면 빨강');
  const m3 = brk("creatorMode().cameFromLauncher = document.getElementById('launcher').classList.contains('on');", "");
  chk(!!m3 && (() => { const b = build(m3, { launcherOn: true }); b.mod.openCreator({ kind: 'slot', edit: false }); return b.st.mode.cameFromLauncher !== true; })(), '런처에서 왔는지 적기를 빼면 빨강');
  const m4 = brk("try{ slotSyncMod()._slotsRenderBand(); }catch(_){}", "slotSyncMod()._slotsRenderBand();");
  chk(!!m4 && (() => { const b = build(m4, { bandThrows: true }); try{ b.mod.renderLauncher(); return false; }catch(_){ return true; } })(), '연동 띠를 try 밖으로 빼면 빨강');
}
say(''); say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0);

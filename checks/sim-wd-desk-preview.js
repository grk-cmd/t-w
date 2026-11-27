/* sim-wd-desk-preview.js — 🪑 꾸미기 미리보기의 책상 몸 · 책상 위치 계산(parts/character/wd-desk-preview.js)을 실제로 돌려 본다
   실행: node checks/run.js sim-wd-desk-preview
   ・1절 몸 세우기 — 빈 그룹(anchorGroup)의 자리 · 크기를 그대로 · 책상 없음 · 내장 · GLB · 늦게 온 GLB · 보이기
   ・2절 위치 — 기즈모가 옮긴 자리 → deskPos(동물 배율 나눔 · 반올림 · 바닥 아래 막음) · anchorGroup · 파츠 핀 · 초기화 · 다시 만들어도 같은 자리
   ・3절 조절(tune) · 4절 꾸미기 창 배선 · html · smoke · 5절 mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('character/wd-desk-preview.js'), WD = read('character/wardrobe.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js'), APP = read('app.js');
if(!SRC || !WD || !HTML || !SMOKE || !APP){ say('  ? 원본 못 찾음'); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwWdDeskPreview; };

const V = (x, y, z) => ({ x, y, z, set(a, b, c){ this.x = a; this.y = b; this.z = c; return this; }, copy(o){ this.x = o.x; this.y = o.y; this.z = o.z; return this; } });
const grp = () => ({ position: V(0, 0, 0), scale: V(1, 1, 1), userData: {}, visible: true });
const near = (a, b) => Math.abs(a - b) < 1e-9;
const tick = () => new Promise((r) => setImmediate(r));

function world(src, o){
  o = o || {};
  const log = { color: [], hide: 0, sync: [], drawn: [], pending: [] };
  const scene = { kids: [], add(x){ this.kids.push(x); }, remove(x){ this.kids = this.kids.filter(k => k !== x); } };
  const P = load(src).createWdDeskPreview({
    buildDesk: (plain) => { const g = grp(); g.plain = plain; g.top = { material: { id: 'shared', clone(){ return { id: 'own' }; } } }; g.getObjectByName = (n) => (n === 'deskTop' ? g.top : null); return g; },
    deskBodyPlan: (def, gated) => { log.plan = [def.deskCatalogId, gated]; return o.plan ? o.plan(def) : { kind: 'builtin' }; },
    drawDeskLegacyGlb: (body, glb, alive) => new Promise((res) => log.pending.push(() => { const ok = alive(); if(ok) log.drawn.push(['legacy:' + glb]); res(ok ? true : null); })),
    drawDeskGlb: (body, rec, isDef, playMode, alive) => new Promise((res) => log.pending.push(() => { const ok = alive(); if(ok) log.drawn.push([rec.id, isDef, playMode]); res(ok ? true : null); })),
    hideDeskBody: (g) => { log.hide++; g.userData.noDesk = true; },
    applyDeskColor: (seat, c) => log.color.push([seat.desk, seat.deskMat && seat.deskMat.id, c]),
    syncDeskPartAnchor: (g) => log.sync.push(g.userData.deskPosBase ? JSON.stringify(g.userData.deskPosBase) : null),
  });
  const anchor = (pos, sc) => { const a = grp(); a.position.set(pos[0], pos[1], pos[2]); a.scale.set(sc[0], sc[1], sc[2]); return a; };
  const R = (o) => P.rebuild(Object.assign({ base0: o.base0 || { x: o.anchorGroup.position.x, y: o.anchorGroup.position.y, z: o.anchorGroup.position.z } }, o));
  return { P, R, log, scene, anchor, settle: async () => { log.pending.splice(0).forEach(f => f()); await tick(); await tick(); } };
}

async function judge(src){
  const r = []; const t = (ok, msg) => r.push([!!ok, msg]);
  /* 1절 */
  let w = world(src), a = w.anchor([0.1, 0, -0.5], [0.4, 0.2, 0.2]);
  t(w.P.body() === null && w.P.readPos() === null && w.P.resetPos() === null, '세우기 전 — body · readPos · resetPos 는 null(던지지 않는다)');
  await w.R({ scene: w.scene, def: { deskColor: '#abc' }, anchorGroup: a, anim: 1 });
  let b = w.scene.kids[0];
  t(w.scene.kids.length === 1 && b.plain === true && near(b.position.x, 0.1) && near(b.position.z, -0.5) && near(b.scale.x, 0.4) && near(b.scale.y, 0.2), '몸 그룹 하나 — 빈 그룹(anchorGroup)의 자리 · 크기를 그대로 받는다');
  t(w.log.plan[0] === undefined && w.log.plan[1] === true, '어떤 책상을 그릴지는 def 그대로 deskBodyPlan 에 묻는다(여기서 갈래를 다시 쓰지 않음) · 라이선스 게이트를 건다(내 미리보기)');
  t(b.top.material.id === 'own' && w.log.color.length === 1 && w.log.color[0][1] === 'own' && w.log.color[0][2] === '#abc', '내장 책상 — 윗판 재질을 복사해 그 재질에 색을 칠한다(공용 재질을 안 건드림)');
  t(b.visible === false && w.P.body() === null, '★ 처음엔 숨김 — 책상 탭이 아니면 몸을 가리지 않는다');
  w.P.setShown(true);
  t(b.visible === true && w.P.body() === b, '  보이게 하면 기즈모를 붙일 몸을 내준다');
  await w.R({ scene: w.scene, def: {}, anchorGroup: a, anim: 1 });
  t(w.scene.kids.length === 1 && w.scene.kids[0] !== b && w.scene.kids[0].visible === true, '다시 만들면 앞 몸을 치우고 새로 세운다(쌓이지 않음) · 보이기 상태는 이어진다');
  w.P.dispose(); t(w.scene.kids.length === 0 && w.P.body() === null, '  dispose — 장면에서 뺀다');
  w = world(src, { plan: () => ({ kind: 'none' }) }); w.P.setShown(true);
  await w.R({ scene: w.scene, def: { deskCatalogId: '__no_desk__', deskColor: '#abc' }, anchorGroup: w.anchor([0, 0, 0], [1, 1, 1]), anim: 1 });
  t(w.log.hide === 1 && w.P.body() === null && w.log.color.length === 0, '★ «책상 없음» — 몸을 숨기고 손잡이를 붙일 몸이 없다(색도 안 칠함)');
  w = world(src, { plan: (def) => ({ kind: 'glb', rec: { id: def.deskCatalogId }, isDefaultOverride: false }) }); w.P.setShown(true);
  let p = w.R({ scene: w.scene, def: { deskCatalogId: 'L1', deskColor: '#abc' }, anchorGroup: w.anchor([0, 0, 0], [1, 1, 1]), anim: 1 });
  await w.settle(); await p;
  t(JSON.stringify(w.log.drawn) === '[["L1",false,null]]' && w.log.color.length === 2, 'GLB 책상 — 받아 끼운다(애니메이션 mixer 없음 playMode null) · 끼운 뒤 색을 다시 칠한다');
  w = world(src, { plan: (def) => ({ kind: 'glb', rec: { id: def.deskCatalogId } }) });
  p = w.R({ scene: w.scene, def: { deskCatalogId: 'OLD' }, anchorGroup: w.anchor([0, 0, 0], [1, 1, 1]), anim: 1 });
  const p2 = w.R({ scene: w.scene, def: { deskCatalogId: 'NEW' }, anchorGroup: w.anchor([0, 0, 0], [1, 1, 1]), anim: 1 });
  await w.settle(); await p; await p2;
  t(JSON.stringify(w.log.drawn.map(x => x[0])) === '["NEW"]' && w.scene.kids.length === 1, '★ 받는 사이 다시 만들면 늦게 온 앞 GLB 는 끼우지 않는다');
  w = world(src, { plan: (def) => ({ kind: 'glb', rec: { id: 'ov' }, isDefaultOverride: true }) });
  p = w.R({ scene: w.scene, def: {}, anchorGroup: w.anchor([0, 0, 0], [1, 1, 1]), anim: 1 }); await w.settle(); await p;
  t(w.log.drawn[0][1] === true, '  기본 책상 교체본은 판단이 준 isDefaultOverride 로 끼운다');
  w = world(src, { plan: (def) => ({ kind: 'legacyGlb', glb: def.deskGlb }) });
  p = w.R({ scene: w.scene, def: { deskGlb: 'OLDGLB', deskColor: '#abc' }, anchorGroup: w.anchor([0, 0, 0], [1, 1, 1]), anim: 1 }); await w.settle(); await p;
  t(JSON.stringify(w.log.drawn) === '[["legacy:OLDGLB"]]' && w.log.color.length === 2, '★ 옛 캐릭터 def 에 박힌 책상(deskGlb)도 좌석과 같게 끼운다');

  /* 2절 */
  for(const anim of [1, 0.4]){
    w = world(src); w.P.setShown(true);
    a = w.anchor([9, 9, 9], [1, 1, 1]);
    const B0 = { x: 0.1, y: 0, z: -0.5 };
    w.P.placeDeskPos(a, B0, { x: 0.2, y: 0.3, z: -0.1 }, anim);   // wardrobe.js 가 빈 그룹을 놓는 것과 같은 부름
    t(near(a.position.x, 0.1 + 0.2 * anim) && near(a.position.y, 0.3 * anim) && near(a.position.z, -0.5 - 0.1 * anim) && JSON.stringify(a.userData.deskPosBase) === '{"x":0.2,"y":0.3,"z":-0.1}', '★ placeDeskPos — base0 + deskPos × 배율 · 상쇄 몫은 100% 단위 그대로(배율 ' + anim + ')');
    await w.R({ scene: w.scene, def: { deskPos: { x: 0.2, y: 0.3, z: -0.1 } }, anchorGroup: a, base0: B0, anim });
    b = w.P.body();
    let pos = w.P.readPos();
    t(near(pos.x, 0.2) && near(pos.y, 0.3) && near(pos.z, -0.1), '안 옮기고 읽으면 저장된 deskPos 그대로(배율 ' + anim + ')');
    b.position.x += 0.5 * anim; b.position.z += 0.25 * anim;
    pos = w.P.readPos();
    t(near(pos.x, 0.7) && near(pos.y, 0.3) && near(pos.z, 0.15), '★ 화면에서 옮긴 양 ÷ 배율 = deskPos(100% 단위 · 배율 ' + anim + ')');
    t(near(a.position.x, b.position.x) && near(a.position.z, b.position.z) && JSON.stringify(a.userData.deskPosBase) === '{"x":0.7,"y":0.3,"z":0.15}' && w.log.sync.slice(-1)[0] === '{"x":0.7,"y":0.3,"z":0.15}', '  «책상 위» 파츠 자리(anchorGroup)도 같은 자리로 · 파츠 핀 상쇄 몫을 갱신한다');
    b.position.y = -5;
    pos = w.P.readPos();
    t(pos.y === 0 && near(b.position.y, 0), '★ 바닥 아래로는 못 간다(y 0 에서 멈춤 · 몸도 되돌린다)');
    b.position.x = 0.1 + 0.123456 * anim;
    t(near(w.P.readPos().x, 0.123), '  소수 셋째 자리로 반올림');
    const z = w.P.resetPos();
    t(z.x === 0 && z.y === 0 && z.z === 0 && near(b.position.x, 0.1) && near(b.position.z, -0.5) && !('deskPosBase' in a.userData) && w.log.sync.slice(-1)[0] === null, '초기화 — 0,0,0 · 몸은 deskPos 를 뺀 자리로 · 상쇄 몫을 지운다');
  }
  w = world(src); w.P.setShown(true);
  { const g = w.anchor([0, 0, 0], [1, 1, 1]); w.P.placeDeskPos(g, { x: 0, y: 0, z: 0 }, { x: 0, y: -0.15, z: 0 }, 1);
    await w.R({ scene: w.scene, def: { deskPos: { x: 0, y: -0.15, z: 0 } }, anchorGroup: g, base0: { x: 0, y: 0, z: 0 }, anim: 1 });
    const bb = w.P.body(); bb.position.x += 0.3;
    let q = w.P.readPos();
    t(near(q.y, -0.15) && near(q.x, 0.3), '★ 생성기에서 0 아래로 저장된 높이는 그대로 둔다(좌우만 옮겨도 높이가 0 으로 바뀌지 않음)');
    bb.position.y = -3; q = w.P.readPos();
    t(near(q.y, -0.15), '  그 값보다 더 아래로는 못 간다'); }
  w = world(src);
  { const g = w.anchor([1, 1, 1], [1, 1, 1]); g.userData.deskPosBase = { x: 1, y: 0, z: 0 };
    w.P.placeDeskPos(g, { x: 0.5, y: 0, z: 0 }, null, 0.4);
    t(near(g.position.x, 0.5) && !('deskPosBase' in g.userData), 'placeDeskPos — deskPos 가 없으면 base0 그대로 · 상쇄 몫 칸을 지운다');
    const sc = w.P.scaleOf({ deskScale: 0.2, deskLenX: 1.5 }, 0.4), s1 = w.P.scaleOf({}, 1);
    t(near(sc.x, 0.2 * 1.5 * 0.4) && near(sc.y, 0.08) && near(sc.z, 0.08) && s1.x === 1 && s1.y === 1, 'scaleOf — 크기 × 길이는 x 에만 · 동물 배율 · 값이 없으면 1'); }
  t(w.P.isZero(null) && w.P.isZero({ x: 0, y: 0, z: 0 }) && !w.P.isZero({ x: 0, y: 0.001, z: 0 }), 'isZero — 없음 · 0,0,0 은 참 · 하나라도 있으면 거짓');

  /* 3절 */
  w = world(src); w.P.setShown(true);
  w.P.tune({ deskScale: 0.2 });
  t(w.log.color.length === 0, '세우기 전 tune 은 아무것도 안 한다');
  await w.R({ scene: w.scene, def: {}, anchorGroup: w.anchor([0, 0, 0], [1, 1, 1]), anim: 0.4 });
  b = w.P.body(); w.P.tune({ deskScale: 0.2, deskLenX: 1.5, deskColor: '#fff' });
  t(near(b.scale.x, 0.2 * 1.5 * 0.4) && near(b.scale.y, 0.2 * 0.4) && near(b.scale.z, 0.2 * 0.4) && w.log.color.slice(-1)[0][2] === '#fff' && w.scene.kids[0] === b, '★ tune — 다시 만들지 않고 크기(크기 × 길이 × 동물 배율) · 색만 맞춘다');
  w.P.tune({});
  t(near(b.scale.x, 0.4) && near(b.scale.y, 0.4), '  크기 · 길이가 없으면 1');
  return r;
}

(async () => {
  say('── 1 · 2 · 3. 몸 세우기 · 위치 · 조절');
  (await judge(SRC)).forEach(([ok, msg]) => chk(ok, msg));

  say('── 4. 배선');
  chk(/deskPreview\.setShown\(currentWdGroup === 'desk'\);[^\n]*\n[^\n]*\n\s*if\(_wdDeskTabOn\(\)\)\{[\s\S]{0,400}wdGizmo\.attach\(body\); wdGizmo\.setMode\('translate'\);/.test(WD), '꾸미기 — 책상 묶음 탭에서만 몸을 보이고, 책상 탭이면 그 몸에 이동 손잡이를 붙인다');
  chk(!/wdGizmoMode\s*=\s*'translate'/.test(WD.slice(WD.indexOf('if(_wdDeskTabOn()){'), WD.indexOf('if(_wdDeskTabOn()){') + 700)), '  ↳ 파츠용 모드(wdGizmoMode)는 안 바꾼다');
  chk(/else if\(_wdDeskTabOn\(\)\) _wdDeskDragged\(\); else syncWdGizmoToXf\(\);/.test(WD) && /if\(e\.value\) return; if\(_wdDeskTabOn\(\)\) _wdDeskDropped\(\); renderWardrobe\(\);/.test(WD), '끄는 동안 _wdDeskDragged · 놓으면 _wdDeskDropped(저장 · 방 · 좌석 줄)');
  chk(/deskPreview\.dispose\(\);\s*if\(wdPreviewBase\)\{/.test(WD) && /deskPreview\.rebuild\(\{ scene:wdScene, def, anchorGroup:_wdDeskGrp, base0:_wdBase0, anim:_wdAnim \}\)/.test(WD), '미리보기를 다시 만들 때 앞 몸을 치우고, 빈 그룹 · deskPos 를 뺀 자리 · 동물 배율을 넘겨 새로 세운다');
  chk(/deskPreview\.scaleOf\(def, _wdAnim\)/.test(WD) && /deskPreview\.placeDeskPos\(_wdDeskGrp, _wdBase0, def\.deskPos, _wdAnim\);/.test(WD) && !/_wdDeskGrp\.position\.[xyz] \+=/.test(WD) && !/_wdDeskGrp\.userData\.deskPosBase =/.test(WD), '★ 빈 그룹의 크기 · deskPos 얹기도 이 모듈의 같은 식을 부른다(wardrobe.js 에 사본 없음)');
  chk(/function _wdDeskTabOn\(\)\{ return currentWdTab === WD_DESK_TAB\(\) && wdLicensed\(\); \}/.test(WD), '잠긴 탭(라이선스 없음)에서는 손잡이를 붙이지 않는다');
  chk(/const _desk = !_ear && currentWdGroup === 'desk';/.test(WD) && /_desk \? WD_DESK_CAM_ZOOM : 1/.test(WD) && /deskPreview\.setShown\(currentWdGroup === 'desk'\);\s*updateWdCam\(\);/.test(WD), '책상 묶음 탭 구도 — 물러나서 책상까지 담는다 · 탭을 드나들 때 구도를 다시 잡는다');
  chk(/deskPreview\.tune\(def\);/.test(WD) && /wdDraftDef\.deskPos=def\.deskPos;/.test(WD), '색 · 크기 · 길이 조절은 tune · 초안에도 deskPos 를 적는다');
  chk(!/deskPreview\.body\(\)\.(position|scale)|setDeskScale\(deskPreview|setDeskPos\(deskPreview/.test(WD), '꾸미기 창이 몸 그룹의 자리 · 크기를 직접 쓰지 않는다(setDeskScale · setDeskPos 금지 — 미리보기 자리 식이 깨진다)');
  { const iM = HTML.indexOf('parts/character/wd-desk-preview.js'), iW = HTML.indexOf('src="parts/character/wardrobe.js"'), iA = HTML.indexOf('src="parts/app.js"');
    chk(iM > 0 && iM < iA && (iW < 0 || iW < iA), 'html — wd-desk-preview.js 를 app.js 보다 먼저 싣는다');
    chk(SMOKE.includes("PRELOAD.push('wd-desk-preview.js');"), 'smoke — PRELOAD');
    const iC = APP.indexOf('const wdDeskPreview = TwWdDeskPreview.createWdDeskPreview({'), iWd = APP.indexOf('const wardrobeMod = TwWardrobe.createWardrobe({');
    chk(iC > 0 && iC < iWd && /^  deskPreview: wdDeskPreview,$/m.test(APP), 'app.js — 꾸미기 창보다 먼저 만들어 deps 로 넘긴다'); }

  say('── 5. mutation test');
  const reds = async (s) => { try{ return (await judge(s)).filter(([ok]) => !ok).length; }catch(_){ return 99; } };
  chk((await reds(SRC)) === 0, '원본은 빨강 0');
  const M = [
    ['배율을 안 나눔', SRC.replace('x:r3((b.x - st.base0.x)/a)', 'x:r3((b.x - st.base0.x))')],
    ['바닥 아래를 안 막음', SRC.replace('y:Math.max(st.minY, r3((b.y - st.base0.y)/a))', 'y:r3((b.y - st.base0.y)/a)')],
    ['저장된 음수 높이를 0 으로 올림', SRC.replace('minY:Math.min(0, +(def.deskPos && def.deskPos.y) || 0),', 'minY:0,')],
    ['몸을 anchorGroup 자리로 안 맞춤', SRC.replace('  st.body.position.copy(st.anchorGroup.position);\n', '')],
    ['파츠 핀을 안 맞춤', SRC.replace('  syncDeskPartAnchor(st.anchorGroup);\n', '')],
    ['늦게 온 GLB 를 끼움', SRC.replace('st.alive = false;', '')],
    ['앞 몸을 안 치움', SRC.replace('st.scene.remove(st.body);', '')],
    ['숨긴 몸에도 손잡이', SRC.replace('(st && shown && !st.body.userData.noDesk)', '(st && !st.body.userData.noDesk)')],
    ['책상 없음에도 손잡이', SRC.replace('(st && shown && !st.body.userData.noDesk)', '(st && shown)')],
    ['크기 식이 동물 배율을 빼먹음', SRC.replace('return { x:s*lx*a, y:s*a, z:s*a };', 'return { x:s*lx, y:s, z:s };')],
    ['상쇄 몫에 배율을 곱함', SRC.replace('group.userData.deskPosBase = { x, y, z };', 'group.userData.deskPosBase = { x:x*a, y:y*a, z:z*a };')],
    ['옛 deskGlb 를 안 끼움', SRC.replace("(plan.kind === 'legacyGlb') ? drawDeskLegacyGlb(body, plan.glb, alive) : ", '')],
    ['공용 재질에 색칠', SRC.replace('top.material = top.material.clone(); ', '')],
    ['받은 base0 를 안 씀', SRC.replace('base0:{ x:o.base0.x, y:o.base0.y, z:o.base0.z }', 'base0:{ x:o.anchorGroup.position.x, y:o.anchorGroup.position.y, z:o.anchorGroup.position.z }')],
  ];
  for(const [name, m] of M) chk(m !== SRC && (await reds(m)) > 0, name + ' → 빨강');

  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

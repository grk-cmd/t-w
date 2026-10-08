/* ═══ 🐾 sim-wd-ear.js — 꾸미기 › 머리 › 귀 탭 (wd-ear.js · app.js 배선) (2026-10-08 신설) ═══════════════
   시안 2 확정본 + 2026-10-08 결정(동물 생성기처럼 왼쪽 · 오른쪽 상자를 늘 따로): 조정할 귀 줄(◀ ▶ ⇆ ↺) · 기즈모 · 크기 －/＋ · 미리보기에서 귀 누르기 ·
   초안 → 저장 · 동물은 탭 숨김 · 바탕색 없음(색은 그리기로만 — 2026-10-08 결정).
   ・1절: wd-ear.js 를 가짜 DOM · 실제 three · 실제 human-ear.js 로 돌린다
   ・2절: 저장(commit) · 초안 복사(copyIntoDraft)
   ・1절 끝: ✎ 그리기 대상 · 그림 저장 · 종류를 바꾸면 그림 버림
   ・3절: app.js 배선 — 조립 두 곳 · 초안 · 저장(지금 주인 · 원래 주인) · 탭 · 3-b 귀 그리기(대상 목록 · 대칭 · 저장 · 방 전송 · 지문) · 3-c 탑승 높이 · 기즈모 · 크기 · 귀 누르기 · 지문 · 카메라
   ・4절: html · smoke.js
   [실행] wd-ear.js · human-ear.js · app.js · base-glb.js · ears-glb.js · desk-companion-prototype.html · smoke.js 가 있는 폴더에서.
     three 는 vendor/three/three.min.js 를 쓴다. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['wd-ear.js', 'human-ear.js', 'app.js', 'base-glb.js', 'ears-glb.js', 'desk-companion-prototype.html', 'smoke.js'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const threePath = ['vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE = require(require('path').resolve(threePath));
const win = {};
['base-glb.js', 'ears-glb.js', 'human-ear.js', 'wd-ear.js'].forEach(f => new Function('window', 'module', SRC[f])(win, undefined));
const H = win.HumanEar, W = win.WdEar;
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

/* ── 가짜 DOM — wd-ear.js 가 쓰는 만큼만 ── */
function mkEl(tag){
  const e = { tagName:tag.toUpperCase(), children:[], style:{}, className:'', textContent:'', title:'', type:'', checked:false, disabled:false,
    appendChild(c){ this.children.push(c); return c; },
    get innerHTML(){ return ''; }, set innerHTML(v){ this.children = []; this._html = v; },
    get innerText(){ return all(this).map(x => x.textContent).filter(Boolean).join(' '); } };
  return e;
}
const all = (e) => [e].concat(...e.children.map(all));
const ELS = { wdGizmoBar:mkEl('div'), wdEarAdjRow:mkEl('div') };
ELS.wdGizmoBar.style.display = 'none'; ELS.wdEarAdjRow.style.display = 'none';
const doc = { createElement:mkEl, createTextNode:(t) => ({ textContent:t, children:[] }), getElementById:(id) => ELS[id] || null };
const rowBtns = () => ELS.wdEarAdjRow.children.filter(e => e.tagName === 'BUTTON');

/* 사람 기본 뼈대(본만) — sim-human-ear.js 와 같은 방식 */
function glbTree(b64){
  const buf = Buffer.from(b64, 'base64'), len = buf.readUInt32LE(12);
  const j = JSON.parse(buf.toString('utf8', 20, 20 + len));
  const joints = new Set((j.skins || []).flatMap(s => s.joints));
  const objs = j.nodes.map((n, i) => { const o = joints.has(i) ? new THREE.Bone() : new THREE.Object3D(); o.name = n.name || '';
    if(n.translation) o.position.fromArray(n.translation); if(n.rotation) o.quaternion.fromArray(n.rotation); if(n.scale) o.scale.fromArray(n.scale); return o; });
  j.nodes.forEach((n, i) => (n.children || []).forEach(c => objs[i].add(objs[c])));
  const root = new THREE.Group(); objs.filter(o => !o.parent).forEach(o => root.add(o)); root.updateMatrixWorld(true); return root;
}
const fakeEar = (key) => { const s = key.slice(-1), g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.3), new THREE.MeshBasicMaterial({ side:THREE.DoubleSide }));
  m.position.set(H.ANIMAL_EAR_BONE[s][0], H.ANIMAL_EAR_BONE[s][1] + 0.45, H.ANIMAL_EAR_BONE[s][2]); g.add(m); return g; };
const HE = H.createHumanEar({ THREE, earTypes:() => win.ANIMAL_EAR_TYPES, parseEar:(k, cb) => cb(win.ANIMAL_EARS[k] ? fakeEar(k) : null) });

let decorations = [], drawing = false, synced = 0;
let tab = W.WD_EAR_TAB, draft = { skin:0, top:'#fff' }, root = glbTree(win.BASE_GLB_B64), rerenders = 0, toasts = [];
HE.ensureHolder(root);
const gizmo = { object:null, attach(o){ this.object = o; }, detach(){ this.object = null; } };
const WE = W.createWdEar({ humanEar:HE, HumanEar:H, doc, getTab:() => tab, getDraft:() => draft, getPreviewRoot:() => root,
  getGizmo:() => gizmo, setGizmoMode:() => {}, earTypes:() => win.ANIMAL_EAR_TYPES, material:() => new THREE.MeshBasicMaterial(),
  toast:(m) => toasts.push(m), rerender:() => { rerenders++; },
  decorate:(w) => { decorations.push(w.userData.humanEar); }, isDrawing:() => drawing, onSynced:() => { synced++; } });

say('── 1. 귀 탭 (가짜 DOM · 실제 three)');
chk(WE.available({}) && !WE.available({ animal:true }) && !WE.available(null), '동물 캐릭터에는 탭이 없다');
let wrap = mkEl('div'); WE.render(wrap);
const nTypes = win.ANIMAL_EAR_TYPES.length;
/* 동물 생성기 «2 귀» 와 같은 화면 — 왼쪽 · 오른쪽 상자(cr-groupbox) 안에 버튼(skin-sw) */
const boxes = (w) => all(w).filter(e => /\bwd-ear-box\b/.test(e.className));
const swOf = (box) => all(box).filter(e => e.tagName === 'BUTTON' && /\bskin-sw\b/.test(e.className));
const press = (w, side, text) => swOf(boxes(w)[side === 'L' ? 0 : 1]).find(b => b.textContent === text).onclick();
const reRender = () => { wrap = mkEl('div'); WE.render(wrap); };
const bx = boxes(wrap);
chk(bx.length === 2 && /\bcr-groupbox\b/.test(bx[0].className), '왼쪽 · 오른쪽 상자 둘(동물 생성기와 같은 cr-groupbox)');
chk(all(bx[0]).some(e => /cr-groupbox-label/.test(e.className) && e.textContent === '왼쪽 귀') && all(bx[1]).some(e => /cr-groupbox-label/.test(e.className) && e.textContent === '오른쪽 귀'), '상자 이름 — 왼쪽 귀 · 오른쪽 귀');
chk(bx.every(x => swOf(x).length === nTypes + 1), `상자마다 버튼: 없음 + 귀 ${nTypes}종`);
chk(bx.every(x => swOf(x)[0].textContent === '없음' && /\bon\b/.test(swOf(x)[0].className)), '첫 버튼은 «없음» · 귀가 없으면 켜져 있다');
chk(swOf(bx[0]).slice(1).map(b => b.textContent).join() === win.ANIMAL_EAR_TYPES.map(t => t.label).join(), '버튼 이름 = ANIMAL_EAR_TYPES 의 이름(동물 생성기와 같은 목록 · 순서)');
chk(!all(wrap).some(e => e.type === 'checkbox'), '«좌우 같이» 체크칸 없음 — 늘 따로 고른다(2026-10-08 결정)');
chk(!/바탕색|머리카락/.test(all(wrap).map(e => e.textContent).join(' ')), '귀 바탕색 줄 없음 — 색은 그리기로만(2026-10-08 결정)');
press(wrap, 'L', '고양이');
chk(draft.earL === 'cat' && !('earR' in draft) && WE.side() === 'L', '왼쪽만 고양이 — 오른쪽은 그대로 · 조정 대상은 왼쪽');
reRender(); press(wrap, 'R', '고양이');
chk(draft.earL === 'cat' && draft.earR === 'cat' && WE.side() === 'R', '오른쪽도 고양이 — 조정 대상이 오른쪽으로');
chk(!!HE.findWrap(root, 'L') && !!HE.findWrap(root, 'R') && rerenders > 0, '미리보기에 양쪽 귀가 붙고 화면을 다시 그린다');
reRender();
chk(/\bon\b/.test(swOf(boxes(wrap)[0]).find(b => b.textContent === '고양이').className) && !/\bon\b/.test(swOf(boxes(wrap)[0])[0].className), '고른 버튼에 체크 표시(on) · «없음» 은 꺼진다');
chk(!('earColor' in draft) && !('earColorFollow' in draft), '초안에 바탕색 필드를 안 만든다');

WE.setSide('L'); WE.syncGizmo();
chk(ELS.wdGizmoBar.style.display === 'flex' && ELS.wdEarAdjRow.style.display === 'flex', '귀가 있으면 기즈모 바 · 조정할 귀 줄이 보인다');
chk(rowBtns().map(b => b.textContent).join('|') === '◀ 왼쪽|오른쪽 ▶|⇆|↺', '조정할 귀 줄 — ◀ 왼쪽 · 오른쪽 ▶ · ⇆ · ↺');
chk(gizmo.object === HE.findWrap(root, 'L'), '핸들은 조정할 쪽 귀에');
chk(decorations.join() === 'L,R', '미리보기에 붙은 귀마다 그림을 입힌다(decorate)');
chk(synced > 0, '귀가 붙은 뒤 연필 버튼을 다시 맞춘다(onSynced)');
drawing = true; WE.syncGizmo();
chk(gizmo.object === null && ELS.wdEarAdjRow.style.display === 'flex', '그리는 동안은 핸들을 안 붙인다(좌클릭은 붓) · 줄은 남는다');
drawing = false; WE.syncGizmo();

// 좌우 다르게
press(wrap, 'R', '곰');
chk(draft.earL === 'cat' && draft.earR === 'bear', '오른쪽만 곰으로');
chk(WE.side() === 'R', '방금 바꾼 쪽이 조정 대상이 된다');
reRender(); press(wrap, 'L', '없음');
chk(!('earL' in draft) && draft.earR === 'bear', '왼쪽 «없음» → earL 필드가 사라진다');
WE.syncGizmo();
chk(rowBtns()[0].disabled === true && rowBtns()[2].disabled === true, '귀가 없는 쪽 버튼 · ⇆ 는 잠긴다');
WE.setSide('L');
chk(WE.side() === 'R', '귀가 없는 쪽으로는 안 바뀐다');
WE.mirror();
chk(/반대쪽에 귀가 없어요/.test(toasts.join()), '반대쪽이 비었으면 ⇆ 는 안내만');

// 조정 · 대칭 · 초기화 · 크기
reRender(); press(wrap, 'L', '고양이');
WE.setSide('R'); WE.syncGizmo();
const wR = HE.findWrap(root, 'R');
wR.position.x += 0.2; wR.rotation.z += 0.3; wR.rotation.y -= 0.1; WE.onGizmoChange();
chk(near(draft.earAdj.R.px, 0.2) && near(draft.earAdj.R.rot, 0.3) && near(draft.earAdj.R.ry, -0.1), '기즈모로 움직이면 초안 조정값에 적힌다');
WE.mirror();
const mL = draft.earAdj.L;
chk(near(mL.px, -0.2) && near(mL.rot, -0.3) && near(mL.ry, 0.1), '⇆ — 반대쪽에 x 위치 · Y·Z 회전 부호를 뒤집어 복사');
chk(near(HE.findWrap(root, 'L').position.x, HE.findWrap(root, 'L').userData.pivot.x - 0.2), '⇆ — 미리보기 귀에도 바로 반영');
draft.earAdj.R = Object.assign(H.newAdj(), { scx:1, scy:2, scz:1, sc:1 });
for(let i = 0; i < 100; i++) WE.scaleStep(1, true);
const aR = draft.earAdj.R;
chk(near(aR.sc, 2.5) && near(aR.scy / aR.scx, 2), '크기 ＋ — 2.5 에서 멈추고 축별 비율은 유지');
for(let i = 0; i < 200; i++) WE.scaleStep(-1, true);
chk(near(draft.earAdj.R.sc, 0.3), '크기 － — 0.3 에서 멈춘다');
WE.reset();
chk(JSON.stringify(draft.earAdj.R) === JSON.stringify(H.newAdj()) && near(draft.earAdj.L.px, -0.2), '↺ — 그 귀만 처음으로');

// 미리보기에서 귀 누르기
root.updateMatrixWorld(true);
const target = HE.findWrap(root, 'L').children[0].children[0].getWorldPosition(new THREE.Vector3());
const rc = new THREE.Raycaster(new THREE.Vector3(target.x, target.y, 10), new THREE.Vector3(0, 0, -1));
chk(WE.pickAt(rc) === true && WE.side() === 'L' && gizmo.object === HE.findWrap(root, 'L'), '미리보기에서 왼쪽 귀를 누르면 왼쪽이 조정 대상');
const miss = new THREE.Raycaster(new THREE.Vector3(50, 50, 10), new THREE.Vector3(0, 0, -1));
chk(WE.pickAt(miss) === false && WE.side() === 'L', '빈 곳을 누르면 그대로');

// 탭을 떠나면
tab = 'hat';
chk(WE.isActive() === false, '다른 탭이면 isActive 거짓');
chk(WE.hideRow() === true && ELS.wdEarAdjRow.style.display === 'none' && WE.hideRow() === false, 'hideRow — 보이던 줄이면 true(구도 되돌리기 신호) · 두 번째는 false');
tab = W.WD_EAR_TAB;
draft = { earL:'cat' }; root = glbTree(win.BASE_GLB_B64); HE.ensureHolder(root);
draft.earL = null; delete draft.earL;
WE.syncGizmo();
chk(ELS.wdGizmoBar.style.display === 'none' && ELS.wdEarAdjRow.style.display === 'none' && gizmo.object === null, '귀가 하나도 없으면 바 · 줄 · 핸들 모두 숨김');

// 🖍️ 그리기 대상 · 그림 저장
tab = W.WD_EAR_TAB; draft = { earL:'cat', earR:'cat' }; root = glbTree(win.BASE_GLB_B64); HE.ensureHolder(root);
HE.attachFromDef(root, draft, {});
let pt = WE.picTarget();
chk(pt && pt.ear && pt.targets.map(t => t.side).join() === 'L,R' && pt.symOk === true, '그리기 대상 — 좌·우 귀 둘 · 같은 종류면 대칭 가능');
chk(pt.targets.every(t => t.wrapper === HE.findWrap(root, t.side)), '대상은 지금 미리보기에 붙은 귀');
draft.earR = 'bear'; HE.attachFromDef(root, draft, {});
chk(WE.picTarget().symOk === false, '좌우 종류가 다르면 대칭 잠금(정점 짝이 안 맞는다)');
delete draft.earR; HE.attachFromDef(root, draft, {});
chk(WE.picTarget().targets.length === 1 && WE.picTarget().symOk === false, '한쪽만 있으면 대상 하나 · 대칭 없음');
tab = 'hat'; chk(WE.picTarget() === null, '귀 탭이 아니면 대상 없음(파츠 그리기로 간다)'); tab = W.WD_EAR_TAB;
WE.setPic('L', 'https://x/pic_a.png'); chk(draft.earPicL === 'https://x/pic_a.png', '그림 저장 — 초안 earPicL');
WE.setPic('L', null); chk(!('earPicL' in draft), '다 지우고 완료하면 필드가 사라진다');
draft = { earL:'cat', earR:'cat', earPicL:'u1', earPicR:'u2' }; root = glbTree(win.BASE_GLB_B64); HE.ensureHolder(root);
reRender(); press(wrap, 'L', '곰');
chk(!('earPicL' in draft) && draft.earPicR === 'u2', '귀 종류를 바꾸면 그 쪽 그림만 버린다(UV 배치가 달라서)');
draft.earPicL = 'u3'; reRender(); press(wrap, 'L', '곰');
chk(draft.earPicL === 'u3', '같은 종류를 다시 고르면 그림은 그대로');

say('── 2. 저장 · 초안 복사');
const src = { earL:'cat', earR:'rabbit', earAdj:{ L:{ px:0.1 }, R:{ py:0.2 } } };
const dr = Object.assign({}, src); WE.copyIntoDraft(dr, src);
dr.earAdj.L.px = 9;
chk(src.earAdj.L.px === 0.1, '초안 조정값은 깊은 복사 — 저장 전에는 캐릭터에 안 샌다');
const def1 = {};
chk(WE.commit(def1, dr) === true && def1.earL === 'cat' && def1.earR === 'rabbit' && def1.earAdj.L.px === 9, '저장 — 귀 종류 · 조정값이 def 로 · 바뀌었으면 true');
chk(WE.commit(def1, dr) === false, '같은 값이면 false(좌석 귀를 다시 안 붙인다)');
const dr2 = { earR:'rabbit', earAdj:{ L:{ px:3 }, R:{ py:0.2 } } };
WE.commit(def1, dr2);
chk(!('earL' in def1) && def1.earR === 'rabbit' && !('L' in def1.earAdj), '없는 쪽은 종류도 조정값도 안 남긴다');
WE.commit(def1, {});
chk(!('earL' in def1) && !('earR' in def1) && !('earAdj' in def1), '귀를 다 빼면 필드가 전부 사라진다(옛 def 와 같은 모양)');
WE.commit(def1, { earL:'evil', earR:'cat' });
chk(!('earL' in def1) && def1.earR === 'cat', '모르는 귀 종류는 저장하지 않는다');
const def2 = {};
chk(WE.commit(def2, { earL:'cat', earR:'cat', earPicL:'https://x/L.png', earPicR:'https://x/R.png' }) === true && def2.earPicL === 'https://x/L.png' && def2.earPicR === 'https://x/R.png', '저장 — 귀 그림도 def 로');
chk(WE.commit(def2, { earL:'cat', earR:'cat', earPicL:'https://x/L2.png', earPicR:'https://x/R.png' }) === true, '그림만 바뀌어도 true(좌석 귀를 다시 칠한다)');
WE.commit(def2, { earR:'cat', earPicL:'https://x/L2.png', earPicR:'https://x/R.png' });
chk(!('earPicL' in def2) && def2.earPicR === 'https://x/R.png', '귀가 없는 쪽 그림은 안 남긴다');
const dr3 = {}; WE.copyIntoDraft(dr3, {});
chk(!('earAdj' in dr3), '조정값이 없는 def 의 초안에는 earAdj 를 안 만든다');

say('── 3. app.js 배선');
const APP = SRC['app.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const A = strip(APP);
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
chk(/HumanEar\.createHumanEar\(\{/.test(A) && /window\.parseAnimalEar/.test(A), 'humanEar — animal.js 귀 파서를 같이 쓴다');
chk(/const humanEar = \(typeof HumanEar === 'undefined'\) \? null : HumanEar\.createHumanEar/.test(A) && /if\(!humanEar \|\| !root/.test(A), '귀 모듈이 없어도 app.js 는 켜진다 — humanEar 없으면 귀만 꺼짐');
const off = /const WD_EAR_OFF = (\{[\s\S]*?\});/.exec(A);
let offOk = false;
try{ const o = new Function('return ' + off[1])(); offOk = Object.keys(o).filter(k => k !== 'TAB').sort().join() === Object.keys(WE).filter(k => typeof WE[k] === 'function' && !['side','link','setSide','reset','mirror'].includes(k)).sort().join() && o.available({}) === false && o.isActive() === false; }catch(_){}
chk(offOk, '빈 껍데기(WD_EAR_OFF)가 app.js 가 부르는 함수를 다 갖고 · 탭을 안 보인다');
chk(/const wdEar = \(typeof WdEar === 'undefined' \|\| !humanEar\) \? WD_EAR_OFF : WdEar\.createWdEar/.test(A), 'wd-ear.js 가 없으면 빈 껍데기');
const att = grab(A, '_attachHumanEars');
chk(/def && def\.animal\)\) return;/.test(att) && /humanEar\.ensureHolder\(root\);[\s\S]*humanEar\.attachFromDef\(root, def,/.test(att), '_attachHumanEars — 동물 제외 · holder 먼저 · def 대로');
chk(/normalizeModel\(inst\.root, 1\.4, def\.isCommission\);\s*_attachHumanEars\(inst\.root, def\);/.test(A), 'defToBase — 정규화 직후 귀(미리보기 · 런처 미리보기)');
chk(/if\(!inst\._animal\) _attachHumanEars\(inst\.root, def\);\s*setupSeatModel\(seat, inst\.root,/.test(A), '좌석 — setupSeatModel(애니메이션) 직전, 바인드 자세에서');
chk(/humanEar\.findWrap|createWdEar/.test(A) && /color:'#ffffff'/.test(grab(A, '_humanEarMat')), '귀 재질은 흰색으로 시작');
chk(/wdEar\.copyIntoDraft\(wdDraftDef, def\);/.test(grab(A, 'ensureWdDraft')), '초안 — 귀 조정값 깊은 복사');
chk(/if\(wdEar\.commit\(def, draft\)\) _attachHumanEars\(mySeat\.modelRoot, def\);/.test(grab(APP, '_commitWdDraftNow').replace(/\/\*[\s\S]*?\*\//g, '')), '저장 — 바뀌었으면 좌석 귀를 다시 붙인다');
const own = grab(APP, '_commitWdDraftToOwner').replace(/\/\*[\s\S]*?\*\//g, '');
chk(/_earChanged = wdEar\.commit\(src, draft\);/.test(own) && /if\(_earChanged\) _attachHumanEars\(seat\.modelRoot, src\);/.test(own), '꾸미기를 연 채 캐릭터를 바꿔도 귀는 원래 주인에게 저장(_commitWdDraftToOwner)');
chk(/if\(wdEar\.isActive\(\)\) wdEar\.onGizmoChange\(\); else syncWdGizmoToXf\(\);/.test(A), '기즈모 objectChange — 귀 탭이면 귀 조정값으로');
const ug = grab(A, 'updateWdGizmoForActivePanel');
chk(/if\(wdEar\.isActive\(\)\)\{[^}]*wdEar\.syncGizmo\(\);/.test(ug) && /wdEar\.hideRow\(\)/.test(ug), '기즈모 바 갱신 — 귀 탭은 wd-ear 로 · 아니면 줄을 숨긴다');
chk((A.match(/if\(wdEar\.isActive\(\)\)\{ wdEar\.scaleStep\((-1|1), isBig\); return; \}/g) || []).length === 2, '크기 －/＋ — 귀 탭이면 귀 크기');
chk(/if\(wdEar\.isActive\(\)\)\{[\s\S]{0,400}wdEar\.pickAt\(_wdRay\);/.test(A), '미리보기 좌클릭 — 귀 탭이면 귀 고르기');
const rw = grab(A, 'renderWardrobe');
chk(/if\(currentWdTab === wdEar\.TAB && !wdEar\.available\(def\)\) currentWdTab = \(partsInGroup\('head'\)\[0\]/.test(rw), '동물로 바뀐 채 귀 탭이면 머리 첫 칸으로');
chk(/if\(currentWdGroup === 'head' && wdEar\.available\(def\)\)\{/.test(rw) && /ebtn\.textContent='🐾 귀';/.test(rw), '머리 › 🐾 귀 — 동물이 아닐 때만 하위 탭에');
chk(/currentWdTab !== wdEar\.TAB && currentWdTab !== WD_DESK_TAB && \(!currentWdTab \|\| !PART_CATS\.find/.test(rw), '가상 탭(귀 · 책상)이 유효성 검사에 튕기지 않는다');
chk(/else wdEar\.render\(wrap\);[\s\S]{0,300}updateWdGizmoForActivePanel\(\);\s*return;/.test(rw), '귀 탭 — 파츠 그리드 배관을 안 타고 갈라진다');
const fp = grab(A, '_charIdentityFingerprint');
chk(/earL: def\.earL\|\|null, earR: def\.earR\|\|null, earAdj: def\.earAdj\|\|null/.test(fp), '캐릭터 지문에 귀 — 친구 화면이 귀 변경으로 다시 그린다');
say('── 3-b. app.js 배선 — 귀 그리기');
chk(/if\(wdEar\.isActive\(\)\) return wdEar\.picTarget\(\);/.test(grab(A, '_wdResolvePicTarget')), '그리기 대상 — 귀 탭이면 좌·우 귀');
const en = grab(A, 'enterWdPicMode');
chk(/const ref = wdEar\.isActive\(\) \? _wdResolvePicTarget\(\) : \(_wdPicTarget \|\| _wdResolvePicTarget\(\)\);/.test(en), '귀는 들어갈 때 대상을 새로 구한다(미리보기가 다시 지어지면 옛 wrap)');
chk(/put:v=>wdEar\.setPic\(t\.side, v\)/.test(en) && /put:v=>\{ if\(v\) ref\.xf\.pic = v; else delete ref\.xf\.pic; \}/.test(en), '저장 자리 — 귀는 초안 earPic · 파츠는 xf.pic(예전 그대로)');
chk(/if\(!_wdPic\.symOk\) _wdPic\.sym = false;/.test(en), '대칭이 안 되는 귀면 대칭을 끄고 들어간다');
const ex = grab(APP, 'exitWdPicMode').replace(/\/\*[\s\S]*?\*\//g, '');
chk(/for\(const t of tgts\)\{[\s\S]*uploadPartPic\(dataUrl\)[\s\S]*t\.put\(v\);/.test(ex) && /orig && orig\[i\]/.test(ex), '완료 — 대상마다 올려 저장 · 취소 — 대상마다 원본으로');
chk(/_wdPic\.hist\.push\(_wdPicSnap\(\)\)/.test(grab(A, '_wdPicPush')) && /_wdPicRestore\(_wdPic\.hist\.pop\(\)\)/.test(grab(A, '_wdPicUndo')), '되돌리기 한 칸 = 대상 전부의 그림(대칭 획은 두 귀를 한 번에)');
const pa = grab(A, '_wdPicPaint');
chk(/const tgt=_wdPicTgtOf\(hit\.object\);/.test(pa) && /_picBlit\(tgt\.wrp\);/.test(pa), '획은 맞힌 귀에');
chk(/m=om \? humanEar\.mirrorUv\(hit, om\) : null;/.test(pa) && /mirrorUVOn\(hit, hit\.object, wdCam/.test(pa), '대칭 — 귀는 반대쪽 귀의 같은 자리 · 파츠는 예전 그대로');
chk(/if\(_wdPic\.on && _wdPic\.tgts\.some\(t=>t\.wrp === wrp\)\) return;/.test(grab(A, 'applyPartPic')), '그리는 중인 귀는 저장본으로 덮지 않는다');
chk(/if\(v && !_wdPic\.symOk\)/.test(grab(A, '_wdPicSetSym')), 'X(대칭) 키도 다른 종류 귀에서는 막힌다');
const rp = grab(A, 'refreshWdPicUI');
chk(/!wdEar\.isActive\(\)\)\{ bar\.style\.display='flex'; bar\.classList\.add\('pic-only'\);/.test(rp), '귀 탭에서는 바를 «연필만» 으로 줄이지 않는다(이동·회전이 귀 몫)');
chk(/_earRow\.classList\.toggle\('drawing', _wdPic\.on\)/.test(rp), '그리는 동안 조정할 귀 줄 잠금');
chk(/applyPartPic\(wrap, \(def && def\['earPic' \+ wrap\.userData\.humanEar\]\) \|\| null\)/.test(grab(A, '_humanEarPic')), '귀 그림 입히기 — 파츠 그림과 같은 applyPartPic');
chk(/onAttach:\(w\)=>\{\s*_humanEarPic\(w, def\);/.test(grab(A, '_attachHumanEars')), '조립(좌석 · 미리보기)할 때 귀 그림을 입힌다');
chk(/decorate:\(w\)=>_humanEarPic\(w, ensureWdDraft\(\)\)/.test(A) && /isDrawing:\(\)=>_wdPic\.on/.test(A) && /onSynced:\(\)=>\{ try\{ refreshWdPicUI\(\); \}/.test(A), 'wd-ear 에 그림 입히기 · 그리는 중 · 연필 갱신을 넘긴다');
chk(/\['earPicL','earPicR'\]\.forEach\(k=>\{ if\(typeof out\[k\]==='string' && out\[k\]\.startsWith\('data:'\)\) delete out\[k\]; \}\);/.test(grab(A, 'serializeDefForNetwork')), '방 전송 — 귀 그림 dataURL 은 뺀다(URL 만)');
chk(/earPicL: \(typeof def\.earPicL==='string' && !def\.earPicL\.startsWith\('data:'\)\) \? def\.earPicL : _imgSig\(def\.earPicL\)/.test(fp), '지문 — 귀 그림 URL 은 통째로(_imgSig 는 Storage URL 을 못 가른다)');

say('── 3-c. app.js 배선 — 머리 위 탑승 높이');
const mh = grab(A, '_measureHostHeadTop');
chk(/const _humanEarHost = !!\(hostSeat\.charDef && !hostSeat\.charDef\.animal && \(hostSeat\.charDef\.earL \|\| hostSeat\.charDef\.earR\)\);/.test(mh)
  && /if\(\(hostSeat\.charDef && hostSeat\.charDef\.animal\) \|\| _humanEarHost\)\{/.test(mh), '귀 달린 사람도 «귀 포함» 높이를 잰다(동물만 재던 것)');
chk(/if\(!\(o\.userData && \(o\.userData\.animalEar \|\| o\.userData\.humanEar\)\)\) return;/.test(mh), '귀 박스에 사람 귀(humanEar)도 합친다 — 숨은 메쉬 제외 규칙은 그대로');
chk(mh.indexOf('_bareTopY') >= 0 && mh.indexOf('_bareTopY') < mh.indexOf('_humanEarHost'), '«귀 제외» 높이(묘기 2층+)는 귀를 합치기 전에 잰다');
chk(/const _s = seats\.find\(x=>x\.modelRoot === root\); if\(_s\) _remeasureRideHeadTop\(_s\);/.test(grab(A, '_attachHumanEars')), '귀가 늦게 붙으면 이미 타고 있는 좌석의 높이를 다시 잰다');

const cam = grab(A, 'updateWdCam');
chk(/_wdEarCamOn\(\)/.test(cam) && /WD_EAR_CAM_ZOOM/.test(cam) && /WD_EAR_CAM_LIFT/.test(cam), '귀 탭 — 미리보기 구도를 올리고 물러선다(귀가 화면 밖이던 것)');
chk(/try\{ return wdEar\.isActive\(\); \}catch\(_\)\{ return false; \}/.test(grab(A, '_wdEarCamOn')), '구도 판정은 wdEar 준비 전에도 안전');

say('── 4. html · smoke');
const HTML = SRC['desk-companion-prototype.html'];
const iH = HTML.indexOf('<script src="parts/human-ear.js">'), iW = HTML.indexOf('<script src="parts/wd-ear.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
chk(iH > 0 && iW > iH && iW < iA, 'html — human-ear.js → wd-ear.js → app.js 순서');
chk(/<div id="wdEarAdjRow" style="display:none;"><\/div>/.test(HTML), '미리보기 패널에 조정할 귀 줄 자리');
chk(/const PRELOAD = \['human-ear\.js', 'wd-ear\.js'\];/.test(SRC['smoke.js']), 'smoke.js 가 두 모듈을 app.js 앞에 평가한다');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

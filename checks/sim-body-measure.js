/* ═══ 📏 sim-body-measure.js — 캐릭터 몸 박스 재기 한 규칙(character/body-measure.js) ═══════════════
   [왜] «캐릭터 몸 크기 재기» 가 상태칩 · 올라타기 · 키 정규화 · 바닥 맞춤 · 날기 벽 · 이동 여백 · 자리비움 그림에
     따로 있었고 규칙이 제각각이었다. 한 함수(measureBodyBox) + 옵션으로 묶었다.
   ・1절: 규칙 — 진짜 three(r128) Object3D 트리(리깅 파츠 · __partWrap_ · 유령 표식 · 숨은 메시 · 장식 메시)로 옵션별 입력 → 박스
   ・2절: 옛 함수와 같은가 — 묶기 전 글(origin/main 원문을 아래에 그대로 둔다)과 무작위 트리 300벌에서 박스가 같다
   ・3절: 연결 — char-measure.js 의 measureHeadBoxNoParts · measureCharBox · measureUnderfootDepth(deps measureBodyBox) · app.js _myPanHalfFrac,
           tricks.js 날기 벽 · status-chip 실측 · away-pic 이 이 함수를 부른다 · html · 만드는 줄
   ・4절: 공통 함수 강제 — body-measure.js 밖에서 setFromObject(좌석.rig · bodyWrap · gltfRoot · 좌석.group) 로 몸을 재면 빨강
   ・5절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. three 는 vendor/three/three.min.js. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('character/body-measure.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
const TRICKS = read('room/tricks.js'), CHIP = read('status/status-chip.js'), AWAY = read('room/away-pic.js'), CM = read('character/char-measure.js');
if(!MOD || !APP || !HTML || !TRICKS || !CHIP || !AWAY || !CM){ say('  ? 원본 못 찾음 — body-measure.js · app.js · html · tricks.js · status-chip.js · away-pic.js · char-measure.js'); process.exit(2); }
const threePath = ['vendor/three/three.min.js', 'app/vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE = require(path.resolve(threePath));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

function build(src){
  const win = {};
  new Function('THREE', 'window', 'module', src)(THREE, win, undefined);
  return win.TwBodyMeasure && win.TwBodyMeasure.createBodyMeasure({});
}

/* ── 가짜 캐릭터: 몸(0~1.45) · 숨은 placeholder(0~2.3) · 리깅 모자(원본 2.18~5.31) · 붙인 모자(__partWrap_) · 발밑 욕조 · 기본 모자 메시 */
function box(y0, y1, x){ const g = new THREE.BoxGeometry(2*(x||0.3), y1 - y0, 0.4); g.translate(0, (y0 + y1)/2, 0); return new THREE.Mesh(g); }
function scene(){
  const root = new THREE.Group(); root.name = 'root';
  const body = box(0, 1.45, 0.3); body.name = 'body'; root.add(body);
  const ph = box(0, 2.3, 0.42); ph.name = 'placeholder'; ph.visible = false; root.add(ph);
  const bone = new THREE.Object3D(); bone.name = 'Head'; root.add(bone);
  const rigW = new THREE.Group(); rigW.name = '__partWrap_hat'; rigW.userData.rigged = true; rigW.userData.__twPartWrap = true;
  const rigM = box(2.18, 5.31, 0.5); rigM.userData._origBind = true; rigW.add(rigM); root.add(rigW);
  const hatW = new THREE.Group(); hatW.name = '__partWrap_hat2'; hatW.userData.__twPartWrap = true;
  hatW.add(box(1.40, 1.80, 0.25)); bone.add(hatW);
  const tubW = new THREE.Group(); tubW.name = '__partWrap_tub'; tubW.userData.__twPartWrap = true;
  tubW.add(box(-0.30, 0.10, 0.6)); root.add(tubW);
  const ear = new THREE.Group(); ear.name = 'ear'; ear.userData.rigged = true; ear.add(box(1.2, 1.6, 0.1)); root.add(ear);
  const decor = box(1.45, 1.62, 0.2); decor.name = 'hatMesh'; root.add(decor);
  return { root, body, ph, rigW, hatW, tubW, ear, decor };
}
const near = (a, b) => Math.abs(a - b) < 1e-6;
const yr = (b) => b.isEmpty() ? 'empty' : b.min.y.toFixed(2) + '~' + b.max.y.toFixed(2);

function behave(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let M = null, err = null;
  try{ M = build(src); }catch(e){ err = e; }
  t(!err && M && typeof M.measureBodyBox === 'function', '만들 때 던지지 않는다 · measureBodyBox 를 내놓는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if(!M || typeof M.measureBodyBox !== 'function') return r;
  const s = scene();
  const all = M.measureBodyBox(s.root);
  const ref = new THREE.Box3().setFromObject(s.root);
  t(all.equals(ref), '옵션 없음 = three setFromObject(root) 그대로(숨은 것 · 리깅 원본 박스까지) — ' + yr(all));
  t(near(all.max.y, 5.31), '옵션 없음이면 리깅 모자의 스키닝 전 원본 박스(5.31)가 꼭대기 — 날기 벽이 일찍 걸리던 까닭');
  const body = M.measureBodyBox(s.root, { excludeParts: true, visibleOnly: true });
  t(near(body.min.y, 0) && near(body.max.y, 1.62), '파츠 · 숨은 것 빼기 = 몸 + 기본 장식(0~1.62) — ' + yr(body));
  const head = M.measureBodyBox(s.root, { excludeParts: true, visibleOnly: true, skipMeshes: new Set([s.decor]) });
  t(near(head.max.y, 1.45), '기본 장식 메시까지 빼면 맨 몸(1.45) — ' + yr(head));
  const charBox = M.measureBodyBox(s.root, { excludeParts: true });
  t(near(charBox.max.y, 2.3), '파츠만 빼기(숨은 것은 센다) = placeholder 꼭대기 2.3 — ' + yr(charBox));
  const vis = M.measureBodyBox(s.root, { visibleOnly: true });
  t(near(vis.max.y, 5.31) && near(vis.min.y, -0.30), '숨은 것만 빼기 = 파츠는 센다(리깅 원본 · 욕조) — ' + yr(vis));
  const foot = M.measureBodyBox(s.root, { excludeParts: 'rigged', visibleOnly: true });
  t(near(foot.min.y, -0.30) && near(foot.max.y, 1.80), "excludeParts:'rigged' = 리깅만 빼고 붙인 파츠(욕조 · 모자)는 센다 — " + yr(foot));
  const tw = scene(); tw.hatW.name = 'renamed'; tw.tubW.name = 'renamed2';
  const twb = M.measureBodyBox(tw.root, { excludeParts: true, visibleOnly: true });
  t(near(twb.max.y, 1.62) && near(twb.min.y, 0), '이름이 바뀌어도 __twPartWrap 표식으로 파츠를 뺀다');
  const cl = scene(); delete cl.hatW.userData.__twPartWrap; delete cl.tubW.userData.__twPartWrap;
  t(near(M.measureBodyBox(cl.root, { excludeParts: true, visibleOnly: true }).max.y, 1.62), '표식 없이 이름(__partWrap_)만 남은 복제본도 파츠로 뺀다(스티커사진 복제 — Object3D.copy 는 이름만 베낀다)');
  const ob0 = scene(); const lone = box(0, 7, 0.2); lone.userData._origBind = true; ob0.root.add(lone);
  t(near(M.measureBodyBox(ob0.root, { excludeParts: true, visibleOnly: true }).max.y, 1.62) && near(M.measureBodyBox(ob0.root, { excludeParts: 'rigged', visibleOnly: true }).max.y, 1.80), '리깅 파츠 스킨드메시(_origBind)는 wrapper 밖에 있어도 뺀다');
  const hid = scene(); hid.body.visible = false; hid.decor.visible = false;
  t(M.measureBodyBox(hid.root, { excludeParts: true, visibleOnly: true }).isEmpty(), '몸이 다 숨으면 빈 박스(부르는 쪽이 직전 값 유지 · 폴백)');
  const anc = scene(); const g = new THREE.Group(); g.visible = false; anc.root.remove(anc.body); g.add(anc.body); anc.root.add(g);
  t(near(M.measureBodyBox(anc.root, { excludeParts: true, visibleOnly: true }).max.y, 1.62)
    && near(M.measureBodyBox(anc.root, { excludeParts: true, visibleOnly: true, skipMeshes: new Set([anc.decor]) }).max.y, -Infinity) === false, '조상이 숨으면 자식도 뺀다');
  const rh = scene(); rh.root.visible = false;
  t(near(M.measureBodyBox(rh.root, { excludeParts: true, visibleOnly: true }).max.y, 1.62), 'root 자신의 visible 은 안 본다(옛 함수들과 같게 — 상태칩은 부르는 쪽이 본다)');
  t(M.measureBodyBox(null, { excludeParts: true }).isEmpty() && M.measureBodyBox(null).isEmpty(), 'root 가 없으면 빈 박스(던지지 않음)');
  const outB = new THREE.Box3(new THREE.Vector3(-9, -9, -9), new THREE.Vector3(9, 9, 9));
  const ret = M.measureBodyBox(s.root, { excludeParts: true, visibleOnly: true }, outB);
  t(ret === outB && near(outB.max.y, 1.62), 'out 을 주면 그 박스를 비우고 담아 돌려준다(이전 값이 안 섞임)');
  const ob = [];
  M.measureBodyBox(s.root, { excludeParts: true, visibleOnly: true, outBoxes: ob });
  t(ob.length === 2, 'outBoxes — 센 메시 하나하나(몸 · 장식 = 2개)');
  const mv = scene(); mv.root.position.y = 10;
  t(near(M.measureBodyBox(mv.root, { excludeParts: true, visibleOnly: true }).max.y, 11.62), '월드 좌표 — root 를 옮기면 따라간다(행렬을 다시 세운다)');
  const sf = scene(); sf.root.updateWorldMatrix(true, true); sf.root.position.y = 10;
  t(near(M.measureBodyBox(sf.root, { excludeParts: true, visibleOnly: true, selfOnly: true, updateWorld: false }).max.y, 1.62), 'selfOnly · updateWorld:false — 렌더가 세운 행렬 그대로(상태칩 옛 방식)');
  t(M.isPartNode(s.rigW) && M.isPartNode(s.hatW) && M.isPartNode(s.ear) && !M.isPartNode(s.body) && !M.isPartNode(null), 'isPartNode — 리깅 · 이름 · 표식 / 몸 · null');
  t(!M.countsAsBody(new THREE.Group(), s.root, {}) && M.countsAsBody(s.body, s.root, {}), 'countsAsBody — 메시만');
  return r;
}

/* ── 2절 기준: 묶기 전 글(origin/main 7e50b84 원문 — 바꾸지 말 것) ── */
const OLD = (function(){
  function headDecorMeshSet(meshHost){
    if(!meshHost) return new Set();
    const s = new Set();
    ['hatMesh','maskMesh','glassesMesh','wingMesh'].forEach(k=>{ if(meshHost[k]) s.add(meshHost[k]); });
    return s;
  }
  function measureHeadBoxNoParts(root, outBoxes, meshHost){
    const box=new THREE.Box3(); const tmp=new THREE.Box3();
    const decor = headDecorMeshSet(meshHost);
    root.updateWorldMatrix(true,true);
    root.traverse(o=>{
      if(!o.isMesh) return;
      if(decor.has(o)) return;
      if(o.userData && o.userData._origBind) return;
      let p=o, skip=false;
      while(p && p!==root){
        if(p.visible === false){ skip=true; break; }
        if(p.userData && p.userData.rigged){ skip=true; break; }
        if(typeof p.name==='string' && p.name.indexOf('__partWrap_')===0){ skip=true; break; }
        p=p.parent;
      }
      if(skip || o.visible === false) return;
      try{ tmp.setFromObject(o); if(!tmp.isEmpty()){ box.union(tmp); if(outBoxes) outBoxes.push(tmp.clone()); } }catch(_){}
    });
    return box;
  }
  function measureCharBox(root){
    const box=new THREE.Box3(); const tmp=new THREE.Box3();
    root.updateWorldMatrix(true,true);
    root.traverse(o=>{
      if(!o.isMesh) return;
      if(o.userData && o.userData._origBind) return;
      let p=o, skip=false;
      while(p && p!==root){
        if(p.userData && p.userData.rigged){ skip=true; break; }
        if(typeof p.name==='string' && p.name.indexOf('__partWrap_')===0){ skip=true; break; }
        if(p.userData && p.userData.__twPartWrap){ skip=true; break; }
        p=p.parent;
      }
      if(skip) return;
      try{ tmp.setFromObject(o); if(!tmp.isEmpty()) box.union(tmp); }catch(_){}
    });
    return box;
  }
  function underfootBottom(root){
    const tmp = new THREE.Box3();
    let bottom = 0;
    root.updateWorldMatrix(true,true);
    root.traverse(o=>{
      if(!o.isMesh || o.visible === false) return;
      if(o.userData && o.userData._origBind) return;
      let p=o, skip=false;
      while(p && p!==root){
        if(p.visible === false){ skip=true; break; }
        if(p.userData && p.userData.rigged){ skip=true; break; }
        p=p.parent;
      }
      if(skip) return;
      try{ tmp.setFromObject(o); if(!tmp.isEmpty() && tmp.min.y < bottom) bottom = tmp.min.y; }catch(_){}
    });
    return bottom;
  }
  function panBox(group){
    const box = new THREE.Box3(); const _tb = new THREE.Box3();
    group.traverse(o=>{
      if(!o.isMesh || o.visible === false) return;
      let p=o, hidden=false;
      while(p && p!==group){ if(p.visible===false){ hidden=true; break; } p=p.parent; }
      if(hidden) return;
      try{ _tb.setFromObject(o); if(!_tb.isEmpty()) box.union(_tb); }catch(_){}
    });
    return box;
  }
  const _chipMeshBoxTmp = new THREE.Box3();
  function _isPartSubtree(node, root){
    let p = node;
    while(p && p !== root){
      if(p.userData && p.userData.rigged) return true;
      if(typeof p.name === 'string' && p.name.indexOf('__partWrap_') === 0) return true;
      p = p.parent;
    }
    return false;
  }
  function _expandVisibleBox(node, box, root){
    if(!node || node.visible === false) return;
    if(typeof node.name === 'string' && node.name.indexOf('__partWrap_') === 0) return;
    if(node.isMesh && node.geometry && !(node.userData && node.userData._origBind)){
      if(!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      if(node.geometry.boundingBox && !_isPartSubtree(node, root)){
        _chipMeshBoxTmp.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);
        box.union(_chipMeshBoxTmp);
      }
    }
    const kids = node.children;
    for(let i=0; i<kids.length; i++) _expandVisibleBox(kids[i], box, root);
  }
  function chipBox(target){ const b = new THREE.Box3(); _expandVisibleBox(target, b, target); return b; }
  return { measureHeadBoxNoParts, measureCharBox, underfootBottom, panBox, chipBox, headDecorMeshSet };
})();

/* 무작위 트리 — 파츠 wrapper(이름 · 리깅 · 표식은 붙일 때처럼 함께) · 숨김 · 장식 메시 · 깊이 · 이동 · 배율을 섞는다 */
function rng(seed){ let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
function randTree(seed){
  const R = rng(seed), host = {};
  const root = new THREE.Group(); root.name = 'root';
  if(R() < 0.1) root.visible = false;
  const nodes = [root];
  const n = 3 + Math.floor(R() * 14);
  for(let i = 0; i < n; i++){
    const parent = nodes[Math.floor(R() * nodes.length)];
    let o;
    const k = R();
    if(k < 0.55){ const y0 = R() * 3 - 0.5; o = box(y0, y0 + 0.05 + R() * 2, 0.05 + R() * 0.6); if(R() < 0.15) o.userData._origBind = true; }
    else if(k < 0.75){ o = new THREE.Group(); o.name = '__partWrap_c' + i; o.userData.__twPartWrap = true; o.userData.rigged = R() < 0.4; }
    else if(k < 0.85){ o = new THREE.Group(); o.name = 'ear' + i; o.userData.rigged = true; }
    else { o = new THREE.Object3D(); o.name = 'bone' + i; }
    if(R() < 0.2) o.visible = false;
    o.position.set(R() - 0.5, R() - 0.5, R() - 0.5);
    if(R() < 0.3) o.scale.setScalar(0.5 + R());
    parent.add(o); nodes.push(o);
    if(o.isMesh && R() < 0.15){ const key = ['hatMesh','maskMesh','glassesMesh','wingMesh'][Math.floor(R() * 4)]; host[key] = o; }
  }
  root.position.set(R(), R(), R());
  return { root, host };
}
function sameBox(a, b){ return (a.isEmpty() && b.isEmpty()) || a.equals(b); }

function equivalence(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let M = null; try{ M = build(src); }catch(_){}
  if(!M){ t(false, '모듈을 못 만듦'); return r; }
  const N = 300, bad = { head: 0, headHost: 0, outBoxes: 0, charBox: 0, foot: 0, pan: 0, chip: 0, all: 0 };
  for(let i = 1; i <= N; i++){
    const { root, host } = randTree(i * 7919);
    const ob1 = [], ob2 = [];
    if(!sameBox(OLD.measureHeadBoxNoParts(root), M.measureBodyBox(root, { excludeParts: true, visibleOnly: true, skipMeshes: OLD.headDecorMeshSet(null) }))) bad.head++;
    if(!sameBox(OLD.measureHeadBoxNoParts(root, ob1, host), M.measureBodyBox(root, { excludeParts: true, visibleOnly: true, skipMeshes: OLD.headDecorMeshSet(host), outBoxes: ob2 }))) bad.headHost++;
    if(ob1.length !== ob2.length || ob1.some((b, j) => !b.equals(ob2[j]))) bad.outBoxes++;
    if(!sameBox(OLD.measureCharBox(root), M.measureBodyBox(root, { excludeParts: true }))) bad.charBox++;
    const fb = M.measureBodyBox(root, { excludeParts: 'rigged', visibleOnly: true });
    const nb = (!fb.isEmpty() && fb.min.y < 0) ? fb.min.y : 0;
    if(OLD.underfootBottom(root) !== nb) bad.foot++;
    root.updateWorldMatrix(true, true);
    if(!sameBox(OLD.panBox(root), M.measureBodyBox(root, { visibleOnly: true, updateWorld: false }))) bad.pan++;
    const chipNew = new THREE.Box3(); if(root.visible !== false) M.measureBodyBox(root, { excludeParts: true, visibleOnly: true, selfOnly: true, updateWorld: false }, chipNew);
    if(!sameBox(OLD.chipBox(root), chipNew)) bad.chip++;
    if(!sameBox(new THREE.Box3().setFromObject(root), M.measureBodyBox(root))) bad.all++;
  }
  t(!bad.head && !bad.headHost && !bad.outBoxes, '올라타기 measureHeadBoxNoParts — 옛 글과 ' + N + '벌 모두 같다(장식 메시 · outBoxes 포함)' + (bad.head + bad.headHost + bad.outBoxes ? ' — 다름 ' + JSON.stringify(bad) : ''));
  t(!bad.charBox, '키 정규화 measureCharBox — 옛 글과 ' + N + '벌 모두 같다' + (bad.charBox ? ' — 다름 ' + bad.charBox : ''));
  t(!bad.foot, '바닥 맞춤 measureUnderfootDepth 의 바닥 — 옛 글과 ' + N + '벌 모두 같다' + (bad.foot ? ' — 다름 ' + bad.foot : ''));
  t(!bad.pan, '이동 여백 _myPanHalfFrac 의 박스 — 옛 글과 ' + N + '벌 모두 같다' + (bad.pan ? ' — 다름 ' + bad.pan : ''));
  t(!bad.chip, '상태칩 실측 _expandVisibleBox — 옛 글과 ' + N + '벌 모두 같다(root 숨김 포함)' + (bad.chip ? ' — 다름 ' + bad.chip : ''));
  t(!bad.all, '날기 벽 · 자리비움 그림(옵션 없음) — setFromObject 와 ' + N + '벌 모두 같다' + (bad.all ? ' — 다름 ' + bad.all : ''));
  return r;
}

/* ── 3 · 4절: 연결 · 공통 함수 강제 ── */
const BODY_SFO = /\.setFromObject\(\s*(?:[\w$]+\.)*(?:rig|bodyWrap|gltfRoot)\b|\.setFromObject\(\s*(?:seat|me|host|_host|hostSeat|s)\.group\s*\)/;
function listParts(){
  const roots = ['parts', 'app/parts'].filter(d => fs.existsSync(d) && fs.statSync(d).isDirectory());
  const out = {};
  const walk = (d) => { for(const f of fs.readdirSync(d)){ const p = path.join(d, f); const st = fs.statSync(p); if(st.isDirectory()){ if(f !== 'vendor') walk(p); } else if(/\.js$/.test(f)) out[path.relative(roots[0], p)] = fs.readFileSync(p, 'utf8'); } };
  if(roots.length) walk(roots[0]);
  else { for(const f of fs.readdirSync('.')) if(/\.js$/.test(f) && !/^sim-|^smoke|^run\.js$/.test(f)) out[f] = fs.readFileSync(f, 'utf8'); }
  return out;
}
function wiring(app, html, tricks, chip, away, files, cm){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app);
  t(/const bodyMeasureMod = TwBodyMeasure\.createBodyMeasure\(\{\n\}\);/.test(app), 'app.js 가 만든다(빈 deps)');
  t(A.indexOf('const bodyMeasureMod') >= 0 && A.indexOf('const bodyMeasureMod') < A.indexOf('function _myPanHalfFrac('), '만드는 줄이 맨 앞(쓰는 함수들보다 먼저 — 부팅 중에 불려도 TDZ 없음)');
  const iM = html.indexOf('<script src="parts/character/body-measure.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — body-measure.js 를 app.js 보다 먼저 싣는다');
  const fnBody = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; const j = src.indexOf('\n}\n', i); return src.slice(i, j < 0 ? undefined : j); };
  /* 맨 몸 · 맨 머리 · 발밑 깊이는 character/char-measure.js(#277)에 있다 — deps 로 measureBodyBox 를 받아 옵션만 고른다 */
  const C = strip(cm);
  t(/const measureBodyBox = deps\.measureBodyBox;/.test(cm), 'char-measure.js 가 deps 로 measureBodyBox 를 받는다');
  t(/(?:^|[^.\w])measureBodyBox\(root, \{ excludeParts: true, visibleOnly: true, skipMeshes: headDecorMeshSet\(meshHost\)/.test(fnBody(C, 'measureHeadBoxNoParts')), 'measureHeadBoxNoParts → 파츠 · 숨김 · 장식 빼기');
  t(/(?:^|[^.\w])measureBodyBox\(root, \{ excludeParts: true \}\)/.test(fnBody(C, 'measureCharBox')) && !/\.traverse\(/.test(fnBody(C, 'measureCharBox')), 'measureCharBox → 파츠만 빼기');
  t(/(?:^|[^.\w])measureBodyBox\(root, \{ excludeParts: 'rigged', visibleOnly: true \}\)/.test(fnBody(C, 'measureUnderfootDepth')), "measureUnderfootDepth → 리깅만 빼기 · 숨김 빼기");
  const pan = fnBody(A, '_myPanHalfFrac');
  t(/bodyMeasureMod\.measureBodyBox\(me\.group, \{[^}]*visibleOnly: true[^}]*\}\)/.test(pan) && !/\.traverse\(/.test(pan), '_myPanHalfFrac → measureBodyBox(손으로 도는 traverse 없음)');
  const glue = (name) => { const m = app.match(new RegExp('const ' + name + ' = [\\s\\S]*?\\n\\}\\);')); return m ? m[0] : ''; };
  const T = strip(tricks), probe = fnBody(T, '_flyProbeY');
  t(/const measureBodyBox = deps\.measureBodyBox;/.test(tricks) && /measureBodyBox\(seat\.rig, [^)]*_flyBox\)/.test(probe), 'tricks.js 날기 벽 _flyProbeY → measureBodyBox');
  t(/const measureCharBox = deps\.measureCharBox;/.test(tricks) && /measureCharBox\(seat\.gltfRoot\)/.test(probe) && /measureCharBox: \(\.\.\.a\)=>charMeasureMod\.measureCharBox\(\.\.\.a\),/.test(glue('tricksMod')), 'tricks.js 날기 벽의 몸 경로(#258 measureCharBox(gltfRoot))도 char-measure.js 를 거쳐 measureBodyBox 한 곳으로');
  t(/const measureBodyBox = deps\.measureBodyBox;/.test(chip) && /measureBodyBox\(target, CHIP_BODY_OPTS, box\)/.test(strip(chip)) && !/function _expandVisibleBox/.test(chip), 'status-chip 실측 → measureBodyBox(옛 _expandVisibleBox 없음)');
  t(/const measureBodyBox = deps\.measureBodyBox;/.test(away) && (strip(away).match(/measureBodyBox\(/g) || []).length >= 2, 'away-pic 자리비움 그림 → measureBodyBox');
  t(['tricksMod', 'statusChipMod', 'awayPicMod', 'charMeasureMod'].every(n => glue(n).includes('  measureBodyBox: (...a)=>bodyMeasureMod.measureBodyBox(...a),')), 'deps — tricks · status-chip · away-pic · char-measure 에 measureBodyBox 를 넘긴다');
  const offenders = Object.keys(files).filter(f => !/body-measure\.js$/.test(f) && BODY_SFO.test(strip(files[f])));
  t(Object.keys(files).length > 5 && !offenders.length, '공통 함수 강제 — body-measure.js 밖에서 setFromObject(좌석.rig · bodyWrap · gltfRoot · 좌석.group) 로 몸을 재지 않는다' + (offenders.length ? ' — ' + offenders.join(' · ') : ''));
  return r;
}

say('── 1. 규칙(진짜 three r128 트리)');
behave(MOD).forEach(([ok, msg]) => chk(ok, msg));
say('── 2. 옛 함수와 같은가(동작 무변경)');
equivalence(MOD).forEach(([ok, msg]) => chk(ok, msg));
say('── 3 · 4. 연결 · 공통 함수 강제');
const FILES = listParts();
wiring(APP, HTML, TRICKS, CHIP, AWAY, FILES, CM).forEach(([ok, msg]) => chk(ok, msg));

say('── 5. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const allOk = (rows) => rows.every(([ok]) => ok);
const breaks = [
  ['파츠 이름 판정 빠짐', () => !allOk(behave(MOD.replace("return typeof p.name === 'string' && p.name.indexOf(PART_WRAP_PREFIX) === 0;", 'return false;')).concat(equivalence(MOD.replace("return typeof p.name === 'string' && p.name.indexOf(PART_WRAP_PREFIX) === 0;", 'return false;'))))],
  ['숨은 조상 안 봄', () => !allOk(equivalence(MOD.replace('if(op.visibleOnly && p.visible === false) return false;', '')))],
  ['리깅 스킨드메시(_origBind) 안 뺌', () => !allOk(behave(MOD.replace('if(op.excludeParts && o.userData && o.userData._origBind) return false;', '')))],
  ["'rigged' 가 붙인 파츠까지 뺌", () => !allOk(behave(MOD.replace("if(op.excludeParts === 'rigged' && p.userData && p.userData.rigged) return false;", "if(op.excludeParts === 'rigged' && isPartNode(p)) return false;")))],
  ['장식 메시 안 뺌', () => !allOk(behave(MOD.replace('if(op.skipMeshes && op.skipMeshes.has(o)) return false;', '')))],
  ['out 을 안 비움', () => !allOk(behave(MOD.replace('  box.makeEmpty();\n', '\n')))],
  ['다른 파일이 setFromObject(seat.rig) 로 몸을 잼', () => !allOk(wiring(APP, HTML, TRICKS.replace('measureBodyBox(seat.rig, ', '_flyBox.setFromObject(seat.rig); measureBodyBox(seat.rig, '), CHIP, AWAY, Object.assign({}, FILES, { 'room/x.js': 'b.setFromObject(_host.bodyWrap || _host.rig);' }), CM))],
  ['measureCharBox 가 다시 손으로 잼', () => !allOk(wiring(APP, HTML, TRICKS, CHIP, AWAY, FILES, CM.replace('return measureBodyBox(root, { excludeParts: true });', 'const b=new THREE.Box3(); root.traverse(o=>{}); return b;')))],
  ['char-measure.js 에 measureBodyBox 를 안 넘김', () => !allOk(wiring(APP.replace('const charMeasureMod = TwCharMeasure.createCharMeasure({\n  measureBodyBox: (...a)=>bodyMeasureMod.measureBodyBox(...a),\n', 'const charMeasureMod = TwCharMeasure.createCharMeasure({\n'), HTML, TRICKS, CHIP, AWAY, FILES, CM))],
  ['html 줄 빠짐', () => !allOk(wiring(APP, HTML.replace('<script src="parts/character/body-measure.js"></script>', ''), TRICKS, CHIP, AWAY, FILES, CM))],
];
for(const [name, f] of breaks){ let caught = false; try{ caught = f(); }catch(_){ caught = true; } chk(caught, name); }

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

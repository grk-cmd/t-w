/* ═══ 📏 sim-pk-fit.js — 스티커사진 무대 키 맞춤 · 파츠는 재지 않는다 (제보 5 · 2026-09-16) ══════
   [무엇을 지키나] 무대는 `_pkVisibleBox` 로 키를 재서 CHAR_H 에 맞춘다. 그 상자에 뿔·모자·큰 머리카락
     (꾸미기 파츠)이 들어가면 상자가 커지고 → 더 줄이고 → **파츠를 쓰면 캐릭터가 작아진다**(제보).
     실행 화면의 measureCharBox 는 파츠 래퍼 하위를 빼는데 이 무대만 안 따르고 있었다.
   ・1절: 소스 — 키(분모)와 좌우 중심은 noParts=true 상자, 발밑은 전체 상자. 표식은 **이름**(복제본엔 userData 가 없다).
   ・2절: `_pkVisibleBox` 와 `_pkCloneChar` 의 맞춤 블록을 떼어 와 **가짜 THREE** 위에서 실제로 돌린다 —
          파츠 있/없 캐릭터의 배율이 같은가, 모자는 그려지는가(측정에서만 빠진다), 발 아래 파츠는 바닥에 닿는가,
          상한, 옆으로 뻗은 파츠가 중심을 안 미는가, 숨은 placeholder 제외, 파츠 밑 스킨드메시 제외, 보이는 것이 없으면 옛 방식, 동물 배율.
   [실행] app.js 가 있는 폴더에서. `purikura-net.js` 가 있으면 CHAR_H·ANIMAL_H 를 거기서 읽고, 없으면 1.7·1.15 로 둔다
     (값만 다르고 규칙은 같다 — 판정은 전부 «비율»로 본다).
   ⚠️ 가짜 THREE 는 **균일 배율 + 평행이동**만 안다. 회전은 이 블록이 0 으로 지우므로(g.rotation.set) 충분하다.
   판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');

let pass = 0, fail = 0, huhs = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const huh = (msg) => { huhs++; say('  ? ' + msg); };
function grabFn(src, name, kw){
  const i = src.indexOf((kw || 'function ') + name + '(');
  if(i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  return null;
}
let CHAR_H = 1.7, ANIMAL_H = 1.15, fromNet = false;
try{
  const net = fs.readFileSync('purikura-net.js', 'utf8');
  const a = net.match(/CHAR_H\s*:\s*([\d.]+)/), b = net.match(/ANIMAL_H\s*:\s*([\d.]+)/);
  if(a){ CHAR_H = parseFloat(a[1]); fromNet = true; }
  if(b) ANIMAL_H = parseFloat(b[1]);
}catch(_){}
say('  · CHAR_H=' + CHAR_H + ' · ANIMAL_H=' + ANIMAL_H + (fromNet ? ' (purikura-net.js)' : ' (기본값 — purikura-net.js 없음)'));

/* ── 1. 소스 ── */
say('── 1. 소스 — 분모는 몸만 · 발밑은 전체 · 표식은 이름');
const fBox = grabFn(SRC, '_pkVisibleBox') || '';
const fClone = grabFn(SRC, '_pkCloneChar') || '';
chk(/function _pkVisibleBox\(g, noParts\)/.test(fBox), '★ _pkVisibleBox 가 noParts 인자를 받는다');
chk(/p\.name\.indexOf\('__partWrap_'\) === 0/.test(fBox), '  파츠 표식은 **이름**(`__partWrap_`)으로 — 복제본에는 userData(__twPartWrap)가 없다');
chk(!/__twPartWrap|userData\.rigged/.test(fBox), '  userData 표식에 기대지 않는다');
chk(/underPart && \(noParts \|\| o\.isSkinnedMesh\)/.test(fBox), '  파츠 밑 스킨드메시는 noParts 와 무관하게 늘 뺀다 (스키닝 전 원시 상자가 발 아래로 뻗는다)');
chk(/p\.visible === false\) return/.test(fBox), '  조상이 하나라도 숨겨져 있으면 뺀다 (placeholder)');
const iR = fClone.indexOf('g.rotation.set(0,0,0)');
const iH = fClone.indexOf('const bb = _pkVisibleBox(g, true)'), iC = fClone.indexOf('const bb2 = _pkVisibleBox(g, true)'), iF = fClone.indexOf('const bbAll = _pkVisibleBox(g, false)');
chk(iH > 0 && /bb\.max\.y - bb\.min\.y/.test(fClone), '★ 키(분모)는 noParts=true 상자 — 파츠가 커도 캐릭터가 안 줄어든다');
chk(/CHAR_H \* grow \/ h/.test(fClone), '  CHAR_H 계산식은 그대로 (sim-purikura-deco 가 보는 줄)');
chk(iC > iH && /g\.position\.x -= \(bb2\.min\.x \+ bb2\.max\.x\) \/ 2;/.test(fClone), '  좌우 중심도 noParts=true 상자 — 옆으로 뻗은 파츠에 밀리지 않는다');
chk(iF > iC && /Math\.min\(bb2\.min\.y, bbAll\.min\.y\)/.test(fClone), '  발밑은 «보이는 것 중 가장 아래»(전체 상자) — 욕조가 바닥에 닿는다 (FLOOR_SNAP 과 같은 뜻)');
chk(/Math\.max\(bb2\.min\.y - _pkP\(\)\.CHAR_H,/.test(fClone), '  상한 — 저작이 어긋난 파츠 하나로 캐릭터가 하늘로 뜨지 않는다');
chk(/g\.position\.y -= lowest;/.test(fClone) && !/g\.position\.y -= bb2\.min\.y;/.test(fClone), '  옛 줄(bb2.min.y 그대로)이 남아 있지 않다');
chk(iR > 0 && iR < iH, '  재기 전에 몸통 회전을 지운다 (누운 채로 재면 키가 틀린다)');

/* ── 2. 가짜 THREE 위에서 실행 ── */
say('── 2. 실행 — 파츠 있/없 배율 같음 · 모자는 그려짐 · 발밑 · 상한 · 중심 · placeholder · 스킨드메시 · 동물');
const fitSrc = (()=>{
  const a = fClone.indexOf('  g.rotation.set(0,0,0);');
  const b = fClone.indexOf('  return g;', a);
  return (a > 0 && b > a) ? fClone.slice(a, b) : null;
})();
if(!fBox || !fitSrc){ huh('본문을 못 떼어 옴 — box:' + !!fBox + ' fit:' + !!fitSrc); }
else{
  /* 가짜 THREE — Box3 · 균일 배율/평행이동 행렬 · 장면 그래프 */
  class V3{ constructor(x=0,y=0,z=0){ this.x=x; this.y=y; this.z=z; } set(x,y,z){ this.x=x; this.y=y; this.z=z; return this; } multiplyScalar(s){ this.x*=s; this.y*=s; this.z*=s; return this; } }
  class M4{ constructor(s=1,t=new V3()){ this.s=s; this.t=t; } }   // 균일 배율 s · 평행이동 t
  class Box3{
    constructor(){ this.min = new V3(Infinity, Infinity, Infinity); this.max = new V3(-Infinity, -Infinity, -Infinity); }
    isEmpty(){ return this.max.x < this.min.x; }
    copy(b){ this.min = new V3(b.min.x,b.min.y,b.min.z); this.max = new V3(b.max.x,b.max.y,b.max.z); return this; }
    applyMatrix4(m){
      const f = v => new V3(v.x*m.s + m.t.x, v.y*m.s + m.t.y, v.z*m.s + m.t.z);
      const a = f(this.min), b = f(this.max);
      this.min = new V3(Math.min(a.x,b.x), Math.min(a.y,b.y), Math.min(a.z,b.z));
      this.max = new V3(Math.max(a.x,b.x), Math.max(a.y,b.y), Math.max(a.z,b.z));
      return this;
    }
    union(b){ this.min = new V3(Math.min(this.min.x,b.min.x), Math.min(this.min.y,b.min.y), Math.min(this.min.z,b.min.z));
              this.max = new V3(Math.max(this.max.x,b.max.x), Math.max(this.max.y,b.max.y), Math.max(this.max.z,b.max.z)); return this; }
    /* r128 의 setFromObject — visible 을 **안 본다**(그게 placeholder 사고의 원인이었다) */
    setFromObject(g){ g.updateWorldMatrix(true, true); const tmp = new Box3(); g.traverse(o=>{ if(!o.isMesh) return; tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); this.union(tmp); }); return this; }
  }
  class Obj{
    constructor(name){ this.name = name || ''; this.children = []; this.parent = null; this.visible = true; this.position = new V3(); this.scale = new V3(1,1,1); this.rotation = { set(){} }; this.matrixWorld = new M4(); this.isMesh = false; }
    add(c){ c.parent = this; this.children.push(c); return c; }
    traverse(fn){ fn(this); this.children.forEach(c => c.traverse(fn)); }
    updateWorldMatrix(){
      const ps = this.parent ? this.parent.matrixWorld : new M4();
      this.matrixWorld = new M4(ps.s * this.scale.x, new V3(ps.t.x + this.position.x*ps.s, ps.t.y + this.position.y*ps.s, ps.t.z + this.position.z*ps.s));
      this.children.forEach(c => c.updateWorldMatrix());
    }
  }
  const mesh = (name, min, max, opt) => { const m = new Obj(name); m.isMesh = true; m.geometry = { boundingBox: { min: new V3(...min), max: new V3(...max) } }; Object.assign(m, opt || {}); return m; };
  const THREE = { Box3 };
  const run = new Function('THREE', '_pkP', fBox + '\nreturn { box:_pkVisibleBox, fit:(g, seat)=>{ ' + fitSrc + ' return g; } };')(THREE, () => ({ CHAR_H, ANIMAL_H }));

  /* 몸: 키 1.0 · 폭 0.4 — 피봇이 발바닥 */
  const body = () => { const g = new Obj('bodyWrap'); g.add(mesh('body', [-0.2,0,-0.2], [0.2,1.0,0.2])); return g; };
  const hOf = (o) => { const b = new Box3(); o.updateWorldMatrix(true,true); const tmp = new Box3(); o.traverse(m => { if(m.isMesh){ tmp.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); b.union(tmp); } }); return b; };
  const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);

  /* ① 파츠 없는 캐릭터 — 기준 */
  let g = body(); run.fit(g, {});
  const b0 = hOf(g);
  chk(near(b0.max.y - b0.min.y, CHAR_H) && near(b0.min.y, 0) && near((b0.min.x + b0.max.x)/2, 0), '① 파츠 없음: 키 ' + CHAR_H + ' · 발바닥 y=0 · 좌우 중심 0');
  const s0 = g.scale.x;

  /* ② 머리 위로 0.6 솟은 뿔 — 키의 분모에 들어가면 안 된다 */
  g = body(); { const w = g.add(new Obj('__partWrap_horn')); w.add(mesh('horn', [-0.05,0.9,-0.05], [0.05,1.6,0.05])); }
  run.fit(g, {});
  chk(near(g.scale.x, s0), '★ ② 뿔(머리 위 +0.6): 배율이 파츠 없을 때와 **같다** (' + g.scale.x.toFixed(4) + ' vs ' + s0.toFixed(4) + ') — 예전엔 1.0/1.6 배로 작아졌다');
  const bBody = run.box(g, true), bAll = run.box(g, false);
  chk(near(bBody.max.y - bBody.min.y, CHAR_H) && bAll.max.y > bBody.max.y + 0.5, '  몸은 ' + CHAR_H + ' · 뿔은 그 위에 **그대로 그려진다** (측정에서만 빠진다)');
  chk(near(g.position.y, 0, 1e-9), '  뿔은 발밑과 무관 — 위치 보정 0');

  /* ③ 욕조 — 발 아래 0.3 */
  g = body(); { const w = g.add(new Obj('__partWrap_tub')); w.add(mesh('tub', [-0.5,-0.3,-0.5], [0.5,0.2,0.5])); }
  run.fit(g, {});
  const bT = hOf(g);
  chk(near(g.scale.x, s0), '③ 욕조(발 아래 −0.3): 배율은 그대로');
  chk(near(bT.min.y, 0), '  욕조 바닥이 y=0 에 닿는다 (보이는 것 중 가장 아래)');
  chk(near(g.position.y, 0.3 * s0), '  들어 올린 양 = 0.3 × 배율');

  /* ④ 상한 — 저작이 어긋난 파츠(발 아래 −5) */
  g = body(); { const w = g.add(new Obj('__partWrap_bad')); w.add(mesh('bad', [-0.1,-5,-0.1], [0.1,0.1,0.1])); }
  run.fit(g, {});
  chk(near(g.position.y, CHAR_H), '④ 발 아래 −5 파츠: 들어 올림이 CHAR_H 에서 멈춘다 (하늘로 안 뜬다)');

  /* ⑤ 옆으로 뻗은 파츠 — 좌우 중심은 몸 */
  g = body(); { const w = g.add(new Obj('__partWrap_wing')); w.add(mesh('wing', [0.2,0.4,-0.05], [3.0,0.8,0.05])); }
  run.fit(g, {});
  const bB = run.box(g, true);
  chk(near((bB.min.x + bB.max.x)/2, 0) && near(g.scale.x, s0), '⑤ 오른쪽으로 3 뻗은 날개: 몸의 좌우 중심이 0 · 배율 그대로 (파츠에 안 밀린다)');

  /* ⑥ 숨은 placeholder — root 만 꺼져 있고 자식은 visible=true */
  g = body(); { const ph = g.add(new Obj('placeholder')); ph.visible = false; ph.add(mesh('phBody', [-0.42,0,-0.42], [0.42,2.5,0.42])); }
  run.fit(g, {});
  chk(near(g.scale.x, s0), '⑥ 숨은 placeholder(키 2.5): 배율에 안 들어간다 (제보 «크기 제각각» 수정 유지)');

  /* ⑦ 파츠 밑 스킨드메시 — noParts=false 여도 뺀다 · 몸 자체의 스킨드메시는 잰다 */
  g = body(); { const w = g.add(new Obj('__partWrap_tail')); w.add(mesh('tail', [-0.1,-4,-0.1], [0.1,0.1,0.1], { isSkinnedMesh: true })); }
  let bb = run.box(g, false);
  chk(near(bb.min.y, 0), '⑦ 파츠 밑 스킨드메시(원시 상자 −4): 전체 상자에서도 빠진다');
  run.fit(g, {});
  chk(near(g.position.y, 0, 1e-9), '  그래서 꼬리 파츠로 캐릭터가 떠오르지 않는다');
  g = new Obj('bodyWrap'); g.add(mesh('skinBody', [-0.3,0,-0.3], [0.3,1.2,0.3], { isSkinnedMesh: true }));
  bb = run.box(g, true);
  chk(near(bb.max.y - bb.min.y, 1.2), '  몸 자체의 스킨드메시(커미션 모델)는 그대로 잰다');

  /* ⑧ 보이는 것이 없으면 옛 방식(setFromObject) */
  g = new Obj('bodyWrap'); { const ph = g.add(new Obj('placeholder')); ph.visible = false; ph.add(mesh('phBody', [-0.4,0,-0.4], [0.4,2.0,0.4])); }
  bb = run.box(g, true);
  chk(near(bb.max.y - bb.min.y, 2.0), '⑧ 보이는 메시가 하나도 없으면 setFromObject 로 돌아간다 (0 으로 나누지 않는다)');

  /* ⑨ 동물 — ANIMAL_H 배 · 파츠 규칙과 독립 */
  g = body(); { const w = g.add(new Obj('__partWrap_horn')); w.add(mesh('horn', [-0.05,0.9,-0.05], [0.05,1.6,0.05])); }
  run.fit(g, { charDef: { animal: true } });
  chk(near(g.scale.x, s0 * ANIMAL_H), '⑨ 동물 + 뿔: 배율 = 맨몸 × ANIMAL_H(' + ANIMAL_H + ') — 뿔은 여기서도 안 센다');
}

say('');
say('sim-pk-fit.js: ' + pass + ' 통과 · ' + fail + ' 실패' + (huhs ? ' · ' + huhs + ' 의문' : ''));
process.exitCode = fail ? 1 : 0;

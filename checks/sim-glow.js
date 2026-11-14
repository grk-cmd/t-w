/* ═══ ✨ sim-glow.js — 빛나는 스프라이트 · 재질 발광(character/glow.js · app.js 분리 M1) ═══════════════
   [왜] app.js SETUP 의 발광 조각을 모듈로 옮겼다. 동작은 그대로여야 한다.
   ・1절: addGlowSprite — 진짜 three(r128) 오브젝트에 스프라이트가 붙는다(크기 = 최대 변 × 배율 · 가운데 · 렌더 순서 · 가산 합성) · 텍스처는 한 번만 만든다
   ・2절: applyGlowToMesh · applyGlowEffect — 재질 emissive 를 밝힌다(emissive 가 없거나 0 이면 색에서 · map 을 emissiveMap 으로) · 메시가 아니면 그대로
   ・3절: 실패 길 — 박스를 못 재면(던지면) null · 오브젝트를 건드리지 않는다
   ・4절: 연결 — html 이 app.js 보다 먼저 싣는다 · app.js 가 만든다 · app.js 에 발광 함수가 없다
   ・5절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. three 는 vendor/three/three.min.js. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('character/glow.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — glow.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const threePath = ['vendor/three/three.min.js', 'app/vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE0 = require(path.resolve(threePath));

/* CanvasTexture 는 진짜 캔버스가 필요하다 — 가짜 캔버스(그라디언트 기록)와 가짜 CanvasTexture 로 갈아 끼운다 */
function build(src){
  const log = { canvases: 0, textures: 0 };
  const document = { createElement: (t) => { log.canvases++; return { width: 0, height: 0, getContext: () => ({ createRadialGradient: () => ({ addColorStop(){} }), fillRect(){}, set fillStyle(v){} }) }; } };
  class FakeTex { constructor(c){ log.textures++; this.image = c; } }
  const THREE = Object.assign({}, THREE0, { CanvasTexture: FakeTex });
  const win = {};
  new Function('THREE', 'document', 'window', src)(THREE, document, win);
  return { glow: win.TwGlow.createGlow({}), log, THREE };
}
const boxObj = (T, w, h, d, at) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color: 0x336699 })); const g = new T.Group(); g.add(m); if(at) g.position.set(...at); return { g, m }; };

say('§1 addGlowSprite');
{
  const { glow, log, THREE } = build(SRC);
  const { g, m } = boxObj(THREE, 1, 2, 0.5);
  const sp = glow.addGlowSprite(g);
  chk(sp instanceof THREE.Sprite && g.children.includes(sp), '스프라이트를 오브젝트에 붙이고 돌려준다');
  chk(Math.abs(sp.scale.x - 2 * glow.GLOW_SIZE_MUL) < 1e-9, '크기 = 가장 긴 변(2) × 배율(' + glow.GLOW_SIZE_MUL + ')');
  chk(sp.renderOrder === 900 && sp.material.blending === THREE.AdditiveBlending && sp.material.depthWrite === false && sp.material.transparent === true, '렌더 순서 900 · 가산 합성 · 깊이 안 씀 · 투명');
  chk(sp.material.color.getHex() === glow.GLOW_COLOR, '빛 색 ' + glow.GLOW_COLOR.toString(16) + '(따뜻한 노란빛)');
  chk(sp.position.length() < 1e-9, '중심에 놓인다(박스가 원점이면 (0,0,0))');
  const o2 = boxObj(THREE, 1, 1, 1, [3, 0, 0]);
  const sp2 = glow.addGlowSprite(o2.g);
  chk(Math.abs(sp2.position.x) < 1e-9, '오브젝트가 옮겨져 있어도 스프라이트는 그 오브젝트 안쪽 좌표의 중심');
  chk(log.canvases === 1 && log.textures === 1 && sp.material.map === sp2.material.map, '텍스처는 한 번만 만든다(두 번째부터 재사용)');
  const tiny = boxObj(THREE, 0.001, 0.001, 0.001);
  const sp3 = glow.addGlowSprite(tiny.g);
  chk(Math.abs(sp3.scale.x - 0.05 * glow.GLOW_SIZE_MUL) < 1e-9, '아주 작은 오브젝트는 최소 0.05 기준(경계값)');
}
say('§2 재질 발광');
{
  const { glow, THREE } = build(SRC);
  const { g, m } = boxObj(THREE, 1, 1, 1);
  m.material.emissive.setHex(0);
  glow.applyGlowToMesh(m);
  chk(m.material.emissive.getHex() === m.material.color.getHex() && m.material.emissiveIntensity === glow.GLOW_EMISSIVE_BOOST, 'emissive 가 0 이면 재질 색을 복사하고 세기를 ' + glow.GLOW_EMISSIVE_BOOST + ' 로');
  const m2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x112233 }));
  glow.applyGlowToMesh(m2);
  chk(m2.material.emissive.getHex() === 0x112233, '이미 emissive 가 있으면 그 색을 지킨다');
  const tex = {}; const m3 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff })); m3.material.map = tex;
  glow.applyGlowToMesh(m3);
  chk(m3.material.emissiveMap === tex, '텍스처(map)가 있으면 emissiveMap 으로도 쓴다');
  const grp = new THREE.Group(); const before = grp.children.length;
  glow.applyGlowToMesh(grp); glow.applyGlowToMesh({ isMesh: true });
  chk(grp.children.length === before, '메시가 아니거나 재질이 없으면 아무것도 안 한다');
  const t = boxObj(THREE, 1, 1, 1);
  const sp = glow.applyGlowEffect(t.g);
  chk(sp instanceof THREE.Sprite && t.m.material.emissiveIntensity === glow.GLOW_EMISSIVE_BOOST, 'applyGlowEffect — 모든 메시를 밝히고 스프라이트를 돌려준다');
}
say('§3 실패 길');
{
  const { glow } = build(SRC);
  chk(glow.addGlowSprite(null) === null && glow.addGlowSprite({}) === null, '오브젝트가 아니면(던지면) null — 조용히 지나간다');
}
say('§4 연결');
{
  const iG = HTML.indexOf('<script src="parts/character/glow.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iG > 0 && iA > iG, 'html — glow.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const glowMod = TwGlow\.createGlow\(\{\s*\}\);/.test(code), 'app.js — 원래 자리(SETUP)에서 만든다');
  chk(!/function (addGlowSprite|applyGlowToMesh|applyGlowEffect|getGlowSpriteTexture)\b|GLOW_SIZE_MUL\s*=/.test(code), '  app.js 에 발광 함수 · 상수가 남아 있지 않다');
}
say('§5 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk('sp.renderOrder=900;', 'sp.renderOrder=0;');
  chk(!!m1 && (() => { const b = build(m1); const o = boxObj(b.THREE, 1, 1, 1); return b.glow.addGlowSprite(o.g).renderOrder !== 900; })(), '렌더 순서를 바꾸면 빨강');
  const m2 = brk('const maxDim=Math.max(size.x,size.y,size.z,0.05);', 'const maxDim=Math.max(size.x,size.y,size.z);');
  chk(!!m2 && (() => { const b = build(m2); const o = boxObj(b.THREE, 0.001, 0.001, 0.001); return Math.abs(b.glow.addGlowSprite(o.g).scale.x - 0.05 * b.glow.GLOW_SIZE_MUL) > 1e-9; })(), '최소 크기 0.05 를 빼면 빨강');
  const m3 = brk('if(m.map && !m.emissiveMap) m.emissiveMap=m.map;', '');
  chk(!!m3 && (() => { const b = build(m3); const mm = new b.THREE.Mesh(new b.THREE.BoxGeometry(1, 1, 1), new b.THREE.MeshStandardMaterial({ color: 0xffffff })); mm.material.map = {}; b.glow.applyGlowToMesh(mm); return mm.material.emissiveMap == null; })(), 'emissiveMap 연결을 빼면 빨강');
  const m4 = brk('if(_glowSpriteTex) return _glowSpriteTex;', '');
  chk(!!m4 && (() => { const b = build(m4); const o = boxObj(b.THREE, 1, 1, 1); b.glow.addGlowSprite(o.g); b.glow.addGlowSprite(o.g); return b.log.textures === 2; })(), '텍스처 재사용을 빼면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);

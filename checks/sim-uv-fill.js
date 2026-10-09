/* ═══ 🪣 sim-uv-fill.js — 꾸미기 그리기 «채우기»: 누른 메쉬의 UV 자리만 칠한다 (2026-10-08 신설) ═══════════
   ・1절: uv-fill.js 를 실제 귀 GLB 와 손으로 만든 geometry 로 — 삼각형 좌표(uv × 크기) · 인덱스 유무 · UV 없음
   ・2절: fillMesh 를 가짜 2D 문맥으로 — 칠하기/지우기 합성 · 경계 넓히기(지울 때 1px 더) · 다른 상태를 안 남김
   ・3절: app.js 배선 — 🪣 페인트통(도구 줄 · 2026-10-09 paint-tools.js 로) · G 키 · 한 번 누르면 끝(획 아님) · Shift = 지우기 ·
          되돌리기 한 칸 · 귀 대칭 · 나가면 꺼짐
   ・4절: html 로드
   ⚠️ 실제 픽셀은 2026-10-08 헤드리스 크로미움에서 실제 앱 페이지로 확인했다(왼 귀만 2145 · 오른 0 → 되돌리기 0 ·
     대칭 2145 · 2155 → 지우개 채우기 0).
   [실행] uv-fill.js · ears-glb.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['uv-fill.js', 'ears-glb.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const win = {};
['ears-glb.js', 'uv-fill.js'].forEach(f => new Function('window', 'module', SRC[f])(win, undefined));
const U = win.UvFill;
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

/* three 없이 geometry 흉내 — attributes.uv.getX/getY · index.getX/count */
const attr = (arr, n) => ({ count:arr.length / n, getX:(i) => arr[i * n], getY:(i) => arr[i * n + 1] });
const geo = (uv, index) => ({ attributes:{ uv:attr(uv, 2) }, index:index ? attr(index, 1) : null });
function earGeo(key){
  const buf = Buffer.from(win.ANIMAL_EARS[key], 'base64'), len = buf.readUInt32LE(12);
  const j = JSON.parse(buf.toString('utf8', 20, 20 + len)), bin = buf.subarray(20 + len + 8), pr = j.meshes[0].primitives[0];
  const rd = (i, n, f) => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView], o = (bv.byteOffset || 0) + (a.byteOffset || 0), sz = f ? 4 : (a.componentType === 5123 ? 2 : 4), st = bv.byteStride || n * sz, out = [];
    for(let k = 0; k < a.count; k++) for(let c = 0; c < n; c++){ const at = o + k * st + c * sz; out.push(f ? bin.readFloatLE(at) : (sz === 2 ? bin.readUInt16LE(at) : bin.readUInt32LE(at))); } return out; };
  return geo(rd(pr.attributes.TEXCOORD_0, 2, true), rd(pr.indices, 1, false));
}

say('── 1. 삼각형 좌표');
const g1 = geo([0, 0, 1, 0, 0, 1, 1, 1], [0, 1, 2, 2, 1, 3]);
const t1 = U.uvTriangles(g1, 512);
chk(t1.length === 2 && t1[0].join() === '0,0,512,0,0,512' && t1[1].join() === '0,512,512,0,512,512', '인덱스 geometry — 캔버스 좌표 = uv × 크기(붓과 같은 규약)');
chk(U.uvTriangles(geo([0, 0, 0.5, 0, 0, 0.5]), 100).join() === '0,0,50,0,0,50', '인덱스 없는 geometry — 정점 셋씩');
chk(U.uvTriangles({ attributes:{} }, 512).length === 0 && U.uvTriangles(null, 512).length === 0, 'UV 가 없으면 빈 목록(칠하지 않는다)');
chk(U.uvTriangles(geo([0, 0, NaN, 0, 0, 1]), 512).length === 0, '망가진 UV 삼각형은 건너뛴다');
for(const t of win.ANIMAL_EAR_TYPES){
  const g = earGeo('ear_' + t.key + '_L'), tri = U.uvTriangles(g, 512);
  const inBox = tri.every(a => a.every(v => v >= 0 && v <= 512));
  chk(tri.length === g.index.count / 3 && inBox, `${t.label} 귀 — 삼각형 ${tri.length}개 · 전부 그림판 안`);
}

say('── 2. fillMesh (가짜 2D 문맥)');
function fakeCtx(){
  const log = [], st = { globalCompositeOperation:'source-over', fillStyle:'#000', strokeStyle:'#000', lineWidth:1, lineJoin:'miter' };
  const saved = [];
  const c = Object.assign({}, st, {
    log, save(){ saved.push(Object.assign({}, this)); }, restore(){ const s = saved.pop(); Object.keys(st).forEach(k => { this[k] = s[k]; }); },
    beginPath(){ log.push('begin'); }, moveTo(){ log.push('M'); }, lineTo(){ log.push('L'); }, closePath(){ log.push('Z'); },
    fill(){ log.push('fill:' + this.globalCompositeOperation + ':' + this.fillStyle); }, stroke(){ log.push('stroke:' + this.lineWidth + ':' + this.strokeStyle); },
  });
  return c;
}
const c1 = fakeCtx();
const n1 = U.fillMesh(c1, g1, 512, { color:'#ff3366' });
chk(n1 === 2 && c1.log.filter(x => x === 'M').length === 2, '삼각형마다 한 번씩 그린다 — 칠한 수를 돌려준다');
chk(c1.log.includes('fill:source-over:#ff3366') && c1.log.includes('stroke:' + (U.FILL_PAD_PX * 2) + ':#ff3366'), `칠하기 — 지금 색 · 경계를 ${U.FILL_PAD_PX}px 넓힌다(솔기 실선 방지)`);
chk(c1.log.filter(x => x === 'begin').length === 1 && c1.log.filter(x => /^fill/.test(x)).length === 1, '한 경로로 한 번에 칠한다(삼각형 수만큼 fill 하지 않는다)');
chk(c1.globalCompositeOperation === 'source-over' && c1.lineWidth === 1, '끝나면 문맥 상태를 되돌린다(붓 설정을 안 바꾼다)');
const c2 = fakeCtx();
U.fillMesh(c2, g1, 512, { erase:true });
chk(c2.log.some(x => /^fill:destination-out/.test(x)) && c2.log.includes('stroke:' + ((U.FILL_PAD_PX + 1) * 2) + ':#000000'), '지우개 — 그 자리만 지운다 · 1px 더 넓게(번진 테두리가 남지 않게)');
const c3 = fakeCtx();
chk(U.fillMesh(c3, { attributes:{} }, 512, {}) === 0 && c3.log.length === 0, 'UV 가 없으면 아무것도 안 한다');

say('── 3. app.js 배선');
const APP = SRC['app.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const A = strip(APP);
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
const fh = grab(A, '_wdPicFillHit');
chk(/UvFill\.fillMesh\(tgt\.user\.getContext\('2d'\), hit\.object\.geometry, CANVAS_SZ, opt\);/.test(fh) && /_picBlit\(tgt\.wrp\);/.test(fh), '맞힌 메쉬의 geometry 만 · 맞힌 대상 그림판에');
chk(/const opt=\{ color:_wdPic\.color, erase:!!erase \};/.test(fh) && /function _wdPicFillHit\(hit, erase\)/.test(fh), '지금 색 · 지우기는 Shift+클릭이 넘긴 값(지우개 도구와 동시에 켜질 수 없다)');
chk(/if\(_wdPic\.ear && _wdPic\.sym\)\{/.test(fh) && /UvFill\.fillMesh\(mt\.user\.getContext\('2d'\), om\.geometry/.test(fh), '귀 대칭이면 반대쪽 귀의 같은 메쉬도');
chk(/if\(typeof UvFill === 'undefined'/.test(fh), 'uv-fill.js 가 없으면 아무것도 안 한다(앱은 켜진다)');
chk(/if\(_wdPic\.fill\)\{ _wdPicPush\(\); _wdPicFillHit\(hit, e\.shiftKey\); return; \}/.test(A), '좌클릭 — 채우기면 되돌리기 한 칸 남기고 한 번에 끝(끌기 획 아님) · Shift 면 지우기');
chk(/if\(wdPaintTool\) wdPaintTool\.mount\(toolSeg\);/.test(A) && /\[toolSeg,symB,swat\]/.test(A), '그리기 줄에 도구 줄(붓 · 🪣 페인트통 · 지우개 — 하나만)');
chk(/else if\(wdPaintTool && wdPaintTool\.handleKey\(e\)\)\{ stop\(\); \}/.test(grab(A, '_wdPicKey')), 'G 키 = 페인트통(B 붓 · E 지우개 — 생성기와 같은 글자)');
chk(/G 페인트통/.test(APP), '안내 줄에 G 페인트통');
chk(/_wdPic\.fill=false;/.test(grab(A, 'exitWdPicMode')), '그리기를 나가면 채우기도 꺼진다');
chk(/fill:false/.test(A.slice(A.indexOf('const _wdPic = {'), A.indexOf('const _wdPic = {') + 400)), '처음 상태는 꺼짐');

say('── 4. html');
const HTML = SRC['desk-companion-prototype.html'];
const iF = HTML.indexOf('<script src="parts/uv-fill.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
chk(iF > 0 && iF < iA, 'uv-fill.js 를 app.js 앞에 싣는다');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

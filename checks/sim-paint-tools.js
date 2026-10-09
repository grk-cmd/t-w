/* ═══ 🖌 sim-paint-tools.js — 생성기 칠하기 도구 줄(붓 · 페인트통 · 지우개) (2026-10-09 신설) ═══════════
   ・1절: uv-fill.js 섬 함수 — 손으로 만든 geometry · 실제 동물 몸/얼굴 GLB · 사람 얼굴 GLB
          (누른 조각만 · 다른 조각 안 섞임 · UV 로 찾기 · 넓이 0 조각은 안 칠함 · 캐시)
   ・2절: createPaintTools — 기본 붓 · 하나만 · onChange · C 토글 · 색 고르면 지우개만 붓으로 · 키(B G E · 맥 한글) · 클릭 동작 · 커서
   ・3절: 페인트통 한 번 — 되돌리기 한 칸을 칠하기 **전에** · 칠할 게 없으면 이력 안 남김 · 지우기 · 3-b 여백 몫(가운데 선까지 · 옆 조각 · 다른 메쉬 · 실제 동물 몸 · 사람 얼굴)
   ・4절: 도구 줄 DOM(가짜 문서) — 버튼 셋 · 눌림 표시 · 한국어 툴팁 · 인라인 SVG(currentColor)
   ・5절: 배선 — app.js(사람 · 꾸미기 그리기) · animal.js(동물) · html 로드 순서 · 스타일
   ・6절: 🪣 동물 양팔 — 실제 몸 GLB 의 왼팔 · 오른팔 조각이 따로 · 안 겹침 · 둘 다 채워짐 / 🔒 잠금 · 빈 곳 알림(채우기 · 붓)
   ※ 스포이드(우클릭)는 main 그대로라 여기서 보지 않는다(사용자 결정 2026-10-09).
   [실행] uv-fill.js · paint-tools.js · key-input.js · animal-glb.js · base-glb.js · app.js · animal.js ·
          desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
/* 평평한 스테이징(run.js)이 기본. 원본이 여럿이라 한 층 아래 parts/ 도 본다 — 러너는 바퀴마다 하나씩만 끌어올린다. */
const read = (f) => { for(const p of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]){ try{ return fs.readFileSync(p, 'utf8'); }catch(_){} } return null; };
const need = ['uv-fill.js', 'paint-tools.js', 'key-input.js', 'animal-glb.js', 'base-glb.js', 'app.js', 'animal.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const win = { addEventListener(){} };
['uv-fill.js', 'paint-tools.js', 'animal-glb.js', 'base-glb.js'].forEach(f => new Function('window', 'module', SRC[f])(win, undefined));
const hotkeyLetter = new Function('window', SRC['key-input.js'] + '\nreturn hotkeyLetter;')(win);
const U = win.UvFill, P = win.PaintTools;

/* three 없이 geometry 흉내 */
const attr = (arr, n) => ({ count:arr.length / n, getX:(i) => arr[i * n], getY:(i) => arr[i * n + 1] });
const geo = (uv, index) => ({ attributes:{ uv:attr(uv, 2) }, index:index ? attr(index, 1) : null });
function glbMeshes(b64){
  const buf = Buffer.from(b64, 'base64'), len = buf.readUInt32LE(12);
  const j = JSON.parse(buf.toString('utf8', 20, 20 + len)), bin = buf.subarray(20 + len + 8);
  const rd = (i, n, f) => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView], o = (bv.byteOffset || 0) + (a.byteOffset || 0), sz = f ? 4 : (a.componentType === 5123 ? 2 : 4), st = bv.byteStride || n * sz, out = [];
    for(let k = 0; k < a.count; k++) for(let c = 0; c < n; c++){ const at = o + k * st + c * sz; out.push(f ? bin.readFloatLE(at) : (sz === 2 ? bin.readUInt16LE(at) : bin.readUInt32LE(at))); } return out; };
  const out = {};
  j.nodes.forEach(nd => { if(nd.mesh == null) return; const pr = j.meshes[nd.mesh].primitives[0];
    out[nd.name] = geo(rd(pr.attributes.TEXCOORD_0, 2, true), rd(pr.indices, 1, false)); out[nd.name].pos = rd(pr.attributes.POSITION, 3, true); });
  return out;
}
/* 섬 하나의 삼각형 번호들 */
const trisOf = (ids, id) => { const o = []; for(let t = 0; t < ids.length; t++) if(ids[t] === id) o.push(t); return o; };
const bbox = (tris) => tris.reduce((b, t) => [Math.min(b[0], t[0], t[2], t[4]), Math.max(b[1], t[0], t[2], t[4]), Math.min(b[2], t[1], t[3], t[5]), Math.max(b[3], t[1], t[3], t[5])], [1e9, -1e9, 1e9, -1e9]);

say('── 1. UV 섬 (uv-fill.js)');
/* 사각형 두 장(섬 A: 왼쪽 반 · 섬 B: 오른쪽 반) + 날카로운 모서리로 쪼개진 정점(같은 UV) + 한 점에 접힌 조각 */
const g1 = geo([
  0, 0, 0.4, 0, 0, 1, 0.4, 1,          // 0~3 섬 A
  0.6, 0, 1, 0, 0.6, 1, 1, 1,          // 4~7 섬 B 앞 삼각형
  1, 1, 0.6, 1,                        // 8~9 섬 B 의 7 · 6 과 같은 UV(쪼개진 정점)
  0.5, 0.02, 0.5, 0.02, 0.5, 0.02,     // 10~12 넓이 0 조각(다른 섬과 안 닿는 한 점)
  1, 0,                                // 13 섬 B 의 5 와 같은 UV
], [0, 1, 2, 2, 1, 3,  4, 5, 6,  13, 8, 9,  10, 11, 12]);   // 세 번째 삼각형은 인덱스를 하나도 안 나눠 쓴다
const ids1 = U.islandIds(g1);
chk(ids1.length === 5 && ids1[0] === ids1[1] && ids1[2] === ids1[3] && ids1[0] !== ids1[2], '정점을 나눠 쓰는 삼각형은 한 섬 · 떨어진 조각은 다른 섬');
chk(ids1[2] === ids1[3], 'UV 좌표가 같은 정점(날카로운 모서리로 쪼개짐)은 이어 본다');
chk(U.islandIds(g1) === ids1, '같은 geometry 는 다시 세지 않는다(캐시)');
const iA = U.islandTriangles(g1, 100, 0, null), iB = U.islandTriangles(g1, 100, 3, null);
chk(iA.length === 2 && bbox(iA)[1] <= 40, '섬 A 를 누르면 왼쪽 조각 삼각형 둘만(오른쪽 x≥60 은 안 들어감)');
chk(iB.length === 2 && bbox(iB)[0] >= 60, '섬 B 를 누르면 오른쪽 조각 둘만');
chk(U.islandTriangles(g1, 100, 4, null).length === 0, '넓이 0 조각(UV 가 한 점에 접힘)은 빈 목록 — 칠할 그림이 없다');
chk(U.triangleAtUv(g1, 0.8, 0.2) === 2 && U.triangleAtUv(g1, 0.5, 0.5) === -1, 'UV 점으로 삼각형 찾기 — 틈(0.5)은 -1');
chk(U.islandTriangles(g1, 100, undefined, { x:0.8, y:0.9 }).length === 2, '삼각형 번호가 없으면 UV 로 찾는다(대칭 되쏘기)');
chk(U.islandTriangles(g1, 100, 99, { x:0.1, y:0.1 }).length === 2, '범위 밖 번호는 버리고 UV 로');
chk(U.islandTriangles({ attributes:{} }, 100, 0, null).length === 0 && U.islandIds(null) === null, 'UV 가 없으면 아무것도 안 칠한다');

const AN = glbMeshes(win.ANIMAL_GLB_B64);
const body = AN.body, f1 = AN.face1;
const bIds = U.islandIds(body), bSet = new Set(bIds), fIds = U.islandIds(f1), fSet = new Set(fIds);
chk(bSet.size === 5 && fSet.size === 2, `동물 몸 섬 ${bSet.size}개(몸통 앞 · 뒤 · 다리 · 좌우 손) · 얼굴1 섬 ${fSet.size}개(얼굴 · 뒤통수)`);
for(const id of fSet){
  const ts = trisOf(fIds, id), tri = U.islandTriangles(f1, 512, ts[0], null), others = trisOf(fIds, [...fSet].find(x => x !== id));
  const ob = bbox(U.islandTriangles(f1, 512, others[0], null)), b = bbox(tri);
  const apart = b[1] < ob[0] || ob[1] < b[0] || b[3] < ob[2] || ob[3] < b[2];
  chk(tri.length === ts.length && apart, `동물 얼굴 조각(${ts.length}삼각형)만 — 다른 조각과 그림판 자리가 안 겹친다`);
}
const bigB = [...bSet].map(id => trisOf(bIds, id)).sort((a, b) => b.length - a.length)[0];
chk(U.islandTriangles(body, 512, bigB[0], null).length === bigB.length && bigB.length < body.index.count / 3, `동물 몸 — 가장 큰 조각(${bigB.length})만, 몸 전체(${body.index.count / 3})가 아니다`);

const HU = glbMeshes(win.BASE_GLB_B64);
const hf = HU.face, hIds = U.islandIds(hf), hSet = new Set(hIds);
const hIsl = [...hSet].map(id => ({ id, ts:trisOf(hIds, id) })).map(o => Object.assign(o, { fill:U.islandTriangles(hf, 512, o.ts[0], null) }));
const painted = hIsl.filter(o => o.fill.length), folded = hIsl.filter(o => !o.fill.length);
chk(painted.length === 2 && folded.length >= 1, `사람 얼굴 메쉬 — 칠할 조각 ${painted.length}개(얼굴 · 뒤통수) · UV 가 접힌 조각(몸 · 손) ${folded.length}개는 안 칠한다`);
const front = painted.find(o => o.ts.length === 98);
chk(!!front && bbox(front.fill)[3] < 0.52 * 512 && bbox(front.fill)[1] < 0.3 * 512, '사람 얼굴 앞 조각은 그 자리(u<0.3 · v<0.52)만 — 그림판 전체가 아니다');

say('── 2. createPaintTools');
const log = [];
const T = P.createPaintTools({ hotkeyLetter, uvFill:U, onChange:(t, prev) => log.push(prev + '>' + t) });
chk(T.get() === 'brush' && !T.erasing() && P.PAINT_TOOLS.join() === 'brush,bucket,eraser', '처음엔 붓 · 도구는 붓 · 페인트통 · 지우개 셋');
chk(T.set('bucket') === true && T.is('bucket') && log.join() === 'brush>bucket', '고르면 onChange(새 도구, 예전 도구)');
chk(T.set('bucket') === false && log.length === 1, '같은 도구를 다시 고르면 아무 일 없음');
chk(T.set('pen') === false && T.get() === 'bucket', '모르는 도구 이름은 무시');
T.dropEraser();
chk(T.get() === 'bucket', '색을 골라도 페인트통은 그대로(색을 바꿔 가며 채운다)');
T.set('eraser'); T.dropEraser();
chk(T.get() === 'brush', '지우개일 때 색을 고르면 붓으로(예전 «색 고르면 지우개 꺼짐» 그대로)');
T.toggleEraser(); const a1 = T.get(); T.toggleEraser();
chk(a1 === 'eraser' && T.get() === 'brush', 'C(toggleEraser) — 지우개 ↔ 붓');
const kev = (key, code, x) => Object.assign({ key, code }, x || {});
chk(T.toolForKey(kev('b', 'KeyB')) === 'brush' && T.toolForKey(kev('g', 'KeyG')) === 'bucket' && T.toolForKey(kev('e', 'KeyE')) === 'eraser', 'B 붓 · G 페인트통 · E 지우개');
chk(T.toolForKey(kev('ㅎ', 'KeyG')) === 'bucket' && T.toolForKey(kev('ㄷ', 'KeyE')) === 'eraser', '맥 한글 상태(ㅎ · ㄷ)도 물리 키로 같은 도구(hotkeyLetter)');
chk(T.toolForKey(kev('e', 'KeyE', { ctrlKey:true })) === '' && T.toolForKey(kev('G', 'KeyG', { shiftKey:true })) === '' && T.toolForKey(kev('g', 'KeyG', { metaKey:true })) === '', 'Ctrl+E(관리자) · Shift+G(동물 전체 채우기) · Cmd 는 도구 키가 아니다');
chk(T.toolForKey(kev('x', 'KeyX')) === '' && T.handleKey(kev('x', 'KeyX')) === false, '다른 글자는 처리하지 않는다(false — preventDefault 안 함)');
chk(T.handleKey(kev('g', 'KeyG')) === true && T.is('bucket'), 'handleKey 가 도구를 바꾸고 true');
chk(T.pointerAction({}) === 'fill' && T.pointerAction({ shiftKey:true }) === 'fillErase', '페인트통 클릭 = 채우기 · Shift+클릭 = 그 조각 지우기');
T.set('eraser');
chk(T.pointerAction({ shiftKey:true }) === 'stroke' && T.erasing(), '지우개는 끌기 획(stroke) — 예전 지우개처럼 destination-out 획');
chk(/^url\("data:image\/svg\+xml,/.test(P.TOOL_CURSOR.bucket) && /, cell$/.test(P.TOOL_CURSOR.bucket) && P.TOOL_CURSOR.brush === 'crosshair' && T.cursor() === P.TOOL_CURSOR.eraser,
  '커서 — 붓 + · 페인트통 · 지우개 그림(인라인 SVG · 안 되면 cell)');

say('── 3. 페인트통 한 번 — 되돌리기 · 화면');
/* 픽셀 문맥 — getImageData/putImageData 만(uv-fill.js paintMask 가 텍셀을 직접 쓴다) */
function pixCtx(size, log){
  const data = new Uint8ClampedArray(size * size * 4);
  return { data, size, getImageData:() => ({ data }), putImageData:() => { if(log) log.push('paint'); } };
}
const px = (c, x, y) => Array.from(c.data.slice((y * c.size + x) * 4, (y * c.size + x) * 4 + 4));
const order = [];
const c1 = pixCtx(100, order);
const n1 = T.bucket({ ctx:c1, geometry:g1, size:100, faceIndex:3, color:'#ff0000', pushHistory:() => order.push('hist'), blit:() => order.push('blit') });
chk(n1 > 0 && order.join() === 'hist,paint,blit', '되돌리기 한 칸을 칠하기 전에 → 칠하기 → 화면 갱신(붓 획과 같은 순서)');
const o2 = [];
const n2 = T.bucket({ ctx:pixCtx(100), geometry:g1, size:100, faceIndex:4, pushHistory:() => o2.push('hist'), blit:() => o2.push('blit') });
chk(n2 === 0 && o2.length === 0, '칠할 자리가 없으면(접힌 조각) 이력도 화면 갱신도 없다 — 빈 되돌리기 칸이 안 생긴다');
const c3 = pixCtx(100); c3.data.fill(200);
T.bucket({ ctx:c3, geometry:g1, size:100, faceIndex:0, erase:true });
chk(px(c3, 20, 50)[3] === 0 && px(c3, 80, 50)[3] === 200, 'Shift(지우기) — 그 조각만 투명하게(바탕이 보인다) · 다른 조각은 그대로');
const c4 = pixCtx(100);
T.bucket({ ctx:c4, geometry:g1, size:100, faceIndex:0, color:'#123456' });
chk(px(c4, 20, 50).join() === '18,52,86,255' && px(c4, 80, 50)[3] === 0, '칠하기 — 지금 색(불투명) · 누른 조각만');
chk(P.applyBucket({ ctx:pixCtx(100), geometry:g1, size:100, faceIndex:0 }) === 0, 'uv-fill.js 가 없으면 아무것도 안 한다(앱은 켜진다)');

say('── 3-b. 🧵 여백 몫 — 이웃 조각과의 가운데 선까지 채운다(테두리 실선 막기)');
const isPainted = (c, x, y) => px(c, x, y)[3] === 255;
/* 섬 A: x 0~40 · 섬 B: x 60~100 (100×100) — 사이 여백 40~59 */
const cA = pixCtx(100);
T.bucket({ ctx:cA, geometry:g1, size:100, faceIndex:0, color:'#ff0000' });
chk(isPainted(cA, 39, 50) && isPainted(cA, 40, 50), '경계 텍셀(중심이 조각 밖이어도 걸친 칸)까지 칠한다 — 옛 색이 섞이던 칸');
chk(isPainted(cA, 49, 50) && !isPainted(cA, 50, 50), '여백은 이웃 조각과의 가운데 선까지(40~49 는 이 조각 몫 · 50~59 는 옆 조각 몫) — 몇 텍셀로 자르지 않는다(밉맵 깊은 단계도 깨끗)');
chk([50, 59, 60, 70, 99].every(x => !isPainted(cA, x, 50)), '옆 조각 안쪽 · 옆 조각 몫 여백은 한 칸도 안 건드린다');
const g2 = geo([0, 0, 0.4, 0, 0, 1, 0.4, 1,  0.44, 0, 1, 0, 0.44, 1, 1, 1], [0, 1, 2, 2, 1, 3,  4, 5, 6, 6, 5, 7]);
const cB = pixCtx(100);
T.bucket({ ctx:cB, geometry:g2, size:100, faceIndex:0, color:'#ff0000' });
chk(isPainted(cB, 41, 50) && !isPainted(cB, 42, 50) && !isPainted(cB, 44, 50), '여백이 좁으면 반씩(40~41 이 조각 · 42~43 옆 조각)');
const g3 = geo([0, 0, 0.4, 0, 0, 1, 0.4, 1], [0, 1, 2, 2, 1, 3]), peer = geo([0.42, 0, 0.7, 0, 0.42, 1, 0.7, 1], [0, 1, 2, 2, 1, 3]);
const cC = pixCtx(100), cD = pixCtx(100);
T.bucket({ ctx:cC, geometry:g3, size:100, faceIndex:0, color:'#ff0000', peers:[peer] });
T.bucket({ ctx:cD, geometry:g3, size:100, faceIndex:0, color:'#ff0000' });
chk(isPainted(cC, 40, 50) && !isPainted(cC, 42, 50) && !isPainted(cC, 80, 50) && isPainted(cD, 80, 50) && isPainted(cD, 99, 99),
  '같은 그림판을 쓰는 다른 메쉬(peers) 안쪽 · 그 몫도 안 덮는다 — 혼자면 빈 그림판 전부가 이 조각 몫');
const cE = pixCtx(100); cE.data.fill(200);
T.bucket({ ctx:cE, geometry:g1, size:100, faceIndex:0, erase:true });
chk(px(cE, 45, 50)[3] === 0 && px(cE, 55, 50)[3] === 200 && px(cE, 80, 50)[3] === 200, 'Shift 지우기도 같은 자리(가운데 선까지) · 옆 조각 몫은 그대로');
const L1 = U.canvasLayout(100, [g1]);
chk(U.canvasLayout(100, [g1]) === L1 && U.canvasLayout(64, [g1]) !== L1, '주인 표는 (geometry 묶음 · 크기)마다 한 번 만들고 기억한다');
{ const zi = L1.islands.findIndex(o => !(o.area > 0.5)), cZ = pixCtx(100);
  T.bucket({ ctx:cZ, geometry:g1, size:100, faceIndex:0, color:'#ff0000' });
  chk(zi >= 0 && L1.owner[2 * 100 + 50] === zi + 1 && !isPainted(cZ, 50, 2) && U.islandIndex(L1, g1, 4, null) === -1,
    '넓이 0 조각(사람 손 · 몸이 UV 한 점을 읽음)도 그 점의 주인 — 옆 조각을 채워도 그 점은 안 칠한다(손 · 몸 색 그대로) · 그 조각 자체는 못 채움'); }
{ const LH = U.canvasLayout(512, [hf]), cHz = pixCtx(512);
  const fr = [...hSet].map(id => trisOf(hIds, id)).find(ts => ts.length === 98);
  T.bucket({ ctx:cHz, geometry:hf, size:512, faceIndex:fr[0], color:'#ff0000' });
  chk(!isPainted(cHz, 0, 511), '실제 사람 — 얼굴 앞을 채워도 손 · 몸이 읽는 점(0,511)은 그대로'); }
/* 실제 동물 — 몸 · 얼굴형 넷이 그림판 한 장을 같이 쓴다 */
{
  const S = 512, faces = ['face1', 'face2', 'face3', 'face4'].map(k => AN[k]);
  const rast = (tris) => { const m = new Uint8Array(S * S); for(const t of tris){ const d = (t[3] - t[5]) * (t[0] - t[4]) + (t[4] - t[2]) * (t[1] - t[5]); if(!d) continue;
    const x0 = Math.max(0, Math.floor(Math.min(t[0], t[2], t[4]))), x1 = Math.min(S - 1, Math.ceil(Math.max(t[0], t[2], t[4]))), y0 = Math.max(0, Math.floor(Math.min(t[1], t[3], t[5]))), y1 = Math.min(S - 1, Math.ceil(Math.max(t[1], t[3], t[5])));
    for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++){ const pxx = x + 0.5, pyy = y + 0.5; const l1 = ((t[3] - t[5]) * (pxx - t[4]) + (t[4] - t[2]) * (pyy - t[5])) / d, l2 = ((t[5] - t[1]) * (pxx - t[4]) + (t[0] - t[4]) * (pyy - t[5])) / d;
      if(l1 >= 0 && l2 >= 0 && 1 - l1 - l2 >= 0) m[y * S + x] = 1; } } return m; };
  const chebDist = (m) => { const d = new Int32Array(S * S).fill(1e9), q = new Int32Array(S * S); let qt = 0; for(let k = 0; k < S * S; k++) if(m[k]){ d[k] = 0; q[qt++] = k; }
    for(let qh = 0; qh < qt; qh++){ const k = q[qh], x = k % S, y = (k / S) | 0; for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ const xx = x + dx, yy = y + dy; if(xx < 0 || yy < 0 || xx >= S || yy >= S) continue; const kk = yy * S + xx; if(d[kk] > d[k] + 1){ d[kk] = d[k] + 1; q[qt++] = kk; } } } return d; };
  const arm = [...bSet].map(id => { const ts = trisOf(bIds, id); let x = 0, n = 0; ts.forEach(t => { for(let k = 0; k < 3; k++){ x += body.pos[body.index.getX(t * 3 + k) * 3]; n++; } }); return { id, ts, x:x / n }; }).sort((a, b) => a.x - b.x)[0];
  const cR = pixCtx(S);
  T.bucket({ ctx:cR, geometry:body, size:S, faceIndex:arm.ts[0], color:'#ff0000', peers:faces });
  const own = rast(U.islandTriangles(body, S, arm.ts[0], null));
  const othTris = []; [...bSet].filter(id => id !== arm.id).forEach(id => U.islandTriangles(body, S, trisOf(bIds, id)[0], null).forEach(t => othTris.push(t)));
  faces.forEach(g => U.uvTriangles(g, S).forEach(t => othTris.push(t)));
  const oth = rast(othTris), dOwn = chebDist(own), dOth = chebDist(oth);
  let hitOther = 0, gutter = 0, gutterOk = 0, wrongSide = 0;
  for(let k = 0; k < S * S; k++){
    const p = cR.data[k * 4 + 3] === 255;
    if(oth[k] && !own[k] && p) hitOther++;
    if(!own[k] && !oth[k] && dOwn[k] + 1 < dOth[k]){ gutter++; if(p) gutterOk++; }
    if(p && !own[k] && dOwn[k] > dOth[k] + 1) wrongSide++;
  }
  chk(hitOther === 0, '실제 동물 몸 왼팔 채우기 — 다른 조각(몸통 · 오른팔 · 다리 · 얼굴형 넷) 텍셀 0개 침범');
  chk(gutter > 1000 && gutterOk === gutter, `실제 동물 몸 왼팔 — 이 조각이 더 가까운 여백 ${gutterOk}/${gutter} 텍셀 전부 칠함(고정 폭이 아니라 가운데 선까지)`);
  chk(wrongSide === 0, '실제 동물 몸 왼팔 — 다른 조각이 더 가까운 여백은 칠하지 않는다(그 조각의 둘레를 덮지 않음)');
}
{
  /* 사람 얼굴 메쉬 — 얼굴 앞 조각 채우기는 뒤통수 조각 안쪽을 안 덮는다 */
  const S = 512, cH = pixCtx(S), front = [...hSet].map(id => ({ id, ts:trisOf(hIds, id) })).find(o => o.ts.length === 98), back = [...hSet].map(id => ({ id, ts:trisOf(hIds, id) })).find(o => o.ts.length === 158);
  T.bucket({ ctx:cH, geometry:hf, size:S, faceIndex:front.ts[0], color:'#ff0000' });
  const bt = U.islandTriangles(hf, S, back.ts[0], null); let inBack = 0, tot = 0;
  for(const t of bt){ const cx = Math.floor((t[0] + t[2] + t[4]) / 3), cy = Math.floor((t[1] + t[3] + t[5]) / 3); tot++; if(isPainted(cH, cx, cy)) inBack++; }
  chk(tot > 100 && inBack === 0, `사람 얼굴 앞 채우기 — 뒤통수 조각 안쪽(삼각형 중심 ${tot}곳) 0곳 칠함`);
}

say('── 4. 도구 줄 DOM');
function fakeDoc(){
  const mk = (tag) => { const e = { tag, children:[], attrs:{}, dataset:{}, className:'', innerHTML:'', title:'',
    classList:{ _s:new Set(), toggle(c, on){ on ? this._s.add(c) : this._s.delete(c); }, contains(c){ return this._s.has(c); } },
    setAttribute(k, v){ this.attrs[k] = String(v); }, getAttribute(k){ return this.attrs[k]; },
    appendChild(c){ this.children.push(c); return c; } };
    Object.defineProperty(e, 'innerHTML', { get(){ return this._h || ''; }, set(v){ this._h = v; if(v === '') this.children = []; } });
    return e; };
  return { createElement:mk };
}
const doc = fakeDoc(), host = doc.createElement('span');
const T2 = P.createPaintTools({ doc, uvFill:U });
const seg = T2.mount(host);
const bs = seg ? seg.children : [];
chk(host.children.length === 1 && seg.attrs.role === 'group' && bs.length === 3 && bs.map(b => b.dataset.tool).join() === 'brush,bucket,eraser', '버튼 셋(붓 · 페인트통 · 지우개)을 한 묶음으로');
chk(bs[0].classList.contains('on') && bs[0].attrs['aria-pressed'] === 'true' && bs[1].attrs['aria-pressed'] === 'false', '지금 도구만 눌림(on · aria-pressed)');
bs[1].onclick();
chk(T2.is('bucket') && bs[1].classList.contains('on') && !bs[0].classList.contains('on'), '버튼을 누르면 그 도구 · 눌림 표시가 옮겨 간다');
chk(/페인트통 \(G\)/.test(bs[1].title) && /Shift\+클릭/.test(bs[1].title) && /^붓 \(B\)/.test(bs[0].title) && /^지우개 \(E/.test(bs[2].title), '툴팁은 한국어 · 단축키를 같이');
chk(bs.every(b => /^<svg [^>]*stroke="currentColor"/.test(b.innerHTML) && b.type === 'button'), '아이콘은 인라인 SVG · currentColor(테마 글자색을 따른다) — 외부 아이콘 글꼴 없음(CSP)');
T2.mount(host);
chk(host.children.length === 1, '다시 붙이면 예전 버튼을 버리고 하나만');

say('── 5. 배선');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const A = strip(SRC['app.js']), N = strip(SRC['animal.js']), HTML = SRC['desk-companion-prototype.html'];
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
/* 사람 */
chk(/faceIndex:t\/3/.test(grab(A, '_picSkinnedIntersect')), '리깅 광선(_picSkinnedIntersect)도 삼각형 번호를 돌려준다');
const bf = grab(A, 'bucketFromEvent');
chk(/_paintHitAt\(e\.clientX, e\.clientY\)/.test(bf) && /ctx=actC\(\)\.getContext\('2d'\)/.test(bf) && /faceIndex:hit\.faceIndex, uv:hit\.uv, color:brushColor, erase, pushHistory \}/.test(bf), '사람 — 붓과 같은 광선 · 지금 그림 층(표정/감은눈) · 되돌리기 pushHistory');
chk(/if\(symmetry\)\{ const m=mirrorUV\(hit\); if\(m\) crPaintTool\.bucket\(\{ ctx, geometry:g, size:CANVAS_SZ, uv:m, color:brushColor, erase \}\); \}/.test(bf), '사람 — 대칭이면 거울 자리 조각도(되돌리기는 한 칸)');
chk(/if\(crStep===3\) blinkEdited=true;/.test(bf) && /blit\(\);/.test(bf), '사람 — 감은눈 단계면 «손댐» 표시 · 화면 갱신');
chk(/const act=crPaintTool\?crPaintTool\.pointerAction\(e\):'stroke';\s*if\(act!=='stroke'\)\{ bucketFromEvent\(e, act==='fillErase'\); return; \}\s*if\(crStep===3\)blinkEdited=true;pushHistory\(\);painting=true;/.test(A), '사람 — 좌클릭: 페인트통이면 한 번에 끝(획 시작 전에 갈라짐)');
chk(/onChange:\(t\)=>\{ eraser=\(t==='eraser'\); if\(t!=='brush' && stampMode\) setStampMode\(false\);/.test(A), '사람 — 지우개 변수는 도구 줄에서만 · 붓 말고 고르면 도장 닫기');
chk(/crPaintTool\.mount\(document\.getElementById\('crToolSeg'\)\)/.test(A) && /if\(typeof PaintTools!=='undefined'\)\{/.test(A), '사람 — 도구 줄을 붙인다 · 모듈이 없어도 앱은 켜진다');
chk(!/eraserBtn/.test(SRC['app.js']) && !/eraserBtn/.test(HTML), '사람 — 옛 지우개 토글 버튼은 없다(도구 줄이 대신)');
chk((A.match(/_crDropEraser\(\)/g) || []).length >= 5 && !/[{;]\s*eraser=false;/.test(A), '사람 — 칩 · 자유 색 · 스포이드 · 도장은 dropEraser(지우개만 붓으로)');
chk(/crPaintTool\.toggleEraser\(\)/.test(A) && /crPaintTool\.handleKey\(e\)\) e\.preventDefault\(\)/.test(A), '사람 — C 지우개 토글 · B G E 도구 키');
chk(/const cu=crPaintTool\.cursor\(\); if\(cv\.style\.cursor!==cu\) cv\.style\.cursor=cu;/.test(A), '사람 — 커서가 도구를 따른다');
/* 꾸미기 ✎ 그리기 — 같은 도구 줄 · 지우개와 채우기가 같이 켜질 수 없다 */
chk(/onChange:\(t\)=>\{ _wdPic\.eraser=\(t==='eraser'\); _wdPic\.fill=\(t==='bucket'\);/.test(A), '꾸미기 — eraser · fill 은 도구 하나에서만(동시에 켜질 수 없다)');
chk(/btnClass:'wd-pic-btn'/.test(A) && !/wdPicPen|wdPicEraser|'wdPicFill'/.test(SRC['app.js']), '꾸미기 — 옛 펜 · 지우개 · 채우기 버튼 대신 도구 줄(꾸미기 버튼 모양)');
const se = grab(A, '_wdPicSetEraser'), sf = grab(A, '_wdPicSetFill');
chk(/if\(v\) wdPaintTool\.set\('eraser'\); else wdPaintTool\.dropEraser\(\);/.test(se) && /if\(v\) wdPaintTool\.set\('bucket'\); else if\(wdPaintTool\.is\('bucket'\)\) wdPaintTool\.set\('brush'\);/.test(sf),
  '꾸미기 — 색 고르기 · 스포이드는 지우개만 붓으로 · 나갈 때 페인트통은 붓으로');
const TW = P.createPaintTools({}); const st = { eraser:false, fill:false };
const TW2 = P.createPaintTools({ onChange:(t) => { st.eraser = t === 'eraser'; st.fill = t === 'bucket'; } });
const seen = new Set();
for(const t of ['bucket', 'eraser', 'bucket', 'brush', 'eraser']){ TW2.set(t); seen.add(st.eraser + '/' + st.fill); }
chk(TW.get() === 'brush' && !seen.has('true/true'), '꾸미기 — 어떤 순서로 골라도 «지우개 + 채우기» 상태가 안 생긴다');
/* 동물 */
const pb = grab(N, 'pBucketEvent');
chk(/const tgt=_canvasForMesh\(hit\.object\);\s*if\(!_partAllowed\(tgt\)\)\{ _lockToast\(\); return false; \}/.test(pb), '동물 — 맞힌 메쉬의 캔버스(몸·얼굴 / 좌우 귀) · 부위 잠금 지킴(막히면 알림)');
chk(/geometry:hit\.object\.geometry, faceIndex:hit\.faceIndex, uv:hit\.uv, peers:_canvasPeers\(hit\.object\), pushHistory:pPushHist \}/.test(pb), '동물 — 그 메쉬의 조각만 · 같은 그림판의 다른 메쉬는 번짐 금지(peers) · 되돌리기 pPushHist(몸 + 좌우 귀 세트)');
chk(/if\(pSym\)\{/.test(pb) && /_pMirrorHit\(hit\)/.test(pb) && /_partAllowed\(mt\) && aPaintTool\.bucket\(/.test(pb), '동물 — 대칭이면 거울 조각도(잠금 밖이면 생략)');
chk(/const act=aPaintTool\?aPaintTool\.pointerAction\(e\):'stroke';\s*if\(act!=='stroke'\)\{ pBucketEvent\(e, act==='fillErase'\); return; \}\s*pPushHist\(\);/.test(N), '동물 — 좌클릭: 페인트통이면 한 번에 끝');
chk(/onChange:\(t\)=>\{ pEraser=\(t==='eraser'\); if\(t!=='brush' && aStampMode\) aSetStampMode\(false\); syncPaintUI\(\); \}/.test(N), '동물 — pEraser 는 도구 줄에서만');
chk(/if\(k==='g' && e\.shiftKey\)\{ pFillAll\(\);/.test(N) && /aPaintTool\.handleKey\(e\)\)\{ e\.preventDefault\(\); return; \}/.test(N) && !/if\(k==='g'\)\{ pFillAll\(\)/.test(N), '동물 — G 페인트통 · 전체 채우기는 Shift+G 로');
chk(/aPaintTool\.mount\(overlay\.querySelector\('#anpToolSeg'\)\)/.test(N) && !/anpEraser/.test(SRC['animal.js']), '동물 — 도구 줄을 붙인다 · 옛 지우개 버튼 없음');
chk(/Shift\+G<\/b> 전체 채우기/.test(SRC['animal.js']) && /<b>G<\/b> 페인트통/.test(SRC['animal.js']), '동물 — 안내 줄에 G 페인트통 · Shift+G 전체 채우기');
/* html */
const sU = HTML.indexOf('<script src="parts/uv-fill.js">'), sP = HTML.indexOf('<script src="parts/paint-tools.js">'),
      sA = HTML.indexOf('<script src="parts/app.js">'), sN = HTML.indexOf('<script src="parts/animal.js">');
chk(sU > 0 && sU < sP && sP < sA && sA < sN, 'html — uv-fill.js → paint-tools.js → app.js → animal.js');
chk(/<span id="crToolSeg"><\/span>/.test(HTML) && /<b>G<\/b> 페인트통/.test(HTML), 'html — 사람 도구 줄 자리 · 안내 줄');
chk(/\.pt-seg\{display:inline-flex;/.test(HTML) && /\.cr-tools \.pt-seg button\{/.test(HTML), 'html — 도구 줄 스타일(.cr-tools 버튼 모양 · 눌림 .on 을 그대로)');

say('── 6. 🪣 동물 양팔 · 🔒 알림');
const armIsl = [...bSet].map(id => { const ts = trisOf(bIds, id); let x = 0, n = 0; ts.forEach(t => { for(let k = 0; k < 3; k++){ x += body.pos[body.index.getX(t * 3 + k) * 3]; n++; } }); return { id, ts, x:x / n }; })
  .filter(o => Math.abs(o.x) > 0.3).sort((a, b) => a.x - b.x);
chk(armIsl.length === 2 && armIsl[0].x < 0 && armIsl[1].x > 0, `동물 몸에 팔 조각 둘(x ${armIsl.map(o => o.x.toFixed(2)).join(' · ')}) — 서로 다른 섬`);
const raster = (tris) => { const set = new Set(); for(const tr of tris) for(let y = 0; y < 128; y++) for(let x = 0; x < 128; x++){ const px = x + 0.5, py = y + 0.5;
  const d = (tr[3] - tr[5]) * (tr[0] - tr[4]) + (tr[4] - tr[2]) * (tr[1] - tr[5]); if(!d) continue;
  const l1 = ((tr[3] - tr[5]) * (px - tr[4]) + (tr[4] - tr[2]) * (py - tr[5])) / d, l2 = ((tr[5] - tr[1]) * (px - tr[4]) + (tr[0] - tr[4]) * (py - tr[5])) / d;
  if(l1 >= 0 && l2 >= 0 && 1 - l1 - l2 >= 0) set.add(x + ',' + y); } return set; };
if(armIsl.length === 2){
  const L = U.islandTriangles(body, 128, armIsl[0].ts[0], null), R = U.islandTriangles(body, 128, armIsl[1].ts[0], null);
  const rl = raster(L), rr = raster(R); let ov = 0; rl.forEach(c => { if(rr.has(c)) ov++; });
  chk(L.length === armIsl[0].ts.length && R.length === armIsl[1].ts.length && rl.size > 100 && rr.size > 100, `왼팔 ${rl.size}칸 · 오른팔 ${rr.size}칸 — 둘 다 칠할 그림 자리가 있다(넓이 0 으로 버려지지 않음)`);
  chk(ov === 0, '두 팔은 그림판에서 안 겹친다 — 한쪽을 칠해도 다른 쪽이 따라 칠해지거나 가려지지 않는다');
  const other = [...bSet].filter(id => armIsl.every(a => a.id !== id)).map(id => raster(U.islandTriangles(body, 128, trisOf(bIds, id)[0], null)));
  let ov2 = 0; other.forEach(o => o.forEach(c => { if(rr.has(c) || rl.has(c)) ov2++; }));
  chk(ov2 === 0, '팔 자리는 몸통 · 다리 조각과도 안 겹친다');
  for(const a of armIsl){ const ts = a.ts; chk(ts.every(t => U.islandTriangles(body, 128, t, null).length === ts.length), `${a.x < 0 ? '왼' : '오른'}팔 어느 삼각형을 눌러도 같은 팔 조각 전체(${ts.length})`); }
}
chk(/const LOCK_MSG=\{ ear:'지금은 귀만 칠할 수 있어요/.test(SRC['animal.js']) && /face:'지금은 얼굴만 칠할 수 있어요/.test(SRC['animal.js']) && /body:'지금은 몸만 칠할 수 있어요/.test(SRC['animal.js']), '🔒 잠금 안내 문구 셋(귀만 · 얼굴만 · 몸만)');
chk(/if\(!_partAllowed\(tgt\)\)\{ _lockToast\(\); return false; \}/.test(pb) && /if\(!_partAllowed\(tgt\)\)\{ pLastX=pLastY=null; _lockToast\(\); return; \}/.test(grab(N, 'pPaintEvent')), '🔒 페인트통 · 붓이 잠금에 막히면 알린다');
chk(/if\(now-_lockToastAt<1500\) return;/.test(grab(N, '_lockToast')), '🔒 붓은 한 획에 여러 번 막히므로 1.5초에 한 번만');
chk(/if\(!hit \|\| !hit\.object\)\{ if\(typeof toast==='function'\) toast\('캐릭터를 눌러 채워요'\); return false; \}/.test(pb) && /if\(!hit\)\{ if\(typeof toast==='function'\) toast\('얼굴을 눌러 채워요'\); return false; \}/.test(bf), '빈 곳을 페인트통으로 누르면 알린다(사람 · 동물)');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

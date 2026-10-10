/* ═══ 📦 sim-def-size.js — 캐릭터 디자인(def) 용량 상한 500KB (2026-10-10 신설) ═══════════════════════════
   방으로 보내는 def 한 벌(serializeDefForNetwork 결과)을 500KB 안으로. 키울 때(코드로 추가 · 아이템 켜기 ·
   책상 고르기 · 커미션 등록)와 [완료] 저장에서 막고, 보내는 순간에는 막지 않는다. 이미 넘은 옛 캐릭터는 그대로.
   ・1절: 상수 · UTF-8 바이트
   ・2절: 부분별 크기 — 큰 것부터 · 이름표 · 이름(커미션 · 책상 · 아이템) · 나머지는 «기타 설정» 한 줄
   ・3절: 안내 글 — 짧게 한 줄(가장 큰 것 하나) · 업로드 «파일이 너무 커요»
   ・4절: 키우기 · 저장 판정 — 밑이면 통과 · 넘게 키우면 막음 · 이미 넘은 옛 캐릭터는 줄거나 같으면 통과
   ・5절: 파일 하나 판정 — 남은 용량보다 크면 막음 · 맞으면 통과
   ・6절: app.js 의 실제 직렬화를 떼어 와 잰다 — 그림은 URL 자리표시(캔버스를 굽지 않음) · 섬네일 빠짐 · 콘솔 조용
   ・7절: app.js 배선 — [완료] · 아이템 켜기 · 책상 고르기 · 코드로 추가 · 커미션 등록 / html 순서
   [실행] def-size.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['def-size.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const win = {};
new Function('window', 'module', SRC['def-size.js'])(win, undefined);
const S = win.DefSize;
const A = SRC['app.js'];
const KB = 1024;
const blob = (n) => 'A'.repeat(n);   // base64 GLB 흉내 — n 바이트

say('── 1. 상수 · 바이트');
chk(S.DEF_MAX_BYTES === 500 * KB, 'DEF_MAX_BYTES = 500KB');
chk(S.utf8Bytes('abc') === 3 && S.utf8Bytes('별') === 3 && S.utf8Bytes('é') === 2 && S.utf8Bytes('😀') === 4, 'UTF-8 바이트(한글 3 · 이모지 4)');
chk(S.defBytes({ a: '별' }) === Buffer.byteLength(JSON.stringify({ a: '별' })), 'defBytes = JSON 의 UTF-8 바이트');
chk(S.defBytes(null) === 0, '없으면 0');

say('── 2. 부분별 크기');
const big = {
  type: 'creator', skin: 1, top: '#fff', bot: '#000', xf: { s: 1 },
  deskGlb: blob(410 * KB),
  customItems: { c1: { name: '별', glb: blob(150 * KB) }, c2: { name: '컵', glb: blob(30 * KB) } },
  commName: '토끼', commGlb: blob(60 * KB), isCommission: true,
  equippedParts: [{ id: 'hat1', xf: {} }],
};
const parts = S.breakdown(big, { deskGlb: 'desk.glb' });
chk(parts.map(p => p.key).slice(0, 4).join(',') === 'deskGlb,customItems.c1,commGlb,customItems.c2', '큰 것부터(책상 → 아이템 별 → 커미션 → 아이템 컵)');
chk(parts[0].label === '책상 3D' && parts[0].name === 'desk.glb', '책상 3D · 보관함 이름');
chk(parts[1].label === '아이템' && parts[1].name === '별', '아이템마다 따로 · 아이템 이름');
chk(parts[2].label === '캐릭터 3D' && parts[2].name === '토끼', '커미션은 «캐릭터 3D» · commName');
chk(parts.filter(p => p.key === '_etc').length === 1 && parts.find(p => p.key === '_etc').label === '기타 설정', '나머지 작은 칸은 «기타 설정» 한 줄');
chk(parts.some(p => p.key === 'equippedParts' && p.label === '꾸미기 파츠'), '꾸미기 파츠 이름표');
const sum = parts.reduce((s, p) => s + p.bytes, 0);
chk(Math.abs(sum - S.defBytes(big)) < 64, '부분 합 ≈ 전체(쉼표 · 괄호 몇 바이트 차이)');
chk(S.breakdown({ deskGlb: blob(10) })[0].name === '', '이름을 모르면 빈 이름');

say('── 3. 안내 글');
const om = S.overMessage(612 * KB, parts);
chk(om === '디자인 용량 초과 (612/500KB) — 가장 큰 것: 책상 3D ‘desk.glb’ 411KB', '초과: «디자인 용량 초과 (612/500KB) — 가장 큰 것: …» → ' + om);
chk(!/빼|바꿔|주세요/.test(om), '설명 문장 없이 짧게');
chk(S.overMessage(500 * KB + 1, []).indexOf('(501/500KB)') > 0, '조금 넘어도 «500/500» 이 아니라 올림');
const fm = S.fileMessage(410 * KB, 120 * KB + 900);
chk(fm === '파일이 너무 커요 (410KB · 남은 용량 120KB)', '업로드: «파일이 너무 커요 (410KB · 남은 용량 120KB)» → ' + fm);
chk(S.partText({ label: '책상 3D', name: '', bytes: 2 * KB }) === '책상 3D 2KB', '이름이 없으면 따옴표 없이');

say('── 4. 키우기 · 저장 판정');
const small = { type: 'creator', skin: 0, xf: { s: 1 } };
const r1 = S.checkGrowth(small, Object.assign({}, small, { deskGlb: blob(100 * KB) }));
chk(r1.ok, '500KB 밑이면 통과');
const grown = Object.assign({}, small, { deskGlb: blob(410 * KB), customItems: { c1: { name: '별', glb: blob(150 * KB) } } });
const r2 = S.checkGrowth(small, grown, { deskGlb: 'desk.glb' });
chk(!r2.ok && r2.bytes > 500 * KB, '넘게 키우면 막는다');
chk(/^디자인 용량 초과 \(\d+\/500KB\) — 가장 큰 것: 책상 3D ‘desk\.glb’ 411KB$/.test(r2.message || ''), '막을 때 가장 큰 것 이름 · 크기 → ' + r2.message);
const legacy = Object.assign({}, small, { commGlb: blob(520 * KB), commName: '옛 캐릭터' });
chk(S.checkGrowth(legacy, legacy).ok, '이미 넘은 옛 캐릭터 — 그대로 저장은 통과');
chk(S.checkGrowth(legacy, Object.assign({}, legacy, { commGlb: blob(510 * KB) })).ok, '이미 넘은 옛 캐릭터 — 줄이면 통과');
const lg = S.checkGrowth(legacy, Object.assign({}, legacy, { deskGlb: blob(5 * KB) }));
chk(!lg.ok && /캐릭터 3D ‘옛 캐릭터’/.test(lg.message), '이미 넘은 옛 캐릭터 — 더 키우면 막는다');
chk(S.checkGrowth(null, grown).ok === false && S.checkGrowth(null, small).ok === true, '새 캐릭터(before 없음)도 같은 기준');

say('── 5. 파일 하나 판정');
const rest = Object.assign({}, small, { deskGlb: blob(380 * KB) });
const f1 = S.checkFile(rest, 410 * KB);
chk(!f1.ok && /^파일이 너무 커요 \(410KB · 남은 용량 11\dKB\)$/.test(f1.message), '남은 용량보다 큰 파일은 막는다 → ' + f1.message);
chk(S.checkFile(rest, 50 * KB).ok, '남은 용량 안이면 통과');
chk(S.checkFile(small, 501 * KB).ok === false, '파일 하나만으로 500KB 를 넘으면 빈 디자인에서도 막는다');

say('── 6. 실제 직렬화(app.js)로 잰다');
function grabFn(name){
  const i = A.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let k = A.indexOf('{', i), d = 0;
  for(; k < A.length; k++){
    if(A[k] === '{') d++;
    else if(A[k] === '}' && --d === 0) return A.slice(i, k + 1);
  }
  return null;
}
const fSer = grabFn('serializeDefForNetwork'), fWire = grabFn('defWireForSize'), fDiag = grabFn('_defPayloadDiag');
const cUrl = /const _DEF_SIZE_URL = [\s\S]*?;\n/.exec(A), cImgs = /const _DEF_SIZE_IMGS = [\s\S]*?\]\];\n/.exec(A);
if(!fSer || !fWire || !fDiag || !cUrl || !cImgs){
  chk(false, 'serializeDefForNetwork · defWireForSize · _DEF_SIZE_URL · _DEF_SIZE_IMGS 를 못 찾음');
} else {
  const logs = [];
  const run = new Function('console',
    "const ROOM_FACE_SEND_DATAURL = false; const DESK_LICENSE_HOLD = 'deskLicenseHold'; const ITEM_LICENSE_HOLD = 'deskItemsLicenseHold';\n"
    + 'const DEF_DIAG_WARN_BYTES = 2048; let _defDiagLastSig = "";\n'
    + cUrl[0] + cImgs[0] + fDiag + '\n' + fSer + '\n' + fWire + '\nreturn { serializeDefForNetwork, defWireForSize };');
  const F = run({ log: (m) => logs.push(m), warn: (m) => logs.push(m) });
  let baked = 0;
  const canvas = { toDataURL(){ baked++; return 'data:image/png;base64,' + blob(200 * KB); } };
  const def = { type: 'creator', face: canvas, blink: canvas, thumb: 'data:' + blob(300 * KB), partXfMemory: { a: 1 },
    deskGlb: blob(100 * KB), customItems: { c1: { name: '별', glb: blob(10 * KB) } } };
  const w = F.defWireForSize(def);
  chk(baked === 0, '캔버스를 PNG 로 굽지 않는다');
  chk(w && !w.face && !w.blink && typeof w.faceUrl === 'string' && typeof w.blinkUrl === 'string', '얼굴 · 감은눈은 URL 자리표시로(실제로도 URL 만 나간다)');
  chk(w && !('thumb' in w) && !('partXfMemory' in w), '섬네일 · 편집 메모리는 빠진다(실제 전송과 같은 함수)');
  chk(w && w.deskGlb.length === 100 * KB && w.customItems.c1.glb.length === 10 * KB, '3D 파일은 그대로 잰다');
  const by = S.defBytes(w);
  chk(by > 110 * KB && by < 112 * KB, '재는 값 ≈ 3D 파일 + 작은 칸(' + Math.round(by / KB) + 'KB)');
  chk(logs.length === 0, '재기는 콘솔에 안 찍는다(quiet)');
  F.serializeDefForNetwork({ type: 'creator', deskGlb: blob(3 * KB) });
  chk(logs.length > 0, '실제 전송은 예전처럼 [def-diag] 를 찍는다');
  const animal = { type: 'creator', animal: true, face: canvas, animalBody: 'data:' + blob(50 * KB), animalBlink: 'data:' + blob(50 * KB) };
  const wa = F.defWireForSize(animal);
  chk(wa && !wa.animalBody && !wa.animalBlink && typeof wa.animalBodyUrl === 'string', '동물 페인트도 URL 자리표시로');
  const real = { type: 'creator', face: canvas, _faceUrl: 'https://x/real.png' };
  chk(F.defWireForSize(real).faceUrl === 'https://x/real.png', '이미 올린 URL 이 있으면 그것으로');
}

say('── 7. app.js 배선');
chk(/function _creatorBuildDef\(forSize\)\{/.test(A) && /const def=_creatorBuildDef\(false\);/.test(A), '[완료] 와 재기가 같은 함수(_creatorBuildDef)로 def 를 만든다');
{
  const done = (A.match(/document\.getElementById\('crDone'\)\.addEventListener\('click',\(\)=>\{[\s\S]*?toast\('수정했어요'\)/) || [''])[0];
  const g = done.indexOf('DefSize.checkGrowth(currentCreatorDef ? defWireForSize(currentCreatorDef) : null, defWireForSize(def)');
  chk(g > 0 && g < done.indexOf('applyCharToSeat(') && g < done.indexOf('saveSlots()'), '[완료] — 적용 · 저장 전에 원래 캐릭터와 견줘 막는다');
  chk(/if\(!_sz\.ok\)\{ _blankFaceConfirmed = false; toast\(_sz\.message, null, DEF_SIZE_TOAST_MS\); return; \}/.test(done), '[완료] — 막으면 생성기는 열린 채(return) · 빈 얼굴 확인은 되돌림');
}
chk(/if\(!on && !\(rec && rec\.fromCatalog\)\)\{\s*const _sz = _creatorSizeGrow\(d=>\{ d\.customItems = d\.customItems \|\| \{\}; d\.customItems\[def\.id\] = \{ name: def\.name, glb: def\.glb \}; \}\);\s*if\(!_sz\.ok\)\{ toast\(_sz\.message, null, DEF_SIZE_TOAST_MS\); return; \}\s*\}\s*equipDeskItem\(cBase,def,!on\);/.test(A), '아이템 켜기 — 장착 전에 잰다(카탈로그 아이템 · 끄기는 안 잼)');
chk(/if\(!rec\.fromCatalog\)\{\s*const _sz = _creatorSizeGrow\(d=>\{ d\.deskGlb = rec\.glb; delete d\.deskCatalogId; \}\);\s*if\(!_sz\.ok\)\{ toast\(_sz\.message, null, DEF_SIZE_TOAST_MS\); return; \}\s*\}\s*try\{ const sc=await parseGlbBytes\(b64ToBuf\(rec\.glb\)\);\s*cDeskTemplate=sc; cDeskGlbB64=rec\.glb;/.test(A), '책상 고르기 — 바꿔 끼우기 전에 잰다');
{
  const imp = (A.match(/document\.getElementById\('assetImpGo'\)\.onclick=async\(\)=>\{[\s\S]*?\n  \}catch\(e\)\{ toast\('추가 실패/) || [''])[0];
  const g = imp.indexOf('_defSizeFile(_rest, _add)');
  chk(g > 0 && g < imp.indexOf('savedDesks.push(rec)') && g < imp.indexOf('savedItems.push(rec)') && g < imp.indexOf('parseGlbFull('), '코드로 추가 — 보관함에 넣기 전에 파일 하나를 잰다');
  chk(/if\(kind==='desk'\)\{ delete _rest\.deskGlb; delete _rest\.deskCatalogId; \}/.test(imp), '코드로 추가(책상) — 지금 책상 자리를 비운 나머지와 견준다');
}
{
  const ci = A.indexOf('def.commGlb = payload.glb;'), g = A.indexOf('_defSizeFile(_rest, DefSize.jsonBytes(payload.glb) + 12)', ci), sv = A.indexOf('slots[idx]=def;', ci);
  chk(ci > 0 && g > ci && sv > g, '커미션 등록 — 슬롯에 넣기 전에 3D 파일을 잰다');
}
chk(/function serializeDefForNetwork\(def, opts\)\{/.test(A) && /if\(!_quiet\) _defPayloadDiag\(out\);/.test(A), '실제 전송 함수는 그대로 · 재기만 조용히');
chk(!/DefSize/.test(grabFn('serializeDefForNetwork') || 'DefSize'), '보내는 순간에는 막지 않는다(serializeDefForNetwork 에 판정 없음)');
{
  const H = SRC['desk-companion-prototype.html'];
  const a = H.indexOf('<script src="parts/def-size.js"></script>'), b = H.indexOf('<script src="parts/app.js"></script>');
  chk(a > 0 && b > a, 'html 이 def-size.js 를 app.js 앞에 싣는다');
}

say(`\n결과: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);

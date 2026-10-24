/* ═══ 🙂 sim-room-face-load.js — 방에서 받은 남의 얼굴 · 감은눈 그림 복원 ═══════════════════════
   [무엇을 지키나] deserializeDefFromNetwork 는 상대 def 의 faceUrl · blinkUrl 을 캔버스로 바꾼다. 감은눈만 못 받으면
     눈을 감을 때마다 피부만 보여 얼굴이 깜박이며 사라졌다 돌아온다 — 그때는 표정 그림을 감은눈 자리에 대신 쓴다.
   ・1절: 가짜 이미지 · 캔버스 위에서 실제로 돌린다 — 둘 다 받음 · 감은눈만 실패 · 얼굴도 실패 · 감은눈 dataURL 이 같이 옴
   ・2절: 일부러 깨 보기 — 대신 쓰는 줄을 빼면 빨강
   [실행] room-sync.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
const path = require('path');
function findUp(name){
  const stack = ['.'];
  while(stack.length){
    const d = stack.shift();
    const f = path.join(d, name);
    if(fs.existsSync(f)) return f;
    for(const e of fs.readdirSync(d, { withFileTypes: true })) if(e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) stack.push(path.join(d, e.name));
  }
  return null;
}
const SRC_PATH = findUp('room-sync.js');
const SRC = SRC_PATH ? fs.readFileSync(SRC_PATH, 'utf8') : '';

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
/* 꼭대기 함수 하나를 중괄호 짝으로 뗀다 */
function grabFn(src, head){
  const i = src.indexOf(head);
  if(i < 0) return null;
  let k = src.indexOf('{', i + head.length - 1), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  return null;
}

/* 받을 수 있는 주소 목록(ok)으로 한 번 돌려 out 을 돌려준다 */
async function run(fnSrc, def, ok){
  const mkCanvas = () => ({ kind: 'canvas', width: 512, height: 512, getContext: () => ({ drawImage(img){ this.c.from = img.src; }, c: null }) });
  const newCanvas = () => { const c = mkCanvas(); const x = c.getContext(); x.c = c; c.getContext = () => x; return c; };
  const _roomFaceUrlToCanvas = async (url) => { if(!ok.includes(url)) throw new Error('load fail'); const c = newCanvas(); c.from = url; return c; };
  const loadImg = async (s) => ({ src: s });
  const console = { warn(){}, log(){} };
  const f = new Function('_roomFaceUrlToCanvas', 'loadImg', 'newCanvas', 'console', fnSrc + '\nreturn deserializeDefFromNetwork;')(_roomFaceUrlToCanvas, loadImg, newCanvas, console);
  return f(def);
}
async function judge(fnSrc){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  if(!fnSrc){ t(false, 'room-sync.js 에서 deserializeDefFromNetwork 를 못 찾음'); return r; }
  try{
    const both = await run(fnSrc, { faceUrl: 'F', blinkUrl: 'B' }, ['F', 'B']);
    const noBlink = await run(fnSrc, { faceUrl: 'F', blinkUrl: 'B' }, ['F']);
    const none = await run(fnSrc, { faceUrl: 'F', blinkUrl: 'B' }, []);
    const blinkStr = await run(fnSrc, { faceUrl: 'F', blinkUrl: 'B', blink: 'data:B' }, ['F']);
    t(both.face && both.face.from === 'F' && both.blink && both.blink.from === 'B', '둘 다 받으면 — 얼굴 · 감은눈 각자 그림');
    t(noBlink.face && noBlink.blink === noBlink.face, '★ 감은눈만 못 받으면 — 표정 그림을 감은눈 자리에(눈 감을 때 맨얼굴 안 됨)');
    t(!none.face && !none.blink, '  둘 다 못 받으면 — 대신 쓸 것 없음(예전과 같다)');
    t(blinkStr.blink && blinkStr.blink !== blinkStr.face && blinkStr.blink.kind === 'canvas', '  감은눈 dataURL 이 같이 왔으면 — 그것으로(대신 쓰지 않음)');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  return r;
}

(async () => {
  if(!SRC_PATH) say('  ✗ room-sync.js 를 못 찾음');
  const F = grabFn(SRC, 'async function deserializeDefFromNetwork(def){');
  say('── 1. 받아 본다');
  (await judge(F)).forEach(([ok, msg]) => chk(ok, msg));
  say('── 2. 일부러 깨 보기');
  const m2 = F ? F.replace(/\n[^\n]*if\(!out\.blink && out\.face[^\n]*/, '') : F;
  const rows = m2 && m2 !== F ? await judge(m2) : [[true, '']];
  chk(m2 !== F && rows.some(([ok]) => !ok), '대신 쓰는 줄 없음' + (m2 !== F ? '' : ' — 바꿀 글을 못 찾음'));
  if(!SRC_PATH) fail++;
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

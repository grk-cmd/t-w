/* ═══ 🙂 sim-room-face-load.js — 방에서 받은 남의 얼굴 · 감은눈 그림 복원 ═══════════════════════
   [무엇을 지키나] deserializeDefFromNetwork 는 상대 def 의 faceUrl · blinkUrl 을 캔버스로 바꾼다. 감은눈만 못 받으면
     눈을 감을 때마다 피부만 보여 얼굴이 깜박이며 사라졌다 돌아온다 — 그때는 표정 그림을 감은눈 자리에 대신 쓴다.
   ・동물 그림(animal.js _texFromDataURL)도 처음 실패하면 한 번 더 받는다 · 깨 보기
   ・0절: 그림 받기 — 처음 실패하면 캐시를 비켜 한 번만 다시(dataURL 제외 · 두 번까지) · 깨 보기
   ・1절: 가짜 이미지 · 캔버스 위에서 실제로 돌린다 — 둘 다 받음 · 감은눈만 실패 · 얼굴도 실패 · 감은눈 dataURL 이 같이 옴
   ・2절: 일부러 깨 보기 — 대신 쓰는 줄 · 주소마다 한 번 막기를 빼면 빨강
   ・3절: 얼굴을 못 받은 def 는 «나중에 다시 풀 것» 으로 표시(retryDefAfter) · 동물 그림도 두 번 다 못 받으면 조금 뒤 몇 번 더 — 횟수 상한 · 깨 보기
   [실행] room-sync.js · animal.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
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
const ANIMAL_PATH = findUp('animal.js');
const RETRY_PATH = findUp('img-retry.js');
const TwImgRetry = (() => { const m = { exports: {} }; try{ new Function('window', 'module', fs.readFileSync(RETRY_PATH, 'utf8'))(undefined, m); }catch(_){} return m.exports; })();
const ANIMAL = ANIMAL_PATH ? fs.readFileSync(ANIMAL_PATH, 'utf8') : '';

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
let SRC_FOR_ONCE = SRC;
async function run(fnSrc, def, ok, again){
  const mkCanvas = () => ({ kind: 'canvas', width: 512, height: 512, getContext: () => ({ drawImage(img){ this.c.from = img.src; }, c: null }) });
  const newCanvas = () => { const c = mkCanvas(); const x = c.getContext(); x.c = c; c.getContext = () => x; return c; };
  const _roomFaceUrlToCanvas = async (url) => { if(!ok.includes(url)) throw new Error('load fail'); const c = newCanvas(); c.from = url; return c; };
  const loadImg = async (s) => ({ src: s });
  const console = { warn(){}, log(){} };
  const notes = [];
  const once = grabFn(SRC_FOR_ONCE, 'function _diagOnce(key, line){');
  const _diagOnce = new Function('diagNote', 'const _diagSeen = new Set();\n' + once + '\nreturn _diagOnce;')((m) => notes.push(m));
  const miss = new WeakSet();
  const f = new Function('_roomFaceUrlToCanvas', 'loadImg', 'newCanvas', 'console', '_diagOnce', '_faceMissDefs', fnSrc + '\nreturn deserializeDefFromNetwork;')(_roomFaceUrlToCanvas, loadImg, newCanvas, console, _diagOnce, miss);
  const out = await f(def);
  if(again) await f(def);   // 같은 멤버 def 를 다음 스냅샷에 또 푼다
  out._notes = notes;
  out._missed = miss.has(out);
  return out;
}
/* 얼굴 못 받은 def 표시 → retryDefAfter 가 기다릴 시간(횟수 · 간격은 img-retry.js) */
function judgeRetryAfter(src, fnSrc){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const ra = grabFn(src, 'function retryDefAfter(def, tries){');
  if(!ra){ t(false, 'room-sync.js 에서 retryDefAfter 를 못 찾음'); return Promise.resolve(r); }
  return (async () => {
    try{
      const miss = new WeakSet();
      const f = new Function('_faceMissDefs', 'TwImgRetry', ra + '\nreturn retryDefAfter;')(miss, TwImgRetry);
      const none = await run(fnSrc, { faceUrl: 'https://s.test/f.png' }, []);
      const got = await run(fnSrc, { faceUrl: 'https://s.test/f.png' }, ['https://s.test/f.png']);
      const noFace = await run(fnSrc, { skin: 1 }, []);
      t(none._missed && !got._missed && !noFace._missed, '★ 얼굴을 못 받은 def 만 «다시 풀 것» 표시(받음 · 얼굴 없는 def 는 아님)');
      const d = { faceUrl: 'https://s.test/f.png' }; miss.add(d);
      const waits = [0, 1, 2, 3].map((n) => f(d, n));
      t(waits[0] > 0 && waits[1] > waits[0] && waits[2] > waits[1] && waits[3] === null, '★ 다시 풀기는 점점 길게 세 번까지 — 네 번째는 그만(늘 받기 없음)');
      t(f({ faceUrl: 'https://s.test/f.png' }, 0) === null, '  표시 없는 def(얼굴 받음) — 다시 풀지 않는다');
      const dd = { faceUrl: 'data:image/png;base64,AA' }; miss.add(dd);
      t(f(dd, 0) === null && f(null, 0) === null, '  dataURL · 빈 def — 다시 풀지 않는다');
    }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
    return r;
  })();
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
    const twice = await run(fnSrc, { faceUrl: 'F', blinkUrl: 'B' }, [], true);
    t(twice._notes.length === 2, '★ 같은 주소를 스냅샷마다 또 못 받아도 진단 기록은 주소마다 한 번(올라타기 진단 줄이 밀려나지 않게)');
    t(noBlink._notes.length === 1 && /감은눈/.test(noBlink._notes[0]) && none._notes.length === 2 && both._notes.length === 0, '  못 받으면 진단 기록 한 줄씩(받으면 없음)');
    t(blinkStr.blink && blinkStr.blink !== blinkStr.face && blinkStr.blink.kind === 'canvas', '  감은눈 dataURL 이 같이 왔으면 — 그것으로(대신 쓰지 않음)');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  return r;
}

/* 그림 받기 — 처음 실패하면 캐시를 비켜(주소 뒤 표식) 한 번만 다시 받는다 */
async function judgeRetry(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const fns = [grabFn(src, 'async function _roomFaceUrlToCanvas(url){')];
  if(!fns.every(Boolean)){ t(false, '_roomFaceUrlToCanvas 를 못 찾음'); return r; }
  const mk = (failFirst) => {
    const tries = [];
    const _loadImgCors = async (u) => { tries.push(u); if(failFirst(u, tries.length)) throw new Error('cors'); return { naturalWidth: 4, naturalHeight: 4, src: u }; };
    const newCanvas = () => ({ width: 0, height: 0, getContext: () => ({ drawImage(){} }) });
    const f = new Function('_loadImgCors', 'newCanvas', 'TwImgRetry', fns.join('\n') + '\nreturn _roomFaceUrlToCanvas;')(_loadImgCors, newCanvas, TwImgRetry);
    return { f, tries };
  };
  try{
    const a = mk((u, n) => n === 1);
    const ca = await a.f('https://s.test/f.png?alt=media');
    t(ca && a.tries.length === 2 && /^https:\/\/s\.test\/f\.png\?alt=media&twr=1$/.test(a.tries[1]), '★ 처음 실패 → 주소 뒤 표식으로 한 번 더 받아 그린다');
    const b = mk(() => false); await b.f('https://s.test/f.png');
    t(b.tries.length === 1, '  처음에 받으면 다시 받지 않는다(요청 수 그대로)');
    const c = mk(() => true); let threw = false; try{ await c.f('https://s.test/f.png'); }catch(_){ threw = true; }
    t(threw && c.tries.length === 2, '  두 번 다 못 받으면 실패로 돌려준다(두 번까지만)');
    const d = mk(() => true); threw = false; try{ await d.f('data:image/png;base64,AA'); }catch(_){ threw = true; }
    t(threw && d.tries.length === 1, '  dataURL 은 다시 받지 않는다');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  return r;
}

/* 동물 페인트 그림(animal.js _texFromDataURL) — 같은 까닭으로 처음 실패하면 한 번만 다시 받는다 */
function judgeAnimalRetry(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const fn = grabFn(src, 'function _texFromDataURL(url, fallbackFill){');
  if(!fn){ t(false, 'animal.js 에서 _texFromDataURL 을 못 찾음'); return r; }
  const run = (url, failN) => {
    const srcs = [], timers = [];
    let warned = 0;
    function Image(){ const self = this; Object.defineProperty(this, 'src', { set(v){ srcs.push(v); if(srcs.length <= failN) self.onerror(); else self.onload(); }, get(){ return srcs[srcs.length - 1]; } }); }
    const setTimeout = (fn, ms) => { timers.push(ms); fn(); };
    const ctx = { fillRect(){}, drawImage(){}, set fillStyle(_){} };
    const document = { createElement: () => ({ getContext: () => ctx }) };
    const THREE = { CanvasTexture: function(){ this.needsUpdate = false; this.userData = {}; }, sRGBEncoding: 1 };   // 진짜 텍스처처럼 userData 가 있다(얼굴 복구가 twSrc · twFill 을 적는다)
    const console = { warn(){ warned++; }, log(){} };
    const diag = [];
    const window = { companion: { diagNote: (m) => diag.push(m) } };
    const companion = window.companion;
    const f = new Function('document', 'THREE', 'TwSafeHtml', 'TwImgRetry', 'Image', 'console', 'P_SZ', 'setTimeout', 'window', 'companion',
      fn + '\nconst _texDiagSeen = new Set();\n' + diagFn + '\nreturn _texFromDataURL;')(document, THREE, { safeUrl: (u) => u }, TwImgRetry, Image, console, 512, setTimeout, window, companion);
    const tex = f(url);
    return { srcs, warned, tex, timers, diag };
  };
  const diagFn = grabFn(src, 'function _texDiagOnce(url){');
  if(!diagFn){ t(false, 'animal.js 에서 _texDiagOnce 를 못 찾음'); return r; }
  const LATE = TwImgRetry.LATER_RETRY_MS || [];
  try{
    const a = run('https://s.test/a.png', 1);
    t(a.srcs.length === 2 && /\?twr=1$/.test(a.srcs[1]) && a.warned === 0 && a.tex.needsUpdate === true && !a.timers.length, '★ 동물 그림 — 처음 실패 → 한 번 더 받아 그린다(기다림 없음)');
    const late = run('https://s.test/a.png', 3);
    t(late.srcs.length === 4 && late.timers.length === 2 && late.tex.needsUpdate === true && late.warned === 0, '★ 두 번 다 실패해도 — 조금 뒤 다시 받아 흰 바탕을 그림으로 바꾼다');
    const b = run('https://s.test/a.png', 99);
    t(b.srcs.length === 2 + LATE.length && b.timers.join() === LATE.join() && b.warned === 1 && b.diag.length === 1 && b.tex.needsUpdate === false,
      '★ 끝내 못 받으면 — 나중 받기는 ' + LATE.length + '번까지만(점점 길게) · 콘솔 · 진단 기록에 한 줄');
    const c = run('data:image/png;base64,AA', 5);
    t(c.srcs.length === 1 && !c.timers.length, '  dataURL 은 다시 받지 않는다');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  return r;
}

(async () => {
  if(!SRC_PATH) say('  ✗ room-sync.js 를 못 찾음');
  say('── 동물 그림 다시 받기');
  judgeAnimalRetry(ANIMAL).forEach(([ok, msg]) => chk(ok, msg));
  {
    const a2 = ANIMAL.replace('if(again){ load(again); return; }', '');
    const rows = a2 !== ANIMAL ? judgeAnimalRetry(a2) : [[true, '']];
    chk(a2 !== ANIMAL && rows.some(([ok]) => !ok), '깨 보기 — 동물 그림 다시 받기를 끄면 빨강' + (a2 !== ANIMAL ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say('── 0. 그림 받기 다시 시도');
  (await judgeRetry(SRC)).forEach(([ok, msg]) => chk(ok, msg));
  {
    const s2 = SRC.replace('const img = await TwImgRetry.loadWithRetry(_loadImgCors, url);', 'const img = await _loadImgCors(url);');
    const rows = s2 !== SRC ? await judgeRetry(s2) : [[true, '']];
    chk(s2 !== SRC && rows.some(([ok]) => !ok), '깨 보기 — 다시 받는 줄을 빼면 빨강' + (s2 !== SRC ? '' : ' — 바꿀 글을 못 찾음'));
  }
  const F = grabFn(SRC, 'async function deserializeDefFromNetwork(def){');
  say('── 1. 받아 본다');
  (await judge(F)).forEach(([ok, msg]) => chk(ok, msg));
  say('── 2. 일부러 깨 보기');
  {
    SRC_FOR_ONCE = SRC.replace('if(_diagSeen.has(key)) return; ', '');
    const rows = SRC_FOR_ONCE !== SRC ? await judge(F) : [[true, '']];
    chk(SRC_FOR_ONCE !== SRC && rows.some(([ok]) => !ok), '깨 보기 — 주소마다 한 번 막기를 빼면 빨강' + (SRC_FOR_ONCE !== SRC ? '' : ' — 바꿀 글을 못 찾음'));
    SRC_FOR_ONCE = SRC;
  }
  say('── 3. 얼굴 못 받은 def — 나중에 다시 풀 것');
  (await judgeRetryAfter(SRC, F)).forEach(([ok, msg]) => chk(ok, msg));
  {
    const F2 = F.replace(/\n[^\n]*_faceMissDefs\.add\(out\);/, '');
    const rows = F2 !== F ? await judgeRetryAfter(SRC, F2) : [[true, '']];
    chk(F2 !== F && rows.some(([ok]) => !ok), '깨 보기 — 못 받은 표시를 빼면 빨강' + (F2 !== F ? '' : ' — 바꿀 글을 못 찾음'));
    const a3 = ANIMAL.replace("if(wait!==null){ late++; setTimeout(()=>load(u), wait); return; }", '');
    const rows3 = a3 !== ANIMAL ? judgeAnimalRetry(a3) : [[true, '']];
    chk(a3 !== ANIMAL && rows3.some(([ok]) => !ok), '깨 보기 — 동물 그림 나중 받기를 빼면 빨강' + (a3 !== ANIMAL ? '' : ' — 바꿀 글을 못 찾음'));
    const a4 = ANIMAL.replace("const wait=TwImgRetry.laterRetryMs(u, late);", 'const wait=1000;');
    const rows4 = a4 !== ANIMAL ? (() => { try{ return judgeAnimalRetry(a4); }catch(_){ return [[false, '']]; } })() : [[true, '']];
    chk(a4 !== ANIMAL && rows4.some(([ok]) => !ok), '깨 보기 — 나중 받기 횟수 상한을 빼면 빨강' + (a4 !== ANIMAL ? '' : ' — 바꿀 글을 못 찾음'));
  }
  const m2 = F ? F.replace(/\n[^\n]*if\(!out\.blink && out\.face[^\n]*/, '') : F;
  const rows = m2 && m2 !== F ? await judge(m2) : [[true, '']];
  chk(m2 !== F && rows.some(([ok]) => !ok), '대신 쓰는 줄 없음' + (m2 !== F ? '' : ' — 바꿀 글을 못 찾음'));
  if(!SRC_PATH) fail++;
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

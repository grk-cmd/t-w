/* ═══ 🎨 sim-creator-canvas.js — 생성기 그림판(creator/creator-canvas.js · app.js 분리 M20) ═══════════════
   ・1절: 되돌리기 — 지금 그리는 캔버스(표정 · 감은눈) · pushHistory(상한 30 · redo 폐기) · undo · redo · blit
   ・2절: 단추 연결 — ↶ 되돌리기 · 감은눈 초기화 · 표정 복사(막는 경우 · 되돌릴 자리를 먼저 남김) · 지우기 · 대칭
   ・3절: 피부 — SKIN_PNGS 가 없으면 안내 · 있으면 불러와 skinCanvases 에 · 전부 실패하면 안내
   ・4절: 연결 — deps 모양 · 옛 이름 · 만드는 줄
   ・5절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const depPairs = (APP, mod, glob, create) => { const m = APP.match(new RegExp('const ' + mod + ' = ' + glob + '\\.' + create + '\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')); return m ? m[1].split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(x => [x[1], x[2]]) : null; };
const SRC = read('creator/creator-canvas.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음'); process.exit(2); }
function mkCtx(name, log){
  return { fillStyle: '', _n: name, clearRect: () => log.push(name + ':clear'), drawImage: (src) => log.push(name + ':draw:' + (src && src._n || '?')), getImageData: () => ({ tok: name + '#' + (++mkCtx.n) }), putImageData: (d) => log.push(name + ':put:' + d.tok), fillRect(){}, createImageData: () => ({ data: [] }) };
}
mkCtx.n = 0;
function mkCanvas(name, log){ const ctx = mkCtx(name, log); return { _n: name, width: 0, height: 0, getContext: () => ctx, ctx }; }
function build(src, o){
  o = o || {};
  const log = [], L = {}, toasts = [];
  const elProxy = (id) => { const t = { id, parentNode: { insertBefore(){}, appendChild(){}, removeChild(){} }, insertBefore(){}, style: {}, classList: { add(){}, remove(){}, toggle(){}, contains: () => false }, children: [], value: '#000000', dataset: {}, appendChild(c){ this.children.push(c); return c; },
    addEventListener(ev, fn){ L[id + ':' + ev] = fn; }, click(){ log.push('click:' + id); }, setPointerCapture(){}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }), querySelectorAll: () => [] }; return new Proxy(t, { get: (x, k) => (k in x ? x[k] : () => undefined), set: (x, k, v) => { x[k] = v; return true; } }); };
  const els = {}; const doc = { getElementById: (id) => (els[id] = els[id] || elProxy(id)), createElement: (tag) => (tag === 'canvas' ? mkCanvas('c' + (++mkCtx.n), log) : elProxy(tag)), addEventListener: () => {}, body: elProxy('body') };
  const st = { step: o.step || 2 };
  const crState = new Proxy({ crStep: st.step, skinIndex: 0, blinkEdited: o.blinkEdited || false, symmetry: false, stampMode: false, eraser: false, brushColor: '#000', brushSize: 8, crPaintTool: null }, { get: (t, k) => t[k], set: (t, k, v) => { t[k] = v; return true; } });
  const faceC = mkCanvas('face', log), blinkC = mkCanvas('blink', log), dispC = mkCanvas('disp', log);
  const skinCanvases = [mkCanvas('s0', log), mkCanvas('s1', log)];
  const win = { SKIN_PNGS: o.skins, openCharColorPicker: () => log.push('picker') };
  const deps = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({})) });
  Object.assign(deps, { bindHold: () => {}, openCharColorPicker: () => log.push('picker'), blinkC, camTarget: () => ({ set(){} }), CANVAS_SZ: 512, cBodyCenter: () => ({}), cFaceCenter: () => ({}), creatorOpen: () => true, creatorPrevMod: () => ({ crFlatView: null }),
    crStampMod: { setStampMode: (v) => log.push('stamp:' + v), loadStampFromFile(){}, commitStamp(){}, cancelStamp(){}, resetStampPlacement(){} }, crState, dispC, dispTex: { needsUpdate: false }, faceC, newCanvas: () => mkCanvas('n' + (++mkCtx.n), log),
    paintStrokeMod: { paintAt: () => log.push('paint') }, SKIN_COLORS: ['#fff', '#eee'], skinCanvases, skinCanvasFor: (i) => skinCanvases[i] || skinCanvases[0], toast: (m) => toasts.push(m), wardrobeMod: {} });
  Object.assign(deps, o.deps || {});
  const g = { window: win, document: doc, TwSafeHtml: { cssColor: (c) => c }, Image: o.Image || class { set src(v){ setTimeout(() => this.onload && this.onload(), 0); } }, console: { log(){}, warn: (...a) => log.push('warn'), error(){} }, setTimeout, module: undefined, THREE: {}, requestAnimationFrame: () => 0, navigator: {}, localStorage: {}, addEventListener: () => {}, removeEventListener: () => {}, innerWidth: 1000, innerHeight: 800, performance: { now: () => 0 } };
  const names = Object.keys(g);
  new Function(...names, src)(...names.map(n => g[n]));
  const mod = win.TwCreatorCanvas.createCreatorCanvas(deps);
  return { mod, log, L, toasts, crState, faceC, blinkC, dispC, skinCanvases, deps, win };
}
const pending = [];
say('§1 되돌리기');
{
  const b = build(SRC, { step: 2 });
  chk(b.mod.isDrawStep() === true && (b.crState.crStep = 1, b.mod.isDrawStep() === false) && (b.crState.crStep = 3, b.mod.isDrawStep() === true) && (b.crState.crStep = 4, b.mod.isDrawStep() === false), '그리는 단계는 2(표정) · 3(감은눈)');
  b.crState.crStep = 2; chk(b.mod.actC() === b.faceC, '2단계에 그리는 캔버스는 표정');
  b.crState.crStep = 3; chk(b.mod.actC() === b.blinkC, '3단계는 감은눈');
  b.crState.crStep = 2; b.mod.pushHistory(); b.mod.pushHistory();
  chk(b.mod.histF.length === 2 && b.mod.histB.length === 0, '표정 기록은 histF · 감은눈 기록은 histB 에 따로 쌓인다');
  for(let i = 0; i < 40; i++) b.mod.pushHistory();
  chk(b.mod.histF.length === 30, '★ 기록 상한 30(넘으면 가장 오래된 것을 버린다)');
  b.mod.redoF.push({ tok: 'r' }); b.mod.pushHistory();
  chk(b.mod.redoF.length === 0, '새 그리기는 다시 하기 목록을 비운다');
  const before = b.mod.histF[b.mod.histF.length - 1];
  b.log.length = 0; b.dispC.ctx; 
  // undo
  b.crState.crStep = 2;
  b.mod.pushHistory(); const top = b.mod.histF[b.mod.histF.length - 1]; const h = b.mod.histF.length - 1;
  b.log.length = 0;
  // undo 는 모듈 안 함수 — ↶ 버튼으로 부른다
  b.L['undoBtn:click']();
  chk(b.mod.histF.length === h && b.mod.redoF.length === 1 && b.log.some(l => l === 'face:put:' + top.tok), '↶ — 마지막 기록으로 되돌리고(putImageData) 지금 상태는 다시 하기에 쌓는다');
  chk(b.log.includes('disp:clear') && b.log.some(l => l.startsWith('disp:draw:')) && b.deps.dispTex.needsUpdate === true, '되돌린 뒤 합성 텍스처를 다시 만든다(blit — 피부 위에 그림 · needsUpdate)');
  const b2 = build(SRC, {}); b2.L['undoBtn:click']();
  chk(b2.log.filter(l => l.includes(':put:')).length === 0, '기록이 없으면 아무 일 없음');
  b2.crState.crStep = 3; b2.mod.pushHistory();
  chk(b2.mod.histB.length === 1 && b2.mod.histF.length === 0, '3단계 기록은 histB');
}
say('§2 단추');
{
  const b = build(SRC, { step: 3, blinkEdited: true });
  b.L['blinkResetBtn:click']();
  chk(b.mod.histB.length === 1 && b.crState.blinkEdited === false && b.log.includes('blink:clear') && b.log.includes('blink:draw:face'), '감은눈 초기화(3단계) — 되돌릴 자리를 남기고 표정을 복사 · blinkEdited false');
  const b1 = build(SRC, { step: 2 }); b1.L['blinkResetBtn:click']();
  chk(b1.mod.histB.length === 0 && !b1.log.includes('blink:clear'), '3단계가 아니면 아무 일 없음');
  const c = build(SRC, { step: 2, blinkEdited: false }); c.L['faceCopyBlinkBtn:click']();
  chk(c.toasts.length === 1 && c.toasts[0].includes('감은눈을 그린 적이 없어요') && c.mod.histF.length === 0 && !c.log.includes('face:clear'), '★ 감은눈을 안 그렸으면 표정 덮어쓰기를 막고 안내(표정이 통째로 지워지는 걸 방지)');
  const d = build(SRC, { step: 2, blinkEdited: true }); d.L['faceCopyBlinkBtn:click']();
  chk(d.mod.histF.length === 1 && d.log.includes('face:clear') && d.log.includes('face:draw:blink') && d.crState.blinkEdited === true, '표정 복사 — 되돌릴 자리를 먼저 남기고 감은눈으로 덮는다 · blinkEdited 는 건드리지 않음');
  const e = build(SRC, { step: 3, blinkEdited: true }); e.L['faceCopyBlinkBtn:click']();
  chk(e.mod.histF.length === 0, '2단계가 아니면 표정 복사 안 함');
  const f = build(SRC, { step: 2 }); f.L['symBtn:click']({ currentTarget: { classList: { toggle(){} } }, target: { classList: { toggle(){} } } });
  chk(f.crState.symmetry === true, '대칭 단추 — symmetry 를 뒤집는다');
  const g = build(SRC, { step: 2 }); g.L['clearBtn:click']();
  chk(g.mod.histF.length === 1 && g.log.includes('face:clear'), '지우기 — 되돌릴 자리를 남기고 그림 레이어를 지운다');
  const s = build(SRC, {}); s.L['stampBtn:click']();
  chk(s.log.includes('stamp:true'), '도장 단추 — 도장 모드 켬');
}
say('§3 피부');
{
  const b = build(SRC, { skins: undefined });
  const p = b.mod.loadSkins();
  chk(p && typeof p.then === 'function' && b.toasts.length === 1 && b.toasts[0].includes('피부 텍스처를 불러오지 못했어요') && b.log.includes('warn'), 'SKIN_PNGS 가 없으면 콘솔 경고 + 안내 · 던지지 않는다');
  const ok = build(SRC, { skins: { 1: 'data:png' } });
  const before = ok.skinCanvases[1];
  return_(ok.mod.loadSkins().then(() => { chk(ok.skinCanvases[1] !== before && ok.toasts.length === 0, '불러오면 skinCanvases[번호] 를 새 캔버스로 갈아 끼운다 · 안내 없음'); }));
  const bad = build(SRC, { skins: { 0: 'x', 1: 'y' }, Image: class { set src(v){ setTimeout(() => this.onerror && this.onerror(), 0); } } });
  return_(bad.mod.loadSkins().then(() => { chk(bad.toasts.length === 1 && bad.log.filter(l => l === 'warn').length >= 2, '전부 실패하면 안내 한 번 · 개수 경고'); }));
}
function return_(p){ pending.push(p); }
say('§4 연결');
{
  const iM = HTML.indexOf('<script src="parts/creator/creator-canvas.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
  chk(iM > 0 && iA > iM, 'html — creator-canvas.js 를 app.js 보다 먼저 싣는다');
  const code = stripC(APP);
  const pairs = depPairs(APP, 'creatorCanvasMod', 'TwCreatorCanvas', 'createCreatorCanvas');
  const READ = ['camTarget', 'cBodyCenter', 'cFaceCenter', 'creatorOpen', 'creatorPrevMod'], FN = ['bindHold', 'toast'];
  const shape = (n, v) => n === 'openCharColorPicker' ? v === '(...a)=>window.openCharColorPicker(...a)' : READ.includes(n) ? v === '()=>' + n : FN.includes(n) ? v === '(...a)=>' + n + '(...a)' : v === n;
  chk(!!pairs && pairs.length === 21 && pairs.every(([n, v]) => shape(n, v)), '★ deps 21개 모양 — 읽는 함수 다섯 · 함수 셋(window 고리 하나 포함) · 값 나머지' + (pairs ? ' (' + pairs.length + '개)' : ''));
  const bad = pairs ? pairs.map(([n, v]) => n === 'camTarget' ? [n, 'camTarget'] : [n, v]) : [];
  chk(!bad.every(([n, v]) => shape(n, v)), '  깨 보기: 읽는 함수를 값으로 넘기면 빨강');
  chk(['_crDropEraser', 'histF', 'histB', 'redoF', 'redoB', 'isDrawStep', 'actC', 'blit', 'pushHistory', 'bindPaint', 'swEl', '_syncCrColorSwatches', 'loadSkins'].every(n => new RegExp('^const ' + n + ' = creatorCanvasMod\\.' + n + ';', 'm').test(code)), '옛 이름 열셋을 const 로 받는다');
  chk(!/function (pushHistory|undo|redo|blit|bindPaint|loadSkins|actC)\b/.test(code), '본문이 app.js 에 안 남음');
}
say('§5 일부러 깨 보기');
{
  const brk = (a, c) => { const m = SRC.replace(a, c); return m === SRC ? null : m; };
  const m1 = brk("if(h.length>30)h.shift();", "");
  chk(!!m1 && (() => { const b = build(m1, { step: 2 }); for(let i = 0; i < 40; i++) b.mod.pushHistory(); return b.mod.histF.length !== 30; })(), '기록 상한을 빼면 빨강');
  const m2 = brk("curRedo().length=0;", "");
  chk(!!m2 && (() => { const b = build(m2, { step: 2 }); b.mod.redoF.push({}); b.mod.pushHistory(); return b.mod.redoF.length !== 0; })(), '다시 하기 폐기를 빼면 빨강');
  const m3 = brk("if(!crState.blinkEdited){ toast(", "if(false){ toast(");
  chk(!!m3 && (() => { const b = build(m3, { step: 2, blinkEdited: false }); b.L['faceCopyBlinkBtn:click'](); return b.toasts.length === 0 && b.log.includes('face:clear'); })(), '감은눈 없을 때 표정 덮어쓰기 막기를 빼면 빨강');
  const m4 = brk("pushHistory();   // 표정은 원본이라 덮어쓰기 전에 반드시 되돌릴 자리를 남긴다", "");
  chk(!!m4 && (() => { const b = build(m4, { step: 2, blinkEdited: true }); b.L['faceCopyBlinkBtn:click'](); return b.mod.histF.length === 0; })(), '덮어쓰기 전 되돌릴 자리를 안 남기면 빨강');
  const m5 = brk("dispTex.needsUpdate=true;}", "}");
  chk(!!m5 && (() => { const b = build(m5, { step: 2 }); b.mod.pushHistory(); b.L['undoBtn:click'](); return b.deps.dispTex.needsUpdate !== true; })(), '텍스처 갱신 표시를 빼면 빨강');
}
Promise.all(pending).then(() => { say(''); say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0); });

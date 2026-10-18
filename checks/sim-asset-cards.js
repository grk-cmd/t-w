/* sim-asset-cards.js — 🃏 자산 카드 공용(creator/asset-cards.js) 동작 · 연결
   실행:  node sim-asset-cards.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 생성기 책상 세팅과 꾸미기가 같은 카드 · 썸네일 · 순서 손잡이를 쓴다. app.js 에서 모듈로 옮겼으니(C 구역 떼기 w4)
     가짜 DOM 위에서 돌려 고정한다.
   ・1절: swThumb — 상자 · 이름 · 켜짐 / 고름 색 · × 지우기(카드 클릭으로 번지지 않음)
   ・2절: applyDeskDotThumb — 배포 썸네일 우선 · 굽기(한 번만 · 실패 기억) · GLB 없음 · 이모지만 걷고 버튼은 둠 · 겹쳐 넣지 않음
   ・3절: bindReorderHandle — 좌클릭만 · 끄는 동안 흐림 · 다른 카드 위 점선 · 놓으면 onDrop(나, 대상) · 정리 · 4절: 연결 · 5절: 깨 보기 */
'use strict';
globalThis.TwSafeHtml = require([__dirname, process.cwd()].flatMap(d => ['safe-html.js', 'parts/shared/safe-html.js', 'app/parts/shared/safe-html.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));   // 🛡️ 모듈이 부르는 공용 씻기 — 진짜 파일
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('creator/asset-cards.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — asset-cards.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); };

function mkDoc() {
  const docL = {};
  let fromPoint = null;
  function el(tag) {
    const L = {};
    const e = { tag, style: {}, dataset: {}, childNodes: [], parentNode: null, className: '', textContent: '', src: '', draggable: true,
      get firstChild() { return this.childNodes[0] || null; },
      appendChild(c) { c.parentNode = this; this.childNodes.push(c); return c; }, insertBefore(c, ref) { c.parentNode = this; const i = ref ? this.childNodes.indexOf(ref) : -1; if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c); return c; },
      removeChild(c) { this.childNodes = this.childNodes.filter((x) => x !== c); c.parentNode = null; },
      querySelector(sel) { const m = /^img\.(.+)$/.exec(sel); const walk = (n) => { for (const k of n.childNodes) { if (m && k.tag === 'img' && k.className === m[1]) return k; const r = k.childNodes ? walk(k) : null; if (r) return r; } return null; }; return walk(this); },
      closest(sel) { for (let q = this; q; q = q.parentNode) if (sel === '[data-reorder-id]' && q.dataset && q.dataset.reorderId) return q; return null; },
      addEventListener(t, f) { (L[t] = L[t] || []).push(f); }, fire(t, ev) { (L[t] || []).forEach((f) => f(ev)); } };
    Object.defineProperty(e, 'textContent', { get() { return e._t || ''; }, set(v) { e._t = v; if (tag === 'div' && v) e.childNodes = [{ nodeType: 3, data: v }].concat(e.childNodes.filter((n) => n.nodeType !== 3)); } });
    e.nodeType = 1;
    return e;
  }
  const doc = { createElement: el, elementFromPoint: () => fromPoint, addEventListener: (t, f) => { (docL[t] = docL[t] || []).push(f); }, removeEventListener: (t, f) => { docL[t] = (docL[t] || []).filter((x) => x !== f); } };
  return { doc, el, docL, setPoint: (e) => { fromPoint = e; }, fireDoc: (t, ev) => (docL[t] || []).slice().forEach((f) => f(ev)) };
}
function make(src, o = {}) {
  const D = mkDoc(); const win = {}; const log = { gen: [] };
  const T = new Function('window', 'document', 'module', src + '\nreturn window.TwAssetCards;')(win, D.doc, undefined);
  const out = T.createAssetCards({ partSceneMod: () => ({ generatePartThumbnail: (rec) => { log.gen.push(rec.id); return o.genFail ? Promise.reject(new Error('x')) : Promise.resolve(o.genNull ? null : 'data:image/png;base64,gen' + rec.id); } }) });
  return { out, D, win, log };
}

async function behave(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = null, err = null;
  try { w = make(src); } catch (e) { err = e; }
  t(!err && w && Object.keys(w.out).sort().join() === 'applyDeskDotThumb,bindReorderHandle,swThumb', '만들 때 던지지 않고 셋을 내놓는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!w) return r;
  let c = w.out.swThumb('책상', false, '🪑');
  const box = c.firstChild, cap = c.childNodes[1];
  t(box && box.textContent === '🪑' && cap.textContent === '책상' && /#0002/.test(box.style.cssText) && /#fffc/.test(box.style.cssText) && box.childNodes.length === 1, 'swThumb — 아이콘 상자 · 이름 · 꺼짐 색 · 지우기 없음');
  const on = w.out.swThumb('a', true, 'x').firstChild.style.cssText, act = w.out.swThumb('a', true, 'x', null, true).firstChild.style.cssText;
  t(/#7ba05b/.test(on) && /#eef3e6/.test(on) && /#e0842a/.test(act) && /#fbebd9/.test(act), 'swThumb — 켜짐은 초록 · 고름(active)은 주황이 먼저');
  let del = 0, stopped = false;
  c = w.out.swThumb('b', false, 'y', () => { del++; });
  const x = c.firstChild.childNodes.find((n) => n.textContent === '×');
  x.onclick({ stopPropagation() { stopped = true; } });
  t(x && del === 1 && stopped, 'swThumb — × 를 누르면 지우기만(카드 클릭으로 번지지 않게 stopPropagation)');

  /* 도트 썸네일 */
  const card = (w2) => { const k = w2.out.swThumb('i', false, '📦'); const btn = w2.D.el('div'); btn.textContent = '×'; k.firstChild.appendChild(btn); return k; };
  w = make(src); c = card(w);
  w.out.applyDeskDotThumb({ id: 'r1', thumbUrl: 'https://t/1.png' }, c);
  const img = c.firstChild.childNodes[0];
  t(img && img.tag === 'img' && img.className === 'desk-dot-thumb' && img.src === 'https://t/1.png' && !img.draggable && !c.firstChild.childNodes.some((n) => n.nodeType === 3) && c.firstChild.childNodes.some((n) => n.textContent === '×') && !w.log.gen.length && w.win._deskThumbCache.r1 === 'https://t/1.png',
    '배포 썸네일(thumbUrl)이 있으면 그것을 — 이모지만 걷고 버튼은 둔다 · 굽지 않음 · 캐시');
  w.out.applyDeskDotThumb({ id: 'r1', thumbUrl: 'https://t/1.png' }, c);
  t(c.firstChild.childNodes.filter((n) => n.tag === 'img').length === 1, '같은 카드에 두 번 불러도 그림은 하나');
  w = make(src); c = card(w);
  w.out.applyDeskDotThumb({ id: 'g1', glb: 'G' }, c); const pend = w.win._deskThumbCache.g1;
  w.out.applyDeskDotThumb({ id: 'g1', glb: 'G' }, card(w));
  await flush();
  t(pend === 'pending' && w.log.gen.length === 1 && w.win._deskThumbCache.g1 === 'data:image/png;base64,geng1' && c.firstChild.childNodes[0].src === 'data:image/png;base64,geng1', 'GLB 로 굽기 — 굽는 동안(pending)은 다시 굽지 않는다 · 다 구우면 캐시 · 카드에 얹기');
  const c2 = card(w); w.out.applyDeskDotThumb({ id: 'g1', glb: 'G' }, c2);
  t(c2.firstChild.childNodes[0].src === 'data:image/png;base64,geng1' && w.log.gen.length === 1, '구운 data URL 은 캐시에서 바로');
  w = make(src, { genFail: true }); c = card(w); w.out.applyDeskDotThumb({ id: 'f1', glbUrl: 'u' }, c); await flush();
  w.out.applyDeskDotThumb({ id: 'f1', glbUrl: 'u' }, c); await flush();
  const w2 = make(src); w2.out.applyDeskDotThumb({ id: 'n1' }, card(w2));
  const w3 = make(src, { genNull: true }); w3.out.applyDeskDotThumb({ id: 'z1', glb: 'G' }, card(w3)); await flush();
  t(w.win._deskThumbCache.f1 === 'fail' && w.log.gen.length === 1 && w2.win._deskThumbCache.n1 === 'fail' && !w2.log.gen.length && w3.win._deskThumbCache.z1 === 'fail' && c.firstChild.childNodes.some((n) => n.nodeType === 3),
    '굽기 실패 · GLB 없음 · 빈 결과는 fail 로 기억하고 다시 굽지 않는다(이모지 그대로)');
  let threw = false; try { w.out.applyDeskDotThumb(null, c); w.out.applyDeskDotThumb({ id: 'q' }, null); w.out.applyDeskDotThumb({ id: 'q' }, { firstChild: null }); } catch (_) { threw = true; }
  t(!threw, '입구 전제 — 기록 · 카드 · 아이콘 상자가 없으면 조용히');

  /* 순서 손잡이 */
  w = make(src);
  const mk = (id) => { const k = w.D.el('div'); k.dataset.reorderId = id; return k; };
  const A = mk('A'), B = mk('B'), handle = w.D.el('div'); A.appendChild(handle);
  const drops = [];
  w.out.bindReorderHandle(handle, A, 'A', (a, b) => drops.push([a, b]));
  let prevented = false;
  handle.fire('pointerdown', { button: 2, preventDefault() { prevented = true; }, stopPropagation() {} });
  t(handle.style.touchAction === 'none' && !prevented && A.style.opacity === undefined, '오른쪽 · 가운데 단추는 무시 · 터치 제스처 막기');
  handle.fire('pointerdown', { button: 0, preventDefault() {}, stopPropagation() {} });
  const dim = A.style.opacity;
  const inner = w.D.el('span'); B.appendChild(inner); w.D.setPoint(inner); w.D.fireDoc('pointermove', { clientX: 1, clientY: 1 });
  const dashed = B.style.outline;
  w.D.setPoint(A); w.D.fireDoc('pointermove', { clientX: 2, clientY: 2 });
  const selfOff = B.style.outline, selfDash = A.style.outline;
  w.D.setPoint(inner); w.D.fireDoc('pointermove', { clientX: 1, clientY: 1 }); w.D.fireDoc('pointerup', {});
  t(dim === '.4' && dashed === '2px dashed #7ba05b' && selfOff === '' && selfDash !== '2px dashed #7ba05b' && JSON.stringify(drops) === '[["A","B"]]' && A.style.opacity === '1' && B.style.outline === '' && !(w.D.docL.pointermove || []).length,
    '끌기 — 흐리게 · 다른 카드 위 점선(자기 위는 없음) · 놓으면 onDrop(나, 대상) · 원래대로 · 리스너 정리');
  handle.fire('pointerdown', { button: 0, preventDefault() {}, stopPropagation() {} }); w.D.setPoint(null); w.D.fireDoc('pointermove', {}); w.D.fireDoc('pointercancel', {});
  t(drops.length === 1 && A.style.opacity === '1', '카드 밖에서 놓거나 취소하면 onDrop 없음');
  return r;
}

function wire(app, html) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app);
  t(!/function swThumb\b|function applyDeskDotThumb\b|function bindReorderHandle\b/.test(A), 'app.js 에 옮긴 선언이 안 남았다');
  t(/const assetCardsMod = TwAssetCards\.createAssetCards\(\{\n  partSceneMod: \(\)=>partSceneMod,\n\}\);/.test(app), '만드는 줄(가드 없이) · deps 1(읽는 함수 partSceneMod)');
  t(/  swThumb: \(\.\.\.a\)=>assetCardsMod\.swThumb\(\.\.\.a\),/.test(app) && /  bindReorderHandle: \(\.\.\.a\)=>assetCardsMod\.bindReorderHandle\(\.\.\.a\),/.test(app), '꾸미기(wardrobe)에도 assetCardsMod 의 함수를 넘긴다');
  const iM = html.indexOf('<script src="parts/creator/asset-cards.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — creator/asset-cards.js 를 app.js 보다 먼저 싣는다');
  return r;
}

(async () => {
  const B = await behave(MOD);
  B.forEach(([ok, msg], i) => { const s = { 0: '── 1. swThumb', 4: '── 2. applyDeskDotThumb', 10: '── 3. bindReorderHandle' }; if (s[i]) say(s[i]); chk(ok, msg); });
  say('── 4. app.js 연결');
  wire(APP, HTML).forEach(([ok, msg]) => chk(ok, msg));
  chk(!SMOKE || /PRELOAD\.push\('asset-cards\.js'\);/.test(SMOKE), 'smoke 가 asset-cards.js 를 먼저 싣는다');
  say('── 5. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['× 가 번짐', (m) => m.replace('x.onclick=e=>{ e.stopPropagation(); onDelete(); };', 'x.onclick=e=>{ onDelete(); };'), null, null],
    ['고름 색이 켜짐 색에 밀림', (m) => m.replace("const borderColor = active ? '#e0842a' : (on?'#7ba05b':'#0002');", "const borderColor = on ? '#7ba05b' : (active?'#e0842a':'#0002');"), null, null],
    ['pending 무시', (m) => m.replace("if(v==='pending' || v==='fail') return;", "if(v==='fail') return;"), null, null],
    ['배포 썸네일 무시', (m) => m.replace('const _t = rec.thumbUrl || rec.thumbnail;', 'const _t = null;'), null, null],
    ['버튼까지 걷음', (m) => m.replace('if(n.nodeType===3) box.removeChild(n);', 'box.removeChild(n);'), null, null],
    ['오른쪽 단추도 받음', (m) => m.replace('if(e.button!==0) return;', ''), null, null],
    ['자기 위에도 점선', (m) => m.replace("if(card && card.dataset.reorderId!==id){", 'if(card){'), null, null],
    ['만들 때 던짐', (m) => m.replace('function createAssetCards(deps){', 'function createAssetCards(deps){ throw new Error("깨 봄");'), null, null],
    ['app.js 에 본문이 남음', null, (a) => a + '\nfunction swThumb(){}', null],
    ['html 줄 빠짐', null, null, (h) => h.replace('<script src="parts/creator/asset-cards.js"></script>', '')],
  ];
  for (const [name, fm, fa, fh] of breaks) {
    const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(APP) : APP, h2 = fh ? fh(HTML) : HTML;
    const changed = m2 !== MOD || a2 !== APP || h2 !== HTML;
    let rows; try { rows = (fm ? await behave(m2) : []).concat(wire(a2, h2)); } catch (_) { rows = [[false, '던짐']]; }
    chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 자산 카드는 creator/asset-cards.js 에서'));
  process.exit(fail ? 1 : 0);
})();

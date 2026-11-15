/* ═══ 🧯 sim-gl-context.js — 3D 장치 만들기 한 곳(shared/gl-context.js · app.js 분리 F1) ═══════════════
   ・1절: preview — 성공은 그대로 돌려줌 · 실패는 던지지 않고 null · 실패 번호 E-SYS-06 · 그 캔버스 칸 안에 안내 · [다시 시도] · 같은 캔버스 안내는 하나 · 성공하면 안내를 지움 · 칸 없는 캔버스는 번호만
   ・2절: main — 만들기를 guard 에 맡기고 던지면 그대로 던진다(옛 동작: 안내 뒤 멈춤)
   ・3절: 연결 — `new THREE.WebGLRenderer` 는 gl-context.js 밖에 없다(개발용 fx-preview.html 만 뺀다) · 여덟 곳이 preview 로 만들고 못 만들면 돌아간다 · html 순서 · 실패 번호 표
   ・4절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const depPairs = (APP, mod, glob, create) => { const m = APP.match(new RegExp('const ' + mod + ' = ' + glob + '\\.' + create + '\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')); return m ? m[1].split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(x => [x[1], x[2]]) : null; };
const SRC = read('shared/gl-context.js'), HTML = read('desk-companion-prototype.html'), ERR = read('shared/error-codes.js');
if(!SRC || !HTML || !ERR){ say('  ? 원본 못 찾음'); process.exit(2); }
function mkEl(tag){
  const el = { tag, children: [], attrs: {}, style: { cssText: '' }, parentElement: null, id: '', className: '', textContent: '', _l: {},
    setAttribute(k, v){ this.attrs[k] = v; }, getAttribute(k){ return k in this.attrs ? this.attrs[k] : null; },
    appendChild(c){ c.parentElement = this; this.children.push(c); return c; },
    remove(){ if(this.parentElement){ this.parentElement.children = this.parentElement.children.filter(x => x !== this); this.parentElement = null; } },
    querySelectorAll(sel){ const cls = sel.replace('.', ''); return this.children.filter(c => c.className === cls); },
    addEventListener(ev, fn){ this._l[ev] = fn; } };
  return el;
}
function build(src, o){
  o = o || {};
  const win = {}, calls = [], errs = [];
  new Function('window', 'module', 'document', src)(win, undefined, {});
  const doc = { createElement: (t) => mkEl(t), defaultView: null };
  const g = win.TwGlContext.createGlContext({ doc, makeRenderer: (opts) => { calls.push(opts); if(o.fail) throw new Error('no gl'); return { r: 1, opts }; }, notifyError: (c, e) => errs.push([c, e && e.message]), note: (m) => calls.push('note:' + m) });
  return { g, calls, errs, mkEl };
}
function canvasIn(id){ const p = mkEl('div'); const c = mkEl('canvas'); c.id = id; p.appendChild(c); return { p, c }; }
say('§1 preview');
{
  let b = build(SRC, {}); let { p, c } = canvasIn('cv1');
  const r = b.g.make(c, { canvas: c }, 'preview', { label: 'x' });
  chk(r && r.r === 1 && b.errs.length === 0 && p.children.length === 1, '만들면 렌더러를 그대로 돌려주고 안내 · 번호는 없다');
  b = build(SRC, { fail: true }); ({ p, c } = canvasIn('cv1'));
  let retried = 0; let out; let threw = null;
  try{ out = b.g.make(c, {}, 'preview', { label: '런처', retry: () => { retried++; } }); }catch(e){ threw = e; }
  chk(!threw && out === null, '★ 못 만들어도 던지지 않고 null 을 돌려준다(창을 여는 함수가 중간에 안 멈춘다)');
  chk(b.errs.length === 1 && b.errs[0][0] === 'E-SYS-06' && b.errs[0][1] === 'no gl', '실패 번호 E-SYS-06 + 원래 오류로 알린다');
  const note = p.children.find(x => x.className === 'gl-ctx-notice');
  chk(!!note && note.children[0].textContent === '3D 미리보기를 불러오지 못했어요' && note.getAttribute('data-for') === 'cv1', '그 캔버스를 감싼 칸 안에 안내가 선다');
  chk(note && note.children[1] && note.children[1].textContent === '다시 시도', '[다시 시도] 단추');
  b.g.make(c, {}, 'preview', {}); 
  chk(p.children.filter(x => x.className === 'gl-ctx-notice').length === 1, '같은 캔버스에 다시 실패해도 안내는 하나(새로 바꿈)');
  const n2 = p.children.find(x => x.className === 'gl-ctx-notice'); chk(n2.children.length === 1, '  retry 가 없으면 단추가 없다');
  b.g.make(c, {}, 'preview', { retry: () => { retried++; } });
  const n3 = p.children.find(x => x.className === 'gl-ctx-notice'); n3.children[1]._l.click({ stopPropagation(){} });
  chk(retried === 1 && !p.children.some(x => x.className === 'gl-ctx-notice'), '[다시 시도] 를 누르면 안내를 지우고 retry 를 부른다');
  const bp = build(SRC, { fail: true }); const cp = canvasIn('cv9'); let rr = 0; bp.g.make(cp.c, {}, 'preview', { retry: () => { rr++; } });
  const np = cp.p.children.find(x => x.className === 'gl-ctx-notice');
  chk(/pointer-events:none/.test(np.style.cssText) && /pointer-events:auto/.test(np.children[1].style.cssText), '★ 안내 상자는 클릭을 아래로 보낸다(pointer-events:none) — 글 · 단추만 받는다(런처 빈 칸 · 미리보기 · 종족 카드가 막히지 않게)');
  let stopped = 0; np.children[1]._l.click({ stopPropagation(){ stopped++; } });
  chk(stopped === 1 && rr === 1, '[다시 시도] 클릭은 위로 퍼지지 않는다(stopPropagation) — 종족 카드 클릭으로 새지 않음');
  const bb = build(SRC, { fail: true }); const orphan = mkEl('canvas');
  chk(bb.g.make(orphan, {}, 'preview', {}) === null && bb.errs.length === 1, '칸이 없는(화면에 안 붙은) 캔버스는 안내 없이 번호만 · null');
  // 성공하면 옛 안내를 지운다
  const bs = build(SRC, { fail: true }); const cc = canvasIn('cv2'); bs.g.make(cc.c, {}, 'preview', {});
  const ok = build(SRC, {}).g; const stale = cc.p.children.find(x => x.className === 'gl-ctx-notice');
  ok.make(cc.c, {}, 'preview', {});
  chk(!!stale && !cc.p.children.some(x => x.className === 'gl-ctx-notice'), '다시 만들어 성공하면 남아 있던 안내를 지운다');
}
say('§2 main');
{
  const b = build(SRC, {}); let guarded = 0;
  const r = b.g.make(null, { a: 1 }, 'main', { guard: (fn) => { guarded++; return fn(); } });
  chk(guarded === 1 && r && r.opts.a === 1 && b.errs.length === 0, 'main — 만들기를 guard 에 맡기고 결과를 그대로 돌려준다(번호 · 안내는 guard 몫)');
  const f = build(SRC, { fail: true }); let th = null;
  try{ f.g.make(null, {}, 'main', { guard: (fn) => fn() }); }catch(e){ th = e; }
  chk(!!th && f.errs.length === 0, 'main — 못 만들면 던진다(옛 동작: 안내 뒤 멈춤 — 미리보기 번호를 내지 않는다)');
}
say('§3 연결');
{
  const dir = ['app/parts', 'parts', '.'].find(d => fs.existsSync(d) && fs.readdirSync(d).length);
  const files = [];
  (function walk(d){ for(const n of fs.readdirSync(d)){ const f = d + '/' + n; const s = fs.statSync(f); if(s.isDirectory()){ if(n !== 'vendor' && n !== 'node_modules') walk(f); } else if(/\.js$/.test(n)) files.push(f); } })(dir);
  const hits = files.filter(f => /new THREE\.WebGLRenderer\(/.test(fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')));
  chk(hits.length === 1 && /gl-context\.js$/.test(hits[0]) || (hits.length === 1 && hits[0].endsWith('gl-context.js')), '★ new THREE.WebGLRenderer 는 gl-context.js 한 곳에만 있다' + (hits.length === 1 ? '' : ' — ' + hits.join(', ')));
  const SITES = [['creator/race-picker.js', 'if(!r) return;'], ['creator/creator-preview.js', 'if(!r) return false;'], ['launcher/launcher-preview.js', 'if(!r)return;'], ['character/wardrobe.js', 'if(!r) return;'], ['character/animal.js', 'if(!r) return;'], ['character/part-scene.js', 'if(!r) return;'], ['purikura/purikura-ui.js', 'if(!r) return;']];
  for(const [f, guard] of SITES){
    const t = read(f); const n = (t.match(/TwGlContext\.make\(/g) || []).length;
    chk(!!t && n >= 1 && /'preview'/.test(t) && (t.match(/if\(!r\) ?return(?: false)?;/g) || []).length >= n, f + ' — preview 로 만들고 못 만들면 돌아간다(' + n + '곳)');
  }
  chk((read('shared/stage.js') || '').includes("TwGlContext.make(canvas,{canvas,antialias:_renderAA,alpha:true,premultipliedAlpha:false,logarithmicDepthBuffer:true},'main',{ guard: glFail.guard })"), 'stage.js — 메인은 main 역할 + glFail.guard 로(옛 동작 그대로)');
  const AN = read('character/animal.js'), iMk = AN.indexOf("'동물 생성기'"), iOpen = AN.indexOf('creatorOpen = true;', AN.indexOf('function openPreview'));
  chk(iMk > 0 && iOpen > iMk && /if\(!openPreview\(\)\) return;/.test(AN), '동물 생성기 — 3D 를 창 · 런처 · 창 크기를 바꾸기 전에 만들고, 못 만들면 false 로 돌아가 부르는 쪽도 멈춘다');
  const PU = read('purikura/purikura-ui.js');
  chk(!/retry:\(\)=>\{ _pkBuildStage/.test(PU), '스티커사진 — 루프를 못 거는 [다시 시도] 는 두지 않는다(무대 없는 방장의 촬영은 사용자 결정 대기 — PR 본문)');
  chk(read('app.js').includes('if(!creatorPrevMod.ensureCreatorPreview()) return;'), 'app.js openCreator — 3D 를 못 만들면 열지 않는다');
  const iG = HTML.indexOf('<script src="parts/shared/gl-context.js">'), iS = HTML.indexOf('<script src="parts/shared/stage.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
  chk(iG > 0 && iG < iA && iG < iS, 'html — gl-context.js 를 stage.js · app.js 보다 먼저 싣는다');
  chk(/'E-SYS-06': \{ msg: '3D 미리보기를/.test(ERR), '실패 번호 E-SYS-06 이 표에 있다');
}
say('§4 일부러 깨 보기');
{
  const brk = (a, c) => { const m = SRC.replace(a, c); return m === SRC ? null : m; };
  const m1 = brk("showNotice(canvas, extra.retry);\n      return null;", "return null;");
  chk(!!m1 && (() => { const b = build(m1, { fail: true }); const { p, c } = canvasIn('z'); b.g.make(c, {}, 'preview', {}); return p.children.length === 1; })(), '안내를 안 그리면 빨강');
  const m2 = brk("    }catch(err){", "    }catch(err){ throw err;");
  chk(!!m2 && (() => { try{ build(m2, { fail: true }).g.make(canvasIn('z').c, {}, 'preview', {}); return false; }catch(_){ return true; } })(), '던지게 두면 빨강');
  const m3 = brk("dropNotice(canvas);\n      return r;", "return r;");
  chk(!!m3 && (() => { const bf = build(m3, { fail: true }); const cc = canvasIn('q'); bf.g.make(cc.c, {}, 'preview', {}); build(m3, {}).g.make(cc.c, {}, 'preview', {}); return cc.p.children.some(x => x.className === 'gl-ctx-notice'); })(), '성공해도 옛 안내를 안 지우면 빨강');
}
say(''); say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0);

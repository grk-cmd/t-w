/* ═══ 🎨 sim-commission-import.js — 🎨 커미션 캐릭터 코드 입력 모듈 (2026-10-16 신설 · C 구역 떼기 · w3) ═══════════════
   app.js 의 커미션 캐릭터 코드 입력 을 parts/creator/commission-import.js 로 옮겼다(글자 그대로 · 바뀐 줄 6 — 읽는 · 쓰는 함수로 바꾼 자리).
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(없음)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 만드는 줄 · deps 15줄 그대로 · 부르는 곳은 commImpMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   ・4절: 동작 — 가짜 DOM · deps 로 모듈을 만들어 입력 → 결과(경계값 포함)를 본다
   [실행] app.js · desk-companion-prototype.html · commission-import.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
globalThis.TwSafeHtml = require([__dirname, process.cwd()].flatMap(d => ['safe-html.js', 'parts/shared/safe-html.js', 'app/parts/shared/safe-html.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));   // 🛡️ 모듈이 부르는 공용 씻기 — 진짜 파일
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["commission-import.js","parts/creator/commission-import.js","app/parts/creator/commission-import.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — commission-import.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["charDef","openCreator","renderLauncher","saveCurSlot","toast"];
const VAL_DEPS = ["CANVAS_SZ","creatorSaveMod","racePickerMod","slots"];
const GET_DEPS = ["charCodeMod","charsMod","commissionMod","curSlot","slotSaveMod"];
const SET_DEPS = ["curSlot"];
const EXPORTS = [];
const MOVED = ["commImpOverlay","dataUrlToCanvas"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  CANVAS_SZ: CANVAS_SZ,","  charCodeMod: ()=>charCodeMod,","  charDef: (...a)=>charDef(...a),","  charsMod: ()=>charsMod,","  commissionMod: ()=>commissionMod,","  creatorSaveMod: creatorSaveMod,","  curSlot: ()=>curSlot,","  openCreator: (...a)=>openCreator(...a),","  racePickerMod: racePickerMod,","  renderLauncher: (...a)=>renderLauncher(...a),","  saveCurSlot: (...a)=>saveCurSlot(...a),","  slotSaveMod: ()=>slotSaveMod,","  slots: slots,","  toast: (...a)=>toast(...a),","  setCurSlot: (v)=>{ curSlot = v; },"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다. */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
/* over: deps 덮어쓰기 · env: 전역 덮어쓰기(document · window · THREE …) */
function build(src, over, env){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  Object.assign(deps, over || {});
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const E = Object.assign({ window: win, document: any, localStorage: ls, navigator: any, firebaseAPI: any, companion: any, setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => {}, clearInterval: () => {},
    requestAnimationFrame: () => 0, THREE: any, addEventListener: () => {}, removeEventListener: () => {}, module: undefined, MutationObserver: class { observe(){} disconnect(){} }, ResizeObserver: class { observe(){} disconnect(){} },
    performance: { now: () => 0 }, console: { log(){}, warn(){}, error(){} }, Image: any, confirm: () => true, devicePixelRatio: 1 }, env || {});
  const keys = Object.keys(E);
  const api = new Function(...keys, src + '\nreturn window.TwCommissionImport;')(...keys.map(k => E[k]));
  return api.createCommissionImport(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwCommissionImport = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwCommissionImport(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(app.includes("const commImpMod = TwCommissionImport.createCommissionImport({"), '만드는 줄(가드 없이 — 모듈은 늘 싣는다)');
  const mk = (app.match(new RegExp("const commImpMod = TwCommissionImport\\.createCommissionImport\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);")) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(new RegExp("const commImpMod = [\\s\\S]*?\\n\\}\\);"), '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));
  t(!bare.length, '부르는 곳은 commImpMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/creator/commission-import.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/creator/commission-import.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/creator/commission-import.js"></script>', '')],
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const commImpMod = TwCommissionImport.createCommissionImport({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const commImpMod = TwCommissionImport.createCommissionImport({", "const commImpMod = TwCommissionImport.createCommissionImport({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwCommissionImport = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* 내놓는 이름이 없다 — «부르는 곳이 옛 이름» 깨 보기는 해당 없음 */
  ['만들 때 던짐', m => m.replace('function createCommissionImport(deps){', 'function createCommissionImport(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [nm, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), nm + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('── 4. 동작');
/* 동작 검사용 작은 가짜 DOM — id 로 찾은 요소를 기억하고 style · classList · onclick · 이벤트를 받는다. */
function fakeDom(absent){   // absent: 처음엔 없는(코드가 만들어 붙이는) id 목록
  const gone = new Set(absent || []);
  const els = {};
  const mkEl = (id, tag) => {
    const cls = new Set();
    const ev = {};
    const el = {
      id: id || '', tagName: (tag || 'div').toUpperCase(), style: {}, dataset: {}, textContent: '', innerHTML: '', value: '', title: '', disabled: false, children: [], parentElement: null,
      classList: { add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), contains: (c) => cls.has(c), toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; v ? cls.add(c) : cls.delete(c); return v; } },
      addEventListener: (t, f) => { (ev[t] = ev[t] || []).push(f); }, removeEventListener: () => {},
      appendChild: (c) => { el.children.push(c); c.parentElement = el; if(c.id) els[c.id] = c; return c; },
      getContext: () => new Proxy({}, { get: () => () => {} }), querySelector: () => null, querySelectorAll: () => [],
      fire: (t, e) => { (ev[t] || []).forEach(f => f(Object.assign({ stopPropagation(){}, preventDefault(){}, currentTarget: el }, e || {}))); },
      click: () => { if(typeof el.onclick === 'function') el.onclick({ stopPropagation(){}, preventDefault(){}, currentTarget: el }); el.fire('click'); },
    };
    return el;
  };
  const docEv = {};
  const document = {
    getElementById: (id) => els[id] || (gone.has(id) ? null : (els[id] = mkEl(id))),
    createElement: (tag) => mkEl('', tag),
    querySelector: (s) => els['q:' + s] || (els['q:' + s] = mkEl('q:' + s)),
    querySelectorAll: () => [],
    addEventListener: (t, f) => { (docEv[t] = docEv[t] || []).push(f); },
    removeEventListener: () => {},
    body: mkEl('body'),
    fire: (t) => (docEv[t] || []).forEach(f => f({})),
  };
  return { document, els, mkEl };
}

/* 커미션 코드 입력 — 코드 머리글자 갈래 · 칸 고르기 · 등록 결과를 가짜 DOM · 서버 없이 본다 */
function rigI(o){
  o = o || {};
  const D = fakeDom();
  const slots = o.slots || [null, null, null];
  const st = { cur: 0 }; const calls = [];
  const log = (n) => (...a) => { calls.push([n, ...a]); };
  const over = { CANVAS_SZ: 8, slots,
    racePickerMod: { _raceTargetSlot: () => (o.target === undefined ? null : o.target) },
    charCodeMod: () => ({ importCloneCode: async (c, p, t) => { calls.push(['clone', c, p, t]); return !!o.cloneOk; } }),
    commissionMod: () => ({ decryptCommission: async (c, p) => { if(o.badPass) throw new Error('bad'); return o.payload || { t: 'comm', name: '고양이', glb: 'GLB', face: 'data:image/png;base64,Zg==', blink: 'data:image/png;base64,Yg==' }; } }),
    creatorSaveMod: { _defSizeFile: (rest, bytes) => (calls.push(['size', rest, bytes]), o.tooBig ? { ok: false, message: '너무 커요' } : { ok: true }), DEF_SIZE_TOAST_MS: 4000 },
    charsMod: () => ({ _charsBoxFull: () => !!o.boxFull, _charsOnNew: log('onNew') }), slotSaveMod: () => ({ saveSlots: log('save') }),
    curSlot: () => st.cur, setCurSlot: (v) => { st.cur = v; }, saveCurSlot: log('saveCur'), renderLauncher: log('render'),
    toast: log('toast'), openCreator: log('creator'), charDef: (skin, f, b, top, bot) => ({ skin, face: f, blink: b, top, bot }) };
  class Img { set src(v){ this._s = v; setImmediate(() => o.imgFail ? this.onerror() : this.onload()); } }
  const env = { document: D.document, Image: Img, DefSize: { jsonBytes: (s) => String(s).length + 2 },
    window: { crypto: o.noCrypto ? undefined : { subtle: {} } }, crypto: o.noCrypto ? undefined : { subtle: {} } };
  const api = build(MOD, over, env);
  const el = (id) => D.document.getElementById(id);
  const go = async (code, pass) => { el('commImpCode').value = code; el('commImpPass').value = pass; el('commImpGo').onclick(); for(let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };
  return { D, st, api, calls, slots, el, go, n: (k) => calls.filter(c => c[0] === k).length, last: (k) => (calls.filter(c => c[0] === k).pop() || [])[1] };
}
(async () => {
  { const r = rigI(); const p = r.el('raceCommCodePanel'); p.style.display = 'none'; r.el('commImpCode').value = 'x';
    r.el('raceCommCode').onclick(); chk(p.style.display === 'block' && r.el('commImpCode').value === '', '[코드로 등록] — 패널을 열고 입력칸을 비운다');
    r.el('raceCommCode').onclick(); chk(p.style.display === 'none', '다시 누르면 닫는다');
    p.style.display = 'block'; r.el('commImpCancel').onclick(); chk(p.style.display === 'none', '[취소] — 닫는다'); }
  { const r = rigI(); await r.go('', 'pw'); chk(r.last('toast') === '코드와 비밀번호를 입력해 주세요', '코드나 비밀번호가 비면 안내'); }
  { const r = rigI({ slots: ['a', 'b'] }); await r.go('DCM1.x', 'pw'); chk(r.last('toast') === '캐릭터가 모두 찼습니다', '칸이 다 찼으면 안내'); }
  { const r = rigI({ target: 2, cloneOk: true }); r.el('raceOverlay').classList.add('on');
    await r.go('DCC1.abc', 'pw');
    const c = r.calls.find(x => x[0] === 'clone');
    chk(c && c[3] === 2 && !r.el('raceOverlay').classList.contains('on'), 'DCC1(복제 코드) — [＋] 칸 번호로 importCloneCode · 성공하면 창 닫기');
    const r2 = rigI({ cloneOk: false }); r2.el('raceOverlay').classList.add('on'); await r2.go('DCC1.abc', 'pw');
    chk(r2.el('raceOverlay').classList.contains('on') && r2.n('save') === 0, 'DCC1 실패 — 창은 그대로'); }
  { const r = rigI(); await r.go('DCK1.zz', 'pw'); chk(/생성기 안의 \[코드로 추가하기\]/.test(r.last('toast')) && r.n('save') === 0, 'DCK1(책상 · 아이템) — 어디로 가야 하는지 안내만'); }
  { const r = rigI(); await r.go('hello', 'pw'); chk(/코드 형식이 아니에요/.test(r.last('toast')), '머리글자가 셋 다 아니면 «코드 형식이 아니에요»(암호 문제가 아니다)'); }
  { const r = rigI({ noCrypto: true }); await r.go('DCM1.x', 'pw'); chk(r.last('toast') === '이 환경에선 복호화를 쓸 수 없어요', '복호화를 못 쓰는 환경이면 안내'); }
  { const r = rigI({ target: 1 }); await r.go('DCM1.x', 'pw');
    const d = r.slots[1];
    chk(d && d.isCommission && d.commName === '고양이' && d.commGlb === 'GLB' && JSON.stringify(d.xf) === '{"s":0.7,"y":0,"z":0,"rot":0,"x":0}' && d.top === '#ffffff', 'DCM1 — [＋] 칸에 커미션 캐릭터(이름 · GLB · 기본 xf · 흰 옷)');
    chk(r.st.cur === 1 && r.n('save') === 1 && r.n('onNew') === 1 && r.n('render') === 1 && /"고양이" 캐릭터를 등록했어요/.test(r.last('toast')), '현재 칸 · 저장 · 보관함 번호 · 런처 다시 그림 · 안내');
    chk(JSON.stringify(r.last('creator')) === '{"kind":"slot","edit":true,"slot":1}', '바로 생성기(수정 모드 — 커미션은 책상부터)');
    const sz = r.calls.find(x => x[0] === 'size'); chk(sz && !('commGlb' in sz[1]) && sz[2] === 'GLB'.length + 2 + 12, '용량 — GLB 를 뺀 나머지에 GLB 바이트(+12)를 더해 잰다'); }
  { const r = rigI({ slots: ['a', null, null], target: 0 }); await r.go('DCM1.x', 'pw');
    chk(r.slots[0] === 'a' && r.slots[1] && r.slots[1].isCommission, '[＋] 칸이 이미 차 있으면 첫 빈 칸으로(덮어쓰지 않는다)'); }
  { const r = rigI({ payload: { t: 'clone' } }); await r.go('DCM1.x', 'pw');
    chk(/비밀번호를 확인해 주세요/.test(r.last('toast')) && r.n('save') === 0, '풀린 내용이 커미션이 아니면 실패 안내'); }
  { const r = rigI({ badPass: true }); await r.go('DCM1.x', 'pw');
    chk(r.last('toast') === '등록 실패: 비밀번호를 확인해 주세요 (코드 형식은 맞아요)', '암호가 틀리면 «코드 형식은 맞아요» 를 붙여 안내'); }
  { const r = rigI({ tooBig: true }); await r.go('DCM1.x', 'pw');
    chk(r.last('toast') === '너무 커요' && !r.slots.some(Boolean), '디자인 용량을 넘으면 등록 안 함'); }
  { const r = rigI({ boxFull: true }); await r.go('DCM1.x', 'pw'); chk(!r.slots.some(Boolean) && r.n('save') === 0, '보관함 문턱이 차면 등록 안 함'); }
  { const r = rigI({ imgFail: true }); await r.go('DCM1.x', 'pw'); chk(/비밀번호를 확인해 주세요/.test(r.last('toast')) && !r.slots.some(Boolean), '얼굴 그림을 못 읽으면 실패로 끝(칸은 그대로)'); }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
return;

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

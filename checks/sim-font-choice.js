/* ═══ 🔤 sim-font-choice.js — 창 글꼴 고르기(기본 · 돋움 · 나눔고딕 + 👑 내 PC 글꼴) ═══════════════════════════════
   ・1절: 규칙(font-choice.js) — 저장값 씻기 · PC 글꼴 이름 씻기(CSS 글자를 깨지 못하게) · 값 → 글꼴 목록(없는 PC 는 기본으로 떨어짐) · 깨 보기
   ・2절: 걸기(font-ui.js) — 창 글씨 토큰 둘만(머리 위 --tw-font-classic 은 안 건드림) · 기본이면 걷는다 · PC 글꼴은 프리미엄만(끝나면 기본 · 값은 남김) · 열린 자식 창 다시 옮김
   ・3절: 설정 칸 — 세 줄 + 고른 PC 글꼴 줄(✕) · 누르면 저장 · 프리미엄 아니면 잠금 안내 · PC 글꼴 상자(목록 · 찾기 · 고르기 · 못 읽으면 E-SYS-03 · 이름 직접 쓰기)
   ・4절: 배선 — html 싣는 순서 · app.js 가 테마 뒤에서 만들고 바로 건다 · 프리미엄이 바뀌면 초대 게이트 한 곳에서 다시
   [실행] node checks/run.js font-choice */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (names) => { for(const d of [__dirname, process.cwd()]) for(const n of names){ const p = path.join(d, n); if(fs.existsSync(p)) return p; } return null; };
const read = (names) => { const p = find(names); return p ? fs.readFileSync(p, 'utf8') : null; };
const P_FC = find(['font-choice.js', 'parts/shared/font-choice.js']);
const SRC = { ui: read(['font-ui.js', 'parts/shared/font-ui.js']), html: read(['desk-companion-prototype.html']), app: read(['app.js', 'parts/app.js']), gate: read(['license-gate.js', 'parts/account/license-gate.js']) };
if(!P_FC || Object.values(SRC).some(v => v == null)){ say('  ? 원본 못 찾음 — font-choice.js · ' + Object.keys(SRC).filter(k => SRC[k] == null).join(' · ')); process.exit(2); }
const FC = require(P_FC);
const FC_SRC = fs.readFileSync(P_FC, 'utf8');
globalThis.TwFontChoice = FC;

say('── 1. 규칙');
chk(FC.norm('dotum') === 'dotum' && FC.norm('nanum') === 'nanum' && FC.norm('base') === 'base' && FC.norm('evil') === 'base' && FC.norm(null) === 'base' && FC.norm('pc:') === 'base',
  '저장값 — 세 가지 · pc:이름 만 · 모르는 값 · 빈 PC 이름은 기본');
chk(FC.cleanFamily("Bad'; } body{x:1} \"Font") === 'Bad bodyx:1 Font' && FC.cleanFamily('나눔손글씨 펜') === '나눔손글씨 펜' && FC.cleanFamily('a'.repeat(99)).length === 60,
  '★ PC 글꼴 이름 — 따옴표 · ; { } < > · 역슬래시를 버린다(CSS 글자를 못 깬다) · 한글 이름은 그대로 · 60자');
chk(FC.cssFor('base') === null && FC.cssFor('dotum') === "'Dotum','돋움'," + FC.BASE_TAIL && FC.cssFor('pc:나눔손글씨 펜') === "'나눔손글씨 펜'," + FC.BASE_TAIL,
  '값 → 목록 — 기본은 null(안 바꿈) · 고른 글꼴 뒤에 늘 기본 목록(없는 PC 는 기본으로 떨어진다)');
chk(/'NanumGothic'/.test(FC.cssFor('nanum')) && FC.label('nanum') === '나눔고딕' && FC.label('pc:Consolas') === 'Consolas' && FC.label('x') === '기본', '나눔고딕 · 이름표');
chk(JSON.stringify(FC.TOKENS) === '["--win-font","--tw-font-legacy"]', '★ 바꾸는 토큰은 창 글씨 둘뿐(머리 위 --tw-font-classic 은 그대로)');
{ const broke = FC_SRC.replace(".replace(/[\\u0000-\\u001f'\"\\\\;{}<>]/g, '')", '');
  const m = { exports: {} }; new Function('module', 'window', broke)(m, undefined);
  chk(broke !== FC_SRC && /'/.test(m.exports.cleanFamily("a'b")), '  깨 보기 — 씻는 줄을 빼면 따옴표가 남는다'); }

/* ── 가짜 DOM ── */
function mkEl(id){
  const L = {}, cls = new Set(), props = {};
  const o = { id: id || '', style: { setProperty: (k, v) => { props[k] = v; }, removeProperty: (k) => { delete props[k]; }, _p: props }, value: '', textContent: '', title: '', children: [], attrs: {},
    classList: { add: c => cls.add(c), contains: c => cls.has(c), toggle(){} },
    get className(){ return [...cls].join(' '); }, set className(v){ cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); },
    addEventListener: (t, fn) => { (L[t] = L[t] || []).push(fn); }, fire: (t, ev) => (L[t] || []).forEach(fn => fn(Object.assign({ target: o }, ev || {}))),
    appendChild(c){ o.children.push(c); return c; }, getContext: () => ({ font: '', measureText(){ return { width: /'Nope'|'NanumGothic'|'Nanum Gothic'|'나눔고딕'|'Dotum'|'돋움'/.test(this.font) ? 100 : (/'/.test(this.font) ? 120 : 100) }; } }) };
  Object.defineProperty(o, 'innerHTML', { get: () => o._h || '', set: (v) => { o._h = String(v); o.children = []; } });
  return o;
}
const txt = (el) => el.textContent + el.children.map(txt).join('');
function mkEnv(opt){
  const els = new Proxy({}, { get: (t, k) => (typeof k === 'string' ? (t[k] || (t[k] = mkEl(k))) : undefined) });
  const store = Object.assign({}, opt.ls || {}), notes = [], root = mkEl('html');
  const env = { els, store, notes, root, premium: !!opt.premium, child: 0 };
  globalThis.document = { documentElement: root, getElementById: id => els[id], createElement: t => mkEl() };
  globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  globalThis.TwErrorCodes = { notify: c => notes.push(c) };
  globalThis.window = { queryLocalFonts: opt.fonts === null ? undefined : async () => (opt.fonts || []).map(f => ({ family: f })) };
  const w = globalThis.window; new Function('window', 'module', SRC.ui)(w, undefined);
  env.ui = w.TwFontUi.createFontUi({ _premiumOn: () => env.premium, refreshChildren: () => { env.child++; } });
  return env;
}
const flush = async () => { for(let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };

(async () => {
say('── 2. 걸기');
{
  let e = mkEnv({ ls: { 'tw.uiFont': 'nanum' } });
  e.ui.apply();
  chk(e.root.style._p['--win-font'] === FC.cssFor('nanum') && e.root.style._p['--tw-font-legacy'] === FC.cssFor('nanum') && !('--tw-font-classic' in e.root.style._p) && e.child === 1,
    '★ 나눔고딕 → 창 글씨 토큰 둘에 · 머리 위 토큰은 안 건드림 · 열린 자식 창 다시 옮김');
  e.store['tw.uiFont'] = 'base'; e.ui.apply();
  chk(Object.keys(e.root.style._p).length === 0, '기본으로 돌아오면 인라인을 걷는다(테마 글꼴이 다시 산다)');
  e = mkEnv({ premium: false, ls: { 'tw.uiFont': 'pc:Consolas' } }); e.ui.apply();
  chk(Object.keys(e.root.style._p).length === 0 && e.store['tw.uiFont'] === 'pc:Consolas', '★ PC 글꼴은 프리미엄만 — 아니면 기본으로 보이고 고른 값은 남긴다');
  e.premium = true; e.ui.apply();
  chk(e.root.style._p['--win-font'] === FC.cssFor('pc:Consolas'), '  프리미엄이면 그 글꼴로');
}

say('── 3. 설정 칸 · PC 글꼴 상자');
{
  let e = mkEnv({ premium: false, ls: { 'tw.uiFont': 'pc:Consolas' } });
  e.ui.bind();
  const rows = e.els.fontPickRow.children;
  chk(rows.length === 4 && txt(rows[0]).startsWith('기본') && /on/.test(rows[0].className) && /locked/.test(rows[3].className) && txt(rows[3]).includes('✕'),
    '세 줄 + 고른 PC 글꼴 줄(✕) — 프리미엄이 아니면 그 줄은 흐리게 · 기본이 켜짐');
  chk(/이 PC 에 없음/.test(txt(rows[2])) && !/이 PC 에 없음/.test(txt(rows[0])), '없는 글꼴엔 «이 PC 에 없음»(폭을 재서 판단)');
  rows[1].onclick();
  chk(e.store['tw.uiFont'] === 'dotum' && e.root.style._p['--win-font'] === FC.cssFor('dotum') && e.els.fontPickRow.children.length === 3, '줄을 누르면 저장 · 바로 건다 · PC 줄은 사라짐');
  e.els.fontPcMore.fire('click'); await flush();
  chk(e.els.fontPcLock.style.display === 'block' && e.els.fontPcBox.style.display !== 'block', '★ 프리미엄이 아니면 PC 글꼴 상자 대신 잠금 안내');
  e = mkEnv({ premium: true, fonts: ['Consolas', 'Batang', 'Consolas', "Evil'Font"] });
  e.ui.bind(); e.els.fontPcMore.fire('click'); await flush();
  const its = e.els.fontPcList.children;
  chk(e.els.fontPcBox.style.display === 'block' && its.length === 3 && txt(its[0]).startsWith('Batang') && its.some(i => txt(i).startsWith('EvilFont')), '프리미엄 — 이 PC 글꼴 목록(겹친 이름은 하나 · 이름 씻음 · 가나다 순)');
  e.els.fontPcSearch.value = 'cons'; e.els.fontPcSearch.fire('input');
  chk(e.els.fontPcList.children.length === 1, '찾기 칸으로 거른다');
  e.els.fontPcList.children[0].onclick(); e.els.fontPcOk.fire('click');
  chk(e.store['tw.uiFont'] === 'pc:Consolas' && e.els.fontPcBox.style.display === 'none' && e.els.fontPickRow.children.length === 4, '고르고 [이 글꼴로] → 저장 · 상자 닫힘 · 넷째 줄');
  e = mkEnv({ premium: true, fonts: null });
  e.ui.bind(); e.els.fontPcMore.fire('click'); await flush();
  chk(e.notes.join() === 'E-SYS-03' && /읽지 못했어요/.test(txt(e.els.fontPcList)), '★ 목록을 못 읽으면 E-SYS-03 · 안내');
  e.els.fontPcSearch.value = '나눔손글씨 펜'; e.els.fontPcOk.fire('click');
  chk(e.store['tw.uiFont'] === 'pc:나눔손글씨 펜', '  그때는 이름을 직접 써서 고를 수 있다');
}

say('── 4. 배선');
{
  const order = [...SRC.html.matchAll(/<script src="parts\/(shared\/font-choice|shared\/font-ui|app)\.js"/g)].map(m => m[1]);
  chk(order.join() === 'shared/font-choice,shared/font-ui,app', 'html — font-choice → font-ui → app.js 순서');
  const iTheme = SRC.app.indexOf('themeUiMod.bindThemeUI();'), iFont = SRC.app.indexOf('TwFontUi.createFontUi(');
  chk(iTheme > 0 && iFont > iTheme && /fontUiMod\.apply\(\); fontUiMod\.bind\(\);/.test(SRC.app), 'app.js — 테마 바로 뒤에서 만들고 파싱 즉시 건다');
  chk(/try\{ refreshFont\(\); \}catch\(_\)\{\}/.test(SRC.gate) && /refreshFont: \(\.\.\.a\)=>fontUiMod\.refresh\(\.\.\.a\)/.test(SRC.app), '프리미엄이 바뀌면 초대 게이트 한 곳에서 다시 그린다');
  chk(/id="fontPickRow"/.test(SRC.html) && /id="fontPcBox"/.test(SRC.html) && /id="fontPcLock"/.test(SRC.html), '설정 › 모니터 — 글꼴 칸 · 상자 · 잠금 안내');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();

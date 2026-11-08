/* ═══ 👑 sim-theme-custom.js — 테마 «내 색»(프리미엄 · 계정 저장) ═══════════════════════════════
   ・1절: 규칙(theme-custom.js) — 색 씻기 · 저장 모양 씻기 · 어떤 색을 골라도 제목줄 글자가 읽히는가(기본 = 흰 글자라 어둡게 · 버블 = 어두운 글자라 밝게) · 깨 보기
   ・2절: 걸기(theme.js) — 'cx' 는 프리미엄 + 그 테마의 내 색이 있을 때만 · --acc-* 를 <html> 인라인으로 · 다른 칸이면 인라인을 걷는다
   ・3절: 설정 칸 · 만들기(theme-ui.js) — 여섯째 칸 · 이름 자리 «👑» · 프리미엄 아니면 잠금 안내 · 저장 → 이 PC + 서버 · 서버 실패면 E-SYS-02
   ・4절: 계정 사본 — 로그인 뒤 서버 것을 받는다 · 서버가 비었으면 이 PC 것을 올린다 · 못 읽으면 아무것도 안 한다
   ・5절: 배선 — 서버 규칙(모양만 받음) · 계정 전환 지움 목록 · html 싣는 순서 · 프리미엄이 바뀌면 다시 걸기(초대 게이트 한 곳)
   [실행] node checks/run.js theme-custom */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (names) => { for(const d of [__dirname, process.cwd()]) for(const n of names){ const p = path.join(d, n); if(fs.existsSync(p)) return p; } return null; };
const read = (names) => { const p = find(names); return p ? fs.readFileSync(p, 'utf8') : null; };
const P_TC = find(['theme-custom.js', 'parts/shared/theme-custom.js']);
const SRC = {
  theme: read(['theme.js', 'parts/shared/theme.js']),
  ui: read(['theme-ui.js', 'parts/shared/theme-ui.js']),
  html: read(['desk-companion-prototype.html']),
  rules: read(['firebase-database-rules.json', 'firebase/firebase-database-rules.json']),
  acct: read(['account.js', 'parts/account/account.js']),
  gate: read(['license-gate.js', 'parts/account/license-gate.js']),
  app: read(['app.js', 'parts/app.js']),
};
if(!P_TC || Object.values(SRC).some(v => v == null)){ say('  ? 원본 못 찾음 — ' + ['theme-custom.js'].concat(Object.keys(SRC).filter(k => SRC[k] == null)).join(' · ')); process.exit(2); }
const TC = require(P_TC);
globalThis.TwThemeCustom = TC;
const TC_SRC = fs.readFileSync(P_TC, 'utf8');

say('── 1. 규칙 — 색 씻기 · 읽히는 제목줄');
chk(TC.normHex('#1e7a5a') === '#1E7A5A' && TC.normHex('1E7A5A') === '#1E7A5A' && TC.normHex('#12345') === '' && TC.normHex('red') === '' && TC.normHex(null) === '' && TC.normHex('#1E7A5A;x') === '',
  '색 씻기 — #RRGGBB 대문자만 · 짧은 · 이름 · 꼬리 붙은 값은 버린다');
chk(JSON.stringify(TC.normCustom({ default: { a: '#000080', b: '1084d0' }, bubble: { a: '#fff' }, evil: { a: '#000000', b: '#000000' } })) === '{"default":{"a":"#000080","b":"#1084D0"}}'
  && JSON.stringify(TC.normCustom(null)) === '{}', '저장 모양 씻기 — 두 테마 · a · b 다 맞는 것만');
chk(TC.derive('default', 'nope', '#000000') === null, '잘못된 색이면 걸지 않는다(null)');
const SAMPLE = ['#FFFFFF', '#FFFF00', '#00FFFF', '#7AD1B0', '#000000', '#1E7A5A', '#FF0000', '#808080', '#000080'];
let worstD = 0, worstB = 1;
for(const a of SAMPLE) for(const b of SAMPLE){
  const d = TC.derive('default', a, b), u = TC.derive('bubble', a, b);
  worstD = Math.max(worstD, TC.lum(d['--acc-d']), TC.lum(d['--acc-m']) - 0.12);
  worstB = Math.min(worstB, TC.lum(u['--acc-m']), TC.lum(u['--acc-l']) - 0.15);
}
chk(worstD <= TC.DEFAULT_MAX_LUM + 1e-9, '★ 기본 테마 — 흰 글자 제목줄이라 어떤 색을 골라도 어둡게 맞춘다(가장 밝은 ' + worstD.toFixed(2) + ')');
chk(worstB >= TC.BUBBLE_MIN_LUM - 1e-9, '★ 버블 — 어두운 글자 제목줄이라 어떤 색을 골라도 밝은 파스텔로(가장 어두운 ' + worstB.toFixed(2) + ')');
const v = TC.derive('default', '#1E7A5A', '#7AD1B0');
chk(v['--acc-d'] === '#1E7A5A' && TC.VAR_NAMES.length === 9 && TC.VAR_NAMES.every(k => k.startsWith('--acc-')) && v['--acc-sweep'] === 'none',
  '이미 어두운 색은 그대로 · 변수 아홉(--acc-*) · 제목줄 그라데이션은 기본 규칙(acc-d → acc-m)');
chk(TC.chipCss('bubble', '#1E7A5A', '#7AD1B0') === 'linear-gradient(90deg,' + TC.derive('bubble', '#1E7A5A', '#7AD1B0')['--acc-l'] + ',' + TC.derive('bubble', '#1E7A5A', '#7AD1B0')['--acc-m'] + ')',
  '설정 칸 색은 그 테마에서 실제로 보일 제목줄 색');
{ /* 깨 보기 — 어둡게 맞추는 줄을 빼면 흰 색이 그대로 나가 위 ★ 가 빨강 */
  const broke = TC_SRC.replace('const d = _toward(a, K, c => lum(c) <= DEFAULT_MAX_LUM);', 'const d = a;');
  const m = { exports: {} }; new Function('module', 'window', broke)(m, undefined);
  chk(broke !== TC_SRC && m.exports.lum(m.exports.derive('default', '#FFFFFF', '#000000')['--acc-d']) > TC.DEFAULT_MAX_LUM, '  깨 보기 — 어둡게 맞추지 않으면 흰 제목줄에 흰 글자');
}

/* ── 가짜 DOM ── */
function mkEl(id){
  const L = {}, cls = new Set(), props = {};
  const o = { id: id || '', style: { setProperty: (k, v) => { props[k] = v; }, removeProperty: (k) => { delete props[k]; }, _p: props },
    value: '', checked: false, disabled: false, title: '', textContent: '', innerHTML: '', className: '', children: [], attrs: {},
    classList: { toggle: (c, f) => { (f === undefined ? !cls.has(c) : f) ? cls.add(c) : cls.delete(c); }, contains: c => cls.has(c), add: c => cls.add(c) },
    setAttribute: (k, v) => { o.attrs[k] = String(v); }, getAttribute: k => (k in o.attrs ? o.attrs[k] : null), removeAttribute: (k) => { delete o.attrs[k]; },
    addEventListener: (t, fn) => { (L[t] = L[t] || []).push(fn); }, fire: (t, ev) => (L[t] || []).forEach(fn => fn(Object.assign({ target: o }, ev || {}))),
    appendChild(c){ o.children.push(c); return c; },
  };
  Object.defineProperty(o, 'innerHTML', { get: () => o._h || '', set: (v) => { o._h = String(v); o.children = []; } });
  return o;
}
function mkEnv(opt){
  const els = new Proxy({}, { get: (t, k) => (typeof k === 'string' ? (t[k] || (t[k] = mkEl(k))) : undefined) }), store = Object.assign({}, opt.ls || {}), saved = [], notes = [];
  const root = mkEl('html');
  const document = { documentElement: root, activeElement: null, getElementById: (id) => els[id], createElement: () => mkEl() };
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const env = { els, store, saved, notes, root, premium: !!opt.premium, srv: opt.srv };
  const g = globalThis;
  g.document = document; g.localStorage = ls; g.TwSafeHtml = { text: s => String(s), cssColor: s => String(s) };
  g.TwErrorCodes = { notify: (c) => notes.push(c) };
  g.getComputedStyle = () => ({ getPropertyValue: (k) => (k === '--acc-d' ? '#000080' : k === '--acc-m' ? '#1084D0' : '') });
  const win = {};
  new Function('window', 'module', SRC.theme)(win, undefined);
  new Function('window', 'module', SRC.ui)(win, undefined);
  const th = win.TwTheme.createTheme({ _premiumOn: () => env.premium });
  const ui = win.TwThemeUi.createThemeUi({
    ACCENT_KEY: th.ACCENT_KEY, THEME_COLORS: th.THEME_COLORS, THEME_DEFAULT_ACCENT: th.THEME_DEFAULT_ACCENT, THEME_KEY: th.THEME_KEY,
    applyTheme: th.applyTheme, getAccent: th.getAccent, getTheme: th.getTheme, onApplied: th.onApplied,
    CUSTOM_ID: th.CUSTOM_ID, getCustom: th.getCustom, customUsable: th.customUsable, setCustom: th.setCustom, _premiumOn: () => env.premium,
    getMyUserId: () => opt.uid === undefined ? 'uA' : opt.uid,
    loadCustom: async () => env.srv, saveCustom: async (uid, o) => { saved.push([uid, JSON.parse(JSON.stringify(o))]); return opt.saveOk !== false; },
  });
  env.th = th; env.ui = ui;
  return env;
}
const flush = async () => { for(let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };
const mine = JSON.stringify({ default: { a: '#1E7A5A', b: '#7AD1B0' } });

(async () => {
say('── 2. 걸기(theme.js)');
{
  let e = mkEnv({ premium: true, ls: { 'tw.accent': 'cx', 'tw.accentCustom': mine } });
  e.th.applyTheme();
  chk(e.th.getAccent() === 'cx' && e.root.attrs['data-accent'] === 'cx' && e.root.style._p['--acc-d'] === '#1E7A5A' && Object.keys(e.root.style._p).length === 9,
    '★ 프리미엄 + 내 색 있음 → data-accent=cx · --acc-* 아홉을 인라인으로');
  e.premium = false; e.th.applyTheme();
  chk(e.th.getAccent() === 'c2' && e.root.attrs['data-accent'] === 'c2' && Object.keys(e.root.style._p).length === 0 && e.store['tw.accentCustom'] === mine,
    '★ 프리미엄이 끝나면 기본색(블루) · 인라인을 걷는다 · 저장한 색은 남긴다');
  e = mkEnv({ premium: true, ls: { 'tw.theme': 'bubble', 'tw.accent': 'cx', 'tw.accentCustom': mine } });
  chk(e.th.getAccent() === 'c3', '버블엔 내 색이 따로라 아직 없으면 버블 기본색(그린)');
  e = mkEnv({ premium: true, ls: { 'tw.accent': 'c4', 'tw.accentCustom': mine } });
  e.root.style.setProperty('--acc-d', '#123456'); e.th.applyTheme();
  chk(e.root.attrs['data-accent'] === 'c4' && !('--acc-d' in e.root.style._p), '다른 칸을 고르면 남은 인라인을 걷는다(CSS 칸 색이 이긴다)');
}

say('── 3. 설정 칸 · 만들기(theme-ui.js)');
{
  let e = mkEnv({ premium: false });
  e.ui.bindThemeUI();
  const row = e.els.themeColorRow, chip = row.children[5];
  chk(row.children.length === 6 && chip && /cx-empty/.test(chip.className) && chip.textContent === '＋' && /<span>👑<\/span>$/.test(e.els.themeColorNames.innerHTML) && !/내 색<\/span>/.test(e.els.themeColorNames.innerHTML),
    '★ 여섯째 칸 · 이름 자리는 «👑» 하나(칸 위에 왕관 없음) · 아직 없으면 빗금 ＋');
  chip.onclick();
  chk(e.els.themeCxLock.style.display === 'block' && e.els.themeCxBox.style.display !== 'block', '프리미엄이 아니면 잠금 안내만 · 만들기 상자는 안 연다');
  e = mkEnv({ premium: true });
  e.ui.bindThemeUI(); e.els.themeColorRow.children[5].onclick();
  chk(e.els.themeCxBox.style.display === 'block' && e.els.themeCxAHex.value === '#000080' && e.els.themeCxBHex.value === '#1084D0', '프리미엄 — 만들기 상자 · 지금 칸 색에서 시작');
  e.els.themeCxA.fire('input', { target: { value: '#1e7a5a' } });
  e.els.themeCxBHex.value = '7ad1b0'; e.els.themeCxBHex.fire('change', { target: { value: '7ad1b0' } });
  chk(/1E7A5A/.test(e.els.themeCxPrevT.style.background || ''), '고르는 동안 미리보기만 바뀐다');
  chk(!e.store['tw.accentCustom'] && e.root.attrs['data-accent'] !== 'cx', '  저장 전에는 화면 색 · 저장본이 안 바뀐다');
  e.els.themeCxSave.fire('click'); await flush();
  chk(e.store['tw.accentCustom'] === mine && e.store['tw.accent'] === 'cx' && e.root.attrs['data-accent'] === 'cx' && e.saved.length === 1 && e.saved[0][0] === 'uA' && JSON.stringify(e.saved[0][1]) === mine,
    '★ 저장 → 이 PC 사본 · 내 색으로 바꿈 · 서버에도 같은 모양');
  e = mkEnv({ premium: true, saveOk: false });
  e.ui.bindThemeUI(); e.els.themeColorRow.children[5].onclick(); e.els.themeCxSave.fire('click'); await flush();
  chk(e.notes.join() === 'E-SYS-02' && e.store['tw.accent'] === 'cx', '서버 쓰기 실패 → E-SYS-02(이 PC 에는 저장)');
  e = mkEnv({ premium: true, ls: { 'tw.accentCustom': mine } });
  e.ui.bindThemeUI(); e.els.themeColorRow.children[5].onclick();
  chk(e.store['tw.accent'] === 'cx' && e.els.themeCxBox.style.display !== 'block', '만들어 둔 색이 있으면 첫 누름은 그 색으로 바꾸기만');
  e.els.themeColorRow.children[5].onclick();
  chk(e.els.themeCxBox.style.display === 'block' && e.els.themeCxAHex.value === '#1E7A5A', '  이미 내 색이면 누를 때 고치기 상자(저장한 색으로)');
  e.els.themeCxOne.fire('change', { target: { checked: true } });
  chk(e.els.themeCxBHex.value === '#1E7A5A' && e.els.themeCxB.disabled === true, '«한 가지 색으로» — 오른쪽 = 왼쪽 · 오른쪽 칸 잠김');
}

say('── 4. 계정 사본');
{
  let e = mkEnv({ premium: true, srv: { default: { a: '#112233', b: '#445566' } }, ls: { 'tw.accentCustom': mine } });
  await e.ui.pullCustom();
  chk(JSON.parse(e.store['tw.accentCustom']).default.a === '#112233' && e.saved.length === 0, '★ 서버에 있으면 이 PC 를 서버 것으로(다른 PC 에서 고른 색)');
  e = mkEnv({ premium: true, srv: {}, ls: { 'tw.accentCustom': mine } });
  await e.ui.pullCustom();
  chk(e.saved.length === 1 && JSON.stringify(e.saved[0][1]) === mine, '서버가 비었으면 이 PC 것을 올린다');
  e = mkEnv({ premium: true, srv: null, ls: { 'tw.accentCustom': mine } });
  await e.ui.pullCustom();
  chk(e.saved.length === 0 && e.store['tw.accentCustom'] === mine, '못 읽으면(null) 아무것도 안 한다 — 빈 값으로 덮지 않는다');
  e = mkEnv({ premium: true, saveOk: false });
  e.ui.bindThemeUI(); e.els.themeColorRow.children[5].onclick(); e.els.themeCxSave.fire('click'); await flush();
  const left = e.store['tw.accentCustom'];
  chk(e.store['tw.accentCustomDirty'] === '1', '서버 저장 실패 → 못 올린 표시');
  { const e2 = mkEnv({ premium: true, srv: { default: { a: '#112233', b: '#445566' } }, ls: { 'tw.accentCustom': left, 'tw.accentCustomDirty': '1' } });
    await e2.ui.pullCustom();
    chk(e2.store['tw.accentCustom'] === left && e2.saved.length === 1 && JSON.stringify(e2.saved[0][1]) === left && !('tw.accentCustomDirty' in e2.store),
      '★ 못 올린 표시가 있으면 서버 옛 값으로 덮지 않고 이 PC 것을 올린다 · 올리면 표시를 지운다'); }
  chk(/'tw\.accentCustomDirty'/.test(SRC.acct), '  못 올린 표시도 계정 전환 지움 목록에');
  e = mkEnv({ premium: true, srv: { default: { a: '#112233', b: '#445566' } }, uid: '' });
  await e.ui.pullCustom();
  chk(!e.store['tw.accentCustom'], '내 코드가 없으면 서버를 안 본다');
}

say('── 5. 배선');
{
  const R = JSON.parse(SRC.rules).rules.users.$userId.themeCustom || {};
  const tt = R.$t || {};
  chk(/userAuth/.test(R['.write'] || '') && R['.validate'] === 'newData.hasChildren()' && /'default'/.test(tt['.validate'] || '') && /'bubble'/.test(tt['.validate'] || '') && /#\[0-9A-F\]\{6\}/.test((tt.a || {})['.validate'] || '')
    && /#\[0-9A-F\]\{6\}/.test((tt.b || {})['.validate'] || '') && (tt.$other || {})['.validate'] === false, '서버 규칙 — 주인만 쓰기 · 통째 글자 · 숫자 거절 · default/bubble · a · b 는 #RRGGBB 만 · 다른 칸 거절');
  chk(/'tw\.accentCustom'/.test(SRC.acct), '계정 전환 지움 목록에 tw.accentCustom — 다음 계정에 앞 사람 색이 남지 않게');
  const order = [...SRC.html.matchAll(/<script src="parts\/shared\/(theme-custom|theme-ui|theme)\.js"/g)].map(m => m[1]);
  chk(order[0] === 'theme-custom' && order.length === 3, 'html — theme-custom.js 를 theme-ui · theme 보다 먼저 싣는다');
  chk(/try\{ refreshTheme\(\); \}catch\(_\)\{\}/.test(SRC.gate) && /refreshTheme: \(\.\.\.a\)=>themeUiMod\.refreshCustom\(\.\.\.a\)/.test(SRC.app),
    '프리미엄이 바뀌면 다시 걸기 — 초대 게이트의 한 곳(_refreshPremiumGatedUI)');
  chk(/whenNetReady\(\(\)=>\{ themeUiMod\.pullCustom\(\); \}, 'loadThemeCustom'\)/.test(SRC.app), '로그인 뒤 한 번 계정 사본 받기');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();

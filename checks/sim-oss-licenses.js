/* sim-oss-licenses.js — 📄 오픈소스 라이선스 안내(scripts/third-party-notices.js · app/licenses/oss-notices.js · app/parts/launcher/oss-licenses.js)
   1절: 만든 목록이 package-lock.json 의 운영 패키지 + VENDOR 를 빠짐없이 덮는다 — 의존성 · CDN Firebase 판을 바꾸고 다시 안 만들면 빨강(깨 보기 포함).
   2절: 만드는 함수 — 직접 쓰는 패키지마다 한 줄 · 하위 패키지는 그 줄 안으로 · 같은 원문은 한 번 · 원문 없는 MIT 는 저자로 · 링크 · CDN Firebase 판 읽기.
   3절: 창 — 고정 크기 · 목록과 원문은 안쪽 스크롤 · 이름은 textContent · 링크는 openUrl · 원문 펼치기 · 못 실음 · 닫기 · ESC 스택.
   4절: 프로그램 설정 위에서 연 이 창 안 클릭이 설정을 닫지 않는다(shared/outside-close.js 예외 · 깨 보기). */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
/* 러너는 원본을 한 폴더에 펼쳐 올린다 — 저장소 자리 · 검사 옆 · 지금 폴더 순으로 찾는다 */
const find = (...rel) => [path.join(ROOT, ...rel), path.join(__dirname, rel[rel.length - 1]), rel[rel.length - 1]].find(f => fs.existsSync(f));
let fail = 0;
const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if(!c) fail++; };

const GEN = find('scripts', 'third-party-notices.js'), LOCK = find('package-lock.json'), NOTICES = find('app', 'licenses', 'oss-notices.js'), UI = find('app', 'parts', 'launcher', 'oss-licenses.js'), FB_INIT = find('app', 'parts', 'firebase-init.js');
if(!GEN || !LOCK || !NOTICES || !UI || !FB_INIT){ console.log('  ? 원본 못 찾음 — ' + [!GEN && 'third-party-notices.js', !LOCK && 'package-lock.json', !NOTICES && 'oss-notices.js', !UI && 'oss-licenses.js', !FB_INIT && 'firebase-init.js'].filter(Boolean).join(' · ')); process.exit(2); }
const gen = require(path.resolve(GEN));
const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
const fbInitSrc = fs.readFileSync(FB_INIT, 'utf8');

/* 1절 — 목록이 lock 을 덮는가 */
const covered = (data) => {
  const s = new Set();
  for(const it of data.items){ s.add(it.name + (it.version ? ' ' + it.version : '')); for(const m of it.members) s.add(m); }
  return s;
};
/* VENDOR 판 — firebase-init.js 는 펼친 자리에서 읽는다(생성기는 저장소 자리로 찾음) */
function expected(lk, fbSrc = fbInitSrc){
  const io = { readFile: (f) => f.endsWith(gen.FIREBASE_INIT) ? fbSrc : fs.readFileSync(f, 'utf8') };
  const s = new Set();
  for(const v of gen.VENDOR){ const ver = typeof v.version === 'function' ? v.version(lk, io) : v.version; s.add(v.name + (ver ? ' ' + ver : '')); }
  for(const p of gen.lockPackages(lk)) s.add(p.name + ' ' + p.version);
  return s;
}
const win = {};
new Function('window', fs.readFileSync(NOTICES, 'utf8'))(win);
const data = win.TwOssNotices;
chk(data && Array.isArray(data.items) && data.items.length > 0, '1절 app/licenses/oss-notices.js 가 목록을 싣는다');
const have = covered(data);
const missing = [...expected(lock)].filter(x => !have.has(x));
chk(missing.length === 0, `1절 lock 운영 패키지 + VENDOR 를 빠짐없이 덮는다` + (missing.length ? ` — 빠짐 ${missing.slice(0, 5).join(', ')} → npm ci 뒤 node scripts/third-party-notices.js` : ''));
const lock2 = JSON.parse(JSON.stringify(lock));
lock2.packages['node_modules/zz-new-dep'] = { version: '1.0.0', license: 'MIT' };
chk([...expected(lock2)].some(x => !have.has(x)), '1절 깨 보기 — lock 에 새 운영 패키지가 생기면 빨강');
chk([...expected(lock, fbInitSrc.replace(/firebasejs\/\d+\.\d+\.\d+\//g, 'firebasejs/99.0.0/'))].some(x => !have.has(x)), '1절 깨 보기 — firebase-init.js 의 CDN 판이 바뀌면 빨강');
const direct = Object.keys((lock.packages[''] || {}).dependencies || {});
chk(data.items.length === gen.VENDOR.length + direct.length, `1절 줄 수 = VENDOR ${gen.VENDOR.length} + 직접 쓰는 패키지 ${direct.length}(하위 패키지는 줄로 안 늘어난다)`);
chk(data.items.every(it => typeof it.raw === 'string' && it.raw.length > 0), '1절 줄마다 원문이 있다');

/* 2절 — 만드는 함수(가짜 lock · 가짜 파일) */
const fakeLock = { packages: {
  '': { dependencies: { top: '^1', solo: '^1' } },
  'node_modules/top': { version: '1.0.0', license: 'MIT', dependencies: { kid: '^1', kid2: '^1' } },
  'node_modules/kid': { version: '2.0.0', license: 'MIT' },
  'node_modules/kid2': { version: '3.0.0', license: 'ISC' },
  'node_modules/top/node_modules/kid2': { version: '9.0.0', license: 'ISC' },
  'node_modules/solo': { version: '4.0.0', license: 'MIT' },
  'node_modules/devonly': { version: '1.0.0', license: 'MIT', dev: true },
  'node_modules/electron': { version: '9.9.9', license: 'MIT', dev: true } } };
const P = (rel) => path.join(ROOT, rel);
const files = { [P('node_modules/top')]: ['LICENSE', 'package.json'], [P('node_modules/kid')]: ['LICENSE'], [P('node_modules/top/node_modules/kid2')]: ['LICENSE'], [P('node_modules/kid2')]: ['LICENSE'], [P('node_modules/solo')]: ['package.json'] };
const texts = {
  [P('node_modules/top/LICENSE')]: 'SAME TEXT', [P('node_modules/kid/LICENSE')]: 'SAME TEXT', [P('node_modules/top/node_modules/kid2/LICENSE')]: 'ISC TEXT', [P('node_modules/kid2/LICENSE')]: 'ISC TEXT',
  [P('node_modules/top/package.json')]: JSON.stringify({ repository: { url: 'git+https://github.com/x/top.git' } }),
  [P('node_modules/solo/package.json')]: JSON.stringify({ author: { name: 'Solo Author' }, homepage: 'javascript:alert(1)' }),
  [P('node_modules/electron/LICENSE')]: 'ELECTRON TEXT',
};
const io = { readDir: (d) => { if(!files[d]) throw new Error('없음'); return files[d]; }, readFile: (f) => { if(!(f in texts)) throw new Error('없음'); return texts[f]; }, std: (s) => s === 'Apache-2.0' ? 'APACHE TEXT' : null };
const out = gen.build(fakeLock, io);
const top = out.items.find(x => x.name === 'top'), solo = out.items.find(x => x.name === 'solo');
chk(top && top.members.length === 3 && top.note === '하위 패키지 2개 포함' && top.members.includes('kid2 9.0.0'), '2절 하위 패키지는 직접 쓰는 패키지 줄 안으로(중첩 경로 node_modules/top/node_modules 먼저)');
chk(top && (top.raw.match(/SAME TEXT/g) || []).length === 1 && /---- kid 2\.0\.0, top 1\.0\.0 ----/.test(top.raw), '2절 같은 원문은 한 번 · 쓰는 이름을 묶는다');
chk(top && top.license === 'MIT 외 1' && top.licenses.join(',') === 'MIT,ISC', '2절 칩은 대표 라이선스 + «외 n» (전체는 licenses)');
chk(top && top.url === 'https://github.com/x/top', '2절 링크는 homepage · 없으면 저장소 주소(git+ · .git 뗌)');
chk(solo && solo.url === '' && /Copyright \(c\) Solo Author/.test(solo.raw), '2절 https 가 아닌 주소는 버림 · 원문 없는 MIT 는 저자로');
chk(!out.items.some(x => x.name === 'devonly') && out.items.some(x => x.name === 'Electron' && x.version === '9.9.9' && /ELECTRON TEXT/.test(x.raw)), '2절 dev 는 빼고 · Electron 은 VENDOR 로');
chk(out.items.some(x => /APACHE TEXT/.test(x.raw)), '2절 원문 없는 Apache-2.0 VENDOR 는 표준 원문(scripts/oss-licenses)');
const fbVer = (src) => gen.cdnFirebaseVersion(() => { if(src == null) throw new Error('없음'); return src; });
chk(fbVer('import x from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";') === '10.12.2' && fbVer('') === '?' && fbVer(null) === '?',
  '2절 CDN Firebase 판은 firebase-init.js 의 gstatic 주소에서 · 없거나 못 읽으면 «?»');
chk(out.items.some(x => x.name === 'Firebase JS SDK' && x.version === '?'), '2절 Firebase JS SDK 는 VENDOR 줄(npm 패키지 아님)');

/* 3절 — 창(가짜 DOM) */
const { createOssLicenses, OSS_WIN, CSS } = require(path.resolve(UI));
function el(tag){
  const e = { tag, children: [], style: {}, attrs: {}, listeners: {}, className: '', id: '', parent: null, scrollTop: 5, disabled: false,
    appendChild(c){ c.parent = this; this.children.push(c); return c; }, append(...cs){ cs.forEach(c => this.appendChild(c)); },
    remove(){ if(this.parent){ this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; } },
    setAttribute(k, v){ this.attrs[k] = v; }, addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); }, focus(){} };
  Object.defineProperty(e.style, 'cssText', { set(v){ e._css = v; }, get(){ return e._css || ''; } });
  /* 브라우저처럼 textContent 를 쓰면 자식이 지워진다 */
  let txt = '';
  Object.defineProperty(e, 'textContent', { set(v){ txt = v; e.children = []; }, get(){ return txt; } });
  return e;
}
const doc = { body: el('body'), head: el('head'), createElement: el, getElementById(id){ return this.head.children.find(c => c.id === id) || null; } };
const all = (n, out = []) => { out.push(n); n.children.forEach(c => all(c, out)); return out; };
const byClass = (n, c) => all(n).filter(x => (' ' + x.className + ' ').includes(' ' + c + ' '));
const opened = [], escWins = [];
const linkA = el('a'), linkB = el('a');
let resolveLoad, loads = 0;
const mod = createOssLicenses({ document: doc, window: {}, links: [linkA, null, linkB], openUrl: (u) => opened.push(u), escRegisterWindow: (w) => escWins.push(w), load: () => { loads++; return new Promise(r => { resolveLoad = r; }); } });
chk(doc.body.children.length === 0 && escWins.length === 0, '3절 만들 때는 창을 만들지 않는다(처음 열 때 한 번)');
let prevented = false;
linkA.listeners.click[0]({ preventDefault(){ prevented = true; } });
const ov = doc.body.children[0];
chk(mod.isOpen() && prevented && ov.className === 'app-popup-ov' && ov.style.display === 'flex' && doc.head.children.some(c => c.tag === 'style'), '3절 링크를 누르면 창이 열린다(주소로 가지 않음 · app-popup-ov · 모양 한 번 싣기)');
chk(escWins.length === 1 && escWins[0].el === ov && escWins[0].isOpen() === true, '3절 ESC 스택에 한 번 태운다(늘 있는 요소 · 열림 판정)');
chk(new RegExp('\\.oss-box\\{[^}]*overflow:hidden;width:440px;height:460px;max-width:92vw;max-height:80vh').test(CSS) && OSS_WIN.width === 440 && OSS_WIN.height === 460, '3절 창 크기 고정(440×460 · 화면 안으로만 줄어듦) · 넘침 숨김');
chk(/\.oss-list\{flex:1 1 auto;min-height:0;[^}]*overflow-y:auto;overflow-x:hidden/.test(CSS), '3절 목록은 창 안에서만 세로 스크롤 · 가로로 안 늘어남');
chk(/\.oss-raw\{[^}]*max-height:150px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere/.test(CSS) && /\.oss-name\{[^}]*text-overflow:ellipsis;white-space:nowrap/.test(CSS) && /\.oss-chip\{[^}]*max-width:150px;overflow:hidden;text-overflow:ellipsis/.test(CSS), '3절 펼친 원문은 높이 상한 + 자기 스크롤 · 긴 이름 · 칩은 말줄임');
chk(!/font-size:(9|\d+\.\d)px/.test(CSS), '3절 글자 크기는 디자인 시스템 단계만(9px 이하 · 반 픽셀 없음)');
chk(/\.oss-title\{[^}]*background:var\(--win-title-grad\);color:var\(--win-title-ink\)/.test(CSS) && !/#fff|rgba\(|linear-gradient|--tw-font-legacy/.test(CSS), '3절 색 · 글꼴 · 그림자는 테마 토큰(타이틀 grad · ink · bg-field · win-drop · font-ui) — 박은 값 없음');
chk(/\.oss-top\{[^}]*min-height:24px/.test(CSS) && /\.oss-name\{[^}]*min-height:24px/.test(CSS) && /\.oss-more\{[^}]*min-height:24px;min-width:44px/.test(CSS), '3절 누르는 자리는 24px 이상(size-hit)');
mod.open();
chk(doc.body.children.length === 1 && loads === 1, '3절 다시 열어도 창 · 싣기는 하나');
resolveLoad({ items: [
  { name: '<b>x</b>', version: '1.0.0', license: 'MIT', url: 'https://x.dev', note: '하위 패키지 2개 포함', raw: '<i>원문</i>' },
  { name: 'nolink', version: '', license: 'Apache-2.0', url: '', note: '', raw: 'R' } ] });
(async () => {
  await new Promise(r => setTimeout(r, 0));
  const rows = byClass(ov, 'oss-row');
  const n0 = byClass(rows[0], 'oss-name')[0], n1 = byClass(rows[1], 'oss-name')[0];
  chk(rows.length === 2 && n0.textContent === '<b>x</b>' && byClass(ov, 'oss-cap')[0].textContent.includes('2개'), '3절 줄마다 이름은 textContent 그대로 · 개수 안내');
  n0.onclick();
  chk(opened[0] === 'https://x.dev' && n1.disabled === true && byClass(rows[1], 'oss-ver').length === 0, '3절 이름을 누르면 openUrl 로 홈페이지 · 주소 없으면 누를 수 없음 · 판 없으면 안 보임');
  const more = byClass(rows[0], 'oss-more')[0];
  more.onclick();
  const raw = byClass(rows[0], 'oss-raw')[0];
  chk(raw && raw.textContent === '<i>원문</i>' && more.textContent === '원문 ▴', '3절 [원문] 은 그 줄 아래로 펼친다(textContent)');
  more.onclick();
  chk(byClass(rows[0], 'oss-raw').length === 0 && more.textContent === '원문 ▾', '3절 다시 누르면 접는다');
  escWins[0].close();
  chk(!mod.isOpen() && ov.style.display === 'none' && escWins[0].isOpen() === false, '3절 ESC(스택의 close)로 닫힌다 — 숨기기');
  mod.open();
  chk(mod.isOpen() && loads === 1 && byClass(ov, 'oss-row').length === 2, '3절 다시 열면 실어 둔 목록 그대로(다시 안 싣는다)');
  byClass(ov, 'lc-btn')[0].onclick();
  chk(!mod.isOpen(), '3절 [닫기] 로 닫힌다');
  const doc2 = { body: el('body'), head: el('head'), createElement: el, getElementById(){ return null; } };
  let fails = 0;
  const mod2 = createOssLicenses({ document: doc2, window: {}, links: [], openUrl: () => {}, escRegisterWindow: () => {}, load: () => { fails++; return Promise.resolve(fails === 1 ? null : { items: [{ name: 'ok', license: 'MIT', raw: 'x', url: '' }] }); } });
  await mod2.open();
  chk(/불러오지 못했어요/.test(byClass(doc2.body, 'oss-msg')[0].textContent), '3절 못 실으면 «불러오지 못했어요»(빈 목록과 구분)');
  mod2.close(); await mod2.open();
  chk(fails === 2 && byClass(doc2.body, 'oss-row').length === 1 && byClass(doc2.body, 'oss-msg').length === 0, '3절 못 실었으면 다음에 열 때 다시 해 본다');

  /* 4절 — outside-close: 설정이 열린 채 라이선스 창 안을 누른다 */
  const OC = find('app', 'parts', 'shared', 'outside-close.js');
  if(!OC){ console.log('  ? 원본 못 찾음 — outside-close.js'); process.exit(2); }
  const ocSrc = fs.readFileSync(OC, 'utf8');
  function runOutside(src){
    const handlers = [];
    let closed = 0;
    const node = (id, parent) => ({ id, parent, classList: { contains: (c) => c === 'on' && id === 'programSettingsOverlay' }, firstElementChild: null,
      contains(t){ for(let x = t; x; x = x.parent) if(x === this) return true; return false; },
      closest(sel){ const want = sel.replace('#', ''); for(let x = this; x; x = x.parent) if(x.id === want) return x; return null; }, click(){ closed++; } });
    const settings = node('programSettingsOverlay', null); settings.firstElementChild = node('psBox', settings);
    const oss = node('ossLicensesOverlay', null); const inside = node('ossItem', node('ossBox', oss));
    const outsideEl = node('desk', null);
    const byId = { programSettingsOverlay: settings, progSettingsCloseBtn: { click(){ closed++; } } };
    const fakeDoc = { addEventListener: (t, f) => handlers.push(f), getElementById: (id) => byId[id] || null };
    const { createOutsideClose } = (() => { const m = { exports: {} }; new Function('document', 'window', 'module', src)(fakeDoc, {}, m); return m.exports; })();
    handlers.length = 0;
    createOutsideClose({});
    const click = (t) => handlers.forEach(h => h({ target: t }));
    click(inside); const afterInside = closed;
    click(outsideEl);
    return { afterInside, afterOutside: closed };
  }
  const real = runOutside(ocSrc);
  chk(real.afterInside === 0 && real.afterOutside === 1, '4절 설정이 열린 채 라이선스 창 안을 누르면 설정이 남고 · 진짜 바깥을 누르면 닫힌다');
  const broken = runOutside(ocSrc.replace(/if\(overlayId==='programSettingsOverlay'[^\n]*#ossLicensesOverlay[^\n]*\n/, ''));
  chk(broken.afterInside === 1, '4절 깨 보기 — 예외 줄을 빼면 라이선스 창 안 클릭이 설정을 닫는다(빨강)');
  console.log(fail ? `✗ 실패 ${fail}건` : '✓ 전부 통과');
  process.exit(fail ? 1 : 0);
})();

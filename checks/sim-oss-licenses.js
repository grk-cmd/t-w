/* sim-oss-licenses.js — 📄 오픈소스 라이선스 안내(scripts/third-party-notices.js · app/licenses/oss-notices.js · app/parts/launcher/oss-licenses.js)
   1절: 만든 글의 목록이 package-lock.json 의 운영 패키지 + VENDOR 와 같다 — 의존성을 바꾸고 다시 안 만들면 빨강(깨 보기 포함).
   2절: 만드는 함수 — 같은 원문은 한 번 · 원문 파일 없는 MIT 는 저자로 · 없는 SPDX 는 «원문 파일 없음».
   3절: 창 — 고정 크기 · 안쪽 스크롤 · 글은 textContent · 못 실으면 «불러오지 못했어요» · 닫기 · Esc · 실는 사이 닫힘. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
/* 러너는 원본을 한 폴더에 펼쳐 올린다 — 저장소 자리 · 검사 옆 · 지금 폴더 순으로 찾는다 */
const find = (...rel) => [path.join(ROOT, ...rel), path.join(__dirname, rel[rel.length - 1]), rel[rel.length - 1]].find(f => fs.existsSync(f));
let fail = 0;
const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if(!c) fail++; };

const GEN = find('scripts', 'third-party-notices.js'), LOCK = find('package-lock.json'), NOTICES = find('app', 'licenses', 'oss-notices.js'), UI = find('app', 'parts', 'launcher', 'oss-licenses.js');
if(!GEN || !LOCK || !NOTICES || !UI){ console.log('  ? 원본 못 찾음 — ' + [!GEN && 'third-party-notices.js', !LOCK && 'package-lock.json', !NOTICES && 'oss-notices.js', !UI && 'oss-licenses.js'].filter(Boolean).join(' · ')); process.exit(2); }
const gen = require(path.resolve(GEN));
const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));

/* 1절 — 목록 대조 */
function listed(text){
  const sec = text.split('== 라이선스 원문 ==')[0];
  return new Set(sec.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2).split(' — ')[0]));
}
function expected(lk){
  const s = new Set();
  for(const v of gen.VENDOR){ const ver = typeof v.version === 'function' ? v.version(lk) : v.version; s.add(v.name + (ver ? ' ' + ver : '')); }
  for(const p of gen.lockPackages(lk)) s.add(p.name + ' ' + p.version);
  return s;
}
const sameSet = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
const win = {};
new Function('window', fs.readFileSync(NOTICES, 'utf8'))(win);
chk(typeof win.TwOssNoticesText === 'string' && win.TwOssNoticesText.length > 1000, '1절 app/licenses/oss-notices.js 가 글을 싣는다');
const have = listed(win.TwOssNoticesText);
const want = expected(lock);
const missing = [...want].filter(x => !have.has(x)), extra = [...have].filter(x => !want.has(x));
chk(sameSet(have, want), `1절 목록 ${have.size}개가 lock 운영 패키지 + VENDOR 와 같다` + (missing.length || extra.length ? ` — 빠짐 ${missing.slice(0, 5).join(', ')} · 남음 ${extra.slice(0, 5).join(', ')} → npm ci 뒤 node scripts/third-party-notices.js` : ''));
/* 깨 보기 — lock 에 운영 패키지 하나를 더하면 어긋남으로 잡는가 */
const lock2 = JSON.parse(JSON.stringify(lock));
lock2.packages['node_modules/zz-new-dep'] = { version: '1.0.0', license: 'MIT' };
chk(!sameSet(have, expected(lock2)), '1절 깨 보기 — lock 에 새 운영 패키지가 생기면 빨강');
const lock3 = JSON.parse(JSON.stringify(lock));
lock3.packages['node_modules/zz-dev'] = { version: '1.0.0', license: 'MIT', dev: true };
lock3.packages['node_modules/zz-opt'] = { version: '1.0.0', license: 'MIT', optional: true };
chk(sameSet(expected(lock), expected(lock3)), '1절 dev · optional 패키지는 목록에 넣지 않는다');

/* 2절 — 만드는 함수(가짜 파일) */
const fakeLock = { packages: {
  '': {}, 'node_modules/a': { version: '1.0.0', license: 'MIT' }, 'node_modules/b': { version: '2.0.0', license: 'MIT' },
  'node_modules/c': { version: '3.0.0', license: 'MIT' }, 'node_modules/d': { version: '4.0.0', license: 'WTFPL' },
  'node_modules/electron': { version: '9.9.9', license: 'MIT', dev: true } } };
const files = {
  [path.join(ROOT, 'node_modules/a')]: ['LICENSE'], [path.join(ROOT, 'node_modules/b')]: ['LICENSE.md'],
  [path.join(ROOT, 'node_modules/c')]: ['package.json'], [path.join(ROOT, 'node_modules/d')]: [],
};
const texts = {
  [path.join(ROOT, 'node_modules/a/LICENSE')]: 'SAME TEXT', [path.join(ROOT, 'node_modules/b/LICENSE.md')]: 'SAME TEXT',
  [path.join(ROOT, 'node_modules/c/package.json')]: JSON.stringify({ author: { name: 'Cee Author' } }),
  [path.join(ROOT, 'node_modules/electron/LICENSE')]: 'ELECTRON TEXT',
};
const io = { readDir: (d) => { if(!files[d]) throw new Error('없음'); return files[d]; }, readFile: (f) => { if(!(f in texts)) throw new Error('없음'); return texts[f]; }, std: (s) => s === 'Apache-2.0' ? 'APACHE TEXT' : null };
const out = gen.build(fakeLock, io);
chk((out.match(/^SAME TEXT$/gm) || []).length === 1 && /---- a 1\.0\.0, b 2\.0\.0 ----/.test(out), '2절 같은 원문은 한 번 · 쓰는 이름을 묶는다');
chk(/Copyright \(c\) Cee Author/.test(out), '2절 원문 파일 없는 MIT 는 package.json 저자로 표준 원문');
chk(/\(원문 파일 없음 — 라이선스: WTFPL\)/.test(out), '2절 원문도 표준도 없으면 «원문 파일 없음»');
chk(/- Electron 9\.9\.9 — MIT/.test(out) && /ELECTRON TEXT/.test(out), '2절 Electron 은 dev 여도 VENDOR 로 · 원문은 node_modules/electron/LICENSE');
chk(/APACHE TEXT/.test(out), '2절 원문 없는 Apache-2.0 VENDOR 는 표준 원문(scripts/oss-licenses)');

/* 3절 — 창(가짜 DOM) */
const { createOssLicenses, OSS_WIN } = require(path.resolve(UI));
function el(tag){
  const e = { tag, children: [], style: {}, attrs: {}, listeners: {}, textContent: '', className: '', id: '', parent: null, scrollTop: 5,
    appendChild(c){ c.parent = this; this.children.push(c); return c; }, append(...cs){ cs.forEach(c => this.appendChild(c)); },
    remove(){ if(this.parent){ this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; } },
    setAttribute(k, v){ this.attrs[k] = v; }, addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); }, focus(){} };
  Object.defineProperty(e.style, 'cssText', { set(v){ e._css = v; }, get(){ return e._css || ''; } });
  return e;
}
const doc = { body: el('body'), head: el('head'), createElement: el };
const linkA = el('a'), linkB = el('a');
let resolveLoad;
const mod = createOssLicenses({ document: doc, window: {}, links: [linkA, null, linkB], load: () => new Promise(r => { resolveLoad = r; }) });
let prevented = false;
linkA.listeners.click[0]({ preventDefault(){ prevented = true; } });
const ov = doc.body.children[0];
const box = ov && ov.children[0];
const pre = box && box.children[1];
chk(mod.isOpen() && prevented && ov.className === 'app-popup-ov', '3절 링크를 누르면 창이 열린다(주소로 가지 않음 · app-popup-ov)');
chk(/width:440px;height:460px;max-width:92vw;max-height:80vh/.test(box._css) && /overflow:hidden/.test(box._css), '3절 창 크기 고정(440×460, 화면 안으로만 줄어듦) · 넘침 숨김');
chk(/flex:1 1 auto;min-height:0/.test(pre._css) && /overflow:auto/.test(pre._css) && /white-space:pre-wrap/.test(pre._css) && /overflow-wrap:anywhere/.test(pre._css), '3절 글은 창 안에서만 스크롤 · 긴 줄은 접힌다');
chk(OSS_WIN.width === 440 && OSS_WIN.height === 460, '3절 크기 상수 한 곳(OSS_WIN)');
const p1 = mod.open();
chk(doc.body.children.length === 1 && p1 === undefined, '3절 이미 열려 있으면 하나 더 만들지 않는다');
resolveLoad('<b>MIT</b> text');
(async () => {
  await new Promise(r => setTimeout(r, 0));
  chk(pre.textContent === '<b>MIT</b> text' && pre.scrollTop === 0, '3절 글은 textContent 로 그대로(HTML 로 안 읽음) · 맨 위로');
  box.listeners.keydown[0]({ key: 'Escape', preventDefault(){}, stopPropagation(){} });
  chk(!mod.isOpen() && doc.body.children.length === 0, '3절 Esc 로 닫힌다');
  /* 못 실음 */
  const mod2 = createOssLicenses({ document: doc, window: {}, links: [], load: () => Promise.resolve(null) });
  await mod2.open();
  const pre2 = doc.body.children[0].children[0].children[1];
  chk(/불러오지 못했어요/.test(pre2.textContent), '3절 못 실으면 «불러오지 못했어요»(빈 창과 구분)');
  doc.body.children[0].children[0].children[2].children[0].onclick();
  chk(!mod2.isOpen(), '3절 [닫기] 로 닫힌다');
  /* 싣는 사이 닫힘 */
  let r3; const mod3 = createOssLicenses({ document: doc, window: {}, links: [], load: () => new Promise(r => { r3 = r; }) });
  const p3 = mod3.open(); const pre3 = doc.body.children[0].children[0].children[1];
  mod3.close(); r3('late'); await p3;
  chk(pre3.textContent === '불러오는 중…' && doc.body.children.length === 0, '3절 싣는 사이 닫으면 늦게 온 글을 쓰지 않는다');
  console.log(fail ? `✗ 실패 ${fail}건` : '✓ 전부 통과');
  process.exit(fail ? 1 : 0);
})();

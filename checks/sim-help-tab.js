/* sim-help-tab.js — 📘 마이홈 «도움말» 탭(myhome/help-tab.js) · 도움말 주소 규칙(shared/help-site.js)
   ・1절: help-site — 여는 주소 · 틀이 옮겨 갈 수 있는 주소 · 페이지 알림 읽기(남의 출처 · 어긋난 모양은 버린다)
   ・2절: help-tab — 가짜 화면에서 돌린다: 처음 열기 · 알림이 오면 목차(묶음 접고 펴기) · 편 누르기 · 남의 틀 알림 무시 ·
          시간 안에 알림이 없으면 «못 불러옴» + 다시 시도 · 목차가 어긋나면 «목차를 불러오지 못했어요» · 테마가 바뀌면 다시 연다 · 목차 글은 textContent
   ・3절: 배선 — main.js 틀 이동 허락 · CSP frame-src · html 탭 · 싣는 순서 · 알림함에 도움말 칸 없음 · embed.js 가 보내는 모양을 그대로 읽는다
   ・4절: 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync(path.join(__dirname, 'app')) ? __dirname : path.join(__dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
/* 스테이징은 원본을 한 층으로 펼친다 — 그쪽이면 이름만으로 찾는다 */
const find = (rel) => fs.existsSync(P(rel)) ? P(rel) : path.join(__dirname, path.basename(rel));
const need = ['app/parts/shared/help-site.js', 'app/parts/myhome/help-tab.js', 'app/desk-companion-prototype.html', 'main.js', 'hosting/help/embed.js', 'hosting/help/toc.json'];
const SRC = {};
for(const r of need){ const f = find(r); if(!fs.existsSync(f)){ console.log('  ? 원본 못 찾음 — ' + r); process.exit(2); } SRC[r] = fs.readFileSync(f, 'utf8'); }

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { if(ok){ pass++; say('  ✓ ' + msg); } else { fail++; say('  ✗ ' + msg); } };

const loadSite = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwHelpSite; };
const ORIGIN = 'https://help.together-working.com';
const TOC = JSON.parse(SRC['hosting/help/toc.json']);

/* ── 1. help-site ── */
function siteChecks(S){
  const r = {};
  r.url = S.pageUrl('3', 'bubble') === ORIGIN + '/help/3?theme=bubble&embed=1' && S.pageUrl('index', 'default') === ORIGIN + '/help/?theme=default&embed=1'
    && S.pageUrl('../x', 'bubble') === ORIGIN + '/help/?theme=bubble&embed=1' && S.pageUrl('4-1', 'dark') === ORIGIN + '/help/4-1?theme=default&embed=1'
    && S.pageUrl(undefined, undefined) === ORIGIN + '/help/?theme=default&embed=1' && S.pageUrl(3, 'bubble') === ORIGIN + '/help/?theme=bubble&embed=1';
  r.isHelp = S.isHelpUrl(ORIGIN + '/help/3?embed=1') && S.isHelpUrl(ORIGIN + '/help/') && !S.isHelpUrl(ORIGIN + '/admin/') && !S.isHelpUrl('https://evil.example/help/')
    && !S.isHelpUrl('https://help.together-working.com.evil.example/help/') && !S.isHelpUrl('http://help.together-working.com/help/') && !S.isHelpUrl('https://together-working.web.app/help/') && !S.isHelpUrl('') && !S.isHelpUrl('file:///x');
  const good = { type: 'tw-help', v: 1, page: '3', toc: TOC };
  const m = S.readMessage(ORIGIN, good);
  r.read = !!m && m.page === '3' && JSON.stringify(m.toc) === JSON.stringify(TOC);
  r.drop = S.readMessage('https://evil.example', good) === null && S.readMessage('null', good) === null && S.readMessage(ORIGIN, Object.assign({}, good, { type: 'x' })) === null
    && S.readMessage(ORIGIN, Object.assign({}, good, { v: 2 })) === null && S.readMessage(ORIGIN, Object.assign({}, good, { page: '<img>' })) === null && S.readMessage(ORIGIN, Object.assign({}, good, { page: 3 })) === null && S.readMessage(ORIGIN, null) === null;
  const badToc = (toc) => { const x = S.readMessage(ORIGIN, { type: 'tw-help', v: 1, page: '3', toc }); return !!x && x.page === '3' && x.toc === null; };
  r.tocBad = badToc(null) && badToc([]) && badToc('x') && badToc([{ group: 'g', pages: [] }]) && badToc([{ group: '', pages: [{ slug: '1', title: 'a' }] }])
    && badToc([{ group: 'g', pages: [{ slug: '../1', title: 'a' }] }]) && badToc([{ group: 'g', pages: [{ slug: 'index', title: 'a' }] }])
    && badToc([{ group: 'g', pages: [{ slug: '1', title: 'x'.repeat(61) }] }]) && badToc([{ group: 'g', pages: Array.from({ length: 61 }, (_, i) => ({ slug: 'p' + i, title: 't' })) }]);
  return r;
}
say('── 1. help-site — 주소 · 들일 주소 · 알림 읽기');
const SITE = loadSite(SRC['app/parts/shared/help-site.js']);
const s1 = siteChecks(SITE);
chk(s1.url, '여는 주소 — 편 · 앱 테마 · 칸 안 표시(모르는 편은 목차 · 모르는 테마는 기본)');
chk(s1.isHelp, '틀이 옮겨 갈 수 있는 주소 — 우리 Hosting 의 /help/ 아래만(http · 다른 사이트 · 비슷한 이름 · /admin 은 아님)');
chk(s1.read, '우리 페이지 알림 — 지금 편 · 목차를 읽는다');
chk(s1.drop, '  남의 출처 · 모르는 종류 · 판 · 이상한 편 이름은 버린다');
chk(s1.tocBad, '  목차 모양이 어긋나면 편은 읽고 목차는 null(빈 묶음 · 빈 이름 · 경로 · index · 긴 글 · 너무 많음)');

/* ── 2. help-tab — 가짜 화면 ── */
function mkEl(tag){
  const el = {
    tagName: tag.toUpperCase(), children: [], attrs: {}, style: {}, listeners: {}, _text: '', id: '', className: '', title: '', type: '', src: '',
    classList: { _s: new Set(), toggle(c, on){ if(on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); }, contains(c){ return this._s.has(c); } },
    appendChild(c){ this.children.push(c); c.parent = this; return c; },
    setAttribute(k, v){ this.attrs[k] = String(v); },
    addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); },
    click(){ (this.listeners.click || []).forEach(f => f()); },
    get textContent(){ return this._text + this.children.map(c => c.textContent).join(''); },
    set textContent(v){ this._text = String(v); this.children = []; },
  };
  if(tag === 'iframe') el.contentWindow = { name: 'helpFrame' };
  return el;
}
function mkEnv(theme){
  const els = {}, timers = [], notified = [];
  ['mhHelpRail', 'mhHelpView', 'mhHelpFail', 'mhHelpRetry'].forEach(id => { els[id] = mkEl('div'); els[id].id = id; });
  const win = { listeners: {}, addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); } };
  const env = {
    els, timers, notified, theme,
    document: { getElementById: (id) => els[id] || null, createElement: mkEl, createTextNode: (t) => ({ textContent: String(t), children: [] }) },
    window: win,
    setTimeout: (f, ms) => { timers.push({ f, ms, on: true }); return timers.length; },
    clearTimeout: (id) => { if(timers[id - 1]) timers[id - 1].on = false; },
    TwErrorCodes: { notify: (c) => notified.push(c) },
    fire(){ timers.filter(t => t.on).forEach(t => { t.on = false; t.f(); }); },
    post(data, origin, source){ (win.listeners.message || []).forEach(f => f({ data, origin: origin || ORIGIN, source: source === undefined ? env.frame().contentWindow : source })); },
    frame: () => els.mhHelpView.children.find(c => c.tagName === 'IFRAME'),
  };
  return env;
}
function loadTab(src, siteSrc, env){
  new Function('window', 'document', 'setTimeout', 'clearTimeout', 'TwHelpSite', 'TwErrorCodes', src)(
    env.window, env.document, env.setTimeout, env.clearTimeout, loadSite(siteSrc), env.TwErrorCodes);
  return env.window.TwHelpTab.createHelpTab({ getTheme: () => env.theme });
}
function railText(env){ return env.els.mhHelpRail.children.map(c => c.textContent); }

function tabChecks(tabSrc, siteSrc){
  const r = {};
  const e = mkEnv('bubble');
  const t = loadTab(tabSrc, siteSrc, e);
  r.lazy = !e.frame() && e.timers.length === 0;
  t.enter();
  const f = e.frame();
  r.open = !!f && f.src === ORIGIN + '/help/?theme=bubble&embed=1' && f.attrs.sandbox === 'allow-scripts allow-same-origin' && f.attrs.referrerpolicy === 'no-referrer'
    && railText(e).length === 0 && !e.els.mhHelpFail.classList.contains('on');
  e.post({ type: 'tw-help', v: 1, page: '3', toc: TOC });
  const rt = railText(e);
  r.toc = rt.length === TOC.length + TOC[2].pages.length && rt[2].startsWith('▾ ') && rt[0].startsWith('▸ ') && t.state().openGroup === 2
    && e.els.mhHelpRail.children.some(c => c.className === 'mh-help-ep on' && c.textContent === '3' + TOC[2].pages[0].title) && e.timers.every(x => !x.on);
  e.els.mhHelpRail.children[0].click();
  r.toggle = t.state().openGroup === 0 && railText(e).length === TOC.length + TOC[0].pages.length;
  e.els.mhHelpRail.children[0].click();
  r.close = t.state().openGroup === -1 && railText(e).length === TOC.length;
  e.els.mhHelpRail.children[1].click();
  const ep = e.els.mhHelpRail.children.find(c => c.title === '2-1. ' + TOC[1].pages[1].title);
  ep.click();
  r.go = f.src === ORIGIN + '/help/2-1?theme=bubble&embed=1' && t.state().page === '2-1' && e.frame() === f;
  e.post({ type: 'tw-help', v: 1, page: '4-1', toc: TOC }, ORIGIN, { name: 'other' });
  e.post({ type: 'tw-help', v: 1, page: '4-1', toc: TOC }, 'https://evil.example');
  r.ignore = t.state().page === '2-1';
  e.post({ type: 'tw-help', v: 1, page: '4-1', toc: TOC });
  r.follow = t.state().page === '4-1' && t.state().openGroup === 2;
  /* 목차 글은 textContent 로만 — 받은 글이 HTML 이어도 그대로 글자 */
  e.post({ type: 'tw-help', v: 1, page: '1', toc: [{ group: '<img src=x onerror=alert(1)>', pages: [{ slug: '1', title: '<b>t</b>' }] }] });
  r.text = e.els.mhHelpRail.children[0].textContent === '▾ <img src=x onerror=alert(1)>' && e.els.mhHelpRail.children[1].textContent === '1<b>t</b>'
    && !/innerHTML|insertAdjacentHTML/.test(tabSrc);

  const e2 = mkEnv('default');
  const t2 = loadTab(tabSrc, siteSrc, e2);
  t2.enter(); e2.fire();
  r.fail = e2.els.mhHelpFail.classList.contains('on') && e2.notified.join() === 'E-MH-01' && t2.state().failed && e2.frame().style.visibility === 'hidden';
  e2.els.mhHelpRetry.click();
  r.retry = !e2.els.mhHelpFail.classList.contains('on') && e2.timers.filter(x => x.on).length === 1 && e2.frame().src === ORIGIN + '/help/?theme=default&embed=1';
  e2.post({ type: 'tw-help', v: 1, page: 'index', toc: 'broken' });
  r.tocFail = railText(e2).join() === '목차를 불러오지 못했어요' && !e2.els.mhHelpFail.classList.contains('on');
  const loads = () => e2.timers.length;
  const n0 = loads(); t2.enter();
  r.noReload = loads() === n0;
  e2.theme = 'bubble'; t2.themeChanged();
  r.theme = e2.frame().src === ORIGIN + '/help/?theme=bubble&embed=1' && loads() === n0 + 1;
  const e3 = mkEnv('default'); const t3 = loadTab(tabSrc, siteSrc, e3);
  t3.themeChanged();
  r.themeLazy = !e3.frame();
  return r;
}
say('── 2. help-tab — 가짜 화면에서 돌린다');
const TAB = SRC['app/parts/myhome/help-tab.js'];
const t2 = tabChecks(TAB, SRC['app/parts/shared/help-site.js']);
chk(t2.lazy, '만들 때는 틀을 안 연다(탭에 들어올 때 연다)');
chk(t2.open, '들어오면 — 목차 편 · 앱 테마 · 칸 안 표시로 열고 틀은 sandbox(allow-scripts allow-same-origin) · no-referrer · 목차는 아직 비움');
chk(t2.toc, '페이지 알림이 오면 — 목차를 그리고 지금 편이 든 묶음만 펼치고 지금 편 표시 · 시간 재기 멈춤');
chk(t2.toggle && t2.close, '  묶음을 누르면 그 묶음만 펼침 · 한 번 더 누르면 접힘');
chk(t2.go, '  편을 누르면 같은 틀에서 그 편을 연다');
chk(t2.ignore, '  다른 틀 · 다른 출처가 보낸 알림은 무시한다');
chk(t2.follow, '  페이지 안 «이전 · 다음» 으로 옮기면 왼쪽 표시 · 펼친 묶음이 따라간다');
chk(t2.text, '  받은 목차 글은 글자로만 넣는다(HTML 로 안 읽힘 · innerHTML 안 씀)');
chk(t2.fail, '시간 안에 알림이 없으면 «못 불러옴» 칸 · 오류 E-MH-01 · 빈 틀은 가린다');
chk(t2.retry, '  [다시 시도] → 같은 편을 다시 열고 시간을 다시 잰다');
chk(t2.tocFail, '  페이지는 왔는데 목차가 어긋나면 «목차를 불러오지 못했어요»(빈 메뉴와 구분)');
chk(t2.noReload, '탭에 다시 들어와도 같은 테마면 다시 안 연다(요청 수 그대로)');
chk(t2.theme && t2.themeLazy, '앱 테마를 바꾸면 연 틀만 새 테마로 다시 연다(안 연 탭은 그대로)');

/* ── 3. 배선 ── */
say('── 3. 배선');
const MAIN = SRC['main.js'], HTML = SRC['app/desk-companion-prototype.html'], EMBED = SRC['hosting/help/embed.js'];
chk(/const HelpSite = require\('\.\/app\/parts\/shared\/help-site'\)/.test(MAIN)
  && /'will-frame-navigate'[\s\S]{0,200}if\(e\.isMainFrame === false && HelpSite\.isHelpUrl\(u\)\) return;[^\n]*\n\s*e\.preventDefault\(\);/.test(MAIN),
  'main.js — 안쪽 틀은 도움말 주소만 옮겨 갈 수 있다(같은 규칙 파일 · 메인 창은 그대로 file:// 만)');
const csps = HTML.match(/frame-src [^;]*;/g) || [];
chk(csps.length === 2 && csps.every(c => c === 'frame-src ' + SITE.HELP_ORIGIN + ';'), 'CSP frame-src — 우리 Hosting 한 곳만(1단계 · 2단계 두 줄 다)');
chk(/<div class="mh-tab" data-tab="help">도움말<\/div>/.test(HTML) && /<div id="mhPageHelp" class="mh-page">[\s\S]*?id="mhHelpRail"[\s\S]*?id="mhHelpView"[\s\S]*?id="mhHelpFail"[\s\S]*?id="mhHelpRetry"/.test(HTML),
  'html — «도움말» 탭 · 페이지(목차 · 틀 자리 · 못 불러옴 · 다시 시도)');
const iS = HTML.indexOf('<script src="parts/shared/help-site.js">'), iT = HTML.indexOf('<script src="parts/myhome/help-tab.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
chk(iS > 0 && iS < iT && iT < iA, '  싣는 순서 — help-site.js → help-tab.js → app.js');
const PG = (HTML.match(/<div id="mhPageMail"[\s\S]*?<!-- 관리자: 브로드캐스트 작성 모달 -->/) || [''])[0];
chk(PG.length > 0 && !/data-sec="help"|mhInboxPane-help/.test(PG), '  알림함에는 도움말 칸이 없다(따로 탭)');
/* embed.js 가 실제로 보내는 것을 help-site 가 그대로 읽는가 — 두 쪽 모양이 갈라지면 목차가 안 뜬다 */
const sent = [];
const ewin = {}; ewin.parent = { postMessage: (m) => sent.push(m) };
new Function('window', 'document', 'location', 'fetch', EMBED)(ewin, { documentElement: { hasAttribute: () => true } }, { pathname: '/help/4-1' },
  async () => ({ ok: true, json: async () => TOC }));
(async () => {
  await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));
  const got = sent[0] && SITE.readMessage(ORIGIN, sent[0]);
  chk(!!got && got.page === '4-1' && JSON.stringify(got.toc) === JSON.stringify(TOC), 'hosting/help/embed.js 가 보내는 알림 · toc.json 을 help-site 가 그대로 읽는다');

  /* ── 4. 깨 보기 ── */
  say('── 4. 깨 보기 — 하나라도 못 잡으면 빨강');
  const SS = SRC['app/parts/shared/help-site.js'];
  const brk = (name, ok) => chk(ok, name);
  brk('help-site 가 출처를 안 보면', !siteChecks(loadSite(SS.replace("if(origin !== HELP_ORIGIN) return null;", ''))).drop);
  brk('help-site 가 http · 비슷한 이름도 들이면', !siteChecks(loadSite(SS.replace('return x.origin === HELP_ORIGIN && x.pathname.startsWith(HELP_PATH);', "return x.hostname.startsWith('help.together-working.com');"))).isHelp);
  brk('help-site 가 편 이름을 안 걸러 경로가 섞이면', !siteChecks(loadSite(SS.replace("const p = isSlug(page) ? page : 'index';", 'const p = String(page);'))).url);
  brk('help-tab 이 다른 틀 알림도 받으면', !tabChecks(TAB.replace('if(!_frame || e.source !== _frame.contentWindow) return;', 'if(!_frame) return;'), SS).ignore);
  brk('help-tab 이 시간 재기를 안 하면(빈 틀이 그대로)', !tabChecks(TAB.replace(/_timer = setTimeout\(\(\)=>\{[\s\S]*?\}, LOAD_MS\);/, ''), SS).fail);
  brk('help-tab 이 목차 글을 HTML 로 넣으면', !tabChecks(TAB.replace('gb.textContent = (open ? ', 'gb.innerHTML = (open ? '), SS).text);
  brk('help-tab 이 탭에 들어올 때마다 다시 열면', !tabChecks(TAB.replace("if(!_frame || _failed || _theme !== getTheme()) _load(_page);", '_load(_page);'), SS).noReload);
  brk('help-tab 이 목차 어긋남을 «없음» 처럼 비워 두면', !tabChecks(TAB.replace("    if(!_tocFailed) return;", '    return;'), SS).tocFail);

  say('');
  say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass + ' — 도움말 탭은 우리 페이지만 열고, 못 열면 그렇다고 그린다'));
  process.exit(fail ? 1 : 0);
})();

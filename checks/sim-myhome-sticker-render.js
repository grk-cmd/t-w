/* ═══ 🎨 sim-myhome-sticker-render.js — 마이홈 스티커 그리기(myhome/myhome-sticker-render.js · app.js 분리 M19) ═══════════════
   ・1절: 마이홈 탭이 아니면 숨기고 편집을 끝낸 채 돌아감 · 영역이 없으면 아무 일 없음
   ・2절: 그리기 — 순서대로 요소 · 이미지는 허용된 주소만 · 이모지 기본 ⭐ · 애니 · 크기 · 투명도 · 변형 · 편집 중 · 링크
   ・3b절: 링크 — 주소(http · https)면 누르면 열고, 글이면 title 로만 보인다(열기에 안 넘김)
   ・3절: 편집 가능이면 ×(상태 주인 removeSticker → 다시 그림 — 저장은 상태 주인) · ✨ · 핸들 · 각도 · 못 하면 없음 · 우클릭
   ・5절: 연결 — 읽는 함수 · 옛 자리 · 감싸 다시 대입 · 그린 뒤 알림 없음
   ・6절: mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const depPairs = (APP, mod, glob, create) => { const m = APP.match(new RegExp('const ' + mod + ' = ' + glob + '\\.' + create + '\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')); return m ? m[1].split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(x => [x[1], x[2]]) : null; };
const SRC = read('myhome/myhome-sticker-render.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), RULES = read('myhome/myhome-sticker-rules.js');
if(!SRC || !APP || !HTML || !RULES){ say('  ? 원본 못 찾음'); process.exit(2); }
const REAL_RULES = (() => { const w = {}; new Function('window', 'module', RULES)(w, undefined); return w.TwMyHomeStickerRules; })();   // 링크 판정은 진짜 규칙으로
function mkEl(tag){
  const cl = new Set();
  const el = { tag, children: [], style: {}, dataset: {}, className: '', textContent: '', title: '', _l: {}, _innerHTML: '',
    classList: { add: (c) => cl.add(c), remove: (c) => cl.delete(c), contains: (c) => cl.has(c) || el.className.split(' ').includes(c), toggle: (c, on) => { on ? cl.add(c) : cl.delete(c); }, has: (c) => cl.has(c) },
    appendChild(c){ this.children.push(c); return c; }, addEventListener(ev, fn){ this._l[ev] = fn; } };
  Object.defineProperty(el, 'innerHTML', { get(){ return this._innerHTML; }, set(v){ this._innerHTML = v; if(v === '') this.children = []; } });
  return el;
}
function build(src, o){
  o = o || {};
  const log = [], zone = mkEl('div'), data = o.data || {};
  const doc = { getElementById: (id) => (id === 'mhStickerZone' && !o.noZone ? zone : null), querySelector: () => (o.tab ? { dataset: { tab: o.tab } } : null), createElement: (t) => mkEl(t) };
  const st = { editSid: o.editSid || null, drag: 0, canEdit: !!o.canEdit };
  const layout = { STICKER_BASE: 100, _mhFitWindowSafe: () => log.push('fit'), _mhStickersData: () => data, _mhCanEditStickers: () => st.canEdit, _mhStickerTransform: (s) => (s.rot ? 'rotate(' + s.rot + 'deg)' : ''), _mhStickerEditSid: () => st.editSid, _mhOpenStickerAnim: (sid) => log.push('anim:' + sid) };
  const sticker = { editEnd: () => log.push('editEnd'), editStart: (sid) => log.push('editStart:' + sid), bindResize: () => log.push('bindResize'), bindDrag: () => log.push('bindDrag'), bindRotate: () => log.push('bindRotate') };
  const win = { commitMyHomePage: (f) => log.push('commit:' + f), open: (u) => log.push('open:' + u), companion: o.companion };
  const rules = { orderedIds: (d) => Object.keys(d), isLocked: (s) => !!s.locked, isLinkUrl: REAL_RULES.isLinkUrl };
  const safe = { safeUrl: (u) => (/^https:/.test(u) ? u : null) };
  const g = { window: win, document: doc, TwMyHomeStickerRules: rules, TwSafeHtml: safe, companion: o.companion, commitMyHomePage: (f) => log.push('commit:' + f), module: undefined };
  const names = Object.keys(g);
  new Function(...names, src)(...names.map(n => g[n]));
  const store = { removeSticker: (sid) => { log.push('remove:' + sid); delete data[sid]; return Promise.resolve('ok'); } };
  const mod = win.TwMyHomeStickerRender.createMyHomeStickerRender({ mhPageMod: { _mhStickerDragDist: () => st.drag }, mhStLayoutMod: layout, myHomeSticker: () => sticker, myhomeStore: store });
  return { mod, log, zone, data, st };
}
const kids = (b) => b.zone.children;
say('§1 탭 · 영역');
{
  let b = build(SRC, { noZone: true }); b.mod.renderMyHomeStickers();
  chk(b.log.length === 0, '스티커 영역이 없으면 아무 일 없음');
  b = build(SRC, { tab: 'friends', data: { a: {} } }); b.mod.renderMyHomeStickers();
  chk(b.zone.classList.contains('hidden') && b.log.join() === 'fit,editEnd' && kids(b).length === 0, '마이홈 탭이 아니면 숨기고 창 맞춤 · 편집 끝냄 · 그리지 않음');
  b = build(SRC, { tab: 'home', data: {} }); b.mod.renderMyHomeStickers();
  chk(!b.zone.classList.contains('hidden') && b.log.join() === 'fit', '마이홈 탭이면 보이고 다 그린 뒤 창 맞춤');
}
say('§2 그리기');
{
  const data = { a: { img: 'https://x/a.png', x: 5, y: 6, w: 400, h: 200, rot: 30, alpha: 0.4 }, b: { emoji: '🍀', anim: 'bounce', animSpeed: 'fast', locked: true }, c: { img: 'http://bad/c.png' }, d: { link: 'https://l' } };
  const b = build(SRC, { tab: 'home', data, editSid: 'a', canEdit: true }); b.mod.renderMyHomeStickers();
  const [A, B, C, D] = kids(b);
  chk(kids(b).length === 4 && A.dataset.sid === 'a' && D.dataset.sid === 'd', '데이터 순서대로 스티커 요소');
  chk(A.children[0].tag === 'img' && A.children[0].src === 'https://x/a.png' && A.children[0].draggable === false, '이미지는 허용된 주소(https)로');
  chk(C.children[0].tag === 'img' && !C.children[0].src, '허용 안 된 주소는 src 를 안 건다');
  chk(B.children[0].className === 'st-emoji' && B.children[0].textContent === '🍀' && B.classList.contains('emoji') && B.classList.contains('a-bounce') && B.classList.contains('spd-fast') && B.classList.contains('locked'), '이모지 · 움직임 클래스 · 잠금 표시(편집 가능일 때)');
  chk(A.style.left === '5px' && A.style.top === '6px' && A.style.width === Math.min(400, 100 * 2.2) + 'px' && A.style.height === Math.round(Math.min(400, 100 * 2.2) * 0.5) + 'px', '자리 · 크기(기본 폭 상한 = 기준 × 2.2) 비율 유지');
  chk(A.style.transform === 'rotate(30deg)' && A.style.opacity === '0.4' && B.style.opacity === undefined, '변형 · 투명도(1 이면 안 건다)');
  chk(A.classList.contains('editing') && !B.classList.contains('editing'), '편집 중인 스티커만 editing');
  chk(D.classList.contains('linked') && D.title === 'https://l  (우클릭: 편집)', '링크 스티커 — linked · 안내(편집 가능이면 우클릭 편집 문구)');
  const e = build(SRC, { tab: 'home', data: { z: {} }, canEdit: false }); e.mod.renderMyHomeStickers();
  const Z = kids(e)[0];
  chk(Z.children.length === 1 && Z.children[0].className === 'st-emoji' && Z.children[0].textContent === '⭐' && !Z.title, '편집 못 하면 이모지 기본 ⭐ · 편집 버튼 · 핸들 없음');
  chk(!Z.classList.contains('locked'), '편집 못 하면 잠금 표시도 안 한다');
}
say('§3 편집 가능');
{
  const b = build(SRC, { tab: 'home', data: { a: { x: 1, y: 2 } }, canEdit: true }); b.mod.renderMyHomeStickers();
  const A = kids(b)[0];
  const byC = (c) => A.children.find(x => x.className === c);
  const names = A.children.map(c => c.className).filter(c => c.startsWith('mh-sticker-'));
  chk(names.slice(0, 4).join() === 'mh-sticker-del,mh-sticker-anim,mh-sticker-handle,mh-sticker-rotlbl', '× · ✨ · 크기 핸들 · 각도 라벨 순서로 붙는다');
  chk(b.log.includes('bindResize') && b.log.includes('bindRotate') && b.log.includes('bindDrag'), '크기 · 회전 · 끌기를 건다');
  b.log.length = 0; let stopped = 0;
  byC('mh-sticker-anim').onclick({ stopPropagation(){ stopped++; } });
  chk(b.log.join() === 'anim:a' && stopped === 1, '✨ — 움직임 창(전파 막음)');
  A._l.contextmenu({ preventDefault(){}, stopPropagation(){} });
  chk(b.log.includes('editStart:a'), '우클릭 → 편집 시작(본인만)');
  b.log.length = 0;
  byC('mh-sticker-del').onclick({ stopPropagation(){} });
  chk(!('a' in b.data) && b.log.join() === 'editEnd,remove:a,fit' && !b.log.some(l => /^commit/.test(l)), '× — 편집을 끝내고 상태 주인 removeSticker 로 지운 뒤 다시 그린다(저장은 상태 주인 — 여기서 commit 안 부름)');
  const nb = build(SRC, { tab: 'home', data: { a: {} }, canEdit: false }); nb.mod.renderMyHomeStickers(); nb.log.length = 0;
  kids(nb)[0]._l.contextmenu({ preventDefault(){}, stopPropagation(){} });
  chk(!nb.log.includes('editStart:a'), '편집 못 하는 사람(남의 홈)은 우클릭해도 편집이 안 열린다');
}
say('§3b 링크');
{
  const mk = (extra) => build(SRC, Object.assign({ tab: 'home', data: { d: { link: 'https://l' } }, canEdit: false }, extra));
  let b = mk({ companion: { openBrowser: (u) => b.log.push('browser:' + u) } }); b.mod.renderMyHomeStickers();
  kids(b)[0]._l.click({ target: { classList: { contains: () => false } } });
  chk(b.log.includes('browser:https://l'), '링크 — 앱이면 기본 브라우저로');
  b = mk({}); b.mod.renderMyHomeStickers(); kids(b)[0]._l.click({ target: { classList: { contains: () => false } } });
  chk(b.log.includes('open:https://l'), '  브라우저면 새 창');
  b = mk({}); b.st.drag = 9; b.mod.renderMyHomeStickers(); kids(b)[0]._l.click({ target: { classList: { contains: () => false } } });
  chk(!b.log.includes('open:https://l'), '  방금 드래그했으면(5px 넘음) 링크를 안 연다');
  b = mk({ data: { d: { link: '우리 집 강아지' } }, companion: { openBrowser: (u) => b.log.push('browser:' + u) } }); b.mod.renderMyHomeStickers();
  let D = kids(b)[0];
  chk(D.title === '우리 집 강아지' && !D.classList.contains('linked') && !D._l.click, '★ 글만 든 링크 — 마우스를 올리면 보이고(title) linked · 누르면 열기는 없다');
  b = mk({ data: { d: { link: 'javascript:alert(1)' } } }); b.mod.renderMyHomeStickers(); D = kids(b)[0];
  chk(D.title === 'javascript:alert(1)' && !D.classList.contains('linked') && !D._l.click, '  http · https 가 아닌 주소도 글로만 보인다(열지 않음)');
  b = mk({ data: { d: { link: '이름표' } }, canEdit: true }); b.mod.renderMyHomeStickers(); D = kids(b)[0];
  chk(D.title === '이름표  (우클릭: 편집)' && !D.classList.contains('linked'), '  편집 가능이면 글 뒤에 우클릭 편집 문구');
  b = mk({ data: { d: { link: 'HTTP://A.B' } } }); b.mod.renderMyHomeStickers(); D = kids(b)[0];
  chk(D.classList.contains('linked') && typeof D._l.click === 'function', '  대문자 HTTP:// 도 주소(누르면 열림)');
}
say('§5 연결');
{
  const iM = HTML.indexOf('<script src="parts/myhome/myhome-sticker-render.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
  chk(iM > 0 && iA > iM, 'html — myhome-sticker-render.js 를 app.js 보다 먼저 싣는다');
  const code = stripC(APP);
  const pairs = depPairs(APP, 'stickerRenderMod', 'TwMyHomeStickerRender', 'createMyHomeStickerRender');
  const get = (k) => (pairs.find(p => p[0] === k) || [])[1];
  chk(!!pairs && pairs.length === 4 && get('myHomeSticker') === '()=>myHomeSticker' && get('myhomeStore') === 'myhomeStoreMod' && get('mhPageMod') === 'mhPageMod' && get('mhStLayoutMod') === 'mhStLayoutMod', '★ deps 넷 — myHomeSticker 는 읽는 함수(뒤에서 만들어짐) · 상태 주인 myhomeStore · 나머지는 값');
  chk(!/function renderMyHomeStickers\b/.test(code) && (code.match(/stickerRenderMod\.renderMyHomeStickers\(\.\.\.a\)/g) || []).length >= 4 && !/onStickersRendered|stickerRenderMod\.onRendered/.test(code) && !/setRenderMyHomeStickers|getRenderMyHomeStickers/.test(code), '본문이 app.js 에 안 남고 부르는 자리는 그대로 부른다(감싸 다시 대입 · 그린 뒤 알림 없음)');
}
say('§6 mutation test');
{
  const brk = (a, c) => { const m = SRC.replace(a, c); return m === SRC ? null : m; };
  const m1 = brk("zone.classList.toggle('hidden', !onHomeTab);", "");
  chk(!!m1 && (() => { const b = build(m1, { tab: 'friends', data: {} }); b.mod.renderMyHomeStickers(); return !b.zone.classList.contains('hidden'); })(), '탭 숨김을 빼면 빨강');
  const m2 = brk("TwSafeHtml.safeUrl(s.img, 'image')", "s.img");
  chk(!!m2 && (() => { const b = build(m2, { tab: 'home', data: { c: { img: 'http://bad' } } }); b.mod.renderMyHomeStickers(); return !!kids(b)[0].children[0].src; })(), '그림 주소를 거르지 않으면 빨강(남의 스티커)');
  const m3 = brk("if(mhPageMod._mhStickerDragDist()>5) return;", "");
  chk(!!m3 && (() => { const b = build(m3, { tab: 'home', data: { d: { link: 'https://l' } } }); b.st.drag = 9; b.mod.renderMyHomeStickers(); kids(b)[0]._l.click({ target: { classList: { contains: () => false } } }); return b.log.includes('open:https://l'); })(), '드래그 직후 링크 막기를 빼면 빨강');
  const m6 = brk("if(TwMyHomeStickerRules.isLinkUrl(s.link)){", "if(s.link){");
  chk(!!m6 && (() => { const b = build(m6, { tab: 'home', data: { d: { link: '우리 집' } } }); b.mod.renderMyHomeStickers(); const D = kids(b)[0]; if(D._l.click) D._l.click({ target: { classList: { contains: () => false } } }); return b.log.includes('open:우리 집'); })(), '★ 주소 판정을 빼면(글도 열기로 넘김) 빨강');
  const m7 = brk("if(s.link) el.title = canEdit ? (s.link + '  (우클릭: 편집)') : s.link;", "");
  chk(!!m7 && (() => { const b = build(m7, { tab: 'home', data: { d: { link: '우리 집' } } }); b.mod.renderMyHomeStickers(); return kids(b)[0].title !== '우리 집'; })(), '글 링크 title 을 빼면 빨강');
  const m4 = brk("if(!canEdit) return;\n      myHomeSticker().editStart(sid);", "myHomeSticker().editStart(sid);");
  const m5 = brk("myhomeStore.removeSticker(sid);", "");
  chk(!!m5 && (() => { const b = build(m5, { tab: 'home', data: { a: {} }, canEdit: true }); b.mod.renderMyHomeStickers(); kids(b)[0].children.find(x => x.className === 'mh-sticker-del').onclick({ stopPropagation(){} }); return 'a' in b.data; })(), '× 에서 상태 주인 지우기를 빼면 빨강');
  chk(!!m4 && (() => { const b = build(m4, { tab: 'home', data: { a: {} }, canEdit: false }); b.mod.renderMyHomeStickers(); kids(b)[0]._l.contextmenu({ preventDefault(){}, stopPropagation(){} }); return b.log.includes('editStart:a'); })(), '남의 홈 편집 막기를 빼면 빨강');
}
say(''); say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0);

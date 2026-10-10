/* ═══ 📖 sim-guestbook.js — 방명록 모듈 (2026-10-10 신설 · 앱 FSD 4번) ═══════════════════════════
   app.js 의 📖 방명록 세 구역(새 글 뱃지 · 팝업 머리 · 독립 팝업 창)을 parts/guestbook.js 로 옮겼다. 동작은 그대로여야 한다.
   자식 창 테마 규약(GB_HTML 토큰 · 열 때 applyThemeToChildDoc)은 sim-child-theme 이 이 파일을 읽어 보고, 여기서는 «옮긴 것» 자체를 굴려 본다.
   ・1절: 만들 때 — #mhGuestbookBtn 클릭 연결 · window 고리 일곱 · 반환값이 같은 함수 · DOM 이 없으면 조용히
   ・2절: 새 글 배지 — 내 방명록 구독 · 마지막으로 본 뒤 글 수 · 99+ · 관람 중엔 숨김(_mhViewingUserId 는 읽는 함수) ·
          다 읽음(tw.mhGbLastRead:uid) · 구독 끊기
   ・3절: 창 — 가짜 자식 창에 GB_HTML 을 쓰고 테마를 넣는다 · 제목 · 목록(최신이 위 · 내 글만 삭제) · 이미 떠 있으면 앞으로만 ·
          👀 관람(친구 것 구독 · 이미지 등록 숨김 · 홈 주인이 바뀌면 열린 창을 닫는다) · 🚪 외부인(친구 아님)은 입력칸 대신 안내 →
          친구 목록이 오면 다시 칠함(_myHomeFriends 는 읽는 함수)
   ・4절: 쓰기 · 삭제 · 박수 · 폭죽 — 등록(홈 주인에게 · 이름 · uid) · 외부인 한 번 더 막기 · 실패는 창 안에도 · 박수 하루 5번 ·
          보내는 중엔 또 안 보냄 · 실패하면 횟수 되돌림 · 폭죽 이모지 한 글자
   ・5절: app.js 배선 — 정의는 모듈에만 · createGuestbook 은 원래 자리(🎨 스티커 관리 창 뒤 · 💬 말풍선 앞) · deps 모양 ·
          부르는 곳은 window 고리 그대로 · 빈 껍데기 · html 순서 · 전역 이름
   [실행] guestbook.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['guestbook.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = SRC['app.js'], HTML = SRC['desk-companion-prototype.html'], MOD = SRC['guestbook.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const flush = async (n = 8) => { for(let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

/* DOM 칸 — classList · style · 이벤트 · 자식은 진짜, 나머지는 빈 함수 */
function mkEl(tag, id){
  const cls = new Set(), L = {};
  const el = {
    tagName: String(tag || 'div').toUpperCase(), id: id || '', style: { setProperty(k, v){ this[k] = v; } }, dataset: {}, children: [],
    textContent: '', innerHTML: '', value: '', onclick: null, onchange: null, className: '', files: [],
    classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)), contains: c => cls.has(c) },
    appendChild(c){ el.children.push(c); return c; },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
    fire(t, ev){ (L[t] || []).forEach(fn => fn(ev || {})); },
    _L: L,
    querySelector(sel){ return (el._q = el._q || {})[sel] || (el._q[sel] = mkEl('span')); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 150 }),
    remove(){}, focus(){}, blur(){}, click(){ el.clicked = (el.clicked || 0) + 1; },
  };
  return el;
}
/* 방명록 자식 창 — document.open/write/close 를 받고, 쓴 뒤에만 칸이 있다(_gbAlive 가 #gbBody 를 만져 본다) */
function mkChildWin(env){
  const els = {}, L = {};
  const doc = {
    written: '', activeElement: null,
    open(){ doc.written = ''; }, write(h){ doc.written += h; }, close(){},
    getElementById: id => (doc.written ? (els[id] || (els[id] = mkEl('div', id))) : null),
    createElement: t => mkEl(t),
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); }, _L: L,
  };
  const w = { closed: false, document: doc, focused: 0, focus(){ w.focused++; }, close(){ w.closed = true; env.childClosed++; }, els };
  return w;
}

function mkEnv(opt){
  opt = opt || {};
  const env = { toasts: [], warns: [], ls: {}, subs: [], unsubs: 0, adds: [], dels: [], claps: [], emojis: [], themed: [], wins: [], childClosed: 0,
    viewing: opt.viewing || null, friends: opt.friends || {}, me: 'uA', name: '나', btnL: null };
  const mainEls = {};
  const getEl = id => (opt.noDom ? null : (mainEls[id] || (mainEls[id] = mkEl('div', id))));
  const subs = {};   // 경로 → 콜백 (가짜 RTDB 구독)
  const ctx = {
    Math, JSON, String, Number, Array, Object, Promise, Map, Set, Date, Boolean, Error, isFinite, parseInt, parseFloat, Intl,
    console: { warn: (...a) => env.warns.push(a.join(' ')), log(){}, debug(){} },
    document: { getElementById: getEl, createElement: t => mkEl(t) },
    localStorage: { getItem: k => (k in env.ls ? env.ls[k] : null), setItem: (k, v) => { env.ls[k] = String(v); }, removeItem: k => { delete env.ls[k]; } },
    setTimeout: () => 0, clearTimeout(){},
    Image: class {}, FileReader: class {},
    companion: { gbHold(){ env.held = (env.held || 0) + 1; } },
    firebaseAPI: opt.noApi ? undefined : {
      subscribeGuestbook: (uid, cb) => { const k = 'gb:' + uid; env.subs.push(k); subs[k] = cb; return () => { env.unsubs++; delete subs[k]; }; },
      subscribeClap: (uid, cb) => { const k = 'clap:' + uid; env.subs.push(k); subs[k] = cb; return () => { env.unsubs++; delete subs[k]; }; },
      addGuestbookEntry: async (uid, en) => { if(env.failAdd) throw new Error('denied'); env.adds.push({ uid, en }); },
      deleteGuestbookEntry: async (uid, id) => { env.dels.push(uid + '/' + id); },
      clapOnce: (uid) => { env.claps.push(uid); return env.clapP || Promise.resolve(); },
      setClapEmoji: async (uid, v) => { env.emojis.push(uid + ':' + v); },
      setClapImage: async () => {},
    },
  };
  ctx.window = ctx;
  ctx.open = () => { if(opt.blocked) return null; const w = mkChildWin(env); env.wins.push(w); return w; };
  vm.createContext(ctx);
  vm.runInContext(MOD, ctx, { filename: 'guestbook.js' });
  env.ctx = ctx; env.els = mainEls; env.push = (k, v) => { if(subs[k]) subs[k](v); };
  env.mk = () => ctx.TwGuestbook.createGuestbook({
    getMyUserId: () => env.me,
    getDisplayName: () => env.name,
    toast: (m) => env.toasts.push(m),
    escHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    applyThemeToChildDoc: (d) => env.themed.push(d),
    mhViewingUserId: () => env.viewing,
    mhViewingDisplayName: () => '친구' + env.viewing,
    myHomeFriends: () => env.friends,
  });
  return env;
}
const sec = async (title, fn) => { say(title); try{ await fn(); }catch(e){ chk(false, '이 절을 못 돌았다 — ' + (e && e.stack || e)); } };
const HOOKS = ['_mhGbStartWatch', '_mhGbStopWatch', '_mhGbRefreshBadge', '_mhGbMarkAllRead', '_mhReSubscribeGuestbook', 'openMyGuestbook', '_mhGbRefreshWriteUI'];

(async () => {
await sec('── 1. 만들 때 — 버튼 연결 · window 고리', () => {
  const e = mkEnv(); const gb = e.mk();
  chk(HOOKS.every(n => typeof e.ctx[n] === 'function'), 'window 고리 일곱 — 부르는 곳(마이홈 열기 · 닫기 · 관람 · 친구 목록 · 런처)이 typeof 로 본다');
  chk(gb.open === e.ctx.openMyGuestbook && gb.startWatch === e.ctx._mhGbStartWatch && gb.stopWatch === e.ctx._mhGbStopWatch
    && gb.refreshBadge === e.ctx._mhGbRefreshBadge && gb.markAllRead === e.ctx._mhGbMarkAllRead
    && gb.reSubscribe === e.ctx._mhReSubscribeGuestbook && gb.refreshWriteUI === e.ctx._mhGbRefreshWriteUI, '반환값은 window 고리와 같은 함수');
  const btn = e.els.mhGuestbookBtn;
  chk(btn && (btn._L.click || []).length === 1 && btn._L.click[0] === gb.open, '#mhGuestbookBtn 클릭 = 방명록 창 열기 (한 번만)');
  chk(e.wins.length === 0 && e.subs.length === 0, '만들 때는 창도 구독도 안 연다');
  const e2 = mkEnv({ noDom: true }); let ok = true; try{ e2.mk(); }catch(_){ ok = false; }
  chk(ok && typeof e2.ctx.openMyGuestbook === 'function', 'DOM 이 없어도(#mhGuestbookBtn 없음) 조용히 — 고리는 건다');
});

await sec('── 2. 새 글 배지 — 자기 홈 관점', () => {
  const e = mkEnv(); e.mk(); const badge = e.ctx.document.getElementById('mhGuestbookBadge');
  e.ctx._mhGbStartWatch();
  chk(e.subs.join() === 'gb:uA', '마이홈을 열면 내 방명록을 구독한다');
  e.ctx._mhGbStartWatch();
  chk(e.subs.length === 1, '  두 번 불러도 구독은 하나');
  e.ls['tw.mhGbLastRead:uA'] = '100';
  e.push('gb:uA', { a: { ts: 50 }, b: { ts: 150 }, c: { ts: 200 } });
  chk(badge.textContent === '2' && !badge.classList.contains('hidden'), '마지막으로 본 뒤(tw.mhGbLastRead:uid) 글 수 — 2');
  const many = {}; for(let i = 0; i < 120; i++) many['k' + i] = { ts: 1000 + i };
  e.push('gb:uA', many);
  chk(badge.textContent === '99+', '100개 넘으면 99+');
  e.viewing = 'uB'; e.ctx._mhGbRefreshBadge();
  chk(badge.classList.contains('hidden'), '👀 친구 홈 관람 중엔 숨긴다 (만든 뒤에 바뀐 값을 본다 — 읽는 함수)');
  e.ctx._mhGbMarkAllRead();
  chk(e.ls['tw.mhGbLastRead:uA'] === '100', '  관람 중엔 «다 읽음» 을 안 쓴다');
  e.viewing = null; e.ctx._mhGbRefreshBadge();
  chk(badge.textContent === '99+' && !badge.classList.contains('hidden'), '자기 홈으로 돌아오면 다시 계산');
  e.ctx._mhGbMarkAllRead();
  chk(+e.ls['tw.mhGbLastRead:uA'] > 1e12 && badge.classList.contains('hidden'), '다 읽음 — 지금 시각을 적고 배지를 내린다');
  e.ctx._mhGbStopWatch();
  chk(e.unsubs === 1 && badge.classList.contains('hidden'), '마이홈을 닫으면 구독을 끊고 숨긴다');
  e.push('gb:uA', { z: { ts: 9e15 } });
  chk(badge.classList.contains('hidden'), '  끊은 뒤엔 안 켜진다');
  const e2 = mkEnv({ noApi: true }); e2.mk(); let ok = true; try{ e2.ctx._mhGbStartWatch(); }catch(_){ ok = false; }
  chk(ok && e2.subs.length === 0, 'firebaseAPI 가 없으면 조용히');
});

await sec('── 3. 창 — 열기 · 목록 · 관람 · 외부인', async () => {
  const e = mkEnv(); e.mk(); e.ls['tw.mhGbLastRead:uA'] = '0';
  e.ctx.openMyGuestbook();
  const w = e.wins[0], d = w && w.document;
  chk(!!w && /<div id="gbBody">/.test(d.written) && /<\/html>$/.test(d.written), '자식 창을 열어 GB_HTML 을 쓴다');
  chk(e.themed.length === 1 && e.themed[0] === d, '쓰자마자 applyThemeToChildDoc(자식 문서)');
  chk(d.getElementById('gbTitleText').textContent === '나 님의 방명록', '제목 — 내 이름');
  chk(e.subs.join() === 'gb:uA,clap:uA', '내 방명록 · 박수를 구독한다');
  chk(+e.ls['tw.mhGbLastRead:uA'] > 1e12, '창을 열면 새 글 배지는 다 읽음');
  chk(d.getElementById('gbInputRow').style.display === 'flex' && d.getElementById('gbGuestNote').style.display === 'none', '내 홈 — 입력칸이 보인다');
  chk(d.getElementById('gbImgSet').style.display === '' && d.getElementById('gbClapEmoji').style.display === '', '내 홈 — 이미지 등록 · 폭죽 칸이 보인다');
  chk(typeof d.getElementById('gbClose').onclick === 'function' && (d._L.keydown || []).length === 1, '✕ · ESC 로 닫기');
  e.push('gb:uA', { g1: { name: '밥', text: '<b>안녕</b>', ts: 10, uid: 'uB' }, g2: { name: '나', text: '두번째', ts: 20, uid: 'uA' } });
  const list = d.getElementById('gbList');
  chk(list.children.length === 2 && /두번째/.test(list.children[0].innerHTML) && /&lt;b&gt;안녕/.test(list.children[1].innerHTML), '목록 — 최신이 위 · 글은 escHtml 을 지난다');
  const delOf = (row) => row.querySelector('.gb-meta').children[0];
  chk(delOf(list.children[0]) && delOf(list.children[0]).textContent === '삭제' && !delOf(list.children[1]), '삭제 링크는 내가 쓴 글에만');
  await delOf(list.children[0]).onclick(); await flush();
  chk(e.dels.join() === 'uA/g2', '  삭제 — 홈 주인 경로의 그 글');
  e.push('clap:uA', { count: 7, img: 'data:x', emoji: '🎉' });
  chk(d.getElementById('gbClapTotal').textContent === 'TOTAL CLAP : 7' && d.getElementById('gbClapImg').style.display === 'block'
    && d.getElementById('gbClapEmoji').value === '🎉', '박수 구독 — 합계 · 이미지 · 폭죽 이모지');
  e.ctx.openMyGuestbook();
  chk(e.wins.length === 1 && w.focused >= 2, '이미 떠 있으면 새로 안 만들고 앞으로만');
  /* 👀 관람 — 홈 주인이 바뀌면 열린 창을 닫고 구독을 갈아끼운다 */
  e.viewing = 'uB'; e.friends = { uB: { name: '밥' } };
  e.ctx._mhReSubscribeGuestbook();
  chk(w.closed && e.unsubs === 2 && e.subs.slice(2).join() === 'gb:uB,clap:uB', '홈 주인이 바뀌면 열린 창을 닫고 친구 것을 구독(_mhViewingUserId 는 읽는 함수)');
  e.ctx.openMyGuestbook();
  const w2 = e.wins[1], d2 = w2.document;
  chk(d2.getElementById('gbTitleText').textContent === '친구uB 님의 방명록', '관람 — 제목은 그 사람');
  chk(d2.getElementById('gbImgSet').style.display === 'none' && d2.getElementById('gbClapEmoji').style.display === 'none' && d2.getElementById('gbClapFwLbl').style.display === 'none',
    '관람 — 이미지 등록 · 폭죽 칸 숨김');
  chk(d2.getElementById('gbInputRow').style.display === 'flex', '친구 홈이면 입력칸');
  chk(e.subs.length === 4, '  창을 다시 열어도 같은 주인이면 구독은 그대로');
  /* 🚪 외부인 — 친구 목록에 없는 홈 */
  w2.close(); e.viewing = 'uC'; e.ctx._mhReSubscribeGuestbook(); e.ctx.openMyGuestbook();
  const d3 = e.wins[2].document;
  chk(d3.getElementById('gbInputRow').style.display === 'none' && d3.getElementById('gbGuestNote').style.display === 'block', '🚪 친구가 아니면 입력칸 대신 안내줄');
  e.friends = { uB: {}, uC: {} };   // 친구 목록이 늦게 왔다 — app.js 는 다시 대입한다
  e.ctx._mhGbRefreshWriteUI();
  chk(d3.getElementById('gbInputRow').style.display === 'flex' && d3.getElementById('gbGuestNote').style.display === 'none', '  친구 목록이 오면 열린 창을 다시 칠한다(_myHomeFriends 는 읽는 함수)');
  e.wins[2].close();
  let ok = true; try{ e.ctx._mhGbRefreshWriteUI(); }catch(_){ ok = false; }
  chk(ok && e.wins.length === 3, '  창이 없으면 아무것도 안 한다(창을 열지 않는다)');
  const eb = mkEnv({ blocked: true }); eb.mk(); eb.ctx.openMyGuestbook();
  chk(eb.toasts[0] === '방명록 창을 열 수 없어요', '창이 막히면 안내');
});

await sec('── 4. 쓰기 · 박수 · 폭죽', async () => {
  const e = mkEnv(); e.mk(); e.ctx.openMyGuestbook();
  const d = e.wins[0].document, inp = d.getElementById('gbInput');
  chk(d.getElementById('gbSubmit').onclick && (inp._L.keydown || []).length === 1 && (inp._L.input || []).length === 1, '등록 버튼 · Enter · 입력하면 안내 치움');
  inp.value = '  안녕하세요  '; await d.getElementById('gbSubmit').onclick(); await flush();
  const a = e.adds[0];
  chk(a && a.uid === 'uA' && a.en.text === '안녕하세요' && a.en.name === '나' && a.en.uid === 'uA' && a.en.ts > 1e12 && inp.value === '', '등록 — 홈 주인에게 · 이름 · 글(다듬음) · 시각 · 내 uid · 칸 비움');
  inp.value = 'x'.repeat(150); inp.fire('keydown', { key: 'Enter' }); await flush();
  chk(e.adds[1] && e.adds[1].en.text.length === 100, '  Enter 로도 · 100자까지');
  e.failAdd = true; inp.value = '실패'; await d.getElementById('gbSubmit').onclick(); await flush();
  const msg = d.getElementById('gbMsg');
  chk(msg.style.display === 'block' && /등록에 실패했어요/.test(msg.textContent) && e.toasts.some(t => /등록에 실패했어요/.test(t)), '실패 — 창 안 안내줄과 토스트 둘 다');
  inp.fire('input'); chk(msg.style.display === 'none', '  다시 쓰기 시작하면 안내를 치운다');
  e.failAdd = false;
  /* 외부인은 쓰기 직전에 한 번 더 막는다 */
  e.viewing = 'uZ'; inp.value = '몰래'; const n0 = e.adds.length; await d.getElementById('gbSubmit').onclick(); await flush();
  chk(e.adds.length === n0 && inp.value === '' && e.toasts.indexOf('친구만 방명록을 남길 수 있어요') >= 0, '🚪 외부인 — 입력칸을 살려도 등록 직전에 막는다');
  e.viewing = null;
  /* 박수 — 하루 5번 · 보내는 중엔 또 안 보냄 · 실패하면 되돌림 */
  const box = d.getElementById('gbClapBox'); const key = 'gbClap:uA:' + new Date().toISOString().slice(0, 10);
  let release; e.clapP = new Promise(r => { release = r; });
  const p1 = box.onclick({ clientX: 10, clientY: 10 });
  const p2 = box.onclick({}); await flush();   // await 하지 않는다 — 막는 장치가 없으면 이 박수도 같은 응답을 기다리며 걸린다
  chk(e.claps.length === 1 && e.toasts.indexOf('박수를 보내는 중이에요 — 잠시만요 👏') >= 0 && e.ls[key] === '1', '보내는 중엔 또 안 보낸다 · 횟수는 먼저 올린다');
  release(); await p1; await p2; await flush(); e.clapP = null;
  chk(e.toasts.indexOf('👏 박수! (1/5)') >= 0, '  응답이 오면 «박수! (1/5)»');
  for(let i = 0; i < 4; i++){ await box.onclick({}); await flush(); }
  await box.onclick({});
  chk(e.claps.length === 5 && e.ls[key] === '5' && e.toasts.indexOf('박수는 하루에 5번까지만 칠 수 있어요 👏') >= 0, '하루 5번까지');
  e.ls[key] = '2'; e.clapP = Promise.reject(new Error('net')); e.clapP.catch(() => {});
  await box.onclick({}); await flush();
  chk(e.ls[key] === '2' && e.toasts.indexOf('박수 실패 — 네트워크를 확인해 주세요') >= 0, '실패하면 올렸던 횟수를 되돌린다');
  e.clapP = null;
  /* 🎆 폭죽 — 한 글자만 · 바뀌었을 때만 저장 */
  const em = d.getElementById('gbClapEmoji');
  em.value = '🎊🎉 축하'; await em.onchange(); await flush();
  chk(em.value === '🎊' && e.emojis.join() === 'uA:🎊' && e.toasts.indexOf('🎊 폭죽으로 바꿨어요') >= 0, '폭죽 이모지는 한 글자만 · 내 uid 로 저장');
  const body = d.getElementById('gbBody');
  chk(body.children.length === 16 && body.children.every(s => s.className === 'gb-fw' && s.textContent === '🎊'), '  바꾸면 바로 터뜨려 본다(조각 16개)');
  await em.onchange(); await flush();
  chk(e.emojis.length === 1, '  안 바뀌었으면 저장 안 함');
  d.getElementById('gbImgSet').onclick();
  chk(e.held === 1 && d.getElementById('gbClapImgFile').clicked === 1, '이미지 등록 — 창이 안 닫히게 유예하고 자식 창의 파일 칸을 누른다');
});

await sec('── 5. app.js 배선', () => {
  const code = strip(APP);
  chk(!/function (bindGuestbook|bindGuestbookBadge|_gbIsOutsider|_gbApplyWriteUI|_gbSubscribeIfNeeded|_gbAlive|gbFirstGrapheme|gbBurst|gbSay)\(|\bconst GB_HTML\b|window\.(openMyGuestbook|_mhGb\w+|_mhReSubscribeGuestbook)\s*=(?!=)/.test(code),
    '방명록 정의 · 고리 등록은 app.js 에 없다(모듈에만)');
  chk(/const GB_HTML = /.test(MOD) && /window\.openMyGuestbook=open;/.test(MOD) && /window\.TwGuestbook = api/.test(MOD), '모듈에 GB_HTML · 고리 · window.TwGuestbook');
  chk((code.match(/TwGuestbook\.createGuestbook\(/g) || []).length === 1, 'createGuestbook 은 한 곳');
  const iMk = APP.indexOf('TwGuestbook.createGuestbook('), iPrev = APP.indexOf('🎨 스티커 관리 창'), iNext = APP.indexOf('const CHAT_BUBBLE_MS = 5000;');
  chk(iPrev > 0 && iMk > iPrev && iNext > iMk, '원래 자리 — 🎨 스티커 관리 창 뒤 · 💬 말풍선(showChatBubble) 앞');
  chk(/function showChatBubble\(seat, text\)/.test(APP) && !/showChatBubble/.test(strip(MOD)), '💬 showChatBubble 은 app.js 에 남는다');
  const call = (APP.match(/TwGuestbook\.createGuestbook\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(Boolean);
  chk(deps.length === 8 && deps.every(l => /^\w+: (\(\)=>|\(\.\.\.a\)=>)/.test(l)), 'deps 8개 — 전부 화살표로 감싼다(부를 때 찾게) (' + deps.length + ')');
  chk(/mhViewingUserId: \(\)=>_mhViewingUserId,/.test(call) && /myHomeFriends: \(\)=>_myHomeFriends,/.test(call), '다시 대입되는 let(_mhViewingUserId · _myHomeFriends)은 읽는 함수로');
  const m = strip(MOD);
  chk(!/_mhViewingUserId(?!\s*\(|!==|\s*===)/.test(m.replace(/const _mhViewingUserId = deps\.mhViewingUserId;/, '')) && !/_myHomeFriends(?!\s*\(| !==)/.test(m.replace(/const _myHomeFriends = deps\.myHomeFriends;/, '')),
    '모듈 본문은 읽는 함수만 부른다(값으로 쓰면 함수가 늘 참이 된다)');
  const off = (APP.match(/const GUESTBOOK_OFF = \{([\s\S]*?)\};/) || [])[1] || '';
  const ret = (MOD.match(/return \{\n  open: window\.openMyGuestbook,([\s\S]*?)\n\};/) || [])[0] || '';
  const names = [...ret.matchAll(/^\s+(\w+): window\./gm)].map(x => x[1]);
  chk(names.length === 7 && names.every(n => new RegExp('\\b' + n + '\\(').test(off)), '빈 껍데기 GUESTBOOK_OFF 가 반환값 이름을 다 갖는다 (' + names.join(' · ') + ')');
  const calls = (code.match(/typeof (window\.)?(_mhGb\w+|_mhReSubscribeGuestbook)\s*===\s*'function'/g) || []).length;
  chk(calls === 8, '부르는 곳(친구 목록 · 마이홈 열기 · 닫기 · 관람 시작 · 끝 · 런처로)은 window 고리를 typeof 로 본다 — 모듈이 없으면 조용히 넘어간다 (' + calls + ')');
  const iG = HTML.indexOf('<script src="parts/guestbook.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iG > 0 && iG < iA, 'html — guestbook.js 를 app.js 앞에 싣는다');
  /* #103 교훈 — 크로미움 내장 전역(Scheduler 등)과 겹치면 typeof 가드가 늘 통과한다. 접두사로 피한다(헤드리스 크로미움에서 typeof 확인) */
  chk(/^Tw[A-Z]/.test('TwGuestbook') && !/window\.Guestbook\s*=/.test(MOD), '전역 이름은 Tw 접두사');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
done = true;
process.exit(fail ? 1 : 0);
})();
/* 기다리던 약속이 영영 안 풀려 이벤트 고리가 비면 node 는 0 으로 조용히 끝난다 — 판정 줄 없이 끝나면 빨강 */
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다 — 기다리던 응답이 오지 않았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });

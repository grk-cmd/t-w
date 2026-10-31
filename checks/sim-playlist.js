/* ═══ 🎵 sim-playlist.js — 상태칩 플레이리스트 모듈 (2026-10-13 신설 · 앱 FSD 16번) ═══════════════
   app.js 의 다섯 구역(«🎵 상태칩 플레이리스트» · «🎵 프리셋 세 벌» · «🎵 플레이리스트 화면» · «🎵 프리셋 고르기» · «🐕 재생 감시견»)을
   parts/status/playlist.js 로 옮겼다. 동작은 그대로여야 한다 — 가짜 DOM · 가짜 시계 위에서 굴린다.
   ・1절: 만들 때 — 싣기만 하면 window.TwPlaylist 뿐 · DOM 이 없으면 버튼 연결 없이 끝남 · DOM 이 있으면 저장값 읽기 · ESC 등록 ·
           BGM 신호 구독 · 300ms 폴링 · 음량 한 번 · 🪟 창 위치 초기화 등록 · window 고리 셋
   ・2절: 프리셋 저장값 — 관문(세 벌 · 16자 · 20곡 · url 복원 · 문자열만 이름) · 옛 목록 이관 · 반복 옛 키 이어받기 · 음량 깎기 ·
           공개 · 비공개는 '1' 일 때만 · 저장은 프리셋 0 거울까지
   ・3절: 목록 — ＋ 추가(제목 자동 · 직접 · 중복 · 상한) · ⌦ Delete(열려 있고 · 입력칸 아님 · 읽기 전용 아님) · 곡 수 · 프리셋 고르기 · 이름 고치기
   ・4절: 재생 — ▶ 곡 열기(주소 · 창 제목 · loop 알림 · 음량 재전송) · ▐▐ · ■ · ⏭(한 곡 반복 무시 · 실패 수 지움) · 곡 끝 신호(ended · err · loop · hb) ·
           반복 끔 · 목록 반복 · 프리셋 갈아타기(다음 곡부터) · 창 소유권 · 창 닫힘 · 반복 버튼(좌 · 우클릭)
   ・5절: 파도타기 · 담기 · 비공개 · 서버 사본 — 무작위 · 친구 지목 · ← 내 목록(곡은 계속) · 담기 · 3초 debounce · 지문 · 빈 목록이면 지움 · 🔒
   ・6절: 🐕 재생 감시견 — 신호 없음 30초 · 끝에서 신호 놓침(정상 종료) · 끝에 선 채 재생 없음(실패) · 일시정지 중엔 판정 안 함 · 실패가 목록 길이면 멈춤
   ・7절: 상태 묶음 · window 고리 — st 의 getter · setter 가 모듈 상태와 같은 칸 · 창 위치 고리
   ・8절: app.js 배선 — 정의는 모듈에만 · 만드는 곳 한 곳 · 원래 자리(머리 다섯 · 👤 · 🏅 는 남김) · deps 모양 · 빈 껍데기 · 부르는 곳 · html 순서 · 전역 이름
   ・9절: 일부러 깨 보기 — 모듈 · app.js · html 글을 조금씩 망가뜨려 2~8절이 잡아내는지(이 검사가 헛돌지 않는지) 스스로 확인
   [실행] playlist.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
globalThis.TwSafeHtml = require([__dirname, process.cwd()].flatMap(d => ['safe-html.js', 'parts/shared/safe-html.js', 'app/parts/shared/safe-html.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));   // 🛡️ 모듈이 부르는 공용 씻기 — 진짜 파일
const _MI_JOIN = require('./sim-renderer-src.js').joinRenderer;   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['playlist.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ console.log('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const flush = () => new Promise(r => setImmediate(r));

/* ── 가짜 DOM — 이 모듈이 쓰는 만큼만 ── */
function mkEl(tag, env){
  const L = {};
  let txt = '';
  const el = {
    tagName: String(tag || 'div').toUpperCase(), id: '', className: '', title: '', value: '', checked: false, disabled: false, children: [], parentNode: null,
    _L: L, _html: '', attrs: {}, rect: null,
    style: { setProperty(k, v){ this[k] = String(v); }, removeProperty(k){ delete this[k]; } },
    get textContent(){ return txt + el.children.map(c => c.textContent).join(''); },
    set textContent(v){ txt = String(v); el.children = []; },
    get innerHTML(){ return el._html; },
    set innerHTML(v){ el._html = String(v); txt = ''; el.children = []; },
    get firstElementChild(){ return el.children[0] || null; },
    get lastElementChild(){ return el.children[el.children.length - 1] || null; },
    get offsetWidth(){ return el.rect ? el.rect.width : 0; },
    get offsetHeight(){ return el.rect ? el.rect.height : 0; },
    get clientWidth(){ return el.rect ? el.rect.width : 0; },
    classList: {
      add: (...cs) => { const s = new Set(el.className.split(/\s+/).filter(Boolean)); cs.forEach(c => s.add(c)); el.className = [...s].join(' '); },
      remove: (...cs) => { el.className = el.className.split(/\s+/).filter(x => x && !cs.includes(x)).join(' '); },
      contains: (c) => el.className.split(/\s+/).includes(c),
      toggle: (c, f) => { const on = f === undefined ? !el.classList.contains(c) : !!f; on ? el.classList.add(c) : el.classList.remove(c); return on; },
    },
    appendChild(c){ if(c.parentNode) c.parentNode.removeChild(c); c.parentNode = el; el.children.push(c); return c; },
    removeChild(c){ el.children = el.children.filter(x => x !== c); c.parentNode = null; return c; },
    insertBefore(c, ref){ c.parentNode = el; const i = el.children.indexOf(ref); i < 0 ? el.children.push(c) : el.children.splice(i, 0, c); return c; },
    remove(){ if(el.parentNode) el.parentNode.removeChild(el); el.removed = true; },
    contains(n){ for(let x = n; x; x = x.parentNode) if(x === el) return true; return false; },
    closest(sel){ const opts = sel.split(',').map(s => s.trim().split('.').filter(Boolean)); for(let x = el; x; x = x.parentNode){ const cs = x.className.split(/\s+/); if(opts.some(o => o.every(c => cs.includes(c)))) return x; } return null; },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
    removeEventListener(t, fn){ L[t] = (L[t] || []).filter(f => f !== fn); },
    fire(t, ev){ const e = Object.assign({ target: el, button: 0, preventDefault(){ e._pd = true; }, stopPropagation(){ e._sp = true; } }, ev || {}); (L[t] || []).slice().forEach(fn => fn(e)); if(t === 'click' && el.onclick) el.onclick(e); return e; },
    setAttribute(k, v){ el.attrs[k] = String(v); }, getAttribute(k){ return el.attrs[k]; },
    focus(){ env.doc.activeElement = el; }, select(){},
    getBoundingClientRect(){ const r = el.rect || { left: 0, top: 0, width: 0, height: 0 }; return { left: r.left || 0, top: r.top || 0, width: r.width, height: r.height, right: (r.left || 0) + r.width, bottom: (r.top || 0) + r.height }; },
    querySelectorAll(sel){
      const opts = sel.split(',').map(s => s.trim().split('.').filter(Boolean)), out = [];
      const walk = (n) => n.children.forEach(c => { const cs = c.className.split(/\s+/); if(opts.some(o => o.every(w => cs.includes(w)))) out.push(c); walk(c); });
      walk(el); return out;
    },
    querySelector(sel){ return el.querySelectorAll(sel)[0] || null; },
  };
  return el;
}
const IDS = ['myPlBtn', 'myPlaylistBox', 'myPlHead', 'myPlTitle', 'myPlClose', 'myPlMin', 'myPlList', 'myPlCount', 'myPlAdd', 'myPlBack', 'myPlSetBar', 'myPlSetBtn',
  'myPlSetNm', 'myPlSetPick', 'myPlFriendPick', 'myPlPeek', 'myPlPrivWrap', 'myPlPriv', 'myPlPlay', 'myPlStop', 'myPlNext', 'myPlLoop', 'myPlVol', 'myPlProfile',
  'myPlNick', 'myPlLv', 'myPlAva', 'myPlHeadAva', 'myPlPubWrap', 'myPlPub', 'myPlHint', 'myPlBioView', 'myPlBioEdit', 'myPlNow'];
function mkEnv(o){
  o = o || {};
  const env = { refreshed: [], onRefresh: null, t: 1000000, timers: [], tid: 0, calls: [], toasts: [], store: new Map(Object.entries(o.store || {})), esc: [], prompts: (o.prompts || []).slice(),
    titles: o.titles || {}, cards: {}, rand: 0.5, front: [], chipClosed: [], reposition: 0, home: [], friends: o.friends || {}, cb: {}, warns: [], errors: [], errArgs: [] };
  const byId = {};
  const doc = {
    activeElement: null, _L: {},
    body: null,
    getElementById(id){ return byId[id] || null; },
    createElement(t){ return mkEl(t, env); },
    createTextNode(t){ return { textContent: String(t), className: '', children: [], parentNode: null }; },
    addEventListener(t, fn, cap){ (doc._L[t] = doc._L[t] || []).push(fn); },
    removeEventListener(t, fn){ doc._L[t] = (doc._L[t] || []).filter(f => f !== fn); },
    fire(t, ev){ const e = Object.assign({ preventDefault(){ e._pd = true; }, stopPropagation(){ e._sp = true; } }, ev || {}); (doc._L[t] || []).slice().forEach(fn => fn(e)); return e; },
    querySelectorAll(sel){ return doc.body.querySelectorAll(sel); },
  };
  env.doc = doc; env.byId = byId;
  doc.body = mkEl('body', env);
  if(!o.noDom){
    for(const id of IDS){ const e = mkEl(id === 'myPlBioEdit' || id === 'myPlVol' || id === 'myPlPub' || id === 'myPlPriv' ? 'input' : 'div', env); e.id = id; byId[id] = e; }
    byId.myPlaylistBox.className = 'hidden';
    byId.myPlaylistBox.rect = { left: 500, top: 300, width: 236, height: 240 };
    byId.myPlBioEdit.style.display = 'none';
    /* <div id="myPlNow"><span class="plnIco">♪</span><span class="tt mq"><span class="mqIn"><span></span></span></span></div> */
    const ico = mkEl('span', env); ico.className = 'plnIco'; byId.myPlNow.appendChild(ico);
    const tt = mkEl('span', env); tt.className = 'tt mq'; byId.myPlNow.appendChild(tt);
    const mi = mkEl('span', env); mi.className = 'mqIn'; tt.appendChild(mi); mi.appendChild(mkEl('span', env));
  }
  const setTimeout_ = (fn, ms) => { const id = ++env.tid; env.timers.push({ id, fn, at: env.t + (ms || 0) }); return id; };
  const clearTimeout_ = (id) => { env.timers = env.timers.filter(x => x.id !== id); };
  const setInterval_ = (fn, ms) => { const id = ++env.tid; env.timers.push({ id, fn, at: env.t + ms, every: ms }); env.calls.push('setInterval ' + ms); return id; };
  env.advance = async (ms) => {
    const end = env.t + ms;
    for(;;){
      const due = env.timers.filter(x => x.at <= end).sort((a, b) => a.at - b.at)[0];
      if(!due) break;
      env.t = due.at;
      if(due.every) due.at += due.every; else env.timers = env.timers.filter(x => x !== due);
      await due.fn();
      await flush();
    }
    env.t = end;
  };
  const api = o.noApi ? undefined : {   // 옛 길에 남은 것 — 명함 읽기뿐
    fetchPlaylistCard: async (uid) => { env.calls.push('card ' + uid); return env.cards[uid] || null; },
  };
  /* 🌐 서버 길 provider(playlist-api.js)의 가짜 — 모양은 진짜와 같다(내 목록 / 저장 / 무작위 / 남의 목록). 막히면(noApi) 던진다 */
  const down = async () => { throw new Error('서버 길 막힘'); };
  const playlistApi = o.noApi ? { fetchMine: down, saveMine: down, fetchRandom: down, fetchOf: down } : {
    saveMine: async (uid, sets, meta) => { const empty = sets.every(s => !s.items.length); env.calls.push((empty ? 'removePl ' : 'publish ') + uid + ' ' + JSON.stringify(sets.map(s => s.items.length)) + ' ' + JSON.stringify(meta)); if(env.saveHold) await env.saveHold; return env.saveRes || 'ok'; },
    fetchRandom: async (ex) => { env.calls.push('random ' + ex); return env.randomPl || null; },
    fetchMine: async (uid) => { env.calls.push('fetchMine ' + uid); if(env.fetchHold) await env.fetchHold; if(env.srvThrow) throw Object.assign(new Error('끊김'), env.srvCode ? { code: env.srvCode } : {}); return env.srv === undefined ? { sets: [{ name: '', items: [] }, { name: '', items: [] }, { name: '', items: [] }], bio: '', homePublic: false, private: false } : env.srv; },
    fetchOf: async (uid) => { env.calls.push('of ' + uid); return env.plOf ? env.plOf[uid] || null : null; },
  };
  const comp = o.noCompanion ? undefined : {
    openPlaylistTrack: (url, title) => env.calls.push('open ' + url + ' | ' + title),
    closeBgm: () => env.calls.push('closeBgm'), pauseBgm: () => env.calls.push('pause'), resumeBgm: () => env.calls.push('resume'),
    setBgmVolume: (v) => env.calls.push('vol ' + v), setBgmLoop: (on) => env.calls.push('loop ' + on),
    setPlBounds: (r) => env.calls.push('bounds ' + (r ? [r.x, r.y, r.w, r.h].join(',') : 'null')), openBrowser: (u) => env.calls.push('browser ' + u),
    onBgmTrackEnd: (cb) => { env.cb.end = cb; }, onBgmMode: (cb) => { env.cb.mode = cb; }, onBgmClosed: (cb) => { env.cb.closed = cb; },
  };
  env.winL = [];
  const win = { companion: comp, firebaseAPI: api, addEventListener: (t, fn) => { if(t === 'beforeunload') env.winL.push(fn); } };
  const ls = { getItem: (k) => env.store.has(k) ? env.store.get(k) : null, setItem: (k, v) => env.store.set(k, String(v)), removeItem: (k) => env.store.delete(k) };
  const fetch_ = async (u) => { env.calls.push('fetch'); const m = /v%3D([\w-]{11})/.exec(u); const t = m && env.titles[m[1]]; if(t === 'throw') throw new Error('off'); return { ok: !!t, json: async () => ({ title: t }) }; };
  const MathX = Object.create(Math); MathX.random = () => env.rand;
  const DateX = { now: () => env.t };
  const con = { log: () => {}, warn: (m) => env.warns.push(String(m)) };
  const nav = { clipboard: { writeText: (t) => env.calls.push('copy ' + t) } };
  new Function('window', 'module', 'document', 'localStorage', 'firebaseAPI', 'companion', 'navigator', 'fetch', 'requestAnimationFrame',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'innerWidth', 'innerHeight', 'console', 'Date', 'Math', o.src || SRC['playlist.js'])
    (win, undefined, doc, ls, api, comp, nav, fetch_, (fn) => fn(), setTimeout_, clearTimeout_, setInterval_, clearTimeout_, 1280, 720, con, DateX, MathX);
  env.win = win;
  env.mk = (extra) => {
    env.m = win.TwPlaylist.createPlaylist(Object.assign({
      toast: (m) => env.toasts.push(String(m)), getMyUserId: () => 'ME01', getDisplayName: () => '나나',
      asyncPrompt: async (p) => { env.calls.push('prompt ' + p.title); return env.prompts.length ? env.prompts.shift() : null; },
      getFocusLevel: () => 42, myFocusShow: () => null, starFromRemote: (c) => (c && c.star) ? { cyc: 2, lv: 7, color: c.star } : null,
      lvBadgeClass: (n) => 'lv' + n, lvStarBadgeClass: () => 'lv-star lvx', lvStarStr: (n) => '★' + n, starPaint: () => {},
      myHomeLoaded: () => !!env.homeLoaded, myHomeData: () => env.homeData || null, myHomeFriends: () => env.friends,
      friendsRefreshPresence: (ids) => { env.refreshed.push(ids.slice().sort().join()); return Promise.resolve().then(() => { if(env.onRefresh) env.onRefresh(); }); },
      openFriendHomeView: (uid, nm) => env.home.push(uid + ' ' + nm),
      closeChipPopups: (id) => env.chipClosed.push(id), repositionOpenChipPopups: () => { env.reposition++; },
      bringWinToFront: (id) => env.front.push(id), escRegisterWindow: (w) => env.esc.push(w), escEditable: (t) => !!(t && t.tagName === 'INPUT'),
      playlistApi, notifyError: (c, err) => { env.errors.push(c); env.errArgs.push(err); },
    }, extra || {}));
    return env.m;
  };
  env.last = (p) => env.calls.filter(c => c.indexOf(p) === 0).slice(-1)[0];
  env.count = (p) => env.calls.filter(c => c.indexOf(p) === 0).length;
  return env;
}
const songs = (n, pre) => Array.from({ length: n }, (_, i) => ({ id: (pre || 'v') + String(i).padStart(10, '0'), title: '곡 ' + i }));
const setsOf = (a, b, c) => JSON.stringify([{ name: '', items: a || [] }, { name: '', items: b || [] }, { name: '', items: c || [] }]);

/* 2~7절 — 9절(일부러 깨 보기)이 망가뜨린 글로 다시 굴린다 */
async function behave(src){
  /* 목록이 미리 앉아 있는 상태로 시작하는 도우미 — store 의 'tw.playlistSets'(검사 안에서만 쓰는 이름)를 «서버가 이미 가진 목록» 으로 바꿔
     진짜 부팅 받기로 앉힌다(await 필요). 모듈 자체는 그 키를 읽지 않는다(1절 · 2절 · 5-2절이 확인) */
  const E = (o) => {
    const e = mkEnv(Object.assign({ src }, o || {}));
    const mk0 = e.mk;
    e.mk = (x) => {
      const seed = e.store.get('tw.playlistSets');
      if(seed == null) return mk0(x);
      e.store.delete('tw.playlistSets');
      if(e.srv === undefined) e.srv = { sets: JSON.parse(seed), bio: '', homePublic: false, private: false };
      const m = mk0(x);
      return flush().then(() => { m.st.pubSig = null; return m; });   // 받은 지문을 비워 첫 저장이 올라가게(저장 쪽 판정용)
    };
    return e;
  };

  say('── 2. 프리셋 저장값');
  {
    const e = E(); const m = await e.mk();
    const n = m.normalizeSets([{ name: '가나다라마바사아자차카타파하가나다', items: songs(25).map(s => ({ id: s.id, title: s.title })) }, { name: { x: 1 }, items: 'bad' }, null, { name: 'x', items: [] }]);
    chk(n.length === 3 && n[0].items.length === 20 && n[0].name.length === 16, '관문 — 세 벌 · 이름 16자 · 곡 20개로 깎는다');
    chk(n[0].items[0].url === 'https://www.youtube.com/watch?v=' + songs(1)[0].id && n[1].name === '' && n[1].items.length === 0 && n[2].name === '', '  url 없으면 id 로 복원 · 이름은 문자열만 · 깨진 벌은 빈 벌');
    chk(m.setIdx('2') === 2 && m.setIdx(7) === 0 && m.setIdx(null) === 0, '  프리셋 번호 보정 — 범위 밖 · 깨진 값은 0');
  }
  {
    const e0 = mkEnv({ src, store: { 'tw.playlistSets': setsOf(songs(1)) } }); const m0 = e0.mk();
    chk(m0.state().sets.every(x => !x.items.length), '★ 이 기기에 옛 목록 키(tw.playlistSets)가 있어도 읽지 않는다');
  }
  {
    const e = E({ store: { 'tw.playlist': JSON.stringify(songs(2)), 'tw.playlistTitle': '옛 이름', 'tw.playlistLoopMode': '3', 'tw.playlistVol': '250', 'tw.playlistHomePublic': 'true', 'tw.playlistPrivate': '1', 'tw.playlistCur': '9' } });
    const m = e.mk(); const s = m.state();
    chk(s.sets.length === 3 && s.sets.every(x => !x.items.length && x.name === ''), '★ 옛 목록 키(tw.playlist · tw.playlistTitle)는 읽지 않는다 — 목록은 서버에서만 온다');
    chk(s.on === true && s.kind === 2, '  반복 옛 키(네 상태 한 축) 이어받기 — 3 = 셔플 켬');
    chk(s.vol === 100 && s.cur === 0 && s.nowSet === 0, '  음량 0~100 으로 깎기 · 깨진 프리셋 번호는 0');
    chk(s.homePublic === false && s.private === false && s.bio === '' && !s.loaded, '  옛 공개 · 비공개 키도 읽지 않는다(서버가 원본) — 받기 전엔 꺼짐');
  }
  {
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(1), songs(3, 'b')), 'tw.playlistCur': '1', 'tw.playlistLoopKind': '1', 'tw.playlistLoopOn': '1', 'tw.playlistMini': '1', 'tw.playlistPos': '{"x":10,"y":20}' } });
    const m = await e.mk(); const s = m.state();
    chk(s.cur === 1 && s.nowSet === 1 && s.kind === 1 && s.on && s.mini && s.pos.x === 10, '새 키 — 보는 프리셋 · 반복 · 미니미 · 창 자리');
    m.save();
    chk(!e.store.has('tw.playlist') && !e.store.has('tw.playlistSets') && !e.store.has('tw.playlistBio') && e.store.get('tw.playlistCur') === '1' && e.store.get('tw.playlistLoopMode') === '2' && e.store.get('tw.playlistLoop') === '1',
      '★ 저장 — 목록 키는 쓰지 않는다 · 보는 프리셋 · 반복(옛 키도 같이)은 기기 설정으로 쓴다');
    chk(e.byId.myPlaylistBox.classList.contains('mini') && e.byId.myPlMin.textContent === '□', '  미니미로 껐으면 그 상태로 열린다');
  }

  say('── 3. 목록');
  {
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(2)) } }); const m = await e.mk();
    e.byId.myPlBtn.fire('click');
    chk(!e.byId.myPlaylistBox.classList.contains('hidden') && e.chipClosed[0] === 'myPlaylistBox' && e.front[0] === 'myStatusChip' && e.reposition === 1, '[🎵] 누르면 열림 · 다른 칩 팝업 닫기 · 칩째 맨 앞 · 자리 계산');
    chk(e.count('card ME01') === 1 && e.byId.myPlList.children.length === 2 && e.byId.myPlCount.textContent === '2/20', '  내 명함은 처음 열 때 한 번 읽는다 · 행 2개 · «2/20»');
    e.byId.myPlBtn.fire('click'); e.byId.myPlBtn.fire('click');
    chk(e.count('card ME01') === 1, '  다시 열어도 명함은 또 안 읽는다');
    e.titles = { NEWVIDEO001: '새 노래' };
    e.prompts.push('https://youtu.be/NEWVIDEO001');
    e.byId.myPlAdd.fire('click'); await flush(); await flush();
    chk(m.state().sets[0].items.length === 3 && m.state().sets[0].items[2].title === '새 노래' && m.state().sel === 2, '＋ — 링크 → 제목 자동 조회 → 추가 · 새 곡을 고른다');
    e.prompts.push('https://www.youtube.com/watch?v=NEWVIDEO001');
    e.byId.myPlAdd.fire('click'); await flush(); await flush();
    chk(m.state().sets[0].items.length === 3 && e.toasts.slice(-1)[0] === '이미 이 프리셋에 있어요', '  같은 곡은 안 들어간다');
    e.titles = { OFFLINEV001: 'throw' }; e.prompts.push('https://youtu.be/OFFLINEV001', '  직접 쓴 제목  ');
    e.byId.myPlAdd.fire('click'); await flush(); await flush(); await flush();
    chk(m.state().sets[0].items[3].title === '직접 쓴 제목', '  자동 조회가 안 되면 직접 묻는다(실패가 «추가 실패» 가 아니다)');
    e.prompts.push('그냥 글자'); e.byId.myPlAdd.fire('click'); await flush();
    chk(e.toasts.slice(-1)[0] === '유튜브 링크를 인식하지 못했어요', '  유튜브가 아니면 알린다');
    m.st.sel = 0;
    const inp = mkEl('input', e);
    e.doc.fire('keydown', { key: 'Delete', target: inp });
    chk(m.state().sets[0].items.length === 4, '⌦ 입력칸에서 누른 Delete 는 안 먹는다');
    const ev = e.doc.fire('keydown', { key: 'Delete', target: e.doc.body });
    chk(m.state().sets[0].items.length === 3 && ev._pd && m.state().sel === 0, '★ Delete — 고른 곡을 지운다(버튼 없음)');
    e.byId.myPlClose.fire('click');
    e.doc.fire('keydown', { key: 'Delete', target: e.doc.body });
    chk(m.state().sets[0].items.length === 3 && e.byId.myPlaylistBox.classList.contains('hidden'), '  창이 닫혀 있으면 Delete 를 가로채지 않는다');
    chk(e.esc.length === 1 && e.esc[0].key === 'playlist' && e.esc[0].isOpen() === false, '⎋ ESC 스택에 «playlist» 로 올라가 있다');
  }
  {
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(20)) } }); const m = await e.mk();
    e.byId.myPlAdd.fire('click'); await flush();
    chk(e.count('prompt') === 0 && e.toasts[0] === '프리셋 1 은 20곡까지예요', '상한 — 프리셋당 20곡이면 묻지도 않는다');
    e.byId.myPlSetBtn.fire('click');
    const rows = e.byId.myPlSetPick.children;
    chk(rows.length === 3 && rows[0].className === 'psRow cur' && rows[0].textContent.indexOf('●') === 0 && rows[1].textContent.indexOf('프리셋 2') >= 0, '[프리셋 ▼] — 세 줄 · 지금 보는 줄에 ●');
    rows[1].fire('click');
    chk(m.state().cur === 1 && m.state().sel === -1 && e.store.get('tw.playlistCur') === '1' && !e.byId.myPlSetPick.classList.contains('on'), '  고르면 보는 프리셋만 바뀐다 · 고른 곡 초기화 · 저장 · 목록 닫힘');
    e.byId.myPlSetBtn.fire('click');
    const ed = e.byId.myPlSetPick.children[2].querySelector('.ed');
    ed.fire('click');
    const box = e.byId.myPlSetPick.children[2].querySelector('.edin');
    box.value = '  출근길 노래 모음 아주 길게 써 본 이름  ';
    box.fire('keydown', { key: 'Enter' });
    chk(m.state().sets[2].name === '출근길 노래 모음 아주 길게 써 본'.slice(0, 16) && m.state().cur === 1, '✏️ [수정] — 그 자리에서 이름(16자) · 보는 프리셋은 안 바뀐다');
    chk(m.setLabel(2) === m.state().sets[2].name && m.setLabel(0) === '프리셋 1', '  이름이 없으면 «프리셋 n»');
  }

  say('── 4. 재생');
  {
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(3), songs(2, 'b')), 'tw.playlistVol': '30' } }); const m = await e.mk();
    chk(e.last('vol') === 'vol 0.3' && e.count('setInterval 300') === 1, '만들 때 — 음량 한 번 · 재생 창 사각형 300ms 폴링');
    e.byId.myPlBtn.fire('click');
    e.byId.myPlPlay.fire('click');
    chk(e.last('open') === 'open https://www.youtube.com/watch?v=' + songs(3)[0].id + ' | 🎵 플레이리스트' && m.state().now === 0 && m.state().playing, '▶ — 첫 곡을 연다(창 제목 = 목록 이름)');
    chk(e.calls.indexOf('loop false') >= 0 && e.calls.indexOf('loop false') < e.calls.indexOf(e.last('open')), '  🔁 loop 여부는 곡을 열기 **전에** 알린다');
    const v0 = e.count('vol');
    chk(e.calls.indexOf(e.last('open')) < e.calls.lastIndexOf('vol 0.3'), '  🔊 곡을 열고 바로 음량을 보낸다');
    await e.advance(3000);
    chk(e.count('vol') - v0 === 6, '  🔊 새 곡 — 2.4초 안에 6번 더 보낸다(새 페이지의 <video> 기본값 100% 방지)');
    chk(e.last('bounds') === 'bounds 500,300,236,240', '  재생 중이면 패널 사각형을 main 에 알린다(창이 패널 뒤에 숨게)');
    e.byId.myPlPlay.fire('click');
    chk(e.last('pause') && !m.state().playing && m.state().now === 0, '▐▐ — 창은 두고 영상만 멈춤');
    e.byId.myPlPlay.fire('click');
    chk(e.last('resume') && m.state().playing, '  ▶ — 이어서');
    e.cb.end('ended');
    chk(m.state().now === 1 && e.last('open').indexOf(songs(3)[1].id) > 0, '곡 끝(ended) — 다음 곡');
    e.cb.end('ended'); e.cb.end('ended');
    chk(m.state().now === -1 && e.last('closeBgm') && e.toasts.slice(-1)[0] === '🎵 목록이 끝났어요', '  반복 끔 — 마지막 곡에서 멈춘다');
    e.byId.myPlLoop.fire('click');
    chk(m.state().on && e.last('loop') === 'loop false' && e.toasts.slice(-1)[0] === '🎵 목록 반복', '🔁 좌클릭 — 켬(목록 반복)');
    e.byId.myPlLoop.fire('contextmenu');
    chk(m.state().kind === 1 && e.last('loop') === 'loop true' && e.byId.myPlLoop.title.indexOf('한 곡 반복 · 켬') === 0, '  우클릭 — 종류만 바꾼다(한 곡 반복 → main 에 loop)');
    m.playFrom(2);
    e.cb.end('ended');
    chk(m.state().now === 2 && e.last('open').indexOf(songs(3)[2].id) > 0, '  한 곡 반복 · 자동 — 같은 곡을 다시 연다');
    const o0 = e.count('open');
    e.cb.end('loop');
    chk(m.state().errStreak === 0 && m.state().now === 2 && e.count('open') === o0, '  loop 한 바퀴 신호 — 곡을 다시 열지 않는다');
    e.byId.myPlNext.fire('click');
    chk(m.state().now === 0, '★ ⏭ — 한 곡 반복을 무시하고 다음(목록 끝이면 처음으로)');
    e.byId.myPlLoop.fire('contextmenu');
    e.rand = 0.99; e.byId.myPlNext.fire('click');
    chk(m.state().kind === 2 && m.state().now === 2, '  셔플 — 가방에서 뽑는다');
    e.cb.end('err'); e.cb.end('err');
    chk(m.state().errStreak === 2 && e.toasts.slice(-1)[0] === '⏭ 재생할 수 없는 영상이라 넘겼어요', '못 트는 곡(err) — 세면서 넘긴다');
    e.byId.myPlNext.fire('click');
    chk(m.state().errStreak === 0, '  ⏭ 은 실패 수를 지운다(손으로 넘긴 것)');
    e.cb.end('err'); e.cb.end('err'); e.cb.end('err');
    chk(m.state().now === -1 && e.toasts.slice(-1)[0] === '🎵 재생할 수 있는 곡이 없어요', '  실패가 목록 길이에 닿으면 멈춘다(무한 루프 방지)');
    // 프리셋 갈아타기 — 지금 곡은 계속, 다음 곡부터 새 프리셋
    e.byId.myPlLoop.fire('click');   // 끔
    m.playFrom(0);
    m.switchSet(1);
    chk(m.state().cur === 1 && m.state().nowSet === 0 && m.state().now === 0 && /지금 곡이 끝나면 여기서 이어져요/.test(e.toasts.slice(-1)[0]), '★ 프리셋을 바꿔도 지금 곡은 계속 — 다음 곡부터');
    e.byId.myPlSetBtn.fire('click');
    chk(e.byId.myPlSetPick.children[0].textContent.indexOf('♪') > 0, '  [프리셋 ▼] — 소리 나는 프리셋에 ♪');
    e.cb.end('ended');
    chk(m.state().nowSet === 1 && m.state().now === 0 && e.last('open').indexOf(songs(2, 'b')[0].id) > 0, '  곡이 끝나면 새 프리셋의 첫 곡');
    chk(e.last('open').indexOf('🎵 프리셋 2') > 0, '  창 제목은 트는 프리셋 이름');
    e.cb.mode('home');
    chk(m.state().now === -1 && !m.state().playing, '창 소유권이 마이홈 BGM 으로 — 재생 표시를 내린다');
    m.playFrom(1); e.cb.closed();
    chk(m.state().now === -1, '  창이 닫혔다 — 재생 표시를 내린다');
    m.playFrom(1); e.byId.myPlStop.fire('click');
    chk(m.state().now === -1 && e.last('closeBgm'), '■ — 창을 닫고 멈춤');
  }
  {
    const e = E({ noCompanion: true, store: { 'tw.playlistSets': setsOf(songs(2)) } }); const m = await e.mk();
    m.playFrom(0);
    chk(m.state().now === -1 && e.toasts[0] === '이 기능은 앱을 재시작한 후에 사용할 수 있어요', 'companion 이 없으면(옛 preload) 재생하지 않고 알린다');
  }

  say('── 5. 파도타기 · 담기 · 비공개 · 서버 사본');
  {
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(2)) }, friends: { F1: { name: '민서', online: true }, F2: { name: '가람' } } }); const m = await e.mk();
    e.byId.myPlBtn.fire('click');
    m.playFrom(1);
    e.randomPl = { uid: 'U9', name: '하늘', items: songs(4, 'h'), bio: '안녕하세요', homePublic: true, setName: '밤 노래' };
    e.cards.U9 = { level: 12, avatar: 'https://x/a.png' };
    e.byId.myPlPeek.fire('click'); await flush(); await flush();
    chk(e.last('random') === 'random null' && m.state().view.uid === 'U9' && m.state().sel === -1 && m.state().now === 1, '🌊 [파도타기] — 남의 목록 · 고른 곡 초기화 · 듣던 곡은 계속');
    chk(e.byId.myPlTitle.textContent === '🎵 [하늘]의 「밤 노래」' && e.byId.myPlCount.textContent === '4곡' && e.byId.myPlAdd.style.display === 'none' && e.byId.myPlBack.style.display === '', '  창 제목 · 곡 수 · ＋ 숨김 · ← 내 목록');
    chk(e.byId.myPlList.children[0].querySelector('.plRowGrab') && e.byId.myPlSetBar.style.display === 'none', '  곡 행마다 📥 담기 · 프리셋 줄은 숨김');
    chk(e.byId.myPlNick.textContent === '하늘' && e.byId.myPlAva.classList.contains('go'), '  명함 — 이름 · 공개 홈이면 사진을 누를 수 있다');
    e.byId.myPlAva.fire('click');
    chk(e.home[0] === 'U9 하늘', '  사진 → 그 사람 마이홈 구경');
    e.doc.fire('keydown', { key: 'Delete', target: e.doc.body });
    chk(e.randomPl.items.length === 4, '  남의 목록에서는 Delete 가 아무것도 안 한다');
    m.st.sel = 2;
    m.grabTo(0);
    chk(m.state().sets[0].items.length === 3 && m.state().sets[0].items[2].id === songs(4, 'h')[2].id && /담았어요 — 3\/20/.test(e.toasts.slice(-1)[0]), '📥 담기 — 고른 프리셋에 복사 · 보던 프리셋은 그대로');
    m.grabTo(0);
    chk(m.state().sets[0].items.length === 3 && /이미 담긴 곡이에요/.test(e.toasts.slice(-1)[0]), '  같은 곡은 또 안 담긴다');
    m.playFrom(0);
    chk(m.state().nowView && m.state().nowView.uid === 'U9' && e.last('open').indexOf('[하늘]의 「밤 노래」') > 0, '  남의 곡을 틀면 트는 출처도 그쪽');
    e.byId.myPlBack.fire('click');
    chk(m.state().view === null && m.state().nowView.uid === 'U9' && m.state().now === 0, '← 내 목록 — 보기만 되돌린다(남의 곡은 계속)');
    m.st.sel = 0; m.grabTo(1);
    chk(m.state().sets[1].items.length === 0, '  내 목록에서는 담기가 아무것도 안 한다(읽기 전용일 때만)');
    e.onRefresh = () => { e.friends.F2.online = true; e.friends.F1.online = false; };
    e.byId.myPlPeek.fire('contextmenu');
    let fr = e.byId.myPlFriendPick.children;
    chk(fr.length === 2 && fr[0].textContent.indexOf('민서') >= 0, '🌊 우클릭 — 친구 목록(온라인 먼저)');
    chk(e.refreshed.join('|') === 'F1,F2', '  열 때 친구들의 접속 상태를 한 번 읽어 달라고 한다(친구 목록이 닫혀 있으면 안 듣고 있다)');
    await flush();
    fr = e.byId.myPlFriendPick.children;
    chk(fr.length === 2 && fr[0].textContent.indexOf('가람') >= 0, '  읽고 나면 다시 그린다(새 온라인 순서)');
    e.onRefresh = null;
    e.plOf = {};
    fr.find(r => r.textContent.indexOf('가람') >= 0).fire('click'); await flush();
    chk(e.toasts.slice(-1)[0] === '가람 님은 아직 공개한 목록이 없어요', '  목록이 없는 친구는 그렇다고 말한다');
  }
  {
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(2)) } }); const m = await e.mk();
    m.save(); m.save();
    await e.advance(2900);
    chk(e.count('publish') === 0, '☁️ 서버 사본 — 3초 debounce(그 전엔 안 올린다)');
    await e.advance(200);
    chk(e.count('publish') === 1 && e.last('publish') === 'publish ME01 [2,0,0] {"bio":"","homePublic":false,"private":false}', '  세 벌 전부 · 한마디 · 공개 · 비공개를 함께');
    m.save(); await e.advance(3100);
    chk(e.count('publish') === 1, '  안 바뀌었으면(지문 같음) 안 쓴다');
    e.byId.myPlPriv.checked = true; e.byId.myPlPriv.fire('change');
    await e.advance(3100);
    chk(e.count('publish') === 2 && /"private":true/.test(e.last('publish')) && /무작위 파도타기에서 빠졌어요/.test(e.toasts.slice(-1)[0]), '🔒 비공개 — 목록은 그대로 올리고 meta 만 바뀐다');
    m.st.sets[0].items.length = 0; m.save(); await e.advance(3100);
    chk(e.count('removePl') === 1, '  세 벌이 다 비면 서버 사본을 지운다');
    e.byId.myPlPub.checked = true; e.byId.myPlPub.fire('change');
    chk(m.state().homePublic && /마이홈에 들어올 수 있어요/.test(e.toasts.slice(-1)[0]), '🏠 마이홈 공개 — 켤 때만 무슨 일인지 알린다');
  }
  say('── 5-2. ☁️ 서버가 원본 — 받기 · 저장 · 409 · 계정');
  {
    const srvOf = (n, pre, extra) => Object.assign({ sets: [{ name: '메인', items: songs(n, pre) }, { name: '', items: [] }, { name: '', items: [] }], bio: '안녕', homePublic: true, private: false }, extra || {});
    const LIST_KEYS = ['tw.playlistSets', 'tw.playlist', 'tw.playlistTitle', 'tw.playlistBio', 'tw.playlistHomePublic', 'tw.playlistPrivate', 'tw.playlistEditTs', 'tw.playlistBackup'];
    const listKeys = (e) => LIST_KEYS.filter(k => e.store.has(k));
    const oneMore = (m) => m.st.sets[0].items.push({ id: 'zzzzzzzzzzz', url: 'u', title: '새 곡' });
    // ① 켤 때 서버에서 받아 그대로 앉힌다 — 이 기기에는 목록을 두지 않는다
    {
      const e = E({ store: { 'tw.playlist': JSON.stringify(songs(2, 'o')), 'tw.playlistBio': '옛 한마디' } }); e.srv = srvOf(3, 'n', { private: true }); const m = e.mk();
      chk(m.state().sets[0].items.length === 0 && m.state().bio === '' && !m.state().loaded, '★ 만든 직후 — 이 기기의 옛 목록 키는 읽지 않는다(서버에서 받기 전엔 빈 화면)');
      await e.advance(4300);
      const s = m.state();
      chk(e.count('fetchMine ME01') === 1 && s.loaded && s.sets[0].name === '메인' && s.sets[0].items.length === 3 && s.bio === '안녕' && s.homePublic === true && s.private === true,
        '★ 켜자마자 서버에서 한 번 받아 앉힌다 — 목록 · 한마디 · 마이홈 공개 · 비공개 모두 서버 값');
      await e.advance(3100);
      chk(e.count('publish') === 0 && e.count('removePl') === 0, '  받기만 했으니 서버에 쓰지 않는다(받은 지문을 기억)');
      m.save();
      m.save(); await e.advance(3100);
      chk(e.count('publish') === 0, '  받은 목록을 그대로 저장해도 서버에 다시 쓰지 않는다(받은 지문과 같다)');
      chk(listKeys(e).join() === 'tw.playlist,tw.playlistBio' && e.store.get('tw.playlist') === JSON.stringify(songs(2, 'o')) && e.store.get('tw.playlistVol') === '80', '  저장해도 목록 키를 새로 쓰지 않는다(옛 키는 건드리지 않고) · 기기 설정은 쓴다');
    }
    // ② 서버가 비었다 = 빈 화면(못 읽음이 아니다) · 못 읽음 = 아무것도 안 하고 다시
    {
      const e = E(); e.srv = srvOf(0, 'n', { sets: [{ name: '', items: [] }, { name: '', items: [] }, { name: '', items: [] }], bio: '', homePublic: false }); const m = await e.mk();
      await e.advance(4300);
      chk(m.state().loaded && m.state().sets.every(x => !x.items.length) && e.count('fetchMine') === 1, '★ 빈 목록 — 받은 것으로 치고 빈 화면(다시 시도하지 않는다)');
      await e.advance(120000);
      chk(e.count('fetchMine') === 1, '  빈 목록은 다시 안 받는다');
      oneMore(m); m.save(); await e.advance(3100);
      chk(e.count('publish') === 1, '  받은 뒤 처음 넣은 곡은 서버에 올라간다');
    }
    {
      const e = E(); e.srv = srvOf(2); e.srvThrow = true; const m = await e.mk();
      await e.advance(4300);
      chk(!m.state().loaded && m.state().sets[0].items.length === 0 && e.count('fetchMine') === 1, '★ 못 읽음(던짐) — 앉히지 않고 loaded 도 서지 않는다');
      oneMore(m); m.save(); await e.advance(3100);
      chk(e.count('publish') === 0 && e.count('removePl') === 0, '  받기 전에 고친 것은 서버에 올리지 않는다(빈 화면이 서버 목록을 덮지 않게)');
      const pend = () => e.timers.filter(t => !t.every).length;
      await e.advance(3600000);
      chk(e.count('fetchMine') === 1 && pend() === 0, '★ 못 읽은 뒤 혼자 다시 받지 않는다 — 한 시간이 지나도 요청 1번 · 예약된 타이머 0');
      chk(e.byId.myPlList.children[0].textContent.indexOf('못 불러왔어요 · ') === 0, '  창에는 «못 불러왔어요 · 다시 시도» 가 남는다');
      e.byId.myPlBtn.fire('click'); await flush(); await flush();
      chk(e.count('fetchMine') === 2, '★ 창을 열면 한 번 다시 받는다');
      e.byId.myPlBtn.fire('click'); e.byId.myPlBtn.fire('click'); await flush(); await flush();
      chk(e.count('fetchMine') === 3 && pend() === 0, '  또 열면 또 한 번(실패 상태일 때만 · 혼자 예약은 없음)');
      e.srvThrow = false;
      e.byId.myPlBtn.fire('click'); await flush(); await flush();
      e.byId.myPlBtn.fire('click'); await flush(); await flush();
      chk(e.count('fetchMine') === 4 && m.state().loaded && m.state().sets[0].items.length === 2 && m.state().bio === '안녕', '  읽히면 그 값으로 앉힌다(받기 전에 넣은 곡은 서버 것이 이긴다)');
      e.byId.myPlBtn.fire('click'); e.byId.myPlBtn.fire('click'); await e.advance(900000);
      chk(e.count('fetchMine') === 4, '  받은 뒤에는 창을 열어도 다시 안 받는다');
    }
    {
      // 받는 중에 창을 열면 건너뛴다
      const e = E(); e.srv = srvOf(2); e.srvThrow = true; const m = await e.mk();
      await flush(); await flush();
      e.srvThrow = false; let go; e.fetchHold = new Promise(r => { go = r; });
      e.byId.myPlBtn.fire('click'); await flush();
      e.byId.myPlBtn.fire('click'); e.byId.myPlBtn.fire('click'); await flush();
      chk(e.count('fetchMine') === 2, '★ 받는 중에는 창을 다시 열어도 또 받지 않는다');
      go(); await flush(); await flush();
      chk(m.state().loaded, '  받는 중이던 것이 끝나면 앉는다');
    }
    // ③ 고치면 서버에 올린다 — 3초 debounce
    {
      const e = E(); e.srv = srvOf(2, 'n'); const m = await e.mk();
      await e.advance(4300);
      oneMore(m); m.st.bio = '고친 한마디'; m.save();
      await e.advance(2900);
      chk(e.count('publish') === 0, '☁️ 3초가 되기 전엔 안 올린다');
      await e.advance(200);
      chk(e.count('publish') === 1 && e.last('publish') === 'publish ME01 [3,0,0] {"bio":"고친 한마디","homePublic":true,"private":false}', '  3초 뒤 세 벌 · 한마디 · 공개 · 비공개를 함께 올린다');
      m.save(); await e.advance(3100);
      chk(e.count('publish') === 1, '  안 바뀌었으면(지문 같음) 안 올린다');
    }
    // ④ 409 — 다른 기기가 먼저 고쳤다: 덮어쓰지 않고 서버 것을 다시 받아 화면을 그 값으로
    {
      const e = E(); e.srv = srvOf(2, 'n'); const m = await e.mk();
      await e.advance(4300);
      e.saveRes = 'conflict'; e.srv = srvOf(5, 'x', { bio: '다른 기기' });
      oneMore(m); m.save();
      await e.advance(3100);
      const s = m.state();
      chk(e.count('publish') === 1 && e.count('fetchMine') === 2 && s.sets[0].items.length === 5 && s.sets[0].items[0].id === songs(1, 'x')[0].id && s.bio === '다른 기기',
        '★ 409 — 한 번만 보내고(다시 보내 덮어쓰지 않고) 서버 것을 다시 받아 화면을 그 값으로 바꾼다');
      e.saveRes = 'ok';
      await e.advance(20000);
      chk(e.count('publish') === 1 && e.count('fetchMine') === 2, '  받은 값은 올린 것으로 친다(되풀이 저장 · 되풀이 받기 없음)');
      oneMore(m); m.save(); await e.advance(3100);
      chk(e.count('publish') === 2, '  다시 고치면 새 판 위에서 올라간다');
    }
    {
      const e = E(); e.srv = srvOf(2, 'n'); const m = await e.mk();
      await e.advance(4300);
      e.saveRes = 'failed';
      oneMore(m); m.save(); await e.advance(3100);
      chk(e.count('publish') === 1 && e.count('fetchMine') === 1 && m.state().sets[0].items.length === 3, '저장 실패 — 화면을 바꾸지 않고 다시 받지도 않는다');
      e.saveRes = 'ok'; m.save(); await e.advance(3100);
      chk(e.count('publish') === 2, '  실패한 것은 올린 것으로 치지 않아 다음 저장에 다시 보낸다');
    }
    // ⑤ 듣는 중에는 받은 목록으로 바꾸지 않는다
    {
      const e = E(); e.srv = srvOf(2, 'n'); const m = await e.mk();
      await e.advance(4300);
      e.srv = srvOf(4, 'x');
      m.playFrom(0);
      oneMore(m);
      await m.pull();
      chk(m.state().sets[0].items.length === 3 && m.state().now === 0, '▶ 듣는 중에 받으면 목록을 바꾸지 않는다(듣던 곡이 사라지지 않게)');
      await m.pull();
      chk(e.timers.filter(t => t.at - e.t === 30000).length === 1 && e.count('fetchMine') === 1, '  듣는 중에 또 받아도 미루기(30초) 예약은 하나뿐 · 서버는 안 부른다');
      e.byId.myPlStop.fire('click');
      await e.advance(30100);
      chk(m.state().sets[0].items.length === 4 && m.state().now === -1, '  멈추고 30초 뒤 받아 앉힌다');
    }
    // ⑥ 관문 — 서버 값도 세 벌 · 16자 · 20곡 안으로
    {
      const e = E(); e.srv = srvOf(25, 'n'); const m = await e.mk();
      await e.advance(4300);
      chk(m.state().sets[0].items.length === 20 && m.state().sets[0].items[0].url.indexOf('watch?v=') > 0, '받은 값도 같은 관문(20곡 · url 복원)을 지난다');
    }
    // ⑦ 계정 — 받는 사이 바뀜 · 놓음(reset) · 올리기 대기 중 바뀜
    {
      const e = E(); e.uid = 'ME01'; e.srv = srvOf(2, 'n'); let go; e.fetchHold = new Promise(r => { go = r; });
      const m = await e.mk({ getMyUserId: () => e.uid });
      await e.advance(4300);
      e.uid = 'ME02'; go(); await flush(); await flush();
      chk(!m.state().loaded && m.state().sets[0].items.length === 0, '★ 받는 사이 계정이 바뀌면 앞 계정 응답을 앉히지 않는다');
    }
    {
      const e = E(); e.uid = 'ME01'; e.srv = srvOf(2, 'n'); const m = await e.mk({ getMyUserId: () => e.uid });
      await e.advance(4300);
      oneMore(m); m.save();
      e.uid = 'ME02';
      await e.advance(3100);
      chk(e.count('publish') === 0, '★ 올리기를 기다리는 사이 계정이 바뀌면 앞 계정 목록을 새 계정에 올리지 않는다');
    }
    {
      const e = E(); e.srv = srvOf(2, 'n'); const m = await e.mk();
      await e.advance(4300);
      oneMore(m); m.save();
      m.reset();
      const s = m.state();
      chk(!s.loaded && s.pubSig === null && s.sets.every(x => !x.items.length) && s.bio === '' && !s.homePublic && !s.private, '★ 계정을 놓으면(reset) 목록 · 한마디 · 공개를 비우고 받은 상태도 지운다');
      await e.advance(3100);
      chk(e.count('publish') === 0, '  걸려 있던 올리기도 없앤다');
      oneMore(m); m.save(); await e.advance(3100);
      chk(e.count('publish') === 0, '  새 계정 것을 받기 전에는 아무것도 안 올린다');
      e.srv = srvOf(3, 'q'); await m.pull();
      chk(m.state().loaded && m.state().sets[0].items.length === 3 && e.count('publish') === 0, '  이어받기 — 새 계정 것을 받아 앉힌다(올리지 않는다)');
    }
    {
      const e = E(); e.uid = ''; e.srv = srvOf(2, 'n'); const m = await e.mk({ getMyUserId: () => e.uid });
      await e.advance(4300);
      chk(e.count('fetchMine') === 0 && !m.state().loaded, '로그인 전 — 서버를 부르지 않고 기다린다');
      e.uid = 'ME01'; await e.advance(2100);
      chk(e.count('fetchMine') === 1 && m.state().loaded, '★ 로그인되면 2초 안에 곧바로 받는다(30초 기다리지 않는다)');
    }
    // ⑧ 받는 상태를 화면에 — 받는 중 · 못 받음 · 다시 시도 · 빈 목록
    {
      const e = E(); let go; e.fetchHold = new Promise(r => { go = r; }); e.srv = srvOf(2, 'n'); const m = await e.mk();
      e.byId.myPlBtn.fire('click');
      const em = () => e.byId.myPlList.children[0];
      chk(em() && em().className === 'plEmpty' && em().textContent === '불러오는 중…', '★ 받는 중 — 「불러오는 중…」(빈 목록 문구가 아니다)');
      go(); await flush(); await flush();
      chk(m.state().loaded && e.byId.myPlList.children.length === 2 && em().className !== 'plEmpty', '  받으면 목록으로 바뀐다');
    }
    {
      const e = E(); e.srv = srvOf(2, 'n'); e.srvThrow = true; const m = await e.mk();
      await flush(); await flush();
      const em = () => e.byId.myPlList.children[0];
      chk(em().textContent.indexOf('못 불러왔어요 · ') === 0 && em().children.length === 1 && em().children[0].textContent === '다시 시도', '★ 못 받음 — 「못 불러왔어요 · 다시 시도」');
      e.srvThrow = false; let go; e.fetchHold = new Promise(r => { go = r; });
      em().children[0].fire('click'); await flush();
      chk(em().textContent === '불러오는 중…', '  다시 받는 동안은 다시 「불러오는 중…」');
      go(); await flush(); await flush();
      chk(e.count('fetchMine') === 2 && m.state().loaded && m.state().sets[0].items.length === 2, '  [다시 시도] 를 누르면 기다리지 않고 바로 다시 받는다');
      chk(e.timers.filter(t => !t.every).length === 0, '  받으면 자동 다시 받기 예약도 없다');
    }
    {
      const e = E(); e.srv = srvOf(0, 'n', { sets: [{ name: '', items: [] }, { name: '', items: [] }, { name: '', items: [] }] }); await e.mk();
      await flush(); await flush();
      chk(e.byId.myPlList.children[0].textContent === '아직 비어 있어요.\n＋ 를 눌러 유튜브 링크를 넣어보세요.', '  빈 목록은 예전 빈 화면 그대로');
    }
    {
      const e = E(); e.srv = srvOf(2, 'n'); e.srvThrow = true; e.srvCode = 'NO_TOKEN'; const m = await e.mk();
      e.byId.myPlBtn.fire('click');
      await flush(); await flush();
      chk(e.byId.myPlList.children[0].textContent === '불러오는 중…' && e.count('fetchMine') === 1, '  토큰이 아직 안 이어졌으면(NO_TOKEN) 실패로 보이지 않고 계속 «불러오는 중…»');
      e.srvThrow = false; e.srvCode = null; await e.advance(2100);
      chk(m.state().loaded && e.count('fetchMine') === 2, '  2초 뒤 다시 받아 앉힌다');
    }
    // ⑨ 받기 전에는 고치는 동작이 잠긴다 — 듣기는 안 잠긴다
    {
      const e = E(); e.srv = srvOf(2, 'n'); e.srvThrow = true; const m = await e.mk();
      await flush(); await flush();
      e.byId.myPlBtn.fire('click');
      m.st.sets[0].items.push({ id: 'qqqqqqqqqqq', url: 'u', title: '임시' });   // 잠금이 막는 것을 보려고 곡 하나를 둔다
      e.prompts.push('https://youtu.be/NEWVIDEO001');
      e.byId.myPlAdd.fire('click'); await flush();
      chk(e.byId.myPlAdd.disabled === true && e.count('prompt') === 0, '★ 잠금 — ＋ 는 꺼져 있고 눌러도 아무 일 없다');
      m.st.sel = 0; e.doc.fire('keydown', { key: 'Delete', target: e.doc.body });
      chk(m.state().sets[0].items.length === 1, '  Delete 로 곡을 못 지운다');
      e.byId.myPlSetBtn.fire('click');
      const ed = e.byId.myPlSetPick.children[0].querySelector('.ed'); ed.fire('click');
      const box = e.byId.myPlSetPick.children[0].querySelector('.edin'); box.value = '바꾼 이름'; box.fire('keydown', { key: 'Enter' });
      chk(m.state().sets[0].name === '', '  프리셋 이름을 못 바꾼다');
      e.byId.myPlBioView.fire('click');
      chk(e.byId.myPlBioEdit.style.display === 'none', '  한마디를 못 고친다');
      e.byId.myPlPub.checked = true; e.byId.myPlPub.fire('change');
      e.byId.myPlPriv.checked = true; e.byId.myPlPriv.fire('change');
      chk(e.byId.myPlPub.disabled && e.byId.myPlPriv.disabled && !m.state().homePublic && !m.state().private && e.byId.myPlPub.checked === false && e.byId.myPlPriv.checked === false, '  공개 · 비공개 체크가 꺼져 있고 바뀌지 않는다');
      chk(m.grabBlock(0, { id: 'zzzzzzzzzzz' }) === '내 목록을 불러온 뒤에 담을 수 있어요', '  남의 곡 담기도 막는다(이유를 알림)');
      m.playFrom(0);
      chk(m.state().now === 0 && m.state().playing, '★ 듣기는 안 잠긴다 — 곡은 틀린다');
      e.byId.myPlStop.fire('click'); e.srvThrow = false; await m.pull();
      chk(e.byId.myPlAdd.disabled === false && e.byId.myPlPub.disabled === false, '  받으면 풀린다');
    }
    // ⑩ 409 로 서버 것을 다시 받아 바꿨다 — 알린다
    {
      const e = E(); e.srv = srvOf(2, 'n'); const m = await e.mk();
      await e.advance(4300);
      e.saveRes = 'conflict'; e.srv = srvOf(4, 'x');
      oneMore(m); m.save(); await e.advance(3100);
      chk(e.toasts.filter(t => t === '다른 기기에서 바뀐 목록을 불러왔어요').length === 1, '★ 409 로 바뀌었으면 토스트 «다른 기기에서 바뀐 목록을 불러왔어요»');
      chk(e.toasts.length === 1, '  다른 토스트는 없다');
      const f = E(); f.srv = srvOf(2, 'n'); await f.mk();
      await f.advance(4300);
      chk(f.toasts.length === 0, '  처음 받을 때는 토스트가 없다');
    }
    // ⑪ 저장 실패 — 한 번만 알리고, 고친 내용은 화면에 두고, 혼자 다시 올리지 않는다(다음 고침 · 창 열기가 다시 올린다)
    {
      const e = E(); e.srv = srvOf(2, 'n'); const m = await e.mk();
      e.saveRes = 'failed';
      oneMore(m); m.save(); await e.advance(3100);
      chk(e.count('publish') === 1 && e.errors.join() === 'E-PL-01' && m.state().sets[0].items.length === 3, '★ 저장 실패 — 오류 E-PL-01 을 알리고 고친 내용(3곡)은 화면에 그대로');
      await e.advance(3600000);
      chk(e.count('publish') === 1 && e.errors.length === 1 && e.timers.filter(t => !t.every).length === 0, '★ 저장 실패 뒤 혼자 다시 올리지 않는다 — 한 시간이 지나도 요청 1번 · 예약 0 · 오류 한 번');
      e.saveRes = 'ok';
      e.byId.myPlBtn.fire('click'); await flush(); await flush();
      chk(e.count('publish') === 2 && m.state().pubSig !== null, '★ 창을 열면 한 번 다시 올린다(성공하면 올린 것으로 침)');
      e.byId.myPlBtn.fire('click'); e.byId.myPlBtn.fire('click'); await flush(); await flush();
      chk(e.count('publish') === 2, '  성공 뒤에는 창을 열어도 다시 안 올린다');
      e.saveRes = 'failed'; oneMore(m); m.save(); await e.advance(3100);
      chk(e.errors.length === 2 && e.count('publish') === 3, '  성공으로 풀렸으니 다음 실패는 다시 알린다');
      oneMore(m); m.save(); await e.advance(3100);
      chk(e.count('publish') === 4 && e.errors.length === 2, '★ 실패 뒤 다음 고침은 3초 뒤 다시 올린다 · 오류는 이어지는 동안 한 번');
    }
    // ⑪-3 로그아웃 올리기(account.js 가 flushPending 을 부른다) — 같은 판단 한 곳
    {
      const e = E(); e.srv = srvOf(2, 'n'); const m = await e.mk();
      e.saveRes = 'failed'; oneMore(m); m.save(); await e.advance(3100);
      await m.flushPending('ME01');
      chk(e.count('publish') === 2, '★ 로그아웃 올리기 — 저장이 실패한 채면 PUT 1(결과를 기다려 돌려준다)');
      e.winL.forEach(fn => fn()); await flush(); await flush();
      chk(e.count('publish') === 2, '★ 로그아웃과 끌 때가 둘 다 와도 1');
      oneMore(m); m.save(); await m.flushPending('ME01');
      chk(e.count('publish') === 3, '  새로 고치면 허락이 풀려 다음 올리기는 다시 한다');
      const f = E(); f.srv = srvOf(2, 'n'); const n = await f.mk();
      oneMore(n); n.save();
      await n.flushPending('ME01');
      chk(f.count('publish') === 1, '★ 고침 대기 중 로그아웃이면 그 자리에서 PUT 1');
      const g = E(); g.srv = srvOf(2, 'n'); const k = await g.mk();
      await k.flushPending('ME01'); await k.flushPending(null);
      chk(g.count('publish') === 0, '★ 올릴 게 없거나 내 코드가 없으면 0');
    }
    // ⑪-2 앱을 끌 때(beforeunload) — 실패한 채이거나 고친 뒤 3초 모으기가 안 끝났으면 한 번만 올려 본다
    {
      const quit = async (e) => { e.winL.forEach(fn => fn()); await flush(); await flush(); };
      const e = E(); e.srv = srvOf(2, 'n'); const m = await e.mk();
      e.saveRes = 'failed'; oneMore(m); m.save(); await e.advance(3100);
      chk(e.count('publish') === 1, '  (끄기 준비) 저장 실패 상태');
      await quit(e);
      chk(e.count('publish') === 2, '★ 저장이 실패한 채 끄면 한 번 올려 본다');
      await quit(e);
      chk(e.count('publish') === 2, '★ 끄기 알림이 두 번 와도 요청은 1번');
      const f = E(); f.srv = srvOf(2, 'n'); const n = await f.mk();
      oneMore(n); n.save();
      await quit(f);
      chk(f.count('publish') === 1 && f.timers.filter(t => !t.every).length === 0, '★ 고친 뒤 3초 모으기가 안 끝났을 때 끄면 그 자리에서 한 번 올린다(예약은 지움)');
      const g = E(); g.srv = srvOf(2, 'n'); await g.mk();
      await quit(g);
      chk(g.count('publish') === 0, '★ 올릴 게 없으면 요청 0');
      const h = E(); h.uid = 'ME01'; h.srv = srvOf(2, 'n'); const k = await h.mk({ getMyUserId: () => h.uid });
      oneMore(k); k.save(); h.uid = null;
      await quit(h);
      chk(h.count('publish') === 0, '★ 로그인 전(내 코드 없음)이면 요청 0');
    }
    {
      const e = E(); e.srv = srvOf(2, 'n'); const m = await e.mk();
      e.saveRes = 'failed'; oneMore(m); m.save(); await e.advance(3100);
      m.reset();
      await e.advance(300000);
      chk(e.count('publish') === 1, '★ 계정을 놓으면(reset) 다시 올리기 예약이 취소된다');
    }
    {
      const e = E(); e.uid = 'ME01'; e.srv = srvOf(2, 'n'); const m = await e.mk({ getMyUserId: () => e.uid });
      e.saveRes = 'failed'; oneMore(m); m.save(); await e.advance(3100);
      e.uid = 'ME02';
      await e.advance(300000);
      chk(e.count('publish') === 1, '  계정이 바뀌면 앞 계정 목록은 다시 올라가지 않는다');
    }
    {
      const e = E(); e.srv = srvOf(2, 'n'); const m = await e.mk();
      let go; e.saveHold = new Promise(r => { go = r; }); e.saveRes = 'failed';
      oneMore(m); m.save(); await e.advance(3100);
      m.reset(); go(); await flush(); await flush(); await flush();
      await e.advance(200000);
      chk(e.errors.length === 0 && e.count('publish') === 1, '  보내는 중에 계정을 놓으면 그 응답은 버린다(오류 안내 · 다시 올리기 없음)');
    }
    {
      /* 로그인한 사람이 바뀌는 틈(세션은 B · 내 코드는 아직 A)에 걸린 올리기 — provider 가 'stale' 로 막으면 알림 · 다시 올리기 없이 버린다 */
      const e = E(); e.srv = srvOf(2, 'n'); const m = await e.mk();
      e.saveRes = 'stale'; oneMore(m); m.save(); await e.advance(3100);
      await e.advance(300000);
      chk(e.count('publish') === 1 && e.errors.length === 0 && e.toasts.length === 0 && m.state().sets[0].items.length === 3, '★ 보내려다 로그인한 사람이 바뀐 걸 알았다(stale) — 오류 안내도 다시 올리기도 없다(곧 reset · 다시 받기가 온다)');
    }
    // ⑫ 올리는 중에 또 고쳤다 — 같은 판으로 두 번 보내지 않고, 첫 응답 뒤 최신 상태를 한 번 더
    {
      const e = E(); e.srv = srvOf(2, 'n'); const m = await e.mk();
      let go; e.saveHold = new Promise(r => { go = r; });
      oneMore(m); m.save(); await e.advance(3100);
      oneMore(m); m.save(); await e.advance(3100);
      chk(e.count('publish') === 1, '★ 보내는 중에는 두 번째를 보내지 않는다(같은 판으로 두 번 보내면 409 로 거절된다)');
      go(); await flush(); await flush(); await flush();
      chk(e.count('publish') === 2 && e.last('publish') === 'publish ME01 [4,0,0] {"bio":"안녕","homePublic":true,"private":false}', '  첫 응답 뒤 최신 상태(4곡)를 한 번 더 보낸다');
      chk(e.count('fetchMine') === 1 && e.toasts.length === 0, '  다시 받기 · 알림은 없다');
    }
    // ⑬ 듣는 중에 409 — 받기를 미루는 동안은 고치기가 잠기고 서버도 안 부른다
    {
      const e = E(); e.srv = srvOf(2, 'n'); const m = await e.mk();
      m.playFrom(0);
      e.saveRes = 'conflict'; e.srv = srvOf(4, 'x');
      m.st.bio = '고침'; m.save(); await e.advance(3100);
      chk(e.count('publish') === 1 && e.count('fetchMine') === 1 && !m.state().loaded, '★ 듣는 중 409 — 서버에서 받기는 미루고(헛 요청 없음) 고치기가 잠긴다');
      chk(e.byId.myPlAdd.disabled === true, '  ＋ 도 꺼진다');
      await e.advance(25000);
      chk(e.count('fetchMine') === 1 && !e.toasts.includes('다른 기기에서 바뀐 목록을 불러왔어요'), '  듣는 동안은 계속 미룬다(요청 없음 · 알림 없음)');
      e.byId.myPlStop.fire('click');
      await e.advance(5100);
      chk(e.count('fetchMine') === 2 && m.state().loaded && m.state().sets[0].items.length === 4 && e.toasts.slice(-1)[0] === '다른 기기에서 바뀐 목록을 불러왔어요' && e.byId.myPlAdd.disabled === false, '  멈추면 받아 앉히고 알린 뒤 잠금이 풀린다');
    }
    // ⑭ 받는 중에 또 받기를 눌러도 겹치지 않는다
    {
      const e = E(); let go; e.fetchHold = new Promise(r => { go = r; }); e.srv = srvOf(2, 'n'); const m = await e.mk();
      m.pull(); m.pull(); await flush();
      chk(e.count('fetchMine') === 1, '받는 중에 받기를 또 불러도 요청은 하나');
      go(); await flush(); await flush();
      chk(m.state().loaded && e.count('fetchMine') === 1, '  받기가 끝나면 앉는다');
    }
  }
  {
    const e = E({ noApi: true, friends: { F1: { name: '민서', online: true } }, store: { 'tw.playlistSets': setsOf(songs(2)) } }); const m = await e.mk();
    e.byId.myPlPeek.fire('click'); await flush();
    chk(e.errors.join() === 'E-PL-02' && e.errArgs[0] instanceof Error && e.toasts.length === 0, '서버 길이 막히면(던짐) 파도타기는 오류 E-PL-02 로 알린다(원인 오류를 넘긴다)');
    e.byId.myPlPeek.fire('contextmenu'); await flush();
    e.byId.myPlFriendPick.children[0].fire('click'); await flush();
    chk(e.errors.join() === 'E-PL-02,E-PL-02' && e.errArgs[1] instanceof Error && e.toasts.length === 0, '  친구 지목 파도타기도 같은 번호로 알린다');
  }

  say('── 6. 🐕 재생 감시견');
  {
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(3)), 'tw.playlistLoopKind': '0', 'tw.playlistLoopOn': '1' } }); const m = await e.mk();
    m.playFrom(0);
    await e.advance(35000);
    chk(m.state().now === 1 && m.state().errStreak === 1 && e.warns.some(w => /신호없음/.test(w)), '신호가 한 번도 없이 30초 — 다음 곡 · 실패로 센다');
    e.cb.end('hb:10|200|0'); await e.advance(5000); e.cb.end('hb:15|200|0'); await e.advance(5000); e.cb.end('hb:199|200|0');
    await e.advance(30000);
    chk(m.state().now === 2 && m.state().errStreak === 0 && e.warns.some(w => /정상 종료로 처리/.test(w)), '★ 끝에서 멈췄고 움직인 적이 있으면 — 신호만 놓친 정상 종료(실패 0)');
    e.cb.end('hb:200|200|0'); await e.advance(31000);
    chk(m.state().now === 0 && m.state().errStreak === 1 && e.warns.some(w => /끝에 선 채 재생 없음/.test(w)), '  끝에 선 채 한 번도 안 움직였으면 — 실패로 센다(목록 반복이라 처음으로)');
    e.byId.myPlPlay.fire('click');   // ▐▐
    await e.advance(60000);
    chk(!m.state().playing && m.state().now === 0, '⏸ 사람이 세운 동안은 판정하지 않는다(저절로 다음 곡 안 됨)');
    e.byId.myPlStop.fire('click'); await e.advance(10000);
    chk(e.timers.filter(t => t.every === 5000).length === 0, '  멈추면 감시견 타이머도 내린다');
  }

  say('── 7. 상태 묶음 · window 고리');
  {
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(2)) } }); const m = await e.mk();
    m.st.cur = 2; m.st.bio = '한마디'; m.st.private = true; m.st.sets = m.blankSets();
    const s = m.state();
    chk(s.cur === 2 && s.bio === '한마디' && s.private === true && s.sets[0].items.length === 0 && m.st.cur === 2, 'st — 쓰면 모듈 상태가 바뀌고 읽으면 그 값');
    m.playFrom(0);
    chk(m.st.playing === false && m.st.now === -1 && m.st.sets.length === 3, '  재생 표시도 st 로 읽는다(빈 프리셋이라 곡은 안 열림)');
    m.st.playing = false;
    chk(m.state().playing === false, '  📷 스티커사진이 쓰는 재생 재우기(st.playing = false)');
    chk(['_plHasSavedPos', '_plApplyPos', '_plSyncBgmBounds'].every(n => typeof e.win[n] === 'function'), 'window 고리 셋 — 상태칩 팝업 자리 · noise.js 가 typeof 로 부른다');
    chk(e.win._plHasSavedPos() === false, '  옮긴 자리가 없으면 false');
    e.byId.myPlHead.fire('pointerdown', { clientX: 510, clientY: 305, target: e.byId.myPlHead });
    e.doc.fire('pointermove', { clientX: 600, clientY: 400 }); e.doc.fire('pointerup', {});
    chk(e.win._plHasSavedPos() === true && e.store.get('tw.playlistPos') === '{"x":590,"y":395}' && e.byId.myPlaylistBox.style.left === '590px', '  제목줄을 끌어 옮기면 자리를 기억(tw.playlistPos)');
    chk(Array.isArray(e.win.__winPosResetters) && e.win.__winPosResetters.length === 1, '🪟 창 위치 초기화 버튼에 등록');
    e.win.__winPosResetters[0]();
    chk(e.win._plHasSavedPos() === false, '  누르면 메모리 자리도 비운다');
    m.st.lastBoundsKey = 'x'; m.syncBgmBounds();
    chk(m.st.lastBoundsKey === 'off', '  화면 배율 바뀜 — 지문을 비우면 사각형을 다시 보낸다');
    const lv = mkEl('span', e); m.fillLv(lv, 34, null);
    chk(lv.className === 'mh-flv lv34' && lv.textContent === 'Lv34', '🏅 레벨 배지(plMod.fillLv) — 친구 목록과 같은 함수');
    m.fillLv(lv, null, null);
    chk(lv.className === '' && lv.textContent === '', '  레벨을 모르면 숨긴다');
    chk(m.ytVideoId('https://youtu.be/abcdefghijk?t=3') === 'abcdefghijk' && m.ytVideoId('https://www.youtube.com/shorts/abcdefghijk') === 'abcdefghijk' && m.ytVideoId('x') === null, '🔗 유튜브 id 파서(마이홈 BGM 과 한 벌)');
  }
  {
    const e = E({ noDom: true }); const m = await e.mk();
    chk(m && e.esc.length === 0 && e.count('setInterval') === 0 && e.store.size === 0 && !e.cb.end, 'DOM 이 없으면 버튼 연결 없이 끝난다(예전 bindMyPlaylist 의 return 그대로)');
  }
}

function wiring(PL, APP, HTML){
  say('── 8. app.js 배선');
  const A = strip(APP);
  const defs = /^(?:async )?function (_pl\w+|_ytVideoId|_ytFetchTitle)\(|^(?:let|const) (_pl\w+|PL_\w+|_PL_\w+)\b/m;
  chk(!defs.test(A) && defs.test(PL), '플레이리스트 정의(_pl* · PL_* · 유튜브 파서)는 모듈에만');
  const oldUse = A.match(/[^.\w$'](_plSets|_plCur|_plNowSet|_plSel|_plNow|_plView|_plNowView|_plBio|_plHomePublic|_plPrivate|_plPubSig|_plPlaying|_plLastBoundsKey|_plRender|_plSave|_plPublish|_plNormalizeSets|_plSetIdx|_plBlankSets|_plPubSigOf|_plMine|_plFillLv|_ytVideoId|PL_MAX|PL_BIO_MAX|PL_TITLE_MAX)\b(?!\s*:)/);
  chk(!oldUse, '  app.js 는 옛 이름을 부르지 않는다(전부 plMod.이름 · plMod.st)' + (oldUse ? ' — ' + oldUse[1] : ''));
  chk(/window\.TwPlaylist = api/.test(PL) && (A.match(/TwPlaylist\.createPlaylist\(/g) || []).length === 1, '모듈은 window.TwPlaylist · 만드는 곳은 한 곳');
  const H = (t) => APP.indexOf('/* ═══ ' + t + ' ═══ */');
  const i27 = H('🎵 상태칩 플레이리스트'), iMk = APP.indexOf('TwPlaylist.createPlaylist('), i28 = H('🎵 프리셋 세 벌'), i29 = APP.indexOf('/* ═══ 👤 프로필 소개칸'),
    i30 = APP.indexOf('/* ═══ 🏅 레벨 티어'), iTier = APP.indexOf('\nconst LV_TIERS = '), i31 = H('🎵 플레이리스트 화면 — 명함 · 목록 · 흐르는 제목 · 미니미 · 파도타기'),
    i32 = H('🎵 프리셋 고르기'), i33 = H('🐕 재생 감시견'), i34 = APP.indexOf('/* ═══ 🩺 렌더러 생존 신호'), i26 = APP.indexOf('/* ═══ 😊 기본 이모티콘');
  chk(i26 > 0 && i27 > i26 && iMk > i27 && i28 > iMk && i29 > i28 && i30 > i29 && iTier > i30 && i31 > iTier && i32 > i31 && i33 > i32 && i34 > i33,
    '원래 자리 — 만드는 줄은 🎵 상태칩 플레이리스트 머리 아래 · 머리 다섯은 남김 · 👤 · 🏅 레벨 티어는 그 사이 그대로');
  const notes = [[i28, i29], [i31, i32], [i32, i33], [i33, i34]].map(([a, b]) => APP.slice(a, b));
  chk(notes.every(s => /parts\/(?:status\/)?playlist\.js 로 옮겼다/.test(s) && !/^(?:function|const|let|\(function) /m.test(s)), '  남긴 머리 아래는 옮긴 곳 안내뿐(구역 번호가 밀리지 않게)');
  const call = (APP.match(/TwPlaylist\.createPlaylist\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('//'));
  const fnNames = [['toast', 'toast'], ['getMyUserId', 'getMyUserId'], ['getDisplayName', 'getDisplayName'], ['asyncPrompt', 'asyncPrompt'], ['getFocusLevel', 'getFocusLevel'],
    ['myFocusShow', 'myFocusShow'], ['starFromRemote', 'starFromRemote'], ['lvBadgeClass', 'lvBadgeClass'], ['lvStarBadgeClass', 'lvStarBadgeClass'], ['lvStarStr', 'lvStarStr'],
    ['starPaint', '_starPaint'], ['openFriendHomeView', 'openFriendHomeView'], ['closeChipPopups', '_closeChipPopups'], ['repositionOpenChipPopups', '_repositionOpenChipPopups'],
    ['bringWinToFront', 'bringWinToFront'], ['escRegisterWindow', 'escRegisterWindow'], ['escEditable', '_escEditable'], ['friendsRefreshPresence', 'friendsSubMod.refreshPresence']];
  const want = fnNames.map(([k, f]) => k + ': (...a)=>' + f + '(...a),').concat(['myHomeLoaded: ()=>_myHomeLoaded,', 'myHomeData: ()=>_myHomeData,', 'myHomeFriends: ()=>_myHomeFriends,', 'playlistApi: playlistApiMod,', 'notifyError: (...a)=>TwErrorCodes.notify(...a),']);
  const miss = want.filter(w => !deps.includes(w));
  chk(deps.length === 23 && !miss.length, 'deps 23개 — 함수 19는 화살표 · 다시 대입되는 let 셋은 읽는 함수 · 서버 길 provider (' + deps.length + (miss.length ? ' · 없음 ' + miss[0] : '') + ')');
  const decl = (n) => APP.indexOf('\nlet ' + n + ' = ');
  chk(['_myHomeLoaded', '_myHomeData', '_myHomeFriends'].every(n => decl(n) > iMk), '  _myHomeLoaded · _myHomeData · _myHomeFriends 는 만드는 줄보다 뒤에 선언 — 값이면 TDZ');
  const usedIn = (re) => [...new Set((A.match(re) || []).map(s => s.split('.').pop()))];
  const used = usedIn(/plMod\.(?!st\.)\w+/g).filter(n => n !== 'st');
  const off = (APP.match(/const PLAYLIST_OFF = \{([\s\S]*?)\};   \/\//) || [])[1] || '';
  const offMiss = used.filter(n => !new RegExp('\\b' + n + '(\\(\\)\\{\\}|:)').test(off));
  const stUsed = usedIn(/plMod\.st\.\w+|\bpl\.\w+/g).filter(n => !/^(st|some|map)$/.test(n));
  const stMiss = stUsed.filter(n => !new RegExp('\\b' + n + ':').test(off));
  chk(!/\bPLAYLIST_OFF\b/.test(APP), '빈 껍데기 PLAYLIST_OFF 없음 — 모듈은 늘 싣는다(가드 걷기 3차)');
  const rets = ((PL.match(/\nreturn \{([\s\S]*?)\n\};/) || [])[1] || '').split('// 검사용')[0];
  chk(used.every(n => new RegExp('\\b' + n + '\\b').test(rets)), '  모듈이 그 이름을 내놓는다');
  const stKeys = ((PL.match(/\nconst st = \{([\s\S]*?)\n\};/) || [])[1] || '');
  chk(stUsed.every(n => new RegExp('get ' + n + '\\(\\)').test(stKeys) && new RegExp('set ' + n + '\\(v\\)').test(stKeys)), '  상태 묶음이 밖에서 쓰는 칸을 다 갖는다 (' + stUsed.join(' · ') + ')');
  const uses = ['plMod.st.lastBoundsKey = \'\'; plMod.syncBgmBounds();', 'ytVideoId: (...a)=>plMod.ytVideoId(...a),', 'plRender: (...a)=>plMod.render(...a),',
    'plPlaying: ()=>plMod.st.playing,', 'setPlPlaying: v=>{ plMod.st.playing = v; },', 'plMod.fillLv(lv, n, st);',
    'plMod.reset();', 'plMod.st.cur = 0; plMod.reset();'];
  const lost = uses.filter(u => A.indexOf(u) < 0);
  chk(!lost.length, '부르는 곳 — 화면 배율 · 마이홈 BGM · 📷 스티커사진 · 로그아웃 · 내 정보 배지' + (lost.length ? ' (없음 ' + lost.join(' · ') + ')' : ''));
  chk(/if\(typeof _plHasSavedPos === 'function' && _plHasSavedPos\(\)\) _plApplyPos\(\);/.test(A) && /window\._plHasSavedPos = _plHasSavedPos; window\._plApplyPos = _plApplyPos; window\._plSyncBgmBounds = _plSyncBgmBounds;/.test(PL),
    '  상태칩 팝업 자리(만드는 줄보다 위에 선언)는 window 고리 + typeof 로');
  const iI = HTML.indexOf('<script src="parts/myhome/myhome-inbox.js"></script>'), iP = HTML.indexOf('<script src="parts/status/playlist.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>'),
    iN = HTML.indexOf('<script src="parts/status/noise.js"></script>');
  chk(iI > 0 && iP > iI && iA > iP && iN > iA, 'html — playlist.js 를 app.js 보다 먼저(myhome-inbox.js 뒤) · noise.js 는 app.js 뒤');
  chk(/TwPlaylist/.test(PL) && !/window\.(Playlist|PlayList)\s*=/.test(PL) && !/\bplMod\b/.test(HTML.replace(/<!--[\s\S]*?-->/g, '')), '전역 이름은 Tw 접두사 · 연결 상수(plMod)는 DOM id 와 겹치지 않는다');
}

async function runAll(PL, APP, HTML){
  try{ await behave(PL); }catch(err){ chk(false, '실행 오류 — ' + (err && err.stack || err).toString().split('\n').slice(0, 3).join(' | ')); }
  try{ wiring(PL, APP, HTML); }catch(err){ chk(false, '배선 검사 오류 — ' + (err && err.message || err)); }
}

(async () => {
  const PL = SRC['playlist.js'], APP = _MI_JOIN(SRC['app.js']), HTML = SRC['desk-companion-prototype.html'];
  say('── 1. 만들 때');
  {
    const win = {};
    new Function('window', 'module', PL)(win, undefined);
    chk(Object.keys(win).join() === 'TwPlaylist' && typeof win.TwPlaylist.createPlaylist === 'function', '싣기만 하면 window.TwPlaylist 하나뿐');
    const e = mkEnv({ store: { 'tw.playlistSets': setsOf(songs(1)) } }); e.mk();
    chk(e.esc.length === 1 && e.cb.end && e.cb.mode && e.cb.closed && e.count('setInterval 300') === 1 && e.count('vol') === 1 && e.count('publish') === 0 && e.timers.length === 1
      && e.count('fetchMine ME01') === 1,
      '만들 때 — ESC 등록 · BGM 신호 셋 구독 · 300ms 폴링 · 음량 한 번 · ☁️ 서버에서 받기를 곧바로 한 번(서버 쓰기 없음 · 기다리는 타이머 없음)');
    chk(e.store.size === 1 && e.byId.myPlaylistBox.classList.contains('hidden') && e.toasts.length === 0 && e.front.length === 0, '  저장소를 안 쓰고 창은 닫힌 채 · 토스트 없음');
  }
  await runAll(PL, APP, HTML);

  say('── 9. 일부러 깨 보기');
  const BREAKS = [
    ['PL', "? s.items.filter(x => x && x.id).slice(0, PL_MAX).map(", "? s.items.filter(x => x && x.id).map(", '관문이 20곡으로 안 깎음'],
    ['PL', "out[i].name  = (typeof s.name === 'string') ? s.name.slice(0, PL_TITLE_MAX) : '';", 'out[i].name  = String(s.name || \'\').slice(0, PL_TITLE_MAX);', '깨진 이름을 «[object Object]» 로'],
    ['PL', "if(mine.some(x => x.id === vid)){", 'if(false){', '같은 곡이 또 들어감'],
    ['PL', '    if(_escEditable(e.target)) return;\n', '', 'Delete 가 입력칸 글자 지우기를 가로챔'],
    ['PL', '  _plSyncLoop();   // 🔁 반드시 열기 **전에**', '  // 🔁 반드시 열기 **전에**', 'loop 여부를 곡 열기 전에 안 알림'],
    ['PL', "  [120, 300, 600, 1000, 1600, 2400].forEach(ms => _plVolReT.push(setTimeout(_plApplyVol, ms)));", '', '새 곡 음량 재전송이 빠짐'],
    ['PL', "  if(_plOn && _plKind === PL_KIND_ONE){ _plPlayNow(_plNow); return; }\n  _plSkipNext();", '  _plSkipNext();', '자동 진행이 한 곡 반복을 안 봄'],
    ['PL', "bind('myPlNext',  ()=>{ _plErrStreak = 0; _plSkipNext(); });", "bind('myPlNext',  ()=>{ _plSkipNext(); });", '⏭ 이 실패 수를 안 지움'],
    ['PL', '    if(kind === \'loop\'){ _plErrStreak = 0; return; }', '', 'loop 신호마다 곡을 다시 엶'],
    ['PL', '  if(_plAdoptCurSet()) return;', '', '프리셋 갈아타기가 안 됨'],
    ['PL', '  if(!_plOn){ _plStop();', '  if(false){ _plStop();', '반복 끔인데 마지막 곡에서 처음으로'],
    ['PL', "    _plView = r; _plSel = -1;", '    _plView = r; _plSel = -1; _plNow = -1;', '파도타기가 듣던 곡을 끊음'],
    ['PL', '  if(!_plReadOnly()) return;                       // 내 목록에서는', '  // 내 목록에서는', '내 목록에서 담기가 됨'],
    ['PL', '  if(_plNow >= 0){ _plPullLater(PL_PLAYING_DEFER_MS); return; }', '', '듣는 중에 목록을 바꿈'],
    ['PL', "  if(_plPullMerged){ _plPullMerged = false; toast(PL_MSG.merged); }", "  _plPullMerged = false;", '처음 받을 때도 알림이 뜨는 쪽으로 — 알림을 아예 뺌'],
    ['PL', "  if(_plPullMerged){ _plPullMerged = false; toast(PL_MSG.merged); }", "  if(true){ _plPullMerged = false; toast(PL_MSG.merged); }", '처음 받을 때도 «다른 기기에서…» 가 뜸'],
    ['PL', "    if(e && e.code === PL_NO_TOKEN){ _plPullLater(PL_LOGIN_WAIT_MS); return; }", "", '토큰 전을 실패로 보임'],
    ['PL', "  if(!uid){ _plPullLater(PL_LOGIN_WAIT_MS); return; }", "  if(!uid){ _plPullLater(PL_PLAYING_DEFER_MS); return; }", '로그인 뒤 30초나 기다림'],
    ['PL', "  _plPull();   // ☁️ 서버에서 받기", "  // ☁️ 서버에서 받기", '켜도 서버에서 안 받음'],
    ['PL', "      em.textContent = _plPullFailed ? PL_MSG.failed : PL_MSG.loading;", "      em.textContent = PL_MSG.loading;", '못 받았는데 «불러오는 중…» 만 보임'],
    ['PL', "      em.textContent = _plPullFailed ? PL_MSG.failed : PL_MSG.loading;", "      em.textContent = '아직 비어 있어요.';", '받기 전에 빈 목록 문구가 보임'],
    ['PL', "        rb.addEventListener('click', e=>{ e.stopPropagation(); _plPull(); });", "", '[다시 시도] 가 안 눌림'],
    ['PL', "  if(_plPullFailed){ _plPullFailed = false; _plRender(); }", "", '다시 받는 동안 «불러오는 중…» 으로 안 돌아감'],
    ['PL', "  if(!_plLoaded) return '내 목록을 불러온 뒤에 담을 수 있어요';\n", "", '받기 전에 남의 곡을 담을 수 있음'],
    ['PL', "  _plLoaded = true; _plPullFailed = false;\n  _plRender();", "  _plLoaded = true; _plPullFailed = false;", '받아도 화면이 안 바뀜'],
    ['PL', '  _plPubSig = _plServerShape().sig;\n  _plLoaded = true;', '  _plLoaded = true;', '받은 목록을 지문에 안 적어 곧바로 다시 올림'],
    ['PL', "    _plPullFailed = true; _plRender();   // 혼자 다시 받지 않는다", "    _plPullFailed = true; _plRender(); _plPullLater(30000);   // ", '못 읽으면 혼자 다시 받음'],
    ['PL', "  if(!_plLoaded){ if(_plPullFailed) _plPull(); return; }", "  if(!_plLoaded){ return; }", '창을 열어도 못 받은 걸 다시 안 받음'],
    ['PL', "  if(!_plLoaded){ if(_plPullFailed) _plPull(); return; }", "  if(!_plLoaded){ _plPull(); return; }", '받는 중에도 창 열 때마다 받음'],
    ['PL', "  if(_plSaveFailing) _plPublishNow(getMyUserId());", "", '창을 열어도 실패한 저장을 다시 안 올림'],    ['PL', "window.addEventListener('beforeunload', ()=>{ _plFlushPending(getMyUserId()); });", "", '끌 때 안 올려 봄'],
    ['PL', "  if(!uid || _plFlushSent || (!_plSaveFailing && !_plPubTimer)) return Promise.resolve();", "  if(_plFlushSent || (!_plSaveFailing && !_plPubTimer)) return Promise.resolve();", '로그인 전에도 끌 때 요청'],
    ['PL', "  if(!uid || _plFlushSent || (!_plSaveFailing && !_plPubTimer)) return Promise.resolve();", "  if(!uid || (!_plSaveFailing && !_plPubTimer)) return Promise.resolve();", '끄기 알림마다 또 올림'],
    ['PL', "  if(!uid || _plFlushSent || (!_plSaveFailing && !_plPubTimer)) return Promise.resolve();", "  if(!uid || _plFlushSent || !_plSaveFailing) return Promise.resolve();", '고친 뒤 모으는 중에 끄면 안 올림(로그아웃 포함)'],
    ['PL', "  _plFlushSent = false;\n  clearTimeout(_plPubTimer);", "  clearTimeout(_plPubTimer);", '새로 고쳐도 올리기 허락이 안 풀림'],
    ['PL', "  flushPending: _plFlushPending,", "  flushPendingX: _plFlushPending,", '로그아웃이 부를 이름을 안 내놓음'],

    ['PL', "_plLoadMyCard(); _plRetryOnOpen(); _plRender(); }", "_plLoadMyCard(); _plRender(); }", '창 열기가 다시 시도를 안 부름'],
    ['PL', '  if(getMyUserId() !== uid) return;   // 기다리는 사이 계정이 바뀌었다', '', '받는 사이 계정이 바뀌어도 앞 계정 것을 앉힘'],
    ['PL', '  _plLoaded = false; _plPubSig = null;', '  _plPubSig = null;', '계정을 놓아도 받은 상태가 남음'],
    ['PL', '  clearTimeout(_plPullT); _plPullT = null;   // 다시 시도 사슬은 하나만', '  _plPullT = null;', '다시 받기 사슬이 갈라짐'],
    ['PL', '  _plSets = _plNormalizeSets(srv.sets);\n  _plCur', '  _plSets = srv.sets;\n  _plCur', '서버 값을 관문 없이 앉힘'],
    ['PL', '  _plPrivate = !!srv.private;\n', '', '서버의 비공개를 안 받음'],
    ['PL', "    localStorage.setItem('tw.playlistCur', String(_plCur));", "    localStorage.setItem('tw.playlistCur', String(_plCur)); localStorage.setItem('tw.playlistSets', JSON.stringify(_plSets));", '목록을 이 기기에도 씀'],
    ['PL', "    _plSets = _plBlankSets();\n    _plCur = _plSetIdx(localStorage.getItem('tw.playlistCur'));", "    _plSets = _plNormalizeSets(JSON.parse(localStorage.getItem('tw.playlistSets') || 'null'));\n    _plCur = _plSetIdx(localStorage.getItem('tw.playlistCur'));", '이 기기 옛 목록을 읽음'],
    ['APP', "  try{ plMod.st.cur = 0; plMod.reset(); }", "  try{ plMod.st.cur = 0; }", '로그아웃이 목록을 안 비움'],
    ['PL', "  if(sig === _plPubSig) return;\n  const gen", "  const gen", '안 바뀌어도 서버에 씀'],
    ['PL', "  if(!_plLoaded || getMyUserId() !== uid0) return;\n  if(_plPubBusy)", "  if(getMyUserId() !== uid0) return;\n  if(_plPubBusy)", '받기 전에 서버에 올림'],
    ['PL', "  if(!_plLoaded || getMyUserId() !== uid0) return;\n  if(_plPubBusy)", "  if(!_plLoaded) return;\n  if(_plPubBusy)", '올리기 대기 중 계정이 바뀌어도 앞 목록을 올림'],
    ['PL', "    _plLoaded = false; _plPullMerged = true; _plPull();", "    _plPubSig = sig;", '409 인데 서버 것을 다시 안 받고 올린 것으로 침'],
    ['PL', "    _plLoaded = false; _plPullMerged = true; _plPull();", "    _plLoaded = false; _plPull();", '409 로 바뀌어도 알리지 않음'],
    ['PL', "    _plLoaded = false; _plPullMerged = true; _plPull();", "    _plPullMerged = true; _plPull();", '409 로 다시 받는 동안 고치기가 안 잠김'],
    ['PL', "  if(r === 'ok'){\n    _plPubSig = sig;", "  if(r !== 'failed'){\n    _plPubSig = sig;", '저장 실패를 올린 것으로 침'],
    ['PL', "async function _plAdd(){\n  if(!_plCanEdit()) return;", "async function _plAdd(){\n  if(_plReadOnly()) return;", '받기 전에 곡을 넣을 수 있음'],
    ['PL', "  if(!_plCanEdit() || _plSel < 0", "  if(_plReadOnly() || _plSel < 0", '받기 전에 곡을 지울 수 있음'],
    ['PL', "  if(!_plCanEdit()) return false;\n  const n = _plSetIdx(i);", "  const n = _plSetIdx(i);", '받기 전에 프리셋 이름을 고칠 수 있음'],
    ['PL', "function _plBioEditStart(){\n  if(!_plCanEdit()) return;", "function _plBioEditStart(){\n  if(_plReadOnly()) return;", '받기 전에 한마디를 고칠 수 있음'],
    ['PL', "      if(!_plCanEdit()){ pub.checked = _plHomePublic; return; }\n", "", '받기 전에 마이홈 공개를 바꿀 수 있음'],
    ['PL', "      if(!_plCanEdit()){ box.checked = _plPrivate; return; }\n", "", '받기 전에 비공개를 바꿀 수 있음'],
    ['PL', "['myPlAdd', _plCanEdit() && _plMine().length < PL_MAX]", "['myPlAdd', !_plReadOnly() && _plMine().length < PL_MAX]", '받기 전에 ＋ 가 켜져 있음'],
    ['PL', "  if(_plNow >= 0){ _plPullLater(PL_PLAYING_DEFER_MS); return; }   // 듣는 중이면 부르기 전에", "  if(false){ _plPullLater(PL_PLAYING_DEFER_MS); return; }   // 듣는 중이면 부르기 전에", '듣는 중에도 서버를 부름(헛 GET)'],
    ['PL', "  if(_plPullBusyUid === uid) return;  ", "  if(false) return;  ", '받는 중에 다시 받기가 겹침'],
    ['PL', "    if(!_plSaveFailing){ _plSaveFailing = true; notifyError('E-PL-01'); }", "    notifyError('E-PL-01');", '저장 실패를 이어지는 동안 되풀이해서 알림'],
    ['PL', "    if(!_plSaveFailing){ _plSaveFailing = true; notifyError('E-PL-01'); }", "    _plSaveFailing = true;", '저장 실패를 알리지 않음'],
    ['PL', "    if(!_plSaveFailing){ _plSaveFailing = true; notifyError('E-PL-01'); }\n", "    if(!_plSaveFailing){ _plSaveFailing = true; notifyError('E-PL-01'); }\n    _plPublishIn(30000);\n", '저장 실패 뒤 혼자 다시 올림'],
    ['PL', "    catch(e){ notifyError('E-PL-02', e); return; }       // 못 불러옴", "    catch(e){ return; }       // 못 불러옴", '무작위 파도타기 실패를 알리지 않음'],
    ['PL', "  catch(e){ notifyError('E-PL-02', e); return; }", "  catch(e){ notifyError('E-PL-02'); return; }", '친구 파도타기 실패의 원인 오류를 버림'],
    ['PL', "  }else if(r === 'stale'){", "  }else if(r === 'never'){", '로그인한 사람이 바뀐 것을 저장 실패로 알림 · 다시 올림'],
    ['PL', "    _plPubSig = sig; _plSaveFailing = false;", "    _plPubSig = sig;", '저장이 성공해도 실패 상태가 안 풀림'],
    ['PL', "  if(_plPubBusy){ _plPubAgain = true; return; }", "", '보내는 중에 또 보냄(같은 판 두 번)'],
    ['PL', "    if(again) _plPublishNow(uid0);", "", '보내는 중 고친 것을 끝난 뒤 안 올림'],
    ['PL', "  _plGen++; _plPubBusy = false;", "  _plPubBusy = false;", '계정을 놓은 뒤 앞 계정 보내기가 새 상태를 건드림'],
    ['PL', "  if(gen !== _plGen) return;", "", '계정을 놓은 뒤 앞 계정 보내기 결과가 반영됨'],
    ['PL', "function _plPublish(){ _plPublishIn(3000); }", "function _plPublish(){ _plPublishIn(0); }", '서버 사본 debounce 가 없음'],
    ['PL', "  if(atEnd && _plWatchPlayed){", '  if(atEnd){', '끝에 선 채 재생 없음을 정상 종료로'],
    ['PL', "  if(typeof _plPlaying !== 'undefined' && _plPlaying === false){ _plWatchMoveAt = now; return; }", '', '일시정지 중에도 감시견이 판정'],
    ['PL', "try{ (window.__winPosResetters = window.__winPosResetters || []).push(()=>{ _plPos = null; }); }catch(_){}", '', '창 위치 초기화에 등록 안 함'],
    ['PL', ' window._plSyncBgmBounds = _plSyncBgmBounds;', '', 'window 고리(noise.js)가 빠짐'],
    ['PL', '  get private(){ return _plPrivate; },     set private(v){ _plPrivate = v; },', '  get private(){ return _plPrivate; },', '상태 묶음의 쓰기가 빠짐'],
    ['PL', "if(typeof window !== 'undefined') window.TwPlaylist = api;", "if(typeof window !== 'undefined') window.Playlist = api;", '전역 이름에 Tw 가 없음'],
    ['APP', '  myHomeFriends: ()=>_myHomeFriends,', '  myHomeFriends: _myHomeFriends,', '친구 목록을 값으로(TDZ · 옛 것)'],
    ['HTML', '<script src="parts/status/playlist.js"></script>', '', 'html 이 모듈을 안 실음'],
  ];
  const caught = [];
  for(const [where, from, to, what] of BREAKS){
    const s = { PL, APP, HTML };
    if(s[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
    s[where] = s[where].split(from).join(to);
    quiet = true; qfail = 0;
    await runAll(s.PL, s.APP, s.HTML);
    quiet = false;
    caught.push([what, qfail]);
  }
  const missed = caught.filter(([, n]) => n === 0).map(([w]) => w);
  chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

  say('\n통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();

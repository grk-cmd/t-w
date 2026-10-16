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
    titles: o.titles || {}, cards: {}, rand: 0.5, front: [], chipClosed: [], reposition: 0, home: [], friends: o.friends || {}, cb: {}, warns: [] };
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
  const api = o.noApi ? undefined : {
    publishMyPlaylist: async (uid, name, sets, meta) => { env.calls.push('publish ' + uid + ' ' + name + ' ' + JSON.stringify(sets.map(s => s.items.length)) + ' ' + JSON.stringify(meta)); return true; },
    removeMyPlaylist: async (uid, meta) => { env.calls.push('removePl ' + uid + ' ' + JSON.stringify(meta)); return true; },
    fetchPlaylistCard: async (uid) => { env.calls.push('card ' + uid); return env.cards[uid] || null; },
    fetchRandomPlaylist: async (me, ex) => { env.calls.push('random ' + me + ' ' + ex); return env.randomPl || null; },
    fetchPlaylistOf: async (uid) => { env.calls.push('of ' + uid); return env.plOf ? env.plOf[uid] || null : null; },
  };
  const comp = o.noCompanion ? undefined : {
    openPlaylistTrack: (url, title) => env.calls.push('open ' + url + ' | ' + title),
    closeBgm: () => env.calls.push('closeBgm'), pauseBgm: () => env.calls.push('pause'), resumeBgm: () => env.calls.push('resume'),
    setBgmVolume: (v) => env.calls.push('vol ' + v), setBgmLoop: (on) => env.calls.push('loop ' + on),
    setPlBounds: (r) => env.calls.push('bounds ' + (r ? [r.x, r.y, r.w, r.h].join(',') : 'null')), openBrowser: (u) => env.calls.push('browser ' + u),
    onBgmTrackEnd: (cb) => { env.cb.end = cb; }, onBgmMode: (cb) => { env.cb.mode = cb; }, onBgmClosed: (cb) => { env.cb.closed = cb; },
  };
  const win = { companion: comp, firebaseAPI: api };
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
  const E = (o) => mkEnv(Object.assign({ src }, o || {}));

  say('── 2. 프리셋 저장값');
  {
    const e = E(); const m = e.mk();
    const n = m.normalizeSets([{ name: '가나다라마바사아자차카타파하가나다', items: songs(25).map(s => ({ id: s.id, title: s.title })) }, { name: { x: 1 }, items: 'bad' }, null, { name: 'x', items: [] }]);
    chk(n.length === 3 && n[0].items.length === 20 && n[0].name.length === 16, '관문 — 세 벌 · 이름 16자 · 곡 20개로 깎는다');
    chk(n[0].items[0].url === 'https://www.youtube.com/watch?v=' + songs(1)[0].id && n[1].name === '' && n[1].items.length === 0 && n[2].name === '', '  url 없으면 id 로 복원 · 이름은 문자열만 · 깨진 벌은 빈 벌');
    chk(m.setIdx('2') === 2 && m.setIdx(7) === 0 && m.setIdx(null) === 0, '  프리셋 번호 보정 — 범위 밖 · 깨진 값은 0');
  }
  {
    const e = E({ store: { 'tw.playlist': JSON.stringify(songs(2)), 'tw.playlistTitle': '옛 이름', 'tw.playlistLoopMode': '3', 'tw.playlistVol': '250', 'tw.playlistHomePublic': 'true', 'tw.playlistPrivate': '1', 'tw.playlistCur': '9' } });
    const m = e.mk(); const s = m.state();
    chk(s.sets[0].name === '옛 이름' && s.sets[0].items.length === 2 && s.sets[0].items[0].url.indexOf('watch?v=') > 0, '★ 옛 목록(tw.playlist) 하나 → 프리셋 0 으로 이관(이름 · url 까지)');
    chk(s.on === true && s.kind === 2, '  반복 옛 키(네 상태 한 축) 이어받기 — 3 = 셔플 켬');
    chk(s.vol === 100 && s.cur === 0 && s.nowSet === 0, '  음량 0~100 으로 깎기 · 깨진 프리셋 번호는 0');
    chk(s.homePublic === false && s.private === true, '  마이홈 공개는 «1» 일 때만(true 문자열은 꺼짐) · 비공개는 «1»');
  }
  {
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(1), songs(3, 'b')), 'tw.playlistCur': '1', 'tw.playlistLoopKind': '1', 'tw.playlistLoopOn': '1', 'tw.playlistMini': '1', 'tw.playlistPos': '{"x":10,"y":20}' } });
    const m = e.mk(); const s = m.state();
    chk(s.cur === 1 && s.nowSet === 1 && s.kind === 1 && s.on && s.mini && s.pos.x === 10, '새 키 — 보는 프리셋 · 반복 · 미니미 · 창 자리');
    m.save();
    chk(JSON.parse(e.store.get('tw.playlist')).length === 1 && e.store.get('tw.playlistCur') === '1' && e.store.get('tw.playlistLoopMode') === '2' && e.store.get('tw.playlistLoop') === '1',
      '★ 저장 — 옛 키(tw.playlist)는 프리셋 0 의 거울 · 반복 옛 키도 같이');
    chk(e.byId.myPlaylistBox.classList.contains('mini') && e.byId.myPlMin.textContent === '□', '  미니미로 껐으면 그 상태로 열린다');
  }

  say('── 3. 목록');
  {
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(2)) } }); const m = e.mk();
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
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(20)) } }); const m = e.mk();
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
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(3), songs(2, 'b')), 'tw.playlistVol': '30' } }); const m = e.mk();
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
    const e = E({ noCompanion: true, store: { 'tw.playlistSets': setsOf(songs(2)) } }); const m = e.mk();
    m.playFrom(0);
    chk(m.state().now === -1 && e.toasts[0] === '이 기능은 앱을 재시작한 후에 사용할 수 있어요', 'companion 이 없으면(옛 preload) 재생하지 않고 알린다');
  }

  say('── 5. 파도타기 · 담기 · 비공개 · 서버 사본');
  {
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(2)) }, friends: { F1: { name: '민서', online: true }, F2: { name: '가람' } } }); const m = e.mk();
    e.byId.myPlBtn.fire('click');
    m.playFrom(1);
    e.randomPl = { uid: 'U9', name: '하늘', items: songs(4, 'h'), bio: '안녕하세요', homePublic: true, setName: '밤 노래' };
    e.cards.U9 = { level: 12, avatar: 'https://x/a.png' };
    e.byId.myPlPeek.fire('click'); await flush(); await flush();
    chk(e.last('random') === 'random ME01 null' && m.state().view.uid === 'U9' && m.state().sel === -1 && m.state().now === 1, '🌊 [파도타기] — 남의 목록 · 고른 곡 초기화 · 듣던 곡은 계속');
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
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(2)) } }); const m = e.mk();
    m.save(); m.save();
    await e.advance(2900);
    chk(e.count('publish') === 0, '☁️ 서버 사본 — 3초 debounce(그 전엔 안 올린다)');
    await e.advance(200);
    chk(e.count('publish') === 1 && e.last('publish') === 'publish ME01 나나 [2,0,0] {"bio":"","homePublic":false,"private":false}', '  세 벌 전부 · 한마디 · 공개 · 비공개를 함께');
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
  {
    const e = E({ noApi: true, store: { 'tw.playlistSets': setsOf(songs(2)) } }); const m = e.mk();
    e.byId.myPlPeek.fire('click');
    chk(e.toasts[0] === '파도타기는 인터넷 연결이 필요해요', 'firebaseAPI 가 없으면 파도타기는 안내만');
  }

  say('── 6. 🐕 재생 감시견');
  {
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(3)), 'tw.playlistLoopKind': '0', 'tw.playlistLoopOn': '1' } }); const m = e.mk();
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
    const e = E({ store: { 'tw.playlistSets': setsOf(songs(2)) } }); const m = e.mk();
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
    const e = E({ noDom: true }); const m = e.mk();
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
  const want = fnNames.map(([k, f]) => k + ': (...a)=>' + f + '(...a),').concat(['myHomeLoaded: ()=>_myHomeLoaded,', 'myHomeData: ()=>_myHomeData,', 'myHomeFriends: ()=>_myHomeFriends,']);
  const miss = want.filter(w => !deps.includes(w));
  chk(deps.length === 21 && !miss.length, 'deps 21개 — 함수 18은 화살표 · 다시 대입되는 let 셋은 읽는 함수 (' + deps.length + (miss.length ? ' · 없음 ' + miss[0] : '') + ')');
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
    'plPlaying: ()=>plMod.st.playing,', 'setPlPlaying: v=>{ plMod.st.playing = v; },', 'pl.sets = plMod.blankSets();', 'plMod.fillLv(lv, n, st);',
    'pl.sets = plMod.normalizeSets(r.sets);', 'pl.cur = plMod.setIdx(pl.cur);', 'plMod.pubSigOf(pl.sets.map(', '} else if(plMod.mine().length){'];
  const lost = uses.filter(u => A.indexOf(u) < 0);
  chk(!lost.length, '부르는 곳 — 화면 배율 · 마이홈 BGM · 📷 스티커사진 · 로그아웃 · 내 정보 배지 · 계정 이어받기' + (lost.length ? ' (없음 ' + lost.join(' · ') + ')' : ''));
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
    chk(e.esc.length === 1 && e.cb.end && e.cb.mode && e.cb.closed && e.count('setInterval 300') === 1 && e.count('vol') === 1 && e.count('publish') === 0 && e.timers.length === 1,
      '만들 때 — ESC 등록 · BGM 신호 셋 구독 · 300ms 폴링 · 음량 한 번(서버 쓰기 · 다른 타이머 없음)');
    chk(e.store.size === 1 && e.byId.myPlaylistBox.classList.contains('hidden') && e.toasts.length === 0 && e.front.length === 0, '  저장소를 안 쓰고 창은 닫힌 채 · 토스트 없음');
  }
  await runAll(PL, APP, HTML);

  say('── 9. 일부러 깨 보기');
  const BREAKS = [
    ['PL', "? s.items.filter(x => x && x.id).slice(0, PL_MAX).map(", "? s.items.filter(x => x && x.id).map(", '관문이 20곡으로 안 깎음'],
    ['PL', "out[i].name  = (typeof s.name === 'string') ? s.name.slice(0, PL_TITLE_MAX) : '';", 'out[i].name  = String(s.name || \'\').slice(0, PL_TITLE_MAX);', '깨진 이름을 «[object Object]» 로'],
    ['PL', '    if(!sets && Array.isArray(arr) && arr.length){', '    if(false){', '옛 목록 이관이 빠짐'],
    ['PL', "localStorage.setItem('tw.playlist', JSON.stringify(_plSets[0].items));", "localStorage.setItem('tw.playlist', JSON.stringify(_plMine()));", '거울이 프리셋 0 이 아님'],
    ['PL', "_plHomePublic = localStorage.getItem('tw.playlistHomePublic') === '1';", "_plHomePublic = !!localStorage.getItem('tw.playlistHomePublic');", '마이홈 공개가 저장값 아무거나로 켜짐'],
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
    ['PL', '      if(sig === _plPubSig) return;', '', '안 바뀌어도 서버에 씀'],
    ['PL', "  }, 3000);\n}", '  }, 0);\n}', '서버 사본 debounce 가 없음'],
    ['PL', '      if(!total){', '      if(false){', '빈 목록을 지우지 않고 올림'],
    ['PL', "  if(atEnd && _plWatchPlayed){", '  if(atEnd){', '끝에 선 채 재생 없음을 정상 종료로'],
    ['PL', "  if(typeof _plPlaying !== 'undefined' && _plPlaying === false){ _plWatchMoveAt = now; return; }", '', '일시정지 중에도 감시견이 판정'],
    ['PL', "try{ (window.__winPosResetters = window.__winPosResetters || []).push(()=>{ _plPos = null; }); }catch(_){}", '', '창 위치 초기화에 등록 안 함'],
    ['PL', ' window._plSyncBgmBounds = _plSyncBgmBounds;', '', 'window 고리(noise.js)가 빠짐'],
    ['PL', '  get private(){ return _plPrivate; },     set private(v){ _plPrivate = v; },', '  get private(){ return _plPrivate; },', '상태 묶음의 쓰기가 빠짐'],
    ['PL', "if(typeof window !== 'undefined') window.TwPlaylist = api;", "if(typeof window !== 'undefined') window.Playlist = api;", '전역 이름에 Tw 가 없음'],
    ['APP', '  myHomeFriends: ()=>_myHomeFriends,', '  myHomeFriends: _myHomeFriends,', '친구 목록을 값으로(TDZ · 옛 것)'],
    ['APP', "  try{ const pl = plMod.st; pl.sets = plMod.blankSets();", '  try{ const pl = plMod.st; _plSets = plMod.blankSets();', '로그아웃이 옛 이름에 씀'],
    ['APP', '} else if(plMod.mine().length){', '} else if(_plMine().length){', '계정 이어받기가 옛 이름을 부름'],
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

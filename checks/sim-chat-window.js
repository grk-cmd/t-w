/* ═══ 💬 sim-chat-window.js — 대화창 배선 모듈 (2026-10-13 신설 · 앱 FSD 14번) ═══════════════
   app.js 의 «💬 대화창 배선» 구역(즉시 실행 함수 _wireChatWindow)을 parts/chat/chat-window.js 로 옮겼다.
   동작은 그대로여야 한다 — 여기서는 «옮긴 것» 을 가짜 DOM 위에서 통째로 굴린다.
   ・1절: 만들 때 — 싣기만 하면 window.TwChatWindow 뿐 · 만들면 버튼 · 메뉴 · 끌기 · 크기 손잡이 · 입력 · 이모티콘 연결 ·
           저장값 반영(_applyChat*) · 복사 · 탭 묶기가 예전 순서로 · 창 DOM 이 없어도 안 선다
   ・2절: 닫기 · 최소화 · ESC(한 겹씩) · 입력 Enter(조합 중이면 무시) · 링크
   ・3절: 타이틀바 끌기(화면 안 · 버튼 위 누름은 끌기 아님) · 8방향 크기(최소 · 최대) · 끝나면 자리 저장
   ・4절: 메뉴 — 파일 · 설정 · 지우기(하나만 열림 · 바깥 누르면 닫힘) · 글자 크기 · 🔔 알림음(회사원 모드 잠금) · ▶ 서브메뉴 · 대화 저장
   ・5절: 🌫️ 투명도 — 끄는 동안 바로 보이고 놓을 때 저장 · 타이틀바 · 단축키로 안 샘
   ・6절: 🌊 날리기 — 체크 · 크기 · 색(Lv.200 · 관리자) — 세션 변수는 쓰는 함수로
   ・7절: 🔇 잠금 · 🗑 기록 삭제 · 😊 이모티콘(그리드 · ＋ · 기본 · 내 것 · 파일) · 🎲 주사위
   ・8절: 💣 플라잉체어 조준 · 📷 스티커사진 — 채널 · 회사원 모드 · 레벨 · 혼자 · 준비 중 · 연타
   ・9절: app.js 배선 — 정의는 모듈에만 · 만드는 곳 한 곳 · 원래 자리 · deps 모양(함수는 화살표 · let 은 읽는/쓰는 함수 · 값) · 빈 껍데기 · html 순서 · 전역 이름
   ・10절: 일부러 깨 보기 — 모듈 글을 조금씩 망가뜨려 2~8절이 잡아내는지(이 검사가 헛돌지 않는지) 스스로 확인
   [실행] chat-window.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['chat-window.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ console.log('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = _joinRenderer(SRC['app.js']), HTML = SRC['desk-companion-prototype.html'], MOD = SRC['chat-window.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

const IDS = ['chatWindow', 'chatCloseBtn', 'chatMinBtn', 'chatFileMenu', 'chatViewMenu', 'chatFsMenu', 'chatFsSub', 'chatSfxToggle',
  'chatClearMenu', 'chatClearNow', 'chatClearUndo', 'chatOpacity', 'chatEmojiWin', 'chatSaveLog', 'chatInput', 'chatMessages',
  'chatFlyChk', 'chatFlySizes', 'chatFlySwatches', 'chatOffToggle', 'chatDelLog', 'chatDelOv', 'chatDelWin', 'chatDelX', 'chatDelCancel', 'chatDelOk',
  'chatEmojiBtn', 'chatEmojiWinClose', 'chatDiceBtn', 'chatBombBtn', 'chatPhotoBtn', 'emojiGrid', 'emojiFileInput'];
const RZ = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

function mkEl(id, env, extra){
  const L = {}, cls = new Set();
  const el = Object.assign({
    id, style: {}, dataset: {}, title: '', value: '', checked: false, disabled: false, onclick: null, _L: L, _cls: cls, _attr: {},
    classList: {
      add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c),
      toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; on ? cls.add(c) : cls.delete(c); return on; },
    },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
    fire(t, ev){ const e = mkEv(ev); (L[t] || []).slice().forEach(fn => fn(e)); return e; },
    getAttribute: (k) => (k in el._attr ? el._attr[k] : null),
    setPointerCapture(){ env.caps++; }, releasePointerCapture(){ env.rels++; },
    contains: (t) => t === el || (el._kids || []).includes(t),
    focus(){ env.focused = el.id; },
    get offsetWidth(){ return el.id === 'chatWindow' ? env.winW : 0; },
    get offsetHeight(){ return el.id === 'chatWindow' ? env.winH : 0; },
    getBoundingClientRect: () => (el.id === 'chatFsSub' ? { width: 120, right: env.subRight } : { left: env.rect.left, top: env.rect.top, width: env.winW, height: env.winH }),
  }, extra || {});
  return el;
}
function mkEv(ev){
  const e = Object.assign({ target: { closest: () => null } }, ev || {});
  e.stopPropagation = () => { e._sp = (e._sp || 0) + 1; };
  e.preventDefault = () => { e._pd = true; };
  return e;
}
/* closest 흉내 — 셀렉터 → 돌려줄 요소 */
const tgt = (map) => ({ closest: (s) => (map && map[s]) || null });

function mkEnv(opt){
  opt = opt || {};
  const env = {
    log: [], toasts: [], docL: {}, caps: 0, rels: 0, focused: null, opened: [],
    rect: { left: 200, top: 100 }, winW: 400, winH: 360, subRight: 500,
    open: true, mini: false, office: false, sfxOn: true, level: 150, admin: false, aiming: false, channel: 2,
    emoji: {}, pk: true, puriOpen: null,
  };
  const els = {};
  if(!opt.noDom){
    IDS.forEach(id => { els[id] = mkEl(id, env); });
    els.title = mkEl('title', env);
    els.handles = RZ.map(r => { const h = mkEl('rz-' + r, env); h._attr['data-rz'] = r; return h; });
    els.fsItems = [11, 12, 14, 16].map(n => { const it = mkEl('fs' + n, env); it.dataset.fs = String(n); return it; });
    els.sfxItems = [1, 2, 3].map(n => { const pv = mkEl('pv' + n, env); const it = mkEl('sfx' + n, env, { querySelector: (s) => (s === '.chat-sfx-pv' ? pv : null) }); it.dataset.sfx = String(n); it._pv = pv; return it; });
    els.fsSubItem = mkEl('fsSubItem', env);
    els.chatFsSub._kids = [els.fsSubItem].concat(els.fsItems);
    els.chatWindow.querySelectorAll = (s) => (s === '.chat-rz' ? els.handles : []);
  }
  const menus = () => ['chatFileMenu', 'chatViewMenu', 'chatClearMenu'].map(id => els[id]).filter(Boolean);
  const ctx = {
    Math, JSON, String, Number, Array, Object, Boolean, parseFloat, parseInt, Error,
    console: { warn(){}, log(){} },
    innerWidth: 1000, innerHeight: 800,
    requestAnimationFrame: (fn) => fn(),
    document: {
      getElementById: (id) => els[id] || null,
      querySelector: (s) => (s === '#chatWindow .chat-titlebar' ? (els.title || null) : null),
      querySelectorAll: (s) => (s === '#chatWindow .chat-menu-item.open' ? menus().filter(m => m.classList.contains('open'))
        : s === '.chat-fs-item' ? (els.fsItems || []) : s === '.chat-sfx-item' ? (els.sfxItems || []) : []),
      addEventListener: (t, fn) => { (env.docL[t] = env.docL[t] || []).push(fn); },
    },
    open: (u, w, f) => { env.opened.push(['window.open', u, w, f]); },
  };
  ctx.window = ctx;
  if(!opt.noCompanion) ctx.companion = { openBrowser: (u) => env.opened.push(['openBrowser', u]) };
  vm.createContext(ctx);
  vm.runInContext(opt.src || MOD, ctx, { filename: 'chat-window.js' });
  env.ctx = ctx; env.els = els;
  const L = (name, ret) => (...a) => { env.log.push([name].concat(a)); return typeof ret === 'function' ? ret(...a) : ret; };
  env.mk = () => {
    ctx._activeChannel = env.channel;
    return (env.api = ctx.TwChatWindow.createChatWindow({
      closeChatWindow: L('closeChatWindow'),
      chatWindowIsOpen: () => env.open,
      chatIsMinimized: () => env.mini,
      setChatMinimized: L('setChatMinimized'),
      saveChatWinPos: L('saveChatWinPos'),
      sendChatWindowMsg: L('sendChatWindowMsg'),
      bindChatCopy: L('bindChatCopy'),
      bindChatTabs: L('bindChatTabs'),
      toast: (m) => env.toasts.push(m),
      saveChatLog: L('saveChatLog'),
      chatClearNow: L('chatClearNow'),
      chatClearUndo: L('chatClearUndo'),
      clampChatOpacity: (v) => Math.max(30, Math.min(100, parseInt(v, 10) || 100)),
      setChatOpacity: L('setChatOpacity'),
      applyChatOpacity: L('applyChatOpacity'),
      setChatFontSize: L('setChatFontSize'),
      applyChatFontSize: L('applyChatFontSize'),
      chatSfxOn: () => env.sfxOn,
      setChatSfxOn: L('setChatSfxOn'),
      setChatSfxId: L('setChatSfxId'),
      chatSfxPreview: L('chatSfxPreview'),
      applyChatSfxUI: L('applyChatSfxUI'),
      chatSfxOfficeLock: () => env.office,
      setChatFlyOn: L('setChatFlyOn'),
      setChatFlySize: L('setChatFlySize'),
      setChatFlyColor: L('setChatFlyColor'),
      chatFlyRefreshUI: L('chatFlyRefreshUI'),
      flySizeOk: (s) => (s === 's' || s === 'm' || s === 'l' ? s : 'l'),
      FLY_COLOR_LEVEL: 200,
      getFocusLevel: () => env.level,
      isAdmin: () => env.admin,
      chatOffToggleClick: L('chatOffToggleClick'),
      chatDelOpen: L('chatDelOpen'),
      chatDelClose: L('chatDelClose'),
      chatDelRun: L('chatDelRun'),
      toggleEmojiPanel: L('toggleEmojiPanel'),
      emojiCache: () => env.emoji,
      EMOJI_SLOTS: 8,
      onEmojiSlotClick: L('onEmojiSlotClick'),
      onEmojiFilePicked: L('onEmojiFilePicked'),
      deleteEmoji: L('deleteEmoji'),
      rollDice: L('rollDice'),
      FLY_MIN_LEVEL: 100,
      seats: env.seats = [{ remote: false }, { remote: true }],
      setFlyAiming: L('setFlyAiming'),
      flyAiming: () => env.aiming,
      officeMode: () => env.office,
      purikura: () => (env.pk ? {} : null),
      purikuraUi: { open: () => { env.log.push(['purikuraUi.open', els.chatPhotoBtn && els.chatPhotoBtn.dataset.busy]); return env.puriOpen; } },
    }));
  };
  env.names = () => env.log.map(x => x[0]);
  env.last = () => env.log[env.log.length - 1] || [];
  env.clear = () => { env.log.length = 0; env.toasts.length = 0; };
  env.docFire = (t, ev) => { const e = mkEv(ev); (env.docL[t] || []).slice().forEach(fn => fn(e)); return e; };
  return env;
}

/* 2~8절 — 10절(일부러 깨 보기)이 망가뜨린 글로 다시 굴린다 */
async function behave(src){
  const E = (o) => mkEnv(Object.assign({ src }, o || {}));

  say('── 2. 닫기 · 최소화 · ESC · 입력 · 링크');
  {
    const e = E(); e.mk(); e.clear();
    e.els.chatCloseBtn.onclick();
    chk(JSON.stringify(e.names()) === '["closeChatWindow"]', '✕ — closeChatWindow');
    e.clear();
    let ev = mkEv(); e.els.chatMinBtn.onclick(ev);
    chk(JSON.stringify(e.log) === '[["setChatMinimized",true]]' && ev._sp === 1, '▁ — 펼친 상태면 접는다(setChatMinimized(true)) · 누름은 위로 안 올림');
    e.mini = true; e.clear(); e.els.chatMinBtn.onclick(mkEv());
    chk(JSON.stringify(e.log) === '[["setChatMinimized",false]]', '  접힌 상태면 펼친다');
    e.clear();
    e.els.chatEmojiWin.classList.add('on');
    ev = e.docFire('keydown', { key: 'Escape' });
    chk(!e.els.chatEmojiWin.classList.contains('on') && !e.log.length && ev._sp === 1, 'ESC — 😊 이모티콘 창이 떠 있으면 그것만 닫는다(대화창은 남김)');
    ev = e.docFire('keydown', { key: 'Escape' });
    chk(JSON.stringify(e.names()) === '["closeChatWindow"]' && ev._sp === 1, '  한 번 더 — 대화창을 닫는다');
    e.clear(); e.open = false; e.els.chatEmojiWin.classList.add('on');
    ev = e.docFire('keydown', { key: 'Escape' });
    chk(!e.log.length && !ev._sp && e.els.chatEmojiWin.classList.contains('on'), '  대화창이 닫혀 있으면 ESC 를 건드리지 않는다');
    ev = e.docFire('keydown', { key: 'a' });
    chk(!e.log.length && !ev._sp, '  ESC 가 아닌 키는 그대로');
    e.open = true; e.clear();
    const inp = e.els.chatInput;
    ev = inp.fire('keydown', { key: 'Enter', isComposing: true, keyCode: 229 });
    chk(!e.log.length && ev._sp === 1 && !ev._pd, '입력 — 한글 조합 중 Enter 는 보내지 않는다(조합 확정에 쓰게 둠) · 위로는 안 올림');
    ev = inp.fire('keydown', { key: 'Enter', isComposing: false, keyCode: 229 });
    chk(!e.log.length, '  keyCode 229(옛 조합 표식)만 있어도 보내지 않는다');
    ev = inp.fire('keydown', { key: 'Enter', isComposing: false, keyCode: 13 });
    chk(JSON.stringify(e.names()) === '["sendChatWindowMsg"]' && ev._pd === true && ev._sp === 1, '  확정된 Enter — 보낸다(기본 동작 막음)');
    e.clear(); inp.fire('keydown', { key: 'Escape', keyCode: 27 });
    chk(JSON.stringify(e.names()) === '["closeChatWindow"]', '  입력칸 ESC — 대화창을 닫는다');
    e.clear(); ev = inp.fire('keydown', { key: 'x', keyCode: 88 });
    chk(!e.log.length && ev._sp === 1, '  다른 키는 창 단축키로 새지 않게 막기만');
    const a = { getAttribute: (k) => (k === 'data-url' ? 'https://example.com/x' : null) };
    ev = e.els.chatMessages.fire('click', { target: tgt({ '.cm-link': a }) });
    chk(JSON.stringify(e.opened) === '[["openBrowser","https://example.com/x"]]' && ev._pd === true, '링크 — Electron 이면 외부 브라우저로(companion.openBrowser)');
    e.els.chatMessages.fire('click', { target: tgt({}) });
    chk(e.opened.length === 1, '  링크가 아닌 곳 누름은 아무것도 안 한다');
    const w = E({ noCompanion: true }); w.mk();
    w.els.chatMessages.fire('click', { target: tgt({ '.cm-link': a }) });
    chk(JSON.stringify(w.opened) === '[["window.open","https://example.com/x","_blank","noopener"]]', '  웹이면 새 탭(noopener)');
  }

  say('── 3. 끌기 · 크기');
  {
    const e = E(); e.mk(); e.clear();
    const win = e.els.chatWindow, t = e.els.title;
    for(const sel of ['#chatCloseBtn', '#chatMinBtn', '#chatOpacity']){
      const ev = t.fire('pointerdown', { clientX: 250, clientY: 110, pointerId: 1, target: { closest: (s) => (s === '#chatCloseBtn, #chatMinBtn, #chatOpacity' ? { id: sel } : null) } });
      t.fire('pointermove', { clientX: 400, clientY: 300 });
      if(win.style.left !== undefined || ev._pd){ chk(false, '  ' + sel + ' 위 누름이 끌기를 시작했다'); }
    }
    chk(win.style.left === undefined && win.style.transform === undefined && e.caps === 0, '타이틀바의 ✕ · ▁ · 투명도 슬라이더 위 누름은 끌기가 아니다');
    const ev = t.fire('pointerdown', { clientX: 250, clientY: 110, pointerId: 7 });
    chk(win.style.transform === 'none' && win.style.left === '200px' && win.style.top === '100px' && ev._pd === true && e.caps === 1, '타이틀바 누름 — 중앙정렬을 풀고 지금 자리에서 절대좌표로');
    t.fire('pointermove', { clientX: 300, clientY: 160 });
    chk(win.style.left === '250px' && win.style.top === '150px', '  끄는 만큼 옮김');
    t.fire('pointermove', { clientX: 5000, clientY: -500 });
    chk(win.style.left === '600px' && win.style.top === '0px', '  화면 밖으로는 못 나감(1000−400 · 0)');
    t.fire('pointerup', { pointerId: 7 });
    chk(JSON.stringify(e.names()) === '["saveChatWinPos"]' && e.rels === 1, '  놓으면 자리 저장(한 번) · 포인터 놓아 줌');
    t.fire('pointermove', { clientX: 10, clientY: 10 }); t.fire('pointercancel', { pointerId: 7 });
    chk(win.style.left === '600px' && e.log.length === 1, '  놓은 뒤엔 안 움직이고 다시 저장하지 않는다');
    /* 크기 — se 로 늘리고 nw 로 줄인다 */
    e.clear(); e.rect = { left: 100, top: 100 }; e.winW = 400; e.winH = 360;
    const se = e.els.handles[RZ.indexOf('se')], nw = e.els.handles[RZ.indexOf('nw')];
    const d = se.fire('pointerdown', { clientX: 500, clientY: 460, pointerId: 3 });
    chk(d._pd === true && d._sp === 1 && win.style.width === '400px' && win.style.height === '360px' && win.style.left === '100px', '손잡이 누름 — 지금 크기 · 자리를 고정값으로(위로는 안 올림)');
    se.fire('pointermove', { clientX: 560, clientY: 500 });
    chk(win.style.width === '460px' && win.style.height === '400px' && win.style.left === '100px' && win.style.top === '100px', '  se — 오른쪽 · 아래로 늘어남');
    se.fire('pointermove', { clientX: 5000, clientY: 5000 });
    chk(win.style.width === '960px' && win.style.height === '736px', '  최대는 화면의 96% · 92%');
    nw.fire('pointermove', { clientX: 0, clientY: 0 });
    chk(win.style.width === '960px', '  잡지 않은 손잡이의 움직임은 무시');
    se.fire('pointerup', { pointerId: 3 });
    chk(JSON.stringify(e.names()) === '["saveChatWinPos"]', '  놓으면 자리 저장');
    nw.fire('pointerdown', { clientX: 100, clientY: 100, pointerId: 4 });
    nw.fire('pointermove', { clientX: 400, clientY: 400 });
    chk(win.style.width === '300px' && win.style.height === '260px' && win.style.left === '200px' && win.style.top === '200px', '  nw — 최소 300×260 · 왼쪽 · 위 가장자리가 따라 움직임');
    nw.fire('pointercancel', { pointerId: 4 });
    chk(e.log.length === 2, '  취소돼도 저장');
  }

  say('── 4. 메뉴');
  {
    const e = E(); e.mk(); e.clear();
    const fm = e.els.chatFileMenu, vm_ = e.els.chatViewMenu, cm = e.els.chatClearMenu;
    let ev = fm.fire('click');
    chk(fm.classList.contains('open') && ev._sp === 1, '파일 메뉴 — 누르면 열림');
    vm_.fire('click');
    chk(vm_.classList.contains('open') && !fm.classList.contains('open'), '설정 메뉴를 열면 다른 메뉴는 닫힌다(하나만)');
    cm.fire('click');
    chk(cm.classList.contains('open') && !vm_.classList.contains('open'), '  지우기 메뉴도 같다');
    cm.fire('click');
    chk(!cm.classList.contains('open'), '  한 번 더 누르면 닫힘');
    fm.fire('click'); e.els.chatFsMenu.classList.add('sub-open');
    e.docFire('click');
    chk(!fm.classList.contains('open') && !e.els.chatFsMenu.classList.contains('sub-open'), '바깥을 누르면 닫힘(▶ 서브메뉴 고정도 풀림)');
    vm_.fire('click');
    ev = e.els.fsItems[2].fire('click');
    chk(JSON.stringify(e.log) === '[["setChatFontSize",14]]' && !vm_.classList.contains('open') && ev._sp === 1, '글자 크기 — 고르면 setChatFontSize(14) · 설정 메뉴 닫힘');
    e.clear(); vm_.fire('click');
    ev = e.els.chatSfxToggle.fire('click');
    chk(JSON.stringify(e.log) === '[["setChatSfxOn",false]]' && vm_.classList.contains('open') && ev._sp === 1, '🔔 알림음 켬/끔 — 뒤집기 · 메뉴는 열린 채');
    e.sfxOn = false; e.clear(); e.els.chatSfxToggle.fire('click');
    chk(JSON.stringify(e.log) === '[["setChatSfxOn",true]]', '  꺼져 있으면 켠다');
    e.office = true; e.clear(); e.els.chatSfxToggle.fire('click');
    chk(!e.log.length && e.toasts[0] === '회사원 모드에서는 알림음이 꺼져 있어요', '  🏢 회사원 모드면 안내만 · 저장값은 그대로');
    e.office = false; e.clear();
    ev = e.els.sfxItems[1].fire('click');
    chk(JSON.stringify(e.log) === '[["setChatSfxId",2]]' && ev._sp === 1 && vm_.classList.contains('open'), '  소리 고르기 — setChatSfxId(2) · 메뉴는 열린 채');
    e.clear(); ev = e.els.sfxItems[2]._pv.fire('click');
    chk(JSON.stringify(e.log) === '[["chatSfxPreview",3]]' && ev._sp === 1, '  ▷ — 듣기만(고르지 않음)');
    const fs_ = e.els.chatFsMenu, sub = e.els.chatFsSub;
    sub.classList.add('flip'); e.subRight = 900; fs_.fire('mouseenter');
    chk(!sub.classList.contains('flip'), '▶ 서브메뉴 — 화면 안이면 뒤집지 않는다');
    e.subRight = 1100; fs_.fire('mouseenter');
    chk(sub.classList.contains('flip'), '  오른쪽 끝을 넘으면 왼쪽으로 뒤집는다');
    ev = fs_.fire('click', { target: fs_ });
    chk(fs_.classList.contains('sub-open') && ev._sp === 1, '  «글자 크기 ▶» 줄을 누르면 고정해서 연다');
    fs_.fire('click', { target: e.els.fsSubItem });
    chk(fs_.classList.contains('sub-open'), '  서브메뉴 안 누름은 고정을 안 바꾼다');
    fs_.fire('click', { target: fs_ });
    chk(!fs_.classList.contains('sub-open'), '  한 번 더 — 풀림');
    e.clear(); cm.fire('click'); ev = e.els.chatClearNow.fire('click');
    chk(JSON.stringify(e.names()) === '["chatClearNow"]' && !cm.classList.contains('open') && ev._sp === 1, '🧹 지우기 — chatClearNow · 메뉴 닫힘');
    e.clear(); cm.fire('click'); e.els.chatClearUndo.fire('click');
    chk(JSON.stringify(e.names()) === '["chatClearUndo"]' && !cm.classList.contains('open'), '  다시 보기 — chatClearUndo');
    e.clear(); fm.fire('click'); ev = mkEv(); e.els.chatSaveLog.onclick(ev);
    chk(JSON.stringify(e.names()) === '["saveChatLog"]' && !fm.classList.contains('open') && ev._sp === 1, '대화 저장 — saveChatLog · 파일 메뉴 닫힘');
  }

  say('── 5. 투명도');
  {
    const e = E(); e.mk(); e.clear();
    const o = e.els.chatOpacity;
    o.value = '55'; o.fire('input');
    chk(e.els.chatWindow.style.opacity === '0.55' && e.els.chatEmojiWin.style.opacity === '0.55' && o.title === '투명도 55%' && !e.log.length,
      '끄는 동안 — 대화창 · 이모티콘 창에 바로 · 저장은 안 함');
    o.value = '100'; o.fire('input');
    chk(e.els.chatWindow.style.opacity === '' && e.els.chatEmojiWin.style.opacity === '' && o.title === '투명도 100%', '  100% 면 opacity 를 비운다');
    o.value = '5'; o.fire('input');
    chk(e.els.chatWindow.style.opacity === '0.3', '  값은 clampChatOpacity 를 거친다');
    o.fire('change');
    chk(JSON.stringify(e.log) === '[["setChatOpacity","5"]]', '  놓으면 저장(setChatOpacity)');
    chk(o.fire('pointerdown')._sp === 1 && o.fire('keydown', { key: 'ArrowLeft' })._sp === 1, '  누름 · 방향키는 타이틀바 끌기 · 창 단축키로 새지 않는다');
  }

  say('── 6. 날리기');
  {
    const e = E(); e.mk(); e.clear();
    const c = e.els.chatFlyChk;
    chk(c.fire('click')._sp === 1, '체크 누름은 위로 안 올림');
    c.checked = true; c.fire('change');
    chk(JSON.stringify(e.log) === '[["setChatFlyOn",true],["chatFlyRefreshUI"]]', '체크 — setChatFlyOn(true) 뒤 다시 그림');
    e.clear(); c.checked = false; c.fire('change');
    chk(JSON.stringify(e.log) === '[["setChatFlyOn",false],["chatFlyRefreshUI"]]', '  끄면 false');
    e.clear();
    const fszB = { getAttribute: (k) => (k === 'data-flysize' ? 'm' : null) };
    let ev = e.els.chatFlySizes.fire('click', { target: tgt({ '.fsz': fszB }) });
    chk(JSON.stringify(e.log) === '[["setChatFlySize","m"],["chatFlyRefreshUI"]]' && ev._sp === 1, '크기 단추 — flySizeOk 를 거쳐 setChatFlySize');
    e.clear(); e.els.chatFlySizes.fire('click', { target: tgt({ '.fsz': { getAttribute: () => 'zz' } }) });
    chk(JSON.stringify(e.log[0]) === '["setChatFlySize","l"]', '  모르는 값은 flySizeOk 가 고친 값으로');
    e.clear(); e.els.chatFlySizes.fire('click', { target: tgt({}) });
    chk(!e.log.length, '  단추가 아닌 곳은 무시');
    const sw = (col) => ({ target: tgt({ '.fsw': { getAttribute: (k) => (k === 'data-flycolor' ? col : null) } }) });
    e.clear(); e.level = 150; e.els.chatFlySwatches.fire('click', sw('rainbow'));
    chk(!e.log.length && e.toasts[0] === '🔒 Lv.200 달성 시 색을 고를 수 있어요', '색 — Lv.200 미만은 안내만');
    e.clear(); e.admin = true; e.els.chatFlySwatches.fire('click', sw('rainbow'));
    chk(JSON.stringify(e.log) === '[["setChatFlyColor","rainbow"],["chatFlyRefreshUI"]]', '  관리자는 레벨과 상관없이 고른다(isAdmin 은 부를 때 읽음)');
    e.clear(); e.admin = false; e.level = 200; e.els.chatFlySwatches.fire('click', sw(null));
    chk(JSON.stringify(e.log) === '[["setChatFlyColor",""],["chatFlyRefreshUI"]]', '  Lv.200 이면 고른다 · 값이 없으면 흰 글씨(\'\')');
    e.clear(); e.els.chatFlySwatches.fire('click', { target: tgt({}) });
    chk(!e.log.length && !e.toasts.length, '  색 칸이 아닌 곳은 무시');
  }

  say('── 7. 잠금 · 기록 삭제 · 이모티콘 · 주사위');
  {
    const e = E(); e.mk(); e.clear();
    const click = (id) => { const ev = mkEv(); e.els[id].onclick(ev); return ev; };
    chk(click('chatOffToggle')._sp === 1 && JSON.stringify(e.names()) === '["chatOffToggleClick"]', '🔇 채팅 켜기/끄기 — chatOffToggleClick');
    e.clear(); click('chatDelLog');
    chk(JSON.stringify(e.names()) === '["chatDelOpen"]', '🗑 기록 삭제 — 확인창 열기');
    e.clear(); click('chatDelOv'); click('chatDelX'); click('chatDelCancel');
    chk(JSON.stringify(e.names()) === '["chatDelClose","chatDelClose","chatDelClose"]', '  배경 · ✕ · 취소 — 닫기');
    e.clear(); const w = click('chatDelWin');
    chk(!e.log.length && w._sp === 1, '  창 안쪽 누름은 배경까지 안 올라간다(지우려다 닫히지 않게)');
    e.els.chatDelOk.disabled = true; click('chatDelOk');
    chk(!e.log.length, '  확인 단추가 꺼져 있으면 안 지운다');
    e.els.chatDelOk.disabled = false; click('chatDelOk');
    chk(JSON.stringify(e.names()) === '["chatDelRun"]', '  켜져 있으면 chatDelRun');
    e.clear(); click('chatEmojiBtn');
    chk(JSON.stringify(e.names()) === '["toggleEmojiPanel"]', '😊 — 이모티콘 창 토글');
    e.els.chatEmojiWin.classList.add('on'); e.els.chatEmojiWinClose.onclick();
    chk(!e.els.chatEmojiWin.classList.contains('on'), '  이모티콘 창 ✕ — 닫힘');
    e.clear(); click('chatDiceBtn');
    chk(JSON.stringify(e.names()) === '["rollDice"]', '🎲 — 굴리기');
    const g = e.els.emojiGrid;
    e.clear(); let ev = g.fire('click', { target: tgt({ '.es-del': { getAttribute: (k) => (k === 'data-del' ? '3' : null) } }) });
    chk(JSON.stringify(e.log) === '[["deleteEmoji",3]]' && ev._sp === 1, '그리드 — 🗑 내 이모티콘 지우기(deleteEmoji(3))');
    e.clear(); e.emoji = { 0: { url: 'a' }, 1: { url: 'b' }, 2: { cmd: 'x' } };
    g.fire('click', { target: tgt({ '[data-add]': {} }) });
    chk(JSON.stringify(e.log) === '[["onEmojiSlotClick",2]]', '  ＋ — 첫 빈 칸(url 없는 칸 2)으로 등록 흐름');
    e.clear(); e.emoji = {}; for(let i = 0; i < 8; i++) e.emoji[i] = { url: 'u' + i };
    g.fire('click', { target: tgt({ '[data-add]': {} }) });
    chk(!e.log.length && e.toasts[0] === '내 이모티콘은 8개까지 등록할 수 있어요', '  칸이 다 찼으면 안내(이모티콘은 부를 때마다 읽는다)');
    e.clear(); e.els.chatInput.value = '안녕';
    g.fire('click', { target: tgt({ '[data-cmd]': { getAttribute: (k) => (k === 'data-cmd' ? '하트' : null) } }) });
    chk(e.els.chatInput.value === '안녕/하트 ' && e.focused === 'chatInput' && !e.log.length, '  기본 이모티콘 — 입력칸 끝에 /명령어 (보내지는 않음)');
    e.clear(); g.fire('click', { target: tgt({ '.emoji-chip[data-slot], .emoji-slot[data-slot]': { getAttribute: (k) => (k === 'data-slot' ? '5' : null) } }) });
    chk(JSON.stringify(e.log) === '[["onEmojiSlotClick",5]]', '  내 이모티콘 — onEmojiSlotClick(5)');
    e.clear(); const f = { name: 'a.png' };
    e.els.emojiFileInput.files = [f]; e.els.emojiFileInput.fire('change');
    e.els.emojiFileInput.files = null; e.els.emojiFileInput.fire('change');
    chk(e.log.length === 2 && e.log[0][1] === f && e.log[1][1] === null, '파일 고름 — onEmojiFilePicked(파일 · 없으면 null)');
  }

  say('── 8. 💣 플라잉체어 · 📷 스티커사진');
  {
    const e = E(); e.mk(); e.clear();
    const bomb = () => { const ev = mkEv(); e.els.chatBombBtn.onclick(ev); return ev; };
    e.ctx._activeChannel = 1; bomb();
    chk(!e.log.length && e.toasts[0] === '투게더룸에서만 쓸 수 있어요', '💣 — 투게더룸이 아니면 안내만');
    e.ctx._activeChannel = 2; e.office = true; e.clear(); bomb();
    chk(!e.log.length && e.toasts[0] === '🏢 회사원 모드에서는 쓸 수 없어요', '  🏢 회사원 모드면 안내만(officeMode 는 부를 때 읽음)');
    e.office = false; e.level = 99; e.clear(); bomb();
    chk(!e.log.length && e.toasts[0] === '💣 는 레벨 100부터 쓸 수 있어요 (지금 레벨 99)', '  레벨 100 미만이면 안내(지금 레벨 함께)');
    e.level = 100; e.seats[1].remote = false; e.clear(); bomb();
    chk(!e.log.length && e.toasts[0] === '방에 다른 분이 있어야 해요', '  방에 혼자면 안내');
    e.seats[1].remote = true; e.clear(); const ev = bomb();
    chk(JSON.stringify(e.log) === '[["setFlyAiming",true]]' && ev._sp === 1 && !e.toasts.length, '  다 되면 조준을 켠다');
    e.aiming = true; e.clear(); bomb();
    chk(JSON.stringify(e.log) === '[["setFlyAiming",false]]', '  조준 중이면 끈다(_flyAiming 은 부를 때 읽음)');
    const cam = e.els.chatPhotoBtn;
    const shoot = async () => { const ev = mkEv(); await cam.onclick(ev); return ev; };
    e.ctx._activeChannel = 1; e.clear(); await shoot();
    chk(!e.log.length && e.toasts[0] === '투게더룸에서만 쓸 수 있어요', '📷 — 투게더룸이 아니면 안내만');
    e.ctx._activeChannel = 2; e.office = true; e.clear(); await shoot();
    chk(!e.log.length && e.toasts[0] === '🏢 회사원 모드에서는 쓸 수 없어요', '  🏢 회사원 모드면 안내만');
    e.office = false; e.pk = false; e.clear(); await shoot();
    chk(!e.log.length && e.toasts[0] === '📷 스티커사진은 아직 준비 중이에요', '  세션이 없으면 «준비 중»');
    e.pk = true; e.clear(); cam.dataset.busy = '1'; await shoot();
    chk(!e.log.length && cam.dataset.busy === '1', '  여는 중이면(연타) 또 안 연다');
    cam.dataset.busy = '0'; e.clear(); const sv = await shoot();
    chk(JSON.stringify(e.log) === '[["purikuraUi.open","1"]]' && cam.dataset.busy === '0' && sv._sp === 1, '  다 되면 purikuraUi.open — 여는 동안 busy 1 · 끝나면 0');
    e.puriOpen = Promise.reject(new Error('x')); e.clear();
    let threw = false; try{ await shoot(); }catch(_){ threw = true; }
    chk(threw && cam.dataset.busy === '0', '  열다가 서도 busy 는 0 으로 돌아온다(finally)');
  }
}

(async () => {
const sec = async (t, fn) => { say(t); try{ await fn(); }catch(e){ chk(false, '예외 — ' + (e && e.stack || e).toString().split('\n').slice(0, 2).join(' / ')); } };

await sec('── 1. 만들 때', () => {
  const e = mkEnv();
  chk(Object.keys(e.ctx.TwChatWindow).join() === 'createChatWindow' && typeof e.ctx.TwChatWindow.createChatWindow === 'function', '싣기만 하면 window.TwChatWindow(createChatWindow) 하나뿐');
  chk(!e.log.length && !Object.keys(e.docL).length && !e.els.chatCloseBtn.onclick, '  싣기만 해서는 아무것도 안 건다');
  const api = e.mk();
  chk(api && typeof api === 'object' && !Object.keys(api).length, '만들면 빈 객체 — 밖에서 부르는 이름 없음');
  chk(JSON.stringify(e.names()) === '["applyChatFontSize","applyChatSfxUI","applyChatOpacity","bindChatCopy","bindChatTabs"]',
    '  저장값 반영(글자 크기 → 알림음 → 투명도) 뒤 📋 복사 · 💬 탭 묶기 — 예전 순서');
  const oc = ['chatCloseBtn', 'chatMinBtn', 'chatSaveLog', 'chatOffToggle', 'chatDelLog', 'chatDelOv', 'chatDelWin', 'chatDelX', 'chatDelCancel', 'chatDelOk',
    'chatEmojiBtn', 'chatEmojiWinClose', 'chatDiceBtn', 'chatBombBtn', 'chatPhotoBtn'];
  chk(oc.every(id => typeof e.els[id].onclick === 'function'), '  onclick 열다섯(✕ · ▁ · 저장 · 🔇 · 🗑 여섯 · 😊 · 이모티콘 ✕ · 🎲 · 💣 · 📷)');
  const n = (el, t) => (el._L[t] || []).length;
  chk(n(e.els.title, 'pointerdown') === 1 && n(e.els.title, 'pointermove') === 1 && n(e.els.title, 'pointerup') === 1 && n(e.els.title, 'pointercancel') === 1, '  타이틀바 끌기 넷');
  chk(e.els.handles.every(h => n(h, 'pointerdown') === 1 && n(h, 'pointermove') === 1 && n(h, 'pointerup') === 1 && n(h, 'pointercancel') === 1), '  크기 손잡이 여덟 — 넷씩');
  chk((e.docL.click || []).length === 3 && (e.docL.keydown || []).length === 1, '  document — 바깥 누름 셋(파일 · 설정 · 지우기) · ESC 하나');
  chk(n(e.els.chatFileMenu, 'click') === 1 && n(e.els.chatViewMenu, 'click') === 1 && n(e.els.chatClearMenu, 'click') === 1 && n(e.els.chatSfxToggle, 'click') === 1
    && e.els.fsItems.every(i => n(i, 'click') === 1) && e.els.sfxItems.every(i => n(i, 'click') === 1 && n(i._pv, 'click') === 1)
    && n(e.els.chatFsMenu, 'mouseenter') === 1 && n(e.els.chatFsMenu, 'click') === 1 && n(e.els.chatClearNow, 'click') === 1 && n(e.els.chatClearUndo, 'click') === 1,
    '  메뉴 — 파일 · 설정(글자 크기 넷 · 알림음 켬끔 · 소리 셋 · ▷ 셋 · ▶) · 지우기 둘');
  chk(n(e.els.chatOpacity, 'pointerdown') === 1 && n(e.els.chatOpacity, 'input') === 1 && n(e.els.chatOpacity, 'change') === 1 && n(e.els.chatOpacity, 'keydown') === 1, '  투명도 넷');
  chk(n(e.els.chatInput, 'keydown') === 1 && n(e.els.chatMessages, 'click') === 1 && n(e.els.chatFlyChk, 'click') === 1 && n(e.els.chatFlyChk, 'change') === 1
    && n(e.els.chatFlySizes, 'click') === 1 && n(e.els.chatFlySwatches, 'click') === 1 && n(e.els.emojiGrid, 'click') === 1 && n(e.els.emojiFileInput, 'change') === 1,
    '  입력 · 링크 · 날리기 넷 · 이모티콘 그리드 · 파일');
  chk(!e.toasts.length && !e.opened.length && e.els.chatWindow.style.left === undefined, '  만들기만 해서는 안 열고 · 안 옮기고 · 안내도 없다');
  const z = mkEnv({ noDom: true });
  let r = null, err = null; try{ r = z.mk(); }catch(x){ err = x; }
  chk(!err && r && !Object.keys(r).length && JSON.stringify(z.names()) === '["applyChatFontSize","applyChatSfxUI","applyChatOpacity","bindChatCopy","bindChatTabs"]'
    && (z.docL.keydown || []).length === 1 && !z.docL.click, '창 DOM 이 없어도 안 선다(저장값 반영 · 묶기 · ESC 만 — 예전과 같음)');
});

try{ await behave(MOD); }catch(e){ chk(false, '예외 — ' + (e && e.stack || e).toString().split('\n').slice(0, 2).join(' / ')); }

await sec('── 9. app.js 배선', () => {
  const code = strip(APP);
  const defs = /function _wireChatWindow\(|function _bindChatDrag\(|function _bindChatResize\(|function _chatCloseMenus\(/;
  chk(!defs.test(code) && /function _wireChatWindow\(/.test(MOD) && /function _chatCloseMenus\(/.test(MOD), '대화창 배선 정의는 모듈에만');
  chk(/window\.TwChatWindow = api/.test(MOD) && (code.match(/TwChatWindow\.createChatWindow\(/g) || []).length === 1, '모듈은 window.TwChatWindow · 만드는 곳은 한 곳');
  const iHead = APP.indexOf('/* ═══ 💬 대화창 배선 — 닫기 · 최소화 · 끌기 · 메뉴 · 버튼 ═══ */'), iMk = APP.indexOf('TwChatWindow.createChatWindow('), iNext = APP.indexOf('/* ═══ 🎛️ 꾸미기 상세조정 패널 · 색 고르기 ═══ */');
  chk(iHead > 0 && iMk > iHead && iNext > iMk && /_selfFlyAfterDice\(\);\s*\n\}\s*\n\s*$/.test(APP.slice(iHead - 200, iHead)),
    '원래 자리 — 🎡 룰렛 뒤 · 구역 머리 아래 · 🎛️ 꾸미기 상세조정 앞');
  const call = (APP.match(/TwChatWindow\.createChatWindow\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('//'));
  const FN = [['closeChatWindow', 'closeChatWindow'], ['chatWindowIsOpen', '_chatWindowIsOpen'], ['chatIsMinimized', '_chatIsMinimized'], ['setChatMinimized', '_setChatMinimized'],
    ['saveChatWinPos', '_saveChatWinPos'], ['sendChatWindowMsg', '_sendChatWindowMsg'], ['bindChatCopy', '_bindChatCopy'], ['bindChatTabs', '_bindChatTabs'], ['toast', 'toast'],
    ['saveChatLog', '_saveChatLog'], ['chatClearNow', '_chatClearNow'], ['chatClearUndo', '_chatClearUndo'],
    ['clampChatOpacity', '_clampChatOpacity'], ['setChatOpacity', '_setChatOpacity'], ['applyChatOpacity', '_applyChatOpacity'], ['setChatFontSize', '_setChatFontSize'], ['applyChatFontSize', '_applyChatFontSize'],
    ['chatSfxOn', '_chatSfxOn'], ['setChatSfxOn', '_setChatSfxOn'], ['setChatSfxId', '_setChatSfxId'], ['chatSfxPreview', '_chatSfxPreview'], ['applyChatSfxUI', '_applyChatSfxUI'], ['chatSfxOfficeLock', '_chatSfxOfficeLock'],
    ['chatFlyRefreshUI', '_chatFlyRefreshUI'], ['flySizeOk', '_flySizeOk'], ['getFocusLevel', 'getFocusLevel'],
    ['chatOffToggleClick', '_chatOffToggleClick'], ['chatDelOpen', '_chatDelOpen'], ['chatDelClose', '_chatDelClose'], ['chatDelRun', '_chatDelRun'],
    ['toggleEmojiPanel', '_toggleEmojiPanel'], ['onEmojiSlotClick', '_onEmojiSlotClick'], ['onEmojiFilePicked', '_onEmojiFilePicked'], ['deleteEmoji', '_deleteEmoji'],
    ['rollDice', '_rollDice'], ['setFlyAiming', 'setFlyAiming'], ['purikura', '_purikura']];
  const want = {};
  FN.forEach(([k, v]) => { want[k] = k + ': (...a)=>' + v + '(...a),'; });
  [['setChatFlyOn', '_chatFlyOn'], ['setChatFlySize', '_chatFlySize'], ['setChatFlyColor', '_chatFlyColor']].forEach(([k, v]) => { want[k] = k + ': (v)=>{ ' + v + ' = v; },'; });
  [['isAdmin', 'isAdmin'], ['emojiCache', '_emojiCache'], ['flyAiming', '_flyAiming'], ['officeMode', 'officeMode']].forEach(([k, v]) => { want[k] = k + ': ()=>' + v + ','; });
  ['FLY_COLOR_LEVEL', 'EMOJI_SLOTS', 'FLY_MIN_LEVEL', 'seats', 'purikuraUi'].forEach(k => { want[k] = k + ': ' + k + ','; });
  const got = {}; deps.forEach(d => { got[d.split(':')[0]] = d; });
  const bad = Object.keys(want).filter(k => got[k] !== want[k]).concat(Object.keys(got).filter(k => !(k in want)));
  chk(deps.length === 49 && Object.keys(want).length === 49 && !bad.length, 'deps 49개 — 함수 37 은 화살표 · 세션 변수 셋은 쓰는 함수 · let 넷은 읽는 함수 · 값 다섯 (' + deps.length + (bad.length ? ' · 어긋남 ' + bad[0] : '') + ')');
  const declAt = (re) => { const m = re.exec(APP); return m ? m.index : -1; };
  const after = ['let isAdmin = false;', 'let officeMode = '].map(s => APP.indexOf(s));
  chk(after.every(i => i > iMk), '  isAdmin · officeMode 는 만드는 줄보다 뒤에 선언 — 값이면 TDZ(그래서 읽는 함수)');
  const before = [/let _flyAiming = false;/, /let _emojiCache = \{\};/, /let _chatFlyOn\s+= false;/, /let _chatFlySize\s+= 'l';/, /let _chatFlyColor = '';/,
    /const FLY_COLOR_LEVEL = 200;/, /const EMOJI_SLOTS = 8;/, /const FLY_MIN_LEVEL = 100;/, /const seats=\[\];/, /const purikuraUi = /].map(declAt);
  chk(before.every(i => i > 0 && i < iMk), '  값으로 넘기는 상수 · seats · purikuraUi 와 세션 변수 · _flyAiming · _emojiCache 는 만드는 줄보다 앞에 선언');
  chk(/[^.\w]_flyAiming\s*=[^=]/.test(code.replace(/let _flyAiming = false;/, '')) && /[^.\w]_emojiCache\s*=[^=]/.test(code.replace(/let _emojiCache = \{\};/, '')) && /[^.\w]isAdmin\s*=[^=]/.test(code.replace(/let isAdmin = false;/, '')),
    '  _flyAiming · _emojiCache · isAdmin 은 다시 대입되는 let — 그래서 읽는 함수');
  const m = strip(MOD);
  chk(/if\(officeMode\(\)\)\{ toast\('🏢 회사원 모드에서는 쓸 수 없어요'\); return; \}/.test(m) && !/if\(officeMode\)/.test(m) && /setFlyAiming\(!_flyAiming\(\)\)/.test(m)
    && /isAdmin\(\)\)\)\{/.test(m) && /_emojiCache\(\)\[i\]&&_emojiCache\(\)\[i\]\.url/.test(m), '모듈은 officeMode · _flyAiming · isAdmin · _emojiCache 를 부를 때마다 읽는다');
  chk(!/[^.\w](_chatFly(On|Size|Color)|officeMode|_flyAiming|isAdmin|_emojiCache)\s*=[^=>]/.test(m.replace(/const (officeMode|_flyAiming|isAdmin|_emojiCache) = deps\.\w+;/g, '')), '  모듈은 app.js 의 let 에 직접 쓰지 않는다(쓰는 함수로만)');
  const off = (APP.match(/const CHAT_WINDOW_OFF = (\{[^\n]*?\});/) || [])[1];
  chk(off === '{}', '빈 껍데기 CHAT_WINDOW_OFF — 반환값과 같은 빈 객체');
  const iF = HTML.indexOf('<script src="parts/focus/focus-log.js"></script>'), iC = HTML.indexOf('<script src="parts/chat/chat-window.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iF > 0 && iC > iF && iA > iC, 'html — chat-window.js 를 app.js 앞에 싣는다');
  chk(/^Tw[A-Z]/.test('TwChatWindow') && !/window\.ChatWindow\s*=/.test(MOD), '전역 이름은 Tw 접두사(#103 — 크로미움 내장 전역과 겹치지 않게)');
  const wire = (APP.match(/const CHAT_WINDOW_OFF = [\s\S]*?\n\}\);/) || [''])[0];
  let r = null; try{ r = vm.runInNewContext(wire + '\nchatWindowMod;', {}); }catch(_){}
  chk(!!r && !Object.keys(r).length, '모듈이 안 실려도 그 자리는 서지 않는다(빈 껍데기)');
});

await sec('── 10. 일부러 깨 보기 — 이 검사가 헛돌지 않는가', async () => {
  const CASES = [
    ['✕ 연결 빠짐', s => s.replace('if(close) close.onclick=closeChatWindow;', '')],
    ['▁ 뒤집기 안 함', s => s.replace('_setChatMinimized(!_chatIsMinimized());', '_setChatMinimized(true);')],
    ['끌기 예외에서 슬라이더 빠짐', s => s.replace("'#chatCloseBtn, #chatMinBtn, #chatOpacity'", "'#chatCloseBtn, #chatMinBtn'")],
    ['끌기 가두기 빠짐', s => s.replace("win.style.left=Math.max(0, Math.min(maxLeft, x))+'px';", "win.style.left=x+'px';")],
    ['끌기 끝 저장 빠짐', s => s.replace("try{ title.releasePointerCapture(e.pointerId); }catch(_){} _saveChatWinPos(); };", "try{ title.releasePointerCapture(e.pointerId); }catch(_){} };")],
    ['최소 폭 바뀜', s => s.replace('const minW=300, minH=260;', 'const minW=200, minH=260;')],
    ['메뉴 하나만 열림 빠짐', s => s.replace("viewMenu.classList.contains('open') && _chatCloseMenus(viewMenu);", '')],
    ['글자 크기 고른 뒤 메뉴 안 닫음', s => s.replace("_setChatFontSize(parseInt(it.dataset.fs, 10));\n        viewMenu.classList.remove('open');", "_setChatFontSize(parseInt(it.dataset.fs, 10));")],
    ['회사원 모드 잠금 빠짐', s => s.replace("if(_chatSfxOfficeLock()){ toast('회사원 모드에서는 알림음이 꺼져 있어요'); return; }", '')],
    ['▷ 가 소리를 고름', s => s.replace('_chatSfxPreview(id); });', '_chatSfxPreview(id); _setChatSfxId(id); });')],
    ['서브메뉴 뒤집기 빠짐', s => s.replace("if(r.width && r.right > window.innerWidth) fsSub.classList.add('flip');", '')],
    ['투명도 100% 도 opacity', s => s.replace("(pct>=100) ? '' : String(pct/100)", 'String(pct/100)')],
    ['투명도 끄는 동안 저장', s => s.replace("opa.title = '투명도 ' + pct + '%';", "opa.title = '투명도 ' + pct + '%'; _setChatOpacity(opa.value);")],
    ['ESC 가 한 번에 둘 다 닫음', s => s.replace("if(ep && ep.classList.contains('on')){ e.stopPropagation(); ep.classList.remove('on'); return; }", "if(ep && ep.classList.contains('on')){ ep.classList.remove('on'); }")],
    ['조합 중 Enter 도 보냄', s => s.replace('if(e.isComposing || e.keyCode === 229) return;', '')],
    ['날리기 체크를 반대로', s => s.replace('_setChatFlyOn(!!fchk.checked);', '_setChatFlyOn(!fchk.checked);')],
    ['크기 flySizeOk 안 거침', s => s.replace("_setChatFlySize(_flySizeOk(b.getAttribute('data-flysize')));", "_setChatFlySize(b.getAttribute('data-flysize'));")],
    ['색 레벨 문턱 빠짐', s => s.replace('if(lv < FLY_COLOR_LEVEL && !(', 'if(false && !(')],
    ['관리자를 값으로', s => s.replace("isAdmin())){", 'isAdmin)){')],
    ['삭제 창 안쪽 전파 안 끊음', s => s.replace('if(cdWin) cdWin.onclick=(e)=>{ e.stopPropagation(); };', '')],
    ['꺼진 확인 단추로도 지움', s => s.replace('if(!cdOk.disabled) _chatDelRun();', '_chatDelRun();')],
    ['💣 회사원 모드 값으로', s => s.replace(/if\(officeMode\(\)\)\{ toast\('🏢 회사원 모드에서는 쓸 수 없어요'\); return; \}\n    const lv/, "if(officeMode){ toast('🏢 회사원 모드에서는 쓸 수 없어요'); return; }\n    const lv")],
    ['💣 혼자여도 조준', s => s.replace("if(!seats.some(s=>s.remote)){ toast('방에 다른 분이 있어야 해요'); return; }", '')],
    ['조준 상태를 값으로', s => s.replace('setFlyAiming(!_flyAiming());', 'setFlyAiming(!_flyAiming);')],
    ['📷 busy 안 되돌림', s => s.replace("finally{ cam.dataset.busy = '0'; }", "cam.dataset.busy = '0';")],
    ['이모티콘 캐시를 값으로', s => s.replace('if(!(_emojiCache()[i]&&_emojiCache()[i].url))', 'if(!(_emojiCache[i]&&_emojiCache[i].url))')],
    ['기본 이모티콘 바로 보냄', s => s.replace("inp.value=(inp.value||'')+'/'+dc.getAttribute('data-cmd')+' '; inp.focus();", "inp.value='/'+dc.getAttribute('data-cmd'); inp.focus();")],
    ['저장값 반영 순서 바뀜', s => s.replace('_applyChatFontSize();   // 저장된 값 반영 + ✓ 표시\n  _applyChatSfxUI();', '_applyChatSfxUI();\n  _applyChatFontSize();')],
    ['링크 웹 폴백 noopener 빠짐', s => s.replace("else window.open(url, '_blank', 'noopener');", "else window.open(url, '_blank');")],
  ];
  for(const [name, mut] of CASES){
    const bent = mut(MOD);
    if(bent === MOD){ chk(false, name + ' — 망가뜨릴 글을 못 찾음(본문이 바뀌었다)'); continue; }
    quiet = true; qfail = 0;
    try{ await behave(bent); }catch(_){ qfail++; }
    /* 1절(만들 때)의 순서 · 연결도 같이 본다 — 반영 순서 · 연결 빠짐은 거기서만 보인다 */
    try{
      const e = mkEnv({ src: bent }); e.mk();
      if(JSON.stringify(e.names()) !== '["applyChatFontSize","applyChatSfxUI","applyChatOpacity","bindChatCopy","bindChatTabs"]') qfail++;
    }catch(_){ qfail++; }
    quiet = false;
    chk(qfail > 0, name + ' → 잡힘(' + qfail + ')');
  }
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
done = true;
process.exit(fail ? 1 : 0);
})();
/* 판정 줄 없이 끝나면 빨강 */
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });

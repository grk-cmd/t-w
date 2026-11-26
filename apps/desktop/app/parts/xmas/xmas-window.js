/* xmas-window.js — 🎄 크리스마스 창(일회성 — 다음 업데이트에서 걷는다 · 이슈 #963) (검사 sim-xmas-window.js)
   책임: 런처 [크리스마스] 버튼(받은 편지 열람 끝 — 1월 6일 0시 · 서버 시각 — 부터 숨김) · 창 열고 닫기 · 내 트리 불러오기(그림은 판이 달라진 자리만) ·
     장식 고르기 · 내 그림 올리기(64px PNG) · 한마디 · 장식 달기 · 바꾸기(5초 간격) · «트리가 다 찼어요» · 장식 신고 · 한마디 라벨.
   3D 는 xmas-tree.js, 편지 창은 xmas-letter.js(뮤직바 xmas-song.js), 서버는 net(firebaseAPI.xmas — 늦게 붙으므로 부를 때 찾는다), 규칙은 rules(TwXmasRules).
   ★ 그림 사본은 이 PC 의 GLB 영구 캐시(IndexedDB)에 «트리/자리@판» 키로 — 다시 열 때 판이 같은 그림은 받지 않는다.
     ⚠️ localStorage 에 두지 말 것 — 트리 하나가 수 MB 라 앱 전체가 같이 쓰는 한도를 먹어 캐릭터 저장 등이 실패한다.
   ★ 남이 쓴 한마디는 textContent 로만 넣는다.
   classic script(window.TwXmasWindow) — app.js 보다 먼저 싣는다. app.js 가 `createXmasWindow(deps)` 한 번 — 밖에서 부르는 이름 없음
   (런처 버튼 · 알림함 «익명의 편지가 왔어요» 가 창 열기 통로 NAV.XMAS 로 연다). */
(function(){
'use strict';

const IMG_CACHE_KEY = 'xmasimg:';   // GLB 영구 캐시(IndexedDB) 키 머리 — 'xmasimg:{트리}/{자리}@{판}' (판이 키에 있어 옛 판은 안 쓰이고 45일 뒤 치워진다)
const IMG_DATA_MAX = 15000;     // 서버 상한(16000)보다 조금 아래 — 넘으면 더 작게 줄인다
const FETCH_PAR = 6;

/**
 * @param {{ doc?:Document, win?:Window, THREE:any, ps1Dither:any, rules:any, treeMod:any, net:()=>any, serverNow:()=>number,
 *           notifyError:(code:string, err?:any)=>void, toast:(msg:string)=>void, escRegisterWindow:Function,
 *           onSizeChange:()=>void, onReady:(fn:()=>void)=>void, idbGet:(k:string)=>Promise<string|null>, idbPut:(k:string, v:string)=>any,
 *           songMod:any, letterMod:any, companion:()=>any, ytVideoId:(url:string)=>string|null, asyncPrompt:Function,
 *           storage:()=>Storage|null, twNav:{ NAV:any, on:Function } }} deps
 */
function createXmasWindow(deps){
  const doc = deps.doc || document;
  const win = deps.win || window;
  const rules = deps.rules;
  const net = deps.net;
  const serverNow = deps.serverNow;
  const notifyError = deps.notifyError;
  const toast = deps.toast;
  const idbGet = deps.idbGet;
  const idbPut = deps.idbPut;
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js) — 맨 앞에 붙여 쓴다(sim-nav 가 «deps 로 받는 모듈» 을 이 줄로 센다)
  const $ = (id) => doc.getElementById(id);

  const ov = $('xmasOverlay'), btn = $('lcXmas');
  if (!ov || !btn) throw new Error('xmas-window: #xmasOverlay · #lcXmas 가 html 에 없다');
  const tree = deps.treeMod.createXmasTree({ THREE: deps.THREE, rules, ps1Dither: deps.ps1Dither, doc, win });

  /* Esc 는 트리 창을 편지 창보다 먼저 등록한다 — 알림함 길은 두 창을 같은 틱에 열어서, 창 쌓기가 등록 순서로 쌓는다(편지 창이 위 → Esc 에 편지 창만 닫힘) */
  deps.escRegisterWindow({ key: 'xmas', el: ov, isOpen: () => ov.classList.contains('on'), close });
  const song = deps.songMod.createXmasSong({ doc, win, companion: deps.companion, ytVideoId: deps.ytVideoId, asyncPrompt: deps.asyncPrompt, toast, songTitleMax: rules.SONG_TITLE_MAX });
  const letter = deps.letterMod.createXmasLetter({ doc, win, rules, net, song, serverNow, toast, notifyError, escRegisterWindow: deps.escRegisterWindow,
    storage: deps.storage, onDot: (on) => btn.classList.toggle('xm-dot', on) });

  let treeNo = 0, mine = null, ornList = [], chosen = { kind: 'star', img: null }, lastHangAt = NaN, busy = false, seq = 0;

  /* ── 런처 버튼 — 받은 편지를 볼 수 있는 동안(장식은 이벤트 끝에 막혀도 편지는 1/5 까지) ── */
  function refreshButton(){
    btn.hidden = !rules.buttonOn(serverNow());
    if (btn.hidden){ if (ov.classList.contains('on')) close(); return; }
    letter.checkGot();   // 25일 0시가 지나면 받은 편지 → 빨간 점
    letter.paintBtn();   // 날짜가 넘어가면 [편지 쓰기] → [편지 열람]
  }

  /* ── 한마디 라벨 · 신고 ── */
  const say = $('xmasSay');
  tree.onSay((s) => {
    if (!s || !s.word){ say.hidden = true; return; }
    say.textContent = s.word; say.style.left = s.x + 'px'; say.style.top = s.y + 'px'; say.hidden = false;
  });
  let repSlot = null;
  /* 신고는 이벤트 끝(1/1 0시)에 막힌다 — 창은 받은 편지 때문에 1/5 까지 열리므로 여기서 안내로 끝낸다(서버도 거절 · 오류 번호 아님) */
  const REPORT_ENDED = '크리스마스 이벤트가 끝나 신고할 수 없어요.';
  tree.onReport((slot) => {
    if (!rules.eventOn(serverNow())){ toast(REPORT_ENDED); return; }
    repSlot = slot; $('xmasRep').hidden = false; $('xmasRepNo').focus();
  });
  $('xmasRepNo').onclick = () => { $('xmasRep').hidden = true; repSlot = null; };
  $('xmasRepYes').onclick = async () => {
    $('xmasRep').hidden = true;
    const s = repSlot; repSlot = null;
    if (s == null) return;
    if (!rules.eventOn(serverNow())){ toast(REPORT_ENDED); return; }   // 확인창을 연 채 끝을 넘긴 때
    const r = await net().reportOrnament(treeNo, s);
    if (r.ok) toast('신고했어요. 관리자가 확인할게요.');
    else if (r.code === 'dup') toast('이미 신고한 장식이에요.');
    else if (r.code === 'auth') toast('로그인한 뒤 신고할 수 있어요.');
    else notifyError('E-XMAS-03', r.err);
  };

  /* ── 장식 고르기 ── */
  const pick = $('xmasPick');
  function choose(b, kind, img){
    chosen = { kind, img };
    pick.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  }
  function addPick(kind, src, label, img){
    const b = doc.createElement('button'); b.type = 'button'; b.className = 'xm-orn'; b.title = label; b.setAttribute('aria-label', label);
    const im = doc.createElement('img'); im.alt = ''; im.src = src; b.appendChild(im);
    b.onclick = () => choose(b, kind, img);
    pick.insertBefore(b, $('xmasUpLab'));
    return b;
  }
  [['bulb', '전구'], ['star', '별'], ['sock', '양말'], ['cane', '지팡이 사탕'], ['gift', '선물']].forEach(([k, l]) => {
    const c = deps.treeMod.baseCanvas(k, doc);
    const b = addPick(k, c && c.toDataURL ? c.toDataURL() : '', l, null);
    if (k === 'star') choose(b, k, null);
  });
  /** 올린 그림 → 64px(넘치면 48 · 32) PNG data URL. 정사각형 가운데를 자른다 */
  function shrink(img){
    for (const px of [rules.IMG_PX, 48, 32]){
      const c = doc.createElement('canvas'); c.width = c.height = px;
      const g = c.getContext('2d'); if (!g) return null;
      const s = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
      g.imageSmoothingEnabled = true;
      g.drawImage(img, ((img.naturalWidth || img.width) - s) / 2, ((img.naturalHeight || img.height) - s) / 2, s, s, 0, 0, px, px);
      const d = c.toDataURL('image/png');
      if (d.length <= IMG_DATA_MAX) return d;
    }
    return null;
  }
  $('xmasUp').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)){ toast('그림 파일만 올릴 수 있어요.'); return; }
    const fr = new win.FileReader();
    fr.onload = () => {
      const src = TwSafeHtml.safeUrl(String(fr.result || ''), 'image');   // png · jpeg · webp · gif data URL 만
      if (!src){ toast('그림을 읽지 못했어요.'); return; }
      const img = new win.Image();
      img.onload = () => {
        const d = shrink(img);
        if (!d){ toast('그림이 너무 복잡해서 올릴 수 없어요. 다른 그림을 골라 주세요.'); return; }
        const b = addPick('img', d, '내 그림', d);
        choose(b, 'img', d);
      };
      img.onerror = () => toast('그림을 읽지 못했어요.');
      img.src = src;
    };
    fr.onerror = () => toast('그림을 읽지 못했어요.');
    fr.readAsDataURL(f);
  });

  /* ── 그림 사본(이 PC · IndexedDB) ── */
  const imgKey = (t, s, v) => IMG_CACHE_KEY + t + '/' + s + '@' + v;
  /** 서버에서 받은 그림(남이 올린 값) — 이미지 data URL 만 받는다 */
  function loadImage(d){
    const src = TwSafeHtml.safeUrl(d, 'image');
    if (!src) return Promise.resolve(null);
    return new Promise((res) => { const im = new win.Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  }

  /* ── 불러오기 ── */
  function setCount(n){ $('xmasCount').textContent = treeNo ? ('트리 #' + treeNo + ' · ' + n + '/' + rules.TREE_MAX) : ''; }
  function setState(text){ const el = $('xmasState'); el.textContent = text || ''; el.hidden = !text; }
  async function load(blinkMine){
    const my = ++seq;
    setState('트리를 불러오는 중…');
    const n = net();
    const w = await n.where();
    if (my !== seq || !ov.classList.contains('on')) return;
    if (!w.ok){
      if (w.code === 'auth'){ setState('로그인한 뒤 트리를 볼 수 있어요.'); return; }   // 실패가 아니라 «아직 못 봄»
      setState('트리를 불러오지 못했어요.'); notifyError('E-XMAS-01', w.err); return;
    }
    mine = w.mine; treeNo = mine ? mine.t : w.cur;
    const tr = await n.tree(treeNo);
    if (my !== seq || !ov.classList.contains('on')) return;
    if (!tr.ok){ setState('트리를 불러오지 못했어요.'); notifyError('E-XMAS-01', tr.err); return; }
    // 지금 판의 사본이 있는 자리는 받지 않는다 — 판이 «다른» 자리만(rules.changedImgSlots)
    const cache = {}, have = {};
    const imgSlots = Object.keys(tr.o).filter(s => tr.o[s] && tr.o[s].k === 'img');
    await Promise.all(imgSlots.map(s => Promise.resolve(idbGet(imgKey(treeNo, s, tr.o[s].v))).then(d => { if (d){ cache[s] = d; have[s] = tr.o[s].v; } }, () => {})));
    const need = rules.changedImgSlots(tr.o, have);
    for (let i = 0; i < need.length; i += FETCH_PAR){
      const got = await Promise.all(need.slice(i, i + FETCH_PAR).map(s => n.img(treeNo, s).then(r => [s, r])));
      for (const [s, r] of got){
        if (!r.ok || !r.d) continue;
        cache[s] = r.d;
        if (Number.isInteger(r.v)) idbPut(imgKey(treeNo, s, r.v), r.d);   // 받은 판 그대로의 키로(그새 바뀌었으면 다음에 그 판으로 다시 받는다)
      }
    }
    const list = [];
    for (const s of Object.keys(tr.o)){
      const e = tr.o[s]; if (!e) continue;
      const slot = Number(s);
      const isMine = !!(mine && mine.s === slot);
      const img = e.k === 'img' && cache[s] ? await loadImage(cache[s]) : null;
      list.push({ slot, k: e.k, img, word: typeof e.w === 'string' ? e.w : '', mine: isMine, blink: isMine && !!blinkMine });
    }
    if (my !== seq || !ov.classList.contains('on')) return;
    ornList = list;
    tree.setOrnaments(list);
    setCount(rules.countOf(tr.o));
    setState(list.length ? '' : '아직 장식이 없어요. 첫 장식을 달아 보세요!');
    $('xmasHang').textContent = mine ? '내 장식 바꾸기' : '내 장식 달기';
  }

  /* ── 장식 달기 · 바꾸기 ── */
  async function hang(){
    if (busy) return;
    const left = rules.cooldownLeft(lastHangAt, Date.now());
    if (left > 0){ toast(Math.ceil(left / 1000) + '초 뒤에 다시 바꿀 수 있어요.'); return; }
    if (!rules.eventOn(serverNow())){ toast('크리스마스 이벤트가 끝났어요.'); return; }
    const word = rules.cleanWord($('xmasWord').value).slice(0, rules.WORD_MAX);
    const data = { kind: chosen.kind, word, preview: treeNo || null };
    if (chosen.kind === 'img') data.img = chosen.img;
    busy = true; $('xmasHang').disabled = true;
    const r = await net().hang(data);
    busy = false; $('xmasHang').disabled = false;
    if (!r.ok){
      if (r.code === 'aborted') toast('장식을 거는 중이에요. 잠시 뒤 다시 눌러 주세요.');
      else if (r.code === 'failed-precondition') toast('크리스마스 이벤트가 끝났어요.');
      else if (r.code === 'invalid-argument') toast(r.msg || '장식을 걸 수 없어요.');
      else if (r.code === 'unauthenticated' || r.code === 'permission-denied') toast('로그인한 뒤 장식을 걸 수 있어요.');
      else notifyError('E-XMAS-02', r.err);
      return;
    }
    lastHangAt = Date.now();
    if (r.moved){ $('xmasFull').hidden = false; $('xmasFullOk').focus(); }
    await load(true);
  }
  $('xmasHang').onclick = hang;
  $('xmasFullOk').onclick = () => { $('xmasFull').hidden = true; };

  /* ── 창 ── */
  function open(){
    if (!rules.buttonOn(serverNow())){ toast('크리스마스 이벤트가 끝났어요.'); return; }
    if (ov.classList.contains('on')) return;
    ov.classList.add('on');
    deps.onSizeChange();
    tree.open($('xmasCanvas'));
    load(false);
    letter.refresh();
  }
  function close(){
    if (!ov.classList.contains('on')) return;
    seq++;
    letter.close();
    tree.close();
    ['xmasFull', 'xmasRep'].forEach(id => { $(id).hidden = true; });
    say.hidden = true;
    ov.classList.remove('on');
    deps.onSizeChange();
  }
  btn.onclick = open;
  // 📩 알림함 «익명의 편지가 왔어요 · 편지가 반송됐어요» 가 부른다 — 편지 창까지 연다
  twNav.on(twNav.NAV.XMAS, (what) => { open(); if (what === 'letter' && ov.classList.contains('on')) letter.open(); });
  $('xmasCloseBtn').onclick = close;

  /* 창 끌기 — 제목줄(닫기 단추 위는 빼고) */
  (function(){
    const w = $('xmasWin'), bar = $('xmasTitle');
    let d = null;
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = w.getBoundingClientRect();
      d = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      w.style.transform = 'none'; w.style.left = r.left + 'px'; w.style.top = r.top + 'px';
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', (e) => {
      if (!d) return;
      const maxX = win.innerWidth - 80, maxY = win.innerHeight - 30;
      w.style.left = Math.min(maxX, Math.max(-w.offsetWidth + 80, e.clientX - d.dx)) + 'px';
      w.style.top = Math.min(maxY, Math.max(0, e.clientY - d.dy)) + 'px';
    });
    const up = () => { d = null; };
    bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
  })();

  /* 서버 시각은 붙은 뒤에 — 그 전엔 버튼을 숨겨 둔다(열람 끝이 지났는지 모르므로) */
  btn.hidden = true;
  deps.onReady(() => { refreshButton(); win.setInterval(refreshButton, 60000); });   // 열람 끝을 지나면 켜 둔 채로도 숨는다

  return { open, close, refreshButton, letter };
}

const api = Object.freeze({ createXmasWindow });
if (typeof window !== 'undefined') window.TwXmasWindow = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

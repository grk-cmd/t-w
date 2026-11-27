/* xmas-window.js — 🎄 크리스마스 창(일회성 — 다음 업데이트에서 걷는다 · 이슈 #963) (검사 sim-xmas-window.js)
   책임: 런처 [크리스마스] 버튼(받은 편지 열람 끝 — 1월 6일 0시 · 서버 시각 — 부터 숨김 · 서버 시계가 맞춰지는 순간(onClock) · 날짜 한 벌이 바뀔 때(net().onSchedule) ·
     다음 바뀔 때(rules.nextChange)에 타이머 하나로 다시 본다 — 1분마다 돌지 않는다) · 창 열고 닫기 · 내 트리 불러오기(그림은 판이 달라진 자리만) ·
     장식 고르기 · 내 그림 올리기(64px PNG) · 한마디 · 장식 달기 · 바꾸기(5초 간격) · «트리가 다 찼어요» · 장식 신고 · 한마디 라벨.
   3D 는 xmas-tree.js, 편지 창은 xmas-letter.js(뮤직바 xmas-song.js), 서버는 net(xmas-api.js), 규칙은 rules(TwXmasRules) · 날짜는 서버가 준 한 벌(net().scheduleNow() — 못 읽었으면 처음 값).
   ★ 그림 사본은 이 PC 의 GLB 영구 캐시(IndexedDB)에 «트리/자리@판» 키로 — 다시 열 때 판이 같은 그림은 받지 않는다. 바이트는 Storage 에서(목록에는 그림 id 만).
   ★ 트리 목록은 서버가 몇 초 캐시한다 — 내 장식은 내 몫(GET /v2/me/xmas 의 mine · 캐시 없음)으로 목록 위에 덮어 그린다(목록이 늦어도 바로 보이게 · 지운 장식은 mine 이 없어 다시 그리지 않음).
     ⚠️ localStorage 에 두지 말 것 — 트리 하나가 수 MB 라 앱 전체가 같이 쓰는 한도를 먹어 캐릭터 저장 등이 실패한다.
   ★ 남이 쓴 한마디는 textContent 로만 넣는다.
   classic script(window.TwXmasWindow) — app.js 보다 먼저 싣는다. app.js 가 `createXmasWindow(deps)` 한 번 — 밖에서 부르는 이름은 onMail(우편이 바뀌면 app.js 가 우편 목록을 넘긴다)
   (런처 버튼 · 알림함 «익명의 편지가 왔어요» 가 창 열기 통로 NAV.XMAS 로 연다). */
(function(){
'use strict';

const IMG_CACHE_KEY = 'xmasimg:';   // GLB 영구 캐시(IndexedDB) 키 머리 — 'xmasimg:{트리}/{자리}@{판}' (판이 키에 있어 옛 판은 안 쓰이고 45일 뒤 치워진다)
const IMG_DATA_MAX = 15000;     // 서버 상한(16000)보다 조금 아래 — 넘으면 더 작게 줄인다
const FETCH_PAR = 6;
const TIMER_MAX_MS = 2147483647;   // setTimeout 이 받는 가장 긴 기다림(약 24.8일) — 바뀔 때가 더 멀면 여기까지 기다렸다 다시 잰다

/**
 * @param {{ doc?:Document, win?:Window, THREE:any, ps1Dither:any, rules:any, treeMod:any, net:()=>any, serverNow:()=>number|null,
 *           onClock:(fn:()=>void)=>(()=>void), notifyError:(code:string, err?:any)=>void, toast:(msg:string)=>void, escRegisterWindow:Function,
 *           onSizeChange:()=>void, idbGet:(k:string)=>Promise<string|null>, idbPut:(k:string, v:string)=>any,
 *           songMod:any, letterMod:any, companion:()=>any, ytVideoId:(url:string)=>string|null, asyncPrompt:Function,
 *           storage:()=>Storage|null, twNav:{ NAV:any, on:Function }, random:()=>number,
 *           bgmMod:any, winBgmMod:any, creditMod:any, Audio:(Function|null), save:(k:string, v:string)=>any, officeMode:()=>boolean, warn:Function,
 *           bgmHush:{ hush:()=>any, unhush:(h:any)=>void }, panelFit:{ fitTopLeft:Function },
 *           osDrag:{ begin:()=>boolean, move:()=>void, end:()=>void } }} deps
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
  const panelFit = deps.panelFit;   // 📐 끈 창을 화면 안으로(shared/panel-fit.js fitTopLeft)
  const osDrag = deps.osDrag;       // 🪟 런처에서 열었으면 앱 창째 끌기(shared/os-drag.js)
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js) — 맨 앞에 붙여 쓴다(sim-nav 가 «deps 로 받는 모듈» 을 이 줄로 센다)
  const $ = (id) => doc.getElementById(id);

  const ov = $('xmasOverlay'), btn = $('lcXmas');
  if (!ov || !btn) throw new Error('xmas-window: #xmasOverlay · #lcXmas 가 html 에 없다');
  const tree = deps.treeMod.createXmasTree({ THREE: deps.THREE, rules, ps1Dither: deps.ps1Dither, doc, win });

  /* Esc 는 트리 창을 편지 창보다 먼저 등록한다 — 알림함 길은 두 창을 같은 틱에 열어서, 창 쌓기가 등록 순서로 쌓는다(편지 창이 위 → Esc 에 편지 창만 닫힘) */
  deps.escRegisterWindow({ key: 'xmas', el: ov, isOpen: () => ov.classList.contains('on'), close });
  /** 날짜 한 벌 — 서버 값을 읽었으면 그것, 아니면 처음 값 */
  const sch = () => net().scheduleNow();
  const song = deps.songMod.createXmasSong({ doc, win, companion: deps.companion, ytVideoId: deps.ytVideoId, asyncPrompt: deps.asyncPrompt, toast, songTitleMax: rules.SONG_TITLE_MAX });
  /* 🎵 배경음악 · 음악 출처 — 제목줄 [음악 끄기] [음악 출처]. 추천곡이 나는 동안 배경음악은 물러난다 */
  const B = deps.bgmMod;
  const bgm = deps.winBgmMod.createWinBgm({ Audio: deps.Audio, tracks: B.TRACKS, dirs: B.DIRS, volume: B.VOLUME, muteKey: B.MUTE_KEY, tag: B.TAG,
    storage: deps.storage, save: deps.save, officeMode: deps.officeMode, warn: deps.warn, others: deps.bgmHush });
  const credit = deps.creditMod.createXmasCredit({ doc, box: $('xmasCredit'), lines: B.CREDIT });
  const bgmBtn = $('xmasBgmBtn');
  const paintBgmBtn = () => { bgmBtn.textContent = bgm.label(); bgmBtn.classList.toggle('off', bgm.isMuted()); };
  bgmBtn.onclick = () => { bgm.toggle(); paintBgmBtn(); };
  $('xmasCreditBtn').onclick = () => credit.toggle();
  /* 추천곡이 나는 동안 물러난다. 다른 음악(플레이리스트 · 마이홈)이 재생 창을 가져가서 추천곡이 멈춘 것이면 돌아오지 않는다 —
     사용자가 방금 튼 음악을 배경음악이 다시 재우지 않게(다음에 창을 열면 다시 난다) */
  song.onPlay((on, taken) => { if (!on && taken) return; bgm.duck(on); });
  paintBgmBtn();
  const letter = deps.letterMod.createXmasLetter({ doc, win, rules, net, song, serverNow, schedule: () => sch(), toast, notifyError, escRegisterWindow: deps.escRegisterWindow,
    storage: deps.storage, onDot: (on) => btn.classList.toggle('xm-dot', on) });

  let treeNo = 0, mine = null, ornList = [], chosen = { kind: 'star', img: null }, lastHangAt = NaN, busy = false, seq = 0;

  /* ── 런처 버튼 — 받은 편지를 볼 수 있는 동안(장식은 이벤트 끝에 막혀도 편지는 1/5 까지) ──
     세션 동안(start ~ reset) 서버 시계 알림 · 날짜 한 벌 알림 · 다음 바뀔 때 타이머 하나가 refreshButton 을 부른다 */
  let edgeTimer = null, unsubs = null;   // 다음 바뀔 때 타이머 · 세션 동안 건 알림 풀기(null = 세션 밖)
  function paintButton(){
    btn.hidden = !rules.buttonOn(serverNow(), sch());
    if (btn.hidden){ if (ov.classList.contains('on')) close(); return; }
    letter.paintBtn();   // 날짜가 넘어가면 [편지 쓰기] → [편지 열람]
  }
  /* 다음 바뀔 때(마감 · 열람 끝)에 한 번 — 걸 때마다 앞 것을 푼다. 서버 시각을 모르면 걸지 않는다(시계 알림이 다시 부른다) */
  function armEdge(){
    if (edgeTimer){ win.clearTimeout(edgeTimer); edgeTimer = null; }
    if (!unsubs) return;
    const now = serverNow();
    const at = rules.nextChange(now, sch());
    if (at === null) return;
    edgeTimer = win.setTimeout(() => { edgeTimer = null; refreshButton(); }, Math.min(at - now, TIMER_MAX_MS));
  }
  function refreshButton(){
    paintButton();
    armEdge();
  }
  /** 세션 시작(startXmas) — 서버 시계 · 날짜 한 벌 알림을 걸고 지금 한 번 본다(이미 맞춰진 시계도 놓치지 않게) */
  function start(){
    if (unsubs) throw new Error('xmas-window: start 를 reset 없이 두 번 불렀다');
    unsubs = [deps.onClock(refreshButton), net().onSchedule(refreshButton)];
    refreshButton();
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
    if (!rules.eventOn(serverNow(), sch())){ toast(REPORT_ENDED); return; }
    repSlot = slot; $('xmasRep').hidden = false; $('xmasRepNo').focus();
  });
  $('xmasRepNo').onclick = () => { $('xmasRep').hidden = true; repSlot = null; };
  $('xmasRepYes').onclick = async () => {
    $('xmasRep').hidden = true;
    const s = repSlot; repSlot = null;
    if (s == null) return;
    if (!rules.eventOn(serverNow(), sch())){ toast(REPORT_ENDED); return; }   // 확인창을 연 채 끝을 넘긴 때
    const my = seq;
    const r = await net().reportOrnament(treeNo, s);
    if (my !== seq) return;   // 그 사이 창이 닫혔거나 세션이 끝났다
    if (r.ok) toast('신고했어요. 관리자가 확인할게요.');
    else if (r.code === 'dup') toast('이미 신고한 장식이에요.');
    else if (r.code === 'auth') toast('로그인한 뒤 신고할 수 있어요.');
    else if (r.code === 'invalid-argument' || r.code === 'failed-precondition') toast(r.msg || '신고할 수 없어요.');
    else if (r.code === 'gone') toast('이미 없는 장식이에요.');   // 그 사이 지워졌다(XMAS_ORNAMENT_NOT_FOUND)
    else notifyError('E-XMAS-03', r.err);
  };

  /* ── 장식 고르기 ── */
  const pick = $('xmasPick');
  function choose(b, kind, img){
    chosen = { kind, img };
    pick.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  }
  function addPick(kind, src, label, img){
    const b = doc.createElement('button'); b.type = 'button'; b.className = 'xm-orn win98raised'; b.title = label; b.setAttribute('aria-label', label);
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
        const b = addPick('img', d, '내 그림', d);   // [＋] 바로 앞에 붙는다
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
    overlayMine(tr.o);
    // 지금 판의 사본이 있는 자리는 받지 않는다 — 판이 «다른» 자리만(rules.changedImgSlots)
    const cache = {}, have = {};
    const imgSlots = Object.keys(tr.o).filter(s => tr.o[s] && tr.o[s].k === 'img');
    await Promise.all(imgSlots.map(s => Promise.resolve(idbGet(imgKey(treeNo, s, tr.o[s].v))).then(d => { if (d){ cache[s] = d; have[s] = tr.o[s].v; } }, () => {})));
    const need = rules.changedImgSlots(tr.o, have).filter(s => tr.o[s].id);
    for (let i = 0; i < need.length; i += FETCH_PAR){
      const got = await Promise.all(need.slice(i, i + FETCH_PAR).map(s => n.img(tr.o[s].id).then(r => [s, r])));
      for (const [s, r] of got){
        if (!r.ok || !r.d) continue;
        cache[s] = r.d;
        idbPut(imgKey(treeNo, s, tr.o[s].v), r.d);   // 그림 id 는 판마다 새것이라 목록의 판 그대로의 키로
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

  /** 목록(서버 캐시 — 몇 초 늦을 수 있음)에 내 장식이 없거나 옛 판이면 내 몫(GET /v2/me/xmas 의 mine — 캐시 없음)으로 덮는다.
      mine 이 없으면(관리자가 지움 · 아직 안 걺) 덮지 않는다 — 지운 장식을 다시 그리지 않게 */
  function overlayMine(o){
    if (!mine || mine.t !== treeNo || !mine.k) return;
    const cur = o[mine.s];
    if (cur && cur.v >= mine.v) return;
    const one = { k: mine.k, v: mine.v };
    if (mine.w) one.w = mine.w;
    if (mine.id) one.id = mine.id;
    o[mine.s] = one;
  }

  /* ── 장식 달기 · 바꾸기 ── */
  async function hang(){
    if (busy) return;
    const left = rules.cooldownLeft(lastHangAt, Date.now());
    if (left > 0){ toast(Math.ceil(left / 1000) + '초 뒤에 다시 바꿀 수 있어요.'); return; }
    if (!rules.eventOn(serverNow(), sch())){ toast('크리스마스 이벤트가 끝났어요.'); return; }
    const word = rules.cleanWord($('xmasWord').value).slice(0, rules.WORD_MAX);
    const data = { kind: chosen.kind, word, preview: treeNo || null };
    if (chosen.kind === 'img') data.img = chosen.img;
    busy = true; $('xmasHang').disabled = true;
    const my = seq;
    const r = await net().hang(data);
    busy = false; $('xmasHang').disabled = false;
    if (my !== seq) return;   // 그 사이 창이 닫혔거나 세션이 끝났다 — 다시 읽지 않는다(새 계정으로 요청을 더 보내지 않게)
    if (!r.ok){
      if (r.code === 'aborted') toast('서버가 바빠요. 잠시 뒤 다시 눌러 주세요.');
      else if (r.code === 'conflict'){ toast('다른 PC 에서 먼저 바꿨어요. 트리를 다시 불러올게요.'); await load(false); }
      else if (r.code === 'failed-precondition') toast('크리스마스 이벤트가 끝났어요.');
      else if (r.code === 'invalid-argument') toast(r.msg || '장식을 걸 수 없어요.');
      else if (r.code === 'auth') toast('로그인한 뒤 장식을 걸 수 있어요.');
      else notifyError('E-XMAS-02', r.err);
      return;
    }
    lastHangAt = Date.now();
    if (data.kind === 'img' && data.img) idbPut(imgKey(r.tree, r.slot, r.version), data.img);   // 내가 올린 그림 — 다시 받지 않는다
    if (r.moved){ $('xmasFull').hidden = false; $('xmasFullOk').focus(); }
    await load(true);
  }
  $('xmasHang').onclick = hang;
  $('xmasFullOk').onclick = () => { $('xmasFull').hidden = true; };

  /* ── 창 ── */
  function open(){
    if (!rules.buttonOn(serverNow(), sch())){ toast('크리스마스 이벤트가 끝났어요.'); return; }
    if (ov.classList.contains('on')) return;
    ov.classList.add('on');
    deps.onSizeChange();
    fitWin();   // 끌어 둔 자리가 지금 창 크기에서 화면 밖이면 안으로
    tree.open($('xmasCanvas'));
    load(false);
    letter.refresh();
    bgm.start(); paintBgmBtn();
  }
  function close(){
    if (!ov.classList.contains('on')) return;
    seq++;
    bgm.stop(); credit.stop();   // 편지 창보다 먼저 — 추천곡이 멈추며 오는 알림(duck)에 배경음악이 다시 켜지지 않게
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

  /* 창이 화면 안에 다 들게 — 끌 때 · 앱 창 크기가 바뀔 때 · 열 때. 처음 자리(가운데 · transform)는 늘 화면 안이라 그대로 둔다 */
  const xmWin = $('xmasWin');
  /* want — 사용자가 끌어 놓은 자리. 화면에 맞춘 결과(style)와 따로 기억한다 — 앱 창이 잠깐 작아졌다 커져도(런처에서 열면 창 크기 요청이 늦게 닿는다) 끈 자리로 돌아오게 */
  let want = null;
  function placeWin(x, y){
    const p = panelFit.fitTopLeft(x, y, xmWin.offsetWidth, xmWin.offsetHeight, win.innerWidth, win.innerHeight, 0);
    xmWin.style.left = p.x + 'px'; xmWin.style.top = p.y + 'px';
    return p;
  }
  function fitWin(){ if (want) placeWin(want.x, want.y); }
  win.addEventListener('resize', () => { if (ov.classList.contains('on')) fitWin(); });
  /* 창 끌기 — 제목줄(닫기 단추 위는 빼고). 런처에서 열었으면 앱 창째(osDrag — 마이홈 창과 같은 규칙), 실행 화면이면 화면 안에서 */
  (function(){
    const w = xmWin, bar = $('xmasTitle');
    let d = null;
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      bar.setPointerCapture(e.pointerId);
      if (osDrag.begin()){ d = { os: true }; return; }
      const r = w.getBoundingClientRect();
      d = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      w.style.transform = 'none'; want = placeWin(r.left, r.top);   // 움직이지 않고 떼도 가운데 맞춤에서 빠지므로 자리를 기억해 둔다
    });
    bar.addEventListener('pointermove', (e) => {
      if (!d) return;
      if (d.os){ osDrag.move(); return; }
      want = placeWin(e.clientX - d.dx, e.clientY - d.dy);   // 아래 · 옆으로 화면 밖에 걸치면 창이 잘린다 — 창 전체가 화면 안에(보이는 자리를 기억)
    });
    const up = () => { if (d && d.os) osDrag.end(); d = null; };
    bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
    bar.addEventListener('lostpointercapture', up);   // 끄는 중에 창이 닫혀 pointerup 이 안 와도 main 의 끌기가 남지 않게
  })();

  /* ── 📩 받은 편지 알림 — 알림함에 XMAS_LETTER 가 새로 보이면(읽음 여부와 상관없이 · 켤 때 처음 받은 목록 포함) 0~30초 무작위로 기다렸다 받은 편지를 한 번 읽는다(폴링 없음).
     0시에 앱 수천 대가 같은 순간 읽지 않게 흩는다(설계 5-3). 기다리는 동안 또 보이면 그 한 번으로 묶는다 ── */
  const seenMail = new Set();
  let gotTimer = null, waiting = [];   // waiting — 이번 기다림에 묶인 알림 id(못 읽으면 seenMail 에서 빼 다음에 다시)
  function onMail(items){
    const ids = rules.letterMailIds(items, seenMail);
    if (!ids.length) return;
    ids.forEach(id => { seenMail.add(id); waiting.push(id); });
    if (gotTimer) return;
    gotTimer = win.setTimeout(async () => {
      gotTimer = null;
      const batch = waiting; waiting = [];
      const ok = await letter.checkGot();
      if (!ok) batch.forEach(id => seenMail.delete(id));   // 못 읽었으면 다음 우편 변화에 다시
    }, rules.jitterMs(deps.random()));
  }

  /** 세션이 끝나면(로그아웃 · 계정 바뀜 — app.js 가 session.onReset 에 건다) — 창을 닫고 앞 계정의 트리 · 내 장식 · 본 알림 · 기다림 · 빨간 점을 버린다 */
  function reset(){
    close();
    if (unsubs){ unsubs.forEach(off => off()); unsubs = null; }
    if (edgeTimer){ win.clearTimeout(edgeTimer); edgeTimer = null; }
    btn.hidden = true;   // 다음 세션의 서버 시각을 받기 전까지
    if (gotTimer){ win.clearTimeout(gotTimer); gotTimer = null; }
    waiting = []; seenMail.clear();
    mine = null; treeNo = 0; ornList = []; lastHangAt = NaN; repSlot = null;
    letter.reset();
  }

  /* 서버 시각은 붙은 뒤에 — 그 전엔 버튼을 숨겨 둔다(열람 끝이 지났는지 모르므로). 세션이 시작되면(start) 시계 알림이 그 자리에서 다시 본다 */
  btn.hidden = true;

  return { open, close, refreshButton, start, onMail, reset, letter, syncBgm: () => bgm.refresh() };
}

/**
 * 계정 세션마다 한 번(app-boot 차례 xmas · READY) — 창이 서버 시계 · 날짜 알림을 건다(start) · 세션이 끝나면 provider · 창을 비운다(onReset — 알림 · 타이머도 푼다).
 * 창이 없으면(기능 꺼짐) 아무것도 안 한다.
 * @param {{ api:{ reset:()=>void }, win:{ start:()=>void, reset:()=>void }|null }} d
 * @param {{ onReset:(fn:()=>void)=>void }} session
 */
function startXmas(d, session){
  if (!d.win) return;
  d.win.start();
  session.onReset(() => { d.api.reset(); d.win.reset(); });
}
/**
 * 첫 화면 뒤 한 번(app-boot 차례 xmasDates · LATER) — 마감 앞뒤 하루면 날짜 한 벌(trees/current)을 한 번 읽는다(0시 알림함 흩기가 서버 날짜를 쓰게).
 * 서버 시각을 아직 모르면 이 PC 시계로 «앞뒤 하루» 만 가른다(넓은 창이라 충분). 그 밖 · 창이 없으면 요청 0.
 * @param {{ api:{ refreshSchedule:()=>Promise<any> }, win:object|null, rules:{ nearDeadline:(now:number)=>boolean }, serverNow:()=>number, now:()=>number }} d
 */
function loadXmasDates(d){
  if (!d.win) return undefined;
  const sn = d.serverNow();
  return d.rules.nearDeadline(Number.isFinite(sn) ? sn : d.now()) ? d.api.refreshSchedule() : undefined;
}

const api = Object.freeze({ createXmasWindow, startXmas, loadXmasDates });
if (typeof window !== 'undefined') window.TwXmasWindow = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

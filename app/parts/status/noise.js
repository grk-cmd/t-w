/* 🌙 parts/noise.js — 백색소음 (2026-09-23 · handoff-2026-09-23-noise §4 · 시안 확정 «플레이리스트 창 안에 두는 안»)

   [무엇을 하나]
     캐릭터가 **타이핑 자세일 때만**(seatState === 'focus') 고른 소리(✏️ 연필 · ⌨️ 키보드 · 📖 책장)를 튼다.
     같은 방 사람들이 고른 소리도 그 사람이 타이핑 자세일 때 같이 들린다 — 독서실처럼.

   [소리 재생 규칙 — «합치기» 확정 · 데모에서 귀로 고름]
     · 같은 소리를 고른 사람이 여럿이면 **한 벌만** 틀고 볼륨만 올린다(사람마다 한 벌씩 겹치면 4명부터 뭉개진다).
       1명 50% · 2명 70% · 3명 이상 90% · **내 소리는 항상 100%**(그 종류의 벌을 100% 로 올린다).
     · 남의 소리는 종류 기준 **최대 3겹**(사람 수가 많은 순). 넷째 종류부터는 안 튼다.
     · 이 비율 위에 백색소음 전용 슬라이더(#myNzVol · 음악과 따로 저장)가 한 번 더 곱해진다.

   [언제]
     · 켜짐 = 좌석 상태 'focus'. 새로 감지하는 것이 없다 — main.js uiohook → onGlobalKey → activity() 가
       이미 lastActivity 를 밀고 있고, seatState 가 FOCUS_MS(1.5초) · 펜 앱이면 PEN_FOCUS_MS(4초)로 가른다.
     · 들어올 때 0.1초 페이드인 · 멈춤 자세(idle)가 되면 0.5초 페이드아웃 · 잠·자리비움·춤·쓰다듬기 등도 무음.
     · 🏢 회사원 모드 = **무조건 무음**(내 것도 남의 것도). 보는 사람 기준이다(_mkSndPool 과 같은 원칙).
     · 🙈 숨긴 사람(_seatHidden)의 소리는 안 듣는다 — 안 보겠다고 고른 사람이다.
     · 워킹룸 · 투게더룸 · 혼자 전부 같은 규칙. 혼자면 남의 좌석이 없으니 내 소리만.

   [전파] 방 payload 에 문자열 한 칸(noise) — Presence.setNoise. 상태는 이미 흐른다. 규칙 변경 없음.

   [기댄 것 — 전부 app.js 의 전역(클래식 스크립트 최상위 let/const/function)]
     seats · seatState · findMySeat · _seatHidden · officeMode · Presence · _plSyncBgmBounds · _plApplyPos
     ⚠️ 이 파일은 app.js **뒤에** 실려야 한다(html 의 <script> 순서). 없으면 조용히 아무것도 안 한다.

   [소리 자료] parts/noise-sounds.js(window.TW_NOISE_SOUNDS · base64 WebM/Opus). 왜 base64 인지는 그 파일 머리 주석.

   [남은 판단 — 실기기에서 귀로]
     ① 📖 책장: 4.9초짜리라 루프가 티가 난다 → 지금은 «가끔 한 번»(NZ_PAGE_LOOP = false). 루프로 되돌리려면 true.
     ② 비율 50/70/90 · 3겹 상한(NZ_RATIO · NZ_MAX_LAYERS) ③ 음악과의 균형(NZ_VOL_DEFAULT). */
(function(){
  'use strict';

  /* ── 상수 ───────────────────────────────────────────────────────────── */
  const NZ_KINDS = ['pencil', 'keyboard', 'page'];
  const NZ_LABEL = { pencil:'✏️ 연필', keyboard:'⌨️ 키보드', page:'📖 책장' };
  const NZ_KIND_KEY   = 'tw.noise.kind';     // '' | 'pencil' | 'keyboard' | 'page'
  const NZ_VOL_KEY    = 'tw.noise.vol';      // 0~100 — 음악 음량과 **따로**
  const NZ_OTHERS_KEY = 'tw.noise.others';   // '1' 켜짐(기본) · '0' 내 소리만
  const NZ_FOLD_KEY   = 'tw.noise.fold';     // '1' 접힘 · 없음 = 펼침
  const NZ_VOL_DEFAULT = 60;
  const NZ_MINE = 1.0;                                          // 내 소리는 항상 100%
  const NZ_RATIO = (n)=> n >= 3 ? 0.9 : (n === 2 ? 0.7 : 0.5);  // 1명 50 · 2명 70 · 3명+ 90
  const NZ_MAX_LAYERS = 3;                                      // 남의 소리 — 종류 기준 최대 3겹
  const NZ_FADE_IN_TC  = 0.035;   // setTargetAtTime 시정수 — 0.1초면 95% (≈3τ)
  const NZ_FADE_OUT_TC = 0.5 / 3; // 0.5초 페이드아웃
  const NZ_LOOP_TRIM = 0.15;      // 루프 이음새 — 앞뒤 0.15초는 빼고 돈다(mp3/opus 앞뒤 무음의 «틱» · 데모에서 검증)
  const NZ_PAGE_LOOP = false;     // 📖 책장: false = «가끔 한 번» · true = 루프(미결 — 실기기에서 고를 것)
  const NZ_PAGE_FIRST_MS = [700, 2200];    // 켜진 뒤 첫 장까지
  const NZ_PAGE_GAP_MS   = [4500, 11000];  // 그다음 장 사이 — 일정하면 기계처럼 들린다
  const NZ_TICK_MS = 100;         // 페이드인 0.1초를 지키려면 판정도 그만큼 촘촘해야 한다
  const NZ_SUSPEND_MS = 15000;    // 이만큼 아무것도 안 들리면 오디오 장치를 쉬게 한다(CPU)

  const _ls = {
    get(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } },
    set(k, v){ try{ localStorage.setItem(k, v); }catch(_){} },
  };
  function _kindOk(k){ return (typeof k === 'string' && NZ_KINDS.indexOf(k) >= 0) ? k : ''; }

  /* ── 설정(내 기기) ──────────────────────────────────────────────────── */
  let nzKind   = _kindOk(_ls.get(NZ_KIND_KEY) || '');
  let nzVol    = (()=>{ const v = parseInt(_ls.get(NZ_VOL_KEY), 10); return (v >= 0 && v <= 100) ? v : NZ_VOL_DEFAULT; })();
  let nzOthers = _ls.get(NZ_OTHERS_KEY) !== '0';
  let nzFold   = _ls.get(NZ_FOLD_KEY) === '1';

  /* ── 합성 규칙(순수 함수 · 검사 sim-noise.js 가 그대로 돌린다) ─────────────
     입력: { office, mine:{kind, focus}, others:[{kind, focus}], withOthers }
     출력: { 종류: 비율(0~1) } — 없는 종류는 무음. */
  function mix(inp){
    const out = {};
    if(!inp || inp.office) return out;                                       // 🏢 무조건 무음
    if(inp.withOthers){
      const cnt = {};
      (inp.others || []).forEach(o=>{ const k = _kindOk(o && o.kind); if(k && o.focus) cnt[k] = (cnt[k] || 0) + 1; });
      Object.keys(cnt)
        .sort((a, b)=> (cnt[b] - cnt[a]) || (NZ_KINDS.indexOf(a) - NZ_KINDS.indexOf(b)))   // 사람 많은 순 · 같으면 고정 순서(깜빡임 방지)
        .slice(0, NZ_MAX_LAYERS)
        .forEach(k=>{ out[k] = NZ_RATIO(cnt[k]); });
    }
    const mk = _kindOk(inp.mine && inp.mine.kind);
    if(mk && inp.mine.focus) out[mk] = NZ_MINE;                              // 합치기 — 같은 벌을 100% 로
    return out;
  }

  /* ── 지금 방 상태 읽기 ──────────────────────────────────────────────── */
  function _office(){ try{ return !!officeMode; }catch(_){ return false; } }   // let TDZ 대비(_chatSfxOfficeLock 과 같은 이유)
  function gather(now){
    const inp = { office:_office(), mine:{ kind:nzKind, focus:false }, others:[], withOthers:nzOthers };
    let list = null;
    try{ list = seats; }catch(_){ return inp; }
    if(!Array.isArray(list) || typeof seatState !== 'function') return inp;
    let mine = null;
    try{ mine = (typeof findMySeat === 'function') ? findMySeat() : null; }catch(_){}
    try{ if(mine && nzKind) inp.mine.focus = (seatState(mine, now) === 'focus'); }catch(_){}
    if(nzOthers){
      list.forEach(s=>{
        if(!s || !s.remote || !s.remoteNoise) return;
        try{ if(typeof _seatHidden === 'function' && _seatHidden(s)) return; }catch(_){}
        let f = false;
        try{ f = (seatState(s, now) === 'focus'); }catch(_){}
        inp.others.push({ kind:s.remoteNoise, focus:f });
      });
    }
    return inp;
  }

  /* ── 오디오 ─────────────────────────────────────────────────────────────
     종류마다 한 벌(GainNode 하나) → master(슬라이더) → 압축기(겹칠 때 1을 넘어 깨지는 것만 막는다) → 스피커.
     ★ AudioContext 는 **첫 사용자 제스처**에서 만든다. 제스처 없이 만들면 suspended 로 태어나고,
       남의 소리만 들어야 하는 사람은 계속 조용하다(_mkSndPool.prime 이 겪은 «남이 때리면 조용함» 과 같은 함정).
       uiohook 의 전역 키 입력은 DOM 제스처가 아니므로 앱 창을 한 번은 눌러야 한다 — 소리 칸을 고르는 것도 제스처다. */
  let ctx = null, master = null, decoding = null;
  const buf = {}, layer = {};   // layer[kind] = { gain, src|null, cur, nextShot }
  let lastHeardAt = 0, suspended = false, _lastResumeAt = 0;

  function _b64ToBuf(dataUrl){
    const b = atob(String(dataUrl).split(',')[1] || '');
    const u = new Uint8Array(b.length);
    for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u.buffer;
  }
  function _ensureCtx(){
    if(ctx) return ctx;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = nzVol / 100;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -6; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
      master.connect(comp); comp.connect(ctx.destination);
    }catch(e){ ctx = null; try{ console.warn('[noise] 오디오를 못 만들었어요 — ' + ((e && e.name) || e)); }catch(_){} }
    return ctx;
  }
  function _decodeAll(){
    if(decoding) return decoding;
    const SRC = window.TW_NOISE_SOUNDS || {};
    decoding = Promise.all(NZ_KINDS.map(k=>{
      if(!SRC[k]) return null;
      return ctx.decodeAudioData(_b64ToBuf(SRC[k])).then(b=>{ buf[k] = b; }, e=>{ try{ console.warn('[noise] 풀기 실패 ' + k + ' — ' + ((e && e.name) || e)); }catch(_){} });
    }));
    return decoding;
  }
  function _layer(k){
    if(layer[k]) return layer[k];
    if(!ctx || !buf[k]) return null;
    const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
    const L = { gain:g, src:null, cur:0, nextShot:0 };
    if(k !== 'page' || NZ_PAGE_LOOP){
      const s = ctx.createBufferSource(); s.buffer = buf[k]; s.loop = true;
      const d = buf[k].duration;
      s.loopStart = Math.min(NZ_LOOP_TRIM, d / 10);
      s.loopEnd   = Math.max(s.loopStart + 0.5, d - NZ_LOOP_TRIM);
      s.connect(g); s.start(0, s.loopStart);
      L.src = s;
    }
    layer[k] = L;
    return L;
  }
  const _rnd = (a)=> a[0] + Math.random() * (a[1] - a[0]);
  /* 📖 «가끔 한 번» — 벌의 음량이 켜져 있는 동안만 한 장씩 넘긴다. 페이드는 같은 GainNode 가 맡는다. */
  function _pageShots(L, now){
    if(NZ_PAGE_LOOP || !L || !buf.page) return;
    if(L.cur <= 0){ L.nextShot = 0; return; }
    if(!L.nextShot){ L.nextShot = now + _rnd(NZ_PAGE_FIRST_MS); return; }
    if(now < L.nextShot) return;
    L.nextShot = now + _rnd(NZ_PAGE_GAP_MS);
    try{ const s = ctx.createBufferSource(); s.buffer = buf.page; s.playbackRate.value = 0.96 + Math.random() * 0.08; s.connect(L.gain); s.start(); }catch(_){}
  }
  function _setLayer(k, v){
    const L = _layer(k); if(!L) return;
    if(Math.abs(L.cur - v) < 0.005) return;
    const rising = v > L.cur;
    L.cur = v;
    const t = ctx.currentTime;
    try{
      L.gain.gain.cancelScheduledValues(t);
      L.gain.gain.setTargetAtTime(v, t, rising ? NZ_FADE_IN_TC : NZ_FADE_OUT_TC);
    }catch(_){ L.gain.gain.value = v; }
  }

  /* ── 틱 ─────────────────────────────────────────────────────────────── */
  let _lastOffice = null;
  function tick(){
    const now = performance.now();
    const office = _office();
    if(office !== _lastOffice){ _lastOffice = office; renderUI(); }   // 회사원 모드 전환을 따로 배선하지 않아도 줄이 따라간다
    const heard = mix(gather(now));
    const any = Object.keys(heard).length > 0;
    if(any) lastHeardAt = now;
    if(!ctx){ return; }                                   // 아직 제스처 전 — 만들 수 없다
    if(any && !decoding){ _decodeAll(); return; }
    /* 깨우기 — 내가 재운 것(suspended)이든 브라우저가 재운 것(제스처 전)이든. 막혀 있으면 약속이 쌓이므로 1초에 한 번만 두드린다. */
    if(any && ctx.state !== 'running' && now - _lastResumeAt > 1000){
      _lastResumeAt = now; suspended = false;
      try{ const p = ctx.resume(); if(p && p.catch) p.catch(()=>{}); }catch(_){}
    }
    NZ_KINDS.forEach(k=>{ if(buf[k]) _setLayer(k, heard[k] || 0); });
    _pageShots(layer.page, now);
    if(!any && !suspended && ctx.state === 'running' && now - lastHeardAt > NZ_SUSPEND_MS){
      suspended = true; try{ ctx.suspend(); }catch(_){}
    }
  }

  /* 첫 제스처 — 오디오를 만들고(풀리고), 이미 고른 소리가 있으면 바로 풀어 둔다.
     ★ once 가 아니다 — 창이 오래 잠들면 브라우저가 컨텍스트를 다시 재울 수 있어 눌릴 때마다 한 번 깨운다(싸다). */
  function _onGesture(){
    if(!_ensureCtx()) return;
    try{ if(ctx.state === 'suspended' && !suspended) ctx.resume(); }catch(_){}
    if(!decoding && (nzKind || nzOthers)) _decodeAll();
  }
  try{ ['pointerdown', 'keydown'].forEach(ev=>window.addEventListener(ev, _onGesture, { capture:true, passive:true })); }catch(_){}

  /* ── 플레이리스트 창의 줄(#myPlNoise) ───────────────────────────────── */
  const $ = (id)=> document.getElementById(id);
  function _nowText(){
    if(_office()) return '🏢 모드를 끄면 들려요';
    if(!nzFold) return '독서실 소리';
    return nzKind ? (NZ_LABEL[nzKind] + ' · ' + nzVol + '%') : '꺼짐';
  }
  function renderUI(){
    const row = $('myPlNoise'); if(!row) return;
    row.classList.toggle('fold', nzFold);
    row.classList.toggle('office', _office());
    row.querySelectorAll('.nzK').forEach(b=>{
      const on = (b.getAttribute('data-nz') || '') === nzKind;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    const v = $('myNzVol'); if(v && document.activeElement !== v) v.value = String(nzVol);
    if(v) v.title = '백색소음 음량 ' + nzVol + '%';
    const pc = $('myNzPct'); if(pc) pc.textContent = nzVol + '%';
    const ot = $('myNzOthers'); if(ot) ot.checked = nzOthers;
    const nw = $('myNzNow'); if(nw) nw.textContent = _nowText();
    const fb = $('myNzFold');
    if(fb){ fb.setAttribute('aria-expanded', nzFold ? 'false' : 'true'); fb.title = nzFold ? '펼치기' : '접기'; }
  }
  /* 창 높이가 바뀌었다 — 뒤에 숨은 유튜브 재생 창 사각형과 화면 안 clamp 를 다시 맞춘다(_plSyncBgmBounds 주석). */
  function _plResized(){
    try{ if(typeof _plApplyPos === 'function') _plApplyPos(); }catch(_){}
    try{ if(typeof _plSyncBgmBounds === 'function') _plSyncBgmBounds(); }catch(_){}
  }
  function setKind(k){
    nzKind = _kindOk(k);
    _ls.set(NZ_KIND_KEY, nzKind);
    try{ if(typeof Presence !== 'undefined' && Presence.setNoise) Presence.setNoise(nzKind); }catch(_){}
    renderUI();
  }
  function setVol(v){
    nzVol = Math.max(0, Math.min(100, Math.round(+v || 0)));
    _ls.set(NZ_VOL_KEY, String(nzVol));
    if(master && ctx){ try{ master.gain.setTargetAtTime(nzVol / 100, ctx.currentTime, 0.03); }catch(_){ master.gain.value = nzVol / 100; } }
    renderUI();
  }
  function bindUI(){
    const row = $('myPlNoise'); if(!row || row._nzBound) return;
    row._nzBound = true;
    row.querySelectorAll('.nzK').forEach(b=>b.addEventListener('click', ()=>{ _onGesture(); setKind(b.getAttribute('data-nz') || ''); }));
    const v = $('myNzVol');
    if(v){ v.addEventListener('input', ()=>setVol(v.value)); v.addEventListener('change', ()=>setVol(v.value)); }
    const ot = $('myNzOthers');
    if(ot) ot.addEventListener('change', ()=>{ nzOthers = !!ot.checked; _ls.set(NZ_OTHERS_KEY, nzOthers ? '1' : '0'); renderUI(); });
    const fb = $('myNzFold');
    if(fb) fb.addEventListener('click', ()=>{ nzFold = !nzFold; _ls.set(NZ_FOLD_KEY, nzFold ? '1' : '0'); renderUI(); _plResized(); });
    renderUI();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindUI); else bindUI();
  setInterval(tick, NZ_TICK_MS);

  window.TW_NOISE = {
    kind: ()=> nzKind,
    setKind, setVol,
    mix,                       // 검사용 — 합성 규칙 그 자체
    _gather: gather,           // 검사용 — 좌석에서 무엇을 읽는가
    _debug: ()=>({ kind:nzKind, vol:nzVol, others:nzOthers, fold:nzFold, ctx: ctx ? ctx.state : null,
                   layers: Object.fromEntries(Object.entries(layer).map(([k, L])=>[k, L.cur])) }),
  };
})();

/* ═══ 🌙 sim-noise.js — 백색소음 (2026-09-23 · 개정 64 신설 · handoff-2026-09-23-noise §4) ═══════════════════
   [무엇을 지키나]
   ・1절: 마크업 — 플레이리스트 창 음악 줄 바로 아래 · 칸 넷(끄기 포함) · 전용 슬라이더 · 남의 소리 체크 · ▼ 접기 ·
          회사원 안내 · 미니미에서 숨김 · <script> 순서(app.js 뒤 · 자료 → 재생기).
   ・2절: 합성 규칙(«합치기» 확정) — 1명 50 · 2명 70 · 3명+ 90 · 내 소리 100 · 남의 소리 종류 기준 3겹 · 회사원 무음 ·
          체크를 끄면 내 소리만 · 멈춤/잠 자세는 무음 · 모르는 종류는 버림.
   ・3절: 좌석 읽기 — focus 만 · 숨긴 사람 제외 · 자리추가 판(findMySeat) · 회사원 모드.
   ・4절: 전파 — payload 에 noise 한 칸(입장 · 평소 · setNoise) · 받는 쪽 값 검증 · 규칙 변경 없음(firebase-init 무변경).
   ・5절: 소리 자료 · 재생 상수 — 셋 다 WebM · 루프 앞뒤 0.15초 · 페이드 0.1/0.5 · 책장 «가끔 한 번».
   [실행] app.js · desk-companion-prototype.html · noise.js · noise-sounds.js 가 있는 폴더에서. */
'use strict';
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html'), NZ = read('noise.js'), SND = read('noise-sounds.js');
if(!SRC || !HTML || !NZ || !SND){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html · noise.js · noise-sounds.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(SRC), NZC = strip(NZ);
const HTMLC = HTML.replace(/<!--[\s\S]*?-->/g, ' ');

say('── 1. 마크업');
{
  const iBox = HTMLC.indexOf('id="myPlaylistBox"'), iBar = HTMLC.indexOf('id="myPlBar"'), iNz = HTMLC.indexOf('id="myPlNoise"');
  const iChat = HTMLC.indexOf('id="myChatBox"');
  chk(iBox > 0 && iBar > iBox && iNz > iBar && iNz < iChat, '#myPlNoise 는 플레이리스트 창 안 · 음악 줄(#myPlBar) 아래');
  const row = HTMLC.slice(iNz, HTMLC.indexOf('id="myNzOffice"') + 200);
  const kinds = [...row.matchAll(/class="plBtn nzK"[^>]*data-nz="([a-z]*)"/g)].map(m => m[1]);
  chk(JSON.stringify(kinds) === '["","pencil","keyboard","page"]', '칸 넷 — 끄기 · 연필 · 키보드 · 책장 (' + kinds.join('|') + ')');
  chk(/id="myNzVol" class="plVol nzVol" type="range"/.test(row), '전용 슬라이더 #myNzVol (음악 #myPlVol 과 별개)');
  chk(/id="myNzOthers" checked/.test(row), '«같은 방 사람들 소리도» 체크 — 기본 켜짐');
  chk(/class="nzHead"[\s\S]*id="myNzNow"[\s\S]*id="myNzFold"[^>]*aria-expanded/.test(row), '머리줄 끝에 ▼ 접기(#myNzFold) · 현재 소리 한 줄(#myNzNow)');
  chk(/id="myNzOffice"/.test(row) && /#myPlNoise\.office \.nzOffice\{display:block;\}/.test(HTML), '회사원 안내 줄 — .office 일 때만');
  chk(/#myPlNoise\.office \.nzKinds[^{]*\{opacity:\.45;\}/.test(HTML), '회사원 모드 = 흐리게(막지는 않는다)');
  chk(/#myPlaylistBox\.mini #myPlNoise\{display:none;\}/.test(HTML), '미니미에서는 줄째로 숨김');
  chk(/#myPlNoise\.fold \.nzBody\{display:none;\}/.test(HTML), '접힘 = 몸통 숨김');
  const iPlBtn = HTML.indexOf('  #myPlaylistBox .plBtn{'), iNzK = HTML.indexOf('#myPlNoise .plBtn.nzK{');
  chk(iPlBtn > 0 && iNzK > iPlBtn, '.plBtn.nzK 규칙이 #myPlaylistBox .plBtn 보다 뒤(여백 우선순위 함정)');
  const iVol = HTML.indexOf('  #myPlaylistBox .plVol{'), iNzV = HTML.indexOf('#myPlNoise .plVol.nzVol{max-width:none;}');
  chk(iVol > 0 && iNzV > iVol, '백색소음 슬라이더는 62px 상한을 푼다(뒤에서)');
  const sApp = HTMLC.indexOf('<script src="parts/app.js">'), sSnd = HTMLC.indexOf('<script src="parts/noise-sounds.js">'), sNz = HTMLC.indexOf('<script src="parts/noise.js">');
  chk(sApp > 0 && sSnd > sApp && sNz > sSnd, '<script> 순서 — app.js → noise-sounds.js → noise.js');
  chk((HTMLC.match(/parts\/noise\.js/g) || []).length === 1 && (HTMLC.match(/parts\/noise-sounds\.js/g) || []).length === 1, '두 파일 모두 한 번씩만 실린다');
}

/* ── 실제 noise.js 를 돌린다(스텁 위) ── */
const env = { office:false, hidden:new Set(), states:new Map(), now:1000, sent:[], store:{}, intervals:0, listeners:[] };
function mkSeat(o){ return Object.assign({ remote:true }, o); }
const ctx = {
  console, Math, JSON, Object, Array, String, Number, parseInt, Promise, Uint8Array, atob:(s)=>Buffer.from(s, 'base64').toString('binary'),
  performance:{ now:()=>env.now },
  localStorage:{ getItem:(k)=> (k in env.store) ? env.store[k] : null, setItem:(k, v)=>{ env.store[k] = String(v); } },
  setInterval:()=>{ env.intervals++; return 1; },
  document:{ readyState:'complete', getElementById:()=>null, addEventListener(){}, activeElement:null },
  seats:[], findMySeat:()=> ctx.seats.find(s=>s.isMe) || null,
  seatState:(s)=> env.states.get(s) || 'idle',
  _seatHidden:(s)=> env.hidden.has(s),
  Presence:{ setNoise:(k)=>env.sent.push(k) },
};
Object.defineProperty(ctx, 'officeMode', { get:()=>env.office, enumerable:true });
ctx.window = ctx;
ctx.window.addEventListener = (ev)=>env.listeners.push(ev);
vm.createContext(ctx);
vm.runInContext(SND, ctx, { filename:'noise-sounds.js' });
vm.runInContext(NZ, ctx, { filename:'noise.js' });
const N = ctx.TW_NOISE;

say('── 2. 합성 규칙 («합치기»)');
{
  chk(!!(N && N.mix && N._gather && N.kind && N.setKind), 'window.TW_NOISE — kind · setKind · mix · _gather');
  const o = (k, n, f = true) => Array.from({ length:n }, () => ({ kind:k, focus:f }));
  const M = (others, mine, extra) => N.mix(Object.assign({ office:false, withOthers:true, others, mine: mine || { kind:'', focus:false } }, extra || {}));
  let r = M(o('pencil', 1)); chk(r.pencil === 0.5, '1명 → 50%');
  r = M(o('pencil', 2)); chk(r.pencil === 0.7, '2명 → 70%');
  r = M(o('pencil', 3)); chk(r.pencil === 0.9, '3명 → 90%');
  r = M(o('pencil', 7)); chk(r.pencil === 0.9, '7명이어도 90%(한 벌만 · 볼륨만)');
  r = M(o('pencil', 1), { kind:'pencil', focus:true }); chk(r.pencil === 1 && Object.keys(r).length === 1, '내 소리 = 같은 벌을 100% 로(따로 한 벌을 더 틀지 않는다)');
  r = M(o('keyboard', 2), { kind:'pencil', focus:true }); chk(r.pencil === 1 && r.keyboard === 0.7, '내 연필 100 · 남의 키보드 2명 70');
  r = M([].concat(o('pencil', 2), o('keyboard', 1), o('page', 1))); chk(Object.keys(r).length === 3, '종류 셋 → 셋 다(상한 3겹 안)');
  r = M(o('pencil', 2, false)); chk(Object.keys(r).length === 0, '멈춤 자세(focus 아님)인 사람은 안 들린다');
  r = M(o('pencil', 2), { kind:'keyboard', focus:false }); chk(r.pencil === 0.7 && !r.keyboard, '내가 멈추면 내 소리만 빠진다');
  r = M(o('pencil', 2), { kind:'keyboard', focus:true }, { withOthers:false }); chk(r.keyboard === 1 && !r.pencil, '체크를 끄면 내 소리만');
  r = M(o('pencil', 3), { kind:'pencil', focus:true }, { office:true }); chk(Object.keys(r).length === 0, '🏢 회사원 모드 → 내 것도 남의 것도 무음');
  r = M([{ kind:'drum', focus:true }, { kind:'', focus:true }, { kind:null, focus:true }]); chk(Object.keys(r).length === 0, '모르는 종류 · 빈 값은 버린다');
  /* 3겹 상한 — 종류가 넷 이상일 때를 가짜 종류 없이 재려면 상한 상수를 본다(종류가 셋뿐이라 런타임으로는 못 넘는다). */
  chk(/const NZ_MAX_LAYERS = 3;/.test(NZC) && /\.slice\(0, NZ_MAX_LAYERS\)/.test(NZC), '남의 소리 종류 상한 3 — 사람 많은 순으로 자른다');
  chk(/sort\(\(a, b\)=> \(cnt\[b\] - cnt\[a\]\) \|\| /.test(NZC), '같은 수면 고정 순서(틱마다 층이 바뀌어 깜빡이지 않게)');
}

say('── 3. 좌석 읽기');
{
  const me = { isMe:true, remote:false }, a = mkSeat({ remoteNoise:'pencil' }), b = mkSeat({ remoteNoise:'pencil' }), c = mkSeat({ remoteNoise:'keyboard' }), d = mkSeat({ remoteNoise:null });
  ctx.seats.push(me, a, b, c, d);
  [me, a, b, c, d].forEach(s=>env.states.set(s, 'focus'));
  N.setKind('page');
  chk(N.kind() === 'page' && env.store['tw.noise.kind'] === 'page' && env.sent[env.sent.length - 1] === 'page', '고르면 저장(tw.noise.kind) · 방에 알림(Presence.setNoise)');
  let r = N.mix(N._gather(env.now)); chk(r.page === 1 && r.pencil === 0.7 && r.keyboard === 0.5, '내 책장 100 · 연필 2명 70 · 키보드 1명 50');
  env.states.set(a, 'idle'); r = N.mix(N._gather(env.now)); chk(r.pencil === 0.5, '한 명이 멈춤 자세 → 1명 비율로');
  ['sleep', 'dance', 'pet'].forEach(st=>{ env.states.set(me, st); });
  r = N.mix(N._gather(env.now)); chk(!r.page, '내가 focus 가 아니면(잠·춤·쓰다듬기) 내 소리 없음');
  env.states.set(me, 'focus'); env.states.set(a, 'focus');
  env.hidden.add(b); r = N.mix(N._gather(env.now)); chk(r.pencil === 0.5, '🙈 숨긴 사람의 소리는 안 듣는다'); env.hidden.clear();
  env.office = true; r = N.mix(N._gather(env.now)); chk(Object.keys(r).length === 0, '회사원 모드 전역(officeMode)을 읽는다'); env.office = false;
  me.isMe = false; ctx.findMySeat = ()=> me; r = N.mix(N._gather(env.now)); chk(r.page === 1, '내 좌석은 findMySeat 기준(자리추가 판)'); me.isMe = true;
  N.setKind('bogus'); chk(N.kind() === '' && env.sent[env.sent.length - 1] === '', '모르는 값으로 고르면 끄기로');
  chk(env.intervals === 1 && /const NZ_TICK_MS = 100;/.test(NZC), '틱 하나 · 100ms(페이드인 0.1초를 지킬 만큼)');
  chk(env.listeners.includes('pointerdown') && env.listeners.includes('keydown'), '첫 제스처에서 오디오를 만든다(pointerdown · keydown)');
  chk(!/new \(window\.AudioContext[^\n]*\n[^\n]*\}\)\(\);/.test(NZC) && /function _ensureCtx\(\)/.test(NZC) && !/_ensureCtx\(\);\s*\n\s*setInterval/.test(NZC), 'AudioContext 는 불러올 때 만들지 않는다(제스처 전 = suspended)');
}

say('── 4. 전파');
{
  chk(/let myNoise='';/.test(CODE), 'Presence 에 myNoise(빈 문자열 = 끔)');
  chk(/userId:getMyUserId\(\), noise:myNoise, lic:/.test(CODE), '입장 payload 에 noise(awayImg 줄 판정을 안 흔드는 자리)');
  chk(/flyCool:_myFlyCool\(\), noise:myNoise\}; \}/.test(CODE), '평소 payload(_basePayload) 끝에 noise');
  chk(/myNoise = \(window\.TW_NOISE && TW_NOISE\.kind\) \? TW_NOISE\.kind\(\) : ''/.test(CODE), '입장 때 noise.js 에서 한 번 읽는다(없으면 빈 값)');
  const i = CODE.indexOf('function setNoise('); const fn = CODE.slice(i, CODE.indexOf('function setFocusShow(', i));
  chk(i > 0 && /\^\(pencil\|keyboard\|page\)\$/.test(fn) && /if\(v === myNoise\) return;/.test(fn) && /provider\.update\(_basePayload\(\)\)/.test(fn), 'setNoise — 검증 · 같으면 안 보냄 · _basePayload 통로');
  chk(/return \{ start, [^}]*setNoise,/.test(CODE), 'Presence 가 setNoise 를 내보낸다');
  chk(/s\.remoteNoise=\(typeof friends\[id\]\.noise === 'string' && \/\^\(pencil\|keyboard\|page\)\$\/\.test\(friends\[id\]\.noise\)\) \? friends\[id\]\.noise : null;/.test(CODE), '받는 쪽 — 모르는 값은 null');
  const FI = read('firebase-init.js');
  if(FI) chk(!/noise/.test(FI), 'firebase-init.js 는 안 건드렸다(updateMe 가 그대로 흘린다)');
  else say('  · firebase-init.js 없음 — 그 한 줄만 건너뜀');
}

say('── 5. 소리 자료 · 재생 상수');
{
  const S = ctx.TW_NOISE_SOUNDS || {};
  ['pencil', 'keyboard', 'page'].forEach(k=>{
    const m = /^data:audio\/webm;base64,([A-Za-z0-9+/=]+)$/.exec(S[k] || '');
    const b = m ? Buffer.from(m[1], 'base64') : null;
    chk(!!b && b.length > 20000 && b.readUInt32BE(0) === 0x1A45DFA3 && b.includes(Buffer.from('OpusHead')), k + ' — WebM/Opus (' + (b ? Math.round(b.length / 1024) : 0) + 'KB)');
  });
  chk(SND.length < 700 * 1024, '자료 파일 700KB 미만(' + Math.round(SND.length / 1024) + 'KB)');
  chk(/const NZ_LOOP_TRIM = 0\.15;/.test(NZC) && /s\.loopStart = Math\.min\(NZ_LOOP_TRIM, d \/ 10\);/.test(NZC) && /s\.loopEnd   = Math\.max\(s\.loopStart \+ 0\.5, d - NZ_LOOP_TRIM\);/.test(NZC), '루프 이음새 — 앞뒤 0.15초 빼고(데모와 같은 식)');
  chk(/const NZ_FADE_IN_TC  = 0\.035;/.test(NZC) && /const NZ_FADE_OUT_TC = 0\.5 \/ 3;/.test(NZC), '페이드인 0.1초(3τ) · 페이드아웃 0.5초');
  chk(/const NZ_RATIO = \(n\)=> n >= 3 \? 0\.9 : \(n === 2 \? 0\.7 : 0\.5\);/.test(NZC) && /const NZ_MINE = 1\.0;/.test(NZC), '비율 상수 50/70/90 · 내 것 100');
  chk(/const NZ_PAGE_LOOP = false;/.test(NZC) && /function _pageShots\(/.test(NZC), '📖 책장 = «가끔 한 번»(루프 스위치는 NZ_PAGE_LOOP)');
  chk(/const NZ_VOL_KEY    = 'tw\.noise\.vol';/.test(NZC) && !/myPlVol/.test(NZC), '음량은 따로 저장 — 음악 슬라이더를 안 건드린다');
  chk(/_plSyncBgmBounds/.test(NZC), '접고 펼 때 유튜브 창 사각형을 다시 맞춘다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

/* ═══ ⚖️ sim-slot-conflict.js — 슬롯 동기화 충돌 감지 (제보 3-7 후속 ④ · 2026-09-20) ═══════════
   [무엇을 지키나] 슬롯 동기화는 ts 큰 쪽이 **통째로** 이긴다(sim-slot-sync 3절). 그래서 서버가 바뀐 것을
     본 적도 없는 기기(회사 PC · 1칸)가 그 위에 올리고, 집 PC(5칸)가 그것을 받아 4칸을 잃었다 — 제보 3-7.
     이번에 「내가 마지막으로 맞춰 본 서버 시각」(seen)을 따로 두어, **양쪽이 다 움직였을 때만** 어느 쪽도
     덮지 않고 사람에게 넘긴다. 한쪽만 움직인 판은 예전 갈래(ts 큰 쪽)가 그대로 처리한다.
   ・1절: 정적 — seen 키가 SLOTS_TS_KEY 와 나란히 산다(ACCOUNT_LOCAL_KEYS · 계정 정리 · 이관 규칙) · 대화상자 배선.
   ・1-b절: 🛟 ① 서버 이전 한 벌 — saveSlotsRemote 가 칸을 줄이면 slotsPrev 에 남긴다 · 규칙 블록 · 되돌리기 두 번째 출구.
   ・2절: app.js 본문을 떼어 와 돌린다 —
          ① 3-7 재현: 서버를 본 적 없는 기기가 올리려 하면 **멈춘다**(쓰기 0 · 받기 0 · 경고 1 · 충돌 기록)
          ② 한쪽만 움직인 판은 예전처럼 조용하다(내가 올린 뒤 남이 올림 → 받는다 / 서버 그대로인데 내가 고침 → 올린다)
          ③ 'server' 로 고르면 받고(로컬은 3-7-1 백업에) · 'mine' 으로 고르면 올린다(서버 이전 한 벌 ① 이 있으면 먼저)
          ④ 충돌 판에서 계정이 비어 있으면 잃을 게 없으니 올린다
          ⑤ pull(연동)은 충돌을 안 본다(가챠와 같다 — 저쪽 계정 것)
          ⑥ 받아 적으면 seen = 서버 ts · 올리면 seen = 내 ts · 쓰기가 거부되면 seen 은 그대로(다음 판에 또 잡힌다)
   [실행] app.js 가 있는 폴더에서. firebase-init.js · 규칙 파일이 있으면 1-b 도 본다(없으면 검사못함). 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
if(!fs.existsSync('app.js')) process.exit(2);
const SRC = fs.readFileSync('app.js', 'utf8');

let pass = 0, fail = 0, huhs = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const huh = (msg) => { huhs++; say('  ? ' + msg); };
function grabFn(src, name, kw){
  const i = src.indexOf((kw || 'function ') + name + '(');
  if(i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  return null;
}
function grabBlock(src, from, to){
  const a = src.indexOf(from); if(a < 0) return null;
  const b = src.indexOf(to, a); if(b < 0) return null;
  return src.slice(a, b + to.length);
}

/* ── 1. 정적 ── */
say('── 1. 정적 — seen 키는 ts 키와 나란히 산다');
chk(/const SLOTS_SEEN_KEY = 'deskFriends\.slots\.seen';/.test(SRC), '★ SLOTS_SEEN_KEY 가 있다');
const keys = grabFn(SRC, 'ACCOUNT_LOCAL_KEYS = ()=>[', 'const ') || (SRC.slice(SRC.indexOf('const ACCOUNT_LOCAL_KEYS'), SRC.indexOf('const ACCOUNT_LOCAL_KEYS') + 4000));
chk(/LS_KEY, SLOTS_TS_KEY, SLOTS_SEEN_KEY,/.test(keys), '★ ACCOUNT_LOCAL_KEYS 에 SLOTS_TS_KEY 바로 옆에 있다 — ts 가 지워지는데 seen 이 남으면 다음 계정이 «본 적 있음» 을 물려받는다');
chk(/_slotsTs = 0; _slotsSeen = 0; _slotsConflict = null;/.test(SRC), '  계정 정리 때 메모리도 같이 0 (ts 와 한 줄)');
chk(/else _slotsSeenSet\(_slotsTs\);\s*\/\/ ⚖️ 이관/.test(SRC), '★ 이관: seen 키가 없던 기기는 지금 ts 를 본 것으로 — 개정 전과 똑같이 굴고 그 뒤부터 seen 이 붙는다(조용한 쪽을 골랐다 · 주석)');
const sync = grabFn(SRC, 'syncSlotsToServer', 'async function ') || '';
chk(/const serverMoved = \(sTs !== _slotsSeen\);/.test(sync) && /const localDirty  = \(_slotsTs !== _slotsSeen\);/.test(sync) && /if\(serverMoved && localDirty\)\{/.test(sync), '★ 충돌 = 서버가 내가 본 것과 다르다 && 내가 맞춘 뒤 바뀌었다 — 둘 다일 때만');
chk(sync.indexOf('if(serverMoved && localDirty){') < sync.indexOf('if(sTs > _slotsTs){'), '  충돌 감지가 예전 갈래(ts 큰 쪽) **앞**에 선다 — 뒤에 서면 이미 덮은 뒤다');
chk(/resolveSlotsConflict\(which\)/.test(SRC) && /window\.resolveSlotsConflict = resolveSlotsConflict/.test(SRC) && /window\.slotsConflictInfo = slotsConflictInfo/.test(SRC), '  콘솔 출구 두 개(slotsConflictInfo · resolveSlotsConflict) — 대화상자는 시안 뒤(_slotsConflictHandler 자리)');
chk(/_slotsConflictHandler = _slotsShowConflictDlg;/.test(SRC), '★ 대화상자가 핸들러에 꽂혔다(시안 확정 · 개정 31) — _slotsShowConflictDlg');
const dlg = grabFn(SRC, '_slotsShowConflictDlg') || '';
chk(/resolveSlotsConflict\(which\)/.test(dlg) && /go\('server'\)/.test(dlg) && /go\('mine'\)/.test(dlg), '  두 버튼이 resolveSlotsConflict 로 간다(콘솔 출구와 같은 길)');
chk(/scdLater/.test(dlg) && !/resolveSlotsConflict\('|_slotsTouch|_push/.test(dlg.slice(dlg.indexOf('scdLater'))) , '  [나중에 결정] 은 닫기만 — 어느 쪽도 안 덮는 지금 상태를 둔다');
chk(/more === 'server' \? 'bold'/.test(dlg), '  더 많은 쪽이 굵다(시안)');

/* ── ① firebase-init · 규칙 — 서버 이전 한 벌 ── */
say('── 1-b. firebase-init · 규칙 — 🛟 서버 이전 한 벌 (①)');
if(fs.existsSync('firebase-init.js') && fs.existsSync('firebase-database-rules.json')){
  const FI = fs.readFileSync('firebase-init.js', 'utf8');
  const ssr = grabFn(FI, 'saveSlotsRemote', 'async ') || '';
  const spr = grabFn(FI, 'saveSlotsPrevRemote', 'async ') || '';
  const lpr = grabFn(FI, 'loadSlotsPrevRemote', 'async ') || '';
  chk(/if\(nCur > nNew\)\{/.test(ssr) && ssr.indexOf('slotsPrev') < ssr.indexOf('set(ref(db, `users/${uid}/slots`)'), '★ saveSlotsRemote 가 칸을 줄이는 쓰기면 **본 쓰기 전에** slotsPrev 를 남긴다 — 덮는 쪽은 무엇을 덮는지 모르고, 아는 건 서버 앞의 이 함수뿐');
  chk(/if\(nPrev <= nCur\)/.test(ssr), '  더 많은 prev 는 안 덮는다(로컬 백업 ③ 규칙과 같다)');
  chk(/console\.warn\('\[슬롯\] 서버 이전 한 벌 남기기 실패\(본 쓰기는 계속\)'/.test(ssr), '  실패해도 본 쓰기는 막지 않는다');
  chk(/if\(nPrev > nCur\) return false;/.test(spr) && /slotsPrev`\), \{ v: 1, s: curS/.test(spr), "★ saveSlotsPrevRemote — 'mine' 을 고른 판에서 조건 없이 한 벌(더 많은 prev 만 보호)");
  chk(/return \{ s, ts: Number\(v\.ts\) \|\| 0, at: Number\(v\.at\) \|\| 0 \};/.test(lpr) && /return null/.test(lpr), '  loadSlotsPrevRemote — 되돌리기의 두 번째 출구 · 실패는 null');
  const R = JSON.parse(fs.readFileSync('firebase-database-rules.json', 'utf8'));
  const U = R.rules && R.rules.users && R.rules.users['$userId']; const S = U && U.slots, P = U && U.slotsPrev;
  chk(!!P, '★ 규칙에 users/$userId/slotsPrev 블록이 있다 — 없으면 쓰기가 조용히 거부된다(게시해야 켜진다)');
  chk(P && S && P['.write'] === S['.write'] && JSON.stringify(P.s) === JSON.stringify(S.s) && P.at && /isNumber/.test(P.at['.validate']), '  .write · s/$i validate 가 slots 와 같고 at 은 숫자');
  const fRest = grabFn(SRC, 'restoreSlotsPrevRemote', 'async function ') || '';
  chk(/loadSlotsPrevRemote\(uid\)/.test(fRest) && /_slotsAdoptFromServer\(\{ s: prev\.s, ts: _slotsNow\(\) \}\)/.test(fRest), '  app.js restoreSlotsPrevRemote — 받은 것을 «지금» 으로 찍어 최신으로(다음 판에 올라간다)');
  const fUI = grabFn(SRC, '_slotsRestoreFromUI', 'async function ') || '';
  chk(fUI.indexOf('restoreSlotsBackup()') > 0 && fUI.indexOf('restoreSlotsPrevRemote()') > fUI.indexOf('restoreSlotsBackup()'), '  [되돌리기] 는 로컬 백업 먼저, 없으면 서버 한 벌');
}else huh('firebase-init.js · firebase-database-rules.json 없음 — ① 은 못 본다');

/* ── 2. 본문 ── */
say('── 2. app.js — 충돌 진리표');
const block = grabBlock(SRC, "const SLOTS_TS_KEY = 'deskFriends.slots.ts';", 'SLOTS_SYNC_INTERVAL_MS);');
const fSlotToObj = grabFn(SRC, 'slotToObj');
const fImg = grabFn(SRC, '_slotImgToDataUrl');
const fSave = grabFn(SRC, 'saveSlots');
const fHash = grabFn(SRC, '_quickHash');
const fCL = grabFn(SRC, '_roomFaceCacheLoad'), fCS = grabFn(SRC, '_roomFaceCacheSave');
const fOne = grabFn(SRC, '_storageFaceUrlOne', 'async function ');
if(!block || !fSlotToObj || !fImg || !fSave || !fHash || !fCL || !fCS || !fOne){
  huh('본문을 못 떼어 옴 — block:' + !!block + ' slotToObj:' + !!fSlotToObj + ' saveSlots:' + !!fSave);
  say(''); say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs); process.exit(fail ? 1 : 0);
}
const D = t => { let p = (t + 'zz').repeat(60).replace(/[^A-Za-z0-9]/g, 'z'); while(p.length % 4) p += 'z'; return 'data:image/png;base64,' + p; };
function mkEnv(){
  const env = { ls: new Map(), now: 1_800_000_000_000, uid: 'u1', srv: null, writes: [], fullReads: 0, tsReads: 0,
    uploads: [], glbUploads: [], urlToData: new Map(), timers: [], toasts: [], warns: [], denied: 0, prevSaved: 0, deny: false };
  const localStorage = { getItem: k => env.ls.has(k) ? env.ls.get(k) : null, setItem: (k, v) => env.ls.set(k, String(v)), removeItem: k => env.ls.delete(k) };
  const firebaseAPI = {
    loadSlotsTs: async () => { env.tsReads++; return env.srv ? (env.srv.ts || 0) : 0; },
    loadSlotsRemote: async () => { env.fullReads++; return env.srv ? { s: Object.assign({}, env.srv.s || {}), ts: env.srv.ts || 0 } : { s: {}, ts: 0 }; },
    saveSlotsRemote: async (uid, s, ts) => { if(env.deny) return false; env.writes.push({ s: Object.assign({}, s), ts }); env.srv = { s: Object.assign({}, s), ts }; return true; },
    uploadRoomFace: async (uid, key, dataUrl) => { env.uploads.push(key); const url = 'https://st/roomface_' + key + '.png'; env.urlToData.set(url, dataUrl); return { ok: true, url }; },
    uploadSlotGlb: async (uid, key, b64) => { env.glbUploads.push(key); const url = 'https://st/slotglb_' + key + '.glb'; env.urlToData.set(url, b64); return { ok: true, url }; },
  };
  const window = { firebaseAPI };
  const decl = [
    "const LS_KEY='deskFriends.slots.v1'; const CHAR_SLOT_MAX=5;",
    "const slots=new Array(CHAR_SLOT_MAX).fill(null);",
    "const _faceEverDrawn=new Array(CHAR_SLOT_MAX).fill(false), _blinkEverDrawn=new Array(CHAR_SLOT_MAX).fill(false);",
    "let _blankFaceConfirmed=false; const _isBlankDraw=()=>false;",
    "const console={ warn:(m)=>env.warns.push(String(m)), log:()=>{} };",
    "const toast=(m)=>env.toasts.push(m);",
    "const document={ getElementById:()=>({ classList:{ contains:()=>true } }) };",
    "const setTimeout=(fn,ms)=>{ env.timers.push({fn,ms}); return env.timers.length; };",
    "const clearTimeout=()=>{}; const setInterval=()=>0;",
    "const getMyUserId=()=>env.uid; const _srvNow=()=>env.now;",
    "let creatorOpen=false;",
    "const renderLauncher=()=>{}; const renderCharSlots=()=>{};",
    "const _warnServerWriteDenied=()=>{ env.denied++; };",
    "const _roomFaceUrlToCanvas=async(url)=>{ const d=env.urlToData.get(url); if(!d) throw new Error('없는 URL '+url); return { toDataURL:()=>d }; };",
    "const fetch=async(url)=>{ const b=env.urlToData.get(url); if(!b) return { ok:false, status:404 };" +
    " const m=/^data:([^;]+);base64,(.*)$/.exec(b); const buf=Buffer.from(m?m[2]:b,'base64');" +
    " return { ok:true, headers:{ get:(k)=>(/content-type/i.test(k)&&m)?m[1]:null }, arrayBuffer:async()=>buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength) }; };",
    "const btoa=(s)=>Buffer.from(s,'binary').toString('base64');",
    "async function loadSlots(){ let arr; try{ arr=JSON.parse(localStorage.getItem(LS_KEY)||'null'); }catch(_){ return; } if(!Array.isArray(arr)) return; for(let i=0;i<CHAR_SLOT_MAX;i++){ if(arr[i]) slots[i]=Object.assign({}, arr[i]); } }",
  ].join('\n');
  const body = [fHash, fCL, fCS, fOne, fImg, fSlotToObj, fSave, block].join('\n');
  const f = new Function('env', 'localStorage', 'window', 'firebaseAPI', decl + '\n' + body +
    "\nreturn { sync:syncSlotsToServer, save:saveSlots, load:loadSlots, slots, ts:()=>_slotsTs, filled:_slotsFilledCount," +
    "\n  seen:(typeof _slotsSeenSet==='function'?_slotsSeenSet:null), seenTs:()=>(typeof _slotsSeen==='number'?_slotsSeen:null)," +
    "\n  conflict:()=>(typeof _slotsConflict==='undefined'?undefined:_slotsConflict), resolve:(typeof resolveSlotsConflict==='function'?resolveSlotsConflict:null)," +
    "\n  setHandler:(h)=>{ _slotsConflictHandler=h; } };");
  env.m = f(env, localStorage, window, firebaseAPI);
  env.LS = localStorage; env.api = firebaseAPI;
  return env;
}
const mkSlot = (tag) => ({ skin:1, top:'#111', bot:'#222', face:D(tag+'F'), blink:D(tag+'B'), thumb:D(tag+'T') });
const LSK = 'deskFriends.slots.v1', BAK = 'deskFriends.slots.bak';
const five = () => JSON.stringify([mkSlot('h1'), mkSlot('h2'), mkSlot('h3'), mkSlot('h4'), mkSlot('h5')]);

(async () => {
  const probe = mkEnv();
  if(!probe.m.seen || !probe.m.resolve){
    chk(false, '★ seen(_slotsSeenSet) · resolveSlotsConflict 가 없다 — 충돌 감지(④)가 아직 없는 판이다');
    say(''); say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs); process.exit(1);
  }

  /* 집 PC: 5칸을 만들어 올려 둔다. 서버는 집 PC 것. */
  const mkHome = async () => { const h = mkEnv(); h.LS.setItem(LSK, five()); await h.m.load(); h.m.save(); await h.m.sync('boot'); return h; };

  /* ① 3-7 재현 */
  say('· ① 3-7 재현 — 서버를 본 적 없는 회사 PC(1칸)가 집 PC(5칸) 위에 올리려 한다');
  let home = await mkHome();
  chk(home.writes.length === 1 && Object.keys(home.writes[0].s).length === 5 && home.m.seenTs() === home.m.ts(), '  (준비) 집 PC 가 5칸을 올렸고 seen = 내 ts');
  const office = mkEnv(); office.srv = home.srv; office.urlToData = home.urlToData;
  office.now = home.now + 60_000;
  office.LS.setItem(LSK, JSON.stringify([mkSlot('office'), null, null, null, null]));
  await office.m.load(); office.m.save();                 // 서버를 본 적 없이(seen=0) 1칸을 만들었다 — 오프라인 부팅 같은 경우
  chk(office.m.seenTs() === 0 && office.m.ts() > home.m.ts(), '  (준비) 회사 PC 는 seen=0 · 로컬 ts 가 서버보다 크다 — 개정 전이면 여기서 5칸이 1칸으로 덮였다');
  let handled = null; office.m.setHandler((c) => { handled = c; });
  await office.m.sync('boot');
  chk(office.writes.length === 0, '★ 쓰기 0 — 서버의 5칸을 덮지 않았다');
  chk(office.m.filled(office.LS.getItem(LSK)) === 1, '★ 받기 0 — 이 기기의 1칸도 그대로다(어느 쪽도 지지 않았다)');
  chk(office.fullReads === 1, '  본문 한 번 읽었다 — 칸 수를 보여 주려면 필요하다(충돌 판에서만)');
  const c = office.m.conflict();
  chk(c && c.localCount === 1 && c.serverCount === 5 && c.sTs === home.srv.ts && c.localTs === office.m.ts(), '★ 충돌 기록 — 이 기기 1칸 · 계정 5칸 · 양쪽 시각');
  chk(handled === c, '  UI 자리(_slotsConflictHandler)로 같은 기록이 넘어간다 — 대화상자는 여기에 꽂힌다(시안 뒤)');
  chk(office.warns.filter(w => /양쪽이 다 바뀌었습니다/.test(w)).length === 1 && /resolveSlotsConflict/.test(office.warns.join('')), '  콘솔 경고 1 — 고르는 법이 적혀 있다');
  await office.m.sync('tick');
  chk(office.writes.length === 0 && office.warns.filter(w => /양쪽이 다 바뀌었습니다/.test(w)).length === 1, '  다음 판에도 덮지 않고, 같은 충돌로 두 번 경고하지 않는다');
  chk(office.toasts.length === 0, '  토스트 0 — 화면 문구는 시안 뒤(지금은 콘솔이 출구)');

  /* 집 PC 쪽은 아무 일 없다 */
  await home.m.sync('tick');
  chk(home.writes.length === 1 && home.fullReads === 0 && home.m.filled(home.LS.getItem(LSK)) === 5, '★ 집 PC 는 다음 판에 ts 한 값만 읽고 그대로 5칸 — 잃은 게 없다');

  /* ② 한쪽만 움직인 판 */
  say('· ② 한쪽만 움직인 판은 예전처럼 조용하다');
  home = await mkHome();
  const laptop = mkEnv(); laptop.srv = home.srv; laptop.urlToData = home.urlToData; laptop.now = home.now + 1000;
  await laptop.m.sync('boot');                            // 새 기기 — 로컬 없음 → 받는다
  chk(laptop.m.filled(laptop.LS.getItem(LSK)) === 5 && laptop.m.seenTs() === home.srv.ts && laptop.m.conflict() === null, '  빈 새 기기는 그냥 받고 seen = 서버 ts (충돌 아님)');
  const tsBefore = laptop.m.ts();
  laptop.m.save();                                        // 같은 내용 재저장 — ts 안 바뀜
  chk(laptop.m.ts() === tsBefore, '  받은 직후 재저장은 ts 를 안 바꾼다(핑퐁 없음 · sim-slot-sync ②와 같다)');
  laptop.m.slots[2] = null; laptop.now += 5000; laptop.m.save();   // 3번 칸을 지웠다 → 문자열이 달라 ts=now
  await laptop.m.sync('tick');
  chk(laptop.writes.length === 1 && laptop.m.conflict() === null && laptop.m.seenTs() === laptop.m.ts(), '★ 서버가 내가 본 그대로인데 내가 고쳤다 → 그냥 올린다 · seen = 내 ts (충돌 아님)');
  home.srv = laptop.srv; home.urlToData = laptop.urlToData;
  await home.m.sync('tick');
  chk(home.writes.length === 1 && home.m.filled(home.LS.getItem(LSK)) === 4 && home.m.conflict() === null && home.m.seenTs() === laptop.srv.ts, '★ 나는 안 바꿨는데 남이 올렸다 → 그냥 받는다 · seen = 서버 ts (충돌 아님)');
  chk(home.warns.some(w => /5개가 .*4개로 바뀌었습니다/.test(w)) && home.LS.getItem(BAK), '  칸이 줄었으니 흔적과 백업(3-7-1)은 예전대로 남는다 — 이건 남의 삭제를 받은 것이라 묻지 않는다');

  /* ③ 사람이 고른다 */
  say("· ③ 고르기 — 'server' 는 받고 'mine' 은 올린다");
  home = await mkHome();
  let off = mkEnv(); off.srv = home.srv; off.urlToData = home.urlToData; off.now = home.now + 60_000;
  off.LS.setItem(LSK, JSON.stringify([mkSlot('office'), null, null, null, null])); await off.m.load(); off.m.save();
  await off.m.sync('boot');
  chk(!!off.m.conflict(), '  (준비) 충돌 상태');
  const oneRaw = off.LS.getItem(LSK);
  let ok = await off.m.resolve('server');
  chk(ok === true && off.m.conflict() === null && off.m.filled(off.LS.getItem(LSK)) === 5 && off.writes.length === 0, "★ 'server' → 계정 5칸을 받았다 · 쓰기 0 · 충돌 지움");
  chk(off.LS.getItem(BAK) === oneRaw, '  이 기기의 1칸은 로컬 백업(3-7-1)에 그대로 — 되돌릴 수 있다');
  chk(off.m.seenTs() === home.srv.ts && off.m.ts() === home.srv.ts, '  seen = ts = 서버 ts');

  off = mkEnv(); off.srv = home.srv; off.urlToData = home.urlToData; off.now = home.now + 60_000;
  off.LS.setItem(LSK, JSON.stringify([mkSlot('office'), null, null, null, null])); await off.m.load(); off.m.save();
  await off.m.sync('boot');
  const before5 = home.srv;
  ok = await off.m.resolve('mine');
  chk(ok === true && off.m.conflict() === null && off.writes.length === 1 && Object.keys(off.writes[0].s).length === 1, "★ 'mine' → 이 기기 1칸을 올렸다 · 충돌 지움");
  chk(off.m.seenTs() === off.m.ts() && off.writes[0].ts === off.m.ts(), '  seen = 내 ts = 서버 ts');
  chk(off.prevSaved === 0, '  saveSlotsPrevRemote 가 없는 firebase-init 이면 조용히 건너뛴다(① 은 다음 세션 · 서버 쪽)');
  off = mkEnv(); off.srv = before5; off.urlToData = home.urlToData; off.now = home.now + 60_000;
  off.api.saveSlotsPrevRemote = async () => { off.prevSaved++; };
  off.LS.setItem(LSK, JSON.stringify([mkSlot('office'), null, null, null, null])); await off.m.load(); off.m.save();
  await off.m.sync('boot'); await off.m.resolve('mine');
  chk(off.prevSaved === 1 && off.writes.length === 1, "★ saveSlotsPrevRemote 가 있으면 'mine' 이 덮기 **전에** 한 번 부른다(서버 이전 한 벌 ①의 자리)");
  ok = await off.m.resolve('둘다');
  chk(ok === false, "  'mine'·'server' 밖의 값은 거부");

  /* ④ 충돌 판에서 계정이 비었다 */
  say('· ④ 충돌 판인데 계정이 비어 있다 → 잃을 게 없으니 올린다');
  off = mkEnv(); off.srv = { ts: off.now - 500, s: {} };
  off.LS.setItem(LSK, JSON.stringify([mkSlot('solo'), null, null, null, null])); await off.m.load(); off.m.save();
  off.m.seen(off.now - 9999);                             // 서버 ts 와도 내 ts 와도 다르다 = 양쪽 다 움직였다
  await off.m.sync('boot');
  chk(off.writes.length === 1 && off.m.conflict() === null, '  빈 계정은 충돌이 아니다 — 올린다');

  /* ⑤ pull 은 충돌을 안 본다 */
  say('· ⑤ 연동 pull 은 충돌을 안 본다(저쪽 계정 것)');
  home = await mkHome();
  off = mkEnv(); off.srv = home.srv; off.urlToData = home.urlToData; off.now = home.now + 60_000;
  off.LS.setItem(LSK, JSON.stringify([mkSlot('office'), null, null, null, null])); await off.m.load(); off.m.save();
  await off.m.sync('transfer', 'pull');
  chk(off.m.filled(off.LS.getItem(LSK)) === 5 && off.m.conflict() === null && off.writes.length === 0, '  pull 은 묻지 않고 저쪽 것으로(가챠와 같다) — 연동 통로는 그대로');

  /* ⑥ 쓰기 거부면 seen 은 그대로 */
  say('· ⑥ 쓰기가 거부되면 seen 은 그대로 — 다음 판에 또 잡힌다');
  home = await mkHome();
  off = mkEnv(); off.srv = home.srv; off.urlToData = home.urlToData; off.now = home.now + 60_000; off.deny = true;
  off.LS.setItem(LSK, JSON.stringify([mkSlot('office'), null, null, null, null])); await off.m.load(); off.m.save();
  await off.m.sync('boot'); await off.m.resolve('mine');
  chk(off.denied === 1 && off.m.seenTs() === 0 && off.writes.length === 0, '★ 거부된 쓰기는 seen 을 안 찍는다 — 「올라갔다」고 믿고 다음 판에 서버 것을 받으면 그때 잃는다');

  say('');
  say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs);
  process.exit(fail ? 1 : 0);
})().catch(err => { say('  ✗ 예외: ' + (err && err.stack || err)); fail++; say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs); process.exit(1); });

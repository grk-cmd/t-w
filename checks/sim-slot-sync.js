/* ═══ ☁️ sim-slot-sync.js — 슬롯(캐릭터) 기기 간 동기화 (제보 6-b · 2026-09-16) ═══════════════
   [무엇을 지키나] 슬롯은 localStorage 에만 있고 서버 노드가 없어서 «회사에서 만든 캐릭터가 집 PC 에
     없다» 가 기능 부재였다. 이번에 users/{uid}/slots 노드 + 병합 + 규칙 블록이 생겼다.
   ・1절: firebase-init — ts 만 읽는 통로가 따로 있고, 쓰기는 auth 대기선을 지나 통째 set 한다.
   ・2절: 규칙 파일 — users/$userId/slots 블록 · gacha 와 같은 .write · 칸마다 길이 상한 + base64 금지.
   ・3절: app.js 본문을 떼어 와 돌린다 — 병합 진리표(서버 비움/로컬 비움/양쪽 있음/연동 pull),
          _imgBroken 칸은 원본이 올라간다, 서버 페이로드에 dataURL·thumb·GLB 원문이 없다, 되받으면
          원래 저장본과 같은 문자열이라 saveSlots 가 도로 올리지 않는다.
          ⑨ 🛟 **덮어쓰기 백업**(제보 3-7 · 2026-09-18 추가) — 통째 교체 직전에 직전 저장본을 한 벌
            남기고, 그 백업이 **하찮은 것에 덮이지 않는지**(같은 내용 재채택·더 작은 교체), 되돌리기가
            맞바꾸기인지, 되돌린 뒤 ts 를 찍어 다음 판이 또 안 덮는지, 백업이 실패해도 채택은 도는지.
          ⑩ 🔑 **내용 해시**(제보 3-7 (나) · 2026-09-18 추가) — `_quickHash` 가 곧 파일 이름이라,
            한 글자만 다른 두 그림이 같은 이름을 받으면 **다른 캐릭터의 그림이 덮어써진다.**
            전수로 보는지 · 옛 이름과 안 겹치는지 · 전환기에 캐시를 통째로 비우지 않는지.
          ⑪ 🖼️ **되받기**(제보 3-7 (다) · 2026-09-18 추가) — 서버에서 그림을 되받을 때 **바뀌지
            않는가.** 512 로 고정된 캔버스에 원래 크기로 그리면 큰 텍스처는 잘리고 작은 텍스처는
            왼쪽 위 구석에 몰린다 — 그것이 «동물 얼굴이 밀렸다» 의 정체다.
   ・4절: 배선 — 연동 통로·부팅·saveSlots.
   [실행] app.js · firebase-init.js · firebase-database-rules.json 이 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');
const FI  = fs.readFileSync('firebase-init.js', 'utf8');
const RULES = JSON.parse(fs.readFileSync('firebase-database-rules.json', 'utf8'));

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

/* ── 1. firebase-init ── */
say('── 1. firebase-init — ts 만 읽는 통로 · 대기선 · 통째 set');
const lts = grabFn(FI, 'loadSlotsTs', 'async ') || '';
const lsr = grabFn(FI, 'loadSlotsRemote', 'async ') || '';
const ssr = grabFn(FI, 'saveSlotsRemote', 'async ') || '';
const usg = grabFn(FI, 'uploadSlotGlb', 'async ') || '';
chk(/users\/\$\{uid\}\/slots\/ts/.test(lts), '★ loadSlotsTs 는 users/{uid}/slots/ts 한 값만 읽는다(부팅·주기 읽기의 전부)');
chk(/users\/\$\{uid\}\/slots`/.test(lsr) && /return null/.test(lsr), 'loadSlotsRemote 는 본문을 읽고, 실패는 null(값 없음과 구분)');
const aw = ssr.indexOf('await _whenAuthReady()'), st = ssr.indexOf('set(ref(db');
chk(aw > 0 && st > aw, '★ saveSlotsRemote 는 _whenAuthReady 를 지난 뒤 set 한다(제보 6 과 같은 소유권 쓰기)');
chk(/set\(ref\(db, `users\/\$\{uid\}\/slots`\)/.test(ssr) && !/update\(/.test(ssr), '  통째 set — update 면 지운 칸이 서버에 남는다');
chk(/\^\[0-4\]\$/.test(ssr), '  키는 0~4 만 통과시킨다');
chk(/return false/.test(ssr), '  실패는 false — 부르는 쪽이 _warnServerWriteDenied 로 잇는다');
chk(/uploadString\(storageRef, b64, 'base64'/.test(usg) && /slotglb_/.test(usg), 'uploadSlotGlb 는 Storage 에 base64 로 올리고 slotglb_ 경로를 쓴다(카탈로그와 분리)');

/* ── 2. 규칙 파일 ── */
say('── 2. firebase-database-rules.json — users/$userId/slots');
const U = RULES.rules && RULES.rules.users && RULES.rules.users['$userId'];
const G = U && U.gacha, S = U && U.slots;
chk(!!S, '★ slots 블록이 있다 (없으면 쓰기가 조용히 전부 거부된다 — gacha 때와 같은 사고)');
chk(S && G && S['.write'] === G['.write'], '  .write 가 gacha 블록과 같은 문장');
chk(S && S.ts && /isNumber/.test(S.ts['.validate']), '  ts 는 숫자');
const V = S && S.s && S.s['$i'] && S.s['$i']['.validate'] || '';
chk(/\$i\.matches\(\/\^\[0-4\]\$\/\)/.test(V), '  칸 키는 0~4');
chk(/isString\(\)/.test(V) && /length <= 150000/.test(V), '★ 칸은 문자열 + 길이 상한 150000');
chk(/!newData\.val\(\)\.matches\(\/data:.*base64,\/\)/.test(V), '★ base64 dataURL 이 든 문자열은 거부 — 그림이 RTDB 에 새는 길을 규칙이 막는다');
chk(/SLOT_JSON_MAX = 150000/.test(SRC), '  app.js 상한(SLOT_JSON_MAX)이 규칙과 같은 값');

/* ── 3. 본문 ── */
say('── 3. app.js — 병합 진리표 · _imgBroken · dataURL 금지 · 되받기');
const block = grabBlock(SRC, "const SLOTS_TS_KEY = 'deskFriends.slots.ts';", 'SLOTS_SYNC_INTERVAL_MS);');
const fSlotToObj = grabFn(SRC, 'slotToObj');
const fImg = grabFn(SRC, '_slotImgToDataUrl');
const fSave = grabFn(SRC, 'saveSlots');
const fHash = grabFn(SRC, '_quickHash');
const fCL = grabFn(SRC, '_roomFaceCacheLoad'), fCS = grabFn(SRC, '_roomFaceCacheSave');
const fOne = grabFn(SRC, '_storageFaceUrlOne', 'async function ');
if(!block || !fSlotToObj || !fImg || !fSave || !fHash || !fCL || !fCS || !fOne){
  huh('본문을 못 떼어 옴 — block:' + !!block + ' slotToObj:' + !!fSlotToObj + ' saveSlots:' + !!fSave + ' cache:' + !!(fCL && fCS && fOne));
}else{
  /* 태그를 문자열 전체에 펼친다 — 옛 해시(7칸 간격 표본) 시절의 필요였고, 지금은 전수 해시라
     꼭 그래야 하는 것은 아니다(⑩). 그대로 둔다: 해시가 또 바뀌어도 이 검사들이 흔들리지 않는다. */
  /* ⚠️ 본문이 **진짜 base64** 여야 한다 — _fetchImgDataUrl 이 바이트를 그대로 옮기게 바뀌어서
     (제보 3-7 (다)) 아래 fetch 스텁이 디코드·인코드를 한 바퀴 돈다. 알파벳 밖 글자가 섞이면
     그 왕복에서 값이 달라져 «되돌아왔다» 판정이 엉뚱하게 깨진다. 4의 배수로 맞춰 둔다. */
  const D = t => { let p = (t + 'zz').repeat(60).replace(/[^A-Za-z0-9]/g, 'z'); while(p.length % 4) p += 'z'; return 'data:image/png;base64,' + p; };
  function mkEnv(){
    const env = {
      ls: new Map(), now: 1_800_000_000_000, uid: 'u1',
      srv: null,                       // { ts, s } | null(노드 없음)
      writes: [], fullReads: 0, tsReads: 0, uploads: [], glbUploads: [],
      urlToData: new Map(), timers: [], toasts: [], warns: [], denied: 0,
      creatorOpen: false, launcherRender: 0,
    };
    const localStorage = {
      getItem: k => env.ls.has(k) ? env.ls.get(k) : null,
      setItem: (k, v) => env.ls.set(k, String(v)),
      removeItem: k => env.ls.delete(k),
    };
    const firebaseAPI = {
      loadSlotsTs: async () => { env.tsReads++; return env.srv ? (env.srv.ts || 0) : 0; },
      loadSlotsRemote: async () => { env.fullReads++; return env.srv ? { s: Object.assign({}, env.srv.s || {}), ts: env.srv.ts || 0 } : { s: {}, ts: 0 }; },
      saveSlotsRemote: async (uid, s, ts) => { env.writes.push({ s: Object.assign({}, s), ts }); env.srv = { s: Object.assign({}, s), ts }; return true; },
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
      "const renderLauncher=()=>{ env.launcherRender++; }; const renderCharSlots=()=>{};",
      "const _warnServerWriteDenied=()=>{ env.denied++; };",
      "const _roomFaceUrlToCanvas=async(url)=>{ const d=env.urlToData.get(url); if(!d) throw new Error('없는 URL '+url); return { toDataURL:()=>d }; };",
      "const fetch=async(url)=>{ const b=env.urlToData.get(url); if(!b) return { ok:false, status:404 };" +
      " const m=/^data:([^;]+);base64,(.*)$/.exec(b); const buf=Buffer.from(m?m[2]:b,'base64');" +
      " return { ok:true, headers:{ get:(k)=>(/content-type/i.test(k)&&m)?m[1]:null }," +
      "   arrayBuffer:async()=>buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength) }; };",
      "const btoa=(s)=>Buffer.from(s,'binary').toString('base64');",
      /* 로컬 저장본을 그대로 메모리에 — 그림은 문자열인 채로 둔다(slotToObj 가 data: 문자열을 통과시킨다) */
      "async function loadSlots(){ let arr; try{ arr=JSON.parse(localStorage.getItem(LS_KEY)||'null'); }catch(_){ return; } if(!Array.isArray(arr)) return; for(let i=0;i<CHAR_SLOT_MAX;i++){ if(arr[i]) slots[i]=Object.assign({}, arr[i]); } }",
    ].join('\n');
    const body = [fHash, fCL, fCS, fOne, fImg, fSlotToObj, fSave, block].join('\n');
    const f = new Function('env', 'localStorage', 'window', 'firebaseAPI', decl + '\n' + body +
      "\nreturn { sync:syncSlotsToServer, save:saveSlots, slots, ts:()=>_slotsTs, setCreator:(v)=>{ creatorOpen=v; }, push:_slotsPushToServer, load:loadSlots, faceMem:_faceEverDrawn," +
      /* 🛟 백업(제보 3-7)은 패치 전 원본에 없다. 없는 이름을 그냥 적으면 **모듈 평가가 통째로 터져**
         ①~⑧ 까지 같이 죽는다 — 그러면 이 검사가 무엇 때문에 빨강인지 못 읽는다. typeof 로 받아
         ⑨ 만 빨강이 되게 한다. */
      "\n  adopt:_slotsAdoptFromServer, filled:(typeof _slotsFilledCount==='function'?_slotsFilledCount:null)," +
      "\n  info:(typeof slotsBackupInfo==='function'?slotsBackupInfo:null), restore:(typeof restoreSlotsBackup==='function'?restoreSlotsBackup:null)," +
      "\n  hash:_quickHash, cacheLoad:_roomFaceCacheLoad, faceUrlOne:_storageFaceUrlOne," +
      /* ⚖️ seen(2026-09-20 ④)은 이 판 전 원본에 없다 — 없으면 아무것도 안 하는 함수로 받아 ①~⑪ 준비가 그대로 돈다. */
      "\n  seen:(typeof _slotsSeenSet==='function'?_slotsSeenSet:()=>{}), seenTs:()=>(typeof _slotsSeen==='number'?_slotsSeen:null), conflict:()=>(typeof _slotsConflict==='undefined'?null:_slotsConflict) };");
    env.m = f(env, localStorage, window, firebaseAPI);
    env.LS = localStorage;
    return env;
  }
  const mkSlot = (tag, extra) => Object.assign({ skin:1, top:'#111', bot:'#222', face:D(tag+'F'), blink:D(tag+'B'), thumb:D(tag+'T') }, extra || {});
  const noData = js => !/data:[a-z]+\/[a-z0-9.+-]+;base64,/.test(js);

  (async () => {
    /* ① (A) 서버 비었고 로컬 있음 → 부팅에서 자동 push. 두 번째 부팅은 ts 읽기만. */
    say('· ① 서버 비었고 로컬에만 캐릭터 → 부팅 자동 push (결정 A)');
    let e = mkEnv();
    e.LS.setItem('deskFriends.slots.v1', JSON.stringify([mkSlot('a'), null, mkSlot('c'), null, null]));
    await e.m.load();
    e.m.save();                                            // 첫 저장 = ts 부트스트랩(이 기기가 최신)
    await e.m.sync('boot');
    chk(e.writes.length === 1 && Object.keys(e.writes[0].s).join(',') === '0,2', '★ 부팅 1회 push — 칸 0·2 만 실렸다');
    chk(e.writes[0].ts === e.m.ts() && e.m.ts() > 0, '  서버 ts = 로컬 ts (서버 시계 기준 · 음수 아님)');
    chk(e.uploads.filter(k => /^(face|blink)_/.test(k)).length === 4 && e.uploads.filter(k => /^thumb_/.test(k)).length === 2 && e.uploads.length === 6, '  얼굴·감은눈 4장이 roomface 규칙 이름(face_{hash})으로 올라갔다 — 방 입장과 같은 파일 · 섬네일 2장은 thumb_{hash}(개정 37 · 보관함이 그린다)');
    chk(Object.values(e.writes[0].s).every(noData), '★ 서버 페이로드 어디에도 dataURL 이 없다');
    chk(Object.values(e.writes[0].s).every(js => (!('thumb' in JSON.parse(js)) || JSON.parse(js).thumb == null) && /^https?:/.test(JSON.parse(js).thumbUrl || '')), '  thumb(dataURL) 은 안 올라가고 thumbUrl(URL) 로 실린다(개정 37)');
    const n0 = { w: e.writes.length, f: e.fullReads, t: e.tsReads };
    await e.m.sync('tick');
    chk(e.tsReads === n0.t + 1 && e.fullReads === n0.f && e.writes.length === n0.w, '★ 바뀐 게 없는 다음 판은 ts 한 값 읽기로 끝 — 본문 읽기 0 · 쓰기 0');

    /* ② 서버가 최신 → 받아 적고, 메모리·ts 도 갈아 끼우고, 되저장해도 도로 안 올린다 */
    say('· ② 서버가 최신 → adopt (localStorage + 메모리 + ts) · 되저장은 핑퐁 없음');
    e = mkEnv();
    e.LS.setItem('deskFriends.slots.v1', JSON.stringify([mkSlot('old'), null, null, null, null]));
    await e.m.load(); e.m.save(); e.m.seen(e.m.ts());      // ⚖️ 'old' 는 이미 올라가 있던 것(맞춰 본 적 있음) — 안 그러면 ④ 충돌 감지가 잡아 세운다
    // 다른 기기가 올린 서버 사본을 흉내: 이 환경의 업로드 스텁을 그대로 써서 올린 뒤 로컬을 옛것으로 되돌린다
    const other = mkEnv(); other.LS.setItem('deskFriends.slots.v1', JSON.stringify([null, mkSlot('new', { commGlb: Buffer.from('GLBDATA-new').toString('base64'), customItems:{ it1:{ name:'램프', glb: Buffer.from('ITEMGLB').toString('base64') } } }), null, null, null]));
    other.now = e.now + 60_000;                            // other 가 60초 뒤에 저장했다고 치자
    await other.m.load(); other.m.save(); await other.m.sync('boot');
    chk(other.writes.length === 1 && other.glbUploads.length === 2 && other.glbUploads.some(k=>/^comm_/.test(k)) && other.glbUploads.some(k=>/^item_/.test(k)), '  (준비) 다른 기기가 커미션 GLB·커스텀 아이템 GLB 를 slotglb 로 올리고 push 했다');
    chk(Object.values(other.writes[0].s).every(js => { const o = JSON.parse(js); return typeof o.commGlbUrl === 'string' && !('commGlb' in o) && o.customItems.it1.glbUrl && !('glb' in o.customItems.it1); }), '  (준비) 페이로드에는 GLB 원문 대신 URL 만');
    e.srv = other.srv; e.urlToData = other.urlToData;      // 같은 서버·같은 Storage
    await e.m.sync('boot');
    const ls2 = JSON.parse(e.LS.getItem('deskFriends.slots.v1'));
    if(e.warns.length) say('    warns: ' + e.warns.join(' | '));
    chk(e.fullReads === 1 && e.writes.length === 0, '★ 서버가 최신이면 본문을 읽고 쓰기는 안 한다');
    chk(ls2[0] === null && ls2[1] && ls2[1].face === D('newF') && ls2[1].blink === D('newB'), '★ localStorage 가 서버 것으로 바뀌었다 — 얼굴은 URL 에서 dataURL 로 되돌아왔다');
    chk(ls2[1].commGlb === Buffer.from('GLBDATA-new').toString('base64') && ls2[1].customItems.it1.glb === Buffer.from('ITEMGLB').toString('base64'), '  GLB 도 base64 로 되돌아왔다(loadSlots 가 서버 형식을 몰라도 된다)');
    chk(e.m.slots[0] === null && e.m.slots[1] && e.m.slots[1].face === D('newF'), '★ 메모리 slots 도 갈아 끼웠다 — 안 그러면 다음 saveSlots 가 옛 메모리로 원본을 덮고 더 새 ts 로 올린다');
    chk(e.m.ts() === other.now, '  로컬 ts = 서버 ts (새로 찍지 않는다)');
    chk(e.toasts.length === 1 && /받아왔어요/.test(e.toasts[0]) && e.launcherRender === 1, '  안내 한 번 + 런처 다시 그림');
    const tsBefore = e.m.ts(), timersBefore = e.timers.length;
    e.m.save();
    chk(e.m.ts() === tsBefore && e.timers.length === timersBefore, '★ 받은 직후 saveSlots 가 돌아도 ts 그대로·push 예약 없음 (문자열이 같다 — 핑퐁 차단)');
    await e.m.sync('tick');
    chk(e.writes.length === 0, '  다음 판에도 쓰기 0');

    /* ③ 로컬이 최신 → push */
    say('· ③ 로컬이 최신 → push');
    e = mkEnv();
    e.srv = { ts: e.now - 1000, s: { '0': JSON.stringify({ skin:0, faceUrl:'https://st/x', blinkUrl:'https://st/y' }) } };
    e.LS.setItem('deskFriends.slots.v1', JSON.stringify([mkSlot('mine'), null, null, null, null]));
    e.m.seen(e.srv.ts);                                     // ⚖️ 서버의 그 1칸은 이 기기가 본 것 — 그 뒤에 고쳤다
    await e.m.load(); e.m.save();
    await e.m.sync('boot');
    chk(e.writes.length === 1 && e.fullReads === 0 && JSON.parse(e.writes[0].s['0']).faceUrl.includes('roomface_face_'), '★ 로컬 ts 가 크면 본문 안 읽고 내 것을 올린다');

    /* ④ 연동 pull — 로컬이 더 새로워도 저쪽 것 */
    say('· ④ 연동(transfer, pull) — ts 안 보고 저쪽 계정 것');
    e = mkEnv();
    const far = mkEnv(); far.LS.setItem('deskFriends.slots.v1', JSON.stringify([mkSlot('acct'), null, null, null, null])); await far.m.load(); far.m.save(); await far.m.sync('boot');
    e.srv = far.srv; e.urlToData = far.urlToData;
    e.LS.setItem('deskFriends.slots.v1', JSON.stringify([null, mkSlot('local'), null, null, null]));
    await e.m.load(); e.now = far.now + 999_999; e.m.save();   // 로컬이 훨씬 새롭다
    await e.m.sync('transfer', 'pull');
    const ls4 = JSON.parse(e.LS.getItem('deskFriends.slots.v1'));
    chk(ls4[0] && ls4[0].face === D('acctF') && ls4[1] === null && e.writes.length === 0, '★ pull 은 이 기기가 더 새로워도 저쪽 계정 것으로 덮는다(가챠와 같다)');
    e = mkEnv();
    e.LS.setItem('deskFriends.slots.v1', JSON.stringify([null, mkSlot('local'), null, null, null]));
    await e.m.load(); e.m.save();
    await e.m.sync('transfer', 'pull');
    chk(e.writes.length === 1 && Object.keys(e.writes[0].s).join(',') === '1', '  저쪽이 비어 있으면 내 것을 올린다(캐릭터 증발 방지)');

    /* ⑤ 생성기가 열려 있으면 이번 판은 건너뛴다 */
    say('· ⑤ 서버가 최신인데 생성기가 열려 있다');
    e = mkEnv(); e.srv = far.srv; e.urlToData = far.urlToData;
    e.LS.setItem('deskFriends.slots.v1', JSON.stringify([mkSlot('edit'), null, null, null, null]));
    await e.m.load(); e.now = far.now - 1000; e.m.save(); e.m.seen(e.m.ts());   // 로컬 ts 가 서버보다 옛것(미래 ts 치유 폭 안) · 올라가 있던 것
    e.m.setCreator(true);
    await e.m.sync('tick');
    chk(JSON.parse(e.LS.getItem('deskFriends.slots.v1'))[0].face === D('editF') && e.fullReads === 0 && e.writes.length === 0, '★ 생성기 열림 → 받지도 올리지도 않는다(편집 중인 칸을 뺏지 않는다)');
    e.m.setCreator(false);
    await e.m.sync('tick');
    chk(JSON.parse(e.LS.getItem('deskFriends.slots.v1'))[0].face === D('acctF'), '  닫히면 다음 판에서 받는다');

    /* ⑥ _imgBroken — 메모리는 빈 캔버스, 원본은 멀쩡 → 올라가는 것은 원본 */
    say('· ⑥ _imgBroken 칸 — 원본이 올라간다');
    e = mkEnv();
    e.LS.setItem('deskFriends.slots.v1', JSON.stringify([mkSlot('orig'), null, null, null, null]));
    await e.m.load();
    e.m.slots[0].face = { toDataURL: () => D('BLANK') };   // 부팅 때 복원 실패해 빈 캔버스가 붙은 상태
    e.m.slots[0]._imgBroken = ['얼굴'];
    e.m.save();
    chk(JSON.parse(e.LS.getItem('deskFriends.slots.v1'))[0].face === D('origF'), '  (전제) saveSlots 는 그 칸을 건너뛰어 원본을 지킨다');
    e.LS.setItem('deskFriends.slots.ts', String(e.now));
    await e.m.sync('boot');
    const up6 = e.uploads.filter(k => /^face_/.test(k));
    const sentFace = up6.length ? e.urlToData.get('https://st/roomface_' + up6[0] + '.png') : null;
    chk(e.writes.length === 1 && sentFace === D('origF'), '★ push 는 메모리가 아니라 localStorage 원본을 올린다 — 빈 캔버스가 서버에 굳지 않는다');
    chk(!/BLANK/.test(JSON.stringify([...e.urlToData.values()])), '  빈 그림은 Storage 에도 안 올라갔다');

    /* ⑦ saveSlots — 바뀐 저장만 ts·push */
    say('· ⑦ saveSlots — 바뀐 저장만 ts 를 찍고 push 를 예약한다');
    e = mkEnv();
    e.LS.setItem('deskFriends.slots.v1', JSON.stringify([mkSlot('s'), null, null, null, null]));
    await e.m.load();
    e.timers.splice(0, e.timers.length);                   // 블록 평가 때 잡힌 부팅 4.6초 타이머는 여기 관심사가 아니다
    e.now = 100; e.m.save();
    chk(e.m.ts() === 100 && e.timers.length === 1 && e.timers[0].ms === 3000, '  첫 저장(내용 다름) → ts=지금 · 3초 뒤 push 예약');
    e.now = 200; e.m.save();
    chk(e.m.ts() === 100 && e.timers.length === 1, '★ 같은 내용 재저장 → ts 그대로 · 예약 없음(가챠 정리 등 헛저장이 «최신» 을 만들지 않는다)');
    e.m.slots[0].top = '#abc'; e.now = 300; e.m.save();
    chk(e.m.ts() === 300 && e.timers.length === 2, '  내용이 바뀌면 다시 찍고 예약');
    e.timers[1].fn(); await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
    chk(e.writes.length === 1 && JSON.parse(e.writes[0].s['0']).top === '#abc', '  예약된 push 가 바뀐 내용을 올린다');

    /* ⑧ 업로드 실패 → 이번 push 를 접는다(얼굴 없는 캐릭터를 올리지 않는다) — 정적으로 본다 */
    say('· ⑧ Storage 업로드 실패 / 상한 초과');
    const fToSrv = grabFn(SRC, '_slotToServerObj', 'async function ') || '';
    const fPush = grabFn(SRC, '_slotsPushToServer', 'async function ') || '';
    chk((fToSrv.match(/if\(!url\) return null;/g) || []).length >= 4, '★ 얼굴·커미션·책상·아이템 어느 하나라도 못 올리면 null(칸을 얼굴 없이 올리지 않는다)');
    chk(/if\(!so\)\{[^}]*return false;/.test(fPush), '  push 는 그 null 을 보고 이번 쓰기를 접는다');
    chk(/js\.length > SLOT_JSON_MAX/.test(fPush), '  규칙 상한을 넘는 칸도 접는다(서버가 거부할 쓰기를 보내지 않는다)');
    chk(/_warnServerWriteDenied\('캐릭터'\)/.test(fPush), '  쓰기 거부는 _warnServerWriteDenied 로(구글 연동 안내)');
    chk(!/slotToObj\(/.test(fPush) && /localStorage\.getItem\(LS_KEY\)/.test(fPush), '★ push 는 메모리 slots 를 직렬화하지 않고 localStorage 원본을 읽는다(정적 근거)');

    /* ⑨ 🛟 덮어쓰기 백업 (제보 3-7 · 2026-09-18) — 통째 교체 직전에 직전 저장본 한 벌 */
    say('· ⑨ 🛟 덮어쓰기 백업 — 5칸이 1칸으로 바뀌어도 되돌릴 자리가 있다');
    const BAK = 'deskFriends.slots.bak', BAKM = 'deskFriends.slots.bak.meta', LSK = 'deskFriends.slots.v1';
    const five = () => JSON.stringify([mkSlot('h1'), mkSlot('h2'), mkSlot('h3'), mkSlot('h4'), mkSlot('h5')]);
    /* 회사 PC(1칸)가 서버에 올려 둔 상태를 만든다 */
    const office = mkEnv();
    office.LS.setItem(LSK, JSON.stringify([mkSlot('office'), null, null, null, null]));
    await office.m.load(); office.m.save(); await office.m.sync('boot');
    const mkHome = () => { const h = mkEnv(); h.srv = office.srv; h.urlToData = office.urlToData; h.now = office.now + 60_000; return h; };

    if(!office.m.filled || !office.m.restore){
    chk(false, '★ 덮어쓰기 백업이 없다 — _slotsAdoptFromServer 는 통째 교체인데 되돌릴 자리가 없다(제보 3-7: 집 PC 5칸이 회사 PC 1칸으로)');
    }else{
    let h = mkHome();
    h.LS.setItem(LSK, five());
    const fiveRaw = h.LS.getItem(LSK);
    await h.m.load(); h.LS.setItem('deskFriends.slots.ts', String(office.now - 10_000));   // 서버가 더 새롭다
    await h.m.sync('tick');
    chk(h.m.filled(h.LS.getItem(LSK)) === 1, '  (전제) 서버가 최신이라 5칸이 1칸으로 **통째 교체**됐다 — 병합이 아니다');
    chk(h.LS.getItem(BAK) === fiveRaw, '★ 덮기 직전 저장본이 백업 키에 **문자열 그대로** 남았다(되돌리기가 곧 맞바꾸기가 된다)');
    const meta1 = JSON.parse(h.LS.getItem(BAKM) || 'null') || {};
    chk(meta1.from === 5 && meta1.to === 1 && meta1.uid === 'u1', '  메타에 몇 칸→몇 칸·어느 계정인지가 남는다(문구 개정이 읽을 재료)');
    chk(h.warns.some(w => /5개가 .*1개로 바뀌었습니다/.test(w)), '★ 칸이 줄면 흔적을 남긴다 — 화면 문구는 아직 «받아왔어요» 하나다(할 것 2 · 시안 대기)');
    chk(h.toasts.length === 1 && /5개가 .*1개로 바뀌었어요/.test(h.toasts[0]) && /되돌릴 수 있어요/.test(h.toasts[0]), '  ★ 칸이 줄면 문구가 다르다 — «바뀌었어요 · 되돌릴 수 있어요» (3-7-2 시안 확정 · 개정 31). 늘거나 같으면 예전 «받아왔어요»');

    /* 같은 내용으로 pull 이 또 돌아도 백업을 갈아 끼우지 않는다 — 여기가 백업을 잃는 가장 쉬운 길이다 */
    await h.m.sync('transfer', 'pull');
    chk(h.LS.getItem(BAK) === fiveRaw, '★ 같은 내용으로 또 채택돼도 5칸 백업이 1칸으로 덮이지 않는다(prevRaw === nextStr 이면 안 남긴다)');

    /* 그 뒤의 평범한 1칸 교체도 더 큰 백업을 못 덮는다 */
    const office2 = mkEnv();
    office2.LS.setItem(LSK, JSON.stringify([null, mkSlot('office2'), null, null, null]));
    await office2.m.load(); office2.m.save(); await office2.m.sync('boot');
    h.srv = office2.srv; h.urlToData = office2.urlToData; h.now = office2.now + 1000;
    await h.m.sync('transfer', 'pull');
    chk(h.m.filled(h.LS.getItem(LSK)) === 1 && h.LS.getItem(BAK) === fiveRaw, '★ 1칸→1칸 교체는 백업을 건드리지 않는다 — 잃은 5칸이 하찮은 것에 덮이지 않는다');

    /* 로컬이 비어 있으면 남길 게 없다 */
    let e9 = mkEnv(); e9.srv = office.srv; e9.urlToData = office.urlToData;
    await e9.m.sync('transfer', 'pull');
    chk(e9.LS.getItem(BAK) === null && e9.m.filled(e9.LS.getItem(LSK)) === 1, '  빈 기기가 처음 받아올 때는 백업을 만들지 않는다(남길 게 없다)');

    /* 되돌리기 — 맞바꾸기 · 시각을 지금으로 찍어 다음 동기화가 또 안 덮는다 */
    h.now = office2.now + 5000;
    const okR = await h.m.restore();
    chk(okR === true && h.LS.getItem(LSK) === fiveRaw, '★ restoreSlotsBackup() 이 5칸을 되돌린다');
    chk(h.m.filled(h.LS.getItem(BAK)) === 1, '  맞바꾸기다 — 방금까지 쓰던 1칸이 백업 자리로 들어간다(한 번 더 부르면 도로 돌아온다)');
    chk(h.m.slots[0] && h.m.slots[4] && h.launcherRender > 0, '  메모리 slots 와 화면도 같이 되돌아온다');
    chk(h.m.ts() === h.now && h.m.ts() > office2.srv.ts, '★ 되돌린 뒤 ts 를 지금으로 찍는다 — 안 찍으면 다음 판이 서버 것으로 **또 덮어** 30분 뒤에 사라진다');
    const w9 = h.writes.length;
    await h.m.sync('tick');
    chk(h.writes.length === w9 + 1 && Object.keys(h.writes[h.writes.length - 1].s).length === 5, '  되돌린 5칸이 서버로 올라간다(다른 기기도 되찾는다)');
    await h.m.restore();
    chk(h.m.filled(h.LS.getItem(LSK)) === 1 && h.LS.getItem(BAK) === fiveRaw, '  한 번 더 부르면 도로 맞바뀐다(되돌리기 자체를 되돌릴 수 있다)');

    /* 다른 계정의 백업은 안 준다 — 이 키는 로그아웃 때 안 지워지므로 대조가 유일한 방벽이다 */
    h.uid = 'u2';
    const okOther = await h.m.restore();
    chk(okOther === false && h.m.filled(h.LS.getItem(LSK)) === 1, '★ 백업의 uid 가 지금 계정과 다르면 되돌리지 않는다(남의 캐릭터를 주워 가는 길을 막는다)');
    chk(await h.m.restore(true) === true, '  그래도 필요하면 restoreSlotsBackup(true) — 출구는 남긴다');

    /* 백업이 실패해도 채택은 그대로 진행한다 */
    let e10 = mkEnv(); e10.srv = office.srv; e10.urlToData = office.urlToData;
    e10.LS.setItem(LSK, five());
    await e10.m.load(); e10.LS.setItem('deskFriends.slots.ts', String(office.now - 10_000));
    const rawSet = e10.LS.setItem;
    e10.LS.setItem = (k, v) => { if(k === BAK) throw new Error('quota'); return rawSet(k, v); };
    await e10.m.sync('tick');
    chk(e10.m.filled(e10.LS.getItem(LSK)) === 1 && e10.LS.getItem(BAK) === null, '★ 백업을 못 남겨도 채택은 막지 않는다 — 백업이 «캐릭터가 안 따라온다» 를 새로 만들면 안 된다');
    chk(e10.warns.some(w => /백업을 남기지 못했습니다/.test(w)), '  대신 콘솔에 남긴다');

    /* 저장 공간이 모자라면 백업을 물리고 다시 적는다(채택이 영영 막히지 않는다) */
    let e11 = mkEnv(); e11.srv = office.srv; e11.urlToData = office.urlToData;
    e11.LS.setItem(LSK, five());
    await e11.m.load(); e11.LS.setItem('deskFriends.slots.ts', String(office.now - 10_000));
    const rawSet2 = e11.LS.setItem;
    e11.LS.setItem = (k, v) => { if(k === LSK && e11.ls.has(BAK)) throw new Error('quota'); return rawSet2(k, v); };
    await e11.m.sync('tick');
    chk(e11.m.filled(e11.LS.getItem(LSK)) === 1 && e11.LS.getItem(BAK) === null, '★ 백업 탓에 본문 쓰기가 막히면 백업을 물리고 한 번만 다시 적는다(예전 동작으로 되돌아간다)');

    /* 정적 — 지움 목록과 콘솔 통로 */
    const bakList = (SRC.match(/const ACCOUNT_LOCAL_KEYS = \(\)=>\[([\s\S]*?)\n\];/) || [])[1] || '';
    chk(!!bakList && !/^\s*SLOTS_BAK_KEY,/m.test(bakList) && !/[^_]SLOTS_BAK_KEY[,\s]/.test(bakList.replace(/\/\*[\s\S]*?\*\//g, '')), '★ SLOTS_BAK_KEY 가 ACCOUNT_LOCAL_KEYS 에 **없다** — 서버에 없는 것을 그 목록에 넣으면 로그아웃이 곧 삭제다');
    chk(/SLOTS_BAK_KEY[\s\S]{0,400}?일부러 빼 두었다/.test(bakList) || /일부러 빼 두었다/.test(bakList), '  빠뜨린 것이 아니라는 근거가 그 자리에 적혀 있다(다음 사람이 넣지 않게)');
    chk(/window\.slotsBackupInfo = slotsBackupInfo/.test(SRC) && /window\.restoreSlotsBackup = restoreSlotsBackup/.test(SRC), '  F12 콘솔에서 부를 수 있다(화면 버튼 전까지의 출구)');
    }

    /* ⑩ 🔑 내용 해시 (제보 3-7 (나) · 2026-09-18) — 이 값이 곧 파일 이름이다 */
    say('· ⑩ 🔑 내용 해시 — 다른 그림이 같은 파일 이름을 받지 않는다');
    const e12 = mkEnv();
    const H = e12.m.hash;
    const bigA = 'data:image/png;base64,' + 'ABCDEFG'.repeat(5000);
    const bigB = bigA.slice(0, 101) + 'X' + bigA.slice(102);   // 7의 배수가 아닌 자리 한 글자만 다르다
    const oldHash = s => { let h = 5381; for(let i = 0; i < s.length; i += 7) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36) + '.' + s.length; };
    chk(bigA.length === bigB.length && oldHash(bigA) === oldHash(bigB), '  (전제) 이 두 그림은 **옛 해시로는 같은 값**이었다 — 그래서 같은 파일에 덮어써졌다');
    chk(H(bigA) !== H(bigB), '★ 한 글자만 달라도 해시가 다르다 — 7글자마다 한 번이 아니라 전수로 본다');
    chk(H(bigA) === H(bigA) && H(bigB) === H(bigB), '  같은 그림은 늘 같은 해시(캐시가 성립하려면 결정적이어야 한다)');
    chk(/^h2/.test(H(bigA)), '★ 접두어 h2 — 옛 이름과 겹치지 않는다(겹치면 새 이름이 옛 충돌 파일을 물려받는다)');
    /* ⚠️ uploadRoomFace 가 파일 이름에서 [^a-zA-Z0-9_-] 를 전부 지운다 — 옛 «{해시}.{길이}» 는
       점이 지워진 채 올라가 서로 다른 두 해시가 같은 이름이 될 수 있었다(제보 자료의
       roomface_face_2irv4n63142.png 가 그 모습이다). */
    const sane = x => String(x).replace(/[^a-zA-Z0-9_-]/g, '');
    chk(sane(H(bigA)) === H(bigA), '★ 업로더의 이름 정제기를 통과해도 해시가 한 글자도 안 변한다 — 파일 이름이 곧 해시다');
    chk(sane(H(bigA)) !== sane(H(bigB)), '★ 정제한 뒤에도 두 그림의 이름이 다르다(구분 기호가 지워져 합쳐지지 않는다)');
    chk(/^h2[0-9a-z]{14}[0-9a-z]+$/.test(H(bigA)), '  두 누산기를 36진수 7자리 고정폭으로 적는다 — 경계가 자리로 정해진다');
    const seen = new Set();
    for(let i = 0; i < 300; i++){ const s = bigA.slice(0, 500 + i) + String(i) + bigA.slice(500 + i); seen.add(H(s)); }
    chk(seen.size === 300, '  길이·앞부분이 비슷한 300장이 전부 다른 이름을 받는다');

    /* 업로드 — 같은 그림은 한 번, 한 글자 다른 그림은 **다른 파일**로 */
    const st12 = e12.m.cacheLoad();
    const u1 = await e12.m.faceUrlOne('u1', st12, 'face', bigA);
    const u1b = await e12.m.faceUrlOne('u1', st12, 'face', bigA);
    const u2 = await e12.m.faceUrlOne('u1', st12, 'face', bigB);
    chk(u1 === u1b && e12.uploads.length === 2, '  같은 그림은 두 번 올라가지 않는다(캐시는 그대로 돈다)');
    chk(u1 !== u2, '★ 옛 해시로 충돌하던 두 그림이 **서로 다른 파일**로 올라간다 — 덮어쓰기가 사라진다');

    /* 캐시 상한 — 전환기에 통째로 비우지 않는다(비우면 Class A 를 두 번 치른다) */
    const e13 = mkEnv();
    const pre = {};
    for(let i = 0; i < 40; i++) pre['face:' + i.toString(36) + '.1234'] = 'https://st/old' + i + '.png';   // 구형
    for(let i = 0; i < 25; i++) pre['face:h2' + i.toString(36) + '.z.1234'] = 'https://st/new' + i + '.png';
    e13.LS.setItem('tw.roomFaceUrls', JSON.stringify(pre));
    const kept = e13.m.cacheLoad();
    const keptKeys = Object.keys(kept);
    chk(keptKeys.length === 25 && keptKeys.every(k => /:h2/.test(k)), '★ 상한을 넘으면 **구형 항목부터** 버린다 — 통째로 비우면 방금 올린 새 파일까지 잊고 전원이 또 올린다');
    chk(kept['face:h20.z.1234'] === 'https://st/new0.png', '  새 항목은 URL 그대로 남는다');

    /* 구형 항목을 조회에 쓰지 않는다 — 옛 해시가 같다는 것은 «그림이 같다» 가 아니다 */
    chk(/const ck = key \+ ':' \+ h;/.test(fOne) && !/h1|old|구형/.test(fOne.replace(/\/\*[\s\S]*?\*\//g, '')), '★ 업로더는 새 키 하나만 본다 — 옛 키로 URL 을 물려주면 이 제보가 그대로 재현된다');
    const fPic = grabFn(SRC, 'uploadPartPic', 'async function ') || '';
    chk(/_roomFaceCacheLoad\(\)/.test(fPic) && /_roomFaceCacheSave\(st\)/.test(fPic), '  파츠 그림도 얼굴과 **같은 캐시 규칙**을 쓴다(같은 저장 키를 쓰면서 혼자 통째로 비우던 자리)');

    /* ⑪ 🖼️ 되받기 (제보 3-7 (다) · 2026-09-18) — 서버에 있는 그림이 그대로 돌아오는가 */
    say('· ⑪ 🖼️ 되받기 — 512 가 아닌 텍스처가 잘리거나 구석에 몰리지 않는다');
    const fToCanvas = grabFn(SRC, '_roomFaceUrlToCanvas', 'async function ');
    const fFetchImg = grabFn(SRC, '_fetchImgDataUrl', 'async function ');
    if(!fToCanvas || !fFetchImg){
    chk(false, '★ 되받기 함수를 못 떼어 옴 (_roomFaceUrlToCanvas · _fetchImgDataUrl)');
    }else{
    chk(!/_roomFaceUrlToCanvas/.test(fFetchImg), '★ 되받기가 **캔버스를 거치지 않는다** — 거치면 512 가 아닌 그림이 그 자리에서 잘린다');
    const rec = { drawn: [], made: [] };
    const store = new Map();
    const mk = new Function('rec', 'store', [
      "const CANVAS_SZ=512;",
      "const newCanvas=()=>{ const c={ width:CANVAS_SZ, height:CANVAS_SZ, getContext:()=>({ drawImage:(im,x,y)=>rec.drawn.push({ cw:c.width, ch:c.height, iw:im.naturalWidth, x, y }) }), toDataURL:()=>'data:image/png;base64,zzzz' }; rec.made.push(c); return c; };",
      "const _loadImgCors=async(u)=>{ const e=store.get(u); return { naturalWidth:e.w, naturalHeight:e.h }; };",
      "const fetch=async(u)=>{ const e=store.get(u); if(!e) return { ok:false, status:404 }; const m=/^data:([^;]+);base64,(.*)$/.exec(e.body); const buf=Buffer.from(m?m[2]:e.body,'base64'); return { ok:true, headers:{ get:(k)=>(/content-type/i.test(k)&&e.type!==null)?(e.type||(m?m[1]:null)):null }, arrayBuffer:async()=>buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength) }; };",
      "const btoa=(s)=>Buffer.from(s,'binary').toString('base64');",
      fToCanvas, fFetchImg,
      "return { toCanvas:_roomFaceUrlToCanvas, toData:_fetchImgDataUrl };",
    ].join('\n'));
    const R = mk(rec, store);

    store.set('u256', { w: 256, h: 256, body: 'data:image/png;base64,QUJDRA==', type: null });
    store.set('u1024', { w: 1024, h: 1024, body: 'data:image/png;base64,QUJDRA==', type: null });
    store.set('u0', { w: 0, h: 0, body: 'data:image/png;base64,QUJDRA==', type: null });
    const c256 = await R.toCanvas('u256');
    chk(c256.width === 256 && c256.height === 256, '★ 256 짜리 텍스처는 256 캔버스로 돌아온다 — 512 에 그리면 왼쪽 위 1/4 에 몰린다(공유 코드 텍스처가 CODE_TEX_SIZE=256)');
    const c1024 = await R.toCanvas('u1024');
    chk(c1024.width === 1024 && c1024.height === 1024, '★ 1024 짜리도 안 잘린다 — 512 에 그리면 오른쪽·아래가 사라진다');
    chk(rec.drawn.every(d => d.x === 0 && d.y === 0 && d.cw === d.iw), '  그림은 (0,0)에 원래 크기로 놓이고, 캔버스가 거기에 맞춰진다');
    const c0 = await R.toCanvas('u0');
    chk(c0.width === 512, '  크기를 못 읽으면 예전처럼 512 (물러날 자리)');

    const before = rec.drawn.length;
    const got = await R.toData('u256');
    chk(got === 'data:image/png;base64,QUJDRA==', '★ 되받은 dataURL 이 **한 바이트도 안 변한다** — 서버에 있는 것을 그대로 가져오는 게 이 함수의 일이다');
    chk(rec.drawn.length === before, '  되받으면서 아무 데도 그리지 않는다(다시 인코딩하지 않으니 화질도 안 깎인다)');
    store.set('uNoType', { w: 256, h: 256, body: 'data:image/png;base64,QUJDRA==', type: null });
    chk(/^data:image\/png;base64,/.test(await R.toData('uNoType')), '  content-type 이 없으면 image/png 로 적는다');
    let threw = false;
    try{ await R.toData('없는주소'); }catch(_){ threw = true; }
    chk(threw, '★ 실패는 예전처럼 던진다 — _slotFromServerObj 가 그걸 보고 이번 채택을 접는다(빈 그림이 저장되면 안 된다)');
    }

    /* ── 4. 배선 ── */
    say('── 4. 배선');
    const rest = grabFn(SRC, '_restoreOwnedDataAfterTransfer', 'async function ') || '';
    const gi = rest.indexOf("syncGachaToServer('transfer', 'pull')"), si = rest.indexOf("syncSlotsToServer('transfer', 'pull')");
    chk(si > 0, '★ 연동 통로(_restoreOwnedDataAfterTransfer)가 슬롯 pull 을 부른다 — 계정 이전·구글 로그인 둘 다 이 함수 하나');
    chk(gi > 0 && si > gi, '  가챠 pull 다음이다(받은 캐릭터가 입은 파츠 보유분이 먼저)');
    chk(/setTimeout\(\(\)=>\{ try\{ syncSlotsToServer\('boot'\); \}catch\(_\)\{\} \}, 4600\);/.test(SRC), '  부팅 4.6초(가챠 4.2초 다음) 1회');
    chk(/setInterval\(\(\)=>\{ try\{ syncSlotsToServer\('tick'\); \}catch\(_\)\{\} \}, SLOTS_SYNC_INTERVAL_MS\);/.test(SRC) && /SLOTS_SYNC_INTERVAL_MS = 30\*60\*1000/.test(SRC), '  30분 주기(ts 한 값)');
    chk(/if\(_str !== null && _str !== prevRaw\)\{/.test(fSave) && /_slotsSchedulePush\(\)/.test(fSave), '  saveSlots 는 문자열이 달라졌을 때만 push 를 예약한다');
    const ensure = grabFn(SRC, 'ensureRoomFaceUrls', 'async function ') || '';
    chk(/_roomFaceCacheLoad\(\)/.test(ensure) && /_storageFaceUrlOne\(uid, st, key, cv\)/.test(ensure) && /_roomFaceCacheSave\(st\)/.test(ensure), '  방 입장 업로드가 같은 캐시·같은 업로더를 쓴다(같은 그림은 두 번 안 올라간다)');
    chk(/\['face','face'\], \['blink','blink'\]/.test(SRC) && /\['animalBody','aBody'\]/.test(SRC) && /\['animalEarBlinkL','aEarLB'\]/.test(SRC), '  슬롯 얼굴 키가 방 입장 키와 같다(face·blink·aBody·aEarL·aEarR·aEarLB·aEarRB·aBlink)');

    say('');
    say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs);
    process.exit(fail ? 1 : 0);
  })().catch(err => { say('  ✗ 예외: ' + (err && err.stack || err)); fail++; say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs); process.exit(1); });
}
if(!fs.existsSync('app.js')) process.exit(2);

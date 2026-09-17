/* ═══ ☁️ sim-slot-sync.js — 슬롯(캐릭터) 기기 간 동기화 (제보 6-b · 2026-09-16) ═══════════════
   [무엇을 지키나] 슬롯은 localStorage 에만 있고 서버 노드가 없어서 «회사에서 만든 캐릭터가 집 PC 에
     없다» 가 기능 부재였다. 이번에 users/{uid}/slots 노드 + 병합 + 규칙 블록이 생겼다.
   ・1절: firebase-init — ts 만 읽는 통로가 따로 있고, 쓰기는 auth 대기선을 지나 통째 set 한다.
   ・2절: 규칙 파일 — users/$userId/slots 블록 · gacha 와 같은 .write · 칸마다 길이 상한 + base64 금지.
   ・3절: app.js 본문을 떼어 와 돌린다 — 병합 진리표(서버 비움/로컬 비움/양쪽 있음/연동 pull),
          _imgBroken 칸은 원본이 올라간다, 서버 페이로드에 dataURL·thumb·GLB 원문이 없다, 되받으면
          원래 저장본과 같은 문자열이라 saveSlots 가 도로 올리지 않는다.
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
  const D = t => 'data:image/png;base64,' + (t + '_').repeat(60);   // 해시가 7칸 간격 표본이라 태그를 문자열 전체에 펼친다
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
      "const fetch=async(url)=>{ const b=env.urlToData.get(url); if(!b) return { ok:false, status:404 }; const buf=Buffer.from(b,'base64'); return { ok:true, arrayBuffer:async()=>buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength) }; };",
      "const btoa=(s)=>Buffer.from(s,'binary').toString('base64');",
      /* 로컬 저장본을 그대로 메모리에 — 그림은 문자열인 채로 둔다(slotToObj 가 data: 문자열을 통과시킨다) */
      "async function loadSlots(){ let arr; try{ arr=JSON.parse(localStorage.getItem(LS_KEY)||'null'); }catch(_){ return; } if(!Array.isArray(arr)) return; for(let i=0;i<CHAR_SLOT_MAX;i++){ if(arr[i]) slots[i]=Object.assign({}, arr[i]); } }",
    ].join('\n');
    const body = [fHash, fCL, fCS, fOne, fImg, fSlotToObj, fSave, block].join('\n');
    const f = new Function('env', 'localStorage', 'window', 'firebaseAPI', decl + '\n' + body +
      "\nreturn { sync:syncSlotsToServer, save:saveSlots, slots, ts:()=>_slotsTs, setCreator:(v)=>{ creatorOpen=v; }, push:_slotsPushToServer, load:loadSlots, faceMem:_faceEverDrawn };");
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
    chk(e.uploads.length === 4 && e.uploads.every(k => /^(face|blink)_/.test(k)), '  얼굴·감은눈 4장이 roomface 규칙 이름(face_{hash})으로 올라갔다 — 방 입장과 같은 파일');
    chk(Object.values(e.writes[0].s).every(noData), '★ 서버 페이로드 어디에도 dataURL 이 없다');
    chk(Object.values(e.writes[0].s).every(js => !('thumb' in JSON.parse(js)) || JSON.parse(js).thumb == null), '  thumb 은 안 올라간다');
    const n0 = { w: e.writes.length, f: e.fullReads, t: e.tsReads };
    await e.m.sync('tick');
    chk(e.tsReads === n0.t + 1 && e.fullReads === n0.f && e.writes.length === n0.w, '★ 바뀐 게 없는 다음 판은 ts 한 값 읽기로 끝 — 본문 읽기 0 · 쓰기 0');

    /* ② 서버가 최신 → 받아 적고, 메모리·ts 도 갈아 끼우고, 되저장해도 도로 안 올린다 */
    say('· ② 서버가 최신 → adopt (localStorage + 메모리 + ts) · 되저장은 핑퐁 없음');
    e = mkEnv();
    e.LS.setItem('deskFriends.slots.v1', JSON.stringify([mkSlot('old'), null, null, null, null]));
    await e.m.load(); e.m.save();
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
    await e.m.load(); e.now = far.now - 1000; e.m.save();   // 로컬 ts 가 서버보다 옛것(미래 ts 치유 폭 안)
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

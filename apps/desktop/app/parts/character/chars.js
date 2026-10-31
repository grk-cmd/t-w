/* chars.js — 🧬 캐릭터 보관함(chars) — 캐릭터 단위 병합(순수) · slots → chars 이관 · 이관 조율(서버 쓰기 · 미리보기)
   app.js «🧬 캐릭터 단위 병합 — 순수 함수» · «🧬 이관 — slots → chars» · «🧬 이관 조율 — 서버 쓰기 + 미리보기» 세 구역의 본문을 그대로 옮긴 모듈이다
   (앱 FSD 18번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다. 세 구역은 한 도메인(캐릭터 보관함 · 계정 단위 캐릭터)이라 한 파일에 둔다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 3개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 4줄 —
     _slotsTs · creatorOpen 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 17개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 아래층(slot-save · slot-sync)에 알림을 건다(모듈 순환 끊기 3) — 저장 뒤 _charsAfterSave · 백업 되돌린 뒤 _charsRemapDesk · 켜졌나 _charsActive.
     칸을 갈아 끼운 뒤 캐릭터 탭은 slotsReplaced() 로 알리고, 부팅 채택 뒤 «연동됨» 안내는 onBootLinked(fn) 에 위층(계정)이 건다.
   ★ 밖에서 부르는 이름: CHARS_BOX_MAX · CHARS_SYNC_ENABLED · _charsActive · _charsAfterSave · _charsBoot · _charsBoxFull · _charsBoxGet · _charsBoxOnlyCount · _charsBoxToDesk · _charsBoxTrash · _charsBoxTrashMany · _charsCachedUid · _charsDeleteWords · _charsDeskGet · _charsDeskToBox · _charsEntryTime · _charsIsTomb · _charsMoveFailLog · _charsMoveMsg · _charsOnNew · _charsRemapDesk · _charsRestore · _charsSync · _charsTrashMove · _charsTrashView · onBootLinked — app.js 는 charsMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwChars — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-chars.js */
(function(){

function createChars(deps){
const CHAR_SLOT_MAX = deps.CHAR_SLOT_MAX;
const LS_KEY = deps.LS_KEY;
const MY_USER_ID_KEY = deps.MY_USER_ID_KEY;
const SLOTS_SYNC_INTERVAL_MS = deps.SLOTS_SYNC_INTERVAL_MS;
const SLOTS_TS_SKEW_TOL_MS = deps.SLOTS_TS_SKEW_TOL_MS;
const SLOT_IMG_FIELDS = deps.SLOT_IMG_FIELDS;
const SLOT_JSON_MAX = deps.SLOT_JSON_MAX;
const _blinkEverDrawn = deps._blinkEverDrawn;
const _faceEverDrawn = deps._faceEverDrawn;
const _quickHash = deps._quickHash;
const _relinkSeatsToSlots = deps._relinkSeatsToSlots;
const _roomFaceCacheLoad = deps._roomFaceCacheLoad;
const _roomFaceCacheSave = deps._roomFaceCacheSave;
const _slotFromServerObj = deps._slotFromServerObj;
const _slotGlbCacheLoad = deps._slotGlbCacheLoad;
const _slotGlbCacheSave = deps._slotGlbCacheSave;
const _slotToServerObj = deps._slotToServerObj;
const _slotsBackupSave = deps._slotsBackupSave;
const _slotsFilledCount = deps._slotsFilledCount;
const _slotsNow = deps._slotsNow;
const _slotsTs = deps._slotsTs;   // 읽는 함수
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const loadSlots = deps.loadSlots;
const renderLauncher = deps.renderLauncher;
const saveSlots = deps.saveSlots;
const slots = deps.slots;
const toast = deps.toast;
const onSaved = deps.onSaved;
const onBackupRestored = deps.onBackupRestored;
const setCharsActiveCheck = deps.setCharsActiveCheck;
const slotsReplaced = deps.slotsReplaced;
const _bootLinkedFns = [];
function onBootLinked(fn){ _bootLinkedFns.push(fn); }
const CHARS_SKEW_TOL_MS = SLOTS_TS_SKEW_TOL_MS;
function _charsNewId(){ return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function _charsEntryTime(e){
  if(!e || typeof e !== 'object') return 0;
  if(e.def != null) return Number(e.mtime) || 0;
  return Number(e.del) || 0;
}
function _charsIsTomb(e){ return !!e && typeof e === 'object' && e.def == null && typeof e.del === 'number'; }
function _charsMerge(local, server, opts){
  local = (local && typeof local === 'object') ? local : {};
  server = (server && typeof server === 'object') ? server : {};
  const now = (opts && typeof opts.now === 'number') ? opts.now : _slotsNow();
  const tol = (opts && typeof opts.skewTol === 'number') ? opts.skewTol : CHARS_SKEW_TOL_MS;
  const merged = {}, push = {}, pull = {}, trash = [], fixed = [];
  const ids = new Set(Object.keys(local).concat(Object.keys(server)));
  for(const cid of ids){
    const L = local[cid], S0 = server[cid];
    let S = S0;
    /* 🕒 미래 mtime 정정 — 서버 것만 본다(내 시계가 틀렸으면 서버에 올라간 뒤 다른 기기가 여기서 잡는다). */
    if(S && _charsEntryTime(S) > now + tol){
      S = _charsIsTomb(S) ? { del: now } : Object.assign({}, S, { mtime: now });
      fixed.push(cid);
      merged[cid] = S; push[cid] = S;
      if(L && _charsEntryTime(L) !== _charsEntryTime(S)){
        if(L.def != null) trash.push({ cid, def: L.def, mtime: _charsEntryTime(L), why: _charsIsTomb(S) ? 'deleted' : 'overwritten' });
        pull[cid] = S;
      }
      continue;
    }
    if(L && !S){ merged[cid] = L; push[cid] = L; continue; }          // 로컬에만
    if(S && !L){ merged[cid] = S; pull[cid] = S; continue; }          // 서버에만
    const lt = _charsEntryTime(L), st = _charsEntryTime(S);
    if(lt === st){ merged[cid] = S; continue; }                        // 같다 = 할 일 없음
    const win = lt > st ? L : S, lose = lt > st ? S : L;
    merged[cid] = win;
    if(lose.def != null) trash.push({ cid, def: lose.def, mtime: _charsEntryTime(lose), why: _charsIsTomb(win) ? 'deleted' : 'overwritten' });
    if(win === L) push[cid] = L; else pull[cid] = S;
  }
  return { merged, push, pull, trash, fixed };
}
try{ window._charsMerge = _charsMerge; window._charsNewId = _charsNewId; }catch(_){}

const CHARS_KEY_SCALARS = ['skin', 'top', 'bot', 'animal', 'animalFace', 'isCommission'];
const CHARS_KEY_SKIP = ['thumb', 'thumbUrl', '_imgBroken', 'cid', 'commGlb', 'commGlbUrl', 'deskGlb', 'deskGlbUrl'];
function _charsImgKey(v){
  if(typeof v !== 'string' || !v) return null;
  if(/^https?:\/\//i.test(v)){
    let p = v.split('?')[0];
    try{ p = decodeURIComponent(p); }catch(_){}
    const m = p.match(/_(h2[0-9a-z]{15,})(?:\.[a-z0-9]+)?$/);
    return m ? m[1] : 'u:' + p;        // 해시 없는 옛 이름 — 서버끼리는 맞고 로컬과는 안 맞는다(K2 가 받는다)
  }
  return _quickHash(v);
}
function _charsParseDef(def){
  if(typeof def === 'string'){ try{ def = JSON.parse(def); }catch(_){ return null; } }
  return (def && typeof def === 'object' && !Array.isArray(def)) ? def : null;
}
function _charsStable(v){
  if(Array.isArray(v)) return '[' + v.map(_charsStable).join(',') + ']';
  if(v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + _charsStable(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
function _charsKeys(def){
  const o = _charsParseDef(def);
  if(!o) return null;
  const k1 = {}, rest = {};
  for(const f of CHARS_KEY_SCALARS) k1[f] = o[f] ? o[f] : null;      // 0 · false · 없음 은 같은 것(slotToObj 의 ||0 · ||false)
  let imgs = 0;
  for(const [field] of SLOT_IMG_FIELDS){
    const h = _charsImgKey(o[field] != null ? o[field] : o[field + 'Url']);
    k1[field] = h; if(h) imgs++;
  }
  k1.commGlb = _charsImgKey(o.commGlb != null ? o.commGlb : o.commGlbUrl);
  const imgNames = new Set(CHARS_KEY_SKIP);
  for(const [field] of SLOT_IMG_FIELDS){ imgNames.add(field); imgNames.add(field + 'Url'); }
  for(const f in o){
    if(imgNames.has(f)) continue;
    if(f === 'customItems' && o.customItems && typeof o.customItems === 'object'){
      const ci = {};
      for(const id in o.customItems){ const it = o.customItems[id]; if(!it) continue; const r = Object.assign({}, it); delete r.glb; delete r.glbUrl; ci[id] = r; }
      rest.customItems = ci; continue;
    }
    if(f === 'equippedParts' && o.equippedParts){
      let eq = null; try{ eq = JSON.parse(JSON.stringify(o.equippedParts)); }catch(_){}
      const walk = v => { if(!v || typeof v !== 'object') return; if(Array.isArray(v)){ v.forEach(walk); return; }
        if(typeof v.pic === 'string') delete v.pic; for(const x in v) walk(v[x]); };
      walk(eq); rest.equippedParts = eq; continue;
    }
    rest[f] = o[f];
  }
  return { k1: imgs ? _charsStable(k1) : null, k2: _charsStable(rest) };
}
/* 후보(cid → keys) 중에서 짝을 고른다. used 는 이미 짝지어진 cid. pref 는 같은 칸 번호의 cid(있으면 먼저). */
function _charsPick(keys, pool, used, pref){
  if(!keys) return null;
  for(const which of ['k1', 'k2']){
    const want = keys[which]; if(!want) continue;
    if(pref && !used.has(pref) && pool[pref] && pool[pref][which] === want) return pref;
    for(const cid in pool){ if(!used.has(cid) && pool[cid][which] === want) return cid; }
  }
  return null;
}
/* ── ① 서버 slots(+ slotsPrev) → chars ─────────────────────────────────────────────────────────
   첫 이관(chars 비어 있음)과 이관 창의 되돌이(설계 §5-N-4 · 옛 클라이언트가 slots 를 바꿈)를 한 함수로 한다.
   · 칸마다: 산 cid 와 def 문자열이 **완전히 같으면** 그 cid(N 클라이언트는 slots 와 chars 에 같은 문자열을 쓴다).
     아니면 열쇠로 짝(산 마리 · 묘비 둘 다 후보 — 묘비와 짝지어지면 병합 규칙대로 시각이 가른다).
     짝이 있고 slots.ts 가 그 항목보다 나중이면 upd(고친 것). 짝이 없으면 add(새 cid).
   · slotsPrev: 산 것·방금 더한 것과 짝이 없는 마리만 새 cid(책상엔 안 올림). 그 뒤 slotsPrev 는 안 쓴다.
   돌려주는 것: { add, upd, deskCids[5] } — add·upd 는 cid → { def, mtime, v } 로 그대로 chars 에 쓸 수 있는 모양. */
function _charsFromServerSlots(slotsNode, prevNode, chars){
  chars = (chars && typeof chars === 'object') ? chars : {};
  const add = {}, upd = {}, deskCids = new Array(CHAR_SLOT_MAX).fill(null);
  const pool = {}, used = new Set();
  for(const cid in chars){
    const e = chars[cid]; if(!e || typeof e !== 'object') continue;
    pool[cid] = e.def != null ? (_charsKeys(e.def) || {}) : (e.keys || {});   // 묘비는 def 가 없다 → 부르는 쪽이 keys 를 달아 줄 수 있다
  }
  const ts = (slotsNode && Number(slotsNode.ts)) || 0;
  const s = (slotsNode && slotsNode.s) || {};
  for(let i = 0; i < CHAR_SLOT_MAX; i++){
    const js = s[String(i)];
    if(typeof js !== 'string' || !js) continue;
    let cid = null;
    for(const c in chars){ const e = chars[c]; if(!used.has(c) && e && e.def === js){ cid = c; break; } }
    if(cid){ used.add(cid); deskCids[i] = cid; continue; }            // 완전히 같음 — 할 일 없음
    const keys = _charsKeys(js);
    cid = _charsPick(keys, pool, used, null);
    if(cid){
      used.add(cid); deskCids[i] = cid;
      const e = chars[cid], et = e.def != null ? (Number(e.mtime) || 0) : (Number(e.del) || 0);
      if(ts > et) upd[cid] = { def: js, mtime: ts, v: 1 };
      continue;
    }
    cid = _charsNewId();
    while(chars[cid] || add[cid]) cid = _charsNewId();
    add[cid] = { def: js, mtime: ts, v: 1 };
    pool[cid] = keys || {}; used.add(cid); deskCids[i] = cid;
  }
  const pts = (prevNode && (Number(prevNode.ts) || Number(prevNode.at))) || 0;
  const ps = (prevNode && prevNode.s) || {};
  const prevUsed = new Set();                                        // 산 것과의 짝은 책상 칸과 겹쳐도 된다 — prev 끼리만 1:1
  for(let i = 0; i < CHAR_SLOT_MAX; i++){
    const js = ps[String(i)];
    if(typeof js !== 'string' || !js) continue;
    let hit = null;
    for(const c in pool){ const e = chars[c] || add[c]; if(!prevUsed.has(c) && e && e.def === js){ hit = c; break; } }
    if(!hit) hit = _charsPick(_charsKeys(js), pool, prevUsed, null);
    if(hit){ prevUsed.add(hit); continue; }
    let cid = _charsNewId();
    while(chars[cid] || add[cid]) cid = _charsNewId();
    add[cid] = { def: js, mtime: pts, v: 1 };
    pool[cid] = _charsKeys(js) || {}; prevUsed.add(cid);
  }
  return { add, upd, deskCids };
}
/* ── ② 이 기기 5칸 → 로컬 chars ────────────────────────────────────────────────────────────────
   서버 chars(①을 거친 뒤)와 짝을 지어 cid 를 물려받는다. 결과를 병합 함수에 서버 chars 와 함께 넣으면 된다.
   · 짝지어진 마리의 시각: **K2 까지 같으면(그림 표현 말고는 한 글자도 안 다름) 서버 항목의 시각을 그대로** 단다 —
     병합이 «같음» 으로 떨어져 push·pull·trash 가 없다. K2 가 다르면 localTs — 이 기기가 고쳤으면 이기고(진 서버 본은 trash),
     안 고친 기기(localTs ≤ seen)면 서버가 이긴다.
     ⚠️ 5칸 저장본은 시각이 **통째 하나**라 어느 칸을 고쳤는지 모른다. 모든 짝에 localTs 를 달면 안 고친 네 칸이
       서버 본을 휴지통에 한 벌씩 밀어 넣는다(첫 판 검사 3절이 그걸 잡았다). K2 가 그 칸 구분을 대신한다.
   · **짝 없는 마리는 버리지 않는다** — seen 부트스트랩(설계 §8-1)이 «한 번도 못 올린 기기» 를 안 고친 기기로
     보이게 할 수 있어서, clean 여부로 가르지 않는다. 짝이 없으면 localTs 로 새 cid — 3-7 제보자의 «회사 PC 1칸» 이 6마리째가 되는 자리.
   돌려주는 것: { local, deskCids[5], fresh[] } — local: cid → { def, mtime }(def 는 받은 로컬 표현 그대로) · fresh: 새로 뽑은 cid. */
function _charsFromLocalSlots(localDefs, localTs, serverChars, serverDeskCids){
  localDefs = Array.isArray(localDefs) ? localDefs : [];
  serverChars = (serverChars && typeof serverChars === 'object') ? serverChars : {};
  serverDeskCids = Array.isArray(serverDeskCids) ? serverDeskCids : [];
  localTs = Number(localTs) || 0;
  const local = {}, deskCids = new Array(CHAR_SLOT_MAX).fill(null), fresh = [];
  const pool = {}, used = new Set();
  /* 묘비는 def 가 없어 열쇠가 없다 — 부르는 쪽이 휴지통의 마지막 모습으로 `keys` 를 달아 주면 그것과도 짝짓는다(개정 35).
     안 달아 주면 다른 기기에서 지운 마리가 이 기기에서 **새 cid 로 되살아난다**(3-7 의 뒤집힌 판) — `_charsLocalAdopt` 는 달아 준다. */
  for(const cid in serverChars){
    const e = serverChars[cid]; if(!e) continue;
    if(e.def != null) pool[cid] = _charsKeys(e.def) || {};
    else if(e.keys) pool[cid] = e.keys;
  }
  for(let i = 0; i < CHAR_SLOT_MAX; i++){
    const d = localDefs[i];
    if(!d) continue;
    const k = _charsKeys(d);
    const cid = _charsPick(k, pool, used, serverDeskCids[i] || null);
    if(cid){
      used.add(cid); deskCids[i] = cid;
      const same = !!k && serverChars[cid].def != null && pool[cid].k2 === k.k2;   // 묘비와의 짝은 «같음» 이 없다 — 시각이 가른다
      local[cid] = { def: d, mtime: same ? (Number(serverChars[cid].mtime) || 0) : localTs };
      continue;
    }
    let nc = _charsNewId();
    while(serverChars[nc] || local[nc]) nc = _charsNewId();
    local[nc] = { def: d, mtime: localTs }; deskCids[i] = nc; fresh.push(nc);
  }
  return { local, deskCids, fresh };
}
try{ window._charsFromServerSlots = _charsFromServerSlots; window._charsFromLocalSlots = _charsFromLocalSlots; window._charsKeys = _charsKeys; }catch(_){}

const CHARS_SYNC_ENABLED = true;           // ← 2026-09-22 CHECKS 개정 48 에서 켰다(보관함 이동 · 슬롯에 올리기). ⚠️ 규칙(chars · trash · charsMeta)이 게시된 뒤에 배포할 것(설계 §5-N)
const CHARS_CLAIM_STALE_MS = 10*60*1000;   // 선점한 기기가 도중에 꺼졌을 때 다른 기기가 다시 잡기까지
const CHARS_SLOTS_IMPORTED_PREFIX = 'deskFriends.chars.slotsImported:';   // + uid — 계정마다 따로(계정 전환에 섞이지 않게)
function _charsCachedUid(){ try{ return localStorage.getItem(MY_USER_ID_KEY) || null; }catch(_){ return null; } }
async function _charsServerMigrate(uid){
  if(!CHARS_SYNC_ENABLED) return { ok: false, reason: '꺼져 있음(CHARS_SYNC_ENABLED)' };
  if(!uid || !(window.firebaseAPI && firebaseAPI.loadCharsRemote && firebaseAPI.claimCharsMigration)) return { ok: false, reason: '통로 없음' };
  let cr = await firebaseAPI.loadCharsRemote(uid);
  if(!cr) return { ok: false, reason: '서버 chars 읽기 실패' };
  const sl = await firebaseAPI.loadSlotsRemote(uid);
  if(!sl) return { ok: false, reason: '서버 slots 읽기 실패' };
  const first = !cr.meta || !cr.meta.migratedAt;
  const ik = CHARS_SLOTS_IMPORTED_PREFIX + uid;
  let imported = 0; try{ imported = parseInt(localStorage.getItem(ik) || '0', 10) || 0; }catch(_){}
  if(!first && !(sl.ts > Math.max(Number(cr.meta.migratedAt) || 0, imported))) return { ok: true, did: '할 일 없음' };
  if(first){
    const c = await firebaseAPI.claimCharsMigration(uid, CHARS_CLAIM_STALE_MS);
    if(!c) return { ok: false, reason: '이관 선점 실패' };
    if(!c.claimed) return { ok: true, did: '다른 기기가 진행 중이거나 끝냄' };
    cr = await firebaseAPI.loadCharsRemote(uid);                              // 잡은 뒤에 다시 읽는다 — 멈췄던 앞 기기가 쓴 것과 짝짓게
    if(!cr) return { ok: false, reason: '선점 뒤 chars 읽기 실패' };
  }
  const pv = (first && firebaseAPI.loadSlotsPrevRemote) ? await firebaseAPI.loadSlotsPrevRemote(uid) : null;
  const r = _charsFromServerSlots(sl, pv, cr.chars);
  const nAdd = Object.keys(r.add).length, nUpd = Object.keys(r.upd).length;
  if(nAdd + nUpd){
    const ok = await firebaseAPI.saveCharsEntries(uid, Object.assign({}, r.add, r.upd));
    if(!ok) return { ok: false, reason: 'chars 쓰기 실패 — 선점은 남고 ' + (CHARS_CLAIM_STALE_MS/60000) + '분 뒤 다른 기기가 다시 잡는다' };
  }
  if(first && !(await firebaseAPI.finishCharsMigration(uid, _slotsNow()))) return { ok: false, reason: '이관 도장 실패' };
  try{ localStorage.setItem(ik, String(sl.ts || 0)); }catch(_){}
  return { ok: true, did: first ? '첫 이관' : '되돌이', add: nAdd, upd: nUpd, deskCids: r.deskCids };
}
/* ── 🧬 이 기기 쪽 첫 채택 (설계 §2-3 · §5-N-2 · 2026-09-21 · CHECKS 개정 35) ────────────────────────────
   [보관함 로컬 사본의 모양 — 개정 35 결정] `deskFriends.chars.v1` 은 **서버 표현(URL 만 든 JSON 문자열)** 으로 둔다.
     그림(dataURL·GLB base64)은 **책상 5칸(LS_KEY)에만** 있다. 보관함 20마리를 그림째 로컬에 두면 5칸의 네 배라
     localStorage 한도(수 MB)에 닿는다 — 5칸만으로도 백업을 물리는 코드가 이미 있다(_slotsAdoptFromServer 의 catch).
     보관함 화면은 URL 을 <img> 로 바로 그리면 되고, 책상에 올릴 때만 그림을 내려받는다.
     ⇒ 로컬 보관함 항목: { def: "서버 JSON", mtime } | { del } | { def: null, mtime, dirty: true } (책상에만 있고 아직 못 올린 것).
   [책상 ↔ 보관함 잇기] `deskFriends.chars.desk` = [cid|null ×5]. 칸 def 안에 cid 를 넣지 않는다 — slotToObj · loadSlots ·
     crDone 이 필드를 하나씩 옮겨 적는 구조라(27355 주석) 한 곳이라도 빠지면 cid 가 조용히 떨어진다.
   `_charsPlanLocalAdopt` 는 순수(짝짓기 + 병합 → 할 일 목록). `_charsLocalAdopt` 는 그 목록대로 올리고/받고/쓴다 — 스위치가 꺼져 있으면 안 한다.
   ⚠️ 이것은 **첫 채택 한 번**이다(보관함 키가 없는 기기). 그 뒤의 평상시(칸 고침 → dirty → 올림 · 칸 이동·삭제 → desk 갱신 ·
     주기적 받기)는 아직 없다 — 스위치를 켜기 전에 반드시 들어와야 한다(설계 §10-4). */
const CHARS_BOX_KEY = 'deskFriends.chars.v1';
const CHARS_DESK_KEY = 'deskFriends.chars.desk';
function _charsPlanLocalAdopt(localDefs, localTs, serverChars, serverDeskCids, opts){
  localDefs = Array.isArray(localDefs) ? localDefs : [];
  const loc = _charsFromLocalSlots(localDefs, localTs, serverChars, serverDeskCids);
  const m = _charsMerge(loc.local, serverChars, opts);
  const slotOf = {}; loc.deskCids.forEach((c, i) => { if(c) slotOf[c] = i; });
  const box = {}, upload = [], reseat = [], unseat = [], pushServer = {}, trashServer = [], trashLocal = [];
  for(const cid in m.merged){
    const e = m.merged[cid];
    if(_charsIsTomb(e)){
      box[cid] = { del: e.del };
      if(m.push[cid]) pushServer[cid] = e;                     // 서버 미래 시각 정정분(묘비)
      if(slotOf[cid] != null && m.pull[cid]) unseat.push(slotOf[cid]);
      continue;
    }
    if(typeof e.def === 'string'){                              // 서버 표현이 이겼다(또는 같다)
      box[cid] = { def: e.def, mtime: e.mtime };
      if(m.push[cid]) pushServer[cid] = e;                     // 미래 시각 정정분
      if(slotOf[cid] != null && m.pull[cid] && loc.local[cid]) reseat.push({ slot: slotOf[cid], cid });
      continue;
    }
    box[cid] = { def: null, mtime: e.mtime, dirty: true };       // 이 기기 칸이 이겼다 — 올려야 한다
    upload.push({ slot: slotOf[cid], cid, mtime: e.mtime });
  }
  for(const t of m.trash){
    if(typeof t.def === 'string') trashServer.push(t);
    else if(slotOf[t.cid] != null) trashLocal.push({ slot: slotOf[t.cid], cid: t.cid, mtime: t.mtime, why: t.why });
  }
  const deskCids = loc.deskCids.slice();
  for(const i of unseat) deskCids[i] = null;
  return { box, deskCids, upload, reseat, unseat, pushServer, trashServer, trashLocal, fresh: loc.fresh };
}
async function _charsLocalAdopt(uid){
  if(!CHARS_SYNC_ENABLED) return { ok: false, reason: '꺼져 있음(CHARS_SYNC_ENABLED)' };
  try{ if(localStorage.getItem(CHARS_BOX_KEY) != null) return { ok: true, did: '이미 채택함' }; }catch(_){ return { ok: false, reason: '저장소 읽기 실패' }; }
  if(!uid || !(window.firebaseAPI && firebaseAPI.loadCharsRemote)) return { ok: false, reason: '통로 없음' };
  const cr = await firebaseAPI.loadCharsRemote(uid);
  if(!cr) return { ok: false, reason: '서버 chars 읽기 실패' };
  if(!(cr.meta && cr.meta.migratedAt)) return { ok: false, reason: '서버 이관이 아직 안 끝남' };
  const sl = await firebaseAPI.loadSlotsRemote(uid);
  if(!sl) return { ok: false, reason: '서버 slots 읽기 실패' };
  const serverDesk = _charsFromServerSlots(sl, null, cr.chars).deskCids;
  /* 묘비에 열쇠 달기 — 지운 마리의 마지막 모습은 휴지통에 있다. 못 읽으면 채택을 접는다(되살림보다 기다림이 낫다). */
  const tombs = Object.keys(cr.chars).filter(c => _charsIsTomb(cr.chars[c]));
  if(tombs.length){
    const last = firebaseAPI.loadCharsTrashLatest ? await firebaseAPI.loadCharsTrashLatest(uid, tombs) : null;
    if(!last) return { ok: false, reason: '휴지통 읽기 실패 — 지운 마리를 알아보지 못해 채택을 미룬다' };
    for(const c of tombs) if(last[c]) cr.chars[c] = Object.assign({}, cr.chars[c], { keys: _charsKeys(last[c]) });
  }
  let prevRaw = null, raw = null;
  try{ prevRaw = localStorage.getItem(LS_KEY); raw = JSON.parse(prevRaw || 'null'); }catch(_){}
  if(!Array.isArray(raw)) raw = [];
  const p = _charsPlanLocalAdopt(raw, _slotsTs(), cr.chars, serverDesk, {});
  /* ① 올릴 것 — 칸 하나라도 못 올리면 **아무것도 안 쓰고** 접는다(다음 부팅에 처음부터). _slotsPushToServer 와 같은 규칙. */
  const faceSt = _roomFaceCacheLoad(), glbSt = _slotGlbCacheLoad();
  const toJs = async (i) => {
    const so = await _slotToServerObj(uid, raw[i], faceSt, glbSt);
    _roomFaceCacheSave(faceSt); _slotGlbCacheSave(glbSt);
    if(!so) return null;
    const js = JSON.stringify(so);
    return js.length > SLOT_JSON_MAX ? null : js;
  };
  const entries = Object.assign({}, p.pushServer);
  for(const u of p.upload){
    const js = await toJs(u.slot);
    if(!js) return { ok: false, reason: (u.slot + 1) + '번 칸을 올리지 못함 — 아무것도 안 바꿨다' };
    entries[u.cid] = { def: js, mtime: u.mtime };
    p.box[u.cid] = { def: js, mtime: u.mtime };
  }
  const trash = p.trashServer.slice();
  for(const t of p.trashLocal){ const js = await toJs(t.slot); if(js) trash.push({ cid: t.cid, def: js, mtime: t.mtime, why: t.why }); }
  /* ② 받을 것(책상 칸 바꿔 앉히기) — 그림을 못 받으면 그 칸은 이 기기 것 그대로 두고 채택을 접는다. */
  const next = raw.slice();
  for(const r of p.reseat){
    try{ next[r.slot] = await _slotFromServerObj(JSON.parse(p.box[r.cid].def)); }
    catch(e){ return { ok: false, reason: (r.slot + 1) + '번 칸 그림을 받지 못함 — 아무것도 안 바꿨다' }; }
  }
  for(const i of p.unseat) next[i] = null;
  /* ③ 서버에 쓴다 — 실패하면 로컬은 안 바꾼다. */
  if(Object.keys(entries).length && !(await firebaseAPI.saveCharsEntries(uid, entries))) return { ok: false, reason: '서버 chars 쓰기 실패' };
  if(trash.length && firebaseAPI.appendCharsTrash) await firebaseAPI.appendCharsTrash(uid, trash);
  /* ④ 로컬 — 칸이 바뀌면 통째 교체와 같은 안전망(백업)을 지난다. 보관함·책상 표는 마지막에(=채택 완료 표시). */
  const changed = p.reseat.length + p.unseat.length > 0;
  if(changed){
    const str = JSON.stringify(next);
    try{ _slotsBackupSave(prevRaw, str, _slotsFilledCount(str)); }catch(_){}
    try{ localStorage.setItem(LS_KEY, str); }catch(e){ return { ok: false, reason: '책상 칸 저장 실패(저장 공간)' }; }
  }
  try{
    localStorage.setItem(CHARS_DESK_KEY, JSON.stringify(p.deskCids));
    localStorage.setItem(CHARS_BOX_KEY, JSON.stringify(p.box));
  }catch(e){ return { ok: false, reason: '보관함 저장 실패(저장 공간)' }; }
  if(changed){
    const _old = slots.slice();
    for(let i = 0; i < CHAR_SLOT_MAX; i++){ slots[i] = null; _faceEverDrawn[i] = false; _blinkEverDrawn[i] = false; }
    try{ await loadSlots(); }catch(_){}
    _relinkSeatsToSlots(_old, new Set(p.unseat));   // 바꿔 앉힌 칸은 같은 캐릭터(cid)라 잇는다 · 비운 칸만 뺀다
    try{ renderLauncher(); }catch(_){}
    try{ slotsReplaced(); }catch(_){}
  }
  return { ok: true, did: '첫 채택', box: Object.keys(p.box).length, upload: p.upload.length, reseat: p.reseat.length, unseat: p.unseat.length, trash: trash.length };
}
/* ── 🧬 평상시 동기화 (설계 §2-3 · §5-N · 2026-09-21 · CHECKS 개정 36 · 스위치 꺼짐) ─────────────────────────────
   [언제 도나] `_charsActive()` — 스위치가 켜져 있고 **이 기기가 첫 채택을 마쳤을 때**(보관함 키가 있다)만.
     채택 전에 훅이 보관함 키를 만들면 `_charsLocalAdopt` 가 «이미 채택함» 으로 건너뛴다 — 그래서 모든 훅이 이 한 줄로 시작한다.
     채택 전의 칸 변경은 예전처럼 LS_KEY 와 `_slotsTs` 에만 남고, 첫 채택이 열쇠(K1·K2)와 시각으로 가져간다.
   [칸 고침은 saveSlots 한 곳에서 잡는다] saveSlots 는 스무 군데에서 불린다 — 부르는 자리마다 훅을 달면 하나만 빠져도
     그 수정이 조용히 안 올라간다. 보관함 항목에 «마지막으로 본 칸 문자열의 해시» `h` 를 두고, 저장 때 책상 표(cid ×5)를 따라
     **cid 로** 맞대 본다. 칸 번호로 보지 않으므로 휴지통 이동의 당기기로 칸이 밀려도 «고침» 이 아니다.
     `h` 가 없는 항목(첫 채택 직후 · 받아서 바꿔 앉힌 직후)은 **기준만 잡고 고침으로 치지 않는다** — 받은 것을 도로 올리는 핑퐁을 막는다.
   [칸을 옮기는 자리만 책상 표를 고친다] 새 캐릭터(`_charsOnNew` — 생성기 · 커미션 · 복제 코드) · 휴지통 이동(`_charsTrashMove`) ·
     백업 되돌리기(`_charsRemapDesk` — 열쇠로 다시 짝짓기).
   [받기] `_charsSync` — charsMeta.ts 한 값을 읽고, 같고 이 기기에 올릴 것이 없으면 끝. 아니면 본문을 받아 `_charsPlanSync`(순수)로
     병합 → 올리기 · 바꿔 앉히기 · 내리기 · 휴지통. 첫 채택과 같은 규칙: **올리거나 받는 것이 하나라도 실패하면 아무것도 안 바꾼다.**
     도중에 칸이 또 바뀌면(`_charsGen`) 로컬은 안 쓰고 다시 돈다 — 서버에 쓴 것은 병합 기준이라 다음 판이 그대로 맞춘다.
   [옛 slots] 이관 창 동안 올리기만 계속한다(설계 §5-N-3). 받기·④ 대화상자는 `syncSlotsToServer` 첫머리에서 막는다.
   ⚠️ 다른 기기가 «ts 읽기 ~ 쓰기» 사이(수백 ms)에 같은 마리를 고치면 진 쪽이 휴지통 없이 덮인다 — 트랜잭션을 마리마다 걸 값은 아니라고 봤다. */
const CHARS_TRASH_PEND_KEY = 'deskFriends.chars.trashPend';     // 아직 못 올린 휴지통 줄 [{cid, mtime, why, def?|raw?}]
const CHARS_META_TS_PREFIX = 'deskFriends.chars.metaTs:';        // + uid — 마지막으로 맞춰 본 charsMeta.ts
const CHARS_BOX_MAX = 20;
const CHARS_SYNC_DEBOUNCE_MS = 3000;
let _charsGen = 0, _charsSyncing = false, _charsSyncAgain = false, _charsSyncTimer = null;
function _charsActive(){
  if(!CHARS_SYNC_ENABLED) return false;
  try{ return localStorage.getItem(CHARS_BOX_KEY) != null; }catch(_){ return false; }
}
function _charsJsonGet(k, dflt){ try{ const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? dflt : v; }catch(_){ return dflt; } }
function _charsBoxGet(){ const b = _charsJsonGet(CHARS_BOX_KEY, {}); return (b && typeof b === 'object' && !Array.isArray(b)) ? b : {}; }
function _charsDeskGet(){
  const d = _charsJsonGet(CHARS_DESK_KEY, []), out = new Array(CHAR_SLOT_MAX).fill(null);
  if(Array.isArray(d)) for(let i = 0; i < CHAR_SLOT_MAX; i++) out[i] = (typeof d[i] === 'string' && d[i]) ? d[i] : null;
  return out;
}
function _charsBoxLive(box){ let n = 0; for(const c in box) if(box[c] && !_charsIsTomb(box[c])) n++; return n; }
/* 보관함에 든 수 — **슬롯 밖**의 산 캐릭터만(개정 48 · 사용자 결정 «보관함 (n/20)»: 보관함 20칸 + 슬롯 5칸).
   슬롯 캐릭터는 보관함에 세지 않는다(슬롯은 슬롯 5칸이 따로 막는다). */
function _charsBoxOnlyCount(box, desk){
  box = box || _charsBoxGet(); desk = desk || _charsDeskGet();
  const on = new Set(desk.filter(Boolean)); let n = 0;
  for(const c in box) if(box[c] && !_charsIsTomb(box[c]) && !on.has(c)) n++;
  return n;
}
/* 20 문턱 — 보관함에 넣는 자리(보관함 이동 · 휴지통 복원 · 게이트 «다름 → 가져오기»)마다 먼저 묻는다. 막으면 true.
   채택 전 · 스위치 꺼짐이면 안 막는다. ★ «마리» 라는 말은 쓰지 않는다 — 개수는 «n/20»(사용자 결정). */
function _charsBoxFull(){
  if(!_charsActive()) return false;
  const n = _charsBoxOnlyCount();
  if(n < CHARS_BOX_MAX) return false;
  try{ toast('보관함이 가득 찼어요 (' + n + '/' + CHARS_BOX_MAX + ')'); }catch(_){}
  return true;
}
function _charsSchedule(){
  if(!_charsActive()) return;
  if(_charsSyncTimer) clearTimeout(_charsSyncTimer);
  _charsSyncTimer = setTimeout(() => { _charsSyncTimer = null; try{ _charsSync('save'); }catch(_){} }, CHARS_SYNC_DEBOUNCE_MS);
}
/* saveSlots 가 부른다. out = 방금 LS_KEY 에 쓴 배열 · changed = 저장본 문자열이 달라졌나.
   안 달라졌으면 **기준(h)이 없는 항목만** 잡는다 — 받아서 바꿔 앉힌 칸은 다시 읽고 한 번 저장해 봐야 저장 모양이 정해지는데,
   그 저장이 문자열을 안 바꾸면 기준이 영영 빈 채로 남아 다음 고침을 놓친다. 달라졌을 때만 전부 맞대 본다(슬라이더마다 해시 다섯 번을 피한다). */
function _charsAfterSave(out, changed){
  if(!_charsActive() || !Array.isArray(out)) return;
  const box = _charsBoxGet(), desk = _charsDeskGet(), now = _slotsNow();
  let wrote = false, dirty = false;
  for(let i = 0; i < CHAR_SLOT_MAX; i++){
    const cid = desk[i], e = cid ? box[cid] : null;
    if(!e || _charsIsTomb(e) || !out[i]) continue;
    if(changed === false && e.h != null) continue;
    let h; try{ h = _quickHash(JSON.stringify(out[i])); }catch(_){ continue; }
    if(e.h == null){                                            // 기준만 잡는다(새 마리는 이미 dirty)
      e.h = h; wrote = true;
      if(e.dirty){ dirty = true; try{ e.k = _charsKeys(out[i]); }catch(_){} }
      continue;
    }
    if(e.h === h) continue;
    /* 서버 표현은 버린다 — dirty = «책상에만 있고 아직 못 올린 것». base = 고치기 시작한 서버 시각(휴지통 판정 · _charsPlanSync).
       k = 열쇠 — 백업 되돌리기가 def 없는 dirty 마리와도 짝지을 수 있게. */
    let k = null; try{ k = _charsKeys(out[i]); }catch(_){}
    box[cid] = { def: null, mtime: now, dirty: true, h, base: e.dirty ? e.base : e.mtime, k };
    wrote = dirty = true;
  }
  if(wrote){ try{ localStorage.setItem(CHARS_BOX_KEY, JSON.stringify(box)); }catch(e){ console.warn('[🧬] 보관함 저장 실패', e); } }
  if(dirty){ _charsGen++; _charsSchedule(); }
}
/* 새 캐릭터가 칸 i 에 막 들어왔다(slots[i] = def 직후 · saveSlots 전). */
function _charsOnNew(i){
  if(!_charsActive() || !(i >= 0 && i < CHAR_SLOT_MAX)) return null;
  const box = _charsBoxGet(), desk = _charsDeskGet();
  let cid = _charsNewId(); while(box[cid]) cid = _charsNewId();
  box[cid] = { def: null, mtime: _slotsNow(), dirty: true };
  desk[i] = cid;
  try{ localStorage.setItem(CHARS_BOX_KEY, JSON.stringify(box)); localStorage.setItem(CHARS_DESK_KEY, JSON.stringify(desk)); }
  catch(e){ console.warn('[🧬] 새 캐릭터 기록 실패', e); return null; }
  _charsGen++; _charsSchedule();
  return cid;
}
/* 휴지통 이동 — 칸 i 의 마리를 묘비로 만들고 휴지통 줄을 남긴 뒤 책상 표를 칸과 같이 당긴다(doDeleteCurSlot 의 당기기와 짝).
   부르는 쪽은 이 뒤에 slots 를 당기고 saveSlots 한다. 돌려주는 값: 처리했으면 true(켜져 있지 않으면 false — 옛 삭제 그대로). */
function _charsTrashMove(i){
  if(!_charsActive() || !(i >= 0 && i < CHAR_SLOT_MAX)) return false;
  const box = _charsBoxGet(), desk = _charsDeskGet(), cid = desk[i], now = _slotsNow();
  if(cid && box[cid] && !_charsIsTomb(box[cid])){
    const e = box[cid], pend = _charsJsonGet(CHARS_TRASH_PEND_KEY, []);
    /* 휴지통 줄 — 올린 적 있는 모습은 병합이 서버 것을 휴지통으로 보낸다(묘비가 이기므로). 여기서 따로 남기는 것은
       **아직 못 올린 고침(dirty)** 뿐이다 — 그건 이 기기 칸에만 있어서 병합이 알 수 없다. 그림째 남겼다가 올릴 때 바꾼다. */
    if(e.dirty){ const raw = _charsJsonGet(LS_KEY, []); if(Array.isArray(raw) && raw[i]) pend.push({ cid, mtime: Number(e.mtime) || now, why: 'deleted', raw: raw[i] }); }
    box[cid] = { del: Math.max(now, (Number(e.mtime) || 0) + 1), pend: true };   // pend = 아직 못 올린 묘비(ts 가 같아도 받기를 건너뛰지 않게)
    try{ localStorage.setItem(CHARS_TRASH_PEND_KEY, JSON.stringify(pend)); }catch(_){}
  }
  for(let k = i; k < CHAR_SLOT_MAX - 1; k++) desk[k] = desk[k + 1];
  desk[CHAR_SLOT_MAX - 1] = null;
  try{ localStorage.setItem(CHARS_BOX_KEY, JSON.stringify(box)); localStorage.setItem(CHARS_DESK_KEY, JSON.stringify(desk)); }
  catch(e){ console.warn('[🧬] 휴지통 이동 기록 실패', e); }
  _charsGen++; _charsSchedule();
  return true;
}
/* 🧰 슬롯 ↔ 보관함 (개정 48 · 시안 G · D) — 지우지 않는다. 슬롯 표(desk)만 바꾸고 보관함 항목은 그대로 둔다.
   [보관함 이동] _charsDeskToBox(i): 칸 i 의 캐릭터를 슬롯 표에서 빼고 뒤 칸을 당긴다(휴지통 이동의 당기기와 같은 모양 · 묘비 없음).
     ★ 아직 계정에 못 올린 고침(dirty · def 없음)은 **먼저 올린다** — 슬롯에서 내리면 그 그림이 이 기기 칸에서 사라지므로
       서버 표현(def)이 생기기 전에는 옮기지 않는다(못 올리면 옮기지 않고 알린다).
     ★ 보관함은 20칸(슬롯 밖만 센다 · _charsBoxOnlyCount).
   [슬롯에 올리기] _charsBoxToDesk(cid): 빈 슬롯 첫 칸에 서버 표현을 그림째 받아 앉힌다(_charsSync 의 «바꿔 앉히기» 와 같은 길).
     기준(h)은 지워 다음 saveSlots 가 다시 잡게 한다 — 받은 것을 고침으로 치지 않는다. 슬롯이 꽉 차면 D3 문구.
   부르는 쪽(런처 · [내 정보])이 결과의 why 로 문구를 고른다(_charsMoveMsg). */
/* 보관함 이동 실패 기록 — 콘솔 + 최근 10건(localStorage). 제보 때 «tw.charsMoveFails» 를 받아 본다. */
function _charsMoveFailLog(r, i){
  const rec = { t: Date.now(), why: (r && r.why) || '?', slot: i, err: (r && r.err) || undefined, syncing: !!_charsSyncing };
  console.warn('[🧬] 보관함 이동 실패', rec);
  try{
    const a = JSON.parse(localStorage.getItem('tw.charsMoveFails') || '[]');
    a.push(rec); while(a.length > 10) a.shift();
    localStorage.setItem('tw.charsMoveFails', JSON.stringify(a));
  }catch(_){}
}
async function _charsDeskToBox(i){
  if(!_charsActive()) return { ok: false, why: 'off' };
  if(!(i >= 0 && i < CHAR_SLOT_MAX)) return { ok: false, why: 'nocid' };
  let box = _charsBoxGet(), desk = _charsDeskGet();
  let cid = desk[i];
  /* 칸엔 캐릭터가 있는데 이름표가 없거나 묘비면(다른 기기에서 지운 cid 가 이 칸에 남는 일이 있다) 새 이름표로 다시 올린 뒤 옮긴다.
     보관함이 가득이면 옮기지 못하니 새 이름표도 만들지 않는다(지운 캐릭터가 계정에 다시 살아나지 않게) */
  if((!cid || !box[cid] || _charsIsTomb(box[cid])) && slots[i]){
    if(_charsBoxOnlyCount(box, desk) >= CHARS_BOX_MAX) return { ok: false, why: 'full' };
    cid = _charsOnNew(i); box = _charsBoxGet(); desk = _charsDeskGet();
  }
  if(!cid || !box[cid] || _charsIsTomb(box[cid])) return { ok: false, why: 'nocid' };
  if(_charsBoxOnlyCount(box, desk) >= CHARS_BOX_MAX) return { ok: false, why: 'full' };
  if(typeof box[cid].def !== 'string'){
    /* 🩹 #9 — 이미 도는 동기화가 있으면 **끝날 때까지 기다린 뒤** 부른다. 예전엔 _charsSync 가 «도는 중» 으로 바로
       돌아와서, 올리기가 안 끝난 채 아래 검사로 떨어져 dirty/moved 로 실패했다(동물은 그림이 많아 자주). */
    // 진행 중인 동기화가 끝날 때까지(최대 20초). ⚠️ 이 함수 안에 둔다 — sim-signup 이 이 함수만 떼어 돌린다.
    const _idle = async () => { for(let t = 0; typeof _charsSyncing !== 'undefined' && _charsSyncing && t < 200; t++) await new Promise(res => setTimeout(res, 100)); };
    await _idle();
    let sr = null;
    try{ sr = await _charsSync('force'); }catch(_){}
    await _idle();
    const syncCode = (sr && sr.code) || '';   // 왜 못 올렸나 — 실패 문구 끝에 싣는다(제보로 원인을 가르게)
    box = _charsBoxGet(); desk = _charsDeskGet();
    /* 기다리는 사이 칸 번호가 바뀌었으면 그 캐릭터의 새 번호로 따라간다(번호만 믿으면 엉뚱한 칸을 당긴다). */
    if(desk[i] !== cid){ const j = desk.indexOf(cid); if(j < 0) return { ok: false, why: 'moved' }; i = j; }
    if(!box[cid] || typeof box[cid].def !== 'string') return { ok: false, why: 'dirty', err: syncCode || undefined };
  }
  for(let k = i; k < CHAR_SLOT_MAX - 1; k++) desk[k] = desk[k + 1];
  desk[CHAR_SLOT_MAX - 1] = null;
  try{ localStorage.setItem(CHARS_DESK_KEY, JSON.stringify(desk)); }catch(e){ return { ok: false, why: 'save' }; }
  _charsGen++;
  return { ok: true, cid, slot: i };   // slot = 실제로 당긴 칸(동기화를 기다리는 사이 따라간 번호) — 부르는 쪽은 이 번호로 슬롯을 당긴다
}
async function _charsBoxToDesk(cid){
  if(!_charsActive()) return { ok: false, why: 'off' };
  const box = _charsBoxGet(), desk = _charsDeskGet(), e = box[cid];
  if(!e || _charsIsTomb(e) || typeof e.def !== 'string') return { ok: false, why: 'nodef' };
  if(desk.indexOf(cid) >= 0) return { ok: false, why: 'ondesk' };
  let i = -1;
  for(let k = 0; k < CHAR_SLOT_MAX; k++){ if(!slots[k] && !desk[k]){ i = k; break; } }
  if(i < 0) return { ok: false, why: 'slotsfull' };
  let obj = null;
  try{ obj = await _slotFromServerObj(JSON.parse(e.def)); }catch(_){ obj = null; }
  if(!obj) return { ok: false, why: 'img' };
  let prevRaw = null, raw = null;
  try{ prevRaw = localStorage.getItem(LS_KEY); raw = JSON.parse(prevRaw || 'null'); }catch(_){}
  if(!Array.isArray(raw)) raw = [];
  while(raw.length < CHAR_SLOT_MAX) raw.push(null);
  if(raw[i]) return { ok: false, why: 'slotsfull' };
  raw[i] = obj; desk[i] = cid;
  const b2 = _charsBoxGet(); if(b2[cid]) delete b2[cid].h;
  const str = JSON.stringify(raw);
  try{ _slotsBackupSave(prevRaw, str, _slotsFilledCount(str)); }catch(_){}
  try{
    localStorage.setItem(LS_KEY, str);
    localStorage.setItem(CHARS_DESK_KEY, JSON.stringify(desk));
    localStorage.setItem(CHARS_BOX_KEY, JSON.stringify(b2));
  }catch(err){ return { ok: false, why: 'save' }; }
  _charsGen++;
  for(let k = 0; k < CHAR_SLOT_MAX; k++){ slots[k] = null; _faceEverDrawn[k] = false; _blinkEverDrawn[k] = false; }
  try{ await loadSlots(); }catch(_){}
  try{ saveSlots(); }catch(_){}
  try{ renderLauncher(); }catch(_){}
  try{ slotsReplaced(); }catch(_){}
  return { ok: true, slot: i };
}
/* 옮기기 실패 문구 한 벌 — 런처 톱니와 [내 정보]가 같이 쓴다. «마리» 라는 말은 쓰지 않는다. */
function _charsMoveMsg(r){
  const w = r && r.why;
  if(w === 'off') return '보관함은 계정 연동이 끝난 뒤에 쓸 수 있어요 — 잠시 뒤 다시 눌러 주세요';
  if(w === 'full') return '보관함이 가득 찼어요 (' + CHARS_BOX_MAX + '/' + CHARS_BOX_MAX + ')';
  if(w === 'dirty'){
    /* 계정에 못 올린 까닭(_charsSync 의 code — 'img@2' · 'size162k@2' · 'write' …)을 사람 말로 끝에 붙인다 — 제보 한 줄로 원인을 가르게 */
    const c = String((r && r.err) || ''), at = c.indexOf('@'), kind = at < 0 ? c : c.slice(0, at), slot = at < 0 ? '' : c.slice(at + 1);
    const WHY = { img: '그림 올리기 실패', write: '서버가 거절', read: '서버 읽기 실패', fetch: '그림 받기 실패', creator: '생성기가 열려 있음', nopath: '서버 연결 전' };
    const label = WHY[kind] || (/^size\d+k$/.test(kind) ? '크기 초과 ' + kind.slice(4) : '');
    return '방금 고친 모습을 계정에 올리는 중이에요 — 잠시 뒤 다시 눌러 주세요' + (label ? ' (이유: ' + label + (slot ? ' · ' + slot + '번 칸' : '') + ')' : '');
  }
  if(w === 'slotsfull') return '슬롯이 꽉 차서 이동할 수 없어요. 슬롯을 먼저 비워 주세요 — 런처 톱니 [보관함 이동]';
  if(w === 'img') return '캐릭터 그림을 받지 못했어요 — 네트워크를 확인하고 다시 눌러 주세요';
  return '옮기지 못했어요 — 다시 눌러 주세요' + (w ? ' (' + w + ')' : '');   // 🩺 이유 코드 — 제보 때 갈래를 가른다
}
/* 런처 톱니 문구 — 켜져 있으면(채택 뒤) «휴지통 이동», 아니면 옛 «캐릭터 삭제»(설계 개정 5 · 문구와 동작을 같이 바꾼다). */
function _charsDeleteWords(){
  return _charsActive()
    ? { btn: '휴지통 이동', ask: '휴지통으로 옮길까요? 3일 뒤 사라져요', done: '휴지통으로 옮겼어요', gear: '보관함 이동 / 캐릭터 수정 / 휴지통 이동' }
    : { btn: '캐릭터 삭제', ask: '정말 삭제할까요?', done: '삭제했어요', gear: '보관함 이동 / 캐릭터 수정 / 캐릭터 삭제' };
}
/* 🗑️ 휴지통 (개정 49 · 시안 E · 보관함 줄 [휴지통 이동]) ─────────────────────────────────────────────
   [보관함 줄 → 휴지통] _charsBoxTrash(cid): 슬롯 밖 항목을 묘비로만 바꾼다. 보관함 항목은 늘 서버 표현(def)이 있어서
     (슬롯에서 내릴 때 먼저 올린다 — _charsDeskToBox) 대기 줄이 필요 없다. 다음 동기화가 묘비를 올리고, 병합이 서버의
     마지막 모습을 trash(why:'deleted')로 남긴다 — 런처 [휴지통 이동]과 같은 길(sim-chars-migrate ④).
   [어떤 줄을 보이나] _charsTrashView(순수): 휴지통은 앱이 지울 수 없다(규칙 «붙이기만») — 그래서 숨길 줄을 여기서 고른다.
     · 기한 지난 줄 — 옮김 3일 · 연동 교체 10일(설계 개정 5). 청소 함수가 아직 없어도 화면에선 약속대로 사라진다(서버엔 남음).
     · 옮김(deleted) — cid 마다 가장 최근 한 줄만. 그 cid 가 보관함에 살아 있고 그 줄보다 나중이면 복원된 것 → 숨김.
     · 연동 교체(overwritten) — 원본 캐릭터는 늘 살아 있으므로 위 기준을 쓰면 원본을 다시 고치는 순간 옛 모습이 사라진다.
       대신 «복원본 cid(_charsRestoreCid)가 보관함에 있나» 로만 숨긴다(산 것이든 묘비든).
   [복원] _charsRestore(row): 무조건 보관함으로(20 문턱). 옮김 = 같은 cid · 연동 교체 = 복원본 cid — 원본 cid + 그 모습의 시각에서
     늘 같은 값이 나오므로 두 번 눌러도 · 다른 PC 에서 눌러도 하나만 생긴다(규칙 변경 없음).
     서버에 먼저 쓰고, 된 뒤에만 로컬 보관함을 고친다 — 슬롯 밖 항목은 _charsSync 의 빠른 건너뛰기가 안 보므로 로컬만 바꾸면 안 올라간다. */
const CHARS_TRASH_TTL = { deleted: 3*24*60*60*1000, overwritten: 10*24*60*60*1000 };
function _charsBoxTrash(cid){
  if(!_charsActive()) return { ok: false, why: 'off' };
  const box = _charsBoxGet(), desk = _charsDeskGet(), e = box[cid], now = _slotsNow();
  if(!e || _charsIsTomb(e)) return { ok: false, why: 'nocid' };
  if(desk.indexOf(cid) >= 0) return { ok: false, why: 'ondesk' };
  if(typeof e.def !== 'string') return { ok: false, why: 'dirty' };
  box[cid] = { del: Math.max(now, (Number(e.mtime) || 0) + 1), pend: true };
  try{ localStorage.setItem(CHARS_BOX_KEY, JSON.stringify(box)); }catch(err){ return { ok: false, why: 'save' }; }
  _charsGen++; _charsSchedule();
  return { ok: true };
}
/* D2 보관함 가득 참 (개정 51) — 고른 여러 개를 한 번에. 한 개씩 _charsBoxTrash 와 똑같이(묘비만) — 못 옮긴 것은 건너뛰고 센다. */
function _charsBoxTrashMany(cids){
  let n = 0, fail = 0;
  for(const cid of (Array.isArray(cids) ? cids : [])){ const r = _charsBoxTrash(cid); if(r.ok) n++; else fail++; }
  return { ok: n > 0, n, fail };
}
function _charsRestoreCid(cid, mtime){
  return 'cr' + _quickHash(String(cid) + ':' + Math.floor(Number(mtime) || 0)).slice(2, 20);
}
function _charsTrashView(trash, box, now){
  trash = (trash && typeof trash === 'object') ? trash : {};
  box = (box && typeof box === 'object') ? box : {};
  const live = c => { const e = box[c]; return (e && !_charsIsTomb(e)) ? (Number(e.mtime) || 0) : -1; };
  const rows = [], lastDel = {};
  for(const cid in trash){
    const per = trash[cid]; if(!per || typeof per !== 'object') continue;
    for(const mt in per){
      const t = per[mt];
      if(!t || typeof t.def !== 'string' || !CHARS_TRASH_TTL[t.why]) continue;
      const at = Number(t.at) || 0, until = at + CHARS_TRASH_TTL[t.why];
      if(until <= now) continue;
      const row = { cid, mtime: Number(mt) || 0, def: t.def, why: t.why, at, until };
      if(t.why === 'deleted'){ if(!lastDel[cid] || at > lastDel[cid].at) lastDel[cid] = row; continue; }
      if(box[_charsRestoreCid(cid, row.mtime)]) continue;
      rows.push(row);
    }
  }
  for(const cid in lastDel){ const r = lastDel[cid]; if(live(cid) > r.at) continue; rows.push(r); }
  rows.sort((a, b) => b.at - a.at);
  return rows;
}
async function _charsRestore(row){
  if(!_charsActive()) return { ok: false, why: 'off' };
  if(!row || typeof row.def !== 'string') return { ok: false, why: 'nodef' };
  if(_charsBoxOnlyCount() >= CHARS_BOX_MAX) return { ok: false, why: 'full' };
  const uid = _charsCachedUid();
  if(!uid || !(window.firebaseAPI && firebaseAPI.saveCharsEntries)) return { ok: false, why: 'off' };
  const cid = row.why === 'overwritten' ? _charsRestoreCid(row.cid, row.mtime) : row.cid;
  const cur = _charsBoxGet()[cid];
  if(cur && !_charsIsTomb(cur)) return { ok: true, cid, already: true };      // 다른 PC 에서 이미 복원 — 받아 둔 것
  const mtime = Math.floor(Math.max(_slotsNow(), (Number(row.at) || 0) + 1, _charsEntryTime(cur) + 1));
  const w = await firebaseAPI.saveCharsEntries(uid, { [cid]: { def: row.def, mtime } });
  if(!w) return { ok: false, why: 'save' };
  const box = _charsBoxGet();
  box[cid] = { def: row.def, mtime };
  try{ localStorage.setItem(CHARS_BOX_KEY, JSON.stringify(box)); }catch(_){}    // 못 써도 서버엔 있다 — 다음 동기화가 받아 온다
  _charsGen++;
  return { ok: true, cid };
}
/* 백업 되돌리기(5칸 통째) 뒤 — 되돌린 칸을 열쇠로 보관함과 다시 짝짓는다. 짝 없으면 새 cid. 내용이 다르면 saveSlots 훅이 dirty 로 잡도록
   h 를 지우지 않고 둔다(되돌린 것이 «지금 이 계정의 최신» 이라는 restoreSlotsBackup 의 선언과 같다). */
function _charsRemapDesk(){
  if(!_charsActive()) return false;
  const box = _charsBoxGet(), raw = _charsJsonGet(LS_KEY, []);
  const srv = {};
  for(const c in box){
    const e = box[c]; if(!e || _charsIsTomb(e)) continue;
    if(typeof e.def === 'string') srv[c] = e;
    else if(e.dirty && e.k) srv[c] = { def: null, mtime: e.mtime, keys: e.k };   // 못 올린 마리 — 열쇠로만 짝짓는다
  }
  const r = _charsFromLocalSlots(Array.isArray(raw) ? raw : [], _slotsNow(), srv, _charsDeskGet());
  const now = _slotsNow();
  for(const c of r.fresh) box[c] = { def: null, mtime: now, dirty: true };
  try{ localStorage.setItem(CHARS_BOX_KEY, JSON.stringify(box)); localStorage.setItem(CHARS_DESK_KEY, JSON.stringify(r.deskCids)); }catch(_){ return false; }
  _charsGen++;
  _charsAfterSave(Array.isArray(raw) ? raw : [], true);
  _charsSchedule();
  return true;
}
/* 순수 — 보관함(+책상 칸 원본) × 서버 chars → 할 일 목록. 모양은 _charsPlanLocalAdopt 와 같다. */
function _charsPlanSync(box, deskCids, deskRaw, serverChars, opts){
  box = (box && typeof box === 'object') ? box : {};
  deskCids = Array.isArray(deskCids) ? deskCids : [];
  deskRaw = Array.isArray(deskRaw) ? deskRaw : [];
  const slotOf = {}; deskCids.forEach((c, i) => { if(c) slotOf[c] = i; });
  const local = {}, keep = {};
  for(const cid in box){
    const e = box[cid]; if(!e) continue;
    if(_charsIsTomb(e)){ local[cid] = { del: e.del }; continue; }
    if(e.dirty){
      const i = slotOf[cid];
      /* 책상에서 사라진 dirty(백업 되돌리기가 다른 모습으로 바꿔 앉힌 판) — 올릴 그림이 없다.
         서버에 올린 적 있으면(base) 서버 것으로 돌아간다(못 올린 고침은 되돌리기가 맞바꾼 백업 자리에 있다). 없으면 그대로 둔다. */
      if(i == null || !deskRaw[i]){ if(e.base == null) keep[cid] = e; continue; }
      local[cid] = { def: deskRaw[i], mtime: e.mtime }; continue;
    }
    if(typeof e.def === 'string') local[cid] = { def: e.def, mtime: e.mtime };
  }
  const m = _charsMerge(local, serverChars, opts);
  const out = {}, upload = [], reseat = [], unseat = [], pushServer = {}, trashServer = [], trashLocal = [];
  for(const cid in m.merged){
    const e = m.merged[cid], old = box[cid];
    if(_charsIsTomb(e)){
      out[cid] = { del: e.del };
      if(m.push[cid]) pushServer[cid] = e;
      if(slotOf[cid] != null && m.pull[cid]) unseat.push(slotOf[cid]);
      continue;
    }
    if(typeof e.def === 'string'){
      const pulled = !!m.pull[cid];
      out[cid] = { def: e.def, mtime: e.mtime };
      if(!pulled && old && old.h != null) out[cid].h = old.h;          // 그대로면 기준도 그대로
      if(m.push[cid]) pushServer[cid] = e;
      if(slotOf[cid] != null && pulled) reseat.push({ slot: slotOf[cid], cid });
      continue;
    }
    out[cid] = { def: null, mtime: e.mtime, dirty: true };
    if(old && old.h != null) out[cid].h = old.h;
    upload.push({ slot: slotOf[cid], cid, mtime: e.mtime });
  }
  for(const cid in keep) if(!out[cid]) out[cid] = keep[cid];
  for(const cid in out){ const o = out[cid], b = box[cid]; if(o.dirty && b && b.base != null) o.base = b.base; }
  /* 휴지통은 «잃는 것» 만 — 병합의 진 쪽이 전부 잃는 것은 아니다(평상시 · 개정 36).
     · overwritten: 이 기기가 고치는 사이 서버도 바뀌었을 때만(양쪽 고침). 한쪽만 고친 판의 진 쪽은 **그 기기가 막 올린 한 걸음 전 모습**이라
       남기면 슬라이더 한 번마다 휴지통이 찬다(10일).
     · deleted: 서버 묘비가 이겼는데 이 기기가 안 고쳤으면 버린다 — 지운 기기가 이미 남겼다. 이 기기 묘비가 이겼으면 서버의 마지막 모습이 곧 휴지통 줄이다. */
  const keepTrash = (t) => {
    const b = box[t.cid] || {}, dirty = !!b.dirty;
    if(t.why === 'overwritten') return dirty && _charsEntryTime(serverChars && serverChars[t.cid]) !== b.base;
    if(m.pull[t.cid]) return dirty;
    return true;
  };
  for(const t of m.trash){
    if(!keepTrash(t)) continue;
    if(typeof t.def === 'string') trashServer.push(t);
    else if(slotOf[t.cid] != null) trashLocal.push({ slot: slotOf[t.cid], cid: t.cid, mtime: t.mtime, why: t.why });
  }
  const desk = deskCids.slice(0, CHAR_SLOT_MAX); while(desk.length < CHAR_SLOT_MAX) desk.push(null);
  for(const i of unseat) desk[i] = null;
  return { box: out, deskCids: desk, upload, reseat, unseat, pushServer, trashServer, trashLocal };
}
async function _charsSync(reason){
  if(!_charsActive()) return { ok: false, reason: '꺼져 있음 또는 첫 채택 전' };
  if(_charsSyncing){ _charsSyncAgain = true; return { ok: true, did: '도는 중 — 끝나면 한 번 더' }; }
  _charsSyncing = true;
  try{
    const uid = _charsCachedUid();
    if(!uid || !(window.firebaseAPI && firebaseAPI.loadCharsMetaTs && firebaseAPI.loadCharsRemote && firebaseAPI.saveCharsEntries)) return { ok: false, reason: '통로 없음', code: 'nopath' };
    const gen = _charsGen;
    const box = _charsBoxGet(), desk = _charsDeskGet(), pend = _charsJsonGet(CHARS_TRASH_PEND_KEY, []);
    const mine = desk.some(c => c && box[c] && box[c].dirty) || (Array.isArray(pend) && pend.length > 0);
    const tsKey = CHARS_META_TS_PREFIX + uid;
    const ts = await firebaseAPI.loadCharsMetaTs(uid);
    if(ts === null) return { ok: false, reason: 'charsMeta.ts 읽기 실패', code: 'read' };
    let known = 0; try{ known = Number(localStorage.getItem(tsKey)) || 0; }catch(_){}
    const tombPend = Object.keys(box).some(c => _charsIsTomb(box[c]) && box[c].pend);
    if(!mine && !tombPend && ts === known && reason !== 'force') return { ok: true, did: '할 일 없음' };
    if(typeof creatorOpen() !== 'undefined' && creatorOpen()) return { ok: true, did: '생성기가 열려 있어 다음에', code: 'creator' };
    const cr = await firebaseAPI.loadCharsRemote(uid);
    if(!cr) return { ok: false, reason: '서버 chars 읽기 실패', code: 'read' };
    let prevRaw = null, raw = null;
    try{ prevRaw = localStorage.getItem(LS_KEY); raw = JSON.parse(prevRaw || 'null'); }catch(_){}
    if(!Array.isArray(raw)) raw = [];
    const p = _charsPlanSync(box, desk, raw, cr.chars, {});
    /* ① 올릴 것 — 하나라도 못 바꾸면 아무것도 안 쓴다. */
    const faceSt = _roomFaceCacheLoad(), glbSt = _slotGlbCacheLoad();
    let toJsWhy = '';   // 못 올린 까닭 — 보관함 이동 실패 문구에 실린다(그림 업로드 실패 · 크기 초과를 가른다)
    const toJs = async (obj) => {
      const so = await _slotToServerObj(uid, obj, faceSt, glbSt);
      _roomFaceCacheSave(faceSt); _slotGlbCacheSave(glbSt);
      if(!so){ toJsWhy = 'img'; return null; }
      const js = JSON.stringify(so);
      if(js.length > SLOT_JSON_MAX){ toJsWhy = 'size' + Math.round(js.length / 1000) + 'k'; return null; }
      return js;
    };
    const entries = Object.assign({}, p.pushServer);
    for(const u of p.upload){
      const js = await toJs(raw[u.slot]);
      if(!js) return { ok: false, reason: (u.slot + 1) + '번 칸을 올리지 못함 — 아무것도 안 바꿨다', code: toJsWhy + '@' + (u.slot + 1) };
      entries[u.cid] = { def: js, mtime: u.mtime };
      p.box[u.cid] = { def: js, mtime: u.mtime, h: box[u.cid] && box[u.cid].h };
    }
    const trash = p.trashServer.slice();
    for(const t of p.trashLocal){ const js = await toJs(raw[t.slot]); if(js) trash.push({ cid: t.cid, def: js, mtime: t.mtime, why: t.why }); }
    for(const r of (Array.isArray(pend) ? pend : [])){
      const js = typeof r.def === 'string' ? r.def : (r.raw ? await toJs(r.raw) : null);
      if(!js) return { ok: false, reason: '휴지통 줄을 올리지 못함 — 아무것도 안 바꿨다' };
      trash.push({ cid: r.cid, def: js, mtime: r.mtime, why: r.why === 'overwritten' ? 'overwritten' : 'deleted' });
    }
    /* ② 받을 것 — 그림을 못 받으면 접는다. */
    const next = raw.slice();
    for(const r of p.reseat){
      try{ next[r.slot] = await _slotFromServerObj(JSON.parse(p.box[r.cid].def)); }
      catch(e){ return { ok: false, reason: (r.slot + 1) + '번 칸 그림을 받지 못함 — 아무것도 안 바꿨다', code: 'fetch@' + (r.slot + 1) }; }
    }
    for(const i of p.unseat) next[i] = null;
    /* ③ 서버 — 실패하면 로컬은 안 바꾼다. */
    let w = true;
    if(Object.keys(entries).length){ w = await firebaseAPI.saveCharsEntries(uid, entries); if(!w) return { ok: false, reason: '서버 chars 쓰기 실패', code: 'write' }; }
    if(trash.length && firebaseAPI.appendCharsTrash) await firebaseAPI.appendCharsTrash(uid, trash);
    /* 대기 줄은 **이번에 올린 것만** 지운다 — 도는 사이 휴지통 이동이 또 있었으면 그 줄은 남아야 한다. */
    try{
      const done = new Set((Array.isArray(pend) ? pend : []).map(r => r.cid + ':' + r.mtime));
      const left = _charsJsonGet(CHARS_TRASH_PEND_KEY, []).filter(r => !done.has(r.cid + ':' + r.mtime));
      if(left.length) localStorage.setItem(CHARS_TRASH_PEND_KEY, JSON.stringify(left)); else localStorage.removeItem(CHARS_TRASH_PEND_KEY);
    }catch(_){}
    /* ④ 로컬 — 도중에 칸이 또 바뀌었으면 쓰지 않고 한 번 더 돈다(서버에 쓴 것은 다음 판의 병합이 그대로 맞춘다). */
    if(gen !== _charsGen){ try{ localStorage.setItem(tsKey, '0'); }catch(_){} _charsSyncAgain = true; return { ok: true, did: '도중 바뀜 — 다시' }; }
    const changed = p.reseat.length + p.unseat.length > 0;
    if(changed){
      const str = JSON.stringify(next);
      try{ _slotsBackupSave(prevRaw, str, _slotsFilledCount(str)); }catch(_){}
      try{ localStorage.setItem(LS_KEY, str); }catch(e){ return { ok: false, reason: '책상 칸 저장 실패(저장 공간)' }; }
    }
    try{
      localStorage.setItem(CHARS_DESK_KEY, JSON.stringify(p.deskCids));
      localStorage.setItem(CHARS_BOX_KEY, JSON.stringify(p.box));
      localStorage.setItem(tsKey, String(typeof w === 'number' ? w : (Object.keys(entries).length ? 0 : ts)));
    }catch(e){ return { ok: false, reason: '보관함 저장 실패(저장 공간)' }; }
    if(changed){
      const _old = slots.slice();
      for(let i = 0; i < CHAR_SLOT_MAX; i++){ slots[i] = null; _faceEverDrawn[i] = false; _blinkEverDrawn[i] = false; }
      try{ await loadSlots(); }catch(_){}
      _relinkSeatsToSlots(_old, new Set(p.unseat));
      /* 🩹 #9 — loadSlots 를 기다리는 사이 보관함 이동 등으로 칸이 또 바뀌었으면 옛 모양을 다시 저장하지 않는다
         (보관함과 슬롯 양쪽에 남던 자리). 다음 판이 다시 맞춘다. */
      if(gen !== _charsGen){ _charsSyncAgain = true; return { ok: true, did: '불러오는 중 바뀜 — 다시' }; }
      try{ saveSlots(); }catch(_){}                                  // 받은 칸의 저장 모양을 맞추고 기준(h)을 잡는다 — 받은 것을 고침으로 치지 않는다
      try{ renderLauncher(); }catch(_){}
      try{ slotsReplaced(); }catch(_){}
    }
    return { ok: true, did: reason || '동기화', push: Object.keys(entries).length, reseat: p.reseat.length, unseat: p.unseat.length, trash: trash.length };
  }catch(e){ console.warn('[🧬] 동기화 실패', e); return { ok: false, reason: String(e && e.message || e) }; }
  finally{
    _charsSyncing = false;
    if(_charsSyncAgain){ _charsSyncAgain = false; _charsSchedule(); }
  }
}
/* 부팅 — 서버 이관 → 이 기기 첫 채택 → 평상시. 켜져 있을 때만 아래 setTimeout 이 부른다. */
async function _charsBoot(reason){
  if(!CHARS_SYNC_ENABLED) return { ok: false, reason: '꺼져 있음(CHARS_SYNC_ENABLED)' };
  const uid = _charsCachedUid();
  if(!uid) return { ok: false, reason: '이 기기에 uid 가 없다' };
  /* 30분 박자는 채택을 마친 기기면 ts 한 값 읽기로 끝낸다 — 서버 이관·되돌이 판정은 chars·slots 본문을 읽으므로 부팅에 한 번만. */
  if(reason === 'tick' && _charsActive()) return _charsSync('tick');
  const a = await _charsServerMigrate(uid);
  if(!a.ok) return a;
  const b = await _charsLocalAdopt(uid);
  if(!b.ok) return b;
  if(b.did === '첫 채택'){ try{ renderLauncher(); }catch(_){} }
  return _charsSync(reason || 'boot');
}
async function charsMigrateDryRun(){
  const uid = _charsCachedUid();
  if(!uid) return { ok: false, reason: '이 기기에 uid 가 없다' };
  if(!(window.firebaseAPI && firebaseAPI.loadCharsRemote)) return { ok: false, reason: '통로 없음(firebase-init.js 가 옛 판)' };
  const [cr, sl, pv] = await Promise.all([ firebaseAPI.loadCharsRemote(uid), firebaseAPI.loadSlotsRemote(uid),
    firebaseAPI.loadSlotsPrevRemote ? firebaseAPI.loadSlotsPrevRemote(uid) : Promise.resolve(null) ]);
  if(!cr || !sl) return { ok: false, reason: '서버 읽기 실패' };
  const srv = _charsFromServerSlots(sl, pv, cr.chars);
  const serverChars = Object.assign({}, cr.chars, srv.add, srv.upd);
  let raw = null; try{ raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }catch(_){}
  if(!Array.isArray(raw)) raw = [];
  const loc = _charsFromLocalSlots(raw, _slotsTs(), serverChars, srv.deskCids);
  const m = _charsMerge(loc.local, serverChars, {});
  const plan = _charsPlanLocalAdopt(raw, _slotsTs(), serverChars, srv.deskCids, {});
  /* 그림 URL 에서 해시가 나오는가 — 서버 쪽 def 전부(이미 있는 chars + 이번에 더할 것) */
  let urls = 0, hashed = 0; const oddUrls = [];
  for(const cid in serverChars){
    const o = _charsParseDef(serverChars[cid].def); if(!o) continue;
    const us = SLOT_IMG_FIELDS.map(([f]) => o[f + 'Url']).concat([o.commGlbUrl]);
    for(const u of us){ if(typeof u !== 'string' || !u) continue; urls++; const k = _charsImgKey(u); if(k && k.indexOf('u:') !== 0) hashed++; else if(oddUrls.length < 3) oddUrls.push(u.split('?')[0]); }
  }
  const rows = [];
  for(let i = 0; i < CHAR_SLOT_MAX; i++){
    const d = raw[i], cid = loc.deskCids[i];
    if(!d){ rows.push({ 칸: i + 1, 짝: '빈 칸' }); continue; }
    const k = _charsKeys(d), sk = (cid && serverChars[cid]) ? _charsKeys(serverChars[cid].def) : null;
    const how = loc.fresh.indexOf(cid) >= 0 ? '새 cid' : (k && sk && k.k1 && k.k1 === sk.k1) ? 'K1' : (k && sk && k.k2 === sk.k2) ? 'K2' : '?';
    rows.push({ 칸: i + 1, cid, 짝: how, 내용: (k && sk && k.k2 === sk.k2) ? '같음' : (how === '새 cid' ? '-' : '다름'), 병합: m.push[cid] ? '올림' : m.pull[cid] ? '받음' : '그대로' });
  }
  const rep = {
    ok: true, uid, 켜짐: CHARS_SYNC_ENABLED,
    서버: { 이관됨: !!(cr.meta && cr.meta.migratedAt), meta: cr.meta, chars: Object.keys(cr.chars).length, slots칸: Object.keys(sl.s || {}).length, slotsPrev칸: pv ? Object.keys(pv.s || {}).length : 0,
            더할것: Object.keys(srv.add).length, 고칠것: Object.keys(srv.upd).length },
    이기기: { 칸: raw.filter(Boolean).length, 새cid: loc.fresh.length, 올림: Object.keys(m.push).length, 받음: Object.keys(m.pull).length, 휴지통: m.trash.length, 합친뒤: Object.keys(m.merged).length },
    첫채택: { 보관함: Object.keys(plan.box).length, 책상: plan.deskCids.filter(Boolean).length, 올릴칸: plan.upload.map(u => u.slot + 1),
              바꿔앉힐칸: plan.reseat.map(r => r.slot + 1), 내릴칸: plan.unseat.map(i => i + 1), 이미채택: (()=>{ try{ return localStorage.getItem(CHARS_BOX_KEY) != null; }catch(_){ return null; } })() },
    그림URL: { 전체: urls, 해시꺼냄: hashed, 예: oddUrls },
    칸별: rows,
  };
  try{
    console.log('[🧬 이관 미리보기] 아무것도 쓰지 않았습니다.', rep);
    console.table(rows);
    if(urls && hashed < urls) console.warn('[🧬] 그림 URL ' + urls + '개 중 ' + (urls - hashed) + '개에서 내용 해시를 못 꺼냈습니다 — 그 마리들은 K2(그림 뺀 나머지)로만 짝지어집니다. 예:', oddUrls);
  }catch(_){}
  return rep;
}
try{ window.charsMigrateDryRun = charsMigrateDryRun; }catch(_){}
onSaved(_charsAfterSave);
onBackupRestored(_charsRemapDesk);
setCharsActiveCheck(_charsActive);
/* 🧬 평상시 동기화 배선 — 스위치가 꺼져 있으면 아무것도 걸지 않는다(개정 36). 옛 slots 동기화(4.6초 · 30분) 다음 박자. */
/* 🚀 계정 확인 뒤 한 번(launcher/app-boot.js) */
function startCharsSync(){
  if(!CHARS_SYNC_ENABLED) return;
  setTimeout(()=>{ try{ _charsBoot('boot').then(r => { if(r && r.ok) _bootLinkedFns.forEach(fn=>fn()); }, ()=>{}); }catch(_){} }, 5200);   // F — 첫 채택이 끝난 뒤(개정 57)
  setInterval(()=>{ try{ _charsBoot('tick'); }catch(_){} }, SLOTS_SYNC_INTERVAL_MS);
}

return {
  startCharsSync,
  CHARS_BOX_MAX,
  CHARS_SYNC_ENABLED,
  _charsActive,
  _charsAfterSave,
  _charsBoot,
  _charsBoxFull,
  _charsBoxGet,
  _charsBoxOnlyCount,
  _charsBoxToDesk,
  _charsBoxTrash,
  _charsBoxTrashMany,
  _charsCachedUid,
  _charsDeleteWords,
  _charsDeskGet,
  _charsDeskToBox,
  _charsEntryTime,
  _charsIsTomb,
  _charsMoveFailLog,
  _charsMoveMsg,
  _charsOnNew,
  _charsRemapDesk,
  _charsRestore,
  _charsSync,
  _charsTrashMove,
  _charsTrashView,
  onBootLinked,
};
}

const api = { createChars };
if(typeof window !== 'undefined') window.TwChars = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

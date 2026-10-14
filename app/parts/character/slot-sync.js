/* slot-sync.js — ☁️ 슬롯(캐릭터) 기기 간 동기화 · 연동 UI(런처 띠 · 계정 탭 기기 연동 구획)
   app.js «☁️ 슬롯(캐릭터) 기기 간 동기화» · «☁️ 연동 UI — 띠(런처) · 기기 연동 구획(계정 탭)» 두 구역의 본문을 그대로 옮긴 모듈이다
   (앱 FSD 19번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다. 슬롯 저장 · 복원(saveSlots · loadSlots)은 app.js 에 남는다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 3줄 —
     charsMod · creatorOpen 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 12개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: SLOTS_LASTSYNC_KEY · SLOTS_LOSS_KEY · SLOTS_PUSHFAIL_KEY · SLOTS_SEEN_KEY · SLOTS_SYNC_INTERVAL_MS · SLOTS_TS_KEY · SLOTS_TS_SKEW_TOL_MS · SLOT_GLB_CACHE_KEY · SLOT_IMG_FIELDS · SLOT_JSON_MAX · _slotFromServerObj · _slotGlbCacheLoad · _slotGlbCacheSave · _slotToServerObj · _slotsBackupSave · _slotsConflict · _slotsFilledCount · _slotsHasLocal · _slotsNow · _slotsPushTimer · _slotsRenderAcctSync · _slotsRenderBand · _slotsSchedulePush · _slotsSeen · _slotsTouch · _slotsTs · syncSlotsToServer — app.js 는 slotSyncMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwSlotSync — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-slot-sync-mod.js */
(function(){

function createSlotSync(deps){
const CHAR_SLOT_MAX = deps.CHAR_SLOT_MAX;
const LS_KEY = deps.LS_KEY;
const _blinkEverDrawn = deps._blinkEverDrawn;
const _faceEverDrawn = deps._faceEverDrawn;
const _quickHash = deps._quickHash;
const _roomFaceCacheLoad = deps._roomFaceCacheLoad;
const _roomFaceCacheSave = deps._roomFaceCacheSave;
const _srvNow = deps._srvNow;
const _storageFaceUrlOne = deps._storageFaceUrlOne;
const _warnServerWriteDenied = deps._warnServerWriteDenied;
const charsMod = deps.charsMod;   // 읽는 함수
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const getMyUserId = deps.getMyUserId;
const loadSlots = deps.loadSlots;
const renderCharSlots = deps.renderCharSlots;
const renderLauncher = deps.renderLauncher;
const slotToObj = deps.slotToObj;
const slots = deps.slots;
const toast = deps.toast;
const SLOTS_TS_KEY = 'deskFriends.slots.ts';
const SLOT_GLB_CACHE_KEY = 'tw.slotGlbUrls';
const SLOTS_SYNC_INTERVAL_MS = 30*60*1000;   // 30분 — ts 한 값 읽기라 가챠(10분)보다 드물어도 된다
const SLOTS_PUSH_DEBOUNCE_MS = 3000;
const SLOT_JSON_MAX = 150000;                // 규칙 파일 users/$userId/slots/s/$i .validate 와 같은 값
const SLOTS_TS_SKEW_TOL_MS = 5*60*1000;      // 가챠 GACHA_TS_SKEW_TOL_MS 와 같은 폭
/* 🛟 [2026-09-18 제보 3-7] 덮어쓰기 직전의 로컬 저장본을 **한 벌** 남겨 두는 자리.
   [왜] _slotsAdoptFromServer 는 병합이 아니라 **통째 교체**다(syncSlotsToServer 주석이 직접 말한다 —
     「슬롯은 칸 단위로 합칠 수 없으므로」). 다른 기기에 1칸만 있고 그쪽 ts 가 최신이면 이 기기의
     5칸이 그 1칸으로 바뀐다. 제보자는 그렇게 캐릭터 4개를 잃었고, 그 순간 화면에 나간 말은
     «☁️ 다른 기기에서 저장한 캐릭터를 받아왔어요» 하나뿐이었다 — **되돌릴 자리가 없었다.**
   [무엇] 「직전 한 벌」이면 충분하다(이번 제보도 직전 한 번이면 복구됐다). 병합 여부는 별건이다.
   ⚠️ **백업은 덮어쓰기를 조심해야 한다.** 값진 백업이 하찮은 것으로 덮이면 없느니만 못하다 —
     _slotsBackupSave 의 세 가지 «안 남기는 경우» 가 그것을 지킨다.
   ⚠️ 이 키는 ACCOUNT_LOCAL_KEYS 에 **일부러 안 넣었다.** 그 목록의 규칙은 「다시 로그인하면
     돌아오는 것만 넣는다」인데, 백업은 정의상 **서버에 없는 것**이라 지우면 그것으로 끝이다.
     다른 계정이 주워 가는 길은 restoreSlotsBackup 의 uid 대조로 막는다(그 자리 주석).
   ★ 여기까지가 «자리를 만드는» 일이다. 토스트 문구와 [되돌리기] 버튼은 제보 3-7 할 것 2 —
     UI 가 새로 생기므로 **시안을 받은 뒤**에 한다. 그 전까지의 출구는 F12 콘솔 두 줄이다. */
const SLOTS_BAK_KEY = 'deskFriends.slots.bak';
const SLOTS_BAK_META_KEY = 'deskFriends.slots.bak.meta';
/* ⚖️ [2026-09-20 제보 3-7 후속 ④] «내가 마지막으로 맞춰 본 서버 시각» — 충돌을 실제로 감지하는 값.
   [왜] 지금까지는 ts 큰 쪽이 이겼다. 그러면 「이 기기는 서버가 바뀐 걸 본 적이 없다」와 「이 기기가
     나중에 켜졌다」를 구분할 수 없어서, 회사 PC(1칸·새 기기)가 집 PC(5칸)의 것을 본 적도 없이 그 위에
     올리고, 집 PC 는 그걸 받아 4칸을 잃었다 — 3-7 의 순서가 정확히 그것이다.
   [무엇] 서버와 마지막으로 같아졌던 시각(받아 적었거나 올려서 서버가 내 ts 가 된 시각)을 따로 둔다.
     · 서버 ts = seen  → 서버는 내가 본 그대로. 내 것을 올려도 아무도 안 잃는다.
     · 로컬 ts = seen  → 나는 아무것도 안 바꿨다. 서버 것을 받아도 아무도 안 잃는다.
     · 둘 다 다르다   → **진짜 충돌.** 여기서만 사람에게 묻는다(_slotsConflict). 그 전까지 아무것도 안 덮는다.
   [이관] 이 키가 없는 기기(개정 전)는 **지금 로컬 ts 를 본 것으로 친다**(= 안 바뀐 것으로). 그러면 개정 전과
     똑같이 ts 큰 쪽이 이겨서 아무것도 달라지지 않고, 그 뒤부터 seen 이 따라붙는다.
     ★ 반대로 「없으면 본 적 없음」으로 두면 개정 전에 갈라져 있던 기기를 한 번은 잡아 주지만, ts 만 어긋난
       멀쩡한 기기(오프라인에서 저장한 한 대짜리)까지 전부 묻고, 그 대화상자가 아직 없어서(시안 뒤) 그 기기는
       연동이 멎는다. 잡아 주는 쪽은 로컬 백업(3-7-1)이 받친다 — 그래서 조용한 쪽을 골랐다.
   ⚠️ SLOTS_TS_KEY 와 같이 움직인다 — ACCOUNT_LOCAL_KEYS 에 나란히 넣었고, 계정 정리 때 같이 0 이 된다. */
const SLOTS_SEEN_KEY = 'deskFriends.slots.seen';
let _slotsTs = 0;
let _slotsSeen = 0;
let _slotsConflict = null;     // { sTs, localTs, localCount, serverCount, at } | null — 아직 사람이 안 고른 충돌
let _slotsConflictHandler = null;   // UI 가 꽂는 자리(시안 뒤). 없으면 콘솔 두 줄이 출구다.
function _slotsSeenSet(ts){
  _slotsSeen = (typeof ts === 'number' && ts > 0) ? ts : 0;
  try{ localStorage.setItem(SLOTS_SEEN_KEY, String(_slotsSeen)); }catch(_){}
}
let _slotsSyncing = false, _slotsSyncPending = null, _slotsPushTimer = null;
function _slotsNow(){ return _srvNow(); }
function _slotsHasLocal(){
  try{ const a = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); return Array.isArray(a) && a.some(x => !!x); }
  catch(_){ return false; }
}
function _slotsFilledCount(raw){
  try{ const a = JSON.parse(raw || 'null'); return Array.isArray(a) ? a.reduce((n, x) => n + (x ? 1 : 0), 0) : 0; }
  catch(_){ return 0; }
}
function _slotsBakMeta(){
  try{ const m = JSON.parse(localStorage.getItem(SLOTS_BAK_META_KEY) || 'null'); return (m && typeof m === 'object') ? m : null; }
  catch(_){ return null; }
}
/* 덮어쓰기 직전에 부른다. 남겼으면 true.
   ⚠️ **안 남기는 경우가 요점이다.** 백업은 한 벌이라 아무 때나 갈아 끼우면 잃은 것을 덮는다.
     ① 로컬이 비어 있으면 — 남길 게 없다.
     ② 바뀌는 게 없으면(prevRaw === nextStr) — 같은 내용으로 pull 이 또 돌 때 5칸 백업이
        방금 채택된 1칸으로 덮이는 길이 정확히 이것이다.
     ③ 이미 있는 백업이 **더 많은 칸**을 들고 있으면 — 잃은 5칸이 그 뒤의 평범한 1칸 교체에
        지워지지 않게. (그 뒤에 만든 캐릭터는 서버에 올라가 있으므로 백업의 몫이 아니다)
   ⚠️ 실패해도 **채택을 막지 않는다.** 백업 때문에 캐릭터가 안 따라오면 다른 제보가 생긴다. */
function _slotsBackupSave(prevRaw, nextStr, nextCount){
  const prevCount = _slotsFilledCount(prevRaw);
  if(!prevRaw || prevCount === 0) return false;                       // ①
  if(prevRaw === nextStr) return false;                              // ②
  let old = null; try{ old = localStorage.getItem(SLOTS_BAK_KEY); }catch(_){}
  const oldCount = _slotsFilledCount(old);
  if(old && oldCount > prevCount){                                   // ③
    console.warn('[슬롯] 백업을 그대로 둡니다 — 이미 있는 백업이 ' + oldCount + '칸으로 더 큽니다(이번 직전 값은 ' + prevCount + '칸)');
    return false;
  }
  try{ localStorage.setItem(SLOTS_BAK_KEY, prevRaw); }
  catch(e){ console.warn('[슬롯] 백업을 남기지 못했습니다(저장 공간?) — 채택은 그대로 진행합니다', e); return false; }
  try{
    localStorage.setItem(SLOTS_BAK_META_KEY, JSON.stringify({
      uid: ((getMyUserId() || '')),
      at: _slotsNow(), from: prevCount, to: (nextCount || 0),
    }));
  }catch(_){}                                                         // 본체만 있어도 복원은 된다 — 주인 대조만 못 한다
  return true;
}
/* 🛟 백업 들여다보기 / 되돌리기 — 지금은 **F12 콘솔 전용**이다(화면 버튼은 시안 뒤).
   ⚠️ 되돌리기는 «맞바꾸기» 다 — 지금 값이 백업 자리로 들어가므로 한 번 더 부르면 도로 돌아온다. */
function slotsBackupInfo(){
  let bak = null, cur = null;
  try{ bak = localStorage.getItem(SLOTS_BAK_KEY); cur = localStorage.getItem(LS_KEY); }catch(_){}
  if(!bak){ console.log('[슬롯 백업] 없습니다.'); return null; }
  const m = _slotsBakMeta() || {};
  const info = {
    백업칸수: _slotsFilledCount(bak), 지금칸수: _slotsFilledCount(cur),
    남긴시각: m.at ? new Date(m.at).toLocaleString() : '모름', 계정: m.uid || '모름',
  };
  console.log('[슬롯 백업]', info, '— 되돌리려면 restoreSlotsBackup()');
  return info;
}
async function restoreSlotsBackup(force){
  let bak = null; try{ bak = localStorage.getItem(SLOTS_BAK_KEY); }catch(_){}
  if(!bak){ console.warn('[슬롯 백업] 되돌릴 백업이 없습니다.'); return false; }
  const m = _slotsBakMeta();
  const me = ((getMyUserId() || ''));
  /* ⚠️ 이 키는 로그아웃 때 안 지워진다(위 상수 주석). 그래서 **다른 계정으로 로그인한 사람이
     남의 캐릭터를 주워 가는 길**을 여기서 막는다 — 지우는 대신 대조하는 쪽을 골랐다. */
  if(m && m.uid && me && m.uid !== me && force !== true){
    console.warn('[슬롯 백업] 이 백업은 다른 계정(' + m.uid + ') 것입니다 — 지금 계정은 ' + me + '. 그래도 되돌리려면 restoreSlotsBackup(true).');
    return false;
  }
  let cur = null; try{ cur = localStorage.getItem(LS_KEY); }catch(_){}
  try{
    localStorage.setItem(LS_KEY, bak);
    if(cur !== null) localStorage.setItem(SLOTS_BAK_KEY, cur); else localStorage.removeItem(SLOTS_BAK_KEY);
    localStorage.setItem(SLOTS_BAK_META_KEY, JSON.stringify({ uid: me, at: _slotsNow(), from: _slotsFilledCount(cur), to: _slotsFilledCount(bak), restored: true }));
  }catch(e){ console.warn('[슬롯 백업] 되돌리지 못했습니다', e); return false; }
  /* ⚠️ 시각을 지금으로 찍지 않으면 다음 동기화가 서버 것으로 **또 덮는다** — 30분 뒤에 도로 사라진다.
     찍는다는 것은 「되돌린 이것이 이 계정의 최신」이라는 선언이고, 그래서 서버로도 올라간다.
     다른 기기의 그 칸은 맞바꾼 백업 자리에 남아 있다(한 번 더 부르면 되돌아온다). */
  _slotsTouch();
  for(let i = 0; i < CHAR_SLOT_MAX; i++){ slots[i] = null; _faceEverDrawn[i] = false; _blinkEverDrawn[i] = false; }
  await loadSlots();
  try{ if(typeof charsMod()._charsRemapDesk === 'function') charsMod()._charsRemapDesk(); }catch(_){}   // 🧬 되돌린 칸을 열쇠로 보관함과 다시 짝짓는다(켜져 있을 때만)
  try{ renderLauncher(); }catch(_){}
  try{ renderCharSlots(); }catch(_){}
  try{ _slotsSchedulePush(); }catch(_){}
  _slotsJsonSet(SLOTS_LOSS_KEY, { kind: 'restored', to: _slotsFilledCount(bak), at: _slotsNow() });   // 🛟 띠 ③ · 계정 탭이 읽는다
  _slotsRefreshUI();
  console.log('[슬롯 백업] 되돌렸습니다 — ' + _slotsFilledCount(bak) + '칸. 잠시 뒤 서버에도 올라갑니다. 다시 부르면 도로 맞바뀝니다.');
  try{ toast('🛟 직전 캐릭터를 되돌렸어요 — 책상 위 캐릭터는 앱을 다시 실행하면 바뀌어요'); }catch(_){}
  return true;
}
try{ window.slotsBackupInfo = slotsBackupInfo; window.restoreSlotsBackup = restoreSlotsBackup; }catch(_){}
/* touch 없음 → 지금(서버 시계)으로 찍는다(이 기기에서 바뀌었다).
   숫자 → 서버에서 받아온 시각을 그대로 물려받는다. 새로 찍으면 방금 받은 것을 도로 올리는 핑퐁. */
function _slotsTouch(ts){
  if(typeof ts === 'number' && ts > 0) _slotsTs = ts;
  else _slotsTs = _slotsNow();
  try{ localStorage.setItem(SLOTS_TS_KEY, String(_slotsTs)); }catch(_){}
}
/* 시각 부트스트랩 — 가챠와 같은 규칙.
   · 저장된 시각이 있으면 그대로. · 없는데 캐릭터가 있으면 지금으로(이 노드가 생기기 전부터 로컬에만
   있던 사람 — 이 기기를 '최신'으로 봐야 올라간다). · 둘 다 없으면 0(새 기기라 서버가 이긴다). */
try{
  const _t = parseInt(localStorage.getItem(SLOTS_TS_KEY) || '0', 10);
  if(_t > 0) _slotsTs = _t;
  else if(_slotsHasLocal()) _slotsTouch();
}catch(_){}
try{
  const _sv = localStorage.getItem(SLOTS_SEEN_KEY);
  if(_sv !== null) _slotsSeen = parseInt(_sv, 10) || 0;
  else _slotsSeenSet(_slotsTs);          // ⚖️ 이관 — 키가 없던 기기는 지금 것을 본 것으로(위 주석)
}catch(_){}
function _slotsSchedulePush(){
  try{ if(_slotsPushTimer) clearTimeout(_slotsPushTimer); }catch(_){}
  _slotsPushTimer = setTimeout(()=>{ _slotsPushTimer = null; try{ syncSlotsToServer('save'); }catch(_){} }, SLOTS_PUSH_DEBOUNCE_MS);
}

/* ── GLB 한 덩이 → Storage URL. 얼굴과 같은 «종류_내용해시» 이름 + localStorage 캐시. ── */
function _slotGlbCacheLoad(){
  let st = {}; try{ st = JSON.parse(localStorage.getItem(SLOT_GLB_CACHE_KEY) || '{}'); }catch(_){}
  if(!st || typeof st !== 'object') st = {};
  if(Object.keys(st).length > 40) st = {};
  return st;
}
function _slotGlbCacheSave(st){ try{ localStorage.setItem(SLOT_GLB_CACHE_KEY, JSON.stringify(st)); }catch(_){} }
async function _storageGlbUrlOne(uid, st, key, b64){
  if(typeof b64 !== 'string' || !b64) return null;
  const h = _quickHash(b64);
  const ck = key + ':' + h;
  if(st[ck]) return st[ck];
  const r = await firebaseAPI.uploadSlotGlb(uid, key + '_' + h, b64);
  if(r && r.ok){ st[ck] = r.url; return r.url; }
  return null;
}
/* URL → base64 (GLB 되받기). Storage 는 CORS 허용이라 fetch 가 통한다(말랑이 선물이 같은 길). */
async function _fetchB64(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('HTTP ' + res.status);
  const buf = new Uint8Array(await res.arrayBuffer());
  let s = '';
  for(let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
}
/* URL → PNG dataURL(얼굴 되받기). 방 얼굴과 같은 CORS 로더 — crossOrigin 없이 그리면 캔버스가 오염된다. */
/* URL → dataURL. **바이트를 그대로 옮긴다 — 캔버스를 거치지 않는다.**
   ⚠️ [2026-09-18 · 제보 3-7 (다)] 예전엔 `_roomFaceUrlToCanvas` 로 한 번 그렸다가 다시 뽑았다.
     그 자리가 512 로 고정돼 있어서 512 가 아닌 텍스처가 잘리거나 구석에 몰린 채 **로컬에 저장**됐다.
     받아오는 길에서 그림이 바뀌면 안 된다 — 서버에 있는 것을 그대로 가져오는 게 이 함수의 일이다.
   ★ 다시 인코딩하지 않으니 화질이 안 깎이고 더 빠르다(GLB 를 가져오는 `_fetchB64` 와 같은 방식).
   ⚠️ 실패는 예전처럼 **던진다** — `_slotFromServerObj` 가 그걸 보고 이번 채택을 접는다. */
async function _fetchImgDataUrl(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('HTTP ' + res.status);
  let type = '';
  try{ type = (res.headers && res.headers.get && res.headers.get('content-type')) || ''; }catch(_){}
  type = /^image\//.test(type) ? type.split(';')[0].trim() : 'image/png';
  const buf = new Uint8Array(await res.arrayBuffer());
  let s = '';
  for(let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return 'data:' + type + ';base64,' + btoa(s);
}
/* 얼굴 계열 필드 ↔ Storage 키. 방 입장(ensureRoomFaceUrls)과 **같은 키**여야 같은 파일이 된다. */
const SLOT_IMG_FIELDS = [
  ['face','face'], ['blink','blink'],
  ['animalBody','aBody'], ['animalEarPaintL','aEarL'], ['animalEarPaintR','aEarR'],
  ['animalEarBlinkL','aEarLB'], ['animalEarBlinkR','aEarRB'], ['animalBlink','aBlink'],
];
/* 로컬 저장본 한 칸(dataURL·base64 포함) → 서버용(URL 만). 하나라도 못 올리면 null — 얼굴 없는
   캐릭터를 올려 다른 기기에서 «피부색만 보임»을 만드는 것보다 이번 push 를 접는 쪽이 낫다. */
async function _slotToServerObj(uid, o, faceSt, glbSt){
  if(!o) return null;
  const out = Object.assign({}, o);
  delete out.thumb; delete out._imgBroken; delete out.thumbUrl;
  /* 🖼️ 섬네일(개정 37) — 보관함은 서버 표현만 들고 있어서 슬롯 섬네일을 그리려면 URL 이 있어야 한다.
     얼굴과 달리 **못 올려도 push 를 접지 않는다**(없어도 캐릭터는 멀쩡하다 · 보관함은 얼굴로 대신 그린다).
     새로 찍은 섬네일(dataURL)이 있으면 그것을, 없으면 받아 둔 URL 을 그대로 싣는다. */
  if(typeof o.thumb === 'string' && o.thumb.startsWith('data:')){
    let tu = null; try{ tu = await _storageFaceUrlOne(uid, faceSt, 'thumb', o.thumb); }catch(_){ tu = null; }
    if(tu) out.thumbUrl = tu;
    else if(typeof o.thumbUrl === 'string' && /^https?:\/\//i.test(o.thumbUrl)) out.thumbUrl = o.thumbUrl;
  } else if(typeof o.thumbUrl === 'string' && /^https?:\/\//i.test(o.thumbUrl)) out.thumbUrl = o.thumbUrl;
  for(const [field, key] of SLOT_IMG_FIELDS){
    const v = o[field];
    delete out[field];
    if(typeof v !== 'string' || !v) continue;
    if(!v.startsWith('data:')){ out[field + 'Url'] = v; continue; }   // 이미 URL 인 값은 그대로
    const url = await _storageFaceUrlOne(uid, faceSt, key, v);
    if(!url) return null;
    out[field + 'Url'] = url;
  }
  if(typeof o.commGlb === 'string' && o.commGlb){
    delete out.commGlb;
    const url = await _storageGlbUrlOne(uid, glbSt, 'comm', o.commGlb);
    if(!url) return null;
    out.commGlbUrl = url;
  }
  if(typeof o.deskGlb === 'string' && o.deskGlb){
    delete out.deskGlb;
    const url = await _storageGlbUrlOne(uid, glbSt, 'desk', o.deskGlb);
    if(!url) return null;
    out.deskGlbUrl = url;
  }
  if(o.customItems && typeof o.customItems === 'object'){
    const ci = {};
    for(const id in o.customItems){
      const it = o.customItems[id]; if(!it) continue;
      const rec = Object.assign({}, it);
      if(typeof it.glb === 'string' && it.glb){
        delete rec.glb;
        const url = await _storageGlbUrlOne(uid, glbSt, 'item', it.glb);
        if(!url) return null;
        rec.glbUrl = url;
      }
      ci[id] = rec;
    }
    out.customItems = ci;
  }
  /* 파츠 그림(xf.pic)에 dataURL 이 남아 있으면 뺀다 — 방 전송(serializeDefForNetwork)과 같은 안전망.
     그림은 이 기기 화면엔 그대로 있고, 다음 저장에서 업로드가 되면 URL 로 실린다. */
  if(out.equippedParts){
    try{
      const eq = JSON.parse(JSON.stringify(out.equippedParts));
      const walk = v => {
        if(!v || typeof v !== 'object') return;
        if(Array.isArray(v)){ v.forEach(walk); return; }
        if(typeof v.pic === 'string' && v.pic.startsWith('data:')) delete v.pic;
        for(const k in v) walk(v[k]);
      };
      walk(eq); out.equippedParts = eq;
    }catch(_){}
  }
  // 👂 귀 그림도 같다 — 올리기 전 dataURL 이면 빼고(방 전송 serializeDefForNetwork 와 같은 규칙), 다음 저장에서 URL 로 실린다
  ['earPicL','earPicR'].forEach(k=>{ if(typeof out[k]==='string' && out[k].startsWith('data:')) delete out[k]; });
  return out;
}
/* 서버용 한 칸 → 로컬 저장본(dataURL·base64). loadSlots 가 읽는 모양 그대로 — 그래서 loadSlots 는
   서버 형식을 몰라도 된다. 얼굴·감은눈은 필수라 못 받으면 던진다(호출부가 이번 적용을 접는다). */
async function _slotFromServerObj(so){
  if(!so) return null;
  const out = Object.assign({}, so);
  for(const [field] of SLOT_IMG_FIELDS){
    const u = so[field + 'Url'];
    delete out[field + 'Url'];
    if(typeof u !== 'string' || !u) continue;
    out[field] = await _fetchImgDataUrl(u);
  }
  if(typeof out.face !== 'string' || typeof out.blink !== 'string') throw new Error('얼굴·감은눈 URL 이 없음');
  if(typeof so.commGlbUrl === 'string'){ delete out.commGlbUrl; out.commGlb = await _fetchB64(so.commGlbUrl); }
  if(typeof so.deskGlbUrl === 'string'){ delete out.deskGlbUrl; out.deskGlb = await _fetchB64(so.deskGlbUrl); }
  if(so.customItems && typeof so.customItems === 'object'){
    const ci = {};
    for(const id in so.customItems){
      const it = so.customItems[id]; if(!it) continue;
      const rec = Object.assign({}, it);
      if(typeof it.glbUrl === 'string'){ delete rec.glbUrl; rec.glb = await _fetchB64(it.glbUrl); }
      ci[id] = rec;
    }
    out.customItems = ci;
  }
  out.thumb = null;
  /* slotToObj 를 한 번 지나 **saveSlots 와 같은 키 순서**로 만든다 — 다음 saveSlots 의 문자열 비교가
     «안 바뀜»으로 떨어져야 받은 것을 도로 올리지 않는다. */
  return slotToObj(out);
}
/* 서버 사본을 로컬에 받아 적고 메모리 slots 를 갈아 끼운다. 실패하면 아무것도 안 바꾼다. */
async function _slotsAdoptFromServer(srv){
  const arr = new Array(CHAR_SLOT_MAX).fill(null);
  for(let i = 0; i < CHAR_SLOT_MAX; i++){
    const js = srv.s && srv.s[String(i)];
    if(!js) continue;
    let so; try{ so = JSON.parse(js); }catch(e){ throw new Error((i+1) + '번 칸 JSON 깨짐'); }
    arr[i] = await _slotFromServerObj(so);
  }
  let str; try{ str = JSON.stringify(arr); }catch(e){ throw e; }
  let prevRaw = null; try{ prevRaw = localStorage.getItem(LS_KEY); }catch(_){}
  const same = (prevRaw === str);
  const prevCount = _slotsFilledCount(prevRaw), nextCount = _slotsFilledCount(str);
  /* 🛟 여기가 통째 교체가 일어나는 **유일한 자리**다 — 덮기 직전에 직전 저장본을 한 벌 남긴다. */
  let bakSaved = false;
  try{ bakSaved = _slotsBackupSave(prevRaw, str, nextCount); }catch(_){}
  try{ localStorage.setItem(LS_KEY, str); }
  catch(e){
    /* ⚠️ 방금 남긴 백업이 자리를 먹어 실패했을 수 있다. 백업 때문에 채택이 영영 막히면
       «캐릭터가 안 따라온다» 를 새로 만드는 셈이라, 백업을 물리고 **한 번만** 다시 적는다.
       그래도 실패하면 예전과 똑같이 던진다(호출부가 이번 적용을 접는다). */
    if(!bakSaved) throw e;
    try{ localStorage.removeItem(SLOTS_BAK_KEY); localStorage.removeItem(SLOTS_BAK_META_KEY); }catch(_){}
    bakSaved = false;
    console.warn('[슬롯] 저장 공간이 모자라 백업을 물리고 다시 적습니다', e);
    localStorage.setItem(LS_KEY, str);
  }
  /* 칸 수가 줄어드는 교체는 **사용자에게는 분실**이다. 지금 화면에 나가는 말은 아직
     «받아왔어요» 하나뿐이라(문구 개정은 제보 3-7 할 것 2 · 시안 대기), 최소한 흔적은 남긴다. */
  if(prevCount > nextCount){
    console.warn('[슬롯] 이 기기의 캐릭터 ' + prevCount + '개가 다른 기기의 ' + nextCount + '개로 바뀌었습니다'
      + (bakSaved ? ' — 직전 저장본을 백업에 남겼습니다. 되돌리려면 콘솔에서 slotsBackupInfo() → restoreSlotsBackup()'
                  : ' — ⚠️ 백업을 남기지 못했습니다'));
    /* 🛟 [3-7-2] 사용자에게는 분실이다 — 띠·계정 탭이 읽을 기록. 되돌리거나 [유지하기] 할 때까지 남는다. */
    _slotsJsonSet(SLOTS_LOSS_KEY, { kind: 'loss', from: prevCount, to: nextCount, at: _slotsNow(), bak: !!bakSaved });
  }
  _slotsTouch(srv.ts || _slotsNow());
  _slotsSeenSet(_slotsTs);                    // ⚖️ 서버와 같아졌다
  _slotsConflict = null;
  if(same) return false;                      // 내용은 같고 시각만 뒤처져 있었다 — 화면은 손댈 게 없다
  for(let i = 0; i < CHAR_SLOT_MAX; i++){ slots[i] = null; _faceEverDrawn[i] = false; _blinkEverDrawn[i] = false; }
  await loadSlots();
  try{ renderLauncher(); }catch(_){}
  try{ renderCharSlots(); }catch(_){}
  let running = false;
  try{ const l = document.getElementById('launcher'); running = !(l && l.classList.contains('on')); }catch(_){}
  try{
    if(prevCount > nextCount) toast('⚠️ 이 컴퓨터의 캐릭터 ' + prevCount + '개가 다른 컴퓨터의 ' + nextCount + '개로 바뀌었어요 — 시작 화면에서 되돌릴 수 있어요');
    else toast('☁️ 다른 기기에서 저장한 캐릭터를 받아왔어요' + (running ? ' — 책상 위 캐릭터는 앱을 다시 실행하면 바뀌어요' : ''));
  }catch(_){}
  _slotsNoteSync(true, { serverCount: nextCount });
  return true;
}
/* localStorage 원본 → 서버. 메모리 slots 는 안 본다(_imgBroken 주석). */
async function _slotsPushToServer(uid){
  let raw = null;
  try{ raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }catch(_){ raw = null; }
  if(!Array.isArray(raw)) raw = [];
  const faceSt = _roomFaceCacheLoad(), glbSt = _slotGlbCacheLoad();
  const s = {};
  for(let i = 0; i < CHAR_SLOT_MAX; i++){
    const o = raw[i]; if(!o) continue;
    const so = await _slotToServerObj(uid, o, faceSt, glbSt);
    _roomFaceCacheSave(faceSt); _slotGlbCacheSave(glbSt);   // 올린 만큼은 실패해도 기억해 둔다
    if(!so){ console.warn('[슬롯] ' + (i+1) + '번 칸 이미지/GLB 업로드 실패 — 이번 push 를 접습니다'); _slotsNotePushFail((i+1) + '번 칸 그림을 올리지 못했어요'); return false; }
    const js = JSON.stringify(so);
    if(js.length > SLOT_JSON_MAX){ console.warn('[슬롯] ' + (i+1) + '번 칸이 너무 큽니다(' + js.length + '자) — 규칙 상한 ' + SLOT_JSON_MAX + '. push 를 접습니다'); _slotsNotePushFail((i+1) + '번 칸이 너무 커서 올리지 못했어요'); return false; }
    s[String(i)] = js;
  }
  if(!_slotsTs) _slotsTouch();
  const ok = await firebaseAPI.saveSlotsRemote(uid, s, _slotsTs);
  if(ok === false){ try{ _warnServerWriteDenied('캐릭터'); }catch(_){} _slotsNotePushFail('서버가 쓰기를 거부했어요 — 로그인 상태를 확인해 주세요'); }
  else { _slotsSeenSet(_slotsTs); _slotsConflict = null; _slotsJsonSet(SLOTS_PUSHFAIL_KEY, null); _slotsNoteSync(true, { serverCount: Object.keys(s).length }); }   // ⚖️ 서버가 내 ts 가 됐다
  return ok !== false;
}
/* ⚖️ 충돌을 기록하고 알린다. UI(_slotsConflictHandler)가 없으면 콘솔이 출구다. 같은 서버 ts 로는 한 번만 경고. */
function _slotsConflictNote(c){
  const again = _slotsConflict && _slotsConflict.sTs === c.sTs;
  _slotsConflict = c;
  if(again) return;
  console.warn('[슬롯] ⚖️ 양쪽이 다 바뀌었습니다 — 이 기기 ' + c.localCount + '칸(' + new Date(c.localTs).toLocaleString() + ') · 계정 '
    + c.serverCount + '칸(' + new Date(c.sTs).toLocaleString() + '). 아무것도 덮지 않았습니다. '
    + '고르려면 콘솔에서 resolveSlotsConflict(\'mine\') 또는 resolveSlotsConflict(\'server\')');
  try{ if(typeof _slotsConflictHandler === 'function') _slotsConflictHandler(c); }catch(e){ console.warn('[슬롯] 충돌 UI 실패', e); }
  _slotsRefreshUI();
}
function slotsConflictInfo(){ if(!_slotsConflict){ console.log('[슬롯] 대기 중인 충돌이 없습니다.'); return null; } console.log('[슬롯] 충돌', _slotsConflict); return _slotsConflict; }
/* 사람이 골랐다. 'mine' = 이 기기 것을 올린다(계정 것이 덮인다 — 그 전에 서버 이전 한 벌 ①이 있으면 남긴다).
   'server' = 계정 것을 받는다(이 기기 것은 로컬 백업 3-7-1 에 남는다). */
async function resolveSlotsConflict(which){
  if(which !== 'mine' && which !== 'server'){ console.warn("[슬롯] resolveSlotsConflict('mine' | 'server')"); return false; }
  await syncSlotsToServer('conflict', which === 'mine' ? 'keep-mine' : 'keep-server');
  return !_slotsConflict;
}
try{ window.slotsConflictInfo = slotsConflictInfo; window.resolveSlotsConflict = resolveSlotsConflict; }catch(_){}

const SLOTS_LOSS_KEY = 'deskFriends.slots.loss';
const SLOTS_LASTSYNC_KEY = 'deskFriends.slots.lastsync';
const SLOTS_PUSHFAIL_KEY = 'deskFriends.slots.pushfail';
function _slotsJsonGet(k){ try{ const v = JSON.parse(localStorage.getItem(k) || 'null'); return (v && typeof v === 'object') ? v : null; }catch(_){ return null; } }
function _slotsJsonSet(k, v){ try{ if(v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(_){} }
function _slotsNoteSync(ok, extra){
  const prev = _slotsJsonGet(SLOTS_LASTSYNC_KEY) || {};
  let localCount = 0; try{ localCount = _slotsFilledCount(localStorage.getItem(LS_KEY)); }catch(_){}
  const rec = { at: _slotsNow(), ok: !!ok, localCount };
  if(prev.serverCount != null) rec.serverCount = prev.serverCount;
  Object.assign(rec, extra || {});
  if(!ok && !rec.why) rec.why = '연동하지 못했어요';
  _slotsJsonSet(SLOTS_LASTSYNC_KEY, rec);
  _slotsRefreshUI();
}
function _slotsNotePushFail(why){ _slotsJsonSet(SLOTS_PUSHFAIL_KEY, { why, at: _slotsNow() }); _slotsRefreshUI(); }
function _slotsDismissLoss(){ const l = _slotsJsonGet(SLOTS_LOSS_KEY); if(l){ l.dismissed = true; _slotsJsonSet(SLOTS_LOSS_KEY, l); } _slotsRefreshUI(); }
function _slotsFmtWhen(ts){
  if(!ts) return '—';
  const d = new Date(ts), now = new Date(_slotsNow());
  const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const day = (x) => x.getFullYear() * 10000 + x.getMonth() * 100 + x.getDate();
  if(day(now) === day(d)) return '오늘 ' + hm;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if(day(y) === day(d)) return '어제 ' + hm;
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
}
function _slotsRefreshUI(){ try{ _slotsRenderBand(); }catch(_){} try{ _slotsRenderAcctSync(); }catch(_){} }
/* 버튼 — 속성값 안에 보간을 두지 않는다(audit 검사19). 크기·굵기는 네 갈래 글자 그대로. id·글자는 우리 리터럴이다. */
const _SLOTS_BTN_OPEN = {
  'n':  '<button class="lc-btn" style="flex:1;margin-top:0;font-size:11.5px;font-weight:normal;" id="',
  'b':  '<button class="lc-btn" style="flex:1;margin-top:0;font-size:11.5px;" id="',
  'nL': '<button class="lc-btn" style="flex:1;margin-top:0;font-size:12px;font-weight:normal;" id="',
  'bL': '<button class="lc-btn" style="flex:1;margin-top:0;font-size:12px;" id="',
};
const _slotsBtn = (id, txt, opt) => {
  const k = ((opt && opt.bold) ? 'b' : 'n') + ((opt && opt.size === '12px') ? 'L' : '');
  return _SLOTS_BTN_OPEN[k] + id + '">' + txt + '</button>';
};
/* 되돌리기 — 로컬 백업이 먼저, 없으면 서버 이전 한 벌(①). 버튼을 잠그고 결과를 띠/구획이 다시 그린다. */
async function _slotsRestoreFromUI(btn){
  try{ if(btn) btn.disabled = true; }catch(_){}
  let ok = false;
  try{ ok = await restoreSlotsBackup(); }catch(_){}
  if(!ok){ try{ ok = await restoreSlotsPrevRemote(); }catch(_){} }
  if(!ok){ try{ toast('되돌릴 사본을 찾지 못했어요'); }catch(_){} try{ if(btn) btn.disabled = false; }catch(_){} }
  _slotsRefreshUI();
  return ok;
}
/* 🛟 [①] 서버 이전 한 벌에서 되돌리기 — 로컬 백업이 없을 때의 두 번째 출구. 받은 것을 «지금» 으로 찍어 올린다. */
async function restoreSlotsPrevRemote(){
  if(!(window.firebaseAPI && firebaseAPI.loadSlotsPrevRemote)){ console.warn('[슬롯] 서버 이전 한 벌을 읽는 통로가 없습니다'); return false; }
  const uid = getMyUserId();
  const prev = await firebaseAPI.loadSlotsPrevRemote(uid);
  if(!prev || !Object.keys(prev.s || {}).length){ console.warn('[슬롯] 서버 이전 한 벌이 없습니다'); return false; }
  await _slotsAdoptFromServer({ s: prev.s, ts: _slotsNow() });   // 이제 이것이 최신 — 다음 판에 올라간다
  _slotsJsonSet(SLOTS_LOSS_KEY, { kind: 'restored', to: Object.keys(prev.s).length, at: _slotsNow() });
  try{ _slotsSchedulePush(); }catch(_){}
  return true;
}
try{ window.restoreSlotsPrevRemote = restoreSlotsPrevRemote; }catch(_){}
/* A안 띠 — 세 상태. */
function _slotsRenderBand(){
  const el = document.getElementById('lcSyncBand'); if(!el) return;
  const loss = _slotsJsonGet(SLOTS_LOSS_KEY);
  if(!loss || loss.dismissed){ el.style.display = 'none'; el.innerHTML = ''; return; }
  const warn = () => { el.style.background = '#F3D9A4'; el.style.borderColor = '#B5624A #6d3527 #6d3527 #B5624A'; };
  const calm = () => { el.style.background = 'var(--win-select-bg)'; el.style.borderColor = 'var(--win-lo) var(--win-hi) var(--win-hi) var(--win-lo)'; };
  let html = '';
  if(loss.kind === 'restored'){
    calm();
    html = '<div style="font-weight:bold;color:var(--ink);margin-bottom:6px;">' + loss.to + '개로 되돌렸어요 — 다른 컴퓨터가 켜져 있으면 다시 바뀔 수 있어요</div>'
      + '<div style="display:flex;gap:6px;">' + _slotsBtn('lcSyncOk', '확인') + '</div>';
  }else if(!loss.bak){
    warn();
    html = '<div style="font-weight:bold;color:#3d1f16;margin-bottom:6px;">캐릭터 ' + loss.from + '개가 ' + loss.to + '개로 바뀌었고, 백업을 남기지 못했어요</div>'
      + '<div style="font-size:10px;color:#3d1f16;background:rgba(0,0,0,.07);padding:5px 7px;margin-bottom:6px;">이 컴퓨터의 저장 공간이 모자랐어요. 바뀌기 전 캐릭터는 계정 서버의 이전 사본에 남아 있을 수 있어요 — 계정 탭 › 기기 연동에서 되돌려 보세요.</div>'
      + '<div style="display:flex;gap:6px;">' + _slotsBtn('lcSyncClose', '닫기') + '</div>';
  }else{
    warn();
    html = '<div style="font-weight:bold;color:#3d1f16;margin-bottom:6px;">캐릭터 ' + loss.from + '개가 다른 컴퓨터의 ' + loss.to + '개로 바뀌었어요</div>'
      + '<div style="display:flex;gap:6px;">' + _slotsBtn('lcSyncRestore', '되돌리기', { bold: true }) + _slotsBtn('lcSyncKeep', '유지하기') + '</div>';
  }
  el.innerHTML = html; el.style.display = 'block';
  const $ = id => document.getElementById(id);
  const r = $('lcSyncRestore'); if(r) r.onclick = () => { _slotsRestoreFromUI(r); };
  ['lcSyncKeep', 'lcSyncClose', 'lcSyncOk'].forEach(id => { const b = $(id); if(b) b.onclick = () => _slotsDismissLoss(); });
}
/* B안 구획 — 평상시 / 충돌 미룸 / 줄어든 교체 / 되돌린 직후, 그리고 올리기 실패 상자. */
function _slotsRenderAcctSync(){
  const $ = id => document.getElementById(id);
  const box = $('acctSyncBox'), fail = $('acctSyncFail'); if(!box) return;
  const last = _slotsJsonGet(SLOTS_LASTSYNC_KEY), loss = _slotsJsonGet(SLOTS_LOSS_KEY), pf = _slotsJsonGet(SLOTS_PUSHFAIL_KEY), c = _slotsConflict;
  let localN = 0; try{ localN = _slotsFilledCount(localStorage.getItem(LS_KEY)); }catch(_){}
  const row = (a, b) => '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px;"><span>' + a + '</span><b style="color:var(--ink);">' + b + '</b></div>';
  /* 머리글 색 — 속성값 안에 보간을 두지 않는다(audit 검사19). 세 갈래를 통째 글자로 둔다. */
  const heads = {
    ok:   '<div style="font-size:11px;font-weight:bold;line-height:1.45;color:var(--win-ok,#2a7a3f);">',
    warn: '<div style="font-size:11px;font-weight:bold;line-height:1.45;color:var(--win-error);">',
    '':   '<div style="font-size:11px;font-weight:bold;line-height:1.45;color:var(--ink);">',
  };
  const head = (kind, txt) => (heads[kind] || heads['']) + txt + '</div>';
  const note = (txt) => '<p style="margin:6px 0;font-size:10px;color:var(--ink);line-height:1.55;background:rgba(0,0,0,.05);padding:6px 8px;">' + txt + '</p>';
  let html = '';
  if(c){
    html = head('warn', '양쪽에서 바뀌어 연동을 멈춰 뒀어요') + row('이 컴퓨터', c.localCount + '개') + row('계정 (다른 컴퓨터)', c.serverCount + '개')
      + '<div style="display:flex;margin-top:7px;">' + _slotsBtn('acctSyncPick', '어느 쪽을 쓸지 고르기', { bold: true, size: '12px' }) + '</div>';
  }else if(loss && !loss.dismissed && loss.kind === 'loss'){
    html = head('warn', '이 컴퓨터의 캐릭터 ' + loss.from + '개가<br>다른 컴퓨터의 ' + loss.to + '개로 바뀌었어요') + row('바뀐 때', _slotsFmtWhen(loss.at))
      + note('되돌리면 바뀌기 <b>직전의 이 컴퓨터 상태</b>로 돌아가요. 다른 컴퓨터를 켜 두면 다시 바뀔 수 있으니, 되돌린 뒤엔 그 컴퓨터를 한 번 꺼 주세요.')
      + '<div style="display:flex;">' + _slotsBtn('acctSyncRestore', loss.bak ? loss.from + '개로 되돌리기' : '서버 이전 사본에서 되돌리기', { bold: true, size: '12px' }) + '</div>';
  }else{
    const when = last ? _slotsFmtWhen(last.at) : '—';
    if(loss && !loss.dismissed && loss.kind === 'restored') html = head('ok', loss.to + '개로 되돌렸어요 — 계정에도 올라가는 중이에요');
    else if(!last) html = head('', '아직 연동한 적이 없어요');
    else if(last.ok) html = head('ok', '캐릭터가 연동됐어요.');
    else html = head('warn', '마지막 연동이 실패했어요' + (last.why ? ' — ' + last.why : ''));
    html += row('마지막 연동', when);
    html += row('계정에 저장된 캐릭터', (last && last.serverCount != null ? last.serverCount + '개' : '—') + ' (이 기기 ' + localN + '개)');
  }
  box.innerHTML = html;
  if(fail){
    if(pf){
      fail.innerHTML = '<div style="font-size:10.5px;color:var(--win-error);font-weight:bold;">올리기가 한 번 실패했어요</div>'
        + '<div style="margin-top:3px;">' + pf.why + ' (' + _slotsFmtWhen(pf.at) + '). 이 컴퓨터의 캐릭터가 아직 계정에 안 올라가 있어요.</div>'
        + '<div style="display:flex;margin-top:6px;">' + _slotsBtn('acctSyncRetry', '지금 다시 올리기', { bold: true }) + '</div>';
      fail.style.display = 'block';
    }else{ fail.style.display = 'none'; fail.innerHTML = ''; }
  }
  const pick = $('acctSyncPick'); if(pick) pick.onclick = () => { if(_slotsConflict) _slotsShowConflictDlg(_slotsConflict); };
  const rs = $('acctSyncRestore'); if(rs) rs.onclick = () => { _slotsRestoreFromUI(rs); };
  const rt = $('acctSyncRetry'); if(rt) rt.onclick = () => { rt.disabled = true; rt.textContent = '올리는 중…'; try{ syncSlotsToServer('retry'); }catch(_){} setTimeout(() => { try{ _slotsRenderAcctSync(); }catch(_){} }, 6000); };
}
/* ④ 충돌 대화상자 — 더 많은 쪽을 굵게. [나중에 결정] 은 지금 상태(어느 쪽도 안 덮음)를 그대로 둔다. */
function _slotsShowConflictDlg(c){
  const $ = id => document.getElementById(id);
  const dlg = $('slotConflictDlg'); if(!dlg || !c) return;
  const ln = $('scdLocalN'), sn = $('scdServerN'), la = $('scdLocalAt'), sa = $('scdServerAt'), msg = $('scdMsg');
  if(ln) ln.textContent = c.localCount + '개'; if(sn) sn.textContent = c.serverCount + '개';
  if(la) la.textContent = _slotsFmtWhen(c.localTs) + '에 바뀜'; if(sa) sa.textContent = _slotsFmtWhen(c.sTs) + '에 바뀜';
  const more = c.serverCount >= c.localCount ? 'server' : 'mine';
  const bS = $('scdKeepServer'), bM = $('scdKeepMine'), bL = $('scdLater');
  if(bS){ bS.textContent = '다른 PC(' + c.serverCount + '개)로 맞추기'; bS.style.fontWeight = more === 'server' ? 'bold' : 'normal'; bS.disabled = false; }
  if(bM){ bM.textContent = '현재 PC(' + c.localCount + '개)로 맞추기'; bM.style.fontWeight = more === 'mine' ? 'bold' : 'normal'; bM.disabled = false; }
  if(msg){ msg.style.display = 'none'; msg.textContent = ''; }
  const go = async (which) => {
    if(bS) bS.disabled = true; if(bM) bM.disabled = true;
    let ok = false; try{ ok = await resolveSlotsConflict(which); }catch(_){}
    if(ok){ dlg.style.display = 'none'; try{ toast(which === 'mine' ? '☁️ 이 컴퓨터의 캐릭터로 맞췄어요' : '☁️ 계정의 캐릭터로 맞췄어요 — 책상 위 캐릭터는 앱을 다시 실행하면 바뀌어요'); }catch(_){} }
    else { if(msg){ msg.textContent = '지금은 맞추지 못했어요. 네트워크를 확인한 뒤 다시 눌러 주세요.'; msg.style.display = 'block'; } if(bS) bS.disabled = false; if(bM) bM.disabled = false; }
    _slotsRefreshUI();
  };
  if(bS) bS.onclick = () => go('server');
  if(bM) bM.onclick = () => go('mine');
  if(bL) bL.onclick = () => { dlg.style.display = 'none'; _slotsRefreshUI(); };
  dlg.style.display = 'flex';
}
_slotsConflictHandler = _slotsShowConflictDlg;

function _slotsForcedMode(m){ return m === 'pull' || m === 'keep-mine' || m === 'keep-server'; }
async function syncSlotsToServer(reason, mode){
  if(_slotsSyncing){
    if(!_slotsSyncPending || _slotsForcedMode(mode)) _slotsSyncPending = { reason, mode };   // pull·충돌 해소는 다른 모드에 안 덮인다(가챠와 같다)
    return;
  }
  if(!(window.firebaseAPI && firebaseAPI.loadSlotsTs && firebaseAPI.loadSlotsRemote && firebaseAPI.saveSlotsRemote)) return;
  _slotsSyncing = true;
  try{
    const uid = getMyUserId();
    if(!uid) return;   // 🪪 uid 가 정해지기 전 — 실패 기록(띠·PUSHFAIL)도 남기지 않는다
    const hasLocal = _slotsHasLocal();
    /* 🧬 캐릭터 단위가 켜진 기기(채택 뒤)는 slots 를 **올리기만** 한다(설계 §5-N-3 · 개정 36) — 옛 클라이언트가 남은 기기를 위해서.
       받기(통째 교체)와 ④ 대화상자는 chars 와 서로의 책상을 덮으므로 막는다. 모드(pull·keep-*)도 같다. */
    if(typeof charsMod()._charsActive === 'function' && charsMod()._charsActive()){
      const sTs0 = await firebaseAPI.loadSlotsTs(uid);
      if(sTs0 === null){ _slotsNoteSync(false, { why: '서버를 읽지 못했어요' }); return; }
      if(hasLocal && _slotsTs > sTs0) await _slotsPushToServer(uid);
      else _slotsNoteSync(true);
      return;
    }
    /* 💰 평소에는 ts 한 값만 읽는다. 같으면 본문을 안 내려받고 끝. */
    let sTs;
    if(_slotsForcedMode(mode)){ sTs = null; }
    else{
      sTs = await firebaseAPI.loadSlotsTs(uid);
      if(sTs === null){ _slotsNoteSync(false, { why: '서버를 읽지 못했어요' }); return; }   // 읽기 실패 — 아무것도 안 한다
      if(sTs === _slotsTs && (sTs > 0 || !hasLocal)){           // 같다 = 할 일 없음 (둘 다 0 이고 로컬만 있으면 아래에서 올린다)
        if(_slotsSeen !== sTs) _slotsSeenSet(sTs);              // ⚖️ 같다는 것은 곧 「맞춰 봤다」 — 개정 전 기기는 여기서 seen 을 얻는다
        _slotsNoteSync(true);
        return;
      }
    }
    const _push = async ()=>{ return _slotsPushToServer(uid); };
    /* 🕒 미래 ts 치유 — 시계가 틀어진 기기가 올린 값이면 정상 기기가 영영 받기만 한다.
       슬롯은 칸 단위로 합칠 수 없으므로 **이 기기 것을 지금 시각으로 올린다**(계정당 사실상 한 번). */
    if(typeof sTs === 'number' && sTs > _slotsNow() + SLOTS_TS_SKEW_TOL_MS){
      if(hasLocal){ _slotsTouch(); await _push(); console.warn('[슬롯] 서버 ts 가 미래(' + new Date(sTs).toISOString() + ')라 이 기기 것으로 정정했습니다'); }
      return;
    }
    if(mode === 'pull'){
      const srv = await firebaseAPI.loadSlotsRemote(uid);      // {s, ts} | null
      if(srv === null) return;
      const sHas = Object.keys(srv.s || {}).length > 0;
      if(sHas){ await _slotsAdoptFromServer(srv); }
      else if(hasLocal){ _slotsTouch(); await _push(); }
      return;
    }
    /* ⚖️ 충돌 해소 — 사람이 골랐다. */
    if(mode === 'keep-mine'){
      if(!hasLocal){ _slotsConflict = null; return; }
      /* ① 서버 이전 한 벌 — firebase-init 에 있으면 덮이기 전에 남긴다(없으면 건너뛴다 · 다음 세션 몫). */
      try{ if(firebaseAPI.saveSlotsPrevRemote) await firebaseAPI.saveSlotsPrevRemote(uid); }catch(e){ console.warn('[슬롯] 서버 이전 한 벌 실패', e); }
      _slotsTouch(); await _push();
      return;
    }
    if(mode === 'keep-server'){
      const srv = await firebaseAPI.loadSlotsRemote(uid);
      if(srv === null) return;
      if(Object.keys(srv.s || {}).length > 0){ await _slotsAdoptFromServer(srv); }
      else { _slotsConflict = null; }                          // 그 사이 계정이 비었다 — 받을 게 없다. 로컬은 그대로 둔다
      return;
    }
    /* ⚖️ [④] 충돌 감지 — 양쪽이 다 움직였으면 어느 쪽도 덮지 않고 사람에게 넘긴다.
       serverMoved: 서버가 내가 본 것과 다르다. localDirty: 내가 마지막으로 맞춘 뒤 이 기기에서 바뀌었다.
       한쪽만 움직였으면 아래의 예전 갈래(ts 큰 쪽)가 그대로 처리한다 — 그 경우 ts 큰 쪽이 곧 움직인 쪽이다. */
    if(hasLocal && typeof sTs === 'number' && sTs > 0){
      const serverMoved = (sTs !== _slotsSeen);
      const localDirty  = (_slotsTs !== _slotsSeen);
      if(serverMoved && localDirty){
        const srv = await firebaseAPI.loadSlotsRemote(uid);    // 칸 수를 보여 주려면 한 번은 읽어야 한다(충돌 판에서만)
        if(srv === null) return;
        const serverCount = Object.keys(srv.s || {}).length;
        if(serverCount === 0){ _slotsTouch(); await _push(); return; }   // 계정이 비었다 — 잃을 게 없으니 올린다(전부 지운 계정은 로컬을 안 지운다 — 아래 가지와 같다)
        let localCount = 0; try{ localCount = _slotsFilledCount(localStorage.getItem(LS_KEY)); }catch(_){}
        _slotsConflictNote({ sTs: Number(srv.ts) || sTs, localTs: _slotsTs, localCount, serverCount, at: _slotsNow() });
        return;
      }
    }
    if(sTs > _slotsTs){
      if(typeof creatorOpen() !== 'undefined' && creatorOpen()){ console.log('[슬롯] 서버가 최신이지만 생성기가 열려 있어 이번엔 건너뜁니다'); return; }
      const srv = await firebaseAPI.loadSlotsRemote(uid);
      if(srv === null) return;
      if(Number(srv.ts) !== sTs && Number(srv.ts) <= _slotsTs) return;   // 그 사이 바뀌었다 — 다음 판에
      const sHas = Object.keys(srv.s || {}).length > 0;
      if(sHas){ await _slotsAdoptFromServer(srv); }
      else if(hasLocal){ _slotsTouch(); await _push(); }      // 서버 노드는 있는데 비었다(전부 지운 계정)… 로컬을 지우진 않는다
      else { _slotsTouch(sTs); _slotsSeenSet(sTs); }
    }
    else if(_slotsTs > sTs){ if(hasLocal) await _push(); }
    else if(!sTs && hasLocal){ _slotsTouch(); await _push(); }  // (A) 서버 비었고 로컬 있음 → 첫 push
  }catch(e){ console.warn('[슬롯] 동기화 실패', e); _slotsNoteSync(false, { why: String(e && e.message || e) }); }
  finally{
    _slotsSyncing = false;
    const _pend = _slotsSyncPending; _slotsSyncPending = null;
    if(_pend){ try{ syncSlotsToServer(_pend.reason, _pend.mode); }catch(_){} }
  }
}
/* 부팅 뒤 1회(가챠 4.2초 다음) + 30분마다. 어느 쪽도 ts 한 값 읽기가 전부다. */
setTimeout(()=>{ try{ syncSlotsToServer('boot'); }catch(_){} }, 4600);
setInterval(()=>{ try{ syncSlotsToServer('tick'); }catch(_){} }, SLOTS_SYNC_INTERVAL_MS);

return {
  SLOTS_LASTSYNC_KEY,
  SLOTS_LOSS_KEY,
  SLOTS_PUSHFAIL_KEY,
  SLOTS_SEEN_KEY,
  SLOTS_SYNC_INTERVAL_MS,
  SLOTS_TS_KEY,
  SLOTS_TS_SKEW_TOL_MS,
  SLOT_GLB_CACHE_KEY,
  SLOT_IMG_FIELDS,
  SLOT_JSON_MAX,
  _slotFromServerObj,
  _slotGlbCacheLoad,
  _slotGlbCacheSave,
  _slotToServerObj,
  _slotsBackupSave,
  _slotsConflict: ()=>_slotsConflict,   // 읽는 함수
  setSlotsConflict: (v)=>{ _slotsConflict = v; },   // 쓰는 함수 — app.js 가 비운다
  _slotsFilledCount,
  _slotsHasLocal,
  _slotsNow,
  _slotsPushTimer: ()=>_slotsPushTimer,   // 읽는 함수
  setSlotsPushTimer: (v)=>{ _slotsPushTimer = v; },   // 쓰는 함수 — app.js 가 비운다
  _slotsRenderAcctSync,
  _slotsRenderBand,
  _slotsSchedulePush,
  _slotsSeen: ()=>_slotsSeen,   // 읽는 함수
  setSlotsSeen: (v)=>{ _slotsSeen = v; },   // 쓰는 함수 — app.js 가 비운다
  _slotsTouch,
  _slotsTs: ()=>_slotsTs,   // 읽는 함수
  setSlotsTs: (v)=>{ _slotsTs = v; },   // 쓰는 함수 — app.js 가 비운다
  syncSlotsToServer,
};
}

const api = { createSlotSync };
if(typeof window !== 'undefined') window.TwSlotSync = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

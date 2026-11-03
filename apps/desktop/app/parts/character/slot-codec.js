/* slot-codec.js — 🧬 캐릭터 한 칸 ↔ 서버 def 바꾸기 (검사 sim-slot-codec.js)
   책임: 화면이 들고 있는 캐릭터 저장 모양(그림은 dataURL · GLB 는 base64)을 서버 def(그림 · GLB 는 우리 Storage 주소)로, 그 반대로 바꾼다.
     올리는 그림은 «종류_내용해시» 이름이라 같은 그림은 같은 파일(다시 올리지 않음)이고, 올린 주소는 이 PC 의 올리기 캐시(tw.slotGlbUrls · 얼굴은 room-sync)에 기억한다.
     이 캐시는 «이 PC 와 서버를 맞추는 사본» 이 아니라 올리기 중복 막기용이다 — 지워져도 다시 올릴 뿐 값은 서버가 원본이다.
   어디서 왔나: slot-sync.js(0.12 의 기기 간 동기화)에서 변환 부분만 떼었다 — 맞추기 · 충돌 · 백업 · 연동 화면은 서버 원본으로 걷었다. 본문은 그대로.
   deps: glbUploadCache(shared/upload-cache.js) · _quickHash · _storageFaceUrlOne · slotToObj · uploadGlb(uid, key, b64) → { ok, url } (Storage 올리기)
   내보냄: createSlotCodec(deps) → { SLOT_IMG_FIELDS · SLOT_JSON_MAX · SLOT_GLB_CACHE_KEY · _slotGlbCacheLoad · _slotGlbCacheSave · _slotToServerObj · _slotFromServerObj }
   ⚠️ 서버 def 크기 상한은 150000자(SLOT_JSON_MAX) — 부르는 쪽(closet.js)이 JSON 길이로 먼저 본다.
   classic script — window.TwSlotCodec. 전역 fetch · localStorage · atob/btoa 를 쓴다. */
(function(){

function createSlotCodec(deps){
const glbUploadCache = deps.glbUploadCache;   // 업로드 캐시 상한 규칙(shared/upload-cache.js)
const _quickHash = deps._quickHash;
const _storageFaceUrlOne = deps._storageFaceUrlOne;
const slotToObj = deps.slotToObj;
const uploadGlb = deps.uploadGlb;
const SLOT_GLB_CACHE_KEY = 'tw.slotGlbUrls';
const SLOT_JSON_MAX = 150000;                // 서버 def 상한(글자 수) — 서버 규격과 같은 값
/* ── GLB 한 덩이 → Storage URL. 얼굴과 같은 «종류_내용해시» 이름 + localStorage 캐시. ── */
function _slotGlbCacheLoad(){
  let st = {}; try{ st = JSON.parse(localStorage.getItem(SLOT_GLB_CACHE_KEY) || '{}'); }catch(_){}
  if(!st || typeof st !== 'object') st = {};
  return glbUploadCache.trim(st, glbUploadCache.GLB_CACHE_MAX);   // 상한 규칙은 shared/upload-cache.js 한 곳
}
/* 저장 직전에 지금 저장본과 합친다 — 슬롯 올리기 · 보관함이 각자 사본을 들고 있다가 앞의 것을 지우던 길. */
function _slotGlbCacheSave(st){
  try{
    let cur = {}; try{ cur = JSON.parse(localStorage.getItem(SLOT_GLB_CACHE_KEY) || '{}'); }catch(_){}
    const out = glbUploadCache.trim(glbUploadCache.merge(cur, st), glbUploadCache.GLB_CACHE_MAX);
    localStorage.setItem(SLOT_GLB_CACHE_KEY, JSON.stringify(out));
  }catch(_){}
}
async function _storageGlbUrlOne(uid, st, key, b64){
  if(typeof b64 !== 'string' || !b64) return null;
  const h = _quickHash(b64);
  const ck = key + ':' + h;
  if(st[ck]){ glbUploadCache.touch(st, ck); return st[ck]; }
  const r = await glbUploadCache.once('glb/' + uid + '/' + ck, ()=>uploadGlb(uid, key + '_' + h, b64));
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

return {
  SLOT_GLB_CACHE_KEY,
  SLOT_IMG_FIELDS,
  SLOT_JSON_MAX,
  _slotFromServerObj,
  _slotGlbCacheLoad,
  _slotGlbCacheSave,
  _slotToServerObj,
};
}

const api = { createSlotCodec };
if(typeof window !== 'undefined') window.TwSlotCodec = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

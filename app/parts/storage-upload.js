/* ═══ Storage 업로드 줄이기 — parts/storage-upload.js ═══════════════════════════════════════
   app.js 보다 먼저 로드된다(desk-companion-prototype.html). 여기 함수는 전역이라 app.js 가 쓴다.
   Firebase 를 직접 부르지 않는다 — 올리기는 부르는 쪽이 넘긴 함수(fn)가 한다.

   같은 그림이 Storage 에 같은 이름으로 몇 번씩 다시 올라가던 길 넷을 막는다.
   ① createUploadShare — 같은 «종류:내용해시» 업로드가 동시에 두 번 나가지 않게 진행 중 Promise 를 나눠 쓰고,
      이번 실행에서 이미 받은 URL 은 기억해 둔다. 슬롯 push 와 chars 동기화가 3초 뒤 동시에 돌며
      각자 캐시 사본을 들고 같은 그림을 두 번 올리던 것.
   ② createUploadCache — localStorage 캐시(«종류:해시» → URL). 저장할 때 디스크를 **다시 읽어 합친다**
      (사본끼리 덮어써 남이 기억한 항목을 지우지 않게). 넘치면 통째로 비우지 않고 오래 안 쓴 것부터 버린다.
   ③ thumbSigOf — 캐릭터 외모 지문. 런처 섬네일은 외모가 바뀌었을 때만 다시 찍는다.
   ④ applyUrlSwaps — 올리고 받은 URL 을 원본 자리에 되써 넣는다(마이홈 — 다음 저장에서 다시 안 올린다). */

/* ① 진행 중 업로드 나눠 쓰기. key 는 uid 까지 넣어 만든다(계정을 바꾼 뒤 남의 URL 을 받지 않게).
   실패(null · 예외)는 기억하지 않는다 — 다음 저장에서 다시 시도한다(예전 동작). */
function createUploadShare(deps){
  const memoMax = (deps && deps.memoMax) || 300;
  const inflight = new Map(), memo = new Map();
  function run(key, fn){
    if(memo.has(key)) return Promise.resolve(memo.get(key));
    if(inflight.has(key)) return inflight.get(key);
    const p = (async () => {
      try{
        const v = await fn();
        if(v){
          memo.set(key, v);
          if(memo.size > memoMax) memo.delete(memo.keys().next().value);
        }
        return v;
      }finally{ inflight.delete(key); }
    })();
    inflight.set(key, p);
    return p;
  }
  return { run, known: key => memo.get(key) || null, pending: () => inflight.size, forget: () => memo.clear() };
}

/* ② localStorage 캐시. deps:
   store       — getItem/setItem 을 가진 것(localStorage · 검사용 가짜)
   key         — 저장 키
   max         — 전체 상한
   groupMax    — { '접두사': 상한 } (예: 'thumb:' 는 섬네일이 칸마다 바뀌어도 몇 장만 남게)
   isStale(k)  — 먼저 버릴 항목(예: 해시 형식이 옛것인 키)
   migrate(st) — 읽은 직후 옛 형태를 고치는 함수(선택)
   ★ 순서 = 오래 안 쓴 것이 앞. 이번 실행에서 쓴(touch) 키는 뒤로 간다. 이번 실행에서 안 쓴 키는 저장된 순서 그대로. */
function createUploadCache(deps){
  const { store, key } = deps;
  const max = deps.max || 60;
  const groupMax = deps.groupMax || {};
  const isStale = deps.isStale || null;
  let seq = 0;
  const used = new Map();
  function read(){
    let st = {};
    try{ st = JSON.parse(store.getItem(key) || '{}'); }catch(_){ st = {}; }
    if(!st || typeof st !== 'object' || Array.isArray(st)) st = {};
    if(deps.migrate){ try{ deps.migrate(st); }catch(_){} }
    return st;
  }
  function order(st){
    const ks = Object.keys(st);
    const cold = ks.filter(k => !used.has(k));
    const hot = ks.filter(k => used.has(k)).sort((a, b) => used.get(a) - used.get(b));
    return cold.concat(hot);
  }
  function trim(st){
    let ks = order(st);
    for(const pre of Object.keys(groupMax)){
      const g = ks.filter(k => k.startsWith(pre));
      if(g.length > groupMax[pre]){
        const drop = new Set(g.slice(0, g.length - groupMax[pre]));
        ks = ks.filter(k => !drop.has(k));
      }
    }
    if(ks.length > max && isStale){
      let over = ks.length - max;
      ks = ks.filter(k => { if(over > 0 && isStale(k)){ over--; return false; } return true; });
    }
    if(ks.length > max) ks = ks.slice(ks.length - max);
    const out = {};
    for(const k of ks) out[k] = st[k];
    return out;
  }
  function touch(k){ used.set(k, ++seq); }
  function load(){ return trim(read()); }
  /* 디스크를 다시 읽어 합친다 — 같은 키면 이 사본 값이 이긴다(이름이 곧 내용 해시라 값이 같다). */
  function save(st){
    const merged = Object.assign(read(), st || {});
    const out = trim(merged);
    try{ store.setItem(key, JSON.stringify(out)); }catch(_){}
    return out;
  }
  function peek(k){ const v = read()[k]; return typeof v === 'string' && v ? v : null; }
  return { load, save, touch, peek, trim };
}

/* ③ 외모 지문. obj = slotToObj(def) 모양(그림은 dataURL 문자열). 외모와 무관한 칸을 빼고
   키 정렬 JSON 의 해시. 버전 머리(v1)는 섬네일 찍는 방식이 바뀌면 올려 한 번 다시 찍게 한다.
   ★ 빼는 것이 «외모와 무관하다고 확신하는 칸» 뿐이다 — 모르는 칸이 생기면 지문에 들어가
     섬네일을 한 번 더 찍는 쪽으로 틀린다(안 찍는 쪽으로 틀리면 옛 모습이 남는다). */
const THUMB_SIG_SKIP = ['thumb', 'thumbUrl', 'thumbSig', '_imgBroken', 'cid', 'partXfMemory', 'commName'];
const THUMB_SIG_VER = 'v1';
function _tsStable(v){
  if(Array.isArray(v)) return '[' + v.map(_tsStable).join(',') + ']';
  if(v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + _tsStable(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
function thumbSigOf(obj, hash){
  if(!obj || typeof obj !== 'object') return null;
  const o = {};
  for(const k of Object.keys(obj)){
    if(THUMB_SIG_SKIP.indexOf(k) >= 0 || k.charAt(0) === '_') continue;
    o[k] = obj[k];
  }
  return THUMB_SIG_VER + hash(_tsStable(o));
}

/* ④ URL 되쓰기. swaps = [{ at:['stickers','s1','img'], from:'data:…', to:'https://…' }].
   지금 그 자리의 값이 **올린 그 dataURL 그대로일 때만** 바꾼다 — 저장이 도는 사이 사용자가 그림을 바꿨으면 손대지 않는다.
   돌려주는 값: 바꾼 수. */
function applyUrlSwaps(data, swaps){
  if(!data || typeof data !== 'object' || !Array.isArray(swaps)) return 0;
  let n = 0;
  for(const s of swaps){
    if(!s || !Array.isArray(s.at) || !s.at.length || typeof s.to !== 'string' || !/^https:\/\//.test(s.to)) continue;
    let o = data;
    for(let i = 0; i < s.at.length - 1 && o; i++) o = (o && typeof o === 'object') ? o[s.at[i]] : null;
    const last = s.at[s.at.length - 1];
    if(o && typeof o === 'object' && o[last] === s.from){ o[last] = s.to; n++; }
  }
  return n;
}

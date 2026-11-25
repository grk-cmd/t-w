/* own-image.js — 🖼 내 그림을 Storage 내 폴더에 바로 올리기 한 곳 (검사 sim-own-image.js)
   [왜] 마이홈 · 디데이 카드 · 박수 · 말랑이 그림은 0.13 까지 서버(POST /v2/me/images)를 거쳐 올렸다. 0.14 부터 앱이 Storage 에 바로 올리고,
     Storage 규칙이 «경로의 코드가 이 로그인의 것인가» 를 본다(tw-docs design/12-storage-owner.md). 서버는 받은 주소가 내 폴더 · 그 쓰임 이름인지만 본다.
     규칙은 계정이 바뀐 것을 못 막는다 — 경로의 코드도 지금 계정 것이라, 앞 계정 화면에서 고른 그림이 새 계정 폴더로 간다. 그래서 읽은 계정(expectOwner)을 올리기 직전에 견준다.
   [이름] users/{내 코드}/{머리}_{무작위 id}.{확장자} — 머리는 서버 검사와 같다(mh · dday · clap · mallang). 올릴 때마다 새 이름(1년 캐시라 덮으면 옛 그림이 보인다).
   [내보냄] window.TwOwnImage
     KINDS — 쓰임 → 이름 머리
     pathOf(kind, userCode, id, type) → 경로 | null(모르는 쓰임 · 형식 · 빈 코드)
     createOwnImage({ myCode, newId, put, later, owner }) → { upload(kind, img, { expectOwner }) → Promise<다운로드 URL> }
       owner() — 지금 로그인 uid(토큰 sub 와 같은 값). expectOwner 가 있고 다르면 요청 없이 OWNER_CHANGED(api-client 의 expectOwner 와 같은 뜻).
       put(path, bytes, type) → { done: Promise<다운로드 URL>, cancel() } — 올리기 · 주소 받기를 TIMEOUT_MS 안에 끝내지 못하면 cancel() 하고 IMAGE_UPLOAD(cause.code TIMEOUT).
       later(fn, ms) → 해제 함수 — 시간 재기(검사가 바꿔 끼운다).
       img 는 TwImageBytes.inspect 가 통과시킨 { type, bytes } — 형식 · 크기 판정은 부르는 provider 가 먼저 한다.
       코드가 없으면 NO_USER, Storage 가 거절하거나 닿지 못하면 IMAGE_UPLOAD 로 던진다(부르는 provider 의 «그림을 못 올림» 과 같은 번호).
   classic script — 쓰는 provider · app.js 보다 먼저 싣는다. 아무것도 부르지 않는다(Storage 는 put 으로 받는다). */
(function(){
'use strict';

const KINDS = Object.freeze({ myhome: 'mh', dday: 'dday', clap: 'clap', mallang: 'mallang' });
const EXT = Object.freeze({ 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' });
const SAFE = /^[A-Za-z0-9_-]{1,64}$/;
// Storage SDK 는 올리기를 10분 · 주소 받기를 2분까지 다시 해서, 망이 끊기면 «올리는 중» 이 안 풀린다 — 0.13 서버 올리기(WRITE_TIMEOUT_MS)와 같은 10초로 끊는다
const TIMEOUT_MS = 10000;

function codeError(code, msg){ const e = new Error(msg); e.code = code; return e; }

function pathOf(kind, userCode, id, type){
  const head = Object.prototype.hasOwnProperty.call(KINDS, kind) ? KINDS[kind] : null;
  const ext = Object.prototype.hasOwnProperty.call(EXT, type) ? EXT[type] : null;
  if(!head || !ext || !SAFE.test(String(userCode || '')) || !SAFE.test(String(id || ''))) return null;
  return 'users/' + userCode + '/' + head + '_' + id + '.' + ext;
}

/** @param {{ myCode: () => (string|null), newId: () => string, put: (path: string, bytes: Uint8Array, contentType: string) => { done: Promise<string>, cancel: () => void }, later: (fn: () => void, ms: number) => () => void, owner: () => (string|null) }} deps */
function createOwnImage(deps){
  const myCode = deps.myCode;
  const newId = deps.newId;
  const put = deps.put;
  const later = deps.later;
  const owner = deps.owner;

  /* put 한 번 — TIMEOUT_MS 를 넘기면 cancel() 하고 TIMEOUT 으로 끝낸다 */
  function putWithin(path, bytes, type){
    const job = put(path, bytes, type);
    return new Promise((resolve, reject) => {
      const stop = later(() => { try{ job.cancel(); }catch(_){} reject(codeError('TIMEOUT', TIMEOUT_MS + 'ms 안에 못 올렸어요')); }, TIMEOUT_MS);
      job.done.then((v) => { stop(); resolve(v); }, (e) => { stop(); reject(e); });
    });
  }
  return {
    async upload(kind, img, opts){
      const expectOwner = opts && opts.expectOwner;
      if(expectOwner && owner() !== expectOwner) throw codeError('OWNER_CHANGED', '로그인한 사람이 바뀌어 올리지 않았어요');
      const code = myCode();
      if(!code) throw codeError('NO_USER', '내 코드가 없어 그림을 올릴 수 없어요');
      const path = img ? pathOf(kind, code, newId(), img.type) : null;
      if(!path) throw codeError('IMAGE_UPLOAD', '그림을 올리지 못했어요');
      let url;
      try{ url = await putWithin(path, img.bytes, img.type); }
      catch(e){ const err = codeError('IMAGE_UPLOAD', '그림을 올리지 못했어요'); err.cause = e; throw err; }
      if(typeof url !== 'string' || !url) throw codeError('IMAGE_UPLOAD', '그림 주소를 받지 못했어요');
      return url;
    },
  };
}

const api = { KINDS, TIMEOUT_MS, pathOf, createOwnImage };
if(typeof window !== 'undefined') window.TwOwnImage = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

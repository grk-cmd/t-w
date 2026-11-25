/* own-image.js — 🖼 내 그림을 Storage 내 폴더에 바로 올리기 한 곳 (검사 sim-own-image.js)
   [왜] 마이홈 · 디데이 카드 · 박수 · 말랑이 그림은 0.13 까지 서버(POST /v2/me/images)를 거쳐 올렸다. 0.14 부터 앱이 Storage 에 바로 올리고,
     Storage 규칙이 «경로의 코드가 이 로그인의 것인가» 를 본다(tw-docs design/12-storage-owner.md). 서버는 받은 주소가 내 폴더 · 그 쓰임 이름인지만 본다.
   [이름] users/{내 코드}/{머리}_{무작위 id}.{확장자} — 머리는 서버 검사와 같다(mh · dday · clap · mallang). 올릴 때마다 새 이름(1년 캐시라 덮으면 옛 그림이 보인다).
   [내보냄] window.TwOwnImage
     KINDS — 쓰임 → 이름 머리
     pathOf(kind, userCode, id, type) → 경로 | null(모르는 쓰임 · 형식 · 빈 코드)
     createOwnImage({ myCode, newId, put }) → { upload(kind, img) → Promise<다운로드 URL> }
       img 는 TwImageBytes.inspect 가 통과시킨 { type, bytes } — 형식 · 크기 판정은 부르는 provider 가 먼저 한다.
       코드가 없으면 NO_USER, Storage 가 거절하거나 닿지 못하면 IMAGE_UPLOAD 로 던진다(부르는 provider 의 «그림을 못 올림» 과 같은 번호).
   classic script — 쓰는 provider · app.js 보다 먼저 싣는다. 아무것도 부르지 않는다(Storage 는 put 으로 받는다). */
(function(){
'use strict';

const KINDS = Object.freeze({ myhome: 'mh', dday: 'dday', clap: 'clap', mallang: 'mallang' });
const EXT = Object.freeze({ 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' });
const SAFE = /^[A-Za-z0-9_-]{1,64}$/;

function codeError(code, msg){ const e = new Error(msg); e.code = code; return e; }

function pathOf(kind, userCode, id, type){
  const head = Object.prototype.hasOwnProperty.call(KINDS, kind) ? KINDS[kind] : null;
  const ext = Object.prototype.hasOwnProperty.call(EXT, type) ? EXT[type] : null;
  if(!head || !ext || !SAFE.test(String(userCode || '')) || !SAFE.test(String(id || ''))) return null;
  return 'users/' + userCode + '/' + head + '_' + id + '.' + ext;
}

/** @param {{ myCode: () => (string|null), newId: () => string, put: (path: string, bytes: Uint8Array, contentType: string) => Promise<string> }} deps */
function createOwnImage(deps){
  const myCode = deps.myCode;
  const newId = deps.newId;
  const put = deps.put;
  return {
    async upload(kind, img){
      const code = myCode();
      if(!code) throw codeError('NO_USER', '내 코드가 없어 그림을 올릴 수 없어요');
      const path = img ? pathOf(kind, code, newId(), img.type) : null;
      if(!path) throw codeError('IMAGE_UPLOAD', '그림을 올리지 못했어요');
      let url;
      try{ url = await put(path, img.bytes, img.type); }
      catch(e){ const err = codeError('IMAGE_UPLOAD', '그림을 올리지 못했어요'); err.cause = e; throw err; }
      if(typeof url !== 'string' || !url) throw codeError('IMAGE_UPLOAD', '그림 주소를 받지 못했어요');
      return url;
    },
  };
}

const api = { KINDS, pathOf, createOwnImage };
if(typeof window !== 'undefined') window.TwOwnImage = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

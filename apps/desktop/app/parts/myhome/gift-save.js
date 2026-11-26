/* gift-save.js — 💝 받은 말랑이 선물을 내 컴퓨터에 그림 파일로 저장 (검사 sim-gift-save.js)
   [왜] 선물함 칸 우클릭 → [저장]. 그림을 다시 그리지 않고 받은 바이트를 그대로 저장한다 — GIF 는 움직임이 산다.
   ⚠️ 저장 위치는 여기서 정하지 않는다 — a.download 를 누르면 Electron 기본 저장 창이 뜬다(스티커사진 저장과 같다).
     그래서 사용자가 창에서 취소할 수 있어 «저장했어요» 알림은 띄우지 않는다.
   ⚠️ 그림 주소는 친구가 정한 값이다 — safeUrl(…, 'image') 를 거친 주소만 받는다(https · data:image).
   내보냄: window.TwGiftSave = { fileName, extOf, createGiftSave }.
   createGiftSave(deps) — fetch · document · URL · setTimeout · safeUrl · now · notifyFail(err). 돌려줌 { save(gift) }.
   myhome-inbox.js · app.js 보다 먼저 싣는 classic script. */
(function(){

const NAME_MAX = 20;                                   // 보낸 사람 이름 — 선물에 저장될 때 이미 20자로 자른다(firebase-init.js)
const BAD_CH = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;     // Windows · mac 파일 이름에 못 쓰는 글자
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
const REVOKE_MS = 4000;

const pad = (n)=>String(n).padStart(2, '0');

/* 그림 형식 → 확장자. 모르는 형식은 png(선물은 대부분 png 로 다시 올린 것이다). */
function extOf(type){
  return EXT[String(type || '').split(';')[0].trim().toLowerCase()] || 'png';
}

/* 말랑이_보낸사람_날짜.확장자 — 날짜는 받은 시각(when). 이름이 비거나 못 쓰는 글자뿐이면 «친구». */
function fileName(fromName, when, type){
  let who = String(fromName == null ? '' : fromName).replace(BAD_CH, '_').replace(/^[\s.]+|[\s.]+$/g, '').slice(0, NAME_MAX);
  if(!who || /^_+$/.test(who)) who = '친구';
  const d = when;
  const stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  return '말랑이_' + who + '_' + stamp + '.' + extOf(type);
}

function createGiftSave(deps){
  const fetchFn = deps.fetch;
  const doc = deps.document;
  const URL = deps.URL;   // 이름을 URL 로 둔다 — sim-safe-html 이 URL.createObjectURL 을 «이 기기가 만든 주소» 로 안다
  const later = deps.setTimeout;
  const safeUrl = deps.safeUrl;
  const now = deps.now;
  const notifyFail = deps.notifyFail;

  /* gift = { imgUrl, fromName, ts } — 'ok' · 'fail' */
  async function save(gift){
    const url = gift && gift.imgUrl ? safeUrl(gift.imgUrl, 'image') : '';
    if(!url){ notifyFail(new Error('그림 주소 없음')); return 'fail'; }
    try{
      const res = await fetchFn(url);
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      if(!blob || !blob.size || !/^image\//.test(blob.type || '')) throw new Error('그림 아님');
      const when = (Number.isFinite(gift.ts) && gift.ts > 0) ? new Date(gift.ts) : now();
      const href = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = href;
      a.download = fileName(gift.fromName, when, blob.type);
      doc.body.appendChild(a); a.click(); a.remove();
      later(()=>URL.revokeObjectURL(href), REVOKE_MS);
      return 'ok';
    }catch(e){
      notifyFail(e);
      return 'fail';
    }
  }
  return { save };
}

const api = Object.freeze({ fileName, extOf, createGiftSave });
if(typeof window !== 'undefined') window.TwGiftSave = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

/* safe-html.js — 🛡️ 남이 쓸 수 있는 값을 화면(HTML · 속성 · 주소 · CSS)에 넣는 단 한 곳 (검사 sim-safe-html.js)
   [왜] 닉네임 «초마 <뚱쟁이>» · «병준이<3» · «>_<» 는 진짜 이름이다 — 지우거나 거절하지 않고 **친 그대로 보이게** 하되
     HTML 로는 절대 읽히지 않게 한다. 예전에는 파일마다 강도가 다른 escape 가 따로 있었고(따옴표 ' 를 안 막는 것 등)
     몇 곳은 아예 날값을 innerHTML · src 에 붙였다.
   ★ 새 escape 를 다른 파일에 만들지 않는다 — sim-safe-html.js 가 parts/ 전체를 파서로 훑어 빨강을 낸다.
   ★ 프로퍼티(`el.textContent` · `el.title` · `img.src`)에 넣을 때는 text/attr 을 쓰지 않는다 — `&lt;` 가 글자로 보인다.
     주소는 프로퍼티라도 safeUrl 을 거친다.
   받는 것 없음(실릴 때 바로 쓴다). 내보냄: window.TwSafeHtml = { text, attr, safeUrl, cssUrl, cssColor, linkify }.
   app.js · 쓰는 모듈보다 먼저 싣는 classic script. */
(function(){

const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const LINK_MAX = 2048;   // 링크 주소 길이 상한 — 이보다 길면 정상 링크가 아니다(붙여 넣은 덩어리 · 공격 글)
/* 그림은 이 네 형식의 base64 data: 와 https: 만. https 호스트는 아직 좁히지 않는다(따로 정할 일) */
const DATA_IMAGE = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]*={0,2}$/i;

/* 마크업 글자 안에 넣을 값 — 다섯 글자를 막는다. ⚠️ 하나라도 빼면 속성값 안에서 뚫린다 */
function text(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ENT[c]);
}

/* 속성값 안에 넣을 값 — text 와 같고 보이지 않는 제어 글자를 뺀다(줄바꿈 · 탭은 title 여러 줄이 써서 남긴다) */
function attr(s){
  return text(String(s == null ? '' : s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''));
}

/* 주소 — 허용하지 않으면 ''. kind 'image' = data:image(png·jpeg·webp·gif) base64 · https: / 'link' = https: · http:.
   new URL 로 읽어 대소문자 · 앞 공백 · 탭 섞기(JaVaScRiPt: · \tjavascript:)도 실제 스킴으로 판정한다. 돌려주는 값은 정규화한 주소 */
function safeUrl(u, kind){
  if(typeof u !== 'string') return '';
  const s = u.trim();
  if(!s) return '';
  if(kind === 'image' && DATA_IMAGE.test(s)) return s;
  if(kind !== 'image' && kind !== 'link') return '';
  if(s.length > LINK_MAX) return '';
  let p;
  try{ p = new URL(s); }catch(_){ return ''; }   // 상대 주소 · //evil 은 기준이 없어 여기서 떨어진다
  if(p.protocol === 'https:') return p.href;
  if(kind === 'link' && p.protocol === 'http:') return p.href;
  return '';
}

/* CSS 배경 그림 — `url("…")` 통째로. 허용하지 않으면 '' */
function cssUrl(u){
  const s = safeUrl(u, 'image');
  if(!s) return '';
  return 'url("' + s.replace(/[\\"]/g, '\\$&').replace(/[\n\r\f]/g, '') + '")';
}

/* CSS 색 · 그라데이션 값(`style.background = 색`) — 주소를 부르는 글(url( · image( · image-set( · element( · src( · @import)이나
   다른 선언으로 넘어가는 글자(; { } \ < > 따옴표)가 있으면 ''. 색 이름 · #hex · rgb() · hsl() · linear-gradient() · var(--x) 는 그대로 */
const CSS_BAD = /url\s*\(|image(?:-set)?\s*\(|element\s*\(|src\s*\(|@import|expression\s*\(|[;{}\\<>"'`]/i;
const CSS_MAX = 400;
function cssColor(c){
  if(typeof c !== 'string') return '';
  const s = c.trim();
  if(!s || s.length > CSS_MAX || CSS_BAD.test(s) || /[\x00-\x1F\x7F]/.test(s)) return '';
  return s;
}

/* 글 속 http(s) 주소를 누를 수 있는 칸으로 — 나머지 글은 text 로 씻는다. 주소는 safeUrl('link') 를 지난 것만.
   칸은 <span class="ext-link" data-url="…"> 다(<a href> 아님) — 누르면 앱 화면이 그 페이지로 넘어가지 않고,
   부르는 쪽 클릭 처리가 data-url 을 다시 safeUrl 로 거른 뒤 기본 브라우저(companion.openBrowser)로 연다.
   문장 끝 문장부호(. , ; : ! ? ) ])는 주소에 넣지 않는다. */
const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/gi;
const URL_TAIL = /[.,;:!?)\]]+$/;
function linkify(s){
  const str = String(s == null ? '' : s);
  let out = '', last = 0, m;
  URL_IN_TEXT.lastIndex = 0;
  while((m = URL_IN_TEXT.exec(str))){
    const raw = m[0].replace(URL_TAIL, '');
    const url = safeUrl(raw, 'link');
    if(!url) continue;
    out += text(str.slice(last, m.index)) + '<span class="ext-link" data-url="' + attr(url) + '">' + text(raw) + '</span>';
    last = m.index + raw.length;
  }
  return out + text(str.slice(last));
}

const api = Object.freeze({ text, attr, safeUrl, cssUrl, cssColor, linkify });
if(typeof window !== 'undefined') window.TwSafeHtml = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

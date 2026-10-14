/* rich-text.js — 🛡️ 리치 텍스트 sanitize · 저장 · 글자 수
   app.js «🛡️ 리치 텍스트 sanitize · 저장 · 글자 수» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 42번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 1개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _mhLoadRT · _mhSaveRT · _mhStripHtml · _mhUpdateRTCount — app.js 는 richTextMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwRichText — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-rich-text.js */
(function(){

function createRichText(deps){
const escHtml = deps.escHtml;
// ★ 마이홈 4: 리치 텍스트 sanitize / load / count 헬퍼
//   허용 태그: B/STRONG, I/EM, U, SPAN·DIV·P(style), FONT(color, size — execCommand가 만듦),
//   BR, A(href), IMG(src, alt). 그 외 태그·이벤트 속성은 전부 제거.
//   허용 style 속성은 아래 정규식이 정하는 다섯 개다: color · background-color · font-size ·
//   font-weight · font-style. (예전 주석은 'color, font-size' 둘만이라고 했는데 실제와 달랐다)
const _MH_ALLOWED_TAGS = new Set(['B','STRONG','I','EM','U','SPAN','FONT','BR','DIV','P','A','IMG']);
/* 🎨 [제보 2026-09-23] "게시글 글자에 준 배경색이 재접속하면 풀린다 — 띄어쓰기에 준 것만 남는다."
   [원인] 크로미움의 backColor 는 선택 범위가 **이미 있는 서식 태그 하나를 꼭 채우면** 새 span 을 만들지 않고
     그 태그에 style 을 붙인다 — `<font color=".." style="background-color:..">글</font>` · `<b style="..">`.
     (실제 크로미움으로 재현: 글자색·크기·굵게를 먼저 준 글자는 전부 이 모양이다.) 그런데 여기 목록에서
     FONT·B 등에는 style 이 없어서 저장할 때 지워졌다. 띄어쓰기는 보통 그런 태그 밖이라 span 으로 남았다.
   ★ 서식 태그 전부에 style 을 연다 — 값은 아래 style 필터(다섯 속성만)를 그대로 거치므로 위험이 늘지 않는다.
   ⚠️ 이 선언은 **한 줄**로 둔다 — sim-mh-sanitize.js 가 줄 단위(cutLine)로 떼어 가서 돌린다. */
const _MH_ALLOWED_ATTRS = { A:['href'], IMG:['src','alt'], FONT:['color','size','style'], SPAN:['style'], DIV:['style'], P:['style'], B:['style'], STRONG:['style'], I:['style'], EM:['style'], U:['style'] };
/* 🖼️ 남의 bio·게시글 속 `<img>` 를 어디까지 허용하는가 — **정책은 이 한 줄에만 있다.**
     'any'          : http(s) 전부 (지금 값). 남의 글을 여는 것만으로 그 서버에 요청이 나간다 = IP 노출
     'storage-only' : `_MH_IMG_HOSTS` 만. 기존 저장에 든 외부 이미지는 안 보이게 된다
     'none'         : IMG 를 통째로 지운다
   ★ 정책 결정을 코드 구조에서 떼어내려고 상수로 뺐다. 뒤집을 때 이 값 하나만 바꾼다 —
     sanitizer 본체도 부르는 자리도 안 건드린다.
   ⚠️ `javascript:` 같은 스크립트 스킴은 이 값과 **무관하게** 늘 막힌다(아래 스킴 검사). */
const _MH_IMG_SRC = 'any';
const _MH_IMG_HOSTS = [/(^|\.)googleapis\.com$/i, /(^|\.)firebasestorage\.app$/i, /(^|\.)appspot\.com$/i];
function _mhImgSrcOk(v){
  if(_MH_IMG_SRC === 'any') return true;
  if(_MH_IMG_SRC === 'none') return false;
  try{ return _MH_IMG_HOSTS.some(re => re.test(new URL(String(v), 'https://x.invalid').hostname)); }
  catch(e){ return false; }
}
function _mhSanitizeNode(node){
  if(node.nodeType===3) return;   // 텍스트 노드 그대로
  if(node.nodeType!==1){ node.remove(); return; }
  const tag = node.tagName;
  if(!_MH_ALLOWED_TAGS.has(tag)){
    // 허용 안 된 태그 → 자식만 남기고 자기 자신은 언래핑
    while(node.firstChild) node.parentNode.insertBefore(node.firstChild, node);
    node.remove();
    return;
  }
  // 🖼️ IMG 정책이 'none' 이면 언래핑이 아니라 삭제다 — 자식이 없는 태그라 남길 것이 없다
  if(tag==='IMG' && _MH_IMG_SRC==='none'){ node.remove(); return; }
  // 허용된 태그도 속성은 화이트리스트만 남김 (특히 on* 이벤트/스타일의 위험한 값 제거)
  const allowed = _MH_ALLOWED_ATTRS[tag] || [];
  Array.from(node.attributes).forEach(a=>{
    const name=a.name.toLowerCase();
    if(!allowed.includes(name)){ node.removeAttribute(a.name); return; }
    // href/src는 http(s) / mailto만 허용 (javascript: 등 스크립트 스킴 차단)
    if((name==='href'||name==='src') && !/^(https?:|mailto:)/i.test(a.value)){
      node.removeAttribute(a.name);
      return;
    }
    // 🖼️ 스킴이 통과했어도 IMG src 는 정책(_MH_IMG_SRC)을 한 번 더 본다
    if(name==='src' && tag==='IMG' && !_mhImgSrcOk(a.value)){ node.removeAttribute(a.name); return; }
    // style은 color·font-size만 허용
    if(name==='style'){
      const clean = a.value.split(';').map(s=>s.trim()).filter(s=>/^(color|background-color|font-size|font-weight|font-style)\s*:/i.test(s)).join(';');
      if(clean) node.setAttribute('style', clean); else node.removeAttribute('style');
    }
  });
  // 자식 재귀 sanitize (복사본으로 순회 — 도중 삭제 방지)
  Array.from(node.childNodes).forEach(_mhSanitizeNode);
}
// 편집기에서 HTML 뽑아 sanitize + 글자수 하드 리밋(순수 텍스트 기준으로 자름)
function _mhSaveRT(el, maxChars){
  const tmp = document.createElement('div'); tmp.innerHTML = el.innerHTML;
  Array.from(tmp.childNodes).forEach(_mhSanitizeNode);
  // 글자수는 텍스트 기준. 초과분은 뒤에서 잘라 이미지·태그 구조를 깨트리지 않게 함.
  if(tmp.innerText.length > maxChars){
    // 간단하게: 텍스트 노드를 앞에서부터 세다가 초과 지점에서 나머지 텍스트 노드 제거
    let remain = maxChars;
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT, null);
    const toTrim = []; const toRemove = [];
    let n; while((n=walker.nextNode())){
      const len = n.nodeValue.length;
      if(remain<=0) toRemove.push(n);
      else if(len>remain){ toTrim.push([n, remain]); remain=0; }
      else remain -= len;
    }
    toTrim.forEach(([n,keep])=>{ n.nodeValue = n.nodeValue.slice(0, keep); });
    toRemove.forEach(n=>n.remove());
  }
  return tmp.innerHTML;
}
/* 🩹 겹쳐 쌓인 &amp; 사슬을 한 겹으로 되돌린다 — `&amp;amp;amp;nbsp;` → `&nbsp;`
   [경위] 아래 _mhLoadRT 가 **태그만** 보고 HTML 인지 판정했다. 편집기가 만든
     `친구들(NCP)&nbsp;잡아서` 처럼 **태그 없이 엔티티만 있는** 저장은 옛 평문으로 오판돼
     옛 `_mhEsc`(지금은 `escHtml` 로 합쳐졌다)가 `&` 를 `&amp;` 로 한 겹 씌우고,
     그 상태로 편집기에 들어갔다가 다시 저장되면서
     열고 저장할 때마다 `amp;` 가 한 겹씩 쌓였다(제보 화면에는 아홉 겹이었다 = 그만큼 오간 것).
     아래 판정을 고치면 **더 쌓이지는 않지만**, 이미 쌓인 저장은 영원히 그대로 보인다. 그래서 편다.
   ⚠️ **읽는 시점에만** 편다. 저장값을 일괄 변환하지 않는다(_isLegacyAuthorCompensation 의 그 원칙) —
     한 번 갈아엎으면 판단이 틀렸을 때 되돌릴 원본이 없다.
   ⚠️ 엔티티 모양으로 끝나는 사슬만 편다. `Tom & Jerry` 의 홑 `&` 는 이 정규식에 안 걸린다.
     맞바꾼 것: 진짜로 `&amp;` 라는 **글자**를 보이려던 사람은 `&` 로 펴진다 —
     아홉 겹으로 깨져 보이는 쪽을 고치는 게 낫다고 판단했다. */
function _mhHealEntities(s){
  return String(s).replace(/&(?:amp;)+((?:[a-z]+|#\d+);)/gi, '&$1');
}
/* 🛡️ 저장된 HTML 문자열을 sanitize 해서 문자열로 돌려준다 — **읽는 쪽**용.
   [왜 있나] 예전엔 sanitize 가 `_mhSaveRT`(저장) 한쪽에만 걸려 있었다. 그런데 `_mhLoadRT` 가
     그리는 `_myHomeData` 는 **남의 마이홈을 볼 때 남의 데이터**이고, RTDB `users/$uid/home` 은
     `.write:true` 에 타입·길이 검사뿐이다(앱에 Firebase Auth 가 없어 소유자를 증명할 방법이
     없다 — 규칙으로는 못 막는다). 즉 저장 경로를 안 거치고 심은 HTML 이 보는 사람 화면에서
     그대로 실행됐다. 저장형 XSS. **읽는 쪽 sanitize 가 이 구조에서 유일한 방어선이다.**

   ⚠️ `createElement('div')` + `innerHTML` 로 하면 **안 된다.** 문서에 안 붙은 div 라도 크롬은
     그 안의 `<img>` 를 로드한다 — `onerror` 가 sanitize 보다 먼저 터지고 IP 도 그때 나간다.
     `DOMParser` 가 만든 문서는 브라우징 컨텍스트가 없어 로드도 실행도 일어나지 않는다.
     (`_mhStripHtml` 이 먼저 같은 이유로 DOMParser 를 쓰고 있다)
   ⚠️ 그래서 `_mhSaveRT` 는 **안 바꿨다.** 그쪽은 이미 화면에 붙어 있는 편집기(`el.innerHTML`)를
     읽으므로 새로 노출될 것이 없고, `innerText` 로 글자수를 세는데 DOMParser 문서에는
     레이아웃이 없어 `innerText` 가 안 나온다.
   ⚠️ 실패하면 **원본을 돌려주지 않는다.** 태그를 걷어낸 글자만 돌려준다 — sanitize 못 한 HTML 을
     그리는 것이 이 함수가 막으려던 바로 그 일이다. */
function _mhSanitizeHtml(html){
  const str = String(html==null ? '' : html);
  if(str.indexOf('<') < 0) return str;   // 태그가 없으면 그릴 태그도 없다 (엔티티는 글자로만 풀린다)
  try{
    const doc = new DOMParser().parseFromString(str, 'text/html');
    if(!doc || !doc.body) throw new Error('DOMParser body 없음');
    Array.from(doc.body.childNodes).forEach(_mhSanitizeNode);
    return doc.body.innerHTML;
  }catch(e){
    console.warn('[마이홈] sanitize 실패 — 태그를 걷어내고 글자만 표시', e);
    return escHtml(str.replace(/<[^>]*>/g, ''));
  }
}
// 옛 저장(평문) 하위 호환 — HTML로 안 보이면 이스케이프+개행→<br>
function _mhLoadRT(v){
  if(!v) return '';
  const s = _mhHealEntities(String(v));
  /* ★ 판정에 **엔티티**를 더한다. 태그가 없어도 `&nbsp;`·`&#39;` 가 있으면 편집기가 만든 HTML 이다.
     ⚠️ 홑 `&` 는 일부러 안 넣었다. 그것까지 HTML 로 보면 `Tom & Jerry` 같은 진짜 평문이
       이스케이프를 못 받아 깨진다 — 이 검사가 넓어질 때 정확히 그게 위험하다. */
  /* ⚠️ 순서: heal → 판정 → **sanitize**. sanitize 를 heal 앞에 넣으면 아홉 겹 `&amp;` 가 되살아난다
       (위 _mhHealEntities 주석의 그 제보). 그리고 판정 뒤여야 옛 평문이 이중으로 안 씻긴다. */
  if(/<[a-z][^>]*>|&(?:[a-z]+|#\d+);/i.test(s)) return _mhSanitizeHtml(s);   // HTML이면 sanitize 해서
  return escHtml(s).replace(/\n/g,'<br>');
}
// 툴바 글자수 카운트 갱신 (텍스트 기준). 초과 시 빨간색 강조.
function _mhUpdateRTCount(targetId){
  const target=document.getElementById(targetId); if(!target) return;
  const bar=document.querySelector('.mh-rt-toolbar[data-target="'+targetId+'"]'); if(!bar) return;
  const countEl=bar.querySelector('.mh-rt-count'); if(!countEl) return;
  const max=parseInt(countEl.dataset.max,10)||120;
  const n=target.innerText.length;
  countEl.textContent = n+' / '+max;
  countEl.classList.toggle('over', n>max);
}
/* 리치텍스트(<b>, <i>, <span style=...> 등)에서 태그를 걷어내고 순수 텍스트만 뽑음.
   친구 목록의 한 줄 요약처럼 서식이 필요 없는 곳에서 씀 — 태그가 글자로 보이는 걸 방지.
   DOMParser로 파싱하므로 스크립트가 실행되지 않고, textContent만 취해 안전함. */
function _mhStripHtml(html){
  if(!html) return '';
  // 🩹 여기도 같은 저장값을 본다 — 안 펴면 친구 목록 한 줄 요약에 `&amp;nbsp;` 가 그대로 뜬다.
  const str = _mhHealEntities(String(html));
  if(str.indexOf('<') < 0 && str.indexOf('&') < 0) return str;   // 태그·엔티티 없으면 그대로
  try{
    const doc = new DOMParser().parseFromString(str, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }catch(e){
    return str.replace(/<[^>]*>/g, '').trim();   // 폴백
  }
}

return {
  _mhLoadRT,
  _mhSaveRT,
  _mhStripHtml,
  _mhUpdateRTCount,
};
}

const api = { createRichText };
if(typeof window !== 'undefined') window.TwRichText = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

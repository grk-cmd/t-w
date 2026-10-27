/* gacha-album.js — 🎰 도감 규칙(꾸미기 창 «도감» 탭) — 어떤 도감이 있는지 · 몇 개 모았는지 · 줄에 보일 그림 · 페이지.
   순수 함수다(DOM · firebase · 저장 없음). 화면은 gacha.js 가 그린다.
   ★ 도감 = «⭐ 상시» 하나 + 시즌(봄 · 여름 · 가을 · 겨울) — 파츠가 하나라도 있는 것만 줄을 세운다.
     파츠의 rec.season 이 비면 상시, 아는 시즌 이름이면 그 시즌이다. 모르는 이름은 어느 도감에도 넣지 않는다
     (뽑기 풀도 아는 시즌만 돈다 — 넣으면 영영 못 모으는 칸이 생긴다).
   ★ 줄 그림 셋은 **뽑은 파츠에서만** 고른다 — 안 뽑은 파츠의 그림은 도감 안에서도 «???» 로 가린다.
   검사: checks/sim-gacha-album.js */
(function(){

const ALBUM_KEYS = Object.freeze(['', 'spring', 'summer', 'autumn', 'winter']);   // 줄 순서 — '' = 상시
const ALBUM_LABEL = Object.freeze({ '':'⭐ 상시', spring:'🌸 봄', summer:'🌊 여름', autumn:'🍂 가을', winter:'❄ 겨울' });
const ALBUM_THUMBS = 3;

function isAlbumKey(key){ return typeof key === 'string' && ALBUM_KEYS.includes(key); }

/* 그 도감에 드는 파츠 — 등록 순서(order)대로 */
function albumParts(parts, key){
  if(!isAlbumKey(key)) return [];
  return (parts || []).filter(p => p && (p.season || '') === key)
    .sort((a, b) => (a.order | 0) - (b.order | 0));
}

/* 도감 줄 목록 — count(id) 는 뽑은 수. 파츠가 없는 도감은 뺀다. */
function albumList(parts, count){
  const out = [];
  ALBUM_KEYS.forEach(key => {
    const list = albumParts(parts, key);
    if(!list.length) return;
    const owned = list.filter(p => (count(p.id) | 0) > 0);
    out.push({ key, label: ALBUM_LABEL[key], total: list.length, owned: owned.length, thumbs: owned.slice(0, ALBUM_THUMBS) });
  });
  return out;
}

/* 모은 비율(0~100 정수) — 진행 막대 폭 */
function albumPct(owned, total){
  if(!(total > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((owned | 0) * 100 / total)));
}

/* 📄 페이지 — 몇 쪽인지 · 쪽 번호 바로잡기 · 그 파츠가 있는 쪽 */
function pageCount(n, size){ return Math.max(1, Math.ceil((n | 0) / size)); }
function clampPage(page, n, size){ return Math.min(pageCount(n, size) - 1, Math.max(0, page | 0)); }
function pageOf(list, id, size){
  const at = (list || []).findIndex(p => p.id === id);
  return at < 0 ? -1 : Math.floor(at / size);
}

const api = { ALBUM_KEYS, ALBUM_LABEL, ALBUM_THUMBS, isAlbumKey, albumParts, albumList, albumPct, pageCount, clampPage, pageOf };
if(typeof window !== 'undefined') window.TwGachaAlbum = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

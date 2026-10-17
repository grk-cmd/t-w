/* myhome-preset.js — 👑 디자인 프리셋 규칙: «지금 디자인 → 칸» · «칸 → 지금 디자인» · 저장본 씻기 · 그림 키 · 그림 올릴 이름 (검사 sim-myhome-preset.js)
   [왜] 이 판단이 디자인 스튜디오(myhome-edit.js)의 저장 · 불러오기 · 이름 고치기 · 칸 그리기 · IMG 올리기에 흩어져 있었다.
     한쪽만 고치면 칸에 담는 것과 칸에서 꺼내는 것이 어긋난다(그림 키를 하나 빠뜨리면 칸끼리 같은 파일을 덮는다).
   ★ 순수 함수만 — DOM · firebase · _myHomeData 를 모른다. 받은 값을 고치지 않고 새 값을 돌려준다.
   받는 것 없음(실릴 때 바로 만든다). 내보냄: window.TwMyHomePreset = { MAX, NAME_MAX, imgKeyOf, imgKeys, normalize, cur, snapshot, apply, uploadSlot }.
   app.js · myhome-edit.js 보다 먼저 싣는 classic script. */
(function(){

const MAX = 3;        // 칸 수
const NAME_MAX = 8;   // 칸 이름 — 세 칸이 340px 안에 나란히 서므로 길면 잘린다

/* 디자인 스튜디오 항목(_MH_DS_ROWS 의 한 줄) → 그 항목 그림이 들어가는 theme 키 */
function imgKeyOf(row){ return row.imgKey || (row.key + 'Img'); }
/* 그림 키 집합 — 항목 표에서 뽑는다. 여기에 다시 적으면 항목이 늘 때 한쪽만 고쳐진다 */
function imgKeys(rows){
  const s = new Set();
  Object.keys(rows || {}).forEach(tab=>{
    (rows[tab] || []).forEach(row=>{ if(row && row.img && !row.group) s.add(imgKeyOf(row)); });
  });
  return s;
}
/* 저장본을 늘 MAX 칸 배열로 씻는다.
   ⚠️ Realtime DB 는 빈 자리가 있는 배열을 {0:…, 2:…} 객체로 돌려준다 — 배열로 단정하면 두 칸만 저장한 사람의 목록이 사라진다. */
function normalize(raw){
  const out = new Array(MAX).fill(null);
  if(!raw || typeof raw !== 'object') return out;
  for(let i = 0; i < MAX; i++){
    const p = raw[i];
    if(!p || typeof p !== 'object') continue;
    out[i] = {
      name : String(p.name || '').slice(0, NAME_MAX),
      theme: (p.theme && typeof p.theme === 'object') ? p.theme : {},
      bg   : (p.bg && p.bg.color) ? { color: p.bg.color } : null,
    };
  }
  return out;
}
/* 고른 칸 번호 — 틀린 값이면 0 */
function cur(raw){
  const n = parseInt(raw, 10);
  return (n >= 0 && n < MAX) ? n : 0;
}
/* 지금 디자인(home = { theme, bg }) → 칸 한 벌. **색만** 담는다(그림 키 · 바깥 그림은 뺀다) */
function snapshot(home, keys, name){
  const h = home || {};
  const t = h.theme || {};
  const theme = {};
  Object.keys(t).forEach(k=>{ if(!keys.has(k) && t[k]) theme[k] = t[k]; });
  return {
    name : name || '',
    theme,
    bg   : (h.bg && h.bg.color) ? { color: h.bg.color } : null,
  };
}
/* 칸 한 벌을 지금 디자인에 얹은 결과 { theme, bg } — 부르는 쪽이 home 에 넣는다.
   ★ 색은 통째로 갈린다 — 칸에 없는 색은 지운다(얹기만 하면 이전 디자인 색이 섞인다).
   ⚠️ 그림 키와 바깥 그림은 손대지 않는다. bg 는 color 와 img 가 배타적이라 그림이 깔려 있으면 bg 를 그대로 둔다. */
function apply(home, preset, keys){
  const h = home || {};
  const curTheme = h.theme || {};
  const theme = {};
  Object.keys(curTheme).forEach(k=>{ if(keys.has(k)) theme[k] = curTheme[k]; });
  Object.keys(preset.theme || {}).forEach(k=>{ if(!keys.has(k)) theme[k] = preset.theme[k]; });
  const bg = (h.bg && h.bg.img) ? h.bg : ((preset.bg && preset.bg.color) ? { color: preset.bg.color } : null);
  return { theme, bg };
}
/* 디자인 스튜디오 IMG 를 올릴 이름(uploadUserImage 의 slot → users/{uid}/design_{slot}.jpg) — 이름을 정하는 곳은 여기 하나.
   key: 바깥 배경이면 'bg', 그 밖에는 그림 키 */
function uploadSlot(key){ return String(key); }

const api = { MAX, NAME_MAX, imgKeyOf, imgKeys, normalize, cur, snapshot, apply, uploadSlot };
if(typeof window !== 'undefined') window.TwMyHomePreset = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

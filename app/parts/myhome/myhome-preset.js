/* myhome-preset.js — 👑 디자인 프리셋 규칙: «지금 디자인 → 칸» · «칸 → 지금 디자인» · 저장본 씻기 · 그림 키 · 그림 올릴 이름 (검사 sim-myhome-preset.js)
   [왜] 이 판단이 디자인 스튜디오(myhome-edit.js)의 저장 · 불러오기 · 이름 고치기 · 칸 그리기 · IMG 올리기에 흩어져 있었다.
     한쪽만 고치면 칸에 담는 것과 칸에서 꺼내는 것이 어긋난다(그림 키를 하나 빠뜨리면 칸끼리 같은 파일을 덮는다).
   ★ 칸 한 벌 = 색 + 그림(theme 의 그림 키 · 바깥 배경 bg.img) 통째. 그림까지 담은 칸은 img:true 표시를 단다.
     표시가 없는 칸(그림 담기 전에 저장한 칸 · 옛 앱이 다시 쓴 칸)은 예전처럼 색만 갈고 지금 그림을 그대로 둔다 — 담지 않은 그림을 지우지 않게.
   ★ 그림은 칸마다 다른 파일에 올린다(uploadSlot — 고른 칸 번호가 이름에 든다). 같은 파일을 가리키면 한 칸에서 바꾼 그림이 다른 칸까지 바꾼다.
   ⚠️ 옛 앱의 씻기는 bg 의 그림과 img 표시를 버린다 — 옛 앱이 새 저장본을 읽으면 그 칸은 «색만» 칸으로 보인다(깨지지 않는다).
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
/* 그림 값으로 칸에 담을 수 있는가 — Storage 주소만. data: 글(옛 base64 그림 · 저장 전 바깥 그림)은 칸마다 복사되면 홈 노드가 몇 배로 커진다 */
function _storable(v){ return typeof v === 'string' && !!v && v.indexOf('data:') !== 0; }
/* 바깥 배경 한 벌 — 그림이 있으면 그림(color 와 배타), 없으면 색, 둘 다 없으면 null */
function _bgOf(bg, withImg){
  if(!bg) return null;
  if(withImg && _storable(bg.img)) return { img: bg.img };
  return bg.color ? { color: bg.color } : null;
}
/* 저장본을 늘 MAX 칸 배열로 씻는다.
   ⚠️ Realtime DB 는 빈 자리가 있는 배열을 {0:…, 2:…} 객체로 돌려준다 — 배열로 단정하면 두 칸만 저장한 사람의 목록이 사라진다. */
function normalize(raw){
  const out = new Array(MAX).fill(null);
  if(!raw || typeof raw !== 'object') return out;
  for(let i = 0; i < MAX; i++){
    const p = raw[i];
    if(!p || typeof p !== 'object') continue;
    const withImg = p.img === true;
    out[i] = {
      name : String(p.name || '').slice(0, NAME_MAX),
      theme: (p.theme && typeof p.theme === 'object') ? p.theme : {},
      bg   : _bgOf(p.bg, withImg),
    };
    if(withImg) out[i].img = true;
  }
  return out;
}
/* 고른 칸 번호 — 틀린 값이면 0 */
function cur(raw){
  const n = parseInt(raw, 10);
  return (n >= 0 && n < MAX) ? n : 0;
}
/* 지금 디자인(home = { theme, bg }) → 칸 한 벌 — 색과 그림(Storage 주소) 통째 */
function snapshot(home, keys, name){
  const h = home || {};
  const t = h.theme || {};
  const theme = {};
  Object.keys(t).forEach(k=>{ if(t[k] && (!keys.has(k) || _storable(t[k]))) theme[k] = t[k]; });
  return {
    name : name || '',
    theme,
    bg   : _bgOf(h.bg, true),
    img  : true,
  };
}
/* 칸 한 벌을 지금 디자인에 얹은 결과 { theme, bg } — 부르는 쪽이 home 에 넣는다.
   ★ 그림까지 담은 칸(img:true)은 색 · 그림이 통째로 갈린다 — 칸에 없는 색 · 그림은 지운다.
   ⚠️ 표시가 없는 칸은 예전 규칙 — 색만 통째로 갈고 그림 키 · 깔린 바깥 그림은 그대로 둔다(그 칸은 그림을 담은 적이 없다). */
function apply(home, preset, keys){
  if(preset.img === true){
    return { theme: Object.assign({}, preset.theme || {}), bg: preset.bg ? Object.assign({}, preset.bg) : null };
  }
  const h = home || {};
  const curTheme = h.theme || {};
  const theme = {};
  Object.keys(curTheme).forEach(k=>{ if(keys.has(k)) theme[k] = curTheme[k]; });
  Object.keys(preset.theme || {}).forEach(k=>{ if(!keys.has(k)) theme[k] = preset.theme[k]; });
  const bg = (h.bg && h.bg.img) ? h.bg : ((preset.bg && preset.bg.color) ? { color: preset.bg.color } : null);
  return { theme, bg };
}
/* 디자인 스튜디오 IMG 를 올릴 이름(uploadUserImage 의 slot → users/{uid}/design_{slot}.jpg) — 이름을 정하는 곳은 여기 하나.
   지금 고른 칸 번호를 이름에 넣는다(p0_bg → design_p0_bg.jpg) — 다른 칸이 담아 둔 그림 파일을 덮지 않게.
   같은 칸에 다시 올리면 같은 파일을 덮는다(칸마다 그림 키마다 한 파일 — 쌓이지 않는다).
   key: 바깥 배경이면 'bg', 그 밖에는 그림 키 */
function uploadSlot(slot, key){ return 'p' + cur(slot) + '_' + String(key); }

const api = { MAX, NAME_MAX, imgKeyOf, imgKeys, normalize, cur, snapshot, apply, uploadSlot };
if(typeof window !== 'undefined') window.TwMyHomePreset = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

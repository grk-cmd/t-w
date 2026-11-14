/* inbox-sections.js — 📩 우편함 칸 나누기 규칙: 어느 우편이 «📩 우편» · «📢 소식» 칸에 드는가 · 칸마다 순서 · 안 읽은 수 · 처음 보일 칸 (검사 sim-inbox-sections.js)
   [왜] 우편함 그리기 · 탭 배지 · 처음 열 칸이 같은 판단을 쓴다. 한쪽만 고치면 배지 수와 목록이 어긋난다.
   ★ 소식 = 모두에게 보낸(broadcast) 공지 · 업데이트. 우편 = 나머지 전부(개인 우편 · 버그 답변 · 모두에게 보낸 «📩 우편»).
     모두에게 보낸 우편(이벤트 보상)은 받는 사람 눈에 보상이라 우편 칸에 둔다(사용자 결정).
   ★ 태그가 없거나 모르는 값이면 공지로 본다(옛 우편이 그렇게 그려졌다).
   ★ 📌 고정 소식은 어떤 종류를 골라도 맨 위에 보인다(사용자 결정).
   ★ 순수 함수만 — DOM · firebase · localStorage 를 모른다. 받은 값을 고치지 않는다.
   받는 것 없음(실릴 때 바로 만든다). 내보냄: window.TwInboxSections = { SECS, CATS, tagOf, sectionOf, normSec, normCat, mailIds, newsIds, unread, firstSec }.
   myhome-inbox.js · app.js 보다 먼저 싣는 classic script. */
(function(){

const SECS = Object.freeze(['mail', 'news']);               // 왼쪽 세로 메뉴 — 📩 우편 · 📢 소식(📘 도움말은 따로 탭 — help-tab.js)
const CATS = Object.freeze(['all', 'notice', 'update']);    // 소식 목록 위 종류 고르기

/* 태그 한 벌 — 모르는 값은 공지 */
function tagOf(m){
  const t = m && m.tag;
  return (t === 'update' || t === 'reward' || t === 'bug') ? t : 'notice';
}
/* 우편 한 통이 드는 칸 — 'news' | 'mail' */
function sectionOf(m){
  if(!m || m._src !== 'broadcast') return 'mail';
  const t = tagOf(m);
  return (t === 'notice' || t === 'update') ? 'news' : 'mail';
}
function normSec(s){ return SECS.indexOf(s) >= 0 ? s : 'mail'; }
/* 옛 필터 값('reward' · 'gift')이 남아 있어도 목록이 비지 않게 '전체' 로 */
function normCat(c){ return CATS.indexOf(c) >= 0 ? c : 'all'; }

const byPinThenNew = (merged) => (a, b) => {
  const pa = merged[a].pinned ? 1 : 0, pb = merged[b].pinned ? 1 : 0;
  if(pa !== pb) return pb - pa;
  return (merged[b].ts || 0) - (merged[a].ts || 0);
};
/* 📩 우편 칸 — 📌 먼저 · 그다음 최신순 */
function mailIds(merged){
  const m = merged || {};
  return Object.keys(m).filter(id => sectionOf(m[id]) === 'mail').sort(byPinThenNew(m));
}
/* 📢 소식 칸 — 고정 글은 종류와 상관없이 맨 위 · 나머지는 고른 종류만 · 최신순 */
function newsIds(merged, cat){
  const m = merged || {}, c = normCat(cat);
  return Object.keys(m)
    .filter(id => sectionOf(m[id]) === 'news' && (m[id].pinned || c === 'all' || tagOf(m[id]) === c))
    .sort(byPinThenNew(m));
}
/* 안 읽은 수 — 칸마다 · 소식은 종류마다 · 합계(🔔 벨 · 우편함 탭 배지).
   personalUnread: 개인 우편의 안 읽은 수를 서버가 센 값으로 쓴다(받아 둔 쪽지 수와 다를 수 있다 — 오래된 우편은 안 받았다). 숫자가 아니면 받은 것을 센다. */
function unread(merged, personalUnread){
  const m = merged || {};
  const out = { mail: 0, news: 0, notice: 0, update: 0, total: 0 };
  const server = (typeof personalUnread === 'number' && personalUnread >= 0) ? personalUnread : null;
  Object.keys(m).forEach(id=>{
    if(m[id].read) return;
    if(server !== null && m[id]._src === 'personal') return;
    out.total++;
    if(sectionOf(m[id]) === 'mail'){ out.mail++; return; }
    out.news++;
    out[tagOf(m[id])]++;
  });
  if(server !== null){ out.mail += server; out.total += server; }
  return out;
}
/* 우편함 탭을 열 때 처음 보일 칸 — 안 읽은 우편이 있으면 우편, 없으면 소식(사용자 결정) */
function firstSec(merged, personalUnread){ return unread(merged, personalUnread).mail > 0 ? 'mail' : 'news'; }

const api = { SECS, CATS, tagOf, sectionOf, normSec, normCat, mailIds, newsIds, unread, firstSec };
if(typeof window !== 'undefined') window.TwInboxSections = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

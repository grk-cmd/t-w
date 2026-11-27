/* wardrobe-paging.js — 🎨 꾸미기 창 파츠 칸의 페이지 · 이름 찾기 규칙(순수 함수 · DOM · 저장 없음)
   칸 순서는 «기본 캐릭터» 묶음([안 함] + 기본 파츠) 다음 «커미션 전용» 묶음 — 페이지는 두 묶음을 이어 붙인 한 줄을 PAGE_SIZE 씩 자른다.
   묶음 머리는 그 페이지에 칸이 하나라도 걸친 묶음에만 그린다(pageView 의 groups).
   페이지 번호는 0 부터 — 화면에 쓰는 번호만 +1 한다.
   검사: checks/sim-wardrobe-paging.js */
(function(){

const PAGE_SIZE = 16;   // 4열 × 4줄 — html .wd-grid 열 수와 같이 고친다
const PAGER_ALL_MAX = 7;   // 페이지가 이보다 많으면 번호 줄을 «…» 로 줄인다

/** 찾는 말 — 앞뒤 공백을 떼고 소문자로. 없으면 '' */
function normQuery(q){ return String(q == null ? '' : q).trim().toLowerCase(); }

/** 이름에 찾는 말이 들었나(대소문자 무시). 찾는 말이 비면 늘 true */
function matchName(name, q){
  const n = normQuery(q);
  if(!n) return true;
  return String(name == null ? '' : name).toLowerCase().includes(n);
}

/**
 * 칸 한 줄 — [기본 묶음: 안 함 · 기본 파츠] → [커미션 묶음]. 찾는 중이면 이름이 맞는 파츠만 · [안 함] 은 뺀다(파츠가 아니다).
 * @param {{defaultList:Array<{name?:string}>, commissionList:Array<{name?:string}>, withDefault:boolean, query?:string}} o
 *   withDefault — 기본 묶음을 그리는가(관리자가 아니거나 기본 파츠가 있을 때 · wardrobe.js 가 정한다)
 * @returns {Array<{section:'default'|'commission', kind:'none'|'part', rec?:object}>}
 */
function buildCells(o){
  const q = normQuery(o.query);
  const cells = [];
  if(o.withDefault){
    if(!q) cells.push({ section: 'default', kind: 'none' });
    (o.defaultList || []).forEach(rec => { if(matchName(rec && rec.name, q)) cells.push({ section: 'default', kind: 'part', rec }); });
  }
  (o.commissionList || []).forEach(rec => { if(matchName(rec && rec.name, q)) cells.push({ section: 'commission', kind: 'part', rec }); });
  return cells;
}

/** 페이지 수 — 칸이 없어도 1 */
function pageCount(n, size){ return Math.max(1, Math.ceil(Math.max(0, n | 0) / size)); }

/** 기억한 페이지를 지금 칸 수에 맞춘다 — 없는 페이지면 마지막 · 이상한 값이면 0 */
function clampPage(page, n, size){
  const p = Number.isFinite(page) ? Math.floor(page) : 0;
  return Math.min(pageCount(n, size) - 1, Math.max(0, p));
}

/**
 * 한 페이지 — 맞춘 페이지 번호 · 페이지 수 · 그 페이지의 칸을 묶음별로(이어진 같은 묶음끼리).
 * @returns {{page:number, pages:number, groups:Array<{section:string, cells:Array<object>}>}}
 */
function pageView(cells, page, size){
  const list = cells || [];
  const p = clampPage(page, list.length, size);
  const groups = [];
  list.slice(p * size, p * size + size).forEach(c => {
    const last = groups[groups.length - 1];
    if(last && last.section === c.section) last.cells.push(c);
    else groups.push({ section: c.section, cells: [c] });
  });
  return { page: p, pages: pageCount(list.length, size), groups };
}

/**
 * 번호 단추 줄 — 페이지 번호(0 부터)와 '…'. 페이지가 PAGER_ALL_MAX 이하면 전부,
 * 넘으면 처음 · 끝 · 지금 앞뒤 하나씩만(사이가 한 쪽뿐이면 '…' 대신 그 번호).
 */
function pagerItems(page, pages){
  if(pages <= 1) return [];
  const all = [];
  if(pages <= PAGER_ALL_MAX){ for(let i = 0; i < pages; i++) all.push(i); return all; }
  const keep = [...new Set([0, pages - 1, page - 1, page, page + 1])].filter(i => i >= 0 && i < pages).sort((a, b) => a - b);
  keep.forEach((v, i) => {
    if(i > 0){
      const gap = v - keep[i - 1];
      if(gap === 2) all.push(v - 1);
      else if(gap > 2) all.push('…');
    }
    all.push(v);
  });
  return all;
}

const api = { PAGE_SIZE, PAGER_ALL_MAX, normQuery, matchName, buildCells, pageCount, clampPage, pageView, pagerItems };
if(typeof window !== 'undefined') window.TwWardrobePaging = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

/* help-site.js — 📘 도움말 웹 페이지(Hosting /help) 규칙 한 벌: 주소 · 들일 수 있는 주소 · 페이지가 보낸 알림 읽기 (검사 sim-help-tab.js)
   [왜] 도움말 탭(myhome/help-tab.js)이 여는 주소와, main.js 가 안쪽 틀(iframe) 이동을 허락하는 주소가 갈라지면
     틀이 빈 칸이 되거나 엉뚱한 곳이 열린다. 그래서 두 프로세스가 이 파일 하나를 같이 쓴다
     (main.js 는 require · 렌더러는 window.TwHelpSite — click-through-policy.js 와 같은 모양).
   ★ 도움말 페이지(hosting/help/embed.js)는 칸 안에서 { type:'tw-help', v:1, page, toc } 를 보낸다.
     남의 페이지가 보낸 것일 수 있으니 origin 과 모양을 여기서 보고, 맞는 것만 돌려준다(목차 글은 화면에 textContent 로만).
   ★ 순수 함수만 — DOM · 창 · 네트워크를 모른다. */
(function(){
'use strict';

const HELP_ORIGIN = 'https://help.together-working.com';   // 우리 도메인 — 페이지를 다른 곳으로 옮겨도 앱을 다시 내지 않게(지금은 Firebase Hosting 맞춤 도메인)
const HELP_PATH = '/help/';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,15}$/;               // 'index' · '3' · '4-1'
const isSlug = (s) => typeof s === 'string' && SLUG_RE.test(s);
const THEMES = Object.freeze(['default', 'bubble']);        // 앱 테마 이름(shared/theme.js getTheme)
const MSG_TYPE = 'tw-help', MSG_V = 1;
const MAX_GROUPS = 20, MAX_PAGES = 60, MAX_TEXT = 60;

/* 칸 안에서 열 주소 — 모르는 편은 목차(index), 모르는 테마는 기본 */
function pageUrl(page, theme){
  const p = isSlug(page) ? page : 'index';
  const t = THEMES.indexOf(theme) >= 0 ? theme : 'default';
  return HELP_ORIGIN + HELP_PATH + (p === 'index' ? '' : p) + '?theme=' + t + '&embed=1';
}
/* 안쪽 틀이 옮겨 가도 되는 주소인가 — 우리 Hosting 의 /help/ 아래만 */
function isHelpUrl(u){
  let x;
  try{ x = new URL(String(u)); }catch(_){ return false; }
  return x.origin === HELP_ORIGIN && x.pathname.startsWith(HELP_PATH);
}
const shortText = (s) => typeof s === 'string' && s.trim() !== '' && s.length <= MAX_TEXT;
/* 목차 모양 보기 — 하나라도 어긋나면 null(못 받은 것으로 그린다) */
function readToc(toc){
  if(!Array.isArray(toc) || toc.length === 0 || toc.length > MAX_GROUPS) return null;
  let n = 0;
  const out = [];
  for(const g of toc){
    if(!g || !shortText(g.group) || !Array.isArray(g.pages) || g.pages.length === 0) return null;
    const pages = [];
    for(const p of g.pages){
      if(!p || !isSlug(p.slug) || p.slug === 'index' || !shortText(p.title)) return null;
      pages.push({ slug: p.slug, title: p.title });
      if(++n > MAX_PAGES) return null;
    }
    out.push({ group: g.group, pages });
  }
  return out;
}
/* 페이지가 보낸 알림 — 우리 페이지 · 아는 모양이면 { page, toc(없거나 어긋나면 null) }, 아니면 null */
function readMessage(origin, data){
  if(origin !== HELP_ORIGIN) return null;
  if(!data || data.type !== MSG_TYPE || data.v !== MSG_V) return null;
  if(!isSlug(data.page)) return null;
  return { page: data.page, toc: readToc(data.toc) };
}

const api = { HELP_ORIGIN, HELP_PATH, THEMES, pageUrl, isHelpUrl, readToc, readMessage };
if(typeof window !== 'undefined') window.TwHelpSite = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

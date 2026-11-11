/* sim-mh-title-nodrag.js — 🏠 마이홈 제목줄 버튼이 «창 끌기» 칸에 먹히지 않는가 (B-1101-3)
   실행:  node sim-mh-title-nodrag.js   (desk-companion-prototype.html 과 같은 폴더에서)
   [왜] 런처 화면(body.config)에서는 마이홈 제목줄(#myHomeTitle)이 -webkit-app-region:drag 라, 안쪽 버튼은 하나씩 no-drag 로
     빼 줘야 눌린다. 빠진 버튼은 누르면 OS 가 «창 끌기» 로 가져가 클릭이 안 온다(«말랑이 숨기기» 가 그랬다).
   §1 제목줄 안의 id 요소 중 글자 칸(LABELS)이 아닌 것은 모두 no-drag 목록에 있다
   §2 깨 보기 — 목록에서 한 줄을 빼면 그 버튼이 빠졌다고 나온다 */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'app/' + f, '../app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const HTML = read('desk-companion-prototype.html');
if (!HTML) { say('  ? 원본 못 찾음 — desk-companion-prototype.html'); process.exit(2); }

const LABELS = ['mhTitleLabel', 'mhVisitBadge'];   // 누르는 곳이 아닌 글자 칸 — 끌기를 받아야 한다

/* 제목줄 안의 id — <div id="myHomeTitle"> 부터 그 div 가 닫힐 때까지(안쪽은 span 뿐) */
function titleIds(html){
  const OPEN = '<div id="myHomeTitle">';
  const i = html.indexOf(OPEN);
  if (i < 0) return null;
  const body = html.slice(i + OPEN.length, html.indexOf('</div>', i));
  return [...body.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
}
/* body.config #myHomeTitle #id 를 no-drag 로 빼 둔 id */
function noDragIds(html){
  /* 규칙마다 앞 '}' 까지가 선택자 — 정규식 [^{}]* 로 훑으면 큰 HTML 에서 느려 indexOf 로 찾는다 */
  const RULE = '{-webkit-app-region:no-drag;}';
  const out = new Set();
  for (let at = html.indexOf(RULE); at >= 0; at = html.indexOf(RULE, at + RULE.length)) {
    const sel = html.slice(html.lastIndexOf('}', at) + 1, at).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const s of sel.split(',')) { const k = s.match(/body\.config #myHomeTitle #([\w-]+)\s*$/); if (k) out.add(k[1]); }
  }
  return out;
}
function missing(html){
  const ids = titleIds(html) || [], nd = noDragIds(html);
  return ids.filter(id => !LABELS.includes(id) && !nd.has(id));
}

say('§1 지금 HTML');
const ids = titleIds(HTML);
chk(Array.isArray(ids) && ids.length >= 7, '제목줄 안의 id ' + (ids ? ids.length : 0) + '개 — ' + (ids || []).join(' · '));
chk(LABELS.every(l => (ids || []).includes(l)), '  ↳ 글자 칸(' + LABELS.join(' · ') + ')이 아직 제목줄에 있다 — 빠졌으면 LABELS 를 고친다');
const miss = missing(HTML);
chk(miss.length === 0, '누르는 칸은 모두 no-drag' + (miss.length ? ' — 빠짐: ' + miss.join(' · ') : ''));
chk(noDragIds(HTML).has('mhMallangHideBtn'), '  ↳ 말랑이 숨기기(#mhMallangHideBtn)도 들어 있다');

say('§2 깨 보기');
const broken = HTML.replace('  body.config #myHomeTitle #mhMallangHideBtn,\n', '');
chk(broken !== HTML && missing(broken).join() === 'mhMallangHideBtn', '말랑이 줄을 빼면 그 버튼이 빠졌다고 나온다');

say('');
say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — 런처에서 연 마이홈 제목줄 버튼이 모두 눌린다');
process.exit(fail ? 1 : 0);

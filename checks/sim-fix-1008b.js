/* ═══ 🩹 sim-fix-1008b.js — 10-08 개선 묶음: 방 코드 글자 · 경험치 바 길이와 이름표 잘림 (2026-10-08 신설) ═══════
   ・1절: 마이홈 친구창 방 코드 — 제보 «실제 CMSW 가 OM8W 로 보인다». 9px 이름표 글꼴에서 C·O · S·8 이 같아 보였다.
          코드만 숫자·코드용 고정폭(--win-font-num)으로 감싼다 · 이스케이프는 그대로
   ・2절: 경험치 바 — 제보 «누구는 길고 누구는 짧다 · 화면 아래에 두면 이름이 잘린다».
          길이는 모두 EXP_BAR_W 로 고정 · 화면 아래에서는 바 밑에 붙는 이름표 높이까지 비켜 올린다 ·
          이름표도 화면 아래로 안 나간다(이름표는 바가 아니라 발밑 기준이라 바만 올리면 그대로 잘린다)
   ⚠️ 실제 화면은 2026-10-08 헤드리스 크로미움에서 확인했다(두 좌석 바 72px · 72px · 발밑을 화면 맨 아래로 —
     고치기 전 이름표 아래 끝 921 / 화면 900 → 고친 뒤 898).
   [실행] app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!APP || !HTML){ say('  ? 원본 못 찾음 — ' + (!APP ? 'app.js ' : '') + (!HTML ? 'desk-companion-prototype.html' : '')); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const A = strip(APP);
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };

say('── 1. 친구창 방 코드');
chk(/<span class="mh-fpill-code">'\+escHtml\(roomTag\)\+'<\/span>/.test(A), '방 코드를 mh-fpill-code 로 감싼다 · escHtml 은 그대로');
const css = (HTML.match(/\.mh-fpill-code\{[^}]*\}/) || [''])[0];
chk(/font-family:var\(--win-font-num\)/.test(css), '코드는 숫자·코드용 고정폭 글꼴(--win-font-num — Consolas 계열)');
chk(/font-size:(1[0-9])px/.test(css), '9px 보다 크게(' + ((css.match(/font-size:(\d+)px/) || [])[1] || '?') + 'px)');
chk(/--win-font-num:[^;]*Consolas/.test(HTML), '--win-font-num 이 정의돼 있다');

say('── 2. 경험치 바');
const ub = grab(A, 'updateSeatExpBar');
const W = +(A.match(/const EXP_BAR_W\s*=\s*(\d+);/) || [])[1];
chk(W >= 40 && W <= 160, `길이 상수 EXP_BAR_W = ${W}px`);
chk(/const w = EXP_BAR_W;/.test(ub) && !/_chipCharMetrics|halfW/.test(ub), '모든 캐릭터 같은 길이 — 캐릭터 실측 폭을 따라가지 않는다');
chk(/if\(NAMEPLATE_BELOW_EXPBAR && seat\.namePlateEl && seat\.namePlateEl\.style\.display !== 'none'\)/.test(ub)
  && /top = Math\.max\(2, Math\.min\(innerHeight - barH - below - 2, Math\.round\(top\)\)\);/.test(ub), '화면 아래에서는 바 밑 이름표 높이까지 비켜 올린다');
const np = grab(A, 'setSeatNamePlate');
chk(/if\(_h\) _plateTop = Math\.min\(_plateTop, innerHeight - _h - 2\);/.test(np), '이름표도 화면 아래로 안 나간다(발밑 기준이라 따로 막아야 한다)');
chk(np.indexOf('innerHeight - _h - 2') > np.indexOf('_mr.bottom + 4'), '«바 아래» 다음에 화면 제한 — 바가 이미 올라가 있어 둘이 서로 밀지 않는다');
chk(/--exp-bar-h:6px;/.test(HTML), '두께는 CSS 변수 하나(--exp-bar-h)로 모든 좌석 같다');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

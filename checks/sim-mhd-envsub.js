/* ═══ 🖥️ sim-mhd-envsub.js — 마이홈 바탕화면 «환경 설정» 서브메뉴가 옆으로 흘러가지 않게 (2026-09-17 제보) ═══════
   [제보] 마이홈 바탕화면 «환경 설정» 에서 «글자 크기»·«브금» 에 마우스를 대면 서브메뉴가 옆으로 막 움직인다.
   [원인] 서브메뉴 펼침 칸 클래스가 '.fly' 였다. desk-companion-prototype.html 의 채팅 「날리기」 전역 규칙
     '.fly{position:absolute;left:100%;pointer-events:none;animation:flyAcross …}' 가 그대로 얹혀
     서브메뉴가 흐르는 자막처럼 왼쪽으로 날아갔다(클릭도 통과). 날리기가 들어온 뒤부터 난 사고다.
   [고침] 펼침 칸을 'mhd-fly' 로 바꿨다. 날리기 쪽 '.fly' 는 sim-chat-fly 가 붙잡고 있으므로 건드리지 않는다.
   ・1절: myhome-desktop.js 에 맨 '.fly' 클래스가 없다(CSS·마크업·셀렉터 전부) · mhd-fly 로 짝이 맞는다.
   ・2절: 전제 확인 — HTML 전역 '.fly' 가 여전히 애니메이션을 쓴다(이 검사가 지키는 이유가 살아 있는지).
   [실행] myhome-desktop.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
const MHD  = fs.readFileSync('myhome-desktop.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const code = strip(MHD);

say('── 1. 마이홈 서브메뉴 클래스');
{
  chk(!/\.fly\b(?![-\w])/.test(code.replace(/\.mhd-fly/g, '')), "★ 맨 '.fly' 셀렉터가 없다 — 채팅 날리기 전역 규칙과 부딪힌다");
  chk(!/class=\\?["']fly["'\s\\]/.test(code), "★ class=\"fly\" 마크업이 없다");
  chk(/\.mhd-envsub \.mhd-fly\{[^}]*display:none;[^}]*position:absolute/.test(code), '펼침 칸 CSS 가 mhd-fly 로 있다(평소 숨김·absolute)');
  chk(/\.mhd-envsub\.on \.mhd-fly\{display:flex;\}/.test(code), '열림(.on) 때 mhd-fly 가 보인다');
  chk(/class=\\?"mhd-fly\\?"/.test(code) && /querySelector\('\.mhd-fly'\)/.test(code), '만드는 마크업과 찾는 셀렉터가 같은 이름이다');
  chk(/querySelectorAll\('\.mhd-fly button'\)/.test(code), '선택 표시(mhdMarkEnv)도 같은 이름을 본다');
}

say('── 2. 전제 — 날리기 전역 .fly');
{
  const fly = (HTML.match(/\n  \.fly\{[^}]*\}/) || [''])[0];
  chk(/animation:flyAcross/.test(fly) && /pointer-events:none/.test(fly),
      "전역 '.fly' 는 흐르는 애니메이션·클릭 통과다 — 다른 UI 가 이 이름을 쓰면 안 되는 이유");
}

say(`\n결과: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);

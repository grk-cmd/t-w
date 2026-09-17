/* ═══ 🔤 sim-font-hangul.js — Tahoma 폰트 목록에 한글 폰트가 붙어 있는가 (2026-09-17 제보) ═══════════════
   [제보] 기본 테마와 머리 위 말풍선의 글씨가 예전과 다른 폰트로 바뀌었다. 대화창은 그대로다.
   [원인] Tahoma 에는 한글 글자가 없다. 한글은 브라우저가 고른 대체 폰트로 그려지는데, Electron 31 → 44
     (2026-09-15 package.json)에서 그 선택이 바뀌었다. 예전엔 맑은 고딕이었다(app.js 의 말풍선 주석에 기록).
     대화창만 멀쩡했던 것은 처음부터 'Malgun Gothic' 을 목록에 적어 두었기 때문이다.
   [고침] Tahoma 로 시작하는 모든 폰트 목록에 Malgun Gothic 을 붙였다(HTML 111곳 · app.js 14곳 · mallang.js 1곳).
   ・1절: 코드(주석 제외)에서 Tahoma 가 들어간 font-family / font 선언은 전부 한글 폰트를 함께 적는다.
          예외는 이모지 전용 목록(Segoe UI Emoji 로 시작) 하나뿐.
   ・2절: 기본 테마 --win-font 와 머리 위 말풍선·이름표에 맑은 고딕 · 버블 테마는 여전히 돋움이 먼저.
   [실행] desk-companion-prototype.html · app.js 가 있는 폴더에서(mallang.js · myhome-desktop.js 는 있으면 본다). */
'use strict';
const fs = require('fs');
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(e){ return null; } };
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
const APP  = fs.readFileSync('app.js', 'utf8');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const stripCss = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
const stripJs  = (s) => stripCss(s).replace(/(^|[^:\\'"])\/\/[^\n]*/g, '$1 ');
const KOR = /Malgun Gothic|맑은 고딕|Dotum|돋움/;

say('── 1. Tahoma 목록마다 한글 폰트');
const files = [['desk-companion-prototype.html', stripCss(HTML)], ['app.js', stripJs(APP)]];
for(const f of ['mallang.js', 'myhome-desktop.js']){ const t = read(f); if(t != null) files.push([f, stripJs(t)]); }
for(const [name, code] of files){
  const decls = code.match(/font(?:-family)?\s*:[^;}\n]*Tahoma[^;}\n]*/g) || [];
  const bad = decls.filter(d => !KOR.test(d) && !/Emoji/.test(d));
  chk(decls.length > 0 || name !== 'desk-companion-prototype.html', name + ' — Tahoma 선언 ' + decls.length + '곳을 찾았다');
  chk(bad.length === 0, '★ ' + name + ' — 한글 폰트가 빠진 Tahoma 목록 없음' +
      (bad.length ? ' (' + bad.length + '곳: ' + bad.slice(0, 3).map(s => s.slice(0, 60)).join(' | ') + ')' : ''));
}

say('── 2. 핵심 자리');
{
  const css = stripCss(HTML);
  const winFonts = css.match(/--win-font\s*:[^;]*;/g) || [];
  chk(winFonts.length === 2, '--win-font 정의가 둘(기본·버블)이다 [' + winFonts.length + ']');
  chk(/^--win-font\s*:\s*Tahoma,'Malgun Gothic'/.test(winFonts[0] || ''), '★ 기본 테마 --win-font = Tahoma 다음 맑은 고딕 (영문은 그대로 Tahoma)');
  chk(/^--win-font\s*:\s*'Dotum'/.test(winFonts[1] || ''), '버블 테마는 여전히 돋움이 먼저 (건드리지 않았다)');
  const rule = (sel) => { const i = css.indexOf('\n  ' + sel + '{'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
  chk(/font:bold 15px Tahoma,"Malgun Gothic"/.test(rule('.seat-bubble-dom')), '★ 머리 위 말풍선 15px — 맑은 고딕');
  chk(/Tahoma,"Malgun Gothic"/.test(rule('.seat-nameplate')), '머리 위 이름표 — 맑은 고딕');
  chk(/Tahoma,'Malgun Gothic'/.test(rule('#chatWindow')), '대화창은 원래대로 맑은 고딕 (이번 제보에서 멀쩡했던 기준)');
}

say(`\n결과: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);

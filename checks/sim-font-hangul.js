/* ═══ 🔤 sim-font-hangul.js — Tahoma 폰트 목록에 한글 폰트가 붙어 있는가 (2026-09-17 제보) ═══════════════
   [제보] 기본 테마와 머리 위 말풍선의 글씨가 예전과 다른 폰트로 바뀌었다. 대화창은 그대로다.
   [원인] Tahoma 에는 한글 글자가 없다. 한글은 브라우저가 고른 대체 폰트로 그려지는데, Electron 31 → 44
     (2026-09-15 package.json)에서 그 선택이 바뀌었다. 예전엔 맑은 고딕이었다(app.js 의 말풍선 주석에 기록).
     대화창만 멀쩡했던 것은 처음부터 'Malgun Gothic' 을 목록에 적어 두었기 때문이다.
   [고침] Tahoma 로 시작하는 모든 폰트 목록에 Malgun Gothic 을 붙였다(HTML 111곳 · app.js 14곳 · mallang.js 1곳).
   ・1절: 코드(주석 제외)에서 Tahoma 가 들어간 font-family / font 선언은 전부 한글 폰트를 함께 적는다.
          예외는 이모지 전용 목록(Segoe UI Emoji 로 시작) 하나뿐.
   ・2절: 기본 테마 --win-font 와 머리 위 말풍선·이름표에 맑은 고딕 · 버블 테마는 여전히 돋움이 먼저.
   ・3절: 🍎 맥 — 맑은 고딕 · 돋움(맥에 없음)을 적은 목록에는 맥 기본 한글 글꼴 'Apple SD Gothic Neo' 를 늘 같이 · 깨 보기 (B-1028-5)
   ・글꼴 토큰 var(--tw-font-…)(디자인 시스템 1단계)은 html 의 정의로 펼친 뒤 1 · 2절을 본다.
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
/* 글꼴 토큰 var(--tw-font-…)은 html 의 정의로 펼쳐서 본다 — 토큰 안의 목록도 같은 규칙을 받는다 */
const TW_FONT = {};
for(const m of stripCss(HTML).matchAll(/(--tw-font-[\w-]+)\s*:\s*([^;]*);/g)) TW_FONT[m[1]] = m[2];
const expand = (s) => s.replace(/var\((--tw-font-[\w-]+)\)/g, (m, n) => TW_FONT[n] || m);

say('── 1. Tahoma 목록마다 한글 폰트');
const files = [['desk-companion-prototype.html', expand(stripCss(HTML))], ['app.js', expand(stripJs(APP))]];
for(const f of ['mallang.js', 'myhome-desktop.js']){ const t = read(f); if(t != null) files.push([f, expand(stripJs(t))]); }
for(const [name, code] of files){
  const decls = code.match(/font(?:-family)?\s*:[^;}\n]*Tahoma[^;}\n]*/g) || [];
  const bad = decls.filter(d => !KOR.test(d) && !/Emoji/.test(d));
  chk(decls.length > 0 || name !== 'desk-companion-prototype.html', name + ' — Tahoma 선언 ' + decls.length + '곳을 찾았다');
  chk(bad.length === 0, '★ ' + name + ' — 한글 폰트가 빠진 Tahoma 목록 없음' +
      (bad.length ? ' (' + bad.length + '곳: ' + bad.slice(0, 3).map(s => s.slice(0, 60)).join(' | ') + ')' : ''));
}

say('── 2. 핵심 자리');
{
  const css = stripCss(HTML), cssX = expand(css);
  const winFonts = css.match(/--win-font\s*:[^;]*;/g) || [];
  chk(winFonts.length === 2, '--win-font 정의가 둘(기본·버블)이다 [' + winFonts.length + ']');
  chk(/^--win-font\s*:\s*Tahoma,'Malgun Gothic'/.test(winFonts[0] || ''), '★ 기본 테마 --win-font = Tahoma 다음 맑은 고딕 (영문은 그대로 Tahoma)');
  chk(/^--win-font\s*:\s*'Dotum'/.test(winFonts[1] || ''), '버블 테마는 여전히 돋움이 먼저 (건드리지 않았다)');
  const rule = (sel) => { const i = cssX.indexOf('\n  ' + sel + '{'); return i < 0 ? '' : cssX.slice(i, cssX.indexOf('}', i)); };
  chk(/font:bold 15px Tahoma,["']Malgun Gothic["']/.test(rule('.seat-bubble-dom')), '★ 머리 위 말풍선 15px — 맑은 고딕');
  chk(/Tahoma,["']Malgun Gothic["']/.test(rule('.seat-nameplate')), '머리 위 이름표 — 맑은 고딕');
  chk(/Tahoma,'Malgun Gothic'/.test(rule('#chatWindow')), '대화창은 원래대로 맑은 고딕 (이번 제보에서 멀쩡했던 기준)');
}

say('── 3. 🍎 맥 — 한글 목록마다 Apple SD Gothic Neo');
{
  /* 맑은 고딕 · 돋움은 맥에 없다. 적지 않으면 맥의 한글은 브라우저가 그때그때 고른 대체 글꼴이 된다 */
  const MAC = /Apple SD Gothic Neo/;
  const macBad = (code) => (code.match(/font(?:-family)?\s*:[^;}\n]*(?:Malgun Gothic|맑은 고딕|Dotum|돋움)[^;}\n]*|--(?:win|tw)-font[\w-]*\s*:[^;}\n]*(?:Malgun Gothic|맑은 고딕|Dotum|돋움)[^;}\n]*/g) || []).filter(d => !MAC.test(d));
  const MODS = ['mallang.js', 'myhome-desktop.js', 'myhome-edit.js', 'guestbook.js', 'friend-manage.js', 'room-invite-ui.js', 'app-version-gate.js', 'maintenance-gate.js'];
  const all = [['desk-companion-prototype.html', stripCss(HTML)], ['app.js', stripJs(APP)]];
  for(const f of MODS){ const t = read(f); if(t != null) all.push([f, stripJs(t).replace(/\\'/g, "'")]); }
  let n = 0;
  for(const [name, code] of all){
    const bad = macBad(code); n++;
    chk(bad.length === 0, name + ' — 한글 목록에 맥 글꼴이 빠진 곳 없음' + (bad.length ? ' (' + bad.length + '곳: ' + bad.slice(0, 2).map(x => x.slice(0, 70)).join(' | ') + ')' : ''));
  }
  chk(n >= 8, '  본 파일 ' + n + '개(html · app.js · 모듈)');
  const css = stripCss(HTML);
  chk(/--tw-font-legacy\s*:\s*Tahoma,'Malgun Gothic','Apple SD Gothic Neo'/.test(css) && /--win-font\s*:\s*Tahoma,'Malgun Gothic','Apple SD Gothic Neo'/.test(css),
    '★ 기본 테마 · 대부분 칸이 쓰는 토큰 — 맑은 고딕 바로 뒤 Apple SD Gothic Neo(영문은 그대로 Tahoma)');
  chk(/--win-font\s*:\s*'Dotum','돋움','Gulim','굴림',Tahoma,'Apple SD Gothic Neo'/.test(css), '  버블 테마 — 돋움이 먼저 · Tahoma 뒤 Apple SD Gothic Neo');
  const broke = stripCss(HTML.replace("--tw-font-legacy:Tahoma,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;", "--tw-font-legacy:Tahoma,'Malgun Gothic',sans-serif;"));
  chk(broke !== stripCss(HTML) && macBad(broke).length > 0, '  깨 보기 — 토큰에서 맥 글꼴을 빼면 빨강');
  const fm = all.find(([f]) => f === 'friend-manage.js');
  const fmBroke = fm ? fm[1].replace('font-family:var(--tw-font-legacy);', "font-family:Tahoma,'Malgun Gothic',sans-serif;") : '';
  chk(!!fm && fmBroke !== fm[1] && macBad(fmBroke).length > 0, '  깨 보기 — 모듈에 맥 글꼴 없는 목록을 직접 적으면 빨강');
  /* 점검 창은 자식 창(방명록 · 디자인 스튜디오)에도 그려진다 — 거기엔 --tw-font-legacy 가 없어 대비 목록이 있어야 버블 테마에서 돋움으로 안 바뀐다 */
  const mg = all.find(([f]) => f === 'maintenance-gate.js');
  chk(!!mg && /var\(--tw-font-legacy,Tahoma,'Malgun Gothic','Apple SD Gothic Neo',sans-serif\)/.test(mg[1]), '★ 점검 창 — 토큰에 대비 목록(자식 창에서도 Tahoma)');
}

say(`\n결과: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);

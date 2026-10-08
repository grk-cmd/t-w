/* sim-fix-1008.js — 🐞 버그 제보 묶음(2026-10-08 접수분) 검사
   실행:  node sim-fix-1008.js   (app.js 와 같은 폴더에서)
   건마다 절을 하나씩 늘린다. 각 절은 «고친 자리가 그대로 있는가» 와 «옛 모양으로 되돌리면 잡히는가» 를 본다. */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const APP = read('app.js');
if (!APP) { say('  ? 원본 못 찾음 — app.js'); process.exit(2); }

say('§6 편집 → 완성 후 조는데 눈 뜸');
{
  const fn = (APP.match(/function applyCharToSeat\(seat,def\)\{[\s\S]*?\n\}/) || [''])[0];
  const sets = [/seat\.faceMat=inst\.faceMat; seat\.faceMapOrig=fT; seat\.blinkTex=bT;/, /seat\.faceMat=base\.faceMat;seat\.faceMapOrig=base\.fT;seat\.blinkTex=base\.bT;/];
  sets.forEach((re, i) => {
    const m = re.exec(fn);
    const after = m ? fn.slice(m.index, m.index + 700) : '';
    chk(!!m && /if\(seat\.blink\) seat\.blink\.closed = false;/.test(after), '★ ' + (i ? '대체(폴백) 모델' : 'GLB 모델') + ' — 뜬 눈 텍스처를 넣은 뒤 감김 표시도 «뜸» 으로');
  });
  chk(/if\(wantClosed!==seat\.blink\.closed\)\{seat\.blink\.closed=wantClosed;setFaceMap\(/.test(APP), '  프레임 루프는 표시가 바뀔 때만 텍스처를 바꾼다(그래서 위 초기화가 필요하다)');
  // 흉내: 졸던 중 모델 교체 → 다음 프레임에 감긴 그림으로 바뀌는가
  const sim = (reset) => { const seat = { blink: { closed: true }, tex: 'open' }; if (reset) seat.blink.closed = false; const want = true; if (want !== seat.blink.closed) { seat.blink.closed = want; seat.tex = 'closed'; } return seat.tex; };
  chk(sim(true) === 'closed' && sim(false) === 'open', '  흉내 — 초기화하면 다음 프레임에 감긴다 · 안 하면 뜬 눈으로 남는다(옛 동작)');
}

say('');
say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅');
process.exit(fail ? 1 : 0);

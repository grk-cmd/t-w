/* ═══ 🪟 sim-top-level.js — «항상 위» 단계(overlay-win.js · overlay-mac.js TOP_LEVEL) ═══════════════
   [왜] 실행 화면 창을 맥에서 'screen-saver' 로 띄우면 메뉴 막대에서 펼친 메뉴 · 제어 센터 위에 캐릭터가 겹쳤다.
        단계는 플랫폼 모듈 한 곳에서 정하고, main.js 의 창 올리기(메인 · 방명록 · 디자인 · 구글 로그인 · 색 대화상자 복원)는 모두 그것을 따른다.
   ・1절: 플랫폼 모듈을 실제로 불러 단계를 본다 — 윈도우 'screen-saver' · 맥 'status' · 두 모듈 export 이름이 같다
   ・2절: main.js — 단계를 글자로 쓰지 않는다 · 단계를 주는 setAlwaysOnTop 은 모두 overlay.TOP_LEVEL
   ・3절: 깨 보기
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const DIRS = ['.', '..', path.join('..', 'apps', 'desktop')];
const read = (f) => { for(const d of DIRS){ const p = path.join(d, f); if(fs.existsSync(p)) return fs.readFileSync(p, 'utf8'); } return null; };
const WIN = read('overlay-win.js'), MAC = read('overlay-mac.js'), MAIN = read('main.js');
for(const [n, v] of [['overlay-win.js', WIN], ['overlay-mac.js', MAC], ['main.js', MAIN]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}

/* 플랫폼 모듈을 가짜 electron 으로 불러 내보낸 것을 받는다 */
const fakeRequire = (m) => { if(m === 'electron') return { screen: {}, app: { getPath: () => '/tmp' } }; return require(m); };
const load = (src) => { const m = { exports: {} }; new Function('module', 'exports', 'require', src)(m, m.exports, fakeRequire); return m.exports; };
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');

function platform(winSrc, macSrc){
  const w = load(winSrc), m = load(macSrc);
  const kw = Object.keys(w).sort().join(','), km = Object.keys(m).sort().join(',');
  return { win: w.TOP_LEVEL, mac: m.TOP_LEVEL, same: kw === km };
}
/* 단계를 주는 setAlwaysOnTop 호출 — 인자가 둘인 것만(끄기 · 기본 단계는 빼고) */
function mainCalls(src){
  const body = stripComments(src);
  const calls = [...body.matchAll(/setAlwaysOnTop\(\s*true\s*,\s*([^)]+?)\s*\)/g)].map(x => x[1]);
  return { calls, literal: /'screen-saver'|"screen-saver"/.test(body) };
}
const mainOk = (r) => r.calls.length >= 5 && r.calls.every(a => a === 'overlay.TOP_LEVEL') && !r.literal;

say('── 1. 플랫폼 모듈의 단계');
const p = platform(WIN, MAC);
chk(p.win === 'screen-saver', "★ 윈도우 — 'screen-saver'(다른 «항상 위» 프로그램에 캐릭터가 가려지지 않게)");
chk(p.mac === 'status', "★ 맥 — 'status'(메뉴 막대에서 펼친 메뉴 · 제어 센터를 덮지 않게)");
chk(p.same, '  두 모듈의 export 이름이 같다(main.js 는 어느 쪽이 실렸는지 모른다)');

say('── 2. main.js 는 단계를 플랫폼 모듈에서 받는다');
const r = mainCalls(MAIN);
chk(r.calls.length >= 5, '  단계를 주는 창 올리기 ' + r.calls.length + '곳(메인 · 색 대화상자 복원 · 구글 로그인 · 방명록 · 디자인)');
chk(mainOk(r), "★ 모두 overlay.TOP_LEVEL · 'screen-saver' 글자 없음");

say('── 3. 깨 보기');
chk(platform(WIN, MAC.replace("const TOP_LEVEL = 'status';", "const TOP_LEVEL = 'screen-saver';")).mac !== 'status', "맥 단계를 'screen-saver' 로 되돌리면 위 1절 ★ 가 빨강");
chk(!platform(WIN, MAC.replace('  TOP_LEVEL,\n', '')).same, '맥 모듈에서 TOP_LEVEL 을 빼면 위 «export 이름이 같다» 가 빨강');
chk(!mainOk(mainCalls(MAIN.replace('mainWindow.setAlwaysOnTop(true, overlay.TOP_LEVEL);', "mainWindow.setAlwaysOnTop(true, 'screen-saver');"))), "main.js 한 곳을 'screen-saver' 로 쓰면 위 2절 ★ 가 빨강");

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

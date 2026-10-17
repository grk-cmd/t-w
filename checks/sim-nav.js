/* sim-nav.js — 🧭 창 열기 통로(nav.js) — 아래 기능이 «설정 창 · 마이홈 열어 줘 · 방에서 나가 줘» 를 부탁하는 한 곳
   실행:  node sim-nav.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 통로는 이름으로 부탁하므로 코드만 보면 «누가 이 창을 여나» 가 안 보이고, 이름을 잘못 쓰거나
     거는 곳을 빠뜨려도 조용히 아무 일도 안 한다(nav.js 주석). 그래서 이름마다 거는 곳 · 부르는 곳을 여기서 센다.
   ・1절: 통로 — 걸고 부르면 그 함수 · 인자 · 돌려준 값 그대로 · 안 걸린 이름은 아무 일도 안 함
   ・2절: 이름마다 거는 곳이 정확히 한 곳(정해진 파일) · 부르는 곳은 아는 이름만 · 글자 이름으로 부르지 않음 · 표
   ・3절: HTML 순서(쓰는 모듈 · app.js 보다 먼저) · app.js 연결(빈 껍데기 · deps)
   ・4절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('shared/nav.js'), HTML = read('desk-companion-prototype.html'), APP = read('app.js');
if (!MOD || !HTML || !APP) { say('  ? 원본 못 찾음 — nav.js · desk-companion-prototype.html · app.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
/* 이름 → 거는 파일(nav.js 주석과 같다) */
const OWNER = { PROGRAM_SETTINGS: 'launcher/program-settings.js', PROGRAM_SETTINGS_CLOSE: 'launcher/program-settings.js', MY_HOME: 'myhome/myhome-ui.js', LEAVE_ROOM: 'room/room-entry.js', ASSET_IMPORT: 'creator/asset-import.js' };

function load(mod) { const win = {}; new Function('window', 'module', mod)(win, undefined); return win.TwNav; }
function judge(mod, html, files) {
  const r = {};
  try {
    const N = load(mod);
    r.names = Object.keys(N.NAV).sort().join() === Object.keys(OWNER).sort().join() && Object.isFrozen(N.NAV);
    let got = null; N.on(N.NAV.MY_HOME, (...a) => { got = a; return 'ret'; });
    r.go = N.go(N.NAV.MY_HOME, 1, 'b') === 'ret' && got && got.join() === '1,b';
    r.unset = N.go(N.NAV.LEAVE_ROOM) === undefined && N.go('없는이름') === undefined;
  } catch (e) { r.err = String(e && e.message || e); }
  const NAVN = (() => { try { return Object.keys(load(mod).NAV); } catch (_) { return []; } })();
  r.table = {}; r.unknown = []; r.literal = [];
  for (const n of NAVN) r.table[n] = { on: [], go: [] };
  for (const [f, t0] of files) {
    if (f === 'shared/nav.js') continue;
    const t = strip(t0);
    for (const m of t.matchAll(/\btwNav\.(on|go)\(\s*twNav\.NAV\.([A-Z_]+)/g)) { if (!r.table[m[2]]) r.unknown.push(f + ' ' + m[2]); else r.table[m[2]][m[1]].push(f); }
    for (const m of t.matchAll(/\btwNav\.(on|go)\(\s*(?!twNav\.NAV\.)/g)) r.literal.push(f + ' ' + m[1]);
  }
  r.badOwner = NAVN.filter(n => !(r.table[n].on.length === 1 && r.table[n].on[0] === OWNER[n]));
  r.noCaller = NAVN.filter(n => !r.table[n].go.length);
  const order = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
  const at = order.indexOf('shared/nav.js');
  const users = files.filter(([f, t]) => f !== 'shared/nav.js' && /\btwNav\b/.test(strip(t))).map(([f]) => f);
  r.late = at < 0 ? ['(nav.js 를 안 싣는다)'] : users.filter(f => order.indexOf(f) >= 0 && order.indexOf(f) < at);
  r.users = users.length;
  return r;
}

const ORDER = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
const FILES = ORDER.map(f => [f, f === 'app.js' ? APP : read(f)]).filter(([, t]) => t);
const R = judge(MOD, HTML, FILES);

say('── 1. 통로');
chk(!R.err && R.names, '이름 넷(설정 창 열기 · 닫기 · 마이홈 · 방 나가기) · 바꿀 수 없는 표' + (R.err ? ' — ' + R.err : ''));
chk(R.go, '건 함수를 그 인자로 부르고 돌려준 값을 그대로 돌려준다');
chk(R.unset, '안 걸린 이름 · 모르는 이름은 아무 일도 안 한다(예전 «typeof 함수면 부른다» 와 같다)');

say('── 2. 거는 곳 · 부르는 곳');
chk(!R.badOwner.length, '이름마다 거는 곳은 정해진 한 파일' + (R.badOwner.length ? ' — 어긋남: ' + R.badOwner.map(n => n + '(' + R.table[n].on.join(' · ') + ')').join(', ') : ''));
chk(!R.noCaller.length, '이름마다 부르는 곳이 있다(안 쓰는 이름을 남기지 않는다)' + (R.noCaller.length ? ' — ' + R.noCaller.join(' · ') : ''));
chk(!R.unknown.length && !R.literal.length, '부르는 곳은 twNav.NAV.이름 으로만(모르는 이름 · 글자 이름 없음)' + (R.unknown.concat(R.literal).length ? ' — ' + R.unknown.concat(R.literal).join(' · ') : ''));
for (const n of Object.keys(R.table)) say('     ' + n + ' — 거는 곳 ' + R.table[n].on.join(' · ') + ' / 부르는 곳 ' + (R.table[n].go.join(' · ') || '(없음)'));

say('── 3. 싣는 순서 · app.js');
chk(R.users >= 8 && !R.late.length, '쓰는 파일 ' + R.users + '개(app.js 포함)보다 nav.js 를 먼저 싣는다' + (R.late.length ? ' — 먼저 실리는 것: ' + R.late.join(' · ') : ''));
chk(/^const twNav = TwNav;$/m.test(APP) && !/\bNAV_OFF\b/.test(APP), 'app.js — window.TwNav 를 그대로 받는다(빈 껍데기 없음 — 가드 걷기 3차)');
const glueN = (APP.match(/^  twNav: twNav,$/gm) || []).length;
chk(glueN === FILES.filter(([f, t]) => f !== 'app.js' && f !== 'shared/nav.js' && /^const twNav = deps\.twNav;/m.test(t)).length && glueN >= 8, '모듈은 deps 로 받는다 — 받는 모듈 수 = 만드는 줄의 twNav 줄 수(' + glueN + ')');

say('── 4. 일부러 깨 보기');
const twice = FILES.map(([f, t]) => [f, f === 'myhome/scheduler.js' ? t + '\ntwNav.on(twNav.NAV.MY_HOME, ()=>{});\n' : t]);
chk(judge(MOD, HTML, twice).badOwner.includes('MY_HOME'), '다른 파일이 같은 이름을 또 걸면 빨강');
const unk = FILES.map(([f, t]) => [f, f === 'myhome/scheduler.js' ? t + '\ntwNav.go(twNav.NAV.MY_HOMEE);\n' : t]);
chk(judge(MOD, HTML, unk).unknown.length > 0, '모르는 이름으로 부르면 빨강');
const lit = FILES.map(([f, t]) => [f, f === 'myhome/scheduler.js' ? t + "\ntwNav.go('myHome');\n" : t]);
chk(judge(MOD, HTML, lit).literal.length > 0, '글자 이름으로 부르면 빨강');
const line = '<script src="parts/shared/nav.js"></script>';
const lateHtml = HTML.indexOf(line) < 0 ? HTML : HTML.replace(line, '').replace('<script src="parts/app.js"></script>', '<script src="parts/app.js"></script>\n' + line);
chk(judge(MOD, lateHtml, FILES).late.length > 0, 'nav.js 를 app.js 뒤로 옮기면 빨강');
chk(!judge(MOD.replace('const fn = _fns[name]; return fn ? fn(...a) : undefined;', 'return _fns[name](...a);'), HTML, FILES).unset, '안 걸린 이름에서 던지게 바꾸면 빨강');

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 창 열기는 nav.js 통로 한 곳'));
process.exit(fail ? 1 : 0);

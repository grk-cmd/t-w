/* sim-launcher-state.js — 🧭 런처 공용 상태(launcher-state.js — 앱 모드 · 마이홈이 런처 위에 열려 있나)
   실행:  node sim-launcher-state.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 두 값은 바꾸는 모듈(app-mode.js · window-mode.js)이 들고 있었다. 달성표 · 마이홈 모듈이 그 모듈을 바라보고,
     그 모듈도 달성표 · 마이홈을 불러 순환이 됐다(sim-dep-cycles). 주인을 맨 아래 이 파일로 내렸으니 다시 위로 올라가지 않게 지킨다.
   ・1절: 처음 값 · 쓰고 읽기 · 만들 때마다 따로
   ・2절: 싣는 순서(읽는 · 바꾸는 모듈 · app.js 보다 먼저) · app.js 는 처음 읽는 모듈보다 먼저 만든다 · 값을 드는 곳은 여기 하나 · 바꾸는 곳은 정해진 곳뿐
   ・3절: mutation test */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('launcher/launcher-state.js'), HTML = read('desk-companion-prototype.html'), APP = read('app.js');
if (!MOD || !HTML || !APP) { say('  ? 원본 못 찾음 — launcher-state.js · desk-companion-prototype.html · app.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const SELF = 'launcher/launcher-state.js';
/* 앱 모드를 바꾸는 곳은 app-mode.js(launchApp · backToLauncher) 하나. 마이홈 열림은 app-mode.js(런처 복귀) · app.js 가 마이홈 창 · 구경에 넘기는 쓰는 함수 */
const APPMODE_WRITERS = ['launcher/app-mode.js'];
const MHOPEN_WRITERS = ['launcher/app-mode.js', 'app.js'];

function judge(mod, html, files, app) {
  const r = {};
  try {
    const win = {};
    new Function('window', 'module', mod)(win, undefined);
    const a = win.TwLauncherState.createLauncherState(), b = win.TwLauncherState.createLauncherState();
    r.init = a.appMode() === 'run' && a.myHomeOpen() === false;
    a.setAppMode('editseat'); a.setMyHomeOpen(true);
    r.write = a.appMode() === 'editseat' && a.myHomeOpen() === true;
    a.setAppMode('run'); a.setMyHomeOpen(false);
    r.back = a.appMode() === 'run' && a.myHomeOpen() === false;
    b.setAppMode('editseat');
    r.apart = a.appMode() === 'run' && b.appMode() === 'editseat';
    r.keys = Object.keys(a).sort().join(',') === 'appMode,myHomeOpen,setAppMode,setMyHomeOpen';
  } catch (e) { r.err = String(e && e.message || e); }
  const order = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
  const at = order.indexOf(SELF);
  const users = files.filter(([f, t]) => f !== SELF && /\blauncherState(Mod)?\b/.test(strip(t))).map(([f]) => f);
  r.users = users.length;
  r.late = at < 0 ? ['(launcher-state.js 를 안 싣는다)'] : users.filter(f => order.indexOf(f) >= 0 && order.indexOf(f) < at);
  /* app.js — 만드는 줄이 처음 쓰는 줄보다 먼저(뒤면 읽는 모듈이 TDZ 에 걸린다) */
  const A = strip(app);
  const iMk = A.indexOf('const launcherStateMod = TwLauncherState.createLauncherState();');
  const iUse = A.search(/\blauncherStateMod\.|\blauncherState: launcherStateMod\b/);
  r.made = iMk >= 0 && iUse > iMk;
  /* 값을 드는 곳은 여기 하나 — 옛 주인에 let 이 되살아나면 두 벌이 된다 */
  r.owners = files.filter(([f, t]) => f !== SELF && /^\s*let (appMode|myHomeOpen)\b/m.test(strip(t))).map(([f]) => f);
  /* 옛 주인을 바라보는 읽기가 남지 않았다(순환으로 돌아감) */
  r.oldReads = files.filter(([, t]) => /\bappModeMod\.appMode\b|\bwindowModeMod\.(set)?[mM]yHomeOpen\b/.test(strip(t))).map(([f]) => f);
  r.appModeWriters = files.filter(([f, t]) => !APPMODE_WRITERS.includes(f) && /\.setAppMode\(/.test(strip(t))).map(([f]) => f);
  r.mhWriters = files.filter(([f, t]) => !MHOPEN_WRITERS.includes(f) && /\blauncherState(Mod)?\.setMyHomeOpen\b/.test(strip(t))).map(([f]) => f);
  r.appModeSet = /\blauncherState\.setAppMode\(/.test(strip(files.find(([f]) => f === 'launcher/app-mode.js')?.[1] || ''));
  return r;
}

const ORDER = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
const FILES = ORDER.map(f => [f, f === 'app.js' ? APP : read(f)]).filter(([, t]) => t);
const R = judge(MOD, HTML, FILES, APP);

say('── 1. 처음 값 · 쓰고 읽기');
chk(!R.err && R.init, '처음엔 앱 모드 run · 마이홈 닫힘' + (R.err ? ' — ' + R.err : ''));
chk(R.write && R.back, '쓰는 함수로 바꾼 값을 읽는 함수가 그대로 돌려준다(되돌리기 포함)');
chk(R.apart, '만들 때마다 따로 든다(검사 · 다시 만들기가 서로 안 섞임)');
chk(R.keys, '내놓는 이름은 넷뿐 — appMode · setAppMode · myHomeOpen · setMyHomeOpen');

say('── 2. 싣는 순서 · 만드는 줄 · 주인 · 바꾸는 곳');
chk(FILES.length >= 100, 'HTML 이 싣는 parts/ 파일 ' + FILES.length + '개를 읽었다');
chk(R.users >= 3 && !R.late.length, '런처 상태를 쓰는 파일 ' + R.users + '개 모두보다 launcher-state.js 를 먼저 싣는다' + (R.late.length ? ' — 먼저 실리는 것: ' + R.late.join(' · ') : ''));
chk(R.made, 'app.js 는 launcherStateMod 를 처음 쓰는 줄보다 먼저 만든다');
chk(!R.owners.length, '앱 모드 · 마이홈 열림을 let 으로 드는 곳은 launcher-state.js 하나' + (R.owners.length ? ' — 그 밖: ' + R.owners.join(' · ') : ''));
chk(!R.oldReads.length, '옛 주인(appModeMod.appMode · windowModeMod.myHomeOpen)을 바라보는 곳 없음 — 순환으로 돌아가지 않는다' + (R.oldReads.length ? ' — ' + R.oldReads.join(' · ') : ''));
chk(R.appModeSet && !R.appModeWriters.length, '앱 모드를 바꾸는 곳은 app-mode.js 뿐' + (R.appModeWriters.length ? ' — 그 밖: ' + R.appModeWriters.join(' · ') : ''));
chk(!R.mhWriters.length, '마이홈 열림을 바꾸는 곳은 app-mode.js · app.js(마이홈 창 · 구경에 넘기는 쓰는 함수)뿐' + (R.mhWriters.length ? ' — 그 밖: ' + R.mhWriters.join(' · ') : ''));

say('── 3. mutation test');
chk(!judge(MOD.replace('setAppMode: (v)=>{ appMode = v; },', 'setAppMode: (v)=>{},'), HTML, FILES, APP).write, '앱 모드 쓰기를 빼면 빨강');
chk(!judge(MOD.replace('setMyHomeOpen: (v)=>{ myHomeOpen = v; },', 'setMyHomeOpen: (v)=>{},'), HTML, FILES, APP).write, '마이홈 열림 쓰기를 빼면 빨강');
chk(!judge(MOD.replace("let appMode = 'run';", "let appMode = 'editseat';"), HTML, FILES, APP).init, '처음 값을 바꾸면 빨강');
const line = '<script src="parts/launcher/launcher-state.js"></script>';
const lateHtml = HTML.indexOf(line) < 0 ? HTML : HTML.replace(line, '').replace('<script src="parts/app.js"></script>', '<script src="parts/app.js"></script>\n' + line);
chk(judge(MOD, lateHtml, FILES, APP).late.length > 0, 'launcher-state.js 를 app.js 뒤로 옮기면 빨강');
const mk = 'const launcherStateMod = TwLauncherState.createLauncherState();';
const lateApp = APP.replace(mk, '') + '\n' + mk + '\n';
chk(!judge(MOD, HTML, FILES.map(([f, t]) => [f, f === 'app.js' ? lateApp : t]), lateApp).made, 'app.js 가 처음 쓰는 줄보다 늦게 만들면 빨강');
const E = judge(MOD, HTML, FILES.map(([f, t]) => [f, f === 'launcher/window-mode.js' ? t + '\nlet myHomeOpen = false;\nlauncherState.setAppMode("run");\nlauncherState.setMyHomeOpen(true);\nappModeMod.appMode();\n' : t]), APP);
chk(E.owners.includes('launcher/window-mode.js') && E.appModeWriters.includes('launcher/window-mode.js') && E.mhWriters.includes('launcher/window-mode.js') && E.oldReads.includes('launcher/window-mode.js'), '다른 파일이 값을 들거나 · 바꾸거나 · 옛 주인을 읽으면 빨강');

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 앱 모드 · 마이홈 열림의 주인은 launcher-state.js 하나'));
process.exit(fail ? 1 : 0);

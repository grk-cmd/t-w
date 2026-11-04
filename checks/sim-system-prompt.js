/* sim-system-prompt.js — 🔐 시스템 확인 창이 맨 앞이면 실행 화면을 «항상 위» 에서 내린다 (B-1104-10)
   실행:  node sim-system-prompt.js   (system-prompt.js · main.js 와 같은 폴더에서)
   §1 system-prompt.js 실행 — 앱스토어 · 암호 · Touch ID · 시스템 설정 · 설치 프로그램 키는 참, 다른 앱 · 빈 값은 거짓, 대소문자 무시
   §2 main.js 의 _setRunTop · _onSysPromptFront 를 꺼내 가짜 창에 돌린다 — 확인 창이 오면 내리고, 물러나면 다시 맨 위(screen-saver),
      런처 · 생성기(설정 모드)에서는 건드리지 않고, 같은 값이 다시 와도 다시 부르지 않는다
   §3 연결 — 활성 창 폴링이 판정을 부르고, 창 배치(run)도 같은 깃발로 맨 위를 정한다(수백 번/분 다시 올리지 않게)
   §4 깨 보기 */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'app/parts/shared/' + f, 'parts/shared/' + f, '../' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SP = read('system-prompt.js'), MAIN = read('main.js');
if (!SP || !MAIN) { say('  ? 원본 못 찾음 — system-prompt.js · main.js'); process.exit(2); }

say('§1 system-prompt.js (실행)');
const mod = { exports: {} };
new Function('module', 'exports', SP)(mod, mod.exports);
const { isSystemPrompt } = mod.exports;
chk(['mac:com.apple.appstore', 'mac:com.apple.securityagent', 'mac:com.apple.coreautha', 'mac:com.apple.systempreferences', 'mac:com.apple.installer'].every(isSystemPrompt), '앱스토어 · 암호 · Touch ID · 시스템 설정 · 설치 프로그램 → 참');
chk(isSystemPrompt('MAC:COM.APPLE.APPSTORE') && isSystemPrompt(' mac:com.apple.appstore '), '  ↳ 대소문자 · 앞뒤 공백 무시');
chk(!['mac:com.google.chrome', 'win:discord.exe', 'mac:app store.app', '', null, undefined].some(isSystemPrompt), '다른 앱 · 옛 이름 키 · 빈 값 → 거짓');

/* main.js 에서 «let _sysPromptFront» 부터 _onSysPromptFront 끝까지 꺼낸다 */
function block(src){
  const i = src.indexOf('let _sysPromptFront = false;');
  const j = src.indexOf('\nfunction _onSysPromptFront(on){', i);
  const k = j < 0 ? -1 : src.indexOf('\n}\n', j);
  return (i < 0 || k < 0) ? null : src.slice(i, k + 2);
}
function run(src){
  const b = block(src);
  if (!b) return null;
  const calls = [], logs = [];
  const win = { setAlwaysOnTop: (...a) => calls.push(a), isDestroyed: () => false };
  const env = { mainWindow: win, _isConfigMode: false };
  const api = new Function('env', '_diagLog', `let mainWindow = env.mainWindow; let _isConfigMode = env._isConfigMode;\n${b}\nreturn { on: _onSysPromptFront, setConfig: v => { _isConfigMode = v; }, front: () => _sysPromptFront };`)(env, (m) => logs.push(m));
  return { api, calls, logs };
}

say('§2 main.js 의 내리기 · 올리기 (실행)');
const r = run(MAIN);
chk(!!r, '_setRunTop · _onSysPromptFront 를 꺼냈다');
if (r) {
  r.api.on(true);
  chk(JSON.stringify(r.calls) === JSON.stringify([[false]]) && r.api.front() === true, '확인 창이 맨 앞 → 실행 화면을 항상 위에서 내림');
  r.api.on(true);
  chk(r.calls.length === 1, '  ↳ 같은 값이 다시 와도(0.5초마다) 다시 부르지 않음');
  r.api.on(false);
  chk(JSON.stringify(r.calls[1]) === JSON.stringify([true, 'screen-saver']), '물러나면 다시 맨 위(screen-saver)');
  r.api.setConfig(true); r.api.on(true); r.api.on(false);
  chk(r.calls.length === 2 && r.api.front() === false, '런처 · 생성기(설정 모드)에서는 창을 건드리지 않음(깃발만 따라감)');
  chk(r.logs.length === 4 && r.logs.every(l => l.startsWith('[확인창]')), '바뀔 때마다 진단 기록 한 줄');
}

say('§3 연결');
chk(/_onSysPromptFront\(isSystemPrompt\(activeKey\)\);/.test(MAIN), '활성 창 폴링이 판정을 부른다(활성 키로)');
chk(/require\('\.\/app\/parts\/shared\/system-prompt'\)/.test(MAIN), 'main 이 app/parts/shared/system-prompt.js 를 싣는다(설치 파일 app/** 에 든다)');
const runBranch = (MAIN.match(/const wantTop = !_sysPromptFront;[\s\S]*?_noteApplied\(runRect, wantTop\);/) || [''])[0];
chk(/_winAlreadyIs\(runRect, wantTop\)/.test(runBranch) && /_setRunTop\(wantTop\);/.test(runBranch), '창 배치(run)도 같은 깃발로 맨 위를 정한다 — 확인 창 위로 되돌리지 않음');
chk(!/mainWindow\.setAlwaysOnTop\(true, 'screen-saver'\);\s*\n\s*_noteApplied\(runRect/.test(MAIN), '  ↳ run 갈래에 맨 위 고정 줄이 남지 않음');

chk(/if\(w === mainWindow\) _setRunTop\(!_sysPromptFront\);/.test(MAIN), '색 고르기 창을 닫을 때 메인 창도 같은 깃발로 되돌린다');
chk(/_winAlreadyIs\(rect, !_sysPromptFront\)\) return;/.test(MAIN) && /_noteApplied\(rect, !_sysPromptFront\);/.test(MAIN), '표시 설정이 바뀔 때도 같은 깃발로 판정 · 기록');
chk(!/_winAlreadyIs\(rect, true\)/.test(MAIN), '  ↳ 실행 화면을 «늘 맨 위» 로 판정하는 자리가 남지 않음');

say('§4 깨 보기');
const b1 = MAIN.replace("  if(top) mainWindow.setAlwaysOnTop(true, 'screen-saver');\n  else mainWindow.setAlwaysOnTop(false);", "  mainWindow.setAlwaysOnTop(true, 'screen-saver');");
const r1 = b1 !== MAIN ? run(b1) : null;
if (r1) r1.api.on(true);
chk(!!r1 && JSON.stringify(r1.calls) !== JSON.stringify([[false]]), '늘 맨 위로 고정하면 «내림» 이 빨강');
const b2 = MAIN.replace('  if(on === _sysPromptFront) return;\n', '');
const r2 = b2 !== MAIN ? run(b2) : null;
if (r2) { r2.api.on(true); r2.api.on(true); }
chk(!!r2 && r2.calls.length === 2, '같은 값 거르기를 빼면 «다시 부르지 않음» 이 빨강');
const b3 = MAIN.replace('const wantTop = !_sysPromptFront;', 'const wantTop = true;');
chk(b3 !== MAIN && !/const wantTop = !_sysPromptFront;/.test(b3), '창 배치가 늘 맨 위면 §3 연결이 빨강(글이 바뀜을 확인)');

say('');
say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — 확인 창이 맨 앞인 동안 실행 화면이 그 위를 덮지 않는다');
process.exit(fail ? 1 : 0);

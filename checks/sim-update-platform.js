/* sim-update-platform.js — 플랫폼마다 자동 업데이트를 어떻게 돌리나(update-platform.js) · 맥 «응용 프로그램 폴더로 옮기기» (main.js)
   ・1절: createUpdatePlatform 을 실제로 불러 — 윈도우 · 맥 · 리눅스의 다시 확인 · 설치 폴더 · 끌 때 설치 · 재시작 · 옮기기 묻기
   ・2절: main.js _offerMoveToApplications 를 떼어 가짜 dialog · app 위에서 돌린다 — 처음 한 번 · 거절 · 옮김 · 실패 · 저장
   ・3절: 배선 — 창보다 먼저 묻고 옮기면 창을 띄우지 않는다 · 설정 파일에 물은 표시 · 설치 목록
   ・4절: mutation test
   [실행] 저장소 루트에서 node checks/run.js sim-update-platform */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync(path.join(__dirname, 'app')) ? __dirname : path.join(__dirname, '..');
const find = (rel) => fs.existsSync(path.join(ROOT, rel)) ? path.join(ROOT, rel) : path.join(__dirname, path.basename(rel));
const SRC = {};
for(const r of ['update-platform.js', 'main.js', 'package.json']){
  const f = find(r);
  if(!fs.existsSync(f)){ console.log('  ? 원본 못 찾음 — ' + r); process.exit(2); }
  SRC[r] = fs.readFileSync(f, 'utf8');
}
const UP = SRC['update-platform.js'], MAIN = SRC['main.js'];

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { if(ok){ pass++; say('  ✓ ' + msg); } else { fail++; say('  ✗ ' + msg); } };
const loadMod = (src) => { const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports); return m.exports; };

const WIN_EXE = 'C:\\Users\\u\\AppData\\Local\\Programs\\tw\\Together Working.exe';
const MAC_EXE = '/Applications/Together Working.app/Contents/MacOS/Together Working';
const MAC_DL_EXE = '/Users/u/Downloads/Together Working.app/Contents/MacOS/Together Working';

/* o: platform · execPath · writable(바꿔 끼울 폴더에 쓸 수 있나) · inApps · packaged · src */
function mk(o){
  const seen = [];
  const M = loadMod(o.src || UP);
  const mac = o.platform === 'darwin';
  const u = M.createUpdatePlatform({
    platform: o.platform, execPath: o.execPath || (mac ? MAC_EXE : WIN_EXE), isPackaged: o.packaged !== false,
    path: mac ? path.posix : path.win32,
    inApplications: () => o.inApps !== false,
    writable: (dir) => { seen.push(dir); return o.writable !== false; },
  });
  return { u, seen, M };
}

/* main.js 의 _offerMoveToApplications 와 그 앞 상태 줄을 떼어 가짜 위에서 돌린다 */
function moveScene(o){
  const src = o.mainSrc || MAIN;
  const decl = (src.match(/let _macMoveAsked = false;\n/) || [''])[0];
  const fn = (src.match(/async function _offerMoveToApplications\(\)\{[\s\S]*?\n\}\n/) || [''])[0];
  const log = [];
  const dialog = { showMessageBox: async (opts) => { log.push('ask'); if(o.dialogThrows) throw new Error('x'); return { response: o.response == null ? 1 : o.response, opts }; } };
  const app = { moveToApplicationsFolder: () => { log.push('move'); if(o.moveThrows) throw new Error('busy'); return o.moved !== false; } };
  const platform = { shouldOfferMove: (asked) => !asked && o.offer !== false };
  const errs = [];
  const run = new Function('_updatePlatform', 'dialog', 'app', 'saveSettings', '_errorLog',
    decl + fn + '\nreturn { offer: _offerMoveToApplications, asked: () => _macMoveAsked, setAsked: (v) => { _macMoveAsked = v; } };')(
    platform, dialog, app, () => log.push('save'), { write: (lv, where, e) => errs.push(where + ':' + (e && e.message)) });
  if(o.asked) run.setAsked(true);
  return { run, log, errs, ok: !!(decl && fn) };
}

(async () => {
  say('── 1. createUpdatePlatform');
  {
    const w = mk({ platform: 'win32' });
    chk(w.u.backgroundRecheck === true, '윈도우 — 켜 둔 동안 다시 확인');
    chk(w.u.installDir() === 'C:\\Users\\u\\AppData\\Local\\Programs\\tw', '  설치 폴더는 exe 가 든 폴더');
    chk(w.u.installOnQuit() === true && w.seen.join() === 'C:\\Users\\u\\AppData\\Local\\Programs\\tw', '  끌 때 설치 — 그 폴더에 쓸 수 있는지 실제로 물어 정한다');
    chk(mk({ platform: 'win32', writable: false }).u.installOnQuit() === false, '★ 윈도우 — 쓸 수 없는 폴더(모든 사용자 설치)면 끌 때 설치 없음');
    chk(w.u.relaunchAction(true) === w.M.RELAUNCH.RELAUNCH && w.u.relaunchAction(false) === w.M.RELAUNCH.RELAUNCH, '★ 윈도우 재시작은 받은 판이 있어도 relaunch(끌 때 설치는 main 이 끈다 — 예전 그대로)');
    chk(w.u.shouldOfferMove(false) === false, '  윈도우는 옮기기를 묻지 않는다');

    const m = mk({ platform: 'darwin' });
    chk(m.u.backgroundRecheck === true, '맥 — 켜 둔 동안 다시 확인');
    chk(m.u.installDir() === '/Applications', '★ 맥 설치 폴더는 .app 번들이 든 폴더(…/X.app/Contents/MacOS/X 의 네 단계 위) — 번들 안이 아니다');
    chk(mk({ platform: 'darwin', execPath: MAC_DL_EXE }).u.installDir() === '/Users/u/Downloads', '  다른 자리여도 .app 이 든 폴더');
    chk(m.u.installOnQuit() === true && m.seen.join() === '/Applications', '  맥 끌 때 설치 — .app 이 든 폴더에 쓸 수 있는지 물어 정한다');
    chk(mk({ platform: 'darwin', writable: false }).u.installOnQuit() === false, '★ 맥 — .app 이 든 폴더에 못 쓰면 끌 때 설치 없음');
    chk(m.u.relaunchAction(true) === m.M.RELAUNCH.INSTALL, '★ 맥 재시작 — 끌 때 설치가 켜진 채 받은 판(Squirrel 이 준비함)이 있으면 «설치하고 다시 켜기»');
    chk(m.u.relaunchAction(false) === m.M.RELAUNCH.RELAUNCH && m.u.relaunchAction('yes') === m.M.RELAUNCH.RELAUNCH && m.u.relaunchAction(undefined) === m.M.RELAUNCH.RELAUNCH,
      '  준비된 판이 없으면(또는 true 가 아닌 값) relaunch');
    chk(mk({ platform: 'darwin', inApps: false }).u.shouldOfferMove(false) === true, '★ 맥 — 응용 프로그램 폴더 밖 설치본 · 아직 안 물었으면 옮기기를 묻는다');
    chk(mk({ platform: 'darwin', inApps: false }).u.shouldOfferMove(true) === false, '  이미 물었으면 다시 묻지 않는다(처음 한 번)');
    chk(m.u.shouldOfferMove(false) === false, '  이미 응용 프로그램 폴더면 묻지 않는다');
    chk(mk({ platform: 'darwin', inApps: false, packaged: false }).u.shouldOfferMove(false) === false, '  개발 실행(npm start · 설치본 아님)이면 묻지 않는다');

    const l = mk({ platform: 'linux' });
    chk(l.u.backgroundRecheck === false && l.u.installOnQuit() === false && l.seen.length === 0, '리눅스 — 다시 확인 · 끌 때 설치 없음 · 폴더를 묻지도 않는다');
    chk(l.u.relaunchAction(true) === l.M.RELAUNCH.RELAUNCH && l.u.shouldOfferMove(false) === false, '  리눅스 재시작은 relaunch · 옮기기 없음');
    chk(Object.isFrozen(m.M.RELAUNCH) && Object.isFrozen(m.M.AUTO_PLATFORMS), '  상수 표는 바꿀 수 없다');
  }

  say('── 2. 맥 «응용 프로그램 폴더로 옮기기» (main.js _offerMoveToApplications)');
  {
    const no = moveScene({ response: 1 });
    chk(no.ok, 'main.js 에서 함수와 상태 줄을 떼어 돌린다');
    const r1 = await no.run.offer();
    chk(r1 === false && no.log.join() === 'save,ask' && no.run.asked() === true, '★ [그대로 쓰기] — 물은 표시를 먼저 저장하고 묻는다 · 옮기지 않고 그대로 켠다 [' + no.log.join(' → ') + ']');
    const r2 = await no.run.offer();
    chk(r2 === false && no.log.filter(x => x === 'ask').length === 1, '★ 한 번 물은 뒤엔 다시 묻지 않는다');
    const yes = moveScene({ response: 0 });
    const r3 = await yes.run.offer();
    chk(r3 === true && yes.log.join() === 'save,ask,move', '★ [옮기기] — 옮기고 true(부르는 쪽은 창을 띄우지 않는다 · Electron 이 새 자리에서 다시 켠다)');
    const nm = moveScene({ response: 0, moved: false });
    chk(await nm.run.offer() === false, '  옮기기가 false 를 돌려주면 그대로 켠다');
    const mt = moveScene({ response: 0, moveThrows: true });
    chk(await mt.run.offer() === false && mt.errs.length === 1 && /응용 프로그램 폴더로 옮기기:busy/.test(mt.errs[0]), '★ 옮기기가 실패하면(같은 이름 앱이 켜져 있음 등) 오류 파일에 남기고 그대로 켠다');
    const dt = moveScene({ dialogThrows: true });
    chk(await dt.run.offer() === false && !dt.log.includes('move'), '  묻는 창이 실패해도 그대로 켠다');
    const skip = moveScene({ offer: false });
    chk(await skip.run.offer() === false && skip.log.length === 0, '  물을 때가 아니면(update-platform 판단) 아무것도 하지 않는다');
    const pre = moveScene({ asked: true });
    chk(await pre.run.offer() === false && pre.log.length === 0, '  설정 파일에 물은 표시가 있으면 묻지 않는다');
  }

  say('── 3. 배선');
  {
    const pkg = JSON.parse(SRC['package.json']);
    chk(((pkg.build && pkg.build.files) || []).includes('update-platform.js'), 'update-platform.js 가 설치 목록(package.json files)에 있다 — 빠지면 설치본이 켜지지 않는다');
    chk(/\n    _applyAppMenu\(\);[^\n]*\n    if\(await _offerMoveToApplications\(\)\) return;[^\n]*\n    _bootDone = true;\n    createWindow\(\);/.test(MAIN), '★ 창보다 먼저 묻고, 옮기면 이 실행은 창을 띄우지 않는다');
    chk(/if\(data\.macMoveAsked === true\) _macMoveAsked = true;/.test(MAIN) && /macMoveAsked: _macMoveAsked,/.test(MAIN), '  물은 표시는 tw-settings.json 에 읽고 쓴다(다음에 켜도 다시 묻지 않게)');
    chk(/inApplications: \(\) => app\.isInApplicationsFolder\(\),/.test(MAIN) && /isPackaged: app\.isPackaged/.test(MAIN), '  응용 프로그램 폴더 판단은 Electron app.isInApplicationsFolder · 설치본 판단은 app.isPackaged');
    chk(!/checkMacUpdate|mac-available|githubRepoInfo|isNewerVersion/.test(MAIN), '  맥 전용 업데이트 갈래(checkMacUpdate · mac-available · 릴리스 태그 직접 읽기)가 남아 있지 않다');
  }

  say('── 4. mutation test');
  {
    const DIR = 'return p.dirname(p.dirname(p.dirname(p.dirname(execPath))));';
    chk(UP.includes(DIR), 'update-platform.js 원문이 그대로 있다(아래 변이의 바탕)');
    chk(mk({ platform: 'darwin', src: UP.replace(DIR, 'return p.dirname(execPath);') }).u.installDir() !== '/Applications', '맥 설치 폴더를 실행 파일 옆으로 바꾸면 — 번들 안을 본다 → 1절 «맥 설치 폴더» 가 빨강');
    const REL = 'return isMac && staged === true ? RELAUNCH.INSTALL : RELAUNCH.RELAUNCH;';
    chk(UP.includes(REL) && mk({ platform: 'darwin', src: UP.replace(REL, 'return RELAUNCH.RELAUNCH;') }).u.relaunchAction(true) === 'relaunch', '맥 재시작 갈래를 지우면 — 준비된 판이 있어도 relaunch → 1절 «맥 재시작» 이 빨강');
    chk(mk({ platform: 'win32', src: UP.replace(REL, 'return staged === true ? RELAUNCH.INSTALL : RELAUNCH.RELAUNCH;') }).u.relaunchAction(true) === 'install', '플랫폼 확인을 지우면 — 윈도우 재시작도 설치로 바뀐다 → 1절 «윈도우 재시작» 이 빨강');
    const ASK = 'if(!isMac || deps.isPackaged !== true || asked === true) return false;';
    chk(UP.includes(ASK) && mk({ platform: 'darwin', inApps: false, src: UP.replace(ASK, 'if(!isMac) return false;') }).u.shouldOfferMove(true) === true, '물은 표시 확인을 지우면 — 켤 때마다 묻는다 → 1절 «처음 한 번» 이 빨강');
    const WR = 'return deps.writable(installDir()) === true;';
    chk(UP.includes(WR) && mk({ platform: 'darwin', writable: false, src: UP.replace(WR, 'return true;') }).u.installOnQuit() === true, '폴더 확인을 지우면 — 못 쓰는 폴더에서도 끌 때 설치 → 1절 빨강');
    const SAVE = "  _macMoveAsked = true;\n  try{ saveSettings(); }catch(_){}\n";
    chk(MAIN.includes(SAVE), '  main.js _offerMoveToApplications 원문이 그대로 있다');
    const ns = moveScene({ response: 1, mainSrc: MAIN.replace(SAVE, '') });
    await ns.run.offer();
    chk(ns.run.asked() === false && !ns.log.includes('save'), '물은 표시를 세우지 않으면 — 다음에 또 묻는다 → 2절 «한 번» 이 빨강');
    const RESP = '  if(!r || r.response !== 0) return false;\n';
    chk(MAIN.includes(RESP), '  main.js 응답 확인 원문이 그대로 있다');
    const nr = moveScene({ response: 1, mainSrc: MAIN.replace(RESP, '') });
    chk(await nr.run.offer() === true && nr.log.includes('move'), '응답 확인을 지우면 — [그대로 쓰기] 를 눌러도 옮긴다 → 2절 빨강');
  }

  say('');
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ 예외 — ' + (e && e.stack || e)); process.exit(1); });

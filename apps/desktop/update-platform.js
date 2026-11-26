/* update-platform.js — 플랫폼마다 자동 업데이트를 어떻게 돌리나 · main.js 가 쓴다 (검사 checks/sim-update-platform.js)
   [왜 한 곳인가] 윈도우와 맥은 electron-updater 위에서 «다시 확인 · 끌 때 설치 · 재시작» 이 다르게 굴러간다.
     main.js 곳곳에 process.platform 을 흩어 두면 한쪽을 빠뜨린다 — 판단은 여기, main.js 는 부르기만.
   ★ 맥(Squirrel.Mac)은 «끌 때 설치» 를 켜면 새 판을 다 받는 즉시 설치 준비(staging)를 끝낸다. 그 뒤로는 앱이 어떻게 꺼지든 설치되고,
     윈도우처럼 끄는 순간 autoInstallOnAppQuit=false 로 막을 수 없다(electron-updater MacUpdater.doDownloadUpdate).
     그래서 맥에서 Squirrel 이 준비를 끝낸 판이 있을 때의 재시작(app.relaunch)은 «설치하고 다시 켜기»(quitAndInstall)로 바꾼다 —
     relaunch 로 다시 켠 앱이 설치 중인 번들과 부딪히지 않게. «준비 끝» 은 electron-updater 의 'update-downloaded'(Squirrel 이 준비를 시작하는 때)가 아니라
     Squirrel(electron autoUpdater)의 'update-downloaded' 로 안다(nativeStaging) — 준비 전 · 준비 실패 · 끌 때 설치가 꺼진 채 받음(폴더에 못 씀)이면
     quitAndInstall 은 그 끝을 기다리며 재시작이 멈추니 relaunch 그대로. 준비 전에 끝나면 Squirrel 은 설치하지 않아 relaunch 와 겹치지 않는다.
   ⚠️ 폴더에 못 쓰는 맥에서 [지금 재시작](quitAndInstall)을 누르면 Squirrel 이 새로 받아 설치를 시도한다 — 관리자 암호를 묻거나 실패할 수 있다.
   TODO: 관리자가 아닌 맥 계정에서 [지금 재시작] 이 설치되는지 확인하고, 안 되면 그 맥은 다운로드 페이지로 보낸다.
   ⚠️ 맥 자동 업데이트는 번들을 바꿔 끼울 폴더에 쓸 수 있어야 하고, 응용 프로그램 폴더 밖(다운로드 · dmg 안 · App Translocation)에서는
     실패한다 — 처음 한 번 옮기기를 묻는다(shouldOfferMove).
   createUpdatePlatform({ platform, execPath, isPackaged, path, inApplications, writable(dir) }) →
     { backgroundRecheck · nativeStaging · installDir() · installOnQuit() · relaunchAction(staged) · shouldOfferMove(asked) } */
'use strict';

const RELAUNCH = Object.freeze({ RELAUNCH: 'relaunch', INSTALL: 'install' });
const AUTO_PLATFORMS = Object.freeze(['win32', 'darwin']);

/** @param {{ platform: string, execPath: string, isPackaged: boolean, inApplications: () => boolean,
 *            writable: (dir: string) => boolean, path: { dirname: (p: string) => string } }} deps */
function createUpdatePlatform(deps){
  const platform = deps.platform;
  const execPath = deps.execPath;
  const p = deps.path;
  const isMac = platform === 'darwin';

  /* 바꿔 끼울 것이 놓인 폴더 — 윈도우는 exe 가 든 폴더, 맥은 .app 번들이 든 폴더(…/X.app/Contents/MacOS/X 에서 네 단계 위). */
  function installDir(){
    if(!isMac) return p.dirname(execPath);
    return p.dirname(p.dirname(p.dirname(p.dirname(execPath))));
  }

  return {
    /* 켜 둔 동안 4~5시간마다 다시 확인하나(update-recheck.js) */
    backgroundRecheck: AUTO_PLATFORMS.includes(platform),
    /* Squirrel(electron autoUpdater)의 «준비 끝» 을 들어야 하나 — 맥만(윈도우 NSIS 는 Squirrel 을 안 쓰고 · 리눅스엔 없다) */
    nativeStaging: isMac,
    installDir,
    /* 받아 둔 판을 끌 때 조용히 설치하나 — 그 폴더에 쓸 수 없으면(모든 사용자 설치 · 관리자 폴더) 묻는 창이 뜨거나 실패하니 켜지 않는다 */
    installOnQuit(){
      if(!AUTO_PLATFORMS.includes(platform)) return false;
      return deps.writable(installDir()) === true;
    },
    /* 재시작(계정 정리 · 망가진 창 다시 띄우기)을 어떻게 하나 — staged = Squirrel 이 설치 준비를 끝냈다(nativeStaging) */
    relaunchAction(staged){
      return isMac && staged === true ? RELAUNCH.INSTALL : RELAUNCH.RELAUNCH;
    },
    /* 응용 프로그램 폴더로 옮기기를 물을까 — 맥 · 설치본 · 폴더 밖 · 아직 안 물었을 때 한 번 */
    shouldOfferMove(asked){
      if(!isMac || deps.isPackaged !== true || asked === true) return false;
      return deps.inApplications() !== true;
    },
  };
}

module.exports = { createUpdatePlatform, RELAUNCH, AUTO_PLATFORMS };

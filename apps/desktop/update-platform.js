/* update-platform.js — 플랫폼마다 자동 업데이트를 어떻게 돌리나 · main.js 가 쓴다 (검사 checks/sim-update-platform.js)
   [왜 한 곳인가] 윈도우와 맥은 electron-updater 위에서 «다시 확인 · 끌 때 설치 · 재시작» 이 다르게 굴러간다.
     main.js 곳곳에 process.platform 을 흩어 두면 한쪽을 빠뜨린다 — 판단은 여기, main.js 는 부르기만.
   ★ 맥(Squirrel.Mac)은 «끌 때 설치» 를 켜면 새 판을 다 받는 즉시 설치 준비(staging)를 끝낸다. 그 뒤로는 앱이 어떻게 꺼지든 설치되고,
     윈도우처럼 끄는 순간 autoInstallOnAppQuit=false 로 막을 수 없다(electron-updater MacUpdater.doDownloadUpdate).
     그래서 맥에서 받은 판이 있을 때의 재시작(app.relaunch)은 «설치하고 다시 켜기»(quitAndInstall)로 바꾼다 —
     relaunch 로 다시 켠 앱이 설치 중인 번들과 부딪히지 않게.
   ⚠️ 맥 자동 업데이트는 번들을 바꿔 끼울 폴더에 쓸 수 있어야 하고, 응용 프로그램 폴더 밖(다운로드 · dmg 안 · App Translocation)에서는
     실패한다 — 처음 한 번 옮기기를 묻는다(shouldOfferMove).
   createUpdatePlatform({ platform, execPath, isPackaged, inApplications, writable(dir) }) →
     { backgroundRecheck · installDir() · installOnQuit() · relaunchAction(downloaded) · shouldOfferMove(asked) } */
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
    installDir,
    /* 받아 둔 판을 끌 때 조용히 설치하나 — 그 폴더에 쓸 수 없으면(모든 사용자 설치 · 관리자 폴더) 묻는 창이 뜨거나 실패하니 켜지 않는다 */
    installOnQuit(){
      if(!AUTO_PLATFORMS.includes(platform)) return false;
      return deps.writable(installDir()) === true;
    },
    /* 재시작(계정 정리 · 망가진 창 다시 띄우기)을 어떻게 하나 — 맥에서 받은 판이 있으면 설치하고 다시 켜기 */
    relaunchAction(downloaded){
      return isMac && downloaded === true ? RELAUNCH.INSTALL : RELAUNCH.RELAUNCH;
    },
    /* 응용 프로그램 폴더로 옮기기를 물을까 — 맥 · 설치본 · 폴더 밖 · 아직 안 물었을 때 한 번 */
    shouldOfferMove(asked){
      if(!isMac || deps.isPackaged !== true || asked === true) return false;
      return deps.inApplications() !== true;
    },
  };
}

module.exports = { createUpdatePlatform, RELAUNCH, AUTO_PLATFORMS };

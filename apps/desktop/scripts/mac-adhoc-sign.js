/* ═══ 🍎 mac-adhoc-sign.js — 맥 앱 번들을 ad-hoc 으로 다시 서명한다 (electron-builder afterPack) ═══
   [왜] 인증서가 없는 맥 빌드(mac-probe · 로컬 — 정식 릴리스는 release.yml 이 환경 release 의 Developer ID 로 서명 · 공증)는
     electron-builder 가 서명을 건너뛴다. 그러면 Electron 원본에 붙어 있던 서명이 우리가 넣은 Info.plist · 아이콘 · app.asar 와 어긋난 채 나가고,
     애플 실리콘 맥은 «손상되었기 때문에 열 수 없습니다»(codesign: «code has no resources but signature
     indicates they must be present»)로 막는다. 그래서 dmg 를 만들기 전에 번들 전체를 ad-hoc(`-`)으로 다시 서명한다.
   ⚠️ afterSign 이 아니라 afterPack 이다 — afterSign 은 «서명이 일어나지 않았으면» 건너뛴다(app-builder-lib 24).
   ⚠️ hardened runtime(--options runtime)은 걸지 않는다. ad-hoc 서명에 runtime 을 걸면 entitlements 까지
     맞춰야 하고, 공증 없이 얻는 것이 없다. 인증서가 있으면 electron-builder 가 이 뒤에 Developer ID 로 다시 서명한다(이 서명은 덮인다).
   ⚠️ ad-hoc 서명은 빌드마다 달라서, 맥이 «손쉬운 사용» 같은 권한을 업데이트 뒤 다시 물을 수 있다(서명 없을 때와 같다). */
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');

const SIGN_ARGS = ['--force', '--deep', '--sign', '-'];
const VERIFY_ARGS = ['--verify', '--deep', '--strict'];

/** @param {{ electronPlatformName: string, appOutDir: string, packager: { appInfo: { productFilename: string } } }} ctx
 *  @param {(cmd: string, args: string[]) => void} run */
function signApp(ctx, run){
  if (ctx.electronPlatformName !== 'darwin') return null;
  const app = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`);
  run('codesign', [...SIGN_ARGS, app]);
  run('codesign', [...VERIFY_ARGS, app]);
  return app;
}

const runReal = (cmd, args) => { execFileSync(cmd, args, { stdio: 'inherit' }); };

module.exports = async function afterPack(ctx){ signApp(ctx, runReal); };
module.exports.signApp = signApp;
module.exports.SIGN_ARGS = SIGN_ARGS;
module.exports.VERIFY_ARGS = VERIFY_ARGS;

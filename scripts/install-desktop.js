#!/usr/bin/env node
/* 루트 `npm install` 의 postinstall — 앱(apps/desktop) 의존성을 깐다.
   [왜] 예전 `npm --prefix apps/desktop install` 은 Windows 에서 apps/desktop 대신 루트를 다시 깔아,
     루트 postinstall 이 끝없이 되풀이됐다. 그래서 --prefix 를 쓰지 않고 그 폴더를 cwd 로 주어 부른다.
   ★ 한 번만: 부른 npm 에 표시(GUARD)를 넘긴다 — 어떤 까닭으로 루트가 다시 깔려도 이 스크립트는 바로 끝난다.
   ★ 부모 npm 이 넘기는 npm_config_local_prefix(루트 경로)는 지운다 — 자식이 루트를 제 자리로 읽지 않게.
   ★ npm 은 부모가 쓰는 그것(npm_execpath)을 node 로 부른다 — Windows 의 npm.cmd · PATH 차이를 타지 않는다.
   검사: checks/sim-install-desktop.js */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const GUARD = 'TW_DESKTOP_INSTALL';
const DESKTOP = path.join(__dirname, '..', 'apps', 'desktop');

function childEnv(env){
  const out = { ...env, [GUARD]: '1' };
  for (const k of Object.keys(out)) if (/^npm_config_local_prefix$/i.test(k)) delete out[k];
  return out;
}

function main(){
  if (process.env[GUARD]) return 0;
  const env = childEnv(process.env);
  const cli = process.env.npm_execpath;
  const r = cli
    ? spawnSync(process.execPath, [cli, 'install'], { cwd: DESKTOP, env, stdio: 'inherit' })
    : spawnSync('npm', ['install'], { cwd: DESKTOP, env, stdio: 'inherit', shell: true });
  if (r.error){ console.error('[install-desktop] npm 을 못 불렀다 —', r.error.message); return 1; }
  return r.status == null ? 1 : r.status;
}

if (require.main === module) process.exit(main());
module.exports = { GUARD, childEnv };

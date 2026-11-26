#!/usr/bin/env node
/* scripts/bump-version.js — 앱 버전 올리기: apps/desktop/package.json(+ lock) 숫자 → «chore: <버전>» 커밋 → 주석 태그 v<버전>
   앱이 apps/desktop 으로 옮겨 가(#431) 루트에서 «npm version -m "chore: %s"» 를 칠 수 없게 됐다. 같은 결과를 이 한 곳에서 만든다 —
   release-start.yml(버튼)도 사람 손(npm run version:bump -- patch)도 이걸 부른다.
   ⚠️ 하위 폴더의 npm version 에 git 커밋 · 태그를 맡기지 않는다(폴더 위치에 따라 건너뛰기도 한다) — 숫자만 올리고 git 은 여기서 직접.
   ⚠️ 태그는 주석 태그(-a) — «git push --follow-tags» 는 주석 태그만 올린다.

   실행(저장소 루트): node scripts/bump-version.js <patch|minor|major|prerelease|X.Y.Z[-beta.N]> [--preid=beta]
   검사: checks/sim-bump-version.js */
'use strict';
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join('apps', 'desktop');
const KIND_RE = /^(patch|minor|major|prerelease|\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)$/;
const OPT_RE = /^--preid=[a-z]+$/;
const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;
const USAGE = '쓰는 법: node scripts/bump-version.js <patch|minor|major|prerelease|X.Y.Z[-beta.N]> [--preid=beta]';

/* run(cmd, cwd) 는 시험에서 갈아 끼운다. 넘기는 글은 위 정규식을 통과한 것만 — 셸에 그대로 들어간다. */
function bump(args, root = ROOT, run = (cmd, cwd) => execSync(cmd, { cwd, encoding: 'utf8' })){
  const [kind, ...opts] = args;
  if(!kind || !KIND_RE.test(kind) || !opts.every(o => OPT_RE.test(o))) throw new Error(USAGE);
  if(run('git status --porcelain', root).trim()) throw new Error('Git working directory not clean — 커밋하거나 정리한 뒤 다시 한다');
  const out = run(['npm version', kind, ...opts, '--no-git-tag-version'].join(' '), path.join(root, APP_DIR));
  const v = (out.trim().split('\n').pop() || '').trim().replace(/^v/, '');
  if(!VERSION_RE.test(v)) throw new Error('npm version 결과를 읽지 못했다: ' + out.trim());
  run(`git add ${APP_DIR}/package.json ${APP_DIR}/package-lock.json`, root);
  run(`git commit -q -m "chore: ${v}"`, root);
  run(`git tag -a v${v} -m "chore: ${v}"`, root);
  return v;
}

module.exports = { bump, KIND_RE, VERSION_RE };

if(require.main === module){
  try{ console.log('v' + bump(process.argv.slice(2))); }
  catch(e){ console.error(e.message); process.exit(1); }
}

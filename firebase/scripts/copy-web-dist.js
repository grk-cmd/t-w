#!/usr/bin/env node
/* 메인 홈페이지 빌드(apps/web/dist)를 firebase/web-dist/ 로 옮긴다 — firebase.json `home` 칸 predeploy 마지막 단계.
   firebase-tools 는 firebase.json 이 있는 폴더(firebase/) 밖을 public 으로 받지 않아서(«outside of project directory») 안으로 들여온다.
   먼저 비운다 — 지난 빌드의 옛 해시 파일이 함께 올라가지 않게. web-dist/ 는 커밋하지 않는다(.gitignore). */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'apps', 'web', 'dist');
const DST = path.join(__dirname, '..', 'web-dist');

if (!fs.existsSync(path.join(SRC, 'index.html'))) {
  console.error('copy-web-dist: ' + SRC + '/index.html 이 없다 — 웹 빌드(npm -w @tw/web run build)가 먼저 돌아야 한다');
  process.exit(1);
}
fs.rmSync(DST, { recursive: true, force: true });
fs.cpSync(SRC, DST, { recursive: true });
console.log('copy-web-dist: ' + path.relative(process.cwd(), SRC) + ' → ' + path.relative(process.cwd(), DST));

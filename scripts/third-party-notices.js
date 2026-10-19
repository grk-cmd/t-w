#!/usr/bin/env node
/* 📄 오픈소스 라이선스 안내 만들기 — 앱 ⚙️ 프로그램 설정 › 시스템 › «오픈소스 라이선스» 창이 보여 주는 글(app/licenses/oss-notices.js).
   목록은 package-lock.json 의 운영 패키지(dev · optional 뺌 — optional 은 koffi 의 플랫폼별 빌드로, 본체 koffi 가 같은 라이선스로 덮는다)
   + 아래 VENDOR(npm 밖으로 앱에 넣은 것 · 설치 파일에 같이 묶이는 Electron).
   라이선스 원문은 설치된 node_modules 의 LICENSE 파일에서 — 파일이 없는 패키지(firebase 등)는 scripts/oss-licenses/<SPDX>.txt 표준 원문.
   실행: npm ci 뒤 `node scripts/third-party-notices.js` — 의존성을 바꾼 PR 에서 다시 돌린다(checks/sim-oss-licenses.js 가 목록이 lock 과 같은지 본다). */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'app', 'licenses', 'oss-notices.js');
const STD_DIR = path.join(__dirname, 'oss-licenses');

/* npm 밖에서 앱에 들어간 것 — 원문(text)이 없으면 SPDX 표준 원문을 쓴다 */
const MIT = (holder) => `MIT License\n\nCopyright (c) ${holder}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n`;
const VENDOR = [
  { name: 'Electron', version: (lock) => lockVersion(lock, 'electron'), license: 'MIT', file: 'node_modules/electron/LICENSE',
    note: 'Chromium 등 Electron 이 포함한 구성 요소의 라이선스는 설치 폴더의 LICENSES.chromium.html 에 있습니다.' },
  { name: 'three.js (+ GLTFLoader · DRACOLoader · SkeletonUtils · TransformControls)', version: '', license: 'MIT', text: MIT('2010-2021 Three.js Authors') },
  { name: 'Draco 3D 디코더', version: '', license: 'Apache-2.0', copyright: 'Copyright 2016 The Draco Authors.' },
  { name: 'JSZip', version: '3.10.1', license: 'MIT', text: MIT('2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso'),
    note: 'JSZip 은 MIT 또는 GPLv3 중 고를 수 있으며 이 프로그램은 MIT 로 씁니다. 안에 든 pako 는 MIT(Copyright (C) 2014-2017 Vitaly Puzrin and Andrei Tuputcyn) · zlib 라이선스입니다.' },
  { name: 'QRCode for JavaScript', version: '', license: 'MIT', text: MIT('2009 Kazuhiko Arase') },
  { name: 'Noto Emoji (📚 아이콘)', version: '', license: 'Apache-2.0', copyright: 'Copyright 2013 Google, Inc. All Rights Reserved.',
    note: '빨간 책과 초록 책의 색을 서로 바꿨습니다.' },
];

function lockVersion(lock, name){ const p = lock.packages['node_modules/' + name]; return p ? p.version : '?'; }

/* lock 의 운영 패키지 — [{ name, version, license, dir }] 이름 순 */
function lockPackages(lock){
  return Object.entries(lock.packages || {})
    .filter(([p, v]) => p.startsWith('node_modules/') && !v.dev && !v.devOptional && !v.optional && !v.link)
    .map(([p, v]) => ({ name: p.slice(p.lastIndexOf('node_modules/') + 'node_modules/'.length), version: v.version, license: v.license || '알 수 없음', dir: p }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

function authorOf(dir, readFile){
  try{
    const a = JSON.parse(readFile(path.join(dir, 'package.json'))).author;
    return (typeof a === 'string' ? a : a && a.name) || null;
  }catch(_){ return null; }
}

function licenseFileText(dir, readDir, readFile){
  let files;
  try{ files = readDir(dir); }catch(_){ return null; }
  const f = files.find(n => /^(licen[cs]e|copying)(\.|$)/i.test(n));
  return f ? readFile(path.join(dir, f)).trim() : null;
}

/* 글 한 벌 — io(readDir · readFile · std(spdx))를 받아 순수하게 만든다(검사가 가짜 파일로 굴린다) */
function build(lock, io){
  const items = [];
  for(const v of VENDOR){
    const version = typeof v.version === 'function' ? v.version(lock) : v.version;
    let text = v.text || (v.file ? (() => { try{ return io.readFile(path.join(ROOT, v.file)).trim(); }catch(_){ return null; } })() : null);
    if(!text) text = ((v.copyright ? v.copyright + '\n\n' : '') + (io.std(v.license) || '')).trim();
    items.push({ name: v.name, version, license: v.license, text, note: v.note || '' });
  }
  for(const p of lockPackages(lock)){
    const dir = path.join(ROOT, p.dir);
    const own = licenseFileText(dir, io.readDir, io.readFile);
    // 원문 파일이 없는 MIT 는 package.json 의 저자로 표준 원문을 채운다(MIT 는 저작권 줄이 원문의 일부)
    const mitAuthor = !own && p.license === 'MIT' ? authorOf(dir, io.readFile) : null;
    const text = own || (mitAuthor ? MIT(mitAuthor) : io.std(p.license)) || ('(원문 파일 없음 — 라이선스: ' + p.license + ')');
    items.push({ name: p.name, version: p.version, license: p.license, text, note: '' });
  }
  /* 같은 원문은 한 번만 — 그 원문을 쓰는 이름을 묶어 머리에 적는다 */
  const groups = new Map();
  for(const it of items){
    if(!groups.has(it.text)) groups.set(it.text, []);
    groups.get(it.text).push(it);
  }
  const out = [];
  out.push('투게더워킹이 쓰는 오픈소스');
  out.push('');
  out.push('이 프로그램은 아래 오픈소스 소프트웨어를 포함하거나 사용합니다. 각 라이선스 원문은 목록 아래에 있습니다.');
  out.push('');
  out.push('== 목록 (' + items.length + '개) ==');
  const label = (it) => it.name + (it.version ? ' ' + it.version : '');
  for(const it of items) out.push('- ' + label(it) + ' — ' + it.license + (it.note ? '\n    ' + it.note : ''));
  out.push('');
  out.push('== 라이선스 원문 ==');
  for(const [text, list] of groups){
    out.push('');
    out.push('---- ' + list.map(label).join(', ') + ' ----');
    out.push(text);
  }
  return out.join('\n') + '\n';
}

function render(text){
  return '/* 만든 파일 — 손으로 고치지 말 것. scripts/third-party-notices.js 가 만든다(검사 checks/sim-oss-licenses.js). */\n' +
    'window.TwOssNoticesText = ' + JSON.stringify(text) + ';\n';
}

const realIo = {
  readDir: (d) => fs.readdirSync(d),
  readFile: (f) => fs.readFileSync(f, 'utf8'),
  std: (spdx) => { try{ return fs.readFileSync(path.join(STD_DIR, spdx + '.txt'), 'utf8').trim(); }catch(_){ return null; } },
};

module.exports = { VENDOR, lockPackages, build, render, OUT };

if(require.main === module){
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  if(!fs.existsSync(path.join(ROOT, 'node_modules'))){ console.error('node_modules 가 없다 — npm ci 뒤에 돌린다'); process.exit(2); }
  const text = build(lock, realIo);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, render(text));
  console.log('썼다 — ' + path.relative(ROOT, OUT) + ' · ' + Math.round(Buffer.byteLength(text) / 1024) + 'KB');
}

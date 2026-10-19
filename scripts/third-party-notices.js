#!/usr/bin/env node
/* 📄 오픈소스 라이선스 안내 만들기 — 앱 «오픈소스 라이선스» 창이 보여 주는 목록(app/licenses/oss-notices.js · window.TwOssNotices).
   항목은 사람이 아는 단위 — VENDOR + 앱이 직접 쓰는 npm 패키지. 그 아래로 딸려 오는 패키지(@firebase/* 등)는 그 항목 안에 접고 원문만 같이 싣는다.
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
  { name: 'Electron', url: 'https://www.electronjs.org', version: (lock) => lockVersion(lock, 'electron'), license: 'MIT', file: 'node_modules/electron/LICENSE',
    note: 'Chromium 등 구성 요소의 라이선스는 설치 폴더의 LICENSES.chromium.html' },
  { name: 'three.js', url: 'https://threejs.org', version: '', note: 'GLTFLoader · DRACOLoader · SkeletonUtils · TransformControls 포함', license: 'MIT', text: MIT('2010-2021 Three.js Authors') },
  { name: 'Draco 3D 디코더', url: 'https://google.github.io/draco/', version: '', license: 'Apache-2.0', copyright: 'Copyright 2016 The Draco Authors.' },
  { name: 'JSZip', url: 'https://stuk.github.io/jszip/', version: '3.10.1', license: 'MIT', text: MIT('2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso'),
    note: 'MIT · GPLv3 중 MIT 로 씀 · 안에 든 pako(MIT · zlib)' },
  { name: 'QRCode for JavaScript', url: 'https://github.com/kazuhikoarase/qrcode-generator', version: '', license: 'MIT', text: MIT('2009 Kazuhiko Arase') },
  { name: 'Noto Emoji', url: 'https://github.com/googlefonts/noto-emoji', version: '', license: 'Apache-2.0', copyright: 'Copyright 2013 Google, Inc. All Rights Reserved.',
    note: '📚 아이콘 — 책 색을 서로 바꿈' },
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

/* 패키지가 의존하는 이름을 lock 경로로 — 자기 아래 node_modules 부터 위로(npm 의 찾기 순서) */
function resolveDep(lock, fromPath, name){
  let base = fromPath;
  for(;;){
    const cand = (base ? base + '/' : '') + 'node_modules/' + name;
    if(lock.packages[cand]) return cand;
    if(!base) return null;
    const i = base.lastIndexOf('/node_modules/');
    base = i < 0 ? '' : base.slice(0, i);
  }
}

/* 앱이 직접 쓰는 패키지마다 그 아래로 딸려 오는 운영 패키지 — 먼저 닿은 묶음에 넣는다 */
function groupByDirect(lock){
  const prod = new Map(lockPackages(lock).map(p => [p.dir, p]));
  const direct = Object.keys((lock.packages[''] || {}).dependencies || {}).sort();
  const owner = new Map();
  for(const d of direct){
    const stack = [resolveDep(lock, '', d)];
    while(stack.length){
      const at = stack.pop();
      if(!at || owner.has(at) || !prod.has(at)) continue;
      owner.set(at, d);
      for(const n of Object.keys(lock.packages[at].dependencies || {})) stack.push(resolveDep(lock, at, n));
    }
  }
  const groups = direct.map(d => ({ direct: d, members: [] }));
  for(const [dir, p] of prod){
    const g = groups.find(x => x.direct === owner.get(dir)) || (groups.push({ direct: p.name, members: [] }), groups[groups.length - 1]);
    g.members.push(p);
  }
  return groups.filter(g => g.members.length);
}

/* 보이는 이름 — 사람이 아는 이름으로(나머지는 npm 이름 그대로) */
const LABEL = { firebase: 'Firebase JS SDK' };

function urlOf(dir, readFile){
  try{
    const j = JSON.parse(readFile(path.join(dir, 'package.json')));
    const r = typeof j.repository === 'string' ? j.repository : j.repository && j.repository.url;
    for(const c of [j.homepage, (r || '').replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://')]){
      if(/^https:\/\//.test(c || '')) return c;
    }
    return '';
  }catch(_){ return ''; }
}

/* 안내 한 벌 — io(readDir · readFile · std(spdx))를 받아 순수하게 만든다(검사가 가짜 파일로 굴린다).
   항목 = VENDOR + 앱이 직접 쓰는 npm 패키지(하위 패키지는 그 항목 안으로 접는다) */
function build(lock, io){
  const textOf = (p) => {
    const dir = path.join(ROOT, p.dir);
    const own = licenseFileText(dir, io.readDir, io.readFile);
    // 원문 파일이 없는 MIT 는 package.json 의 저자로 표준 원문을 채운다(MIT 는 저작권 줄이 원문의 일부)
    const mitAuthor = !own && p.license === 'MIT' ? authorOf(dir, io.readFile) : null;
    return own || (mitAuthor ? MIT(mitAuthor) : io.std(p.license)) || ('(원문 파일 없음 — 라이선스: ' + p.license + ')');
  };
  /* 같은 원문은 한 번 — 그 원문을 쓰는 이름을 머리에 묶는다 */
  const raw = (pairs) => {
    const m = new Map();
    for(const [label, text] of pairs){ if(!m.has(text)) m.set(text, []); m.get(text).push(label); }
    return [...m].map(([text, labels]) => '---- ' + labels.join(', ') + ' ----\n' + text).join('\n\n');
  };
  const items = [];
  for(const v of VENDOR){
    const version = typeof v.version === 'function' ? v.version(lock) : v.version;
    let text = v.text || (v.file ? (() => { try{ return io.readFile(path.join(ROOT, v.file)).trim(); }catch(_){ return null; } })() : null);
    if(!text) text = ((v.copyright ? v.copyright + '\n\n' : '') + (io.std(v.license) || '')).trim();
    items.push({ name: v.name, version, license: v.license, url: v.url || '', note: v.note || '', members: [], raw: raw([[v.name, text]]) });
  }
  for(const g of groupByDirect(lock)){
    const head = g.members.find(m => m.name === g.direct) || g.members[0];
    const licenses = [...new Set(g.members.map(m => m.license))];
    const subs = g.members.length - 1;
    items.push({
      name: LABEL[g.direct] || g.direct, version: head.version,
      license: head.license + (licenses.length > 1 ? ' 외 ' + (licenses.length - 1) : ''),
      licenses,
      url: urlOf(path.join(ROOT, head.dir), io.readFile),
      note: subs ? '하위 패키지 ' + subs + '개 포함' : '',
      members: g.members.map(m => m.name + ' ' + m.version),
      raw: raw(g.members.map(m => [m.name + ' ' + m.version, textOf(m)])),
    });
  }
  return { title: '투게더워킹이 쓰는 오픈소스', items };
}

function render(data){
  return '/* 만든 파일 — 손으로 고치지 말 것. scripts/third-party-notices.js 가 만든다(검사 checks/sim-oss-licenses.js). */\n' +
    'window.TwOssNotices = ' + JSON.stringify(data) + ';\n';
}

const realIo = {
  readDir: (d) => fs.readdirSync(d),
  readFile: (f) => fs.readFileSync(f, 'utf8'),
  std: (spdx) => { try{ return fs.readFileSync(path.join(STD_DIR, spdx + '.txt'), 'utf8').trim(); }catch(_){ return null; } },
};

module.exports = { VENDOR, lockPackages, groupByDirect, resolveDep, build, render, OUT };

if(require.main === module){
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  if(!fs.existsSync(path.join(ROOT, 'node_modules'))){ console.error('node_modules 가 없다 — npm ci 뒤에 돌린다'); process.exit(2); }
  const data = build(lock, realIo);
  const out = render(data);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out);
  console.log('썼다 — ' + path.relative(ROOT, OUT) + ' · 항목 ' + data.items.length + '개 · ' + Math.round(Buffer.byteLength(out) / 1024) + 'KB');
}

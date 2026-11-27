#!/usr/bin/env node
/* 맥 자동 업데이트 정보(latest-mac.yml · beta-mac.yml …) — 확인 · 합치기.
   release.yml 은 arm64 · x64 를 따로 빌드해서 잡마다 자기 arch 파일만 적힌 yml 이 하나씩 나온다.
   electron-updater(MacUpdater)는 yml 하나의 files 목록에서 url 에 «arm64» 가 든 것을 애플 실리콘에, 나머지를 인텔에 고른다.
   그래서 초안 잡에서 둘을 한 파일로 합쳐 올린다 — 한쪽만 올리면 다른 쪽 맥은 엉뚱한 arch 를 받거나 업데이트를 못 찾는다.
   ⚠️ 초안 잡(ubuntu)은 npm ci 를 하지 않아 js-yaml 이 없다. electron-builder 가 쓰는 모양(맨 위 스칼라 + files 목록)만 읽고,
     모르는 모양이면 던진다 — 조용히 틀린 파일을 올리지 않게.
   사용: mac-update-yml.js check <yml> <버전> <arch> <dist 폴더>
         mac-update-yml.js merge <출력 yml> <입력 yml>... */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ARCHES = Object.freeze(['arm64', 'x64']);

const unquote = (s) => String(s).replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');

/** @param {string} text @returns {{ top: Array<[string, string]>, files: Array<Array<[string, string]>> }} 값은 적힌 글자 그대로(따옴표 포함) */
function parse(text){
  const top = [];
  const files = [];
  let inFiles = false;
  for(const line of String(text).split(/\r?\n/)){
    if(!line.trim()) continue;
    let m;
    if((m = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line))){
      inFiles = m[1] === 'files' && m[2] === '';
      if(!inFiles) top.push([m[1], m[2]]);
      continue;
    }
    if(inFiles && (m = /^ {2}- ([A-Za-z0-9_]+):\s*(.*)$/.exec(line))){ files.push([[m[1], m[2]]]); continue; }
    if(inFiles && files.length && (m = /^ {4}([A-Za-z0-9_]+):\s*(.*)$/.exec(line))){ files[files.length - 1].push([m[1], m[2]]); continue; }
    throw new Error(`모르는 줄: ${JSON.stringify(line)}`);
  }
  if(!files.length) throw new Error('files 목록이 없다');
  return { top, files };
}

const get = (pairs, key) => { const p = pairs.find(([k]) => k === key); return p ? unquote(p[1]) : null; };

function serialize({ top, files }){
  const out = [];
  const [first, ...rest] = top;
  if(first) out.push(`${first[0]}: ${first[1]}`);
  out.push('files:');
  for(const f of files) f.forEach(([k, v], i) => out.push(`${i ? '    ' : '  - '}${k}: ${v}`));
  for(const [k, v] of rest) out.push(`${k}: ${v}`);
  return out.join('\n') + '\n';
}

/* yml 의 url 은 공백이 '-' 로 적히고, dist 의 파일 이름에는 공백이 남아 있다(초안 잡이 올리기 전에 '-' 로 바꾼다). */
const assetName = (fileName) => fileName.replace(/ /g, '-');
const sha512 = (buf) => crypto.createHash('sha512').update(buf).digest('base64');

/** 한 arch 잡이 만든 yml — 버전 · 자기 arch 파일만 · zip 이 있고 dist 의 파일과 sha512 · size 가 같은가. 어긋나면 던진다. */
function check(text, version, arch, distFiles){
  if(!ARCHES.includes(arch)) throw new Error(`arch 는 ${ARCHES.join(' · ')} 중 하나: ${arch}`);
  const y = parse(text);
  if(get(y.top, 'version') !== version) throw new Error(`version ${get(y.top, 'version')} ≠ ${version}`);
  const tag = `-${arch}.`;
  for(const f of y.files){
    const url = get(f, 'url');
    if(!url || !url.includes(tag)) throw new Error(`${arch} 가 아닌 파일이 적혀 있다: ${url}`);
    const local = distFiles.find(d => assetName(d.name) === url);
    if(!local) throw new Error(`yml 이 가리키는 ${url} 이 dist 에 없다`);
    if(get(f, 'sha512') !== sha512(local.data)) throw new Error(`${url} sha512 가 yml 과 다르다`);
    if(Number(get(f, 'size')) !== local.data.length) throw new Error(`${url} size 가 yml 과 다르다`);
  }
  if(!y.files.some(f => /\.zip$/.test(get(f, 'url')))) throw new Error('zip 이 적혀 있지 않다 — 맥 자동 업데이트는 zip 을 받는다');
  return y;
}

/** arm64 · x64 yml 을 하나로. 버전이 같아야 하고 url 이 겹치면 안 된다. 맨 위 path · sha512(옛 클라이언트용)는 x64 zip 으로 둔다. */
function merge(texts){
  const ys = texts.map(parse);
  const version = get(ys[0].top, 'version');
  for(const y of ys) if(get(y.top, 'version') !== version) throw new Error(`버전이 섞였다: ${get(y.top, 'version')} ≠ ${version}`);
  const files = ys.flatMap(y => y.files);
  const urls = files.map(f => get(f, 'url'));
  if(new Set(urls).size !== urls.length) throw new Error(`같은 url 이 두 번: ${urls.join(', ')}`);
  for(const arch of ARCHES){
    if(!urls.some(u => u.includes(`-${arch}.`) && /\.zip$/.test(u))) throw new Error(`${arch} zip 이 없다`);
  }
  const legacy = files.find(f => /-x64\.zip$/.test(get(f, 'url')));
  const dates = ys.map(y => get(y.top, 'releaseDate')).filter(Boolean).sort();
  const top = ys[0].top.map(([k, v]) => {
    if(k === 'path') return [k, get(legacy, 'url')];
    if(k === 'sha512') return [k, get(legacy, 'sha512')];
    if(k === 'releaseDate' && dates.length) return [k, `'${dates[dates.length - 1]}'`];
    return [k, v];
  });
  return serialize({ top, files });
}

function main(argv){
  const [cmd, ...a] = argv;
  if(cmd === 'check'){
    const [yml, version, arch, dir] = a;
    const distFiles = fs.readdirSync(dir).filter(n => fs.statSync(path.join(dir, n)).isFile())
      .map(name => ({ name, data: fs.readFileSync(path.join(dir, name)) }));
    const y = check(fs.readFileSync(yml, 'utf8'), version, arch, distFiles);
    console.log(`${yml}: ${y.files.map(f => get(f, 'url')).join(' · ')} — 버전 ${version} · sha512 일치`);
    return;
  }
  if(cmd === 'merge'){
    const [outPath, ...ins] = a;
    if(ins.length !== ARCHES.length) throw new Error(`입력 yml 은 ${ARCHES.length}개여야 한다: ${ins.length}`);
    fs.writeFileSync(outPath, merge(ins.map(p => fs.readFileSync(p, 'utf8'))));
    console.log(`${outPath} ← ${ins.join(' + ')}`);
    return;
  }
  throw new Error('사용: check <yml> <버전> <arch> <dist> | merge <출력> <입력>...');
}

if(require.main === module){
  try{ main(process.argv.slice(2)); }
  catch(e){ console.error(`::error::${e.message}`); process.exit(1); }
}

module.exports = { parse, serialize, check, merge, assetName, ARCHES };

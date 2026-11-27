#!/usr/bin/env node
/* ═══ 🍎 sim-mac-update-yml.js — 맥 자동 업데이트 정보(latest-mac.yml) 확인 · 합치기 ═══
   [무엇을 지키나] release.yml 은 arm64 · x64 를 따로 빌드해 잡마다 자기 arch 만 적힌 yml 을 낸다.
     `scripts/mac-update-yml.js` 가 잡 안에서 «버전 · 자기 arch 만 · zip 이 있고 sha512 · size 가 파일과 같다» 를 보고,
     초안 잡에서 둘을 한 파일로 합친다. 합치기가 틀리면 한쪽 맥 전체가 업데이트를 못 받는다.
     함수를 직접 불러 정상 · 경계 · 어긋남을 보고, 원본을 일부러 바꿔(mutation test) 빨강이 나는지도 본다.
     package.json 맥 빌드 설정(arch 는 명령줄이 정함 · 남의 OS 프리빌드 뺌)도 본다.
   실행: node checks/run.js sim-mac-update-yml
   종료 코드: 0=통과 · 1=실패 · 2=원본 없음 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');

function find(rel){
  for (const d of [process.cwd(), __dirname]){
    const p = path.join(d, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const SRC_PATH = find('scripts/mac-update-yml.js');
const PKG_PATH = find('package.json');
if (!SRC_PATH || !PKG_PATH){ console.log('원본 없음 — scripts/mac-update-yml.js · package.json'); process.exit(2); }
const SRC = fs.readFileSync(SRC_PATH, 'utf8');
const PKG = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));

let fail = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fail++; };
const throws = (fn, re) => { try { fn(); return false; } catch (e){ return re ? re.test(e.message) : true; } };

function loadFrom(src){
  const m = new Module(SRC_PATH, null);
  m.filename = SRC_PATH;
  m.paths = Module._nodeModulePaths(path.dirname(SRC_PATH));
  m._compile(src, SRC_PATH);
  return m.exports;
}
const Y = loadFrom(SRC);

const V = '0.14.0';
const sha = (b) => crypto.createHash('sha512').update(b).digest('base64');
/* dist 의 파일 이름은 공백이 남고(Together Working-…), yml 의 url 은 '-' 로 적힌다 */
function dist(arch){
  const zip = Buffer.from(`zip-${arch}`), dmg = Buffer.from(`dmg-${arch}-longer`);
  return [
    { name: `Together Working-${V}-${arch}.zip`, data: zip },
    { name: `Together Working-${V}-${arch}.dmg`, data: dmg },
  ];
}
function yml(arch, { version = V, date = '2026-11-26T01:00:00.000Z', files = dist(arch) } = {}){
  const lines = [`version: ${version}`, 'files:'];
  for (const f of files) lines.push(`  - url: ${f.name.replace(/ /g, '-')}`, `    sha512: ${sha(f.data)}`, `    size: ${f.data.length}`);
  lines.push(`path: ${files[0].name.replace(/ /g, '-')}`, `sha512: ${sha(files[0].data)}`, `releaseDate: '${date}'`);
  return lines.join('\n') + '\n';
}

console.log('\n[1] parse · serialize — electron-builder 모양 그대로 되돌아온다');
{
  const t = yml('arm64');
  ok(Y.serialize(Y.parse(t)) === t, '읽고 다시 쓰면 같은 글자');
  ok(throws(() => Y.parse('version: 1\nfiles:\n  foo\n'), /모르는 줄/), '모르는 모양이면 던진다(조용히 틀린 파일을 만들지 않음)');
  ok(throws(() => Y.parse('version: 1\npath: a\n'), /files/), 'files 목록이 없으면 던진다');
}

console.log('\n[2] check — 한 arch 잡의 yml');
{
  ok(!throws(() => Y.check(yml('arm64'), V, 'arm64', dist('arm64'))), 'arm64 정상 — 공백 이름 파일과 \'-\' url 을 맞춘다');
  ok(!throws(() => Y.check(yml('x64'), V, 'x64', dist('x64'))), 'x64 정상');
  ok(throws(() => Y.check(yml('arm64', { version: '0.13.9' }), V, 'arm64', dist('arm64')), /version/), '버전이 다르면 던진다');
  ok(throws(() => Y.check(yml('x64'), V, 'arm64', dist('x64')), /arm64 가 아닌/), '다른 arch 파일이 적혀 있으면 던진다');
  const bad = dist('arm64'); bad[0] = { ...bad[0], data: Buffer.from('zip-arm6X') };
  ok(throws(() => Y.check(yml('arm64'), V, 'arm64', bad), /sha512/), 'zip 내용이 yml 과 다르면 던진다');
  ok(throws(() => Y.check(yml('arm64'), V, 'arm64', dist('arm64').slice(1)), /dist 에 없다/), 'yml 이 가리키는 파일이 없으면 던진다');
  const dmgOnly = [dist('arm64')[1]];
  ok(throws(() => Y.check(yml('arm64', { files: dmgOnly }), V, 'arm64', dmgOnly), /zip/), 'zip 이 없으면 던진다(맥 업데이트는 zip 을 받는다)');
  ok(throws(() => Y.check(yml('arm64'), V, 'universal', dist('arm64')), /arch/), '모르는 arch 는 던진다');
  const sized = yml('arm64').replace(/size: (\d+)/, (_, n) => `size: ${Number(n) + 1}`);
  ok(throws(() => Y.check(sized, V, 'arm64', dist('arm64')), /size/), 'size 가 다르면 던진다');
}

console.log('\n[3] merge — arm64 + x64 를 한 파일로');
{
  const out = Y.merge([yml('arm64', { date: '2026-11-26T01:00:00.000Z' }), yml('x64', { date: '2026-11-26T02:00:00.000Z' })]);
  const p = Y.parse(out);
  const urls = p.files.map(f => f.find(([k]) => k === 'url')[1]);
  ok(urls.length === 4, `파일 넷: ${urls.join(' · ')}`);
  ok(['arm64', 'x64'].every(a => urls.some(u => u.endsWith(`-${a}.zip`))), 'arm64 · x64 zip 이 둘 다 있다');
  const top = Object.fromEntries(p.top);
  ok(top.path === `Together-Working-${V}-x64.zip`, `맨 위 path 는 x64 zip (옛 클라이언트용): ${top.path}`);
  ok(top.sha512 === sha(dist('x64')[0].data), '맨 위 sha512 도 x64 zip 것');
  ok(top.releaseDate === "'2026-11-26T02:00:00.000Z'", `releaseDate 는 늦은 쪽: ${top.releaseDate}`);
  ok(top.version === V && p.top[0][0] === 'version', 'version 이 맨 위');
  ok(throws(() => Y.merge([yml('arm64'), yml('x64', { version: '0.14.1' })]), /버전이 섞였다/), '버전이 섞이면 던진다');
  ok(throws(() => Y.merge([yml('arm64'), yml('arm64')]), /같은 url/), '같은 arch 를 두 번 넣으면 던진다');
  ok(throws(() => Y.merge([yml('arm64'), yml('x64', { files: [dist('x64')[1]] })]), /x64 zip 이 없다/), 'x64 zip 이 빠지면 던진다');
}

console.log('\n[4] mutation test — 지키는 줄을 지우면 빨강이 나는가');
{
  const cases = [
    ['arch 확인', "if(!url || !url.includes(tag)) throw", "if(false) throw", (M) => throws(() => M.check(yml('x64'), V, 'arm64', dist('x64')), /arm64 가 아닌/)],
    ['sha512 확인', "if(get(f, 'sha512') !== sha512(local.data)) throw", "if(false) throw",
      (M) => { const b = dist('arm64'); b[0] = { ...b[0], data: Buffer.from('zip-arm6X') }; return throws(() => M.check(yml('arm64'), V, 'arm64', b), /sha512/); }],
    ['버전 섞임 확인', "if(get(y.top, 'version') !== version) throw new Error(`버전이 섞였다", "if(false) throw new Error(`버전이 섞였다",
      (M) => throws(() => M.merge([yml('arm64'), yml('x64', { version: '0.14.1' })]), /버전이 섞였다/)],
    ['양쪽 zip 확인', "if(!urls.some(u => u.includes(`-${arch}.`) && /\\.zip$/.test(u))) throw", "if(false) throw",
      (M) => throws(() => M.merge([yml('arm64'), yml('x64', { files: [dist('x64')[1]] })]), /x64 zip 이 없다/)],
  ];
  for (const [name, from, to, guard] of cases){
    if (!SRC.includes(from)){ ok(false, `${name}: 바꿀 줄을 원본에서 못 찾음`); continue; }
    ok(guard(Y) && !guard(loadFrom(SRC.replace(from, to))), `${name} 을 지우면 막던 것이 통과한다(검사가 그 줄에 걸려 있다)`);
  }
}

console.log('\n[5] package.json 맥 빌드 설정');
{
  const mac = (PKG.build && PKG.build.mac) || {};
  const targets = mac.target || [];
  ok(['dmg', 'zip'].every(t => targets.includes(t)), `mac.target 에 dmg · zip: ${JSON.stringify(targets)}`);
  ok(targets.every(t => typeof t === 'string'), 'target 에 arch 를 박지 않는다(박으면 --arm64 잡도 두 arch 를 다 만들어 yml 이 섞인다)');
  // electron-builder 24 는 build.files 를 묶음으로 바꾸고 mac.files 의 문자열은 따로 묶는다 — 묶음이 둘이 되면
  // 앞 묶음이 «**/*» 로 앱 폴더 전부를 담고 뒤 묶음이 같은 파일을 또 담는다. 그래서 CI(하드 링크)에서 asarUnpack 파일이
  // 두 번 link 되어 EEXIST 로 멈췄다(v0.14.0-beta.0). 플랫폼별 files 는 쓰지 않는다.
  ok(!['mac', 'win', 'linux'].some(k => PKG.build && PKG.build[k] && PKG.build[k].files != null),
    'mac · win · linux 에 files 가 없다(있으면 파일 묶음이 둘이 되어 같은 파일을 두 번 복사한다)');
  const files = (PKG.build && PKG.build.files) || [];
  const prebuild = files.find(f => typeof f === 'string' && f.startsWith('!node_modules/uiohook-napi/prebuilds/'));
  // ${os} 는 빌드 대상(mac · win)이다 — ${platform} 은 빌드하는 PC 라 맥에서 만든 윈도우 빌드가 darwin 만 남긴다.
  // path.matchesGlob 은 electron-builder 와 같은 minimatch 문법(extglob 포함)이다 — `!` 를 뗀 패턴에 맞으면 빠진다.
  const kept = (os) => {
    if (!prebuild) return [];
    const glob = prebuild.slice(1).replace(/\$\{os\}/g, os).replace(/\$\{\/\*\}/g, '{,/**/*}');
    return ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64', 'win32-arm64']
      .filter(d => !path.matchesGlob(`node_modules/uiohook-napi/prebuilds/${d}/uiohook-napi.node`, glob));
  };
  ok(JSON.stringify(kept('mac')) === '["darwin-arm64","darwin-x64"]',
    `맥 빌드는 uiohook-napi 의 darwin 프리빌드만 남긴다(서명 · 공증 대상에 남의 OS 바이너리가 끼지 않게): ${kept('mac')}`);
  ok(['win32-x64', 'win32-arm64'].every(d => kept('win').includes(d)) && !kept('win').includes('linux-x64'),
    `윈도우 빌드는 win32 프리빌드를 남긴다: ${kept('win')}`);
  ok(PKG.build && PKG.build.mac && PKG.build.mac.hardenedRuntime === true, 'hardenedRuntime 이 켜져 있다(공증 조건)');
}

console.log(fail ? `\n✗ ${fail}개 실패` : '\n✓ 전부 통과');
process.exit(fail ? 1 : 0);

#!/usr/bin/env node
/* ═══ 🍎 sim-mac-update.js — 맥은 autoUpdater 를 타지 않는다 (CHECKS.md §29) ═════
   [무엇을 지키나]
     맥판은 애플 서명·공증이 없어서 electron-updater 의 맥 갈래가 설치까지 못 간다.
     릴리즈에 `latest-mac.yml` 을 안 올리므로 `checkForUpdates()` 는 맥에서 **켤 때마다 실패**한다.
     ⇒ 맥에서는 부르지 않고, 최신 릴리즈 태그만 읽어 «받으러 가기» 안내(렌더러 `#updateReadyBanner`)로 간다.

   [이 검사가 있는 이유]
     이 갈래는 **윈도우에서 돌려 봐야 아무 일도 안 일어난다.** 맥 갈래가 통째로 사라져도
     윈도우 한 바퀴는 초록이고, 개발 기계가 윈도우라 사람 눈으로도 안 걸린다.
     그래서 「맥이면 안 부른다」를 코드를 **실제로 실행해서** 확인한다(가짜 process·가짜 DOM).

   실행: node sim-mac-update.js   (main.js · app.js 가 있는 폴더에서)
   종료 코드: 0=통과 · 1=실패 · 2=원본 없음
*/
'use strict';
const fs = require('fs');
const path = require('path');

/* ── 원본 ─────────────────────────────────────────────────────────────────── */
function load(name){
  for (const p of [path.join(process.cwd(), name), path.join(__dirname, name)]){
    try { return fs.readFileSync(p, 'utf8'); } catch (_){}
  }
  return null;
}
const MAIN = load('main.js');
const APP  = load('app.js');
if (!MAIN){ console.log(`? main.js 를 못 찾음 — main.js 가 있는 폴더에서 실행할 것`); process.exit(2); }
if (!APP){  console.log(`? app.js 를 못 찾음 — app.js 가 있는 폴더에서 실행할 것`);  process.exit(2); }

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log('  ✓ ' + m); };
const bad = (m) => { fail++; console.log('  ✗ ' + m); };
const t   = (cond, m) => cond ? ok(m) : bad(m);

/* 함수 한 개의 소스를 통째로 뽑는다 — 중괄호만 센다(대상 함수들에 중괄호가 든 문자열·주석이 없다). */
function grab(src, header){
  const i = src.indexOf(header);
  if (i < 0) return null;
  let j = src.indexOf('{', i), depth = 0;
  if (j < 0) return null;
  for (let k = j; k < src.length; k++){
    if (src[k] === '{') depth++;
    else if (src[k] === '}'){ depth--; if (!depth) return src.slice(i, k + 1); }
  }
  return null;
}
/* 주석을 지운 판 — 「본문에 이 말이 있다」를 볼 때 주석에 걸리지 않게. */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/* ═══ 1절. main.js — 플랫폼 갈래가 한 곳뿐이고, 맥이면 안 부른다 ═════════════ */
console.log('\n[1] main.js — 업데이트 확인 입구');

const fnStart = grab(MAIN, 'function startUpdateCheck(');
t(!!fnStart, 'startUpdateCheck() 가 있다 — 플랫폼 갈래를 두는 한 자리');

const mainBody = strip(MAIN);
const calls = (mainBody.match(/autoUpdater\s*\.\s*checkForUpdates\s*\(/g) || []).length;
t(calls === 1, `checkForUpdates() 호출이 한 곳뿐이다 (지금 ${calls}곳) — 늘면 갈래 밖으로 샌다`);
t(!!fnStart && /autoUpdater\s*\.\s*checkForUpdates\s*\(/.test(fnStart),
  '그 한 곳이 startUpdateCheck() 안이다');

const timer = mainBody.match(/setTimeout\(\s*\(\)\s*=>\s*\{\s*startUpdateCheck\(\)\s*;?\s*\}\s*,\s*\d+\s*\)/);
t(!!timer, '창이 뜬 뒤 부르는 자리가 startUpdateCheck() 를 쓴다 (autoUpdater 를 직접 안 부른다)');

/* ★ 말이 아니라 **실행**으로 가른다. process 를 인자로 받는 껍데기에 넣어 platform 을 갈아 끼운다. */
function runGate(platform){
  const src = [grab(MAIN, 'function checkMacUpdate('), fnStart].filter(Boolean).join('\n');
  let autoCalled = false, macCalled = false;
  const stubAuto = { checkForUpdates(){ autoCalled = true; return Promise.resolve(); } };
  const shell = new Function('autoUpdater', 'process', 'require', 'app', 'sendUpdateStatus', '__mac',
    src.replace(/function checkMacUpdate\([\s\S]*?\n\}/, 'function checkMacUpdate(){ __mac(); }')
    + '\nreturn startUpdateCheck;');
  const f = shell(stubAuto, { platform }, require, { getVersion: () => '0.9.7' }, () => {}, () => { macCalled = true; });
  f();
  return { autoCalled, macCalled };
}
let mac = null, win = null;
try { mac = runGate('darwin'); win = runGate('win32'); }
catch (e){ bad('갈래를 떼어 실행하지 못했다 — ' + e.message); }

t(!!mac && mac.autoCalled === false, '맥(darwin): checkForUpdates() 를 부르지 않는다 ★ 이 검사의 본론');
t(!!mac && mac.macCalled === true,   '맥(darwin): 대신 checkMacUpdate() 로 간다');
t(!!win && win.autoCalled === true,  '윈도우(win32): 예전 그대로 checkForUpdates() 를 부른다');
t(!!win && win.macCalled === false,  '윈도우(win32): 맥 갈래를 안 탄다');

/* ═══ 2절. main.js — 맥 안내는 브라우저로, 새 주기는 만들지 않는다 ══════════ */
console.log('\n[2] main.js — 맥 안내(릴리즈 확인)');

const fnMac = grab(MAIN, 'function checkMacUpdate(');
const macBody = fnMac ? strip(fnMac) : '';
t(!!fnMac, 'checkMacUpdate() 가 있다');
t(/sendUpdateStatus\(\s*'mac-available'/.test(macBody),
  "렌더러에 'mac-available' 로 알린다 (설치는 안 한다)");
t(!/quitAndInstall/.test(macBody), 'quitAndInstall 을 안 부른다 — 서명이 없어 설치가 안 되는 판이다');
t(!/new\s+BrowserWindow/.test(macBody), '새 창을 만들지 않는다 (기존 배너 재활용 — 규칙 3)');
t(!/setInterval/.test(macBody), '새 주기(setInterval)를 만들지 않는다 — 켤 때 한 번이면 된다');
t(/html_url/.test(macBody) && /\^https/.test(fnMac || ''),
  '릴리즈 주소를 응답의 html_url 에서 받고 https 인지 본다 (직접 조립하지 않는다)');

const fnRepo = grab(MAIN, 'function githubRepoInfo(');
t(!!fnRepo, 'githubRepoInfo() 가 있다');
t(!!fnRepo && /package\.json/.test(fnRepo) && /publish/.test(fnRepo),
  '저장소 이름을 package.json 의 build.publish 에서 읽는다');
t(!/['"]grk-cmd['"]/.test(macBody) && !!fnRepo && !/['"]grk-cmd['"]/.test(strip(fnRepo)),
  '저장소 이름을 코드에 박아 두지 않았다 — 옮기면 한쪽만 낡는다');

/* 버전 비교는 실행해서 본다. 문자열 비교면 0.10.0 에서 조용히 뒤집힌다. */
const fnVer = grab(MAIN, 'function isNewerVersion(');
if (!fnVer) bad('isNewerVersion() 이 있다');
else {
  ok('isNewerVersion() 이 있다');
  let cmp = null;
  try { cmp = new Function(fnVer + '\nreturn isNewerVersion;')(); } catch (e){ bad('isNewerVersion 실행 실패 — ' + e.message); }
  if (cmp){
    const cases = [
      ['0.9.8', '0.9.7', true,  '한 칸 위면 새 버전'],
      ['0.9.7', '0.9.7', false, '같으면 안 띄운다'],
      ['0.9.6', '0.9.7', false, '낮으면 안 띄운다'],
      ['v0.10.0', '0.9.7', true, '★ 0.10.0 > 0.9.7 (문자열 비교면 여기서 뒤집힌다)'],
      ['0.9.7', '0.10.0', false, '★ 그 반대도 맞다'],
      ['1.0.0', '0.9.9', true,  '자리 올림'],
    ];
    for (const [a, b, want, why] of cases){
      let got = null;
      try { got = cmp(a, b); } catch (_){}
      t(got === want, `${a} vs ${b} → ${want} · ${why}`);
    }
  }
}

/* ═══ 3절. app.js — 배너 한 칸을 같이 쓴다 ══════════════════════════════════ */
console.log('\n[3] app.js — 안내 배너');

const appBody = strip(APP);
t(/status\s*===\s*'mac-available'/.test(appBody), "onUpdateStatus 가 'mac-available' 을 처리한다");
t(/status\s*===\s*'mac-available'\s*\)\s*showUpdateReadyBanner\(/.test(appBody),
  '그 처리가 기존 showUpdateReadyBanner() 로 간다');
t(!/id\s*=\s*['"]macUpdate/.test(appBody) && (appBody.match(/updateReadyBanner/g) || []).length >= 2,
  '맥 전용 오버레이를 새로 만들지 않았다 (#updateReadyBanner 재활용)');

const fnBanner = grab(APP, 'function showUpdateReadyBanner(');
t(!!fnBanner && /function showUpdateReadyBanner\(\s*version\s*,\s*\w+/.test(fnBanner),
  'showUpdateReadyBanner(version, downloadUrl) — 두 번째 인자로 갈린다');

/* 가짜 DOM 으로 진짜 눌러 본다 — 문구가 아니라 **동작**이 갈리는지가 요점이다. */
function clickBanner(url){
  const made = [];
  const el = () => ({ id: '', style: {}, innerHTML: '', onclick: null, remove(){ made.gone = true; } });
  const nodes = {};
  const doc = {
    getElementById: (id) => nodes[id] || null,
    createElement: () => { const e = el(); made.push(e); return e; },
    body: { appendChild: (e) => {
      /* innerHTML 에서 버튼 id 를 주워 가짜 노드를 만든다 — 진짜 DOM 파서 대신 이만큼만 쓴다. */
      for (const m of String(e.innerHTML).matchAll(/id="([^"]+)"/g)) nodes[m[1]] = el();
      made.html = String(e.innerHTML);
    } },
  };
  let opened = null, installed = false;
  const win = { companion: { openBrowser: (u) => { opened = u; }, installUpdate: () => { installed = true; } } };
  const f = new Function('document', 'window', 'companion', fnBanner + '\nreturn showUpdateReadyBanner;')(doc, win, win.companion);
  f('0.9.8', url);
  const btn = nodes['updateReadyBtn'];
  if (btn && btn.onclick) btn.onclick();
  return { html: made.html || '', opened, installed, gone: !!made.gone };
}
if (!fnBanner) bad('배너를 떼어 실행하지 못했다 (함수를 못 뽑았다)');
else {
  let m = null, w = null;
  try { m = clickBanner('https://github.com/x/y/releases/tag/v0.9.8'); w = clickBanner(undefined); }
  catch (e){ bad('배너 실행 실패 — ' + e.message); }
  t(!!m && /받으러 가기/.test(m.html), '맥: 버튼이 «받으러 가기»');
  t(!!m && m.opened === 'https://github.com/x/y/releases/tag/v0.9.8',
    '맥: 누르면 companion.openBrowser 로 릴리즈 주소를 연다 (시스템 브라우저)');
  t(!!m && m.installed === false, '맥: installUpdate 를 부르지 않는다 ★ 서명이 없어 설치가 안 된다');
  t(!!w && /지금 재시작/.test(w.html) && w.installed === true,
    '윈도우: 예전 그대로 «지금 재시작» → installUpdate');
  t(!!w && w.opened === null, '윈도우: 브라우저를 열지 않는다');
  t(!!m && /v0\.9\.8/.test(m.html), '배너에 버전이 들어간다');
}

/* ═══ 4절. 곁 — 통로·설정이 살아 있나 ═════════════════════════════════════ */
console.log('\n[4] 통로');

t(/ipcMain\.on\(\s*'companion:openBrowser'/.test(mainBody) && /shell\.openExternal/.test(mainBody),
  'companion:openBrowser 가 shell.openExternal 로 간다 (맥 안내가 타는 통로)');
t(/companion:updateStatus/.test(mainBody), 'updateStatus 통로가 그대로다');

const pkgRaw = load('package.json');
if (!pkgRaw) console.log('  · package.json 이 없다 — publish 확인은 건너뜀');
else {
  let pkg = null;
  try { pkg = JSON.parse(pkgRaw); } catch (_){}
  const pub = pkg && pkg.build && pkg.build.publish;
  const gh = pub && (Array.isArray(pub) ? pub : [pub]).find(p => p && p.provider === 'github');
  t(!!(gh && gh.owner && gh.repo), 'package.json build.publish 에 github owner·repo 가 있다 (맥 안내가 읽는 자리)');
  const macT = pkg && pkg.build && pkg.build.mac && pkg.build.mac.target;
  const names = JSON.stringify(macT || '');
  if (/zip/.test(names)) console.log('  · 맥 target 에 zip 이 남아 있다 — 서명·공증을 하기 전까지 릴리즈에 latest-mac.yml 을 올리지 말 것');
  else console.log('  · 맥 target 에 zip 이 없다 (dmg 직접 받기 판)');
}

/* ── 판정 ─────────────────────────────────────────────────────────────────── */
console.log('');
console.log(`통과 ${pass} · 실패 ${fail}`);
if (fail) console.log(`실패 ${fail}건`);
else console.log('전부 통과 ✅');
process.exit(fail ? 1 : 0);

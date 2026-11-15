#!/usr/bin/env node
/* firebase-api-left.js — `window.firebaseAPI` 에 남은 이름 · 그 이름을 부르는 파일 · 맡은 묶음을 뽑는다.
 *
 *   node scripts/firebase-api-left.js <ref> [--dead] [--json]
 *     <ref>   git 참조(예: origin/release/0.13.0 · HEAD). 줄이면 작업 폴더를 읽는다(`--`).
 *     --dead  부르는 곳이 0 인 이름만 낸다(E-0 이 걷을 후보)
 *     --json  표 대신 JSON
 *
 * ⚠️ 글자 일치로 센 근사다 — 코드를 풀어 읽지 않는다.
 *   센 꼴(앱 · checks · html · 관리자 창 · 도움말 전부, firebase-init.js 밖의 글):
 *     강: `firebaseAPI.이름` · `firebaseAPI?.이름` · `firebaseAPI['이름']`
 *     약: 별칭 · deps 로 넘겨 부르는 것 — `.이름` (어떤 받는이든) · `'이름'` 문자열 ·
 *         `{ 이름 }` / `{ 이름: ... }` 구조분해 · deps 키 `이름:` · 이름 뒤에 `(`
 *   checks/ 의 글은 따로 모은다(시험이 이름을 쓰는 것은 부르는 곳이 아니다). «죽음» = 앱 쪽 강 0 · 약 0 · 안쪽 0(검사만 쓰면 «죽음(앱 0 · 검사만)»). 약만 있으면 «별칭 후보»(사람이 본다). 약은 일반 단어(예: `.get`)와 겹치면
 *   죽은 이름도 산 것으로 보이는 쪽으로 틀린다 — 걷기 전에 grep 으로 한 번 더 확인한다.
 *   주석은 지우고 센다(주석에만 나오는 이름은 0).
 *   firebase-init.js 안에서 다른 메서드가 `api.이름` 처럼 부르는 것은 «안쪽» 으로 따로 센다.
 *
 * 맡은 묶음은 이름 앞머리로 짐작한 것이다(BUNDLES). 정확한 표는 설계 d13-e-finish.md 2 · 13절.
 * node 만 쓴다.
 */
'use strict';
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INIT = 'apps/desktop/app/parts/firebase-init.js';
const SCAN_DIRS = ['apps', 'firebase', 'checks', 'packages', 'scripts'];
const EXT = /\.(js|mjs|cjs|html|py|ts|tsx|json)$/;
const SKIP = /(^|\/)(node_modules|vendor|dist|\.git)\/|package-lock\.json$|-baseline\.json$|CHECKS\.md$/;

/* 이름 앞머리 → 묶음 짐작. 위에서부터 처음 맞는 것. */
const BUNDLES = [
  [/^(auth|getIdToken|apiGetAuthed|serverNow)/, '남김(Auth)'],
  [/^(upload|deleteStorage)/, '남김(Storage 올리기)'],
  [/Friend|friend|Playlist|UserNameById/, 'D2/D3 친구'],
  [/^(createMyPresence|setMyProfile|setAway|getAway)/, 'D3 접속'],
  [/Room|room|Ghost/, 'C 방'],
  [/Invite|invite/, 'D7/D11 초대'],
  [/License|license/, 'D8 라이선스'],
  [/Bug|bug|Report/, 'D9 제보'],
  [/Desk|Item|Part|Cat|catalog|Catalog|GameConfig|Order/, 'D1/D11 카탈로그'],
  [/^adv/, 'E-3 모험 빈 껍데기'],
  [/Leaderboard|Rank/, 'D5 집중'],
  [/Admin|Stats|UserCount/, 'D11 관리자'],
  [/Inbox|Gift|Mail/, 'D7 선물'],
];
const bundleOf = (n) => { for (const [re, b] of BUNDLES) if (re.test(n)) return b; return '?'; };

function sh(args, opts) { return cp.execFileSync(args[0], args.slice(1), Object.assign({ cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }, opts || {})); }

/* ref 에서 파일 목록 + 내용 */
function loadFiles(ref) {
  const files = new Map();
  if (ref === '--') {
    const walk = (d) => {
      for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
        const rel = d + '/' + e.name;
        if (SKIP.test(rel + (e.isDirectory() ? '/' : ''))) continue;
        if (e.isDirectory()) walk(rel);
        else if (EXT.test(rel)) files.set(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'));
      }
    };
    SCAN_DIRS.forEach((d) => { if (fs.existsSync(path.join(ROOT, d))) walk(d); });
    return files;
  }
  const list = sh(['git', 'ls-tree', '-r', '--name-only', ref, '--', ...SCAN_DIRS]).split('\n').filter(Boolean);
  for (const f of list) {
    if (SKIP.test(f) || !EXT.test(f)) continue;
    try { files.set(f, sh(['git', 'show', ref + ':' + f])); } catch (_) { /* 심볼릭 링크 등 */ }
  }
  return files;
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/<!--[\s\S]*?-->/g, ' ');

/* window.firebaseAPI = { ... } 의 맨 위 칸 이름 — 들여쓰기 4칸으로 시작하는 `이름(` · `async 이름(` · `이름:` 줄 */
function apiNames(src) {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => /^\s*window\.firebaseAPI\s*=\s*\{/.test(l));
  if (start < 0) throw new Error('window.firebaseAPI = { 를 못 찾음');
  const indent = lines[start].match(/^\s*/)[0].length;
  const names = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (new RegExp('^\\s{' + indent + '}\\};?\\s*$').test(l)) break;
    const m = l.match(new RegExp('^\\s{' + (indent + 2) + '}(?:async\\s+)?([A-Za-z_$][\\w$]*)\\s*(?:\\(|:)'));
    if (m && !names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

function main() {
  const argv = process.argv.slice(2);
  const ref = argv.find((a) => !a.startsWith('--')) || '--';
  const onlyDead = argv.includes('--dead');
  const asJson = argv.includes('--json');
  const files = loadFiles(ref === '--' ? '--' : ref);
  const init = files.get(INIT);
  if (!init) throw new Error(INIT + ' 없음');
  const names = apiNames(init);

  const clean = new Map();
  for (const [f, s] of files) clean.set(f, f.endsWith('.json') ? s : stripComments(s));

  const rows = names.map((n) => {
    const esc = n.replace(/\$/g, '\\$');
    const strong = new RegExp('firebaseAPI\\s*(?:\\?\\.|\\.)\\s*' + esc + '\\b|firebaseAPI\\s*\\??\\.?\\[\\s*[\'"`]' + esc + '[\'"`]\\s*\\]');
    const weak = new RegExp('\\.\\s*' + esc + '\\b|[\'"`]' + esc + '[\'"`]|[{,]\\s*' + esc + '\\s*[,}:=]|\\b' + esc + '\\s*:\\s|\\b' + esc + '\\s*\\(');
    const sFiles = [], wFiles = [], cFiles = []; let inner = 0;
    for (const [f, s] of clean) {
      if (f === INIT) {
        /* 자기 안: 정의 줄 `이름(`/`이름:` 은 빼고, `api.이름` · `this.이름` · `firebaseAPI.이름` 만 안쪽으로 */
        const m = s.match(new RegExp('(?:firebaseAPI|api|this|self)\\s*\\.\\s*' + esc + '\\b', 'g'));
        inner += m ? m.length : 0;
        continue;
      }
      const isCheck = f.startsWith('checks/');
      if (strong.test(s)) (isCheck ? cFiles : sFiles).push(f);
      else if (weak.test(s)) (isCheck ? cFiles : wFiles).push(f);
    }
    return { name: n, bundle: bundleOf(n), strong: sFiles, weak: wFiles, inner, checks: cFiles, dead: !sFiles.length && !wFiles.length && !inner };
  });

  const out = onlyDead ? rows.filter((r) => r.dead) : rows;
  if (asJson) { console.log(JSON.stringify(out, null, 2)); return; }

  const group = (a) => { const m = new Map(); a.forEach((f) => { const k = f.split('/').slice(0, 5).join('/'); m.set(k, (m.get(k) || 0) + 1); }); return [...m].map(([k, c]) => k + (c > 1 ? '×' + c : '')).join(', '); };
  console.log('# firebaseAPI 남은 이름 — ref=' + (ref === '--' ? '작업 폴더' : ref) + ' (글자 일치로 센 근사)');
  console.log('이름 ' + rows.length + '개 · 죽음 ' + rows.filter((r) => r.dead).length + '개(그중 검사가 쓰는 것 ' + rows.filter((r) => r.dead && r.checks.length).length + ')' + '개 · 강 호출 있음 ' + rows.filter((r) => r.strong.length).length + '개 · 별칭 후보(약만) ' + rows.filter((r) => !r.strong.length && (r.weak.length || r.inner)).length + '개\n');
  console.log('이름 | 묶음(짐작) | 상태 | 부르는 파일');
  for (const r of out) {
    const st = r.dead ? (r.checks.length ? '죽음(앱 0 · 검사만)' : '죽음') : r.strong.length ? '강' : '약(별칭 후보)';
    const who = r.strong.length ? group(r.strong) : (group(r.weak) + (r.inner ? (r.weak.length ? ', ' : '') + 'firebase-init 안쪽×' + r.inner : ''));
    console.log([r.name, r.bundle, st, who || (r.checks.length ? 'checks: ' + r.checks.map((f) => f.replace('checks/', '')).join(', ') : '-')].join(' | '));
  }
}
main();

#!/usr/bin/env node
/* 현황판(docs/WORK_STATUS.md) «진행 중» 표에서 머지된 PR 의 줄을 «작업완료(판) · #PR · 날짜» 로 바꾼다.
   머지 길이 여럿(/ship · GitHub 버튼 · 웹 세션)이라 사람이 손으로 바꾸면 빠진다 — 워크플로 work-status-done.yml 이 부른다.
   실행: node scripts/work-status-done.js --head <브랜치> --base <base 브랜치> --pr <번호> [--date YYYY-MM-DD] [--file 경로]
   검사: checks/sim-work-status-done.js */
'use strict';

const SECTION = '## 진행 중';
const COL = { status: '상태', branch: '브랜치', pr: 'PR' };

/* 판 이름 — release/X.Y.Z 는 X.Y.Z, 그 밖(main · hotfix 등)은 브랜치 이름 그대로 */
function boardOf(base){
  const m = /^release\/(.+)$/.exec(base || '');
  return m ? m[1] : base;
}

/* 날짜는 사람들이 보는 한국 시각으로(Actions 는 UTC 로 돈다) */
function kstDate(now){
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/* 앞뒤 `|` 가 있는 표 줄만 칸으로 — 없으면 null */
function cellsOf(line){
  const t = line.trim();
  if(!t.startsWith('|') || !t.endsWith('|') || t.length < 2) return null;
  return t.slice(1, -1).split('|').map(s => s.trim());
}

const bare = (s) => s.replace(/^`(.*)`$/, '$1').trim();

/* 글 → { text, hits, reason }. 맞는 줄만 고치고 나머지 글은 한 글자도 안 바꾼다. */
function markDone(text, { head, base, pr, date }){
  if(!head || !base || !pr || !date) return { text, hits: 0, reason: '입력 빠짐' };
  const lines = text.split('\n');
  const at = lines.findIndex(l => l.trim().startsWith(SECTION));
  if(at < 0) return { text, hits: 0, reason: '«진행 중» 절 없음' };

  // 절 안 첫 표 — 다음 «## » 절이 나오기 전까지만 찾는다
  let h = -1;
  for(let i = at + 1; i < lines.length && !/^##\s/.test(lines[i]); i++){
    if(cellsOf(lines[i])){ h = i; break; }
  }
  if(h < 0) return { text, hits: 0, reason: '«진행 중» 표 없음' };
  const head0 = cellsOf(lines[h]);
  const ix = { status: head0.indexOf(COL.status), branch: head0.indexOf(COL.branch), pr: head0.indexOf(COL.pr) };
  if(ix.status < 0 || ix.branch < 0 || ix.pr < 0) return { text, hits: 0, reason: '표 머리에 상태 · 브랜치 · PR 칸 없음' };

  let hits = 0;
  for(let i = h + 2; i < lines.length; i++){
    const c = cellsOf(lines[i]);
    if(!c) break;
    if(c.length !== head0.length) continue;   // 칸 안에 `|` 가 섞였으면 어느 칸이 무엇인지 모른다 — 건드리지 않는다
    if(bare(c[ix.branch]) !== head) continue;
    c[ix.status] = `작업완료(${boardOf(base)})`;
    c[ix.pr] = `#${pr} · ${date}`;
    lines[i] = '| ' + c.join(' | ') + ' |';
    hits++;
  }
  return { text: hits ? lines.join('\n') : text, hits, reason: hits ? '' : `브랜치 칸이 «${head}» 인 줄 없음` };
}

function cli(argv){
  const fs = require('fs');
  const opt = {};
  for(let i = 0; i < argv.length; i++){
    const m = /^--(head|base|pr|date|file)$/.exec(argv[i]);
    if(m) opt[m[1]] = argv[++i];
  }
  const file = opt.file || 'docs/WORK_STATUS.md';
  const date = opt.date || kstDate(new Date());
  if(!/^\d+$/.test(opt.pr || '')){ console.error('--pr 는 숫자'); return 2; }
  const before = fs.readFileSync(file, 'utf8');
  const r = markDone(before, { head: opt.head, base: opt.base, pr: opt.pr, date });
  if(!r.hits){ console.log(`바꿀 줄 없음 — ${r.reason}`); return 0; }
  fs.writeFileSync(file, r.text);
  console.log(`${r.hits}줄 바꿈 — ${opt.head} → 작업완료(${boardOf(opt.base)}) · #${opt.pr} · ${date}`);
  return 0;
}

module.exports = { markDone, boardOf, kstDate };
if(require.main === module) process.exit(cli(process.argv.slice(2)));

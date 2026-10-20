#!/usr/bin/env node
/* 📝 릴리스 메모 — 정식 릴리스의 GitHub Releases 본문을 사람이 쓴 공지 글(docs/release-notes/<버전>.md)로.
   PR 제목 목록(GitHub 가 만든 것)은 그 아래 «자세한 변경» 접기 안에 둔다.
   정식인데 공지 글이 없으면 멈춘다 — release-start(태그 올리기 전) · release.yml(빌드 전)이 check 를 부른다. 베타는 보지 않는다.
   실행: node scripts/release-notes.js check <버전>
         node scripts/release-notes.js compose <버전> <PR 목록 파일>   → 본문을 표준 출력으로 */
'use strict';
const fs = require('fs');
const path = require('path');

const NOTES_DIR = path.join('docs', 'release-notes');
const VERSION_RE = /^\d+\.\d+\.\d+$/;   // 정식 번호만 — 베타(-beta.N)는 공지 글을 받지 않는다
const DETAILS_SUMMARY = '자세한 변경(PR 목록)';

function notesPath(version){
  if(!VERSION_RE.test(String(version || ''))) throw new Error(`정식 버전 번호가 아니다: ${version}`);
  return path.join(NOTES_DIR, `${version}.md`);
}

/* 공지 글 — 없거나 비었으면 null(«없음» 과 «빈 파일» 을 같은 실패로 본다: 빈 공지로 공개하지 않게) */
function readNotes(version, readFile){
  let text;
  try{ text = readFile(notesPath(version)); }catch(e){ if(e.code === 'ENOENT') return null; throw e; }
  return String(text).trim() ? String(text).trim() : null;
}

function compose(notes, generated){
  const list = String(generated || '').trim();
  if(!list) return notes + '\n';
  return `${notes}\n\n<details>\n<summary>${DETAILS_SUMMARY}</summary>\n\n${list}\n\n</details>\n`;
}

module.exports = { NOTES_DIR, notesPath, readNotes, compose };

if(require.main === module){
  const [cmd, version, genFile] = process.argv.slice(2);
  const readFile = (f) => fs.readFileSync(f, 'utf8');
  try{
    const notes = readNotes(version, readFile);
    if(!notes){
      console.error(`::error::정식 ${version} 의 공지 글이 없다 — ${notesPath(version)} 를 판 브랜치에 먼저 넣는다(docs/RELEASE.md)`);
      process.exit(1);
    }
    if(cmd === 'check'){ console.log(`공지 글 있음 — ${notesPath(version)}`); process.exit(0); }
    if(cmd === 'compose'){ process.stdout.write(compose(notes, genFile ? readFile(genFile) : '')); process.exit(0); }
    console.error('쓰는 법: check <버전> | compose <버전> <PR 목록 파일>'); process.exit(2);
  }catch(e){ console.error(`::error::${e.message}`); process.exit(1); }
}

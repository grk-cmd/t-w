#!/usr/bin/env node
/* ═══ 🔒 scripts/storage-owners.js — Storage 주인 문서 확인 · 채우기(규칙을 올리기 전 한 번) ═══
   Storage 규칙(firebase/storage.rules)은 사람 폴더의 주인을 Firestore storageOwners/{코드} 로 본다. 서버가 가입 · 탈퇴 때 쓰고,
   그 전부터 있던 계정은 관리자 채우기(POST /v2/admin/storage-owners/backfill)로 한 번 만든다(tw-docs design/12-storage-owner.md 6장).

   node scripts/storage-owners.js check                 DB 계정 수 · 문서 수 · 빠진 수(missing) · DB 에 없는 문서(orphans) · ready
   node scripts/storage-owners.js backfill "<메모>"      모든 계정을 문서로 쓴다(몇 번 돌려도 같다 · 감사 기록) → 같은 결과를 찍는다
   어느 명령이든 --dev 를 붙이면 dev API.

   로그인은 scripts/todo.js 와 같은 파일(~/.config/tw-todo/auth-<prod|dev>.json)을 쓴다 — 없으면 node scripts/todo.js setup 을 먼저.
   ready 가 true(missing 0 · 계정 수 = 문서 수)일 때만 규칙을 올린다. 앱에 실리지 않는 관리용 도구. */
'use strict';
const T = require('./todo.js');

const PATH = '/v2/admin/storage-owners';
const TIMEOUT_MS = 120e3;   // 채우기는 계정 수만큼 Firestore 에 쓴다 — 몇천 명이면 수십 초

/** 결과 한 벌 → 사람이 읽는 줄. ready 가 아니면 왜 아닌지 같이. */
function report(r){
  const lines = [`계정 ${r.users} · 문서 ${r.documents} · 이번에 쓴 것 ${r.written} · 빠진 계정 ${r.missing} · DB 에 없는 문서 ${r.orphans}`];
  if(r.ready) lines.push('✓ ready — 규칙을 올려도 돼요(firebase deploy --only firestore:rules,storage)');
  else lines.push('✗ 아직 안 돼요 — ' + (r.missing ? `빠진 계정 ${r.missing} 명(backfill 을 다시)` : `계정 수와 문서 수가 달라요(${r.users} ≠ ${r.documents})`));
  if(r.orphans) lines.push(`  (DB 에 없는 문서 ${r.orphans} 개 — 가입 도중 끊긴 코드 · 막 지운 계정. 규칙에는 영향이 없어요)`);
  return lines.join('\n');
}

async function main(argv){
  const env = argv.includes('--dev') ? 'dev' : 'prod';
  const args = argv.filter((a) => a !== '--dev');
  try {
    const { api } = T.session(env, TIMEOUT_MS);   // scripts/todo.js 와 같은 로그인 · 토큰 새로 받기 · 응답 풀기
    if(args[0] === 'check') console.log(report(await api.get(PATH)));
    else if(args[0] === 'backfill'){
      const memo = String(args[1] || '').trim();
      if(!memo) throw new T.TodoError('메모를 적어 주세요 — node scripts/storage-owners.js backfill "규칙 올리기 전"');
      console.log(report(await api.post(PATH + '/backfill', { memo })));
    } else throw new T.TodoError('명령은 check · backfill "<메모>" 둘이에요');
  } catch(e){
    console.error('✗ ' + (e instanceof T.TodoError ? e.message : (e && e.stack) || e));
    process.exitCode = 1;
  }
}

if(require.main === module) main(process.argv.slice(2));
module.exports = { report, main };

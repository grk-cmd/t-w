#!/usr/bin/env node
/* ═══ 🐞 scripts/backfill-bug-no.js — 버그 제보 고정 번호(B-MMDD-n)를 이미 있는 글에 한 번 붙이기 ═══
   함수 bugNo(functions/bug-no.js)는 글이 **새로 생길 때** 번호를 붙인다. 그 전에 올라온 글은 이 도구로 붙인다.
   no 가 없는 글만, 날짜(서울)별로 ts 순(같으면 키 순)으로, 그날 카운터(bugBoard/seq/{날짜}) 다음 번호부터 준다.
   이미 번호가 있는 글 · 카운터는 건드리지 않고 이어 간다. 앱에 실리지 않는 관리용 도구다.

   실행(저장소 루트 · firebase login 필요 · 규칙을 거치지 않는 관리자 권한):
     node scripts/backfill-bug-no.js --project together-working-dev            ← 미리 보기(읽기만 · 붙일 번호 목록 출력)
     node scripts/backfill-bug-no.js --project together-working-dev --write    ← 번호 · 카운터를 한 번의 update 로 쓰기
   --project 는 꼭 적는다(기본 프로젝트가 운영이라 빠뜨리면 운영을 읽는다). --instance <이름>
   firebase CLI 는 FIREBASE_BIN 으로 바꿀 수 있다(기본 'npx --yes firebase-tools@15.32.1').

   읽는 것: bugBoard/list 통째 1번(글 한 줄은 제목 · 이름 정도라 작다 — 시작할 때 글 수 · 바이트를 찍는다) + bugBoard/seq 1번(날짜당 숫자 하나).
   함수와 겹칠 때: 함수를 먼저 배포한다. 쓰기 직전에 seq 를 다시 읽어 그사이 바뀐 날이 있으면 쓰지 않고 멈춘다(다시 돌리면 된다).
   두 번 돌려도 같다(번호가 있는 글은 건너뛴다). */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');
const { BUG_LIST, BUG_SEQ, planBackfill } = require('../functions/bug-no');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const WRITE = args.includes('--write');
const PROJECT = opt('--project');
const INSTANCE = opt('--instance');
const FIREBASE = process.env.FIREBASE_BIN || 'npx --yes firebase-tools@15.32.1';

if (!PROJECT){
  console.error('✗ --project 를 적어 주세요 (예: --project together-working-dev). 기본 프로젝트는 운영이라 빠뜨리면 안 돼요.');
  process.exit(2);
}

function fb(sub){
  const extra = ['--project', PROJECT].concat(INSTANCE ? ['--instance', INSTANCE] : []);
  const cmd = [FIREBASE].concat(sub, extra).map(a => /\s/.test(a) && a !== FIREBASE ? '"' + a + '"' : a).join(' ');
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, { shell: true, env: Object.assign({}, process.env, { NODE_NO_WARNINGS: '1' }) });
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(cmd + '\n' + (err || out).slice(0, 500))));
  });
}

async function getJson(p){
  const raw = (await fb(['database:get', p])).trim();
  return { val: raw ? JSON.parse(raw) : null, bytes: Buffer.byteLength(raw) };
}

const kb = (n) => (n / 1024).toFixed(1) + ' KB';

(async () => {
  console.log(`프로젝트 ${PROJECT}${INSTANCE ? ' · ' + INSTANCE : ''} · ${WRITE ? '쓰기(--write)' : '미리 보기(읽기만)'}`);
  const list = await getJson('/' + BUG_LIST);
  const seq = await getJson('/' + BUG_SEQ);
  const posts = Object.keys(list.val || {}).length;
  console.log(`읽음: 글 ${posts}개 (${kb(list.bytes)}) · 카운터 ${Object.keys(seq.val || {}).length}일`);
  const { updates, assigned, skipped } = planBackfill(list.val, seq.val);
  for (const a of assigned) console.log(`  ${a.no}  ← ${a.id}`);
  if (skipped.length) console.log(`  건너뜀(ts 없음 · 키 모양 이상) ${skipped.length}개: ${skipped.slice(0, 10).join(', ')}`);
  console.log(`번호 붙일 글 ${assigned.length}개 · 이미 번호 있는 글 ${posts - assigned.length - skipped.length}개`);
  if (!assigned.length){ console.log('붙일 글이 없어요.'); return; }
  if (!WRITE){ console.log('미리 보기만 했어요 — 쓰려면 --write 를 붙여 다시 실행하세요.'); return; }

  // 그사이 함수가 새 글에 번호를 줬으면 카운터가 움직였다 — 덮어쓰면 번호가 겹치니 멈춘다.
  const again = await getJson('/' + BUG_SEQ);
  const days = [...new Set(assigned.map(a => a.day))];
  const moved = days.filter(d => ((again.val || {})[d] || 0) !== ((seq.val || {})[d] || 0));
  if (moved.length){
    console.error(`✗ 읽는 사이 카운터가 바뀐 날이 있어 쓰지 않았어요(${moved.join(', ')}) — 다시 돌려 주세요.`);
    process.exit(1);
  }
  const tmp = path.join(os.tmpdir(), 'tw-backfill-bug-no.json');
  fs.writeFileSync(tmp, JSON.stringify(updates));
  try { await fb(['database:update', '/', tmp, '--force']); }
  finally { try { fs.unlinkSync(tmp); } catch (_){} }
  console.log(`✅ ${assigned.length}개 글에 번호를 붙였어요. 미리 보기로 한 번 더 돌려 «붙일 글이 없어요» 인지 확인하세요.`);
})().catch(e => { console.error('✗ ' + (e && e.message || e)); process.exit(1); });

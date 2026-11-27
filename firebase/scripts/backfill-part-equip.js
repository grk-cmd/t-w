#!/usr/bin/env node
/* ═══ 🧮 scripts/backfill-part-equip.js — 카탈로그 항목별 «장착 사용자 수» 처음부터 다시 세기 ═══
   함수 partEquipCount(functions/part-equip.js)는 슬롯이 **바뀔 때** 차이만 센다. 그 전에 이미 장착해 둔 사람은
   이 도구로 한 번 세어 metrics/parts/equipped 를 통째로 덮어쓴다. 앱에 실리지 않는 관리용 도구다.

   실행(저장소 루트 · firebase login 필요 · 규칙을 거치지 않는 관리자 권한):
     node scripts/backfill-part-equip.js --project together-working-dev            ← 미리 보기(읽기만 · 숫자와 지금 값과의 차이 출력)
     node scripts/backfill-part-equip.js --project together-working-dev --write    ← 계산한 값으로 덮어쓰기
   --project 는 꼭 적는다(기본 프로젝트가 운영이라 빠뜨리면 운영을 읽는다). --instance <이름> · --concurrency <n>(기본 16)
   firebase CLI 는 FIREBASE_BIN 으로 바꿀 수 있다(기본 'npx --yes firebase-tools@15.32.1') — 목록 · 쓰기 몇 번에만 쓴다.
   사람마다의 slots 는 CLI 를 사람 수만큼 띄우지 않고(느리고 CPU 를 먹는다) 이 프로그램 안에서 REST 로 읽는다.
   토큰은 `gcloud auth print-access-token`(그 계정이 프로젝트 권한을 가져야 한다) · 실패한 사람은 3번까지 다시 읽는다.

   읽는 것: users 키 목록(shallow · 값 없음) 1번 + 사람마다 users/{코드}/slots 1번 + metrics/parts/equipped 1번(작다).
     users 를 통째로 읽지 않는다(모든 사람의 모든 데이터). slots 는 사람당 최대 5칸 × 칸당 15만 자 — 시작할 때 사람 수와
     처음 몇 명으로 잰 평균 크기로 전체 양을 어림해 찍는다.
   함수와 겹칠 때: 사람마다 읽은 시점과 덮어쓰는 시점 사이에 슬롯을 바꾼 사람은 함수가 더한 ±1 이 덮어쓰기로 사라질 수 있다.
     그래서 함수를 먼저 배포하고 → --write → 한 번 더 미리 보기로 «다름 0» 인지 본다(다르면 사용 적은 시간에 --write 한 번 더).
     두 번 돌려도 같다(통째로 다시 센 값을 쓴다). */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn, execFileSync } = require('child_process');
const { KINDS, METRICS_EQUIPPED, equipTotals } = require('../functions/part-equip');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const WRITE = args.includes('--write');
const PROJECT = opt('--project');
const INSTANCE = opt('--instance');
const CONCURRENCY = Math.max(1, Math.min(32, Number(opt('--concurrency')) || 16));
// 두 프로젝트 모두 RTDB 가 asia-southeast1 이다(functions · 앱 설정과 같다).
const DB_URL = `https://${INSTANCE || PROJECT + '-default-rtdb'}.asia-southeast1.firebasedatabase.app`;
const TOKEN_MS = 30 * 60 * 1000;
const RETRY = 3;
const FIREBASE = process.env.FIREBASE_BIN || 'npx --yes firebase-tools@15.32.1';
const USER_RE = /^[A-Za-z0-9_-]{1,128}$/;
const SAMPLE = 20;

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

const getJson = async (p, shallow) => {
  const raw = await fb(['database:get', p].concat(shallow ? ['--shallow'] : []));
  const t = raw.trim();
  return t ? JSON.parse(t) : null;
};

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const mb = (n) => n < 1024 * 1024 ? kb(n) : (n / 1024 / 1024).toFixed(2) + ' MB';

let _tok = null, _tokAt = 0;
function token(){
  if (!_tok || Date.now() - _tokAt > TOKEN_MS){
    _tok = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
    _tokAt = Date.now();
  }
  return _tok;
}

async function readSlots(id){
  let last = null;
  for (let i = 0; i < RETRY; i++){
    try{
      const res = await fetch(`${DB_URL}/users/${id}/slots.json`, { headers: { Authorization: 'Bearer ' + token() } });
      if (res.status === 401) _tok = null;   // 토큰이 만료 · 무효 — 다음 시도에서 새로 받는다
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    }catch(e){ last = e; await new Promise(r => setTimeout(r, 500 * (i + 1))); }
  }
  throw last;
}

async function readAll(ids, onStart){
  const list = new Array(ids.length);
  let bytes = 0, done = 0, failed = 0, next = 0;
  async function worker(){
    while (next < ids.length){
      const i = next++;
      try{
        const raw = await readSlots(ids[i]);
        bytes += Buffer.byteLength(raw);
        const t = raw.trim();
        list[i] = t && t !== 'null' ? JSON.parse(t) : null;
      }catch(e){ failed++; list[i] = null; console.warn('  ! 읽기 실패', ids[i], String(e && e.message || e)); }
      done++;
      if (done === Math.min(SAMPLE, ids.length)) onStart(bytes / done);
      if (done % 500 === 0) console.log(`  ${done}/${ids.length} 읽음 · ${mb(bytes)}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
  return { list, bytes, failed };
}

function diffCount(cur, totals){
  let changed = 0;
  for (const kind of KINDS){
    const a = (cur && cur[kind]) || {}, b = totals[kind];
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) if ((Number(a[id]) || 0) !== (b[id] || 0)) changed++;
  }
  return changed;
}

(async () => {
  console.log(`프로젝트 ${PROJECT}${INSTANCE ? ' · ' + INSTANCE : ''} · ${WRITE ? '덮어쓰기(--write)' : '미리 보기(읽기만)'}`);
  const users = await getJson('/users', true);
  const ids = Object.keys(users || {}).filter(u => USER_RE.test(u));
  console.log(`사용자 ${ids.length}명 — 사람마다 slots 하나씩 읽는다 (최대 5칸 × 칸당 15만 자 = 사람당 최대 약 ${kb(5 * 150000)})`);
  const { list, bytes, failed } = await readAll(ids, (avg) => {
    console.log(`  처음 ${Math.min(SAMPLE, ids.length)}명 평균 ${kb(avg)} → 전체 어림 ${mb(avg * ids.length)}`);
  });
  const totals = equipTotals(list.filter(Boolean));
  const withSlots = list.filter(Boolean).length;
  console.log(`읽음: slots 있는 사람 ${withSlots}명 · 실패 ${failed} · 내려받은 양 ${mb(bytes)}`);
  for (const kind of KINDS){
    const top = Object.entries(totals[kind]).sort((a, b) => b[1] - a[1]);
    console.log(`  ${kind}: 항목 ${top.length}개 · 많이 쓰는 순 ${top.slice(0, 10).map(([id, n]) => id + ' ' + n).join(', ') || '없음'}`);
  }
  const cur = await getJson('/' + METRICS_EQUIPPED, false);
  console.log(`지금 ${METRICS_EQUIPPED} 와 다른 칸: ${diffCount(cur, totals)}개`);
  if (failed){
    console.error('✗ 읽기에 실패한 사람이 있어 쓰지 않아요 — 다시 돌려 주세요.');
    process.exit(1);
  }
  if (!WRITE){ console.log('미리 보기만 했어요 — 쓰려면 --write 를 붙여 다시 실행하세요.'); return; }
  const tmp = path.join(os.tmpdir(), 'tw-backfill-part-equip.json');
  fs.writeFileSync(tmp, JSON.stringify(totals));
  try { await fb(['database:set', '/' + METRICS_EQUIPPED, tmp, '--force']); }
  finally { try { fs.unlinkSync(tmp); } catch (_){} }
  console.log(`✅ ${METRICS_EQUIPPED} 를 덮어썼어요. 잠시 뒤 미리 보기로 한 번 더 돌려 «다른 칸: 0개» 인지 확인하세요.`);
})().catch(e => { console.error('✗ ' + (e && e.message || e)); process.exit(1); });

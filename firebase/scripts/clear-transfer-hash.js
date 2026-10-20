#!/usr/bin/env node
/* ═══ 🧹 scripts/clear-transfer-hash.js — 옛 계정 이전 비밀번호(users/{uid}/transferHash) 한 번에 지우기 ═══
   [회원가입 설계 개정 16 · 핸드오프 09-22 결정 12 · CHECKS 개정 45] 한 번만 돌리는 정리 도구다(앱에 안 실린다).
   왜: transferHash 는 공개 읽기 · 소금 없는 SHA-256 한 번 · 최소 4자 — 남겨 두면 푼 사람이 옛 비밀번호를 얻는다.
   ⚠️ transferData 는 **건드리지 않는다** — 계정 스냅샷 자리(로그인 복원이 라이선스·이름·친구 코드·누적 시간을 받는다).

   순서:
     ① 콘솔에 새 규칙(firebase-database-rules.json · transferHash 는 지우기만)을 먼저 게시 — 옛 앱이 다시 쓰지 못하게.
     ② 저장소 루트에서:  node scripts/clear-transfer-hash.js            ← 미리 보기(몇 명인지만 · 쓰기 없음)
                         node scripts/clear-transfer-hash.js --yes      ← 실제로 지움
        RTDB 가 기본 인스턴스가 아니면(asia-southeast1 등) --instance <이름> 을 붙인다.
        이름은 firebase-config.js 의 databaseURL 앞부분 — https://<이름>.asia-southeast1.firebasedatabase.app
   어떻게: firebase CLI(로그인된 관리자 권한 — 규칙을 거치지 않는다)로
     database:get /users --shallow → uid 목록 → {"<uid>/transferHash": null, …} 를 500개씩 database:update /users.
     없는 자리에 null 을 써도 아무 일도 없다(멀티 경로 갱신의 null = 지우기).
   ★ 두 번 돌려도 같다(멱등). 비밀번호 값은 읽지도 찍지도 않는다. */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const YES = args.includes('--yes');
const ia = args.indexOf('--instance');
const INSTANCE = ia >= 0 ? args[ia + 1] : null;
const PROJECT = 'together-working';
const CHUNK = 500;

function fb(sub){
  const extra = ['--project', PROJECT].concat(INSTANCE ? ['--instance', INSTANCE] : []);
  const cmd = ['firebase'].concat(sub, extra).map(a => /\s/.test(a) ? '"' + a + '"' : a).join(' ');
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0){
    console.error('✗ firebase 명령 실패: ' + cmd + '\n' + (r.stderr || r.stdout || ''));
    process.exit(1);
  }
  return r.stdout;
}

const raw = fb(['database:get', '/users', '--shallow']);
let users;
try { users = JSON.parse(raw); } catch (e){ console.error('✗ /users 목록을 읽지 못했어요:\n' + raw.slice(0, 500)); process.exit(1); }
const uids = Object.keys(users || {}).filter(u => /^[A-Za-z0-9_-]{1,128}$/.test(u));
console.log(`/users 아래 uid ${uids.length}개 (${PROJECT}${INSTANCE ? ' · ' + INSTANCE : ''})`);
if (!YES){ console.log('미리 보기만 했어요 — 지우려면 --yes 를 붙여 다시 실행하세요. (transferData 는 건드리지 않아요)'); process.exit(0); }

const tmp = path.join(os.tmpdir(), 'tw-clear-transfer-hash.json');
let done = 0;
for (let i = 0; i < uids.length; i += CHUNK){
  const part = {};
  uids.slice(i, i + CHUNK).forEach(u => { part[u + '/transferHash'] = null; });
  fs.writeFileSync(tmp, JSON.stringify(part));
  fb(['database:update', '/users', tmp, '--force']);
  done += Object.keys(part).length;
  console.log(`  ${done}/${uids.length}`);
}
try { fs.unlinkSync(tmp); } catch (_){}
console.log('✅ transferHash 정리 끝 — 콘솔 › Realtime Database › users/{아무 uid} 에 transferHash 가 없는지 한 곳 확인해 주세요.');

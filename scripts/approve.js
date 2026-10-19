#!/usr/bin/env node
/* ✅ 승인 명령 — 승인자(mihioon)가 터미널에서 직접 돌린다: `! node scripts/approve.js 401 396`
   PR 마다 지금 머리 커밋 앞 7자리로 «승인 <커밋>» 코멘트를 단다(risk.py 가 읽는 한 줄과 같은 모양).
   커밋 번호로 거는 까닭: 승인 뒤 새 커밋이 올라오면 그 승인은 통하지 않는다 — 다시 돌린다.
   ⚠️ 세션은 이 명령을 돌리지 않는다(가드 ship-gate.py 가 막는다) — 세션이 스스로 승인하면 승인이 사람 확인이 아니게 된다. */
'use strict';
const { execFileSync } = require('child_process');

const REPO = 'grk-cmd/t-w';
const OWNER = 'mihioon';   // risk.py OWNER 와 같다 — 다른 계정의 코멘트는 승인으로 치지 않는다

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const nums = process.argv.slice(2);
if(!nums.length || nums.some(n => !/^\d+$/.test(n))){
  console.error('쓰는 법: node scripts/approve.js <PR 번호> [PR 번호…]');
  process.exit(2);
}

let me = '';
try{ me = gh(['api', 'user', '--jq', '.login']); }catch(e){ console.error('gh 로그인을 확인하지 못했어요 — `gh auth status`'); process.exit(1); }
if(me !== OWNER){
  console.error(`지금 gh 계정은 ${me} — 승인은 ${OWNER} 계정의 코멘트만 쳐요`);
  process.exit(1);
}

let fail = 0, done = 0;
for(const n of nums){
  try{
    const pr = JSON.parse(gh(['api', `repos/${REPO}/pulls/${n}`]));
    if(pr.state !== 'open'){ console.log(`#${n} 은 열려 있지 않아요(${pr.state}) — 건너뜀`); continue; }
    const sha7 = pr.head.sha.slice(0, 7);
    gh(['api', `repos/${REPO}/issues/${n}/comments`, '-f', `body=승인 ${sha7}`]);
    console.log(`#${n} 승인 ${sha7} — ${pr.title}`);
    done++;
  }catch(e){
    fail++;
    console.error(`#${n} 승인하지 못했어요 — ${String((e && e.stderr) || e).trim().slice(0, 200)}`);
  }
}
if(!fail) console.log(done ? `끝 — ${done}건 달았어요 · 세션이 승인을 보고 머지해요(따로 칠 것 없음)` : '달린 승인 0건 — 열린 PR 이 없어요');
process.exit(fail ? 1 : 0);

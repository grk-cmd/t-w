/* help-deploy-guard.js — 도움말 사이트(hosting:help)를 올리기 직전 검문. firebase.json 의 help 칸 predeploy 가 firebase/ 에서 부른다.
   [왜] 도움말 사이트는 main 에서만 올린다. main 이 아닌 브랜치 · 받지 않은 오래된 폴더에서 올리면 옛 안내가 그대로 사용자에게 나간다
     (폰 연결 안내가 0.12 판으로 되돌아가 신호가 안 가던 일 — B-1125-5).
   ★ 통과 조건: 지금 브랜치가 main · GitHub 의 main 과 같은 커밋 · firebase/hosting/help 아래 커밋 안 한 고침 없음.
     하나라도 아니면 까닭을 한국어로 찍고 1 로 끝낸다(firebase CLI 가 올리기를 멈춘다).
   판정은 순수 함수 judge — 검사 checks/sim-help-deploy-guard.js */
'use strict';
const { execFileSync } = require('child_process');

const BRANCH = 'main';
const HELP_DIR = 'firebase/hosting/help';

/* s = { branch, head, originHead, dirty(문자열 — git status 결과) } → { ok:true } | { ok:false, why } */
function judge(s){
  if(!s || s.branch !== BRANCH) return { ok: false, why: '지금 브랜치가 «' + ((s && s.branch) || '?') + '» 예요. 도움말 사이트는 main 에서만 올려요 — `git checkout main` 뒤 `git pull` 하고 다시 올려 주세요.' };
  if(!s.head || !s.originHead) return { ok: false, why: 'GitHub 의 main 을 확인하지 못했어요 — 인터넷 연결을 확인하고 다시 올려 주세요.' };
  if(s.head !== s.originHead) return { ok: false, why: '이 폴더의 main 이 GitHub 의 main 과 달라요 — `git pull` 로 최신을 받은 뒤 다시 올려 주세요(올리지 않은 커밋이 있으면 먼저 PR 로).' };
  if(String(s.dirty || '').trim()) return { ok: false, why: '도움말 폴더(' + HELP_DIR + ')에 커밋하지 않은 고침이 있어요 — 고침은 PR 로 main 에 넣은 뒤 올려 주세요.\n' + String(s.dirty).trim() };
  return { ok: true };
}

function git(args, cwd){ return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }

function readState(cwd){
  const s = { branch: null, head: null, originHead: null, dirty: '' };
  try{ s.branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd); }catch(_){ return s; }
  try{ git(['fetch', '-q', 'origin', BRANCH], cwd); s.originHead = git(['rev-parse', 'origin/' + BRANCH], cwd); }catch(_){ s.originHead = null; }
  try{ s.head = git(['rev-parse', 'HEAD'], cwd); }catch(_){ s.head = null; }
  try{ const root = git(['rev-parse', '--show-toplevel'], cwd); s.dirty = git(['status', '--porcelain', '--', HELP_DIR], root); }catch(_){ s.dirty = '(상태를 읽지 못함)'; }
  return s;
}

if(require.main === module){
  const r = judge(readState(process.cwd()));
  if(!r.ok){ console.error('\n✗ 도움말 사이트를 올리지 않았어요\n  ' + r.why.replace(/\n/g, '\n  ') + '\n'); process.exit(1); }
  console.log('✓ main 최신 · 도움말 폴더 깨끗 — 올립니다');
}

module.exports = { judge, readState, BRANCH, HELP_DIR };

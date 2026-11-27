/* sim-pr-title.js — PR 제목에 GitHub 멘션(@글자)이 없는가
   실행:  node checks/run.js sim-pr-title          (판정 함수 mutation test 만)
          node checks/sim-pr-title.js --title "<PR 제목>"   (CI pr-title 잡이 PR 제목을 넘겨 판정)
   ★ 왜 — PR 제목은 squash 커밋 제목 · 릴리스 본문(자동 PR 목록)이 된다. 제목의 «@v5» 같은 글자를 GitHub 가 사람 멘션으로 읽어
     릴리스 Contributors 에 남의 계정이 붙었다(0.12.0 초안). 리뷰 교훈 «PR · 커밋 제목에 @글자» 를 검사로 옮겼다.
     백틱으로 감싼 것(`actions/checkout@v5`)과 메일 주소 꼴(a@b)은 멘션이 아니라 통과. */
'use strict';
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

/** 제목에서 GitHub 가 멘션으로 읽을 @이름 목록 */
function mentions(title){
  const plain = String(title || '').replace(/`[^`]*`/g, ' ');
  return [...plain.matchAll(/(^|[^A-Za-z0-9_`./-])@([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\/[A-Za-z0-9_.-]+)?)/g)].map((m) => '@' + m[2]);
}

const i = process.argv.indexOf('--title');
if(i >= 0){
  const title = process.argv[i + 1] || '';
  const found = mentions(title);
  chk(found.length === 0, 'PR 제목에 멘션 없음' + (found.length ? ` — ${found.join(' · ')} (@ 를 빼거나 백틱으로 감쌀 것: \`actions/checkout@v5\`)` : ''));
  process.exit(fail ? 1 : 0);
}

say('mutation test — 멘션 판정');
const cases = [
  ['ci: actions @v5 로 올림', ['@v5']],
  ['@mihioon 승인 요청', ['@mihioon']],
  ['fix(x): 고침 (@grk-cmd/reviewers 확인)', ['@grk-cmd/reviewers']],
  ['ci: `actions/checkout@v5` 로 올림', []],
  ['docs: 메일 help@together-working.com 안내', []],
  ['build(lint): 메인 ↔ 렌더러 경계 — 새 위반만 막는다', []],
  ['chore: @types/node 올림', ['@types/node']],
  ['chore: `@types/node` 올림', []],
];
for(const [title, want] of cases){
  const got = mentions(title);
  chk(JSON.stringify(got) === JSON.stringify(want), `${title} → ${want.join(' · ') || '없음'}` + (JSON.stringify(got) === JSON.stringify(want) ? '' : ' — 실제 ' + (got.join(' · ') || '없음')));
}
say(`통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

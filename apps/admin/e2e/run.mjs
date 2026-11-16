// e2e 실행 — `npm run e2e` · `npm run e2e -- <playwright 인자>`(예: `-- xmas`). Windows 기본 창(cmd)에서도 돈다.
// [왜] 예전 스크립트는 cp(cmd 에 없음)로 규칙 사본을 만들고, 붙인 인자가 «playwright test» 따옴표 밖으로 떨어져 시험 이름이 넘어가지 않았다.
// 바깥(npm 이 부름): 규칙 사본 → 에뮬레이터를 띄우고 안쪽으로 자기를 다시 부른다. 인자는 명령 글이 아니라 환경 변수로 넘긴다(따옴표 · 셸 차이 없음).
// 안쪽(에뮬레이터가 부름): playwright 를 인자 배열 그대로 부른다.
import { spawnSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const INNER = 'TW_E2E_ARGS';

function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.error) throw r.error;
  process.exit(r.status ?? 1);
}

if (process.env[INNER] !== undefined) {
  const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
  run(process.execPath, [cli, 'test', ...JSON.parse(process.env[INNER])]);
} else {
  copyFileSync('../../firebase/firebase-database-rules.json', 'e2e/.database.rules.json');
  // 명령 글은 고정 — 사용자 인자는 들어가지 않는다. firebase 는 전역 설치(firebase-tools) · Windows 는 firebase.cmd 라 셸로 찾는다.
  run('firebase emulators:exec --config e2e/firebase.json --project demo-tw "node e2e/run.mjs"', [], {
    shell: true,
    env: { ...process.env, [INNER]: JSON.stringify(process.argv.slice(2)) },
  });
}

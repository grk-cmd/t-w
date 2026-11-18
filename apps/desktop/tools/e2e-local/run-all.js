// 시나리오를 차례로 돌리고 한 줄씩 요약한다 — 하나라도 FAIL 이면 종료 코드 1
// node run-all.js [거르기…]   예) node run-all.js room/   ·  node run-all.js room/create-join chat/
// 결과 폴더는 시나리오마다 <TW_E2E_OUT 또는 /tmp/tw-e2e>/<영역>/<이름> · 각 폴더의 steps.txt 에 단계별 ok · FAIL
// TW_E2E_RUN_LOCK=<폴더> 면 runlock.js 로 한 번 잡고 다 돈 뒤 놓는다(한 PC 에서 여럿이 돌릴 때 앱이 겹치지 않게)
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { acquire } = require('./runlock.js');

const DIR = path.join(__dirname, 'scenarios');
const OUT = process.env.TW_E2E_OUT || '/tmp/tw-e2e';
const filters = process.argv.slice(2);

// 이름이 _ 로 시작하는 파일은 공통부라 시나리오가 아니다
const all = fs.readdirSync(DIR).flatMap((area) => {
  const d = path.join(DIR, area);
  if(!fs.statSync(d).isDirectory()) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.js') && !f.startsWith('_')).sort().map((f) => `${area}/${f.slice(0, -3)}`);
}).sort();
const picked = filters.length ? all.filter((n) => filters.some((f) => n.startsWith(f))) : all;
if(!picked.length){ console.error('돌릴 시나리오가 없다: ' + filters.join(' ')); process.exit(2); }

(async () => {
  // 실행 잠금(runlock.js) — 한 번 잡고 다 돈 뒤 놓는다. 시나리오에는 TW_E2E_RUN_LOCK_HELD=1 을 넘겨 다시 안 잡게
  const lock = process.env.TW_E2E_RUN_LOCK;
  const release = await acquire('run-all ' + (filters.join(' ') || '전부'));
  const rows = [];
  try {
    for(const name of picked){
      const out = path.join(OUT, name);
      const t0 = Date.now();
      const r = spawnSync(process.execPath, [path.join(DIR, name + '.js'), out], {
        stdio: 'inherit', env: { ...process.env, TW_E2E_RUN_LOCK_HELD: lock ? '1' : '' },
      });
      const steps = fs.existsSync(path.join(out, 'steps.txt')) ? fs.readFileSync(path.join(out, 'steps.txt'), 'utf8') : '';
      const fail = steps.split('\n').find((l) => /^(FAIL|ABORT)/.test(l));
      rows.push({ name, ok: r.status === 0, sec: Math.round((Date.now() - t0) / 1000), why: r.status === 0 ? '' : (fail || `종료 코드 ${r.status}`) });
      // 창이 조용하지 않았으면(TW_E2E_QUIET_FAIL 파일이 생김) 여기서 멈춘다 — 이 PC 화면을 더 건드리지 않게
      if(process.env.TW_E2E_QUIET_FAIL && fs.existsSync(process.env.TW_E2E_QUIET_FAIL)){ console.log('조용한 창 실패 — 멈춤: ' + process.env.TW_E2E_QUIET_FAIL); break; }
    }
  } finally { release(); }
  console.log('\n── 요약 ──');
  for(const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name} (${r.sec}s)${r.why ? ' — ' + r.why : ''}`);
  const bad = rows.filter((r) => !r.ok).length;
  console.log(`${rows.length - bad}/${rows.length} 통과`);
  process.exit(bad ? 1 : 0);
})();

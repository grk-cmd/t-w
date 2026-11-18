// scenarios/ 아래 시나리오 파일을 하나씩 돌리고 요약을 찍는다 — 하나라도 FAIL 이면 종료 코드 1
// node run-all.js [이름 일부 …]   (예: node run-all.js core/keepalive admin)
// '_' 로 시작하는 파일은 같이 쓰는 도구라 돌리지 않는다
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = path.join(__dirname, 'scenarios');
const filters = process.argv.slice(2);

function list(d){
  if(!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((e) => {
    const p = path.join(d, e.name);
    if(e.isDirectory()) return list(p);
    return (e.name.endsWith('.js') && !e.name.startsWith('_')) ? [p] : [];
  });
}

// 실행 잠금(TW_E2E_RUN_LOCK · runlock.js — 네 묶음이 같이 씀)은 러너가 한 번 잡고 끝까지 든다 — 시나리오마다 놓고 다시 잡으면
// 다른 묶음과 번갈아 끼어든다. 시나리오는 TW_E2E_RUN_LOCK_HELD=1 을 보고 다시 잡지 않는다
const { acquire } = require('./runlock.js');

const files = list(DIR).filter((f) => !filters.length || filters.some((s) => path.relative(DIR, f).includes(s)));
if(!files.length){ console.error('돌릴 시나리오가 없다'); process.exit(2); }
(async () => {
  const unlock = await acquire('run-all ' + filters.join(' '));
  const rows = [];
  const env = Object.assign({}, process.env, process.env.TW_E2E_RUN_LOCK ? { TW_E2E_RUN_LOCK_HELD: '1' } : {});
  // 다른 묶음이 조용한 창이 깨진 것을 남겼으면(잠금 폴더 옆 e2e-quiet-fail) 다음 시나리오를 켜지 않는다
  const quietFail = process.env.TW_E2E_RUN_LOCK ? path.join(path.dirname(process.env.TW_E2E_RUN_LOCK), 'e2e-quiet-fail') : '';
  for(const f of files){
    const rel = path.relative(DIR, f);
    if(quietFail && fs.existsSync(quietFail)){ console.error('e2e-quiet-fail 이 있어 멈춤: ' + quietFail); rows.push({ rel, ok: false, sec: 0 }); break; }
    const t0 = Date.now();
    console.log(`▶ ${rel}`);
    const r = spawnSync(process.execPath, [f], { stdio: 'inherit', cwd: __dirname, env });
    rows.push({ rel, ok: r.status === 0, sec: Math.round((Date.now() - t0) / 1000) });
  }
  unlock();
  console.log('\n요약');
  for(const r of rows) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.rel} (${r.sec}s)`);
  const bad = rows.filter((r) => !r.ok).length;
  console.log(`${rows.length - bad}/${rows.length} 통과`);
  process.exit(bad ? 1 : 0);
})();

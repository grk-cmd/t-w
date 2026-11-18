// scenarios/ 아래 시나리오 파일을 하나씩 돌리고 요약을 찍는다 — 하나라도 FAIL 이면 종료 코드 1
// node run-all.js [이름 일부 …]   (예: node run-all.js core/keepalive admin)
// '_' 로 시작하는 파일은 같이 쓰는 도구라 돌리지 않는다
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { acquire } = require('./runlock.js');

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

const files = list(DIR).filter((f) => !filters.length || filters.some((s) => path.relative(DIR, f).includes(s)));
if(!files.length){ console.error('돌릴 시나리오가 없다'); process.exit(2); }
(async () => {
await acquire('run-all ' + (filters.join(' ') || 'all'));   // TW_E2E_RUN_LOCK — 시나리오는 다시 잡지 않는다(TW_E2E_RUN_LOCK_HELD)
const rows = [];
for(const f of files){
  const rel = path.relative(DIR, f);
  const t0 = Date.now();
  console.log(`▶ ${rel}`);
  const r = spawnSync(process.execPath, [f], { stdio: 'inherit', cwd: __dirname, env: { ...process.env, TW_E2E_RUN_LOCK_HELD: '1' } });
  rows.push({ rel, ok: r.status === 0, sec: Math.round((Date.now() - t0) / 1000) });
}
console.log('\n요약');
for(const r of rows) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.rel} (${r.sec}s)`);
const bad = rows.filter((r) => !r.ok).length;
console.log(`${rows.length - bad}/${rows.length} 통과`);
process.exit(bad ? 1 : 0);
})();

// scenarios/<영역>/*.js 를 하나씩 돌리고 요약을 찍는다 — 결과는 /tmp/tw-e2e/<영역>/<이름>/(steps.txt · 앱마다 console.txt · requests.txt · fail-*.png)
// node run-all.js [거르기…]   예) node run-all.js account   · node run-all.js account/login
// 시나리오는 `node <파일> <결과 폴더>` 로 따로 돌릴 수도 있다. 하나라도 실패하면 종료 코드 1
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { acquire, QUIET_FAIL, RUNNER_MS } = require('./runlock.js');

const ROOT = path.join(__dirname, 'scenarios');
const OUT = process.env.TW_E2E_OUT || '/tmp/tw-e2e';
const filters = process.argv.slice(2);

function list(){
  const all = [];
  for(const area of fs.readdirSync(ROOT).sort()){
    const dir = path.join(ROOT, area);
    if(!fs.statSync(dir).isDirectory()) continue;
    for(const f of fs.readdirSync(dir).sort()){
      if(!f.endsWith('.js') || f.startsWith('_')) continue;   // _kit.js 같은 공통부는 시나리오가 아니다
      const id = area + '/' + f.replace(/\.js$/, '');
      if(filters.length && !filters.some((x) => id === x || id.startsWith(x.replace(/\/?$/, '/')) || area === x)) continue;
      all.push({ id, file: path.join(dir, f), out: path.join(OUT, id) });
    }
  }
  return all;
}

if(require.main === module) (async () => {
  const items = list();
  if(!items.length){ console.error('돌릴 시나리오가 없다: ' + (filters.join(' ') || '(전부)')); process.exit(2); }
  const unlock = await acquire('run-all ' + (filters.join(' ') || 'all'));
  const env = Object.assign({}, process.env, { TW_E2E_RUN_LOCK_HELD: '1' });
  const rows = [];
  // 다른 묶음이 조용한 창이 깨진 것을 남겼으면(잠금 폴더 옆 e2e-quiet-fail) 다음 시나리오를 켜지 않는다
  for(const it of items){
    if(QUIET_FAIL && fs.existsSync(QUIET_FAIL)){ console.error('e2e-quiet-fail 이 있어 멈춤: ' + QUIET_FAIL); rows.push({ id: it.id, ok: false, sec: 0, bugs: 0, why: '멈춤 — e2e-quiet-fail' }); break; }
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [it.file, it.out], { cwd: __dirname, env, stdio: 'inherit', timeout: RUNNER_MS });
    let steps = '';
    try { steps = fs.readFileSync(path.join(it.out, 'steps.txt'), 'utf8'); } catch(_){}
    const ok = r.status === 0 && /^PASS$/m.test(steps);
    const bugs = (steps.match(/^BUG .*/gm) || []).length;
    rows.push({ id: it.id, ok, sec: Math.round((Date.now() - t0) / 1000), bugs,
      why: ok ? '' : ((steps.match(/^(FAIL|ABORT) .*/m) || [r.error ? String(r.error.message) : 'steps.txt 없음 · 종료 코드 ' + r.status])[0]) });
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${it.id} (${rows[rows.length - 1].sec}s)${bugs ? ' · 알려진 버그 ' + bugs : ''}`);
  }
  unlock();
  const fail = rows.filter((x) => !x.ok);
  console.log('\n── 요약 ──');
  for(const x of rows) console.log(`${x.ok ? 'ok  ' : 'FAIL'} ${x.id.padEnd(32)} ${String(x.sec).padStart(4)}s${x.bugs ? '  BUG×' + x.bugs : ''}${x.why ? '  ' + x.why : ''}`);
  console.log(`${rows.length - fail.length}/${rows.length} 통과 · 결과 ${OUT}`);
  process.exit(fail.length ? 1 : 0);
})();

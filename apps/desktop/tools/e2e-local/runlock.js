// 한 번에 한 묶음만 Electron 을 켜게 하는 잠금 — TW_E2E_RUN_LOCK 에 잠금 폴더 경로를 주면 mkdir(원자적)로 잡고 rmdir 로 놓는다.
// 비어 있으면 잠그지 않는다. run-all.js 가 잡으면 TW_E2E_RUN_LOCK_HELD=1 을 넘겨 시나리오는 다시 잡지 않는다
'use strict';
const fs = require('fs');

const LOCK = process.env.TW_E2E_RUN_LOCK || '';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function acquire(owner){
  if(!LOCK || process.env.TW_E2E_RUN_LOCK_HELD === '1') return () => {};
  for(let n = 0; ; n++){
    try { fs.mkdirSync(LOCK); break; }
    catch(e){
      if(e.code !== 'EEXIST') throw e;
      if(n % 4 === 0) console.error('[runlock] 다른 실행이 잡고 있어 기다림: ' + LOCK);
      await wait(30000);
    }
  }
  try { fs.writeFileSync(LOCK + '/owner', owner + ' ' + process.pid + ' ' + new Date().toISOString()); } catch(_){}
  let held = true;
  const release = () => {
    if(!held) return; held = false;
    try { fs.rmSync(LOCK + '/owner', { force: true }); fs.rmdirSync(LOCK); } catch(_){}
  };
  process.on('exit', release);
  for(const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143]]) process.on(sig, () => { release(); process.exit(code); });
  return release;
}

module.exports = { acquire };

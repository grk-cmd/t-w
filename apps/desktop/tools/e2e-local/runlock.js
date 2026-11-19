// 한 번에 한 묶음만 Electron 을 켜게 하는 잠금 — TW_E2E_RUN_LOCK 에 잠금 폴더 경로를 주면 mkdir(원자적)로 잡고 rmdir 로 놓는다.
// 비어 있으면 잠그지 않는다. run-all.js 가 잡으면 TW_E2E_RUN_LOCK_HELD=1 을 넘겨 시나리오는 다시 잡지 않는다
'use strict';
const fs = require('fs');
const path = require('path');

const LOCK = process.env.TW_E2E_RUN_LOCK || '';
// 조용한 창이 깨졌다는 표시 파일 — 잠금 폴더 옆 하나. run-all 은 이 파일이 있으면 다음 시나리오를 켜지 않는다(사람이 까닭을 보고 지운다). 잠그지 않고 돌면 ''
const QUIET_FAIL = LOCK ? path.join(path.dirname(LOCK), 'e2e-quiet-fail') : '';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// opts.signals:false — 신호를 받아도 바로 끝내지 않는다(부르는 쪽이 신호 때 할 일을 마친 뒤 끝낸다 · 잠금은 exit 에서 놓음)
async function acquire(owner, opts = {}){
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
  if(opts.signals !== false) for(const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143]]) process.on(sig, () => { release(); process.exit(code); });
  return release;
}

/** 표시 파일에 한 줄 덧붙인다(시각 · 글). 잠그지 않고 돌면 아무것도 안 한다 */
function markQuietFail(text){
  if(!QUIET_FAIL) return;
  try { fs.appendFileSync(QUIET_FAIL, new Date().toISOString() + ' ' + text + '\n'); } catch(_){}
}

module.exports = { acquire, QUIET_FAIL, markQuietFail };

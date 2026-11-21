// 켜 둔 앱에 명령 파일로 말을 건다: <결과 폴더>/cmd/<n>.js 를 쓰면 <결과 폴더>/cmd/<n>.out 에 답
// node repl.js <결과 폴더>   (명령 보내기는 run.sh)
'use strict';
const fs = require('fs');
const path = require('path');
const { makeApp, wait } = require('./lib.js');

const [outArg] = process.argv.slice(2);
if(!outArg){ console.error('쓰는 법: node repl.js <결과 폴더>'); process.exit(2); }
const A = makeApp(outArg);
const out = A.out;
const cmdDir = path.join(out, 'cmd');

(async () => {
  fs.mkdirSync(cmdDir, { recursive: true });
  let w = await A.launch();
  // 명령 몸에서 c.w = … 로 창을 바꿔 끼울 수 있게 읽기 · 쓰기로 둔다
  const ctx = { A, get app(){ return A.app; }, get w(){ return w; }, set w(v){ w = v; }, fs, out, wait };
  fs.writeFileSync(path.join(out, 'ready'), String(A.app.process().pid));
  const done = new Set();
  for(;;){
    for(const f of fs.readdirSync(cmdDir).filter((f) => f.endsWith('.js')).sort()){
      if(done.has(f)) continue;
      done.add(f);
      let res;
      try {
        const body = fs.readFileSync(path.join(cmdDir, f), 'utf8');
        const fn = new Function('c', `return (async () => { const { A, app, w, fs, out, wait } = c; ${body} })()`);
        res = await fn(ctx);
      } catch(e){ res = 'ERR ' + String(e.stack || e).split('\n').slice(0, 3).join('\n'); }
      fs.writeFileSync(path.join(cmdDir, f.replace(/\.js$/, '.out')), typeof res === 'string' ? res : JSON.stringify(res, null, 1));
      fs.writeFileSync(path.join(out, 'console.txt'), A.logs.join('\n'));
      fs.writeFileSync(path.join(out, 'requests.txt'), A.reqs.join('\n'));
      if(res === 'QUIT'){ await A.quit(); process.exit(0); }
    }
    await wait(300);
  }
})().catch(async (e) => {
  fs.writeFileSync(path.join(out, 'fatal'), String(e.stack));
  await A.quit().catch(() => {});
  process.exit(1);
});

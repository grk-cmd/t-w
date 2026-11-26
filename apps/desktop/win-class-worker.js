/* win-class-worker.js — 🪟 창 클래스 일꾼(worker_threads) — GetClassNameW 를 main 스레드 밖에서 부른다
   [왜] main 은 koffi 를 직접 싣지 않는다(네이티브 동기 호출은 일꾼에만 — pad-worker.js 와 같은 규칙).
   받는 것: { id, hwnd } → 보내는 것: { id, cls }(못 읽으면 '') · { log: '...' } · { off: true }(koffi · user32 를 못 써서 받지 않고 끝남).
   ⚠️ app.asar 밖(app.asar.unpacked)에서 실린다 — require('koffi') 가 풀린 node_modules 를 찾게(package.json asarUnpack).
   검사: checks/sim-winlist.js */
'use strict';
const { parentPort } = require('worker_threads');
const { createClassReader } = require('./win-class');

const reader = createClassReader({
  requireKoffi: () => require('koffi'),
  log: (m) => parentPort.postMessage({ log: m }),
});
if(reader.usable()){
  parentPort.on('message', (m) => {
    if(m && m.id) parentPort.postMessage({ id: m.id, cls: reader.read(m.hwnd) });
  });
} else {
  parentPort.postMessage({ off: true });
}

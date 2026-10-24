/* pad-worker.js — 🎮 게임패드 일꾼(worker_threads) — XInput 을 main 스레드 밖에서 읽는다
   [왜] XInputGetState 는 동기 호출이라 가상 패드 드라이버(DS4Windows · ViGEm · Steam 입력)가 늘어지면
     그동안 main 이 통째로 멈췄다(클릭 통과 · IPC · 안전장치가 같이 밀림). 여기서 돌면 main 은 마지막 값만 읽는다.
   보내는 것: { pads: [...] }(PAD_POLL_MS 마다) · { log: '...' }(진단 한 줄) · { off: true }(koffi · DLL 을 못 써서 폴링하지 않고 끝남).
   ⚠️ app.asar 밖(app.asar.unpacked)에서 실린다 — 그래야 require('koffi') 가 풀린 node_modules 를 찾는다(package.json asarUnpack).
   검사: checks/sim-gamepad-activity.js */
'use strict';
const { parentPort } = require('worker_threads');
const { createXInputReader } = require('./pad-xinput');

const PAD_POLL_MS = 500;   // main 의 활성 창 폴링 간격과 같게 — 받는 쪽 판정(gamepad-activity.js)이 같은 박자를 본다

const reader = createXInputReader({
  requireKoffi: () => require('koffi'),
  log: (m) => parentPort.postMessage({ log: m }),
});
if(reader.usable()){
  setInterval(() => { parentPort.postMessage({ pads: reader.read() }); }, PAD_POLL_MS);
} else {
  parentPort.postMessage({ off: true });   // 못 쓰는 까닭은 위 log 로 이미 보냈다 — main 은 이 뒤의 종료를 «멈춤» 으로 또 적지 않는다
}

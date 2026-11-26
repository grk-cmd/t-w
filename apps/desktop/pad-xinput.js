/* pad-xinput.js — 🎮 XInput 패드 읽기 규칙(Windows) — 일꾼(pad-worker.js)이 부른다
   ・내놓는 것: createXInputReader({ requireKoffi, log }) → { read() } — Gamepad API 모양({ index, id, buttons, axes }) 목록.
     koffi · DLL 을 못 불러오면 늘 빈 목록(기록은 한 번). usable() — 불러왔는가(못 불러왔으면 일꾼이 폴링을 멈춘다).
   ⚠️ 연결 안 된 자리를 XInputGetState 로 부르면 느리다(장치를 다시 찾는다) — 빈 자리는 PAD_EMPTY_RETRY 번에 한 번만 다시 묻는다.
   ⚠️ 이 호출은 가상 패드 드라이버가 있는 PC 에서 오래 걸릴 수 있다 — 그래서 main 스레드가 아니라 일꾼에서 돈다(sysinput-win.js).
   검사: checks/sim-gamepad-activity.js */
'use strict';

const XINPUT_DLLS = ['xinput1_4.dll', 'xinput9_1_0.dll'];   // Windows 8+ · 그 전 판(재배포 없이 깔려 있는 것)
const XINPUT_SLOTS = 4;
const XINPUT_STATE_BYTES = 16;     // XINPUT_STATE — dwPacketNumber(4) + XINPUT_GAMEPAD(12)
const XINPUT_TRIGGER_PRESS = 30;   // XINPUT_GAMEPAD_TRIGGER_THRESHOLD
const PAD_EMPTY_RETRY = 6;         // 빈 자리는 read 6번(500ms 폴링이면 3초)에 한 번

function _padOf(slot, b){
  const w = b.readUInt16LE(4);
  const buttons = [];
  for(let i = 0; i < 16; i++){
    const p = !!(w & (1 << i));
    buttons.push({ pressed: p, value: p ? 1 : 0 });
  }
  buttons.push({ pressed: b[6] > XINPUT_TRIGGER_PRESS, value: b[6] / 255 },
               { pressed: b[7] > XINPUT_TRIGGER_PRESS, value: b[7] / 255 });
  const axes = [8, 10, 12, 14].map(o => b.readInt16LE(o) / 32767);
  return { index: slot, id: 'xinput', connected: true, buttons, axes };
}

function createXInputReader(deps){
  const requireKoffi = deps.requireKoffi;
  const log = deps.log;
  let getState;                    // undefined = 아직 안 불러옴 · null = 못 씀
  const buf = Buffer.alloc(XINPUT_STATE_BYTES);
  const emptyWait = new Array(XINPUT_SLOTS).fill(0);

  function load(){
    if(getState !== undefined) return getState;
    getState = null;
    let koffi;
    try{ koffi = requireKoffi(); }
    catch(err){ log('koffi 로드 실패 — 게임패드 읽기 없음: ' + (err && err.message || err)); return null; }
    for(const dll of XINPUT_DLLS){
      try{
        getState = koffi.load(dll).func('uint32_t __stdcall XInputGetState(uint32_t dwUserIndex, void *pState)');
        return getState;
      }catch(_){}
    }
    log('XInput DLL 을 찾지 못함 — 게임패드 읽기 없음');
    return null;
  }

  function read(){
    const get = load();
    if(!get) return [];
    const out = [];
    for(let slot = 0; slot < XINPUT_SLOTS; slot++){
      if(emptyWait[slot] > 0){ emptyWait[slot]--; continue; }
      let r;
      try{ r = get(slot, buf); }catch(_){ r = -1; }
      if(r !== 0){ emptyWait[slot] = PAD_EMPTY_RETRY - 1; continue; }
      out.push(_padOf(slot, buf));
    }
    return out;
  }

  return { read, usable: () => !!load() };
}

module.exports = { createXInputReader, PAD_EMPTY_RETRY, XINPUT_SLOTS };

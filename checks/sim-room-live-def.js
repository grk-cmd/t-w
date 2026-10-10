/* sim-room-live-def.js — 방에 있는 채로 런처에서 캐릭터를 고치고 돌아오면 남의 화면에도 바뀐 모습이 가는지
   실행:  node sim-room-live-def.js   (app.js · smoke.js 와 같은 폴더에서)

   ★ 제보 — «방에서 캐릭터 디자인을 바꿔도 남 화면에서 안 바뀐다(캐릭터 교체는 바뀐다)».
     런처 ⚙ [캐릭터 수정] 은 생성기를 kind:'slot' 로 연다. 그 [완료] 는 슬롯에만 쓰고 방으로는 안 보낸다.
     런처에서 실행 화면으로 돌아오는 launchApp 이 내 좌석만 새 def 로 다시 그리고 방에는 알리지 않았다.
   ⇒ launchApp 이 «방에 마지막으로 보낸 def(Presence.myDef)» 와 지금 슬롯 def 를 견주어 다르면
     캐릭터 교체(switchMainCharacter)와 같은 Presence.updateDef 로 보낸다.

   1. Firebase 방 — 바뀐 채로 돌아오면 updateMe 에 새 def · 그냥 왕복은 아무것도 안 보냄 · 방 밖이면 안 보냄
   2. 방 서버 방 — 같은 길로 provider.update 에 def 가 실린다(서버 provider 는 이 def 를 'def' 메시지로 보낸다)
   3. 줄 — launchApp 이 Presence.myDef 를 보고 updateDef 를 부른다 · 옛 줄(안 보냄)이면 빨강
   ⚠ smoke.js 의 스텁을 빌려 쓴다 — 같은 폴더에 있어야 한다. */
'use strict';
const fs = require('fs'), vm = require('vm');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
smokeSrc = smokeSrc.slice(0, smokeSrc.indexOf('/* ── 실행'))
  .split('\n').filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

const realST = require('timers').setTimeout;
globalThis.setTimeout  = (fn, ms) => realST(fn, ms || 0);
globalThis.setInterval = () => 0;
globalThis.clearTimeout = require('timers').clearTimeout;

globalThis.HTMLCanvasElement = class {};
globalThis.Image = class {
  constructor(){ this.naturalWidth = 512; this.naturalHeight = 512; }
  set src(v){ this._src = v; realST(() => { if (this.onload) this.onload(); }, 0); }
  get src(){ return this._src; }
};
globalThis.HTMLImageElement = globalThis.Image;

const SRC = fs.readFileSync('app.js', 'utf8');
const probe = `
;globalThis.__P = { Presence, slots, launchApp, setCurSlot: n => { curSlot = n; } };`;

const say = console.log;
console.log = () => {}; console.warn = () => {};
try { vm.runInThisContext(SRC + probe, { filename: 'app.js' }); }
catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e)); process.exit(1); }

/* 3D 는 이 검사의 대상이 아니다 — 좌석 빌드(GLB 가 없는 스텁 환경)만 비운다. 전역 함수라 바꿔 끼우면 launchApp 이 이걸 부른다. */
globalThis.applyCharToSeat = (seat, def) => { seat.charDef = def; };
globalThis.createSeat = () => ({ group: {} });
['selectSeat', 'renderSeatTabs', 'setManual', 'layoutSeats', 'syncFriendSeats'].forEach(n => { globalThis[n] = () => {}; });
const P = globalThis.__P;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const tick = () => new Promise(r => realST(r, 20));

let sent = [];
globalThis.window.firebaseAPI = {
  uploadRoomFace: async (uid, key) => ({ ok: true, url: 'https://storage.test/' + key + '.png' }),
  joinRoom: (room, me) => { sent.push({ how: 'join', payload: me }); return 'm_test'; },
  updateMe: (p) => { sent.push({ how: 'update', payload: p }); },
  leaveRoom: async () => {},
  poke: () => {},
};
globalThis.getMyUserId = () => 'u_test';

const D = t => 'data:image/png;base64,' + t + 'A'.repeat(200);
const OLD = { skin: 1, top: '#111111', bot: '#222222', face: D('OLD'), blink: D('OLDB') };
const NEW = { skin: 3, top: '#ff0000', bot: '#00ff00', face: D('NEW'), blink: D('NEWB') };
const defSends = () => sent.filter(s => s.how === 'update' && s.payload && s.payload.def);

(async () => {
  say('=== 🎨 방에서 런처로 캐릭터를 고치고 돌아오면 방에도 간다 ===');
  say('');

  /* ── 1. Firebase 방 ── */
  say('· Firebase 방 — 1번 칸으로 입장한 뒤 런처를 오간다');
  P.slots.fill(null);
  P.slots[0] = OLD;
  P.setCurSlot(0);
  P.launchApp({ mode: 'run' });
  sent = [];
  await P.Presence.start('TESTROOM', P.slots[0], '나', () => {});
  chk(sent.length && sent[0].how === 'join', '입장 — joinRoom 으로 갔다');
  chk(P.Presence.myDef() === OLD, 'Presence.myDef 는 입장 때 보낸 def 다');

  sent = [];
  P.launchApp({ mode: 'run' });
  await tick();
  chk(defSends().length === 0, '런처만 다녀온 왕복 — def 를 다시 보내지 않는다(다운로드 0)');

  P.slots[0] = Object.assign({}, NEW);   // 생성기 kind:'slot' [완료] — slots[target]=def(새 객체)
  sent = [];
  P.launchApp({ mode: 'run' });
  await tick();
  const ds = defSends();
  chk(ds.length === 1, '고친 뒤 돌아옴 — updateMe 에 def 가 한 번 실렸다 (' + ds.length + ')');
  const d = ds[0] && ds[0].payload.def;
  chk(d && d.skin === 3 && d.top === '#ff0000', '실린 def 가 새 디자인이다(피부 · 윗옷)');
  chk(d && typeof d.faceUrl === 'string' && d.faceUrl.indexOf('https://storage.test/face_') === 0, '얼굴은 Storage URL 로 실렸다');
  chk(d && d.face === undefined, '무거운 dataURL 은 빠졌다(캐릭터 교체와 같은 직렬화)');
  chk(P.Presence.myDef() === P.slots[0], 'Presence.myDef 가 새 def 로 바뀌었다');

  sent = [];
  P.launchApp({ mode: 'run' });
  await tick();
  chk(defSends().length === 0, '한 번 더 왕복 — 이미 보낸 def 라 다시 안 보낸다');

  await P.Presence.stop();
  P.slots[0] = Object.assign({}, OLD);
  sent = [];
  P.launchApp({ mode: 'run' });
  await tick();
  chk(sent.length === 0, '방 밖 — 아무것도 안 보낸다');
  say('');

  /* ── 2. 방 서버 방 — provider 만 바꿔 같은 길을 탄다 ── */
  say('· 방 서버 방 — 서버 provider 로 입장한 뒤 런처를 오간다');
  const upd = [];
  const fakeServer = {
    kind: 'server',
    join: () => Promise.resolve({ ok: true, memberId: 'mm1', others: 1, meta: null }),
    update: (p) => { upd.push(p); },
    poke: () => {}, pokeSelf: () => {}, leave: () => Promise.resolve(),
  };
  P.slots[0] = OLD;
  P.setCurSlot(0);
  P.launchApp({ mode: 'run' });
  await P.Presence.start('WORK-AB12', P.slots[0], '나', () => {}, { provider: fakeServer });
  chk(!!P.Presence.serverProvider(), '서버 provider 로 붙었다');
  P.launchApp({ mode: 'run' });
  await tick();
  chk(upd.filter(p => p.def).length === 0, '그냥 왕복 — def 안 보냄');
  P.slots[0] = Object.assign({}, NEW);
  P.launchApp({ mode: 'run' });
  await tick();
  const su = upd.filter(p => p.def);
  chk(su.length === 1 && su[0].def.skin === 3, '고친 뒤 돌아옴 — provider.update 에 새 def (서버가 저장 · 방 전원에게 def 로 보냄)');
  await P.Presence.stop();
  say('');

  /* ── 3. 줄 ── */
  say('· 줄');
  const la = SRC.slice(SRC.indexOf('function launchApp('), SRC.indexOf('function backToLauncher('));
  chk(/Presence\.myDef\(\)\s*!==\s*myDef\)\s*Presence\.updateDef\(myDef\)/.test(la), 'launchApp 이 방에 보낸 def 와 견주어 updateDef 를 부른다');
  chk(/myDef:\(\)=>myDef/.test(SRC), 'Presence 가 myDef() 를 내놓는다');
  const old = la.replace(/if\(Presence\.myDef\(\) !== myDef\) Presence\.updateDef\(myDef\);/, '');
  chk(!/Presence\.updateDef/.test(old), '옛 줄(보내는 줄을 뺀 판)이면 launchApp 에 updateDef 가 없다 — 위 검사가 빨강이 된다');

  say('');
  say(fail ? '✗ ' + fail + '개 실패' : '✓ 전부 통과');
  process.exit(fail ? 1 : 0);
})().catch(e => { say('✗ 예외: ' + (e && e.stack || e)); process.exit(1); });

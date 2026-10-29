/* ═══ 🔢 sim-room-code-len.js — 방 코드 입장은 4자리 본문만 (room/room-entry.js) ═══════════════
   [무엇을 지키나] 규칙 rooms/$room 이 XXXX-XXXX 모양만 받는다. 코드 칸에 1~3자(또는 5자)를 넣고 Enter 를 누르면
     예전엔 startRoom('WORK-AB') 로 가서 쓰기가 전부 조용히 거절된 채 «연결됐어요» 만 뜨는 빈 방에 들어갔다.
   ・1절: doJoinRoom · doJoinSecretRoom 을 떼어 실제로 돌린다 — 4자리 · 접두어 붙여넣기 · 별표 시크릿 · 빈 칸(랜덤)은 그대로,
          1~3자 · 5자는 안내만 하고 방에 안 간다
   ・2절: 일부러 깨 보기 — 길이 검사를 빼면 빨강
   [실행] node checks/run.js sim-room-code-len */
'use strict';
const fs = require('fs');
const path = require('path');
function findUp(name){
  const stack = ['.'];
  while(stack.length){
    const d = stack.shift();
    const f = path.join(d, name);
    if(fs.existsSync(f)) return f;
    for(const e of fs.readdirSync(d, { withFileTypes: true })) if(e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) stack.push(path.join(d, e.name));
  }
  return null;
}
const f = findUp('room-entry.js');
const MOD = f ? fs.readFileSync(f, 'utf8') : '';

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
function grabFn(src, head){
  const i = src.indexOf(head);
  if(i < 0) return null;
  let k = src.indexOf('{', i + head.length - 1), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  return null;
}
const grabLine = (src, head) => { const i = src.indexOf(head); return i < 0 ? null : src.slice(i, src.indexOf('\n', i)); };

/* 코드 칸에 v 를 넣고 입장 — 간 방(없으면 null) · 안내 · 랜덤 참여 횟수 */
async function join(src, fnName, v){
  const parts = [grabLine(src, 'const ROOM_CODE_BODY_RE ='), grabFn(src, 'async function doJoinRoom(codeInputEl){'), grabFn(src, 'function doJoinSecretRoom(codeInputEl){')];
  if(parts.some(p => !p)) throw new Error('room-entry.js 에서 ROOM_CODE_BODY_RE · doJoinRoom · doJoinSecretRoom 을 못 찾음');
  const out = { room: null, toasts: [], random: 0 };
  const fns = new Function('toast', 'startRoom', '_resolveRoomCode', 'doJoinRandomRoom', '_myRoomPrefix',
    'let _joiningRoom = false;\n' + parts.join('\n') + '\nreturn { doJoinRoom, doJoinSecretRoom };')(
    (m) => out.toasts.push(m), (code) => { out.room = code; }, (body, pre) => pre + body, async () => { out.random++; }, () => 'WORK-');
  await fns[fnName]({ value: v, dataset: {} });
  return out;
}
async function judge(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    const ok4 = await join(src, 'doJoinRoom', 'ab2c');
    t(ok4.room === 'WORK-AB2C' && !ok4.toasts.length, '4자리 — 그 방으로');
    const pre = await join(src, 'doJoinRoom', 'PLAY-AB2C');
    t(pre.room === 'PLAY-AB2C', '  접두어까지 붙여 넣으면 그 방으로');
    const sec = await join(src, 'doJoinRoom', 'AB2C*');
    t(sec.room === 'SCRT-AB2C', '  별표 — 시크릿룸으로');
    const empty = await join(src, 'doJoinRoom', '  ');
    t(empty.random === 1 && empty.room === null, '  빈 칸 — 랜덤 참여(예전과 같음)');
    for(const v of ['A', 'AB', 'AB2', 'AB2CD']){
      const o = await join(src, 'doJoinRoom', v);
      t(o.room === null && o.toasts.join() === '방 코드는 4자리예요', '★ «' + v + '» — 방에 안 가고 «방 코드는 4자리예요»');
    }
    const shortSec = await join(src, 'doJoinRoom', 'AB*');
    t(shortSec.room === null && shortSec.toasts.length === 1, '★ 짧은 코드 + 별표 — 시크릿룸으로도 안 간다');
    const s4 = await join(src, 'doJoinSecretRoom', 'ab2c');
    const s3 = await join(src, 'doJoinSecretRoom', 'ab2');
    t(s4.room === 'SCRT-AB2C' && s3.room === null && s3.toasts.join() === '시크릿룸 코드는 4자리예요', '  시크릿룸 칸 — 4자리만(같은 규칙)');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 100)); }
  return r;
}

(async () => {
  say('── 1. 코드 칸에 넣어 본다');
  (await judge(MOD)).forEach(([ok, msg]) => chk(ok, msg));
  say('── 2. 일부러 깨 보기');
  const breaks = [
    ['일반 칸 길이 검사 없음', "  if(!ROOM_CODE_BODY_RE.test(c)){ toast('방 코드는 4자리예요'); return; }\n", ''],
    ['본문 규칙이 4자리가 아님', 'const ROOM_CODE_BODY_RE = /^[A-Z0-9]{4}$/;', 'const ROOM_CODE_BODY_RE = /^[A-Z0-9]{1,5}$/;'],
  ];
  for(const [name, a, b] of breaks){
    const m2 = MOD.replace(a, b);
    const rows = m2 !== MOD ? await judge(m2) : [];
    chk(m2 !== MOD && rows.some(([ok]) => !ok), name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

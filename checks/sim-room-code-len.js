/* ═══ 🔢 sim-room-code-len.js — 방 코드 입장은 4자리 본문만 (room/room-entry.js) ═══════════════
   [무엇을 지키나] 규칙 rooms/$room 이 XXXX-XXXX 모양만 받는다. 코드 칸에 1~3자(또는 5자)를 넣고 Enter 를 누르면
     예전엔 startRoom('WORK-AB') 로 가서 쓰기가 전부 조용히 거절된 채 «연결됐어요» 만 뜨는 빈 방에 들어갔다.
   ・1절: doJoinRoom · doJoinSecretRoom 을 떼어 실제로 돌린다 — 4자리 · 접두어 붙여넣기 · 별표 시크릿 · 빈 칸(랜덤)은 그대로,
          1~3자 · 5자는 안내만 하고 방에 안 간다 · 로비 모달 칸(randomOnEmpty: false)은 빈 칸이면 안내만(랜덤은 [빠른시작])
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
async function join(src, fnName, v, opts){
  const parts = [grabLine(src, 'const ROOM_CODE_BODY_RE ='), grabFn(src, 'async function doJoinRoom(codeInputEl, opts){'), grabFn(src, 'function doJoinSecretRoom(codeInputEl){')];
  if(parts.some(p => !p)) throw new Error('room-entry.js 에서 ROOM_CODE_BODY_RE · doJoinRoom · doJoinSecretRoom 을 못 찾음');
  const out = { room: null, toasts: [], random: 0 };
  const fns = new Function('toast', 'startRoom', '_resolveRoomCode', 'doJoinRandomRoom', '_myRoomPrefix',
    'let _joiningRoom = false;\n' + parts.join('\n') + '\nreturn { doJoinRoom, doJoinSecretRoom };')(
    (m) => out.toasts.push(m), (code) => { out.room = code; }, async (body, pre) => pre + body, async () => { out.random++; }, () => 'WORK-');
  await fns[fnName]({ value: v, dataset: {} }, opts);
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
    t(empty.random === 1 && empty.room === null, '  빈 칸 — 랜덤 참여(예전과 같음 · F1 멀티모드 탭)');
    const lobbyEmpty = await join(src, 'doJoinRoom', '  ', { randomOnEmpty: false });
    t(lobbyEmpty.random === 0 && lobbyEmpty.room === null && lobbyEmpty.toasts.join() === '방 코드를 입력하세요', '★ 로비 모달 칸 · 빈 칸 — 랜덤 참여 안 하고 «방 코드를 입력하세요»');
    const lobby4 = await join(src, 'doJoinRoom', 'ab2c', { randomOnEmpty: false });
    t(lobby4.room === 'WORK-AB2C', '  로비 모달 칸 · 4자리 — 그 방으로(코드 입장은 같다)');
    const lobbyShort = await join(src, 'doJoinRoom', 'AB', { randomOnEmpty: false });
    t(lobbyShort.room === null && lobbyShort.toasts.join() === '방 코드는 4자리예요', '  로비 모달 칸 · 2자 — 같은 길이 안내');
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
  say('── 1-2. 로비 모달 칸 연결');
  const H = (() => { const h = findUp('desk-companion-prototype.html'); return h ? fs.readFileSync(h, 'utf8') : ''; })();
  const wire = (src, html) => {
    const foot = (html.match(/<div class="lb-foot">([\s\S]*?)\n        <\/div>/) || [])[1] || '';
    return [
      [/const INVITE_JOIN_OPTS = \{ randomOnEmpty: false \};/.test(src), 'room-entry — 로비 모달 칸 설정이 한 곳(randomOnEmpty: false)'],
      [/getElementById\('inviteJoin'\)\.onclick=\(\)=>doJoinRoom\(document\.getElementById\('inviteCode'\), INVITE_JOIN_OPTS\)/.test(src), '  [입장] 단추가 그 설정으로'],
      [/_setupRoomCodeInput\(document\.getElementById\('inviteCode'\), INVITE_JOIN_OPTS\)/.test(src) && /doJoinRoom\(inputEl, joinOpts\)/.test(src), '  Enter 도 같은 설정으로'],
      [/_setupRoomCodeInput\(document\.getElementById\('fsInviteCode'\)\);/.test(src), '  F1 멀티모드 탭 칸은 그대로(빈 칸 = 랜덤)'],
      [/id="inviteCode"/.test(foot) && /id="inviteJoin"/.test(foot) && (html.match(/id="inviteCode"/g) || []).length === 1, 'html — 코드 칸 · [입장] 은 로비 아래 줄(.lb-foot) 안에 한 벌'],
      [!/id="donateLink"/.test(html) && !/id="inviteJoinPanel"/.test(html) && !/donateLink/.test(src), '  후원 링크 · 옛 코드 칸 묶음(inviteJoinPanel)은 없다'],
    ];
  };
  wire(MOD, H).forEach(([ok, msg]) => chk(ok, msg));
  say('── 2. 일부러 깨 보기');
  const breaks = [
    ['일반 칸 길이 검사 없음', "  if(!ROOM_CODE_BODY_RE.test(c)){ toast('방 코드는 4자리예요'); return; }\n", ''],
    ['로비 모달 칸도 빈 칸이면 랜덤 참여', "if(!c && !(opts && opts.randomOnEmpty === false))", 'if(!c)'],
    ['본문 규칙이 4자리가 아님', 'const ROOM_CODE_BODY_RE = /^[A-Z0-9]{4}$/;', 'const ROOM_CODE_BODY_RE = /^[A-Z0-9]{1,5}$/;'],
  ];
  for(const [name, a, b] of breaks){
    const m2 = MOD.replace(a, b);
    const rows = m2 !== MOD ? await judge(m2) : [];
    chk(m2 !== MOD && rows.some(([ok]) => !ok), name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
  }
  const wb = [
    ['[입장] 단추가 설정을 안 넘김', MOD.replace("doJoinRoom(document.getElementById('inviteCode'), INVITE_JOIN_OPTS)", "doJoinRoom(document.getElementById('inviteCode'))"), H],
    ['Enter 가 설정을 안 넘김', MOD.replace('doJoinRoom(inputEl, joinOpts)', 'doJoinRoom(inputEl)'), H],
    ['후원 링크가 남음', MOD, H.replace('<div class="lb-foot">', '<a id="donateLink"></a><div class="lb-foot">')],
  ];
  for(const [name, m2, h2] of wb){
    const changed = m2 !== MOD || h2 !== H;
    chk(changed && wire(m2, h2).some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

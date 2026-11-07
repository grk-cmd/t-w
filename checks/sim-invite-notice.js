/* sim-invite-notice.js — 🙋 마지막으로 받은 방 초대 한 줄(parts/room/invite-notice.js)
   ・1절: 저장본 규칙 — 계정마다 · 모양 거르기(방 코드 · 이름 길이 · 받은 시각) · 같은 초대 · 알림콩(창 연 시각 뒤)
   ・2절: note — 한 줄만(덮어씀) · 같은 초대는 그대로(받은 시각 안 바뀜 · onChange 안 부름) · 보낸 쪽 시계가 틀려도 새 초대로 바뀜 · 다른 계정 · 저장 실패 · clear · 깨 보기
   ・3절: 배선 — html 이 app.js 보다 먼저 싣는다 · app.js 가 스케줄러보다 먼저 만든다 · 계정 전환 지움 목록 · smoke PRELOAD
   [실행] node checks/run.js invite-notice */
'use strict';
const fs = require('fs');
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('invite-notice.js'), HTML = read('desk-companion-prototype.html'), APP0 = read('app.js'), ACC = read('account.js'), SMOKE = read('smoke.js');
if (!MOD || !HTML || !APP0 || !ACC || !SMOKE) { say('  ? 원본 못 찾음 — invite-notice.js · desk-companion-prototype.html · app.js · account.js · smoke.js'); process.exit(2); }
const APP = _joinRenderer(APP0);
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwInviteNotice; };
const N = load(MOD);

say('── 1. 저장본 규칙');
const w1 = N.write('f1', { fromName: '  나비  ', roomCode: 'PLAY-AB12', ts: 500 }, 'me', 1000);
const r1 = N.read(w1, 'me');
chk(!!r1 && r1.fromId === 'f1' && r1.fromName === '나비' && r1.roomCode === 'PLAY-AB12' && r1.sentTs === 500 && r1.at === 1000, '쓰고 읽으면 같다(이름 앞뒤 빈칸은 걷는다)');
chk(N.read(w1, 'other') === null && N.read(w1, '') === null, '★ 다른 계정 · 계정 모름이면 없음 — 앞 사람 초대가 안 보인다');
chk(N.write('f1', { roomCode: 'nope', ts: 1 }, 'me', 1) === null && N.write('', { roomCode: 'PLAY-AB12' }, 'me', 1) === null && N.write('f1', { roomCode: 'PLAY-AB12' }, 'me', 0) === null,
  '  방 코드 모양이 틀리거나 · 보낸 사람이 없거나 · 받은 시각이 없으면 쓰지 않는다');
chk(N.read('{깨짐', 'me') === null && N.read(null, 'me') === null && N.read('[]', 'me') === null, '  깨진 저장본 · 없음 → 없음(던지지 않음)');
chk(N.read(N.write('f1', { fromName: '가'.repeat(99), roomCode: 'work-ab12' }, 'me', 1), 'me').fromName.length === N.NAME_MAX
  && N.read(N.write('f1', { roomCode: 'work-ab12' }, 'me', 1), 'me').roomCode === 'WORK-AB12' && N.read(N.write('f1', { roomCode: 'PLAY-AB12' }, 'me', 1), 'me').fromName === '친구',
  '  이름은 ' + N.NAME_MAX + '자까지 · 없으면 «친구» · 방 코드는 대문자로');
chk(N.same(r1, 'f1', { ts: 500 }) && !N.same(r1, 'f1', { ts: 501 }) && !N.same(r1, 'f2', { ts: 500 }) && !N.same(null, 'f1', { ts: 500 }), '같은 초대 = 보낸 사람 · 보낸 시각이 같음');
chk(N.isNew(r1, 999) && !N.isNew(r1, 1000) && N.isNew(r1, 0) && !N.isNew(null, 0), '알림콩 = 일정 알림 창을 마지막으로 연 뒤에 받음');

say('── 2. note · clear');
const mk = (src, opt) => {
  opt = opt || {};
  const st = { map: new Map(), changes: 0, t: 100, uid: 'me' };
  const storage = { getItem: (k) => st.map.has(k) ? st.map.get(k) : null, setItem: (k, v) => { if (opt.failSet) throw new Error('quota'); st.map.set(k, v); }, removeItem: (k) => st.map.delete(k) };
  st.n = load(src).createInviteNotice({ storage, getMyUserId: () => st.uid, now: () => st.t, onChange: () => { st.changes++; } });
  return st;
};
const run = (src) => {
  const S = mk(src);
  const r = {};
  r.first = S.n.note('f1', { fromName: '나비', roomCode: 'PLAY-AB12', ts: 500 }) === true && S.changes === 1 && S.n.get().fromId === 'f1' && S.n.get().at === 100;
  S.t = 200;
  r.same = S.n.note('f1', { fromName: '나비', roomCode: 'PLAY-AB12', ts: 500 }) === false && S.changes === 1 && S.n.get().at === 100;
  S.t = 300;
  r.replace = S.n.note('f2', { fromName: '토끼', roomCode: 'WORK-CD34', ts: 600 }) === true && S.n.get().fromId === 'f2' && S.n.get().at === 300 && S.map.size === 1;
  S.t = 350;
  r.skew = S.n.note('f3', { fromName: '곰', roomCode: 'PLAY-GH78', ts: 1 }) === true && S.n.get().fromId === 'f3' && S.n.get().at === 350;
  r.isNew = S.n.isNew(300) && !S.n.isNew(350);
  S.uid = 'other';
  r.other = S.n.get() === null && S.n.isNew(0) === false;
  S.uid = '';
  r.noUid = S.n.note('f3', { roomCode: 'PLAY-EF56', ts: 700 }) === false;
  S.uid = 'me';
  S.n.clear();
  r.clear = S.n.get() === null && S.changes === 4;
  return r;
};
const R = run(MOD);
chk(R.first, '첫 초대 → 한 줄 · 받은 시각은 이 PC 시계 · onChange');
chk(R.same, '★ 같은 초대가 다시 와도(구독이 다시 불림) 받은 시각을 안 바꾼다 — 알림콩이 되살아나지 않게');
chk(R.replace, '★ 새 초대가 오면 그 줄을 덮는다(쌓지 않는다 — 저장 칸 하나)');
chk(R.skew, '★ 보낸 쪽 시계가 틀려(보낸 시각이 더 이르게 찍혀도) 새로 온 초대면 줄이 바뀐다 — 시계가 틀린 친구 하나가 줄을 묶어 두지 않게');
chk(R.isNew, '  알림콩은 창을 연 시각과 견준다');
chk(R.other && R.noUid, '  다른 계정에는 안 보이고 · 계정 모르면 적지 않는다');
chk(R.clear, '  clear 로 지운다');
{ const S = mk(MOD, { failSet: true }); chk(S.n.note('f1', { roomCode: 'PLAY-AB12', ts: 1 }) === false && S.changes === 0, '  저장이 실패하면 false · onChange 안 부름(던지지 않음)'); }
const B1 = run(MOD.replace("    if(same(get(), fromId, inv)) return false;\n", ''));
chk(!B1.same, '깨 보기 — 같은 초대 거르기를 빼면 받은 시각이 바뀌어 빨강');
const B2 = run(MOD.replace('if(!v || typeof v !== \'object\' || v.owner !== owner) return null;', 'if(!v || typeof v !== \'object\') return null;'));
chk(!B2.other, '깨 보기 — 주인 코드를 안 보면 다른 계정에 보여 빨강');

say('── 3. 배선');
const order = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
chk(order.indexOf('room/invite-notice.js') >= 0 && order.indexOf('room/invite-notice.js') < order.indexOf('app.js'), 'html — app.js 보다 먼저 싣는다');
const iN = APP.indexOf('TwInviteNotice.createInviteNotice('), iS = APP.indexOf('MhScheduler.createScheduler(');
chk(iN > 0 && iN < iS && /roomInvite: inviteNotice,/.test(APP) && /inviteNotice: inviteNotice,/.test(APP), 'app.js — 스케줄러보다 먼저 만들고 스케줄러 · 초대 받기에 같은 것을 넘긴다');
chk(/'tw\.roomInviteLast',/.test(ACC) && N.KEY === 'tw.roomInviteLast', '계정을 바꾸면 지운다(ACCOUNT_LOCAL_KEYS)');
chk(/PRELOAD\.push\('invite-notice\.js'\)/.test(SMOKE), 'smoke 가 진짜로 싣는다');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

/* ═══ 🚧 sim-rules-src.js — 규칙 글에서 «≤0.10.2 앱 읽기 막기» 조건을 걷어 내는 검사용 도우미 (개정 375 신설) ═══════════════
   [왜] 0.10.2 이하 앱은 아무것도 못 하게 — 앱이 읽는 모든 .read 에 같은 조건(READ_GATE)을 붙였다. 예전 검사들은 «.read === true»
     · «쿼리 조건 || 봇» 같은 글을 그대로 맞춰 본다. 판정은 그대로 두고 읽는 글만 «조건을 붙이기 전» 모양으로 돌려주면 옛 검사가 같은 뜻으로 돈다.
   [쓰는 법] const { stripReadGate } = require('./sim-rules-src.js');  const RULES = stripReadGate(fs.readFileSync('firebase-database-rules.json', 'utf8'));
     · 조건 하나만 있던 자리("조건") → true · 다른 조건 뒤에 붙은 자리(« && 조건») → 걷음. 붙일 때 «걷으면 예전 글과 같도록» 붙였다.
   [조건] 읽는 사람 로그인(auth.uid) → authUsers/{authUid}.userCode → 그 코드의 presence 가 «켜짐(online:true) · ver 없음»(= 0.10.2 이하 앱이 켜져 있음)이면 거절.
     로그인 안 함 · 이어진 코드 없음(가입 중 익명 · 봇)은 막지 않는다. 실제 판정은 에뮬레이터(scripts/rules-emu-check.js)가 본다.
   [직접 실행] 조건이 빠진 열린 읽기가 없는지 · 걷은 글이 JSON 인지 · 관리자 · 봇 · 폰 연결 읽기에는 안 붙었는지 · 깨 보기. */
'use strict';
const fs = require('fs');

const CODE = "root.child('authUsers/'+auth.uid+'/userCode').val()";
const READ_GATE = "(auth == null || !root.child('authUsers/'+auth.uid+'/userCode').exists() || root.child('users/'+" + CODE + "+'/presence/ver').exists() || root.child('users/'+" + CODE + "+'/presence/online').val() !== true)";

function stripReadGate(text){
  if(typeof text !== 'string') return text;
  return text.split('"' + READ_GATE + '"').join('true').split(' && ' + READ_GATE).join('');
}

module.exports = { READ_GATE, stripReadGate };

if(require.main === module){
  let fail = 0;
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if(!c) fail++; };
  const P = ['firebase-database-rules.json', '../firebase-database-rules.json'].find(p => fs.existsSync(p));
  if(!P){ console.log('  ? 원본 못 찾음 — firebase-database-rules.json'); process.exit(2); }
  const RAW = fs.readFileSync(P, 'utf8');

  /* 읽기 규칙을 전부 모은다 */
  const reads = (text) => { const out = []; (function w(n, p){ for(const k in n){ if(k === '.read') out.push([p, n[k]]); else if(n[k] && typeof n[k] === 'object' && !Array.isArray(n[k])) w(n[k], p + '/' + k); } })(JSON.parse(text).rules, ''); return out; };
  /* 조건 없이 둔 읽기 — 관리자 · 봇 전용, 폰 연결(링크 키로 지킨다), 아예 막힘, 로그인 때 내 authUsers 한 칸.
     내 authUsers 에 조건을 붙이면 presence 가 «켜짐 · ver 없음» 으로 남은 사람은 로그인(구글 · 친구 코드)이 늘 실패해
     새 앱이 presence 를 고쳐 쓸 기회가 없다 — 칸에는 내 userCode 하나뿐이고 옛 앱은 그다음 읽기에서 막힌다. */
  const SELF_AUTH_READ = 'auth != null && auth.uid === $authUid';
  /* 방 입장 최소 버전은 옛 앱도 읽어야 한다 — 0.10.2 는 이 값을 못 읽으면 «조회 실패는 통과» 로 방에 들어간다(막으면 문이 열린다).
     읽으면 옛 앱이 스스로 «업데이트해야 방 이용» 으로 멈춘다. 이 한 칸만 조건 없이 둔다. */
  const MIN_ROOM_VER = '/config/minRoomVer';
  const ADMIN_ONLY = /^(\(?auth != null && )?root\.child\('admins'\)\.child\(auth\.uid\)\.val\(\) === true\)?( \|\| \(auth != null && root\.child\('apiBots'\)\.child\(auth\.uid\)\.val\(\) === true\))?$/;
  const exempt = ([p, v]) => v === false || /^\/mobileLink\//.test(p) || /^\/mobileKeys\//.test(p) || ADMIN_ONLY.test(String(v))
    || String(v) === "(auth != null && root.child('apiBots').child(auth.uid).val() === true)"
    || (p === '/authUsers/$authUid' && String(v) === SELF_AUTH_READ)
    || (p === MIN_ROOM_VER && v === true);
  const judge = (text) => {
    const all = reads(text);
    const open = all.filter(r => !exempt(r) && String(r[1]).indexOf(READ_GATE) < 0);
    return { all, open, gated: all.filter(r => String(r[1]).indexOf(READ_GATE) >= 0) };
  };

  const J = judge(RAW);
  chk(J.open.length === 0, `★ 앱이 읽는 .read 에는 전부 옛 앱 막기 조건이 붙었다 (붙음 ${J.gated.length} · 관리자 · 봇 · 폰 연결 · 막힘 ${J.all.length - J.gated.length})` + (J.open.length ? ' — 빠짐: ' + J.open.map(r => r[0]).join(', ') : ''));
  const bareReads = (text) => reads(text).filter(([, v]) => v === true).map(([p]) => p);
  chk(bareReads(RAW).join() === MIN_ROOM_VER, '  ↳ 조건 없는 «.read: true» 는 방 입장 최소 버전 한 칸뿐');
  const minRoomVerOpen = (text) => JSON.parse(text).rules.config.minRoomVer['.read'] === true;
  chk(minRoomVerOpen(RAW), '★ 방 입장 최소 버전은 옛 앱도 읽는다 — 못 읽으면 0.10.2 는 «조회 실패는 통과» 로 방에 들어간다');
  chk(reads(RAW).filter(([p]) => /^\/mobileLink\//.test(p)).every(([, v]) => String(v).indexOf(READ_GATE) < 0), '  ↳ 폰 연결(mobileLink)은 안 막는다 — 로그인 없는 링크 페이지가 읽는다');
  const au = ((JSON.parse(RAW).rules.authUsers || {}).$authUid || {})['.read'];
  chk(au === SELF_AUTH_READ, '★ 로그인 때 내 authUsers 읽기는 막기 조건 없이 나만 — presence 가 남은 사람도 로그인해 presence 를 고쳐 쓴다');
  const S = stripReadGate(RAW);
  let ok = true; try{ JSON.parse(S); }catch(_){ ok = false; }
  chk(ok && S.indexOf(READ_GATE) < 0, '걷은 글은 JSON 이고 조건이 한 군데도 안 남는다(붙인 자리는 «"조건"» 아니면 « && 조건» 뿐)');
  chk(/^\(auth == null \|\| !root\.child\('authUsers\//.test(READ_GATE), '  ↳ 로그인 없음 · 이어진 코드 없음은 먼저 통과(0.11 의 로그인 없는 REST 읽기 · 가입 중 읽기)');
  const pres = (((JSON.parse(RAW).rules.users || {}).$userId || {}).presence || {}).online || {};
  chk(/newData\.val\(\) === true \|\| newData\.parent\(\)\.child\('ver'\)\.exists\(\) \|\| !newData\.parent\(\)\.child\('inRoom'\)\.exists\(\)/.test(String(pres['.validate'])),
    '★ presence — ver 없는 수동 오프라인(inRoom 실림)은 거절 · onDisconnect(inRoom 없음)는 받는다(옛 앱이 꺼짐으로 빠져나가지 못하게)');

  /* 깨 보기 — 조건 하나를 true 로 되돌리면 잡는가 */
  const broken = RAW.replace('"' + READ_GATE + '"', 'true');
  chk(broken !== RAW && judge(broken).open.length === 1, '깨 보기 — 조건 하나를 빼면 «빠짐» 으로 잡는다');
  /* 깨 보기 — 내 authUsers 를 남도 읽게 넓히면 «빠짐» 으로 잡는가 */
  const auOpen = RAW.replace('"' + SELF_AUTH_READ + '"', '"auth != null"');
  chk(auOpen !== RAW && judge(auOpen).open.some(r => r[0] === '/authUsers/$authUid'), '깨 보기 — 내 authUsers 를 «로그인만 하면 누구나» 로 넓히면 잡는다');
  /* 깨 보기 — 최소 버전에 다시 조건을 붙이면 잡는가 · 다른 칸을 true 로 열면 잡는가 */
  const mrv = JSON.parse(RAW); mrv.rules.config.minRoomVer['.read'] = READ_GATE;
  chk(!minRoomVerOpen(JSON.stringify(mrv)), '깨 보기 — 최소 버전에 조건을 다시 붙이면 «옛 앱도 읽는다» 가 빨강');
  chk(bareReads(broken).length === 2, '깨 보기 — 다른 칸을 «.read: true» 로 열면 «한 칸뿐» 이 빨강');
  console.log(fail ? `✗ 실패 ${fail}건` : '✓ 전부 통과');
  process.exit(fail ? 1 : 0);
}

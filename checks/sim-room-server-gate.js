/*
 * 방 서버 문지기 검사 — 0.13 «한 길만 돌려주는» 얇은 자리(room/room-server-gate.js): 늘 Firebase 방.
 * 1. 문지기 — 무엇을 물어도 Firebase · 내 서버 없음 · 서버를 쓸 수 없는 판 · 아무것도 읽지 않는다(설정 · 주소록 · 저장소)
 * 2. 규칙 — config/roomServer · roomDir(Firebase 쪽 · 옛 앱 · 옛 방 서버가 아직 읽는다)
 * 3. 연결 — firebase-init 이 deps 없이 만든다 · 원격 설정 · 받는 곳 고르기를 넘기지 않는다 · 옛 방 연결 주소(_rsUrl)는 문지기가 고를 때만
 * 4. 일부러 깨 보기
 */
'use strict';
const { stripReadGate } = require('./sim-rules-src.js');   // 옛 앱 읽기 막기 조건을 걷고 본다(개정 375)
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC0 = { GATE: read('room-server-gate.js'), FI: read('firebase-init.js'), RULES: stripReadGate(read('firebase-database-rules.json')) };
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ say('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const loadEsm = (src) => {
  const names = [...src.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map((m) => m[1]);
  return new Function(src.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')();
};

async function judge(S){
  let M = null;
  try{ M = loadEsm(S.GATE); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  const RULES = S.RULES, FI = S.FI;

  say('── 1. 문지기 — 늘 Firebase 방');
  {
    chk(typeof M.createRoomServerGate === 'function', 'createRoomServerGate 를 내놓는다(firebase-init 이 import)');
    const touched = [];
    const spy = new Proxy({}, { get: (_, k) => { touched.push(String(k)); return () => { throw new Error('부르면 안 됨'); }; } });
    const g = M.createRoomServerGate(spy);
    const r1 = await g.resolveRoomServer('PLAY-ABCD', { creating: false });
    const r2 = await g.resolveRoomServer(null, { creating: true });
    const r3 = await g.resolveRoomServer('SCRT-1234');
    chk([r1, r2, r3].every((r) => r && r.via === 'firebase' && r.why === 'off'), '★ 들어가기 · 만들기 · 어떤 코드든 { via:firebase, why:off }(옛 판의 «꺼짐» 과 같은 모양)');
    chk((await g.refreshMine()) === null && g.mine() === null && (await g.serverUrl('main')) === null && g.serverPossible() === false, '  ↳ 내 서버 없음 · 주소 없음 · 서버를 쓸 수 없는 판(방 개수 · 랜덤 · 같이 듣기 칸은 Firebase 몫)');
    chk(!touched.length, '  ↳ 아무것도 읽지 않는다(deps 를 건드리지 않음 — 설정 · 주소록 · 저장소)');
    chk(!/^\s*import\s/m.test(S.GATE) && !/fetch\(|getDatabase|localStorage|TwRemoteConfig|TwSourceSwitch/.test(strip(S.GATE)), '  ↳ import · fetch · 저장소 · 원격 설정 · 받는 곳 고르기 없음');
  }

  say('── 2. 규칙(Firebase 쪽 — 규칙을 걷는 묶음이 같이 걷는다)');
  {
    const R = JSON.parse(RULES).rules;
    const cfg = R.config || {};
    const isAdmin = (v) => typeof v === 'string' && /admins.*auth\.uid/.test(v);
    chk(cfg['.read'] === "(auth != null && root.child('admins').child(auth.uid).val() === true) || (auth != null && root.child('apiBots').child(auth.uid).val() === true)",
      'config 통째 읽기는 관리자 · 서버 봇(apiBots — API 읽기 사본)만(허용 목록이 사람에게 통째로 새지 않게)');
    chk(cfg.minRoomVer && cfg.minRoomVer['.read'] === true && isAdmin(cfg.minRoomVer['.write']), '  ↳ minRoomVer 는 그대로 누구나 읽기 · 관리자 쓰기(옛 앱 버전 게이트)');
    const rs = cfg.roomServer || {};
    chk(isAdmin(rs['.write']) && /auth != null/.test(rs['.write']), 'config/roomServer 쓰기는 관리자만');
    chk(rs.on && rs.on['.read'] === true && /isBoolean/.test(rs.on['.validate']) && rs.follow && rs.follow['.read'] === true && /isBoolean/.test(rs.follow['.validate']), '  ↳ on · follow — 누구나 읽기 · 참/거짓');
    chk(rs.registerIndex && rs.registerIndex['.read'] === true && rs.registerIndex['.validate'] === 'newData.isBoolean()' && !('.write' in rs.registerIndex),
      '  ↳ registerIndex(방 서버가 roomIndex 장부에 올릴지 · 없으면 false) — 누구나 읽기 · 참/거짓 · 쓰기는 roomServer 의 관리자만');
    chk(!rs['.read'] && !(rs.allow || {})['.read'] && !(rs.servers || {})['.read'], '  ↳ roomServer · allow · servers 목록 읽기는 열지 않는다');
    const al = (rs.allow || {}).$userId || {}, sv = (rs.servers || {}).$name || {};
    chk(al['.read'] === true && /\$userId\.matches/.test(al['.validate']) && /newData\.isString\(\)/.test(al['.validate']) && al['.validate'].includes('[a-z0-9][a-z0-9-]{0,31}'),
      '  ↳ allow/{코드} 한 칸 읽기 · 값은 서버 이름 형식');
    chk(sv['.read'] === true && sv['.validate'].includes('wss?:') && /length <= 200/.test(sv['.validate']), '  ↳ servers/{이름} 한 칸 읽기 · 값은 ws(s):// 주소');
    const lm = rs.limits || {};
    const intRange = (v) => typeof v === 'string' && /newData\.isNumber\(\)/.test(v) && v.includes('% 1 === 0') && v.includes('>= 1') && v.includes('<= 100000');
    chk(lm['.read'] === true && !lm['.write'] && intRange((lm.workingroom || {})['.validate']) && intRange((lm.togetherroom || {})['.validate']),
      '  ↳ limits(방 개수 상한) — 누구나 읽기(키 없는 방 서버) · 쓰기는 roomServer 관리자 · 채널마다 정수 1~100000');
    chk(lm.$other && lm.$other['.validate'] === false && !(lm.workingroom || {})['.read'], '  ↳ limits 의 모르는 칸은 거절');
    const df = rs.default || {}, dp = rs.defaultPercent || {};
    chk(df['.read'] === true && !df['.write'] && /newData\.isString\(\)/.test(df['.validate'] || '') && (df['.validate'] || '').includes('[a-z0-9][a-z0-9-]{0,31}'),
      '  ↳ default(기본 서버) — 누구나 한 칸 읽기 · 쓰기는 roomServer 관리자 · 값은 서버 이름 형식(32자까지)');
    const pv = dp['.validate'] || '';
    chk(dp['.read'] === true && !dp['.write'] && /newData\.isNumber\(\)/.test(pv) && pv.includes('% 1 === 0') && pv.includes('>= 0') && pv.includes('<= 100') && !pv.includes('<= 1000'),
      '  ↳ defaultPercent — 누구나 한 칸 읽기 · 정수 0~100');
    const tm = rs.timing || {};
    const runV = (expr, val) => Function('newData', 'return (' + expr + ');')({ isNumber: () => typeof val === 'number', val: () => val });
    const TR = { graceMs: [0, 600000], pingIntervalMs: [1000, 120000], restoreWindowMs: [0, 1800000], refreshMs: [5000, 600000], roomStatsRefreshMs: [5000, 600000], statsLogMs: [5000, 3600000], joinWaitMs: [3000, 60000], clientGiveUpMs: [15000, 600000] };   // t-w-server api roomServerTiming 범위와 같다(joinWaitMs · clientGiveUpMs 는 앱이 읽는다 — remote-config.js TIMING_RANGES)
    chk(tm['.read'] === true && !tm['.write'] && Object.keys(TR).every((k) => { const v = (tm[k] || {})['.validate'] || ''; const [lo, hi] = TR[k];
      return runV(v, lo) && runV(v, hi) && !runV(v, lo - 1) && !runV(v, hi + 1) && !runV(v, lo + 0.5) && !runV(v, String(lo)); }) && tm.$other && tm.$other['.validate'] === false,
      '  ↳ timing(방 서버 연결 시간값) — 누구나 읽기 · 쓰기는 roomServer 관리자 · graceMs 0~600000 · pingIntervalMs 1000~120000 · restoreWindowMs 0~1800000 · refreshMs 5000~600000 · roomStatsRefreshMs 5000~600000 · statsLogMs 5000~3600000 · 앱 joinWaitMs 3000~60000 · clientGiveUpMs 15000~600000 정수(서버와 같음) · 모르는 칸 거절');
    const fr = rs.frame || {};
    const FR = { maxBytes: [65536, 1048576], maxSmallBytes: [1024, 65536] };   // t-w-server realtime roomServerFrame 범위와 같다
    chk(fr['.read'] === true && !fr['.write'] && Object.keys(FR).every((k) => { const v = (fr[k] || {})['.validate'] || ''; const [lo, hi] = FR[k];
      return runV(v, lo) && runV(v, hi) && !runV(v, lo - 1) && !runV(v, hi + 1) && !runV(v, lo + 0.5) && !runV(v, String(lo)); }) && fr.$other && fr.$other['.validate'] === false,
      '  ↳ frame(방 서버 프레임 상한) — 누구나 읽기 · 쓰기는 roomServer 관리자 · maxBytes 65536~1048576 · maxSmallBytes 1024~65536 정수 · 모르는 칸 거절');
    chk(rs.$other && rs.$other['.validate'] === false, '  ↳ 모르는 칸은 거절');
    const rd = R.roomDir || {};
    chk(!rd['.read'] && rd.$code && rd.$code['.read'] === true && rd.$code['.write'] === false, 'roomDir — 방 코드 한 칸만 누구나 읽기 · 앱은 못 씀(방 서버가 관리자 키로)');
    chk(JSON.stringify(rd['.indexOn']) === '["srv"]', '  ↳ srv 색인(서버가 시작할 때 자기 몫을 찾는다)');
  }

  say('── 3. 연결');
  {
    const FC = strip(FI);
    chk(/import \{ createRoomServerGate \} from "\.\/room\/room-server-gate\.js";/.test(FC) && /const _roomServerGate = createRoomServerGate\(\);/.test(FC), 'firebase-init — deps 없이 만든다(원격 설정 · 받는 곳 고르기 · 주소록 읽기를 넘기지 않는다)');
    chk(/if\(r\.via === 'server'\) _rsUrl = r\.url;/.test(FC) && /let _rsUrl = null;/.test(FC), '  ↳ 옛 방 연결 주소(_rsUrl)는 문지기가 서버를 고를 때만 — 늘 Firebase 라 null 그대로');
    chk(!/roomServer\(\)|serverAddr\(|myServer\(|roomDir/.test(FC.slice(FC.indexOf('const _roomServerGate'), FC.indexOf('createRoomServerNet('))), '  ↳ 문지기 근처에 원격 설정 방 서버 칸 · 주소록 읽기가 없다');
  }
}

(async () => {
await judge(SRC0);

say('── 4. 일부러 깨 보기');
const BREAKS = [
  ['GATE', "    resolveRoomServer: async () => ({ via: 'firebase', why: 'off' }),", "    resolveRoomServer: async () => ({ via: 'server', url: 'wss://realtime.together-working.com', server: 'main', from: 'allow' }),", '방을 pv 1 방 서버로 보냄(0.13 서버가 받지 않음)'],
  ['GATE', "    serverPossible: () => false,", "    serverPossible: () => true,", '서버를 쓸 수 있는 판이라 함(방 개수 · 랜덤이 서버를 물음)'],
  ['GATE', "    mine: () => null,", "    mine: () => ({ name: 'main', url: 'wss://x' }),", '내 서버가 있다고 함'],
  ['FI', "  const _roomServerGate = createRoomServerGate();", "  const _roomServerGate = createRoomServerGate({ getConfig: () => _rc.roomServer() });", '원격 설정을 다시 넘김'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ await judge(S); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

say(fail ? `\n✗ 실패 ${fail}건` : `\n전부 통과 ✅ (${pass}건)`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

/*
 * 운영 원격 설정 규칙 검사 — 서버(t-w-server)가 새로 읽는 config 칸을 규칙식을 실제로 굴려 본다.
 *   쓰는 곳은 웹 관리자 ⚙️ 설정, 읽는 곳은 API(봇 계정) · 방 서버(키 없이 공개 읽기). 앱은 읽지 않는다.
 * 1. config/apiCors — 출처 목록(0..19 키 · https://호스트만) · 관리자 쓰기 · 읽기는 관리자 · 봇만
 * 2. config/apiCache/{config,count,card,leaderboard} — 정수 0~600 · 관리자 쓰기 · 봇 읽기
 * 3. config/logLevel/{api,realtime} — error|warn|info|debug · realtime 만 공개 읽기
 * 4. config/roomServer/frame — maxBytes 65536~1048576 · maxSmallBytes 1024~65536 · 공개 읽기
 * 5. config/roomServer/timing — roomStatsRefreshMs 5000~600000 · statsLogMs 5000~3600000 · 옛 칸 그대로 · 공개 읽기
 * 6. 앱은 이 칸을 읽지도 쓰지도 않는다(서버 전용)
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (...names) => { for(const n of names){ const s = read(n); if(s != null) return s; } say('  ? 원본 못 찾음 — ' + names[0]); process.exit(2); };
const RULES = JSON.parse(need('firebase-database-rules.json')).rules;
const APP = need('app.js', 'app/parts/app.js'), FI = need('firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js');

/* ── 작은 규칙 실행기 — 경로를 따라 내려가며 .read/.write 는 하나라도 참이면 허용, .validate 는 전부 참이어야.
   기존 데이터는 비어 있다고 본다. 삭제(null)에는 .validate 가 안 돈다. .matches 는 JS 에 없어 잠깐 붙인다. */
const ADMIN = 'adm1', BOT = 'bot1', USER = 'user9';
const snap = (val) => ({
  exists: () => val !== null && val !== undefined,
  val: () => val,
  isNumber: () => typeof val === 'number',
  isString: () => typeof val === 'string',
  isBoolean: () => typeof val === 'boolean',
  hasChildren: (ks) => !!val && typeof val === 'object' && (ks ? ks.every((k) => val[k] !== undefined) : Object.keys(val).length > 0),
  child: (k) => snap(val && typeof val === 'object' && val[k] !== undefined ? val[k] : null),
});
const ROOT = snap({ admins: { [ADMIN]: true }, apiBots: { [BOT]: true } });
function run(expr, ctx){
  if(typeof expr !== 'string') return expr === true;
  const names = Object.keys(ctx.vars || {});
  String.prototype.matches = function(re){ return re.test(String(this)); };   // eslint-disable-line no-extend-native
  try{
    return !!new Function('newData', 'data', 'now', 'auth', 'root', ...names, 'return (' + expr + ');')(
      snap(ctx.newVal), snap(null), Date.now(), ctx.uid ? { uid: ctx.uid } : null, ROOT, ...names.map((n) => ctx.vars[n]));
  }catch(_){ return false; }
  finally{ delete String.prototype.matches; }
}
const childRule = (node, key) => {
  if(!node) return { node: null };
  if(Object.prototype.hasOwnProperty.call(node, key)) return { node: node[key] };
  const w = Object.keys(node).find((k) => k[0] === '$');
  return w ? { node: node[w], wild: w } : { node: null };
};
function walk(path){
  const segs = path.split('/');
  const steps = [{ node: RULES, vars: {}, rest: segs }];
  let node = RULES; const vars = {};
  segs.forEach((s, i) => {
    const c = childRule(node, s);
    if(c.wild) vars[c.wild] = s;
    node = c.node;
    steps.push({ node, vars: { ...vars }, rest: segs.slice(i + 1) });
  });
  return steps;
}
const wrap = (rest, val) => rest.reduceRight((v, k) => ({ [k]: v }), val);
function canRead(path, uid){ return walk(path).some((s) => s.node && run(s.node['.read'], { uid, vars: s.vars })); }
function validDown(node, val, vars, uid){
  if(!node) return true;
  if(!run(node['.validate'] === undefined ? true : node['.validate'], { uid, vars, newVal: val })) return false;
  if(!val || typeof val !== 'object') return true;
  return Object.keys(val).every((k) => {
    const c = childRule(node, k);
    return validDown(c.node, val[k], c.wild ? { ...vars, [c.wild]: k } : vars, uid);
  });
}
function canWrite(path, val, uid){
  const steps = walk(path);
  if(!steps.some((s) => s.node && run(s.node['.write'], { uid, vars: s.vars, newVal: wrap(s.rest, val) }))) return false;
  if(val === null) return true;
  const last = steps[steps.length - 1];
  for(const s of steps.slice(0, -1))
    if(s.node && s.node['.validate'] !== undefined && !run(s.node['.validate'], { uid, vars: s.vars, newVal: wrap(s.rest, val) })) return false;
  return validDown(last.node, val, last.vars, uid);
}
const arr = (xs) => Object.fromEntries(xs.map((v, i) => [String(i), v]));
const C = 'config';

say('── 1. config/apiCors — 출처 목록');
{
  const P = C + '/apiCors';
  const ok2 = arr(['https://together-working.web.app', 'https://admin.togetherworking.duckdns.org']);
  chk(canWrite(P, ok2, ADMIN), '★ 관리자는 출처 목록(0, 1 키)을 쓴다');
  chk(canWrite(P, arr(Array.from({ length: 20 }, (_, i) => 'https://a' + i + '.example.com')), ADMIN), '  ↳ 20개(0..19 키)까지');
  chk(!canWrite(P, arr(Array.from({ length: 21 }, (_, i) => 'https://a' + i + '.example.com')), ADMIN), '★ 21개(20 키)는 거절');
  chk(canWrite(P + '/19', 'https://x.example.com', ADMIN) && !canWrite(P + '/20', 'https://x.example.com', ADMIN), '  ↳ 한 칸 쓰기도 19 까지 · 20 거절');
  chk(['a', '01', '-1', '1.5', ''].every((k) => !canWrite(P, { [k]: 'https://x.example.com' }, ADMIN)), '  ↳ 키는 0..19 숫자만(a · 01 · -1 · 1.5 · 빈 키 거절)');
  const bad = ['http://x.example.com', 'https://*.example.com', 'https://x.example.com:8443', 'https://x.example.com/path', 'https://x.example.com/',
    'https://X.example.com', 'https://x_y.example.com', 'https://', 'x.example.com', 'https://x.example.com?q', '', 'https://' + 'a'.repeat(200), 123, true];
  chk(bad.every((v) => !canWrite(P, { 0: v }, ADMIN)), '★ http · * · 포트 · 경로 · 끝 / · 대문자 · 밑줄 · 빈 호스트 · 스킴 없음 · ? · 200자 넘음 · 숫자 · 불리언 거절');
  chk(['https://localhost', 'https://a-b.c.d', 'https://1.2.3.4'].every((v) => canWrite(P, { 0: v }, ADMIN)), '  ↳ 소문자 · 숫자 · 점 · - 로 된 호스트는 받는다');
  chk(!canWrite(P, 'https://x.example.com', ADMIN) && !canWrite(P, 5, ADMIN), '★ 목록이 아닌 한 값(문자열 · 숫자)을 통째로 쓰면 거절');
  chk(canWrite(P, null, ADMIN), '  ↳ 관리자는 통째로 지울 수 있다(빈 목록 = 서버 env 기본)');
  chk(!canWrite(P, ok2, USER) && !canWrite(P, ok2, BOT) && !canWrite(P, ok2, null) && !canWrite(P, null, USER), '★ 관리자가 아니면(사용자 · 봇 · 로그인 안 함) 쓰기 · 지우기 거절');
  chk(canRead(P, ADMIN) && canRead(P, BOT) && !canRead(P, USER) && !canRead(P, null) && !canRead(P + '/0', null), '★ 읽기는 관리자 · 봇(apiBots)만 — 공개 아님');
}

say('── 2. config/apiCache — 공개 캐시 초');
{
  const P = C + '/apiCache', KEYS = ['config', 'count', 'card', 'leaderboard'];
  chk(KEYS.every((k) => [0, 1, 30, 600].every((v) => canWrite(P + '/' + k, v, ADMIN))), '★ 네 칸 — 정수 0~600');
  chk(KEYS.every((k) => [-1, 601, 1.5, '30', true].every((v) => !canWrite(P + '/' + k, v, ADMIN))), '  ↳ -1 · 601 · 소수 · 문자열 · 불리언 거절');
  chk(canWrite(P, { config: 30, count: 15, card: 60, leaderboard: 60 }, ADMIN), '  ↳ 네 칸을 한 객체로 써도 된다');
  chk(!canWrite(P + '/other', 30, ADMIN) && !canWrite(P, { config: 30, extra: 1 }, ADMIN), '★ 모르는 칸 거절');
  chk(!canWrite(P + '/config', 30, USER) && !canWrite(P + '/config', 30, BOT) && !canWrite(P + '/config', 30, null), '★ 관리자만 쓰기');
  chk(canRead(P + '/config', BOT) && canRead(P, ADMIN) && !canRead(P + '/config', USER) && !canRead(P + '/config', null), '★ 읽기는 관리자 · 봇만');
}

say('── 3. config/logLevel — 로그 수준');
{
  const P = C + '/logLevel', LV = ['error', 'warn', 'info', 'debug'];
  chk(['api', 'realtime'].every((k) => LV.every((v) => canWrite(P + '/' + k, v, ADMIN))), '★ api · realtime — error · warn · info · debug');
  chk(['api', 'realtime'].every((k) => ['ERROR', 'Info', 'trace', 'info ', '', 1, true].every((v) => !canWrite(P + '/' + k, v, ADMIN))), '  ↳ 대문자 · 다른 이름 · 공백 · 빈 값 · 숫자 · 불리언 거절');
  chk(!canWrite(P + '/web', 'info', ADMIN), '★ 모르는 칸 거절');
  chk(!canWrite(P + '/api', 'debug', USER) && !canWrite(P + '/realtime', 'debug', null) && !canWrite(P + '/realtime', 'debug', BOT), '★ 관리자만 쓰기');
  chk(canRead(P + '/realtime', null) && canRead(P + '/realtime', USER), '★ realtime 은 공개 읽기 — 방 서버가 키 없이 REST 로 읽는다');
  chk(canRead(P + '/api', BOT) && !canRead(P + '/api', null) && !canRead(P + '/api', USER) && !canRead(P, null), '  ↳ api 는 봇 · 관리자만 · logLevel 통째 공개 읽기 없음');
}

say('── 4. config/roomServer/frame — 방 서버 프레임 상한');
{
  const P = C + '/roomServer/frame';
  chk([65536, 1048576].every((v) => canWrite(P + '/maxBytes', v, ADMIN)) && [65535, 1048577, 65536.5, '65536'].every((v) => !canWrite(P + '/maxBytes', v, ADMIN)),
    '★ maxBytes 정수 65536~1048576(밖 · 소수 · 문자열 거절)');
  chk([1024, 16384, 65536].every((v) => canWrite(P + '/maxSmallBytes', v, ADMIN)) && [1023, 65537, 2048.5, '2048'].every((v) => !canWrite(P + '/maxSmallBytes', v, ADMIN)),
    '★ maxSmallBytes 정수 1024~65536');
  chk(!canWrite(P + '/maxPayload', 1024, ADMIN), '  ↳ 모르는 칸 거절');
  chk(!canWrite(P + '/maxBytes', 65536, USER) && !canWrite(P + '/maxBytes', 65536, null), '★ 관리자만 쓰기');
  chk(canRead(P + '/maxBytes', null) && canRead(P, null), '★ 공개 읽기(방 서버가 키 없이)');
}

say('── 5. config/roomServer/timing — 새 두 칸 · 옛 칸');
{
  const P = C + '/roomServer/timing';
  const R = { roomStatsRefreshMs: [5000, 600000], statsLogMs: [5000, 3600000],
    graceMs: [0, 600000], pingIntervalMs: [1000, 120000], restoreWindowMs: [0, 1800000], refreshMs: [5000, 600000], joinWaitMs: [3000, 60000], clientGiveUpMs: [15000, 600000] };
  for(const [k, [lo, hi]] of Object.entries(R)){
    chk(canWrite(P + '/' + k, lo, ADMIN) && canWrite(P + '/' + k, hi, ADMIN) && !canWrite(P + '/' + k, lo - 1, ADMIN) && !canWrite(P + '/' + k, hi + 1, ADMIN)
      && !canWrite(P + '/' + k, lo + 0.5, ADMIN) && !canWrite(P + '/' + k, String(lo), ADMIN), `  ${k} 정수 ${lo}~${hi}`);
  }
  chk(!canWrite(P + '/statsLog', 60000, ADMIN), '★ 모르는 칸 거절');
  chk(!canWrite(P + '/statsLogMs', 60000, USER) && !canWrite(P + '/statsLogMs', 60000, null), '★ 관리자만 쓰기');
  chk(canRead(P, null) && canRead(P + '/statsLogMs', null), '★ timing 은 공개 읽기(방 서버가 키 없이)');
  chk(!canWrite(C + '/roomServer/frames', { maxBytes: 65536 }, ADMIN), '  ↳ roomServer 의 모르는 칸은 그대로 거절');
  chk(!canRead(C, null) && !canRead(C, USER) && canRead(C, BOT), 'config 통째 읽기는 그대로 관리자 · 봇만');
}

say('── 6. 앱은 쓰지 않는다');
{
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const src = strip(APP) + strip(FI);
  chk(!/apiCors|apiCache|logLevel|roomServer\/frame|maxSmallBytes|roomStatsRefreshMs|statsLogMs/.test(src), '앱(app.js · firebase-init.js)은 이 칸을 모른다 — 서버 · 웹 관리자 전용');
}

say(fail ? `\n✗ 실패 ${fail}건` : `\n전부 통과 ✅ (${pass}건)`);
process.exit(fail ? 1 : 0);

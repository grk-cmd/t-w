/*
 * 방 서버 문지기 검사 — room-server-gate.js 를 가짜 DB 읽기로 그대로 돌린다.
 * 1. 주소 거르기(운영 앱은 운영 주소만 · 로컬은 dev 앱만) · 개발용 켜기는 dev 에서만
 * 2. 만들기 — on + allow/{내 코드} = 서버 이름 → 그 서버 · 표에 없는 이름 · 낯선 주소 → Firebase
 * 2-b. 기본 서버 · 비율 — 사용자 코드 해시 칸(0~99)이 늘 같음 · 0/100/중간 · 올리면 더해지기만 · 허용 목록이 먼저
 *      · on:false · 표에 없는 이름 · 낯선 주소 · 틀린 비율 → Firebase · 들어가기(주소록 따라가기)는 그대로
 * 3. 들어가기 — 주소록(roomDir) 따라가기(on 이면 늘 · follow 칸은 안 읽음) · 허용된 사람 · 꺼짐
 * 4. 읽는 칸 — 칸 단위만(목록 통째 읽기 없음) · 꺼져 있으면 on 한 칸 · 서버 표 기억
 * 5. 규칙 — config 는 칸 단위 공개 · 쓰기 관리자만 · limits 정수 범위 · default 이름 · defaultPercent 정수 0~100 · roomDir 앱 쓰기 막힘 · minRoomVer 그대로 공개
 * 6. 연결 — firebase-init · app.js 가 문지기 한 곳(resolveRoomServer)으로 고른다
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('room-server-gate.js'), FI = read('firebase-init.js'), APP = read('app.js'), RULES = read('firebase-database-rules.json');
for(const [n, v] of [['room-server-gate.js', SRC], ['firebase-init.js', FI], ['app.js', APP], ['firebase-database-rules.json', RULES]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const names = [...SRC.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map((m) => m[1]);
const M = new Function(SRC.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')();

const PROD = 'wss://rooms.togetherworking.duckdns.org', DEV = 'wss://rooms-dev.togetherworking.duckdns.org';
function mkGate(db, o = {}){
  const reads = [];
  let t = 1000;
  const gate = M.createRoomServerGate({
    read: async (p) => { reads.push(p); if(o.fail) throw new Error('net'); return (p in db) ? db[p] : null; },
    getUserId: () => ('uid' in o) ? o.uid : 'u1abc234',
    env: o.env || 'prod',
    storage: o.storage || null,
    now: () => t,
  });
  return { gate, reads, adv: (ms) => { t += ms; } };
}
const C = 'config/roomServer';
const base = () => ({ [C + '/on']: true, [C + '/servers/rooms-1']: PROD });
const ls = (o) => ({ getItem: (k) => (k in o ? o[k] : null) });

(async () => {
  say('── 1. 주소 거르기 · 개발용 켜기');
  {
    chk(M.ROOM_SERVER_URLS.prod === PROD && M.ROOM_SERVER_URLS.dev === DEV, '운영 · dev 방 서버 주소');
    chk(M.serverUrlOk(PROD, 'prod') && !M.serverUrlOk(DEV, 'prod') && M.serverUrlOk(DEV + '/', 'dev'), '운영 앱은 운영 주소만 · dev 앱은 dev 주소(끝 / 무시)');
    chk(!M.serverUrlOk('ws://127.0.0.1:8787', 'prod') && M.serverUrlOk('ws://127.0.0.1:8787', 'dev') && !M.serverUrlOk('ws://127.0.0.1:9999', 'dev'), '로컬(8787)은 dev 앱만');
    chk(!M.serverUrlOk('wss://evil.example', 'prod') && !M.serverUrlOk('', 'prod') && !M.serverUrlOk(null, 'dev'), '낯선 주소 · 빈 값은 안 된다');
    const on = ls({ 'tw.roomServer': '1', 'tw.roomServerUrl': 'ws://127.0.0.1:8787' });
    chk(M.devOverride('prod', on) === null, '개발용 켜기(tw.roomServer)는 운영 앱에서 무시');
    chk(M.devOverride('dev', on).url === 'ws://127.0.0.1:8787' && M.devOverride('dev', ls({ 'tw.roomServer': '1' })).url === DEV, '  ↳ dev 앱 — tw.roomServerUrl, 없으면 dev 서버');
    chk(M.devOverride('dev', ls({ 'tw.roomServer': '1', 'tw.roomServerUrl': 'wss://evil.example' })) === null && M.devOverride('dev', ls({})) === null, '  ↳ 낯선 주소 · 표식 없음 → 없음');
    const g = mkGate({}, { env: 'dev', storage: on });
    const r = await g.gate.resolveRoomServer('WORK-AB12', {});
    chk(r.via === 'server' && r.from === 'dev' && g.reads.length === 0, '  ↳ 개발용 켜기면 DB 를 안 읽고 서버로');
  }

  say('── 2. 만들기');
  {
    let g = mkGate(Object.assign(base(), { [C + '/allow/u1abc234']: 'rooms-1' }));
    let r = await g.gate.resolveRoomServer('WORK-AB12', { creating: true });
    chk(r.via === 'server' && r.url === PROD && r.server === 'rooms-1' && r.from === 'allow', '허용 목록 = 서버 이름 → 그 서버에 만든다');
    chk(g.gate.mine() && g.gate.mine().name === 'rooms-1', '  ↳ «내 서버» 를 기억(방 개수 · 랜덤)');
    chk(!g.reads.includes('roomDir/WORK-AB12'), '  ↳ 만들 때는 주소록을 안 읽는다');
    g = mkGate(base());
    r = await g.gate.resolveRoomServer('WORK-AB12', { creating: true });
    chk(r.via === 'firebase' && g.gate.mine() === null, '목록에 없으면 Firebase');
    g = mkGate(Object.assign(base(), { [C + '/allow/u1abc234']: 'rooms-9' }));
    chk((await g.gate.resolveRoomServer('X', { creating: true })).via === 'firebase', '표에 없는 서버 이름 → Firebase');
    g = mkGate(Object.assign(base(), { [C + '/allow/u1abc234']: 'rooms-1', [C + '/servers/rooms-1']: 'wss://evil.example' }));
    chk((await g.gate.resolveRoomServer('X', { creating: true })).via === 'firebase', '표의 주소가 낯설면(CSP 밖) → Firebase');
    g = mkGate(Object.assign(base(), { [C + '/allow/u1abc234']: 'rooms-1', [C + '/on']: false }));
    r = await g.gate.resolveRoomServer('X', { creating: true });
    chk(r.via === 'firebase' && g.reads.length === 1 && g.reads[0] === C + '/on', '꺼져 있으면(on:false) on 한 칸만 읽고 Firebase');
    g = mkGate(Object.assign(base(), { [C + '/allow/u1abc234']: 'rooms-1' }), { fail: true });
    chk((await g.gate.resolveRoomServer('X', { creating: true })).via === 'firebase', '읽기 실패 → Firebase(입장을 막지 않는다)');
    g = mkGate(Object.assign(base(), { [C + '/allow/u1abc234']: 'rooms-1' }), { uid: null });
    chk((await g.gate.resolveRoomServer('X', { creating: true })).via === 'firebase', '내 코드가 없으면 Firebase');
  }

  say('── 2-b. 기본 서버 · 비율');
  {
    const B = M.userBucket;
    chk(B('u1abc234') === B('u1abc234') && B('u1abc234') === M.userBucket(String('u1abc234')), '사용자 코드 → 칸은 순수 함수(같은 코드는 늘 같은 칸)');
    const codes = Array.from({ length: 5000 }, (_, i) => 'u' + (i * 7919 + 13).toString(36).padStart(7, '0'));
    chk(codes.every((c) => { const b = B(c); return Number.isInteger(b) && b >= 0 && b <= 99; }), '  ↳ 칸은 0~99 정수');
    const share = (p) => codes.filter((c) => M.inDefaultPercent(c, p)).length / codes.length;
    chk(share(0) === 0 && share(100) === 1, '  ↳ 0% = 아무도 · 100% = 모두');
    const s10 = share(10), s50 = share(50);
    chk(s10 > 0.07 && s10 < 0.13 && s50 > 0.45 && s50 < 0.55, '  ↳ 고르게 퍼진다 (10% → ' + (s10 * 100).toFixed(1) + '% · 50% → ' + (s50 * 100).toFixed(1) + '%)');
    chk(codes.every((c) => !M.inDefaultPercent(c, 10) || (M.inDefaultPercent(c, 50) && M.inDefaultPercent(c, 100))), '  ↳ 비율을 올리면 더해지기만(10% 안의 사람은 50% · 100% 에도)');
    chk(!M.inDefaultPercent(null, 100) && !M.inDefaultPercent('', 100), '  ↳ 내 코드가 없으면 비율 밖');
    chk(M.defaultPercentOf(2.5) === 0 && M.defaultPercentOf(101) === 0 && M.defaultPercentOf(-1) === 0 && M.defaultPercentOf('50') === 0 && M.defaultPercentOf(null) === 0 && M.defaultPercentOf(37) === 37,
      '  ↳ 틀린 비율(소수 · 범위 밖 · 글자 · 없음)은 0');
    const IN = codes.find((c) => B(c) < 10), OUT = codes.find((c) => B(c) >= 50);
    const dflt = (pct, extra) => Object.assign(base(), { [C + '/servers/realtime-1']: PROD, [C + '/default']: 'realtime-1', [C + '/defaultPercent']: pct }, extra || {});
    let g = mkGate(dflt(10), { uid: IN });
    let r = await g.gate.resolveRoomServer('WORK-AB12', { creating: true });
    chk(r.via === 'server' && r.server === 'realtime-1' && r.url === PROD && r.from === 'default', '허용 목록에 없어도 비율 안이면 기본 서버에 만든다(from default)');
    chk(g.gate.mine() && g.gate.mine().name === 'realtime-1', '  ↳ «내 서버» 로 기억(방 개수 · 랜덤에 서버 몫이 섞인다)');
    g = mkGate(dflt(10), { uid: OUT });
    r = await g.gate.resolveRoomServer('WORK-AB12', { creating: true });
    chk(r.via === 'firebase' && r.why === 'notAllowed' && g.gate.mine() === null, '비율 밖이면 Firebase');
    g = mkGate(dflt(100), { uid: OUT });
    chk((await g.gate.resolveRoomServer('X', { creating: true })).from === 'default', '100% 면 비율 밖이던 사람도 기본 서버로');
    g = mkGate(dflt(0), { uid: IN });
    chk((await g.gate.resolveRoomServer('X', { creating: true })).via === 'firebase', '0% 면 모두 Firebase');
    g = mkGate(dflt(100, { [C + '/servers/rooms-1']: DEV.replace('-dev', ''), [C + '/allow/' + IN]: 'rooms-1' }), { uid: IN });
    r = await g.gate.resolveRoomServer('X', { creating: true });
    chk(r.via === 'server' && r.server === 'rooms-1' && r.from === 'allow', '허용 목록이 먼저(기본 서버가 있어도 지정된 서버로)');
    g = mkGate(dflt(100, { [C + '/allow/' + IN]: 'gone-9' }), { uid: IN });
    r = await g.gate.resolveRoomServer('X', { creating: true });
    chk(r.via === 'server' && r.from === 'default', '  ↳ 허용 목록의 서버가 표에 없으면 기본 서버 · 비율을 본다');
    g = mkGate(dflt(100, { [C + '/on']: false }), { uid: IN });
    r = await g.gate.resolveRoomServer('X', { creating: true });
    chk(r.via === 'firebase' && r.why === 'off' && g.reads.length === 1, 'on:false 면 비율이 100 이어도 모두 Firebase(on 한 칸만 읽음)');
    g = mkGate(dflt(100, { [C + '/default']: 'nope-1' }), { uid: IN });
    chk((await g.gate.resolveRoomServer('X', { creating: true })).via === 'firebase', '기본 서버 이름이 표에 없으면 Firebase');
    g = mkGate(dflt(100, { [C + '/default']: 'BAD NAME' }), { uid: IN });
    chk((await g.gate.resolveRoomServer('X', { creating: true })).via === 'firebase', '  ↳ 이름 형식이 틀려도 Firebase');
    g = mkGate(dflt(100, { [C + '/servers/realtime-1']: 'wss://evil.example' }), { uid: IN });
    chk((await g.gate.resolveRoomServer('X', { creating: true })).via === 'firebase', '  ↳ 기본 서버 주소가 낯설면(CSP 밖) Firebase');
    g = mkGate(dflt(100, { [C + '/servers/realtime-1']: DEV }), { uid: IN });
    chk((await g.gate.resolveRoomServer('X', { creating: true })).via === 'firebase', '  ↳ 운영 앱은 dev 서버 주소로 안 간다');
    g = mkGate(dflt(100, { [C + '/servers/realtime-1']: DEV }), { uid: IN, env: 'dev' });
    chk((await g.gate.resolveRoomServer('X', { creating: true })).url === DEV, '  ↳ dev 앱은 dev 서버로');
    for(const bad of [2.5, 101, '100', true]){
      g = mkGate(dflt(bad), { uid: IN });
      chk((await g.gate.resolveRoomServer('X', { creating: true })).via === 'firebase', '  ↳ 틀린 비율(' + JSON.stringify(bad) + ') → Firebase');
    }
    g = mkGate(dflt(100), { uid: IN, fail: true });
    chk((await g.gate.resolveRoomServer('X', { creating: true })).via === 'firebase', '읽기 실패 → Firebase');
    g = mkGate(dflt(100), { uid: null });
    chk((await g.gate.resolveRoomServer('X', { creating: true })).via === 'firebase', '내 코드가 없으면 Firebase');
    // 들어가기 — 주소록 따라가기는 그대로 · 비율 밖 사람도 따라간다
    const dirTo2 = { [C + '/servers/realtime-2']: PROD, 'roomDir/WORK-AB12': { srv: 'realtime-2' } };
    g = mkGate(dflt(100, dirTo2), { uid: IN });
    r = await g.gate.resolveRoomServer('WORK-AB12', {});
    chk(r.via === 'server' && r.from === 'dir' && r.server === 'realtime-2', '들어가기 — 비율 안이어도 주소록이 먼저(다른 서버의 방이면 그 서버로)');
    g = mkGate(dflt(0, dirTo2), { uid: OUT });
    r = await g.gate.resolveRoomServer('WORK-AB12', {});
    chk(r.via === 'server' && r.from === 'dir', '  ↳ 비율 밖(0%)이어도 서버에 있는 방은 따라간다');
    g = mkGate(dflt(100), { uid: IN });
    r = await g.gate.resolveRoomServer('WORK-ZZ99', {});
    chk(r.via === 'server' && r.from === 'default', '  ↳ 비율 안 + 주소록에 없음 → 내 서버(허용된 사람과 같이 peek · Firebase 에 사람 있으면 Firebase — app.js)');
    g = mkGate(dflt(10), { uid: OUT });
    r = await g.gate.resolveRoomServer('WORK-ZZ99', {});
    chk(r.via === 'firebase' && r.why === 'noDir', '  ↳ 비율 밖 + 주소록에 없음 → Firebase(peek 하러 붙지 않음)');
    const h = mkGate(dflt(100), { uid: IN });
    const m = await h.gate.refreshMine();
    chk(m && m.name === 'realtime-1' && m.from === 'default' && !h.reads.some((p) => p.startsWith('roomDir')), 'refreshMine — 비율 안이면 기본 서버가 «내 서버»');
    chk(!h.reads.some((p) => p === C || p === C + '/allow' || p === C + '/servers'), '  ↳ 기본 서버 · 비율도 칸 단위로만 읽는다(config 통째 없음)');
  }

  say('── 3. 들어가기');
  {
    const dir = { 'roomDir/WORK-AB12': { srv: 'rooms-1', ts: 1 } };
    let g = mkGate(Object.assign(base(), dir));
    let r = await g.gate.resolveRoomServer('WORK-AB12', {});
    chk(r.via === 'server' && r.from === 'dir' && r.url === PROD, 'on 이면 허용 목록에 없어도 늘 주소록의 서버로 따라간다(같은 코드 다른 방으로 갈라지지 않게)');
    chk(g.gate.mine() === null, '  ↳ 따라가기만 — «내 서버» 는 없다(방 개수 · 랜덤에 안 섞임)');
    chk(!g.reads.includes(C + '/follow'), '  ↳ 예전 follow 칸은 읽지 않는다');
    g = mkGate(Object.assign(base(), dir, { [C + '/follow']: false }));
    r = await g.gate.resolveRoomServer('WORK-AB12', {});
    chk(r.via === 'server' && r.from === 'dir', '  ↳ DB 에 follow:false 가 남아 있어도 따라간다');
    g = mkGate(Object.assign(base(), dir, { [C + '/allow/u1abc234']: 'rooms-1', [C + '/servers/rooms-2']: PROD, 'roomDir/WORK-AB12': { srv: 'rooms-2' } }));
    r = await g.gate.resolveRoomServer('WORK-AB12', {});
    chk(r.via === 'server' && r.from === 'dir' && r.server === 'rooms-2', '허용된 사람도 주소록이 먼저(다른 서버의 방이면 그 서버로)');
    g = mkGate(Object.assign(base(), { [C + '/allow/u1abc234']: 'rooms-1' }));
    r = await g.gate.resolveRoomServer('WORK-ZZ99', {});
    chk(r.via === 'server' && r.from === 'allow', '허용된 사람 + 주소록에 없음 → 내 서버(빈 방은 서버가 연다 · peek 은 app.js)');
    g = mkGate(base());
    r = await g.gate.resolveRoomServer('WORK-ZZ99', {});
    chk(r.via === 'firebase' && r.why === 'noDir', '허용 안 됨 + 주소록에 없음 → Firebase');
    g = mkGate(Object.assign(base(), { 'roomDir/WORK-AB12': { srv: 'nope' } }));
    chk((await g.gate.resolveRoomServer('WORK-AB12', {})).via === 'firebase', '주소록의 서버가 표에 없으면 Firebase');
    g = mkGate(Object.assign(base(), dir, { [C + '/on']: false }));
    chk((await g.gate.resolveRoomServer('WORK-AB12', {})).via === 'firebase', 'on:false 면 따라가기도 Firebase(on 이 비상 정지 스위치)');
  }

  say('── 4. 읽는 칸');
  {
    const g = mkGate(Object.assign(base(), { 'roomDir/WORK-AB12': { srv: 'rooms-1' } }));
    await g.gate.resolveRoomServer('WORK-AB12', {});
    const set = new Set(g.reads);
    chk(g.reads.every((p) => p === C + '/on' || p === C + '/allow/u1abc234' || p === 'roomDir/WORK-AB12' || p === C + '/servers/rooms-1' || p === C + '/default' || p === C + '/defaultPercent'),
      '읽는 곳은 on · allow/{내 코드} · roomDir/{방 코드} · default · defaultPercent · servers/{이름} 칸뿐 (' + [...set].join(', ') + ')');
    chk(!g.reads.some((p) => p === C || p === C + '/allow' || p === C + '/servers' || p === 'roomDir'), '  ↳ 목록 통째 읽기 없음');
    const n = g.reads.length;
    await g.gate.resolveRoomServer('WORK-AB12', {});
    chk(g.reads.length - n === 5, '  ↳ 서버 표는 5분 기억(두 번째 입장은 servers 를 다시 안 읽음 · on · allow · roomDir · default · defaultPercent 다섯 칸)');
    g.adv(5 * 60 * 1000 + 1);
    const n2 = g.reads.length;
    await g.gate.resolveRoomServer('WORK-AB12', {});
    chk(g.reads.length - n2 === 6, '  ↳ 5분이 지나면 다시 읽는다');
    const h = mkGate(Object.assign(base(), { [C + '/allow/u1abc234']: 'rooms-1' }));
    const m = await h.gate.refreshMine();
    chk(m && m.name === 'rooms-1' && !h.reads.some((p) => p.startsWith('roomDir')), 'refreshMine — on · allow/{내 코드} (+서버 표)만');
  }

  say('── 5. 규칙');
  {
    const R = JSON.parse(RULES).rules;
    const cfg = R.config || {};
    const isAdmin = (v) => typeof v === 'string' && /admins.*auth\.uid/.test(v);
    chk(cfg['.read'] !== true && isAdmin(cfg['.read']), 'config 통째 읽기는 관리자만(허용 목록이 통째로 새지 않게)');
    chk(cfg.minRoomVer && cfg.minRoomVer['.read'] === true && isAdmin(cfg.minRoomVer['.write']), '  ↳ minRoomVer 는 그대로 누구나 읽기 · 관리자 쓰기(옛 앱 버전 게이트)');
    const rs = cfg.roomServer || {};
    chk(isAdmin(rs['.write']) && /auth != null/.test(rs['.write']), 'config/roomServer 쓰기는 관리자만');
    chk(rs.on && rs.on['.read'] === true && /isBoolean/.test(rs.on['.validate']) && rs.follow && rs.follow['.read'] === true && /isBoolean/.test(rs.follow['.validate']), '  ↳ on · follow — 누구나 읽기 · 참/거짓');
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
    chk(rs.$other && rs.$other['.validate'] === false, '  ↳ 모르는 칸은 거절');
    const rd = R.roomDir || {};
    chk(!rd['.read'] && rd.$code && rd.$code['.read'] === true && rd.$code['.write'] === false, 'roomDir — 방 코드 한 칸만 누구나 읽기 · 앱은 못 씀(방 서버가 관리자 키로)');
    chk(JSON.stringify(rd['.indexOn']) === '["srv"]', '  ↳ srv 색인(서버가 시작할 때 자기 몫을 찾는다)');
  }

  say('── 6. 연결');
  {
    const FC = strip(FI), AC = strip(APP), GC = strip(SRC);
    chk(!/^\s*import\s/m.test(SRC) && !/firebase\/|gstatic|getDatabase/.test(GC), 'room-server-gate.js 는 아무것도 import 하지 않는다(읽기는 deps.read)');
    chk(/read: \(path\) => get\(ref\(db, path\)\)\.then\(s => s\.val\(\)\),/.test(FC) && /env: FIREBASE_ENV,/.test(FC), 'firebase-init — 칸 하나 읽기 · 환경을 넘긴다');
    chk(/async resolveRoomServer\(code, opts\)\{/.test(FC) && /roomServerMineNow\(\)\{ return _roomServerGate\.mine\(\); \}/.test(FC), '  ↳ firebaseAPI.resolveRoomServer · roomServerMine · roomServerMineNow');
    const calls = (AC.match(/firebaseAPI\.resolveRoomServer\(/g) || []).length;
    chk(calls === 1, '«어디로» 를 묻는 곳은 app.js 에 한 곳(_startRoomOnServer) (' + calls + ')');
    chk(!/tw\.roomServer/.test(AC) && !/tw\.roomServer/.test(FC), '개발용 localStorage 키는 문지기만 본다');
    chk(/const following = rs\.from === 'dir';/.test(AC) && !/from === 'allow'/.test(AC), 'app.js 는 «따라가기(dir)» 만 따로 본다 — 기본 서버(default)는 허용된 사람과 같은 길(peek · Firebase 사람 확인)');
    chk(!/defaultPercent|config\/roomServer/.test(AC) && !/defaultPercent/.test(FC), '기본 서버 · 비율은 문지기만 읽는다(app.js · firebase-init 은 모름)');
    const ri = FC.indexOf('joinRoom(room, me, onChange, onPoked) {');
    chk(ri > 0 && FC.indexOf('roomAlive/${room}/${memberId}', ri) > ri, '💓 roomAlive 하트비트는 Firebase joinRoom 안에만 — 서버 방(provider.join)에서는 돌지 않는다');
  }

  say(fail ? `\n✗ 실패 ${fail}건` : `\n전부 통과 ✅ (${pass}건)`);
  process.exit(fail ? 1 : 0);
})().catch((err) => { chk(false, '실행 오류 — ' + (err && err.stack)); say(`\n✗ 실패 ${fail}건`); process.exit(1); });

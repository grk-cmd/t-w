/*
 * 일일 접속 집계(DAU · 방문 수) 검사. functions/daily-active.js 를 그대로 불러 가짜 DB 로 돌린다.
 * 1. 서울 날짜 경계  2. 쓰기 묶음  3. 처리기(지우기 무시 · 한 번에 update)  4. index.js 연결 · 규칙
 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (f) => { const s = read(f); if(s == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } return s; };
const RULES = need('firebase-database-rules.json');
const FX = need('functions/index.js');
need('functions/daily-active.js');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

(async () => {
  const f = require(path.resolve('functions/daily-active.js'));
  const T = (iso) => Date.parse(iso);
  const INC = (n) => ({ inc: n });

  say('── 1. 서울 날짜 (UTC+9)');
  {
    chk(f.kstDateKey(T('2026-10-06T14:59:59.999Z')) === '2026-10-06', 'UTC 14:59:59 = 서울 23:59:59 → 그날');
    chk(f.kstDateKey(T('2026-10-06T15:00:00Z')) === '2026-10-07', 'UTC 15:00 = 서울 자정 → 다음 날');
    chk(f.kstDateKey(T('2026-12-31T15:00:00Z')) === '2027-01-01', '해 넘김도 서울 기준');
    chk(f.kstDateKey(T('2026-02-28T15:30:00Z')) === '2026-03-01', '달 넘김도 서울 기준');
    chk(f.kstDateKey(T('2026-07-01T00:00:00Z')) === '2026-07-01', '서머타임 없음 — 여름에도 +9');
  }

  say('── 2. 쓰기 묶음 (dailyActiveUpdates)');
  {
    const now = T('2026-10-06T15:00:00Z');
    const u = f.dailyActiveUpdates('uabc12345', now, INC);
    chk(JSON.stringify(u) === JSON.stringify({ 'metrics/daily/2026-10-07/u/uabc12345': true, 'metrics/daily/2026-10-07/visits': { inc: 1 } }),
        '고유 사용자 표시 true + 방문 수 +1 (서버 증가) — 두 경로뿐');
    chk(f.dailyActiveUpdates('u' + 'a'.repeat(40), now, INC) !== null, '사용자 코드 41자(u + 40)까지 받는다');
    const bads = ['', 'uabc', 'u' + 'a'.repeat(41), 'Uabc12345', 'uABC12345', 'uabc1234/x', 'xabc12345', 'uabc.12345', null, 42, undefined];
    const leaked = bads.filter(b => f.dailyActiveUpdates(b, now, INC) !== null);
    chk(!leaked.length, '틀린 코드(짧음 · 김 · 대문자 · 경로 문자 · 숫자 · 없음)는 null — 아무것도 안 쓴다' + (leaked.length ? ' — 받음: ' + JSON.stringify(leaked) : ''));
    chk(f.USER_CODE_RE.source === '^u[0-9a-z]{8,40}$', '코드 모양 = 앱 사용자 코드 ^u[0-9a-z]{8,40}$');
  }

  say('── 3. 처리기 (runDailyActive)');
  {
    const mkDb = () => { const L = []; return { L, db: { ref: (p) => ({ update: async (v) => { L.push([p, v]); } }) } }; };
    const ev = (exists, userId) => ({ params: { userId }, data: { after: { exists: () => exists } } });
    const now = T('2026-10-07T01:00:00Z');
    let { db, L } = mkDb();
    // 검사 환경엔 functions/node_modules 가 없다 — firebase-admin 을 부르는 증가 자리만 가짜로 끼운다.
    const runWith = (e) => f.runDailyActive(db, e, now, INC);
    await runWith(ev(true, 'uabc12345'));
    chk(L.length === 1 && L[0][0] === undefined, '한 번의 루트 update — 고유 사용자 · 방문 수가 같이 되거나 같이 안 된다');
    chk(!!L[0] && L[0][1]['metrics/daily/2026-10-07/u/uabc12345'] === true && 'metrics/daily/2026-10-07/visits' in L[0][1], '  ↳ 그날(서울) 경로 둘');
    await runWith(ev(true, 'uabc12345'));
    chk(L.length === 2, '같은 날 다시 켜도 방문 수는 또 센다 (고유 사용자 표시는 같은 키라 그대로 1명)');
    ({ db, L } = mkDb());
    await runWith(ev(false, 'uabc12345'));
    chk(L.length === 0, '지우기(after 없음)는 세지 않는다');
    await runWith(ev(true, 'bad/../x'));
    chk(L.length === 0, '틀린 코드는 쓰지 않는다');
  }

  say('── 4. index.js 연결 · 규칙');
  {
    const CODE = strip(FX);
    const m = CODE.match(/exports\.dailyActive = onValueWritten\(\{ ref: '\/accountSnap\/\{userId\}'[\s\S]*?\n  \}\);/);
    chk(!!m, 'dailyActive = onValueWritten(/accountSnap/{userId}) — 만들기 · 고치기 모두 받는다');
    chk(!!m && /require\('\.\/daily-active'\)\.runDailyActive\(getDatabase\(\), event,/.test(m[0]), '  ↳ 처리는 daily-active.js 에 맡긴다');
    chk(!!m && /require\('firebase-admin\/database'\)/.test(m[0]) && !/^const[^\n]*require\('firebase-admin\/database'\)/m.test(CODE),
        '  ↳ firebase-admin/database 는 실행할 때 읽는다 (배포 때 10초 로딩 제한)');
    chk(/\{[^}]*\bonValueWritten\b[^}]*\} = require\('firebase-functions\/v2\/database'\)/.test(CODE), '  ↳ onValueWritten 을 import 한다');
    chk(/dailyActive — 일일 접속 집계/.test(FX), '  ↳ 머리 주석의 함수 목록에도 적었다');
    const DA = strip(need('functions/daily-active.js'));
    chk(!/^const[^\n]*require\(/m.test(DA), 'daily-active.js 는 맨 위에서 아무것도 require 하지 않는다');
    let rules = null; try{ rules = JSON.parse(RULES).rules; }catch(_){}
    const mr = rules && rules.metrics;
    chk(!!mr && /auth != null/.test(mr['.read']) && /admins.*auth\.uid/.test(mr['.read']), '규칙: metrics 읽기는 관리자만');
    chk(!!mr && !JSON.stringify(mr).includes('.write'), '  ↳ 쓰기 규칙 없음 — 서버(Admin SDK)만 쓴다');
    chk(!!rules && !!rules.stats && rules.stats['.read'] === true && !('metrics' in rules.stats), '  ↳ stats(누구나 읽기) 아래가 아니다 — 읽기 허용이 아래로 번진다');
    const APP = (read('app.js') || '') + (read('firebase-init.js') || '');
    chk(!!APP && !/['`]metrics/.test(APP), '앱은 metrics 를 읽거나 쓰지 않는다 — 웹 관리자 전용');
  }

  say(`\n${pass} · ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });

/*
 * 💓 새 하트비트(방 구독 밖 roomAlive 도장 + 서버 유령 청소) 검사.
 * 1. room-alive.js 판정 함수  2. functions/room-stats.js 청소(가짜 DB)  3. 관리자 유령 방 청소  4. 규칙
 * 0.13 앱의 방은 realtime 서버 메모리다 — 앱이 roomAlive 도장을 찍던 길(firebase-init joinRoom)은 걷었다. 서버 함수 · 관리자 청소가 남은 동안 판정은 그대로 본다.
 */
'use strict';
const { stripReadGate } = require('./sim-rules-src.js');   // 옛 앱 읽기 막기 조건을 걷고 본다(개정 375)
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (f) => { const s = read(f); if(s == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } return s; };
const FI = need('firebase-init.js'), RA = need('room-alive.js');
const RULES = JSON.parse(stripReadGate(need('firebase-database-rules.json')));
need('functions/room-stats.js');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(FI);
const unexport = (src) => src.replace(/^export (function|const) /mg, '$1 ');
const A = new Function(unexport(RA) + '\nreturn { ROOM_ALIVE_MIN_VER, ROOM_ALIVE_HB, ROOM_ALIVE_STALE_MS, verAtLeast, aliveV2On, isMemberAlive, isNewerSession, isIndexToucher, isProbeAlive, isNodeAlive };')();

(async () => {
  say('── 1. room-alive.js 판정');
  {
    chk(A.verAtLeast('0.10.3', '0.10.3') && A.verAtLeast('0.11.0', '0.10.3') && A.verAtLeast('1.0.0', '0.10.3'), '버전 비교 — 같거나 높으면 참');
    chk(!A.verAtLeast('0.10.2', '0.10.3') && !A.verAtLeast('0.9.99', '0.10.3'), '  ↳ 낮으면 거짓');
    chk(A.verAtLeast('0.10.3-beta.1', '0.10.3') && !A.verAtLeast('', '0.10.3') && !A.verAtLeast(null, '0.10.3'), '  ↳ 꼬리는 떼고 · 빈 값은 거짓');
    chk(!A.aliveV2On(null) && !A.aliveV2On('0.10.2') && A.aliveV2On('0.10.3'), '새 방식은 최소 버전이 ' + A.ROOM_ALIVE_MIN_VER + ' 이상일 때만 — 옛 앱이 방에 없을 때');
    const now = 1e9, ST = 120 * 1000;
    chk(A.isMemberAlive({ hb: 2, lastSeen: now - 3600e3 }, now, ST), 'hb:2 멤버는 lastSeen 이 낡아도 노드가 있으면 산 것');
    chk(A.isMemberAlive({ lastSeen: now - 1000 }, now, ST) && !A.isMemberAlive({ lastSeen: now - 130e3 }, now, ST), '옛 방식 멤버는 예전 규칙 그대로(120초)');
    chk(!A.isMemberAlive({}, now, ST) && !A.isMemberAlive(null, now, ST) && !A.isMemberAlive({ hb: 1, lastSeen: 0 }, now, ST), '  ↳ lastSeen 없음 · null · 다른 hb 값은 죽은 것');
    chk(A.isNewerSession('mb', { hb: 2, lastSeen: 1 }, 'ma', { hb: 2, lastSeen: 9 }), '같은 사람 두 세션 — hb:2 면 memberId(입장순)로 새것을 고른다(lastSeen 은 입장 때 값)');
    chk(A.isNewerSession('ma', { lastSeen: 9 }, 'mb', { lastSeen: 1 }) && !A.isNewerSession('mb', { lastSeen: 1 }, 'ma', { lastSeen: 9 }), '  ↳ 옛 방식끼리는 lastSeen 최신');
    chk(A.isIndexToucher('m1', null), 'roomIndex 도장 — 멤버를 아직 모르면 찍는다');
    chk(A.isIndexToucher('m1', { m2: {}, m3: {} }) && !A.isIndexToucher('m2', { m1: {}, m3: {} }), '  ↳ 가장 먼저 온 사람(memberId 최소) 한 명만');
    chk(A.isIndexToucher('m1', {}), '  ↳ 혼자면 찍는다');
    const P = 5 * 60 * 1000;
    chk(!A.isProbeAlive(null, undefined, now, P) && !A.isProbeAlive(undefined, undefined, now, P), '★ 입장 검사 — lastSeen 도 도장도 없는 칸은 찌꺼기(사람으로 안 센다 — Firebase 방에 붙잡히지 않게)');
    chk(A.isProbeAlive(now - 1000, undefined, now, P) && !A.isProbeAlive(now - 6 * 60e3, undefined, now, P), '  ↳ 옛 방식: lastSeen 5분');
    chk(A.isProbeAlive(now - 3600e3, now - 30e3, now, P), '  ↳ 새 방식: lastSeen 이 낡아도 도장이 최근이면 산 것');
    chk(!A.isNodeAlive({ name: 'x' }, now, P) && !A.isNodeAlive(null, now, P) && A.isNodeAlive({ hb: 2 }, now, P) && A.isNodeAlive({ lastSeen: now - 1000 }, now, P) && !A.isNodeAlive({ lastSeen: now - 6 * 60e3 }, now, P),
      '★ 대체 경로(멤버 노드 통째) — 찌꺼기 · 없음은 0 · hb:2 · 방금 lastSeen 은 산 것 · 낡은 lastSeen 은 아님');
    chk(!A.isProbeAlive(now - 3600e3, now - 200e3, now, P), '  ↳ 도장도 ' + (A.ROOM_ALIVE_STALE_MS / 1000) + '초 넘으면 유령');
  }

  say('── 2. functions/room-stats.js 유령 청소 (가짜 DB)');
  {
    const f = require(path.resolve('functions/room-stats.js'));
    chk(f.ROOM_ALIVE_STALE_MS === A.ROOM_ALIVE_STALE_MS && f.ROOM_ALIVE_HB === A.ROOM_ALIVE_HB, '청소 기준 · 표시 값이 앱(room-alive.js)과 같다');
    {
      /* 같은 판단 두 벌 — 앱 입장 검사(isProbeAlive)와 서버 빈 방 판정(roomOccupied)이 같은 칸에 같은 답을 내는가.
         functions/ 는 따로 배포돼 앱 파일을 못 불러서 두 벌이다 — 한쪽만 바꾸면 여기서 빨강. 문턱(5분 · 10분)이 다른 경계는 빼고 본다. */
      const n = 1e9, P = 5 * 60 * 1000;
      const cases = [['시각 · 도장 없음(찌꺼기)', {}, null], ['방금 lastSeen', { lastSeen: n - 1000 }, null], ['한참 전 lastSeen', { lastSeen: n - 3600e3 }, null],
                     ['최근 도장', {}, n - 30e3], ['낡은 도장', {}, n - f.ROOM_ALIVE_STALE_MS - 5e3], ['숫자 아닌 lastSeen', { lastSeen: 'x' }, null]];
      const occ = async (m, at) => f.roomOccupied(at == null ? {} : { m1: at }, { m1: true }, async () => m, n);
      let same = true, why = [];
      for (const [name, m, at] of cases){
        const app = A.isProbeAlive(m.lastSeen == null ? null : (Number.isFinite(Number(m.lastSeen)) ? Number(m.lastSeen) : NaN), at == null ? undefined : at, n, P);
        const srv = await occ(m, at);
        if (app !== srv){ same = false; why.push(name + ' 앱 ' + app + ' · 서버 ' + srv); }
      }
      chk(same, '★ 앱 입장 검사 · 서버 빈 방 판정이 같은 칸에 같은 답(찌꺼기 · 방금 · 한참 전 · 도장 최근 · 낡음 · 숫자 아님)' + (why.length ? ' — 다름: ' + why.join(' / ') : ''));
      chk(!(await occ({}, null)), '★ 서버 — 시각 없는 찌꺼기 칸만 남은 방은 빈 방(정리 대상)');
    }
    const now = 1e9, S = f.ROOM_ALIVE_STALE_MS;
    const tree = { R1: { mOld: now - S - 1, mNew: now - 1000, mBad: 'x' }, R2: { mOrphan: now - S - 5 } };
    const picked = f.staleAliveFrom(tree, now).map(x => x.room + '/' + x.mid).sort();
    chk(JSON.stringify(picked) === JSON.stringify(['R1/mBad', 'R1/mOld', 'R2/mOrphan']), '낡은 도장 · 숫자 아닌 값만 고른다(최근 도장은 안 고름)');
    // 가짜 DB — transaction 은 Admin SDK 처럼 로컬 추측값(null)으로 먼저 부르고, 서버 값이 다르면 다시 부른다
    const mk = (data) => {
      const db = { data, removed: [] };
      const at = (p) => p.split('/').reduce((o, k) => (o && typeof o === 'object') ? o[k] : undefined, db.data);
      const del = (p) => { const ks = p.split('/'); const last = ks.pop(); const o = ks.reduce((o, k) => (o || {})[k], db.data); if(o) delete o[last]; db.removed.push(p); };
      db.ref = (p) => ({
        get: async () => ({ val: () => { const v = at(p); return v === undefined ? null : v; } }),
        remove: async () => del(p),
        transaction: async (fn) => {
          const server = at(p) === undefined ? null : at(p);
          let r = fn(null);
          if(r === null && server !== null) r = fn(server);
          if(r === undefined) return { committed: false };
          if(r === null){ if(server !== null) del(p); return { committed: true }; }
          return { committed: true };
        },
      });
      return db;
    };
    const db = mk({
      roomAlive: { R1: { mGhost: now - S - 1, mLive: now - 1000, mOld: now - S - 9 }, R2: { mOrphan: now - S - 5 } },
      rooms: { R1: { mGhost: { name: 'a', state: 'x', hb: 2 }, mLive: { name: 'b', state: 'x', hb: 2 }, mOld: { name: 'c', state: 'x', lastSeen: 1 } } },
    });
    const r = await f.sweepRoomAlive(db, now);
    chk(db.removed.includes('rooms/R1/mGhost') && db.removed.includes('roomAlive/R1/mGhost'), 'hb:2 이고 도장이 낡은 멤버 → 멤버 노드와 도장을 지운다(방 사람들은 «사라짐» 한 번만 받는다)');
    chk(!db.removed.includes('rooms/R1/mLive') && !db.removed.includes('roomAlive/R1/mLive'), '도장이 최근인 멤버는 안 건드린다');
    chk(!db.removed.includes('rooms/R1/mOld') && db.removed.includes('roomAlive/R1/mOld'), '옛 방식 멤버(hb 없음)는 노드를 안 지운다 — 도장만 걷는다');
    chk(db.removed.includes('roomAlive/R2/mOrphan'), '멤버 노드가 없는 도장(고아)은 걷는다');
    chk(r.ghosts === 1 && r.orphans === 2 && r.failed === 0, '  ↳ 집계 ghosts 1 · orphans 2 · failed 0 (' + JSON.stringify(r) + ')');
    // 읽은 사이에 도장을 다시 찍었으면 지우지 않는다
    const db2 = mk({ roomAlive: { R1: { m1: now - S - 1 } }, rooms: { R1: { m1: { name: 'a', state: 'x', hb: 2 } } } });
    const realRef = db2.ref;
    db2.ref = (p) => { const r0 = realRef(p); if(p === 'rooms/R1/m1/hb') return { ...r0, get: async () => { db2.data.roomAlive.R1.m1 = now; return { val: () => 2 }; } }; return r0; };
    const r2 = await f.sweepRoomAlive(db2, now);
    chk(!db2.removed.length && r2.kept === 1, '청소하는 사이에 도장을 다시 찍었으면(살아남) 그만둔다');
    const SRC = need('functions/room-stats.js');
    chk(/if \(!light\)\{\s*let tree = null;[\s\S]{0,200}if \(tree\)\{ try\{ alive = await sweepRoomAlive\(db, now, tree\); \}/.test(SRC), '청소는 1분 주기 실행에서만 — 방 열림 · 닫힘 트리거(light)는 안 한다 (roomAlive 트리는 빈 방 청소와 같이 한 번 읽는다)');
  }

  say('── 3. 관리자 유령 방 청소(firebase-init.js) — 0.13 방 입장 길은 realtime 서버로 옮겨 하트비트 연결은 없다');
  {
    chk(/aliveTree\[code\] && aliveTree\[code\]\[k\][\s\S]{0,160}ROOM_ALIVE_STALE_MS/.test(CODE), '관리자 유령 방 청소가 도장을 본다 — hb:2 방을 유령으로 지우지 않게');
  }

  say('── 4. 규칙');
  {
    const ra = RULES.rules.roomAlive || {};
    const m = (ra.$room || {}).$memberId || {};
    chk((ra.$room || {})['.read'] === true, 'roomAlive/{방} 읽기 누구나 — 입장 검사가 읽는다');
    chk(/admins/.test(ra['.read'] || ''), 'roomAlive 전체 읽기는 관리자만');
    chk(m['.write'] === true && /isNumber\(\)/.test(m['.validate'] || '') && /now \+ 60000/.test(m['.validate'] || ''), '도장 쓰기 — 숫자 · 미래 60초까지(rooms 와 같은 수준의 권한)');
    chk(/\^m\[0-9a-z\]/.test(m['.validate'] || ''), '  ↳ 키는 memberId 모양만');
  }

  say(`\n${pass} · ${fail}`);
  process.exit(fail ? 1 : 0);
})();

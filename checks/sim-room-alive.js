/*
 * 💓 새 하트비트(방 구독 밖 roomAlive 도장 + 서버 유령 청소) 검사.
 * 1. room-alive.js 판정 함수  2. functions/room-stats.js 청소(가짜 DB)  3. firebase-init.js 연결  4. 규칙
 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (f) => { const s = read(f); if(s == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } return s; };
const FI = need('firebase-init.js'), RA = need('room-alive.js');
const RULES = JSON.parse(need('firebase-database-rules.json'));
need('functions/room-stats.js');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(FI);
const unexport = (src) => src.replace(/^export (function|const) /mg, '$1 ');
const A = new Function(unexport(RA) + '\nreturn { ROOM_ALIVE_MIN_VER, ROOM_ALIVE_HB, ROOM_ALIVE_STALE_MS, verAtLeast, aliveV2On, isMemberAlive, isNewerSession, isIndexToucher, isProbeAlive };')();

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
    chk(A.isProbeAlive(null, undefined, now, P), '입장 검사 — lastSeen 도 도장도 없으면 예전처럼 센다');
    chk(A.isProbeAlive(now - 1000, undefined, now, P) && !A.isProbeAlive(now - 6 * 60e3, undefined, now, P), '  ↳ 옛 방식: lastSeen 5분');
    chk(A.isProbeAlive(now - 3600e3, now - 30e3, now, P), '  ↳ 새 방식: lastSeen 이 낡아도 도장이 최근이면 산 것');
    chk(!A.isProbeAlive(now - 3600e3, now - 200e3, now, P), '  ↳ 도장도 ' + (A.ROOM_ALIVE_STALE_MS / 1000) + '초 넘으면 유령');
  }

  say('── 2. functions/room-stats.js 유령 청소 (가짜 DB)');
  {
    const f = require(path.resolve('functions/room-stats.js'));
    chk(f.ROOM_ALIVE_STALE_MS === A.ROOM_ALIVE_STALE_MS && f.ROOM_ALIVE_HB === A.ROOM_ALIVE_HB, '청소 기준 · 표시 값이 앱(room-alive.js)과 같다');
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
    chk(/if \(!light\)\{ try\{ alive = await sweepRoomAlive\(db, now\); \}/.test(SRC), '청소는 1분 주기 실행에서만 — 방 열림 · 닫힘 트리거(light)는 안 한다');
  }

  say('── 3. firebase-init.js 연결');
  {
    chk(/import \{[^}]*isMemberAlive[^}]*\} from "\.\/room-alive\.js"/.test(FI), 'room-alive.js 를 불러 쓴다');
    chk(/get\(ref\(db, 'config\/minRoomVer'\)\)\.then\(v => \{[\s\S]{0,120}aliveV2On\(v\.val\(\)\)/.test(CODE), '입장 때 minRoomVer 로 새 방식을 켤지 정한다');
    chk(/_aliveV2 = true;[\s\S]{0,200}update\(_myMemberRef, \{ hb: ROOM_ALIVE_HB \}\)/.test(CODE), '  ↳ 켜지면 멤버 노드에 hb:2 를 한 번 싣는다');
    const hbBlock = (CODE.match(/_fbHeartbeat = setInterval\(\(\)=>\{([\s\S]*?)\}, 30000\);/) || [])[1] || '';
    chk(/30000/.test(CODE) && hbBlock.length > 0, '하트비트 간격은 30초 그대로');
    const v2 = (hbBlock.match(/if\(_aliveV2\)\{([\s\S]*?)\}else\{/) || [])[1] || '';
    chk(/set\(_myAliveRef, serverTimestamp\(\)\)/.test(v2) && !/lastSeen/.test(v2), '새 방식 하트비트 — 도장은 roomAlive 에만, 멤버 노드에 lastSeen 을 안 쓴다');
    chk(/if\(_expChanged\) update\(_myMemberRef, \{ exp: _exp \}\)/.test(v2), '  ↳ exp 는 바뀔 때만 멤버 노드에');
    chk(/update\(_myMemberRef, _hb\)\.catch\(\(\)=>_healMyMemberNode\('heartbeat'\)\)/.test(hbBlock), '옛 방식 하트비트는 예전처럼(멤버 노드 lastSeen · 거부되면 복구)');
    chk(/if\(isIndexToucher\(memberId, _roomLastFriends\)\) _touchRoomIndex\(room\);/.test(hbBlock), 'roomIndex 도장은 방마다 한 명만');
    chk(/if\(isMemberAlive\(m, now, STALE_MS\)\) friends\[id\] = m;/.test(CODE), '화면 생존 판정 — hb:2 는 노드가 있으면 산 것');
    chk(/isNewerSession\(id, friends\[id\], _byUser\[u\], friends\[_byUser\[u\]\]\)/.test(CODE), '같은 사람 중복 세션 — hb:2 는 memberId 로');
    chk(/if\(!_raw\[memberId\]\) _healMyMemberNode\('snapshot'\);/.test(CODE), '스냅샷에서 내 노드가 사라지면 복구 — 새 방식은 쓰기 거부 신호가 없다');
    chk(/if\(_aliveV2 && _myAliveRef\)\{ set\(_myAliveRef, serverTimestamp\(\)\)\.catch\(\(\)=>\{\}\); onDisconnect\(_myAliveRef\)\.remove\(\); \}/.test(CODE), '재접속 때 도장 · onDisconnect 를 다시 건다');
    chk(/if\(_myAliveRef\)\{[\s\S]{0,200}onDisconnect\(aref\)\.cancel\(\)[\s\S]{0,80}remove\(aref\)/.test(CODE), '나갈 때 도장도 지운다');
    chk((CODE.match(/isProbeAlive\(/g) || []).length === 2 && (CODE.match(/get\(ref\(db, `roomAlive\/\$\{room\}`\)\)/g) || []).length === 2, '입장 검사 둘(정원 · 시크릿룸)이 그 방 도장을 한 번씩 본다');
    chk(/m\.hb === ROOM_ALIVE_HB\) count\+\+/.test(CODE), '  ↳ 정원 검사 폴백(방 전체 읽기)도 hb:2 를 센다');
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

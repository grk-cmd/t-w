/*
 * 빈 방 표지(_meta · _chatTab) 청소를 앱에서 서버 함수로 옮긴 것 검사.
 * [왜] 앱의 «남은 사람 확인 → _meta 지우기» 는 한 덩어리가 아니라, 그 사이 다시 들어온 사람의 방에서 _meta 가 사라졌다
 *      (자동 업데이트로 다 같이 껐다 켤 때 투게더룸이 워킹룸으로).
 * 1. 앱 퇴장 — _meta · _chatTab · roomIndex 줄을 안 지우고 줄에 «비었음» 만 남긴다(떼어 와 돌림)
 * 2. 서버 함수 — 비었음 표시 뒤 2분 · 지우기 직전 멤버 재확인 · _meta 트랜잭션(가짜 DB · 경쟁 흉내)
 * 3. 들어오는 길 — 남은 _meta 가 있는 빈 방도 새로 연다(선점 · 시크릿룸 · 되살리기 · 방 서버) · 새 탭은 빈 기록
 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (f) => { const s = read(f); if(s == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } return s; };
const FI = need('firebase-init.js'), APP = need('app.js');
const FX = need('functions/index.js');
need('functions/room-stats.js');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(FI);
// 함수 몸통 떼기 — 이름부터 같은 들여쓰기의 닫는 줄까지
const grab = (src, head, end) => { const i = src.indexOf(head); if(i < 0) return ''; const j = src.indexOf(end, i); return j < 0 ? '' : src.slice(i, j + end.length); };

(async () => {
  say('── 1. 앱 퇴장 — 표지를 지우지 않고 «비었음» 만');
  {
    const leave = grab(CODE, 'async leaveRoom(){', '\n    },');
    chk(leave.length > 0, 'leaveRoom 을 찾았다');
    const fc = (leave.match(/const _finalCleanup = async \(keys\)=>\{[\s\S]*?\n {10}\};/) || [''])[0];
    chk(fc.length > 0, '_finalCleanup 을 찾았다');
    chk(!/_meta`\)\)/.test(fc) && !/\/_chatTab`/.test(fc), '★ _meta · _chatTab 을 통째로 지우지 않는다 (지우기는 서버 함수가 — 경쟁이 없다)');
    chk(!/remove\(ref\(db, `roomIndex\//.test(fc), '★ roomIndex 줄도 지우지 않는다 (서버가 이 줄로 빈 방을 찾는다)');
    // 떼어 와 돌린다 — 실제로 무엇을 쓰는지
    const ops = [];
    const run = new Function('ref', 'remove', 'update', 'serverTimestamp', 'db', 'KEEP_CHAT_LOG_ON_EMPTY', 'roomCodeForCleanup',
      fc + '\nreturn _finalCleanup;');
    const mk = (keep) => run((_d, p) => p, async (p) => { ops.push(['remove', p]); }, async (p, v) => { ops.push(['update', p, v]); },
      () => 'TS', {}, keep, 'PLAY-AB12');
    await mk(true)({ _meta: true, _chatTab: true, chatLog: true });
    chk(JSON.stringify(ops) === JSON.stringify([['remove', 'rooms/PLAY-AB12/_meta/openTs'], ['update', 'roomIndex/PLAY-AB12', { lastSeen: 0, emptyAt: 'TS' }]]),
      '쓰는 것은 둘뿐 — _meta/openTs 걷기 · 줄에 { lastSeen: 0, emptyAt: 서버시각 } (' + JSON.stringify(ops) + ')');
    ops.length = 0; await mk(true)({ chatLog: true });
    chk(ops.length === 1 && ops[0][0] === 'update', '  ↳ _meta 가 없으면 openTs 도 안 건드린다 · 비었음 표시는 남긴다');
    ops.length = 0; await mk(false)({ _meta: true, chatLog: true });
    chk(ops.some(o => o[1] === 'rooms/PLAY-AB12/chatLog'), '  ↳ KEEP_CHAT_LOG_ON_EMPTY 를 false 로 되돌리면 chatLog 지우기는 예전대로 돈다');
    chk(/if\(keys2 === null\) return;/.test(leave) && /filter\(_isMemberKey\)\.length === 0\) await _finalCleanup\(keys2\)/.test(leave),
      '동시 퇴장 시차 재조회는 그대로 — 못 읽으면 아무것도 안 남긴다');
    // 비었음 줄은 앱 어디서도 살아 있는 방으로 안 센다 (lastSeen 0)
    chk(/if\(!e\.lastSeen \|\| \(now - e\.lastSeen\) >= STALE\) continue;/.test(grab(CODE, 'async getRoomCounts(opts){', '\n    },')),
      '방 개수(getRoomCounts)는 lastSeen 0 줄을 안 센다');
    chk(/if\(!e\.lastSeen \|\| \(now - e\.lastSeen\) >= STALE\) continue;/.test(grab(CODE, 'async findRandomRooms(limit){', '\n    },')),
      '랜덤 참여 후보(findRandomRooms)도 안 고른다 — 빈 방으로 보내지 않는다');
    const RULES = JSON.parse(need('firebase-database-rules.json').replace(/^\s*\/\/[^\n]*$/mg, ''));
    const v = RULES.rules.roomIndex.$room['.validate'];
    chk(/newData\.child\('lastSeen'\)\.isNumber\(\)/.test(v) && !RULES.rules.roomIndex.$room.$other, '규칙: 줄은 lastSeen 숫자면 받는다 · 다른 칸(emptyAt)을 막지 않는다 — 규칙 변경 없음');
  }

  say('── 2. 서버 함수 — 2분 뒤 · 멤버 재확인 · _meta 트랜잭션');
  {
    const f = require(path.resolve('functions/room-stats.js'));
    const now = 1e12, MIN = 60 * 1000;
    chk(f.EMPTY_GRACE_MS === 2 * MIN, '유예 2분 (1분 주기의 2~3번째 실행)');
    chk(f.isEmptyMark({ lastSeen: 0, emptyAt: now }) && !f.isEmptyMark({ lastSeen: now + 1, emptyAt: now }) && !f.isEmptyMark({ lastSeen: now }) && !f.isEmptyMark(null),
      '비었음 표시 = emptyAt 이 있고 그 뒤 하트비트가 없을 때만');
    const { empty, drop, stats } = f.roomStatsFrom({
      E3: { lastSeen: 0, emptyAt: now - 3 * MIN, channel: 'togetherroom' },
      E1: { lastSeen: 0, emptyAt: now - 1 * MIN },
      BACK: { lastSeen: now - 5000, emptyAt: now - 3 * MIN, channel: 'togetherroom' },   // 다시 들어와 하트비트가 찍힘
      CRASH: { lastSeen: now - 5 * MIN },                                                  // 표시 없이 조용 — 절전 · 강제 종료
      'SCRT-A': { lastSeen: 0, emptyAt: now - 3 * MIN },
    }, now);
    chk(JSON.stringify(empty.sort()) === '["E3","SCRT-A"]', '청소 후보 = 표시 뒤 2분 넘은 줄만 (' + JSON.stringify(empty) + ') — 1분 · 다시 들어옴 · 표시 없는 조용한 줄은 아님');
    chk(drop.length === 0, '★ lastSeen 0 이어도 10분 청소(drop)는 emptyAt 기준이라 바로 안 지운다');
    chk(stats.togetherroom === 1 && stats.workingroom === 0, '비었음 줄은 안 센다 · 다시 들어온 방은 센다');

    // 가짜 Admin DB — 경로별 서버 값. 트랜잭션은 첫 호출을 로컬 추측값(null)으로, null 을 돌려주면 서버 값으로 다시 부른다.
    const mkDb = (srv, o) => {
      o = o || {};
      const L = { srv, ops: [], reads: [] };
      const val = (p) => (srv[p] !== undefined ? srv[p] : null);
      const db = { ref: (p) => ({
        toString: () => 'https://x.firebaseio.com/' + (p || ''),
        get: async () => {
          L.reads.push(p);
          if(o.failGet && o.failGet(p)) throw new Error('get ' + p);
          if(p === 'roomIndex'){ const out = {}; for(const k in srv) if(k.startsWith('roomIndex/')) out[k.slice(10)] = srv[k]; return { val: () => out }; }
          if(p === 'roomAlive') return { val: () => (o.alive || null) };
          return { val: () => val(p) };
        },
        remove: async () => { L.ops.push(['remove', p]); for(const k of Object.keys(srv)) if(k === p || k.startsWith(p + '/')) delete srv[k]; },
        transaction: async (fn) => {
          if(p === 'roomStats') return { committed: true };
          if(o.beforeTx) o.beforeTx(p, srv);
          const cur = val(p);
          let r = fn(null);
          if(r === null && cur !== null) r = fn(JSON.parse(JSON.stringify(cur)));
          if(r !== undefined){ L.ops.push(['tx', p, r]); if(r === null) delete srv[p]; else srv[p] = r; }
          return { committed: r !== undefined, snapshot: { val: () => (r !== undefined ? r : cur) } };
        },
      }) };
      // shallow(키만) — 그 경로 바로 아래 키
      const shallow = async (p) => {
        L.reads.push('shallow:' + p);
        if(o.failShallow) throw new Error('shallow 500');
        const out = {};
        for(const k in srv) if(k.startsWith(p + '/')) out[k.slice(p.length + 1).split('/')[0]] = true;
        return Object.keys(out).length ? out : null;
      };
      return { db, L, shallow };
    };
    // 지표 요약(daily-summary)은 이 가짜 DB 에 없어 경고를 낸다 — 이 검사와 무관해서 같이 끈다.
    const quiet = async (fn) => { const q = console.log, w = console.warn; console.log = console.warn = () => {}; try{ return await fn(); } finally { console.log = q; console.warn = w; } };
    const room = (code, extra) => Object.assign({
      ['roomIndex/' + code]: { lastSeen: 0, emptyAt: now - 3 * MIN, channel: 'togetherroom' },
      ['rooms/' + code + '/_meta']: { channel: 'togetherroom', host: 'uA', ts: now - 30 * MIN, openTs: now - 30 * MIN, tabs: { s1: { name: '공부', ts: 1 } } },
      ['rooms/' + code + '/_chatTab/s1/k1']: { name: 'a', text: 'hi', ts: 1 },
      ['rooms/' + code + '/chatLog/k1']: { name: 'a', text: 'hi', ts: 1 },
    }, extra || {});
    const run = async (srv, o) => { const m = mkDb(srv, o); const sum = await quiet(() => f.runRoomStats(m.db, now, { shallow: m.shallow })); return { srv: m.L.srv, L: m.L, sum }; };

    let r = await run(room('P1'));
    chk(!('rooms/P1/_meta' in r.srv) && !Object.keys(r.srv).some(k => k.startsWith('rooms/P1/_chatTab')) && !('roomIndex/P1' in r.srv),
      '빈 채로 2분 넘은 방 — _meta · _chatTab · 줄을 걷는다');
    chk('rooms/P1/chatLog/k1' in r.srv, '  ↳ chatLog 는 남긴다 (KEEP_CHAT_LOG_ON_EMPTY)');
    chk(r.sum.emptied && r.sum.emptied.cleared === 1, '  ↳ 요약에 남는다 (emptied.cleared 1)');
    chk(r.L.reads.filter(p => p === 'roomAlive').length === 1, '  ↳ roomAlive 트리는 한 번만 읽는다 (유령 청소와 같이 쓴다)');
    chk(!r.L.reads.some(p => /^rooms\/[^/]+$/.test(p) || p === 'rooms'), '  ↳ 방 노드를 통째로 받지 않는다 (shallow · 칸 하나씩)');

    r = await run(room('P2', { 'roomIndex/P2': { lastSeen: 0, emptyAt: now - 1 * MIN } }));
    chk('rooms/P2/_meta' in r.srv && 'roomIndex/P2' in r.srv && !r.L.reads.includes('shallow:rooms/P2'), '2분 안 됐으면 아무것도 안 한다 (읽지도 않는다)');

    r = await run(room('P3', { 'rooms/P3/m1/hb': 2, 'rooms/P3/m1/name': 'b' }));
    chk('rooms/P3/_meta' in r.srv && r.srv['rooms/P3/_meta'].channel === 'togetherroom', '★ 그새 다시 들어온 사람(hb:2 노드)이 있으면 _meta 를 안 지운다');
    chk(r.srv['roomIndex/P3'] && !('emptyAt' in r.srv['roomIndex/P3']) && r.srv['roomIndex/P3'].channel === 'togetherroom', '  ↳ 비었음 표시만 걷는다 (다음 실행에 다시 안 본다)');
    chk('rooms/P3/_chatTab/s1/k1' in r.srv, '  ↳ 탭 기록도 그대로');

    r = await run(room('P4', { 'rooms/P4/m1/lastSeen': now - 4 * MIN }));
    chk('rooms/P4/_meta' in r.srv, '옛 방식 멤버 lastSeen 4분 — 있는 것으로 본다 (입장 검사 5분보다 넉넉한 10분)');
    r = await run(room('P5', { 'rooms/P5/m1/lastSeen': now - 20 * MIN }));
    chk(!('rooms/P5/_meta' in r.srv), '  ↳ 20분 넘게 조용한 옛 노드(유령)는 없는 것으로 — 걷는다');
    r = await run(room('P6', { 'rooms/P6/m1/name': 'x' }));
    chk('rooms/P6/_meta' in r.srv, '  ↳ lastSeen 이 아예 없는 노드는 있는 것으로 (입장 검사와 같다)');
    r = await run(room('P7'), { alive: { P7: { mz1: now - 10 * 1000 } } });
    chk('rooms/P7/_meta' in r.srv, 'roomAlive 도장이 신선하면 있는 것으로 (멤버 키를 읽기 전에)');
    r = await run(room('P8'), { alive: { P8: { mz1: now - 10 * MIN } } });
    chk(!('rooms/P8/_meta' in r.srv), '  ↳ 낡은 도장은 사람으로 안 친다');

    r = await run(room('P9', { 'rooms/P9/_meta': { channel: 'workingroom', host: 'uB', ts: now - 20 * 1000, openTs: now - 20 * 1000 } }));
    chk('rooms/P9/_meta' in r.srv && r.srv['rooms/P9/_meta'].host === 'uB' && 'roomIndex/P9' in r.srv && 'rooms/P9/_chatTab/s1/k1' in r.srv,
      '★ _meta 를 2분 안에 누가 썼으면(빈 방 선점 · 만들기) 그만둔다 — 줄 · 탭 기록도 그대로');

    // 경쟁 흉내 — 멤버를 다시 본 뒤 · _meta 트랜잭션 직전에 누가 빈 방 선점을 했다
    r = await run(room('PA'), { beforeTx: (p, srv) => { if(p === 'rooms/PA/_meta') srv['rooms/PA/_meta'] = { channel: 'workingroom', host: 'uC', ts: now, openTs: now }; } });
    chk(r.srv['rooms/PA/_meta'] && r.srv['rooms/PA/_meta'].host === 'uC', '★ 재확인 뒤 지우기 직전에 들어와 선점해도 트랜잭션이 서버 값으로 다시 돌아 그만둔다');
    chk('roomIndex/PA' in r.srv && r.sum.emptied.kept === 1, '  ↳ 줄도 안 지운다 (kept)');
    r = await run(room('PB'), { beforeTx: (p, srv) => { if(p === 'roomIndex/PB') srv['roomIndex/PB'] = { lastSeen: now, emptyAt: now - 3 * MIN, channel: 'workingroom' }; } });
    chk(!('rooms/PB/_meta' in r.srv) && r.srv['roomIndex/PB'] && r.srv['roomIndex/PB'].lastSeen === now,
      '  ↳ _meta 를 지운 뒤 들어오면 그 사람이 새로 연다 — 하트비트가 찍힌 줄은 안 지운다');

    r = await run(room('PC'), { failShallow: true });
    chk('rooms/PC/_meta' in r.srv && 'roomIndex/PC' in r.srv && r.sum.emptied.failed === 1, '멤버 키를 못 읽으면 안 지운다');
    r = await run(room('PD'), { failGet: (p) => p === 'roomAlive' });
    chk('rooms/PD/_meta' in r.srv && !r.L.reads.includes('shallow:rooms/PD'), 'roomAlive 를 못 읽으면 빈 방 청소는 쉰다');
    r = await run(room('PE', { 'rooms/PE/m1/lastSeen': now - 20 * MIN }), { failGet: (p) => p === 'rooms/PE/m1/hb' });
    chk('rooms/PE/_meta' in r.srv, '멤버 칸을 못 읽어도 안 지운다');

    r = await run(room('SCRT-Q'));
    chk(!('rooms/SCRT-Q/_meta' in r.srv) && !('roomIndex/SCRT-Q' in r.srv), '시크릿룸도 같은 길 — 줄은 비었음 표시로만 생기고 같이 걷힌다');
    r = await run({ 'roomIndex/GONE': { lastSeen: 0, emptyAt: now - 3 * MIN } });
    chk(!('roomIndex/GONE' in r.srv), '방 노드가 아예 없으면 줄만 걷는다');

    // 옛 앱 · 표시 없는 방은 건드리지 않는다
    r = await run({ 'roomIndex/OLD': { lastSeen: now - 5 * MIN, channel: 'togetherroom' }, 'rooms/OLD/_meta': { channel: 'togetherroom', ts: now - 60 * MIN } });
    chk('rooms/OLD/_meta' in r.srv && 'roomIndex/OLD' in r.srv, '★ 비었음 표시 없이 조용해진 방(절전 · 강제 종료)은 안 건드린다 — 깨어난 사람이 표지를 잃지 않게');

    // 열림 · 닫힘 트리거는 세기만
    {
      const m = mkDb(room('LT'));
      await quiet(() => f.runRoomStats(m.db, now, { drop: false, shallow: m.shallow }));
      chk('rooms/LT/_meta' in m.L.srv && !m.L.reads.includes('roomAlive'), 'drop:false(트리거)는 청소 안 함 · roomAlive 도 안 읽는다');
    }
    chk(/exports\.roomStatsOnOpen = onValueCreated\([\s\S]{0,200}if \(require\('\.\/room-stats'\)\.isEmptyMark\(event\.data && event\.data\.val\(\)\)\) return;/.test(FX),
      '줄 생성 트리거는 비었음 표시로 생긴 줄(시크릿룸 등)에 roomIndex 를 다시 읽지 않는다');
    chk(/exports\.roomStats = onSchedule\(\{ schedule: 'every 1 minutes'/.test(FX), '청소는 1분 주기 함수에 붙었다 — 새 예약 함수 없음');
  }

  say('── 3. 들어오는 길 — 남은 _meta 가 있는 빈 방');
  {
    const claim = grab(FI, 'async claimEmptyRoom(room, myUserId, licensed){', '\n    },');
    const txSrc = (claim.match(/runTransaction\(ref\(db, `rooms\/\$\{room\}\/_meta`\), (cur => \{[\s\S]*?\n {8}\})\);/) || [])[1];
    chk(!!txSrc, 'claimEmptyRoom 트랜잭션을 찾았다');
    const NOW = 5e11;
    const FRESH = +((claim.match(/const FRESH = (\d+)\*1000;/) || [])[1] || 0) * 1000;
    chk(FRESH === 20000, '동시 입장 창 FRESH 20초');
    const mkTx = new Function('_svNow', 'myUserId', 'licensed', 'FRESH', 'return (' + txSrc + ');');
    const tx = (svNow, me, lic) => mkTx(svNow, me, lic, FRESH);
    const stale = { channel: 'togetherroom', host: 'uOld', openLic: true, openTs: NOW - 5 * 60000, ts: NOW - 5 * 60000,
                    open: true, chatOff: true, restoredTs: NOW - 9 * 60000, tabs: { s1: { name: '공부', ts: 1 } } };
    const out = tx(() => NOW, 'uMe', false)(JSON.parse(JSON.stringify(stale)));
    chk(out && out.host === 'uMe' && out.channel === 'workingroom' && out.openTs === NOW,
      '지난 방 _meta 가 남은 빈 방 — 미보유자가 들어오면 워킹룸 · 방장 나 (빈 방 승격 그대로)');
    chk(out && !('tabs' in out) && !('open' in out) && !('chatOff' in out) && !('restoredTs' in out),
      '★ 지난 방의 탭 · 랜덤 허용 · 채팅 잠금 · 되살림 표시를 물려받지 않는다 (' + JSON.stringify(out) + ')');
    const lic = tx(() => NOW, 'uMe', true)(JSON.parse(JSON.stringify(stale)));
    chk(lic && lic.channel === 'togetherroom' && lic.openLic === true && !lic.tabs, '  ↳ 보유자는 투게더룸으로 새로');
    const just = { channel: 'togetherroom', host: 'uOther', openLic: true, openTs: NOW - 2000, ts: NOW - 2000 };
    chk(tx(() => NOW, 'uMe', false)(Object.assign({}, just)) === undefined, '방금(20초 안) 다른 보유자가 연 방엔 양보한다 (동시 입장 그대로)');
    const flip = tx(() => NOW, 'uMe', true)(Object.assign({}, just, { openLic: false, channel: 'workingroom', open: true }));
    chk(flip && flip.channel === 'togetherroom' && flip.open === true, '  ↳ 나만 보유자면 뒤집는다 — 방금 연 방의 값은 그대로 둔다');
    chk(tx(() => NOW, 'uMe', false)(null).host === 'uMe', '_meta 가 없으면(서버가 걷은 뒤) 그대로 새로 연다');
    // 퇴장이 openTs 를 걷으므로 «열자마자 비운 방» 도 양보하지 않는다
    const leftQuick = Object.assign({}, just); delete leftQuick.openTs;
    chk(tx(() => NOW, 'uMe', false)(leftQuick).host === 'uMe', '열자마자 비운 방(퇴장이 openTs 를 걷음)엔 양보하지 않고 새로 연다');

    // 빈 방 판정은 checkRoomCapacity(멤버만) — _meta 가 남아 있어도 0 명
    const cap = grab(CODE, 'async checkRoomCapacity(room){', '\n    },');
    chk(/const ids = Object\.keys\(keys\)\.filter\(id => id\.charAt\(0\) !== '_' && id !== 'chatLog'\);/.test(cap), '정원 검사는 _meta · _chatTab · chatLog 를 사람으로 안 센다 — 남은 표지가 있어도 빈 방');
    chk(/if\(_roomCount === 0\)\{[\s\S]{0,1200}firebaseAPI\.claimEmptyRoom\(code, getMyUserId\(\), _iAmLicensed\)/.test(APP), '빈 방(0명)이면 선점(claimEmptyRoom)으로 연다');
    // 시크릿룸 · 되살리기 · 방 서버
    chk(/if\(_isSecret\)\{[\s\S]{0,400}firebaseAPI\.setRoomChannel\(code, 'togetherroom', _secretOwner\)/.test(APP), '시크릿룸은 들어올 때마다 channel · host(주인) · ts 를 다시 쓴다 — 남은 _meta 도 주인 방으로');
    const restore = grab(FI, 'async restoreRoomMeta(room, m){', '\n    },');
    chk(/const meta = \{ channel:/.test(restore) && /meta\.ts = meta\.openTs = meta\.restoredTs = _svNow\(\);/.test(restore), '되살리기는 _meta 를 새 객체로 쓴다 (남은 값 안 물려받음) · ts 를 찍는다');
    chk(/const _via = await _startRoomOnServer\(code,[\s\S]{0,80}if\(_via !== 'firebase'\) return;/.test(APP), '방 서버 방은 Firebase _meta 를 쓰기 전에 갈라진다 — 이 청소와 무관');
    // 새 탭은 빈 기록으로
    const add = grab(FI, 'async addChatTab(room, name){', '\n    },');
    chk(/return \{ ok:false, reason: full[^\n]*\n[\s\S]{0,400}await remove\(ref\(db, _chatLogPath\(room, id\)\)\)\.catch\(\(\)=>\{\}\);\s*return \{ ok:true, id \};/.test(add),
      '새 탭 자리는 기록을 비우고 연다 — 서버가 걷기 전 다시 연 방에서 지난 탭 기록이 딸려 나오지 않게');
  }

  say('');
  say(fail ? '문제 ' + fail + '건 (통과 ' + pass + ')' : '전부 통과 ✅ ' + pass + '건 — 표지는 서버가 2분 뒤 다시 보고 걷는다');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

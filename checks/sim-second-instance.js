/* ═══ 🔁 sim-second-instance.js — 두 번째 실행: 옛 창이 멀쩡하면 앞으로 · 쓸 수 없으면 정리하고 새로 띄움 (2026-10-16 신설) ═══
   [사용자 결정] 옛 인스턴스의 메인 창이 없거나 응답이 없으면(렌더러 죽음 · 'unresponsive') 앞으로 올리지 말고 정리 후 새로 띄운다.
     멀쩡하면 지금처럼 앞으로 올리기만 한다(재시작하면 방에서 튕긴다).
   [10-17 사용자 결정] 응답 없음은 10초(RELAUNCH_HUNG_MS) 이상 이어졌을 때만 새로 띄운다 — 잠깐 멈춤(로딩 · GC)으로 튕기지 않게.
     창 없음 · 파괴 · 렌더러 죽음은 지금처럼 바로.
   main.js 의 판정 · 상태 모으기 · 정리 · second-instance 처리기를 떼어 가짜 app / 창으로 굴린다.
   ・1절: _secondInstanceAction 표 — 부팅 중(wait) · 창 없음 · 파괴 · 렌더러 죽음(relaunch) · 응답 없음 9.9초(focus) / 10초 · 10.1초(relaunch) · 멀쩡(focus) · 빈 입력
   ・1-2절: 사건열 — unresponsive 신호 → 9.9초 뒤 두 번째 실행(앞으로) → 10.1초 뒤(새로 띄움) · responsive 오면 초기화 · 다시 멈추면 새로 셈
   ・2절: _mainWindowHealth — 가짜 창에서 신호를 읽는다(isDestroyed · webContents.isCrashed · 응답 없음 시작 시각 · 던지는 창)
   ・3절: second-instance 처리기 — focus 면 restore/show/focus 만 · relaunch 면 relaunch → 훅 · 타이머 정리 → 창 destroy → exit(0)(quit 아님)
   ・4절: 배선 — unresponsive 가 시작 시각을 적고(이미 있으면 그대로) / responsive 가 지우고 · 처리기가 지금 시각을 넘김 · 창을 만들 때 created 표시
   ・5절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const MAIN0 = ['main.js'].map(f => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean);
if(!MAIN0){ console.log('  ? 원본 못 찾음 — main.js'); process.exit(2); }

function fnText(src, name){
  const i = src.search(new RegExp('^function ' + name + '\\(', 'm'));
  if(i < 0) return null;
  const j = src.indexOf('\n}\n', i);
  return j < 0 ? null : src.slice(i, j + 2);
}
function handlerText(src){
  const k = "app.on('second-instance', ";
  const i = src.indexOf(k);
  if(i < 0) return null;
  const j = src.indexOf('\n  });', i);
  return j < 0 ? null : src.slice(i + k.length, j + 4);
}

function wireText(src){
  const watch = (src.match(/function _watchRendererHealth\(win\)\{[\s\S]*?\n\}/) || [''])[0];
  const lines = watch.split('\n').filter(l => /^  win\.on\('(un)?responsive',/.test(l));
  return lines.length === 2 ? lines.join('\n') : null;
}
function sandbox(src){
  const parts = ['_secondInstanceAction', '_mainWindowHealth', '_exitNow', '_relaunchFresh'].map(n => fnText(src, n));
  const h = handlerText(src);
  const hung = (src.match(/^const RELAUNCH_HUNG_MS = .*$/m) || [])[0];
  const wire = wireText(src);
  if(parts.some(p => !p) || !h || !hung || !wire) return null;
  const E = { log: [], calls: [], ready: true, wins: [], now: 1000000 };
  const app = {
    isReady: () => E.ready,
    relaunch: () => E.calls.push('relaunch'),
    exit: (c) => E.calls.push('exit ' + c),
    quit: () => E.calls.push('quit'),
  };
  const BW = { getAllWindows: () => E.wins };
  const sysinput = { stopGlobalHooks: () => E.calls.push('hooks') };
  const unresp = new WeakMap();
  const FakeDate = { now: () => E.now };
  const api = new Function('app', 'BrowserWindow', 'sysinput', '_diagLog', '_unresponsiveSince', 'clearInterval', 'Date',
    'let mainWindow = null, _mainWindowCreated = false, _cursorWatchTimer = null, _pollTimer = null;\n' + hung + '\n' + parts.join('\n') +
    '\nconst handler = ' + h + ';\nfunction wire(win){\n' + wire + '\n}\nreturn { act: _secondInstanceAction, health: _mainWindowHealth, handler, wire, HUNG: RELAUNCH_HUNG_MS,' +
    ' set(o){ if("mw" in o) mainWindow = o.mw; if("created" in o) _mainWindowCreated = o.created; if("cur" in o) _cursorWatchTimer = o.cur; if("poll" in o) _pollTimer = o.poll; },' +
    ' timers(){ return [_cursorWatchTimer, _pollTimer]; } };')(app, BW, sysinput, (m) => E.log.push(m), unresp, (id) => E.calls.push('clear ' + id), FakeDate);
  return Object.assign(E, api, { unresp });
}
function fakeWin(E, o){
  o = o || {};
  const w = {
    _min: !!o.min,
    isDestroyed: () => { if(o.throwDestroyed) throw new Error('x'); return !!o.destroyed; },
    isMinimized: () => w._min,
    restore: () => E.calls.push('restore'), show: () => E.calls.push('show'), focus: () => E.calls.push('focus'),
    destroy: () => E.calls.push('destroy'),
    _on: {}, on: (ev, fn) => { w._on[ev] = fn; }, emit: (ev) => w._on[ev] && w._on[ev](),
    webContents: o.noWc ? null : { isDestroyed: () => !!o.wcDestroyed, isCrashed: () => { if(o.throwCrashed) throw new Error('y'); return !!o.crashed; } },
  };
  return w;
}

function judge(MAIN){
  const S = sandbox(MAIN);
  say('── 1. 판정 표 — _secondInstanceAction');
  chk(!!S, 'main.js 에서 판정 · 상태 · 정리 · 처리기를 떼어 굴릴 수 있다');
  if(!S) return;
  chk(S.HUNG === 10000, '응답 없음 기준은 상수 하나 — RELAUNCH_HUNG_MS 10초 (' + S.HUNG + ')');
  const NOW = 5000000;
  const ok = { ready: true, created: true, hasWindow: true, destroyed: false, crashed: false, hungSince: null };
  const T = [
    [{ ...ok }, 'focus', '멀쩡 — 앞으로 올리기만'],
    [{ ...ok, ready: false }, 'wait', '앱 준비 전 — 아무것도 안 함(부팅 중인 앱을 죽이지 않는다)'],
    [{ ...ok, created: false, hasWindow: false }, 'wait', '창을 만들기 전 — 아무것도 안 함'],
    [{ ...ok, hasWindow: false }, 'relaunch', '만들었던 창이 없음 — 새로 띄움'],
    [{ ...ok, destroyed: true }, 'relaunch', '창 파괴됨 — 새로 띄움'],
    [{ ...ok, crashed: true }, 'relaunch', '렌더러 죽음 — 새로 띄움'],
    [{ ...ok, hungSince: NOW }, 'focus', '응답 없음이 막 시작 — 앞으로만(잠깐 멈춤으로 튕기지 않게)'],
    [{ ...ok, hungSince: NOW - 9900 }, 'focus', '응답 없음 9.9초 — 앞으로만'],
    [{ ...ok, hungSince: NOW - 10000 }, 'relaunch', '응답 없음 10초 — 새로 띄움(경계 포함)'],
    [{ ...ok, hungSince: NOW - 10100 }, 'relaunch', '응답 없음 10.1초 — 새로 띄움'],
    [{ ...ok, hungSince: NOW + 500 }, 'focus', '  시각이 뒤집혀도(시계 조정) 앞으로만'],
    [{ ...ok, hasWindow: false, hungSince: NOW }, 'relaunch', '  창 없음은 응답 없음 시간과 상관없이 바로'],
    [{ ...ok, crashed: true, hungSince: NOW - 100 }, 'relaunch', '  렌더러 죽음도 바로'],
    [{ ...ok, ready: false, hungSince: NOW - 60000 }, 'wait', '  부팅 중이면 다른 신호보다 wait 가 먼저'],
  ];
  T.forEach(([inp, want, msg]) => { const got = S.act(inp, NOW); chk(got === want, msg + ' (' + got + ')'); });
  chk(S.act(undefined, NOW) === 'wait' && S.act({}, NOW) === 'wait' && S.act(null, NOW) === 'wait', '  빈 입력 — wait(던지지 않음)');
  chk(S.act({ ...ok, hungSince: NOW - 60000 }) === 'focus', '  지금 시각이 없으면 응답 없음만으로 새로 띄우지 않는다');

  say('── 1-2. 사건열 — unresponsive · responsive 신호 → 두 번째 실행');
  {
    const run = (steps) => {
      const E = sandbox(MAIN); const w = fakeWin(E, {}); E.set({ created: true, mw: w }); E.wire(w);
      const t0 = E.now, out = [];
      for(const [at, what] of steps){
        E.now = t0 + at;
        if(what === 'si'){ E.calls.length = 0; E.handler(); out.push(E.calls.includes('relaunch') ? 'relaunch' : E.calls.includes('focus') ? 'focus' : 'none'); }
        else w.emit(what);
      }
      return out.join();
    };
    chk(run([[0, 'unresponsive'], [9900, 'si']]) === 'focus', '멈춤 9.9초에 두 번째 실행 → 앞으로만');
    chk(run([[0, 'unresponsive'], [10100, 'si']]) === 'relaunch', '멈춤 10.1초에 두 번째 실행 → 정리하고 새로 띄움');
    chk(run([[0, 'unresponsive'], [9900, 'si'], [10100, 'si']]) === 'focus,relaunch', '  같은 멈춤이 이어지면 9.9초 앞으로 → 10.1초 새로 띄움');
    chk(run([[0, 'unresponsive'], [5000, 'responsive'], [10100, 'si']]) === 'focus', 'responsive 가 오면 초기화 — 10.1초여도 앞으로만');
    chk(run([[0, 'unresponsive'], [5000, 'responsive'], [6000, 'unresponsive'], [15900, 'si'], [16100, 'si']]) === 'focus,relaunch',
      '  다시 멈추면 그 시각부터 새로 셈(6초 시작 → 15.9초 앞으로 · 16.1초 새로 띄움)');
    chk(run([[0, 'unresponsive'], [8000, 'unresponsive'], [10100, 'si']]) === 'relaunch', '  unresponsive 가 또 와도 처음 시작 시각을 지킨다');
    {
      const E = sandbox(MAIN); E.set({ created: true, mw: null }); E.handler();
      chk(E.calls[0] === 'relaunch', '창 없음 → 기다리지 않고 바로 새로 띄움');
      const E2 = sandbox(MAIN); const w = fakeWin(E2, { destroyed: true }); E2.set({ created: true, mw: w }); E2.handler();
      chk(E2.calls[0] === 'relaunch', '  창 파괴됨 → 바로 새로 띄움');
    }
  }

  say('── 2. 상태 모으기 — _mainWindowHealth');
  S.set({ created: false, mw: null });
  let h = S.health();
  chk(h.ready === true && h.created === false && h.hasWindow === false && S.act(h) === 'wait', '창을 만들기 전 → wait');
  S.set({ created: true, mw: null }); h = S.health();
  chk(h.hasWindow === false && S.act(h) === 'relaunch', '만든 뒤 창이 사라짐 → relaunch');
  const cases = [
    [{}, 'focus', '멀쩡한 창'],
    [{ destroyed: true }, 'relaunch', 'isDestroyed() 참'],
    [{ throwDestroyed: true }, 'relaunch', 'isDestroyed() 가 던짐 — 파괴로 본다'],
    [{ crashed: true }, 'relaunch', 'webContents.isCrashed() 참'],
    [{ wcDestroyed: true }, 'relaunch', 'webContents 파괴'],
    [{ noWc: true }, 'relaunch', 'webContents 없음'],
    [{ throwCrashed: true }, 'relaunch', 'isCrashed() 가 던짐 — 죽은 것으로 본다'],
  ];
  cases.forEach(([o, want, msg]) => { const w = fakeWin(S, o); S.set({ mw: w }); chk(S.act(S.health()) === want, msg + ' → ' + want); });
  const w2 = fakeWin(S, {}); S.set({ mw: w2 });
  chk(S.health().hungSince === null, '응답 없음 기록이 없으면 hungSince null');
  S.unresp.set(w2, 123);
  chk(S.health().hungSince === 123 && S.act(S.health(), 123 + 10100) === 'relaunch', '응답 없음 시작 시각을 읽는다 → 10.1초 뒤 relaunch');
  S.unresp.delete(w2);
  chk(S.health().hungSince === null && S.act(S.health(), 123 + 10100) === 'focus', '  기록이 빠지면 다시 focus');

  say('── 3. second-instance 처리기');
  {
    const E = sandbox(MAIN); const w = fakeWin(E, { min: true }); E.set({ created: true, mw: w, cur: 11, poll: 22 }); E.wins = [w];
    E.handler();
    chk(E.calls.join() === 'restore,show,focus', '멀쩡 — restore · show · focus 만(재시작 · 종료 없음) (' + E.calls.join() + ')');
  }
  {
    const E = sandbox(MAIN); const w = fakeWin(E, {}); E.set({ created: true, mw: w });
    E.handler();
    chk(E.calls.join() === 'show,focus', '  최소화 아니면 restore 없이 show · focus');
  }
  {
    const E = sandbox(MAIN); const w = fakeWin(E, { crashed: true }), other = fakeWin(E, {}), gone = fakeWin(E, { destroyed: true });
    E.set({ created: true, mw: w, cur: 11, poll: 22 }); E.wins = [w, other, gone];
    E.handler();
    chk(E.calls.join() === 'relaunch,hooks,clear 11,clear 22,destroy,destroy,exit 0',
      '쓸 수 없음 — relaunch 예약 → 전역 훅 · 타이머 정리 → 살아 있는 창 destroy → exit(0) (' + E.calls.join() + ')');
    chk(!E.calls.includes('quit') && !E.calls.includes('show') && !E.calls.includes('focus'), '  quit 이 아니라 exit(0) · 죽은 창은 앞으로 올리지 않는다');
    chk(E.timers().join() === ',', '  타이머 변수도 비운다');
    chk(E.log.length === 1 && /정리하고 새로 띄움/.test(E.log[0]), '  진단 로그에 한 줄(왜 새로 띄웠는지)');
  }
  {
    const E = sandbox(MAIN); E.set({ created: false, mw: null }); E.handler();
    chk(E.calls.length === 0, '부팅 중 — 아무것도 안 한다');
    E.ready = false; E.set({ created: true }); E.handler();
    chk(E.calls.length === 0, '  준비 전도 아무것도 안 한다');
  }

  say('── 4. 배선');
  const watch = (MAIN.match(/function _watchRendererHealth\(win\)\{[\s\S]*?\n\}/) || [''])[0];
  chk(/win\.on\('unresponsive', \(\) => \{ if\(!_unresponsiveSince\.has\(win\)\) _unresponsiveSince\.set\(win, Date\.now\(\)\);/.test(watch) && /win\.on\('responsive', +\(\) => \{ _unresponsiveSince\.delete\(win\);/.test(watch),
    'unresponsive 가 시작 시각을 적고 · responsive 가 지운다(Electron 신호)');
  chk(/^const _unresponsiveSince = new WeakMap\(\);/m.test(MAIN), '  기록은 WeakMap(창이 사라지면 같이 사라짐) · 시작 시각은 한 곳');
  chk(/_secondInstanceAction\(health, Date\.now\(\)\)/.test(handlerText(MAIN) || ''), '  처리기가 지금 시각을 넘긴다');
  const iC = MAIN.indexOf('  _mainWindowCreated = true;\n  _watchRendererHealth(mainWindow);');
  const iL = MAIN.indexOf("mainWindow.loadFile(path.join(__dirname, 'app', 'desk-companion-prototype.html'));");
  chk(iC > 0 && iL > iC, '창을 만들 때(로드 전) created 표시');
}

judge(MAIN0);

say('── 5. 일부러 깨 보기');
const BREAKS = [
  ["  if(!s || !s.ready || !s.created) return 'wait';", "  if(!s) return 'wait';", '부팅 중에도 새로 띄움'],
  ["  if(s.hungSince == null || !(now - s.hungSince >= RELAUNCH_HUNG_MS)) return 'focus';\n  return 'relaunch';", "  return 'focus';", '응답 없음을 못 봄'],
  ['s.destroyed || s.crashed)', 's.destroyed)', '렌더러 죽음을 못 봄'],
  ['now - s.hungSince >= RELAUNCH_HUNG_MS', 's.hungSince != null', '응답 없음이면 바로 새로 띄움(10초 안 기다림)'],
  ['const RELAUNCH_HUNG_MS = 10000;', 'const RELAUNCH_HUNG_MS = 5000;', '기준 시간을 바꿈'],
  ['if(!_unresponsiveSince.has(win)) _unresponsiveSince.set(win, Date.now());', '_unresponsiveSince.set(win, Date.now());', 'unresponsive 가 또 오면 시작 시각을 덮어씀'],
  ['_secondInstanceAction(health, Date.now())', '_secondInstanceAction(health)', '처리기가 지금 시각을 안 넘김'],
  ["function _exitNow(){", "function _exitNow(){ return app.quit();", 'exit(0) 대신 quit'],   // 끝내기는 main.js _exitNow() 하나(session-end 와 같이 쓴다)
  ["  _exitNow();\n}", "}", '새로 띄우기 뒤 끝내기를 안 부름'],
  ["  try{ app.relaunch(); }catch(e){ _diagLog('[중복 실행] relaunch", "  try{ (0); }catch(e){ _diagLog('[중복 실행] relaunch", 'relaunch 를 안 부름'],
  ["    if (act === 'relaunch') { _relaunchFresh(health); return; }\n", '', '쓸 수 없는데 앞으로만 올림'],
  ["_unresponsiveSince.delete(win);", '0;', '응답 재개를 안 지움'],
  ["  if(_unresponsiveSince.has(w)) s.hungSince = _unresponsiveSince.get(w);\n", '', '응답 없음 기록을 안 읽음'],
];
const caught = [];
for(const [from, to, what] of BREAKS){
  if(MAIN0.indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  quiet = true; qfail = 0;
  try{ judge(MAIN0.split(from).join(to)); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, n]) => n === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

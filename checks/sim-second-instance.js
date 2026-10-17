/* ═══ 🔁 sim-second-instance.js — 두 번째 실행: 옛 창이 멀쩡하면 앞으로 · 쓸 수 없으면 정리하고 새로 띄움 (2026-10-16 신설) ═══
   [사용자 결정] 옛 인스턴스의 메인 창이 없거나 응답이 없으면(렌더러 죽음 · 'unresponsive') 앞으로 올리지 말고 정리 후 새로 띄운다.
     멀쩡하면 지금처럼 앞으로 올리기만 한다(재시작하면 방에서 튕긴다).
   main.js 의 판정 · 상태 모으기 · 정리 · second-instance 처리기를 떼어 가짜 app / 창으로 굴린다.
   ・1절: _secondInstanceAction 표 — 부팅 중(wait) · 창 없음 · 파괴 · 렌더러 죽음 · 응답 없음(relaunch) · 멀쩡(focus) · 빈 입력
   ・2절: _mainWindowHealth — 가짜 창에서 신호를 읽는다(isDestroyed · webContents.isCrashed · unresponsive 기록 · 던지는 창)
   ・3절: second-instance 처리기 — focus 면 restore/show/focus 만 · relaunch 면 relaunch → 훅 · 타이머 정리 → 창 destroy → exit(0)(quit 아님)
   ・4절: 배선 — unresponsive / responsive 가 기록을 넣고 빼고 · 창을 만들 때 created 표시
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

function sandbox(src){
  const parts = ['_secondInstanceAction', '_mainWindowHealth', '_exitNow', '_relaunchFresh'].map(n => fnText(src, n));
  const h = handlerText(src);
  if(parts.some(p => !p) || !h) return null;
  const E = { log: [], calls: [], ready: true, wins: [] };
  const app = {
    isReady: () => E.ready,
    relaunch: () => E.calls.push('relaunch'),
    exit: (c) => E.calls.push('exit ' + c),
    quit: () => E.calls.push('quit'),
  };
  const BW = { getAllWindows: () => E.wins };
  const sysinput = { stopGlobalHooks: () => E.calls.push('hooks') };
  const unresp = new WeakSet();
  const api = new Function('app', 'BrowserWindow', 'sysinput', '_diagLog', '_unresponsiveWins', 'clearInterval',
    'let mainWindow = null, _mainWindowCreated = false, _cursorWatchTimer = null, _pollTimer = null;\n' + parts.join('\n') +
    '\nconst handler = ' + h + ';\nreturn { act: _secondInstanceAction, health: _mainWindowHealth, handler,' +
    ' set(o){ if("mw" in o) mainWindow = o.mw; if("created" in o) _mainWindowCreated = o.created; if("cur" in o) _cursorWatchTimer = o.cur; if("poll" in o) _pollTimer = o.poll; },' +
    ' timers(){ return [_cursorWatchTimer, _pollTimer]; } };')(app, BW, sysinput, (m) => E.log.push(m), unresp, (id) => E.calls.push('clear ' + id));
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
    webContents: o.noWc ? null : { isDestroyed: () => !!o.wcDestroyed, isCrashed: () => { if(o.throwCrashed) throw new Error('y'); return !!o.crashed; } },
  };
  return w;
}

function judge(MAIN){
  const S = sandbox(MAIN);
  say('── 1. 판정 표 — _secondInstanceAction');
  chk(!!S, 'main.js 에서 판정 · 상태 · 정리 · 처리기를 떼어 굴릴 수 있다');
  if(!S) return;
  const ok = { ready: true, created: true, hasWindow: true, destroyed: false, crashed: false, unresponsive: false };
  const T = [
    [{ ...ok }, 'focus', '멀쩡 — 앞으로 올리기만'],
    [{ ...ok, ready: false }, 'wait', '앱 준비 전 — 아무것도 안 함(부팅 중인 앱을 죽이지 않는다)'],
    [{ ...ok, created: false, hasWindow: false }, 'wait', '창을 만들기 전 — 아무것도 안 함'],
    [{ ...ok, hasWindow: false }, 'relaunch', '만들었던 창이 없음 — 새로 띄움'],
    [{ ...ok, destroyed: true }, 'relaunch', '창 파괴됨 — 새로 띄움'],
    [{ ...ok, crashed: true }, 'relaunch', '렌더러 죽음 — 새로 띄움'],
    [{ ...ok, unresponsive: true }, 'relaunch', '응답 없음 — 새로 띄움'],
    [{ ...ok, ready: false, unresponsive: true }, 'wait', '  부팅 중이면 다른 신호보다 wait 가 먼저'],
  ];
  T.forEach(([inp, want, msg]) => { const got = S.act(inp); chk(got === want, msg + ' (' + got + ')'); });
  chk(S.act(undefined) === 'wait' && S.act({}) === 'wait' && S.act(null) === 'wait', '  빈 입력 — wait(던지지 않음)');

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
  const w2 = fakeWin(S, {}); S.set({ mw: w2 }); S.unresp.add(w2);
  chk(S.health().unresponsive === true && S.act(S.health()) === 'relaunch', 'unresponsive 기록이 있는 창 → relaunch');
  S.unresp.delete(w2);
  chk(S.act(S.health()) === 'focus', '  responsive 로 기록이 빠지면 다시 focus');

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
  chk(/win\.on\('unresponsive', \(\) => \{ _unresponsiveWins\.add\(win\);/.test(watch) && /win\.on\('responsive', +\(\) => \{ _unresponsiveWins\.delete\(win\);/.test(watch),
    'unresponsive 가 기록을 넣고 · responsive 가 뺀다(Electron 신호)');
  chk(/^const _unresponsiveWins = new WeakSet\(\);/m.test(MAIN), '  기록은 WeakSet(창이 사라지면 같이 사라짐)');
  const iC = MAIN.indexOf('  _mainWindowCreated = true;\n  _watchRendererHealth(mainWindow);');
  const iL = MAIN.indexOf("mainWindow.loadFile(path.join(__dirname, 'app', 'desk-companion-prototype.html'));");
  chk(iC > 0 && iL > iC, '창을 만들 때(로드 전) created 표시');
}

judge(MAIN0);

say('── 5. 일부러 깨 보기');
const BREAKS = [
  ["  if(!s.ready || !s.created) return 'wait';\n", '', '부팅 중에도 새로 띄움'],
  ['s.destroyed || s.crashed || s.unresponsive', 's.destroyed || s.crashed', '응답 없음을 못 봄'],
  ['s.destroyed || s.crashed || s.unresponsive', 's.destroyed || s.unresponsive', '렌더러 죽음을 못 봄'],
  ["function _exitNow(){", "function _exitNow(){ return app.quit();", 'exit(0) 대신 quit'],   // 끝내기는 main.js _exitNow() 하나(session-end 와 같이 쓴다)
  ["  _exitNow();\n}", "}", '새로 띄우기 뒤 끝내기를 안 부름'],
  ["  try{ app.relaunch(); }catch(e){ _diagLog('[중복 실행] relaunch", "  try{ (0); }catch(e){ _diagLog('[중복 실행] relaunch", 'relaunch 를 안 부름'],
  ["    if (act === 'relaunch') { _relaunchFresh(health); return; }\n", '', '쓸 수 없는데 앞으로만 올림'],
  ["_unresponsiveWins.delete(win);", '0;', '응답 재개를 안 지움'],
  ["  s.unresponsive = _unresponsiveWins.has(w);\n", '', '응답 없음 기록을 안 읽음'],
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

/* ═══ 🧯 sim-error-log.js — 오류 기록 파일(tw-error.log · error-log.js · error-report.js · 배선) ═══════════════
   [왜] 오류가 진단 기록에 섞이거나(에러코드 알림) 아예 안 남아(화면의 잡히지 않은 오류 · console.error) 제보로 받을 길이 없었다.
   ・1절: main 쪽 error-log.js — 한 줄 모양 · 홈 폴더 ~ · 줄바꿈 한 줄로 · 길이 상한 · 몰아치면 거르고 «n번 더» · 시간이 지나면 다시 · 파일 회전 · 쓰기 실패 삼킴
   ・2절: 화면 쪽 error-report.js — 잡히지 않은 오류 · 처리 안 된 Promise · console.error / warn(원래 출력은 그대로) · 에러코드 알림은 다시 안 보냄 · 같은 줄 10초 · 보내다 난 오류로 되돌아 들어오지 않음
   ・3절: 배선 — main(Monitor · 렌더러 종료 · 로드 실패 · 프로세스 종료 · 업데이트 오류 · IPC 종류 거르기 · 보낸 창 확인) · preload · html 맨 먼저 · 에러코드는 진단 기록이 아니라 오류 기록 · 설치 목록
   ・4절: 깨 보기
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const pick = (names) => names.map((f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean) || null;
const DESK = path.join('..', 'apps', 'desktop');
const LOG = pick(['error-log.js', path.join(DESK, 'error-log.js')]);
const REP = pick(['error-report.js', 'shared/error-report.js', 'parts/shared/error-report.js', path.join(DESK, 'app/parts/shared/error-report.js')]);
const CODES = pick(['error-codes.js', 'shared/error-codes.js', 'parts/shared/error-codes.js', path.join(DESK, 'app/parts/shared/error-codes.js')]);
const MAIN = pick(['main.js', path.join(DESK, 'main.js')]);
const PRE = pick(['preload.js', path.join(DESK, 'preload.js')]);
const HTML = pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html', path.join(DESK, 'app/desk-companion-prototype.html')]);
const PKG = pick(['package.json', path.join(DESK, 'package.json')]);
for(const [n, v] of [['error-log.js', LOG], ['error-report.js', REP], ['error-codes.js', CODES], ['main.js', MAIN], ['preload.js', PRE], ['html', HTML], ['package.json', PKG]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const HM = pick(['home-mask.js', path.join(DESK, 'home-mask.js')]);
if(!HM){ say('  ? 원본 못 찾음 — home-mask.js'); process.exit(2); }
const loadPlain = (src) => { const m = { exports: {} }; new Function('module', 'require', src)(m, require); return m.exports; };
let HMOD = loadPlain(HM);
const req = (m) => (m === './home-mask' ? HMOD : require(m));   // 모듈이 부르는 이웃 파일 — 깨 보기에서 바꿔 끼운다
const load = (src) => { const m = { exports: {} }; new Function('module', 'require', src)(m, req); return m.exports; };

/* 가짜 파일 — appendFileSync · 크기 · 이름 바꾸기 */
function fakeFs(opt){
  const files = {};
  return { files,
    existsSync: (f) => f in files,
    statSync: (f) => ({ size: Buffer.byteLength(files[f] || '') }),
    unlinkSync: (f) => { delete files[f]; },
    renameSync: (a, b) => { files[b] = files[a]; delete files[a]; },
    appendFileSync: (f, s) => { if(opt && opt.fail) throw new Error('EACCES'); files[f] = (files[f] || '') + s; },
  };
}
const HOME = 'C:\\Users\\홍길동';
function behaveLog(src){
  const M = load(src), r = {};
  let t = Date.UTC(2026, 10, 10, 1, 2, 3);
  const F = fakeFs(), f = path.join('/ud', M.FILE);
  const L = M.createErrorLog({ fs: F, path, dir: () => '/ud', version: '0.13.0', home: HOME, now: () => t });
  const e = new Error('boom'); e.stack = 'Error: boom ' + HOME + '\\x.js\n  at a (b.js:1)';
  L.write('ERROR', '렌더러 app.js:10', e);
  const line = (F.files[f] || '').split('\n')[0];
  r.shape = /^\[2026-11-10T01:02:03\.000Z\] \[앱 0\.13\.0\] \[ERROR\] 렌더러 app\.js:10 · Error: boom ~\\x\.js ⏎ at a \(b\.js:1\)$/.test(line);
  r.home = !line.includes('홍길동');
  L.write('BOGUS', 'x', 'y'); r.kind = /\[ERROR\] x · y/.test(F.files[f]);
  L.write('WARN', 'w', 'x'.repeat(5000)); r.max = F.files[f].split('\n').every((l) => l.length < M.MSG_MAX + 120);
  for(let i = 0; i < 10; i++) L.write('WARN', 'spam', '같은 경고');
  r.storm = (F.files[f].match(/같은 경고/g) || []).length === M.REPEAT_MAX;
  t += M.REPEAT_WINDOW_MS + 1; L.write('WARN', 'spam', '같은 경고');
  r.more = /같은 경고 \(같은 오류 7번 더 — 적지 않음\)/.test(F.files[f]);
  F.files[f] = 'x'.repeat(M.MAX_BYTES + 10); L.write('CRASH', '렌더러 종료', 'reason=crashed');
  r.rotate = (F.files[f + '.1'] || '').length > M.MAX_BYTES && /^\[[^\]]+\] \[앱 0\.13\.0\] \[CRASH\]/.test(F.files[f]);
  const F3 = fakeFs(), f3 = path.join('/ud', M.FILE); let t3 = 0;
  const L3 = M.createErrorLog({ fs: F3, path, dir: '/ud', version: '1', now: () => t3 });
  for(let i = 0; i < M.MINUTE_MAX + 10; i++) L3.write('WARN', 'x', '좌표 ' + i);   // 매번 글이 다른 경고
  const n3 = F3.files[f3].split('\n').filter(Boolean).length;
  t3 += 61000; L3.write('WARN', 'x', '다음');
  r.minute = n3 === M.MINUTE_MAX && /다음 \(1분 상한으로 10줄 건너뜀\)$/.test(F3.files[f3].trim());
  const L2 = M.createErrorLog({ fs: fakeFs({ fail: true }), path, dir: '/ud', version: '1', now: () => 0 });
  try{ r.swallow = L2.write('ERROR', 'a', 'b') === false; }catch(_){ r.swallow = false; }
  return r;
}
/* 가짜 창 — addEventListener · console */
function fakeWin(){
  const ev = {}, out = [];
  const con = { error: (...a) => out.push(['error', a]), warn: (...a) => out.push(['warn', a]), log(){} };
  return { ev, out, console: con, addEventListener: (k, f) => { ev[k] = f; } };
}
function behaveRep(src){
  const M = load(src), r = {};
  let t = 0; const sent = [];
  const w = fakeWin();
  r.installed = M.install(w, (p) => sent.push(p), () => t) === true && M.install(w, () => {}) === false;
  w.ev.error({ filename: 'file:///C:/app/parts/app.js', lineno: 12, error: new TypeError('x is undefined') });
  r.err = sent[0] && sent[0].kind === 'ERROR' && sent[0].src === 'app.js:12' && /TypeError: x is undefined/.test(sent[0].msg);
  w.ev.unhandledrejection({ reason: new Error('거절') });
  r.rej = sent[1] && sent[1].src === '처리 안 된 Promise' && /거절/.test(sent[1].msg);
  w.console.error('[파츠] 실패', { a: 1 });
  r.con = sent[2] && sent[2].kind === 'ERROR' && sent[2].src === 'console.error' && sent[2].msg === '[파츠] 실패 {"a":1}' && w.out.length === 1;
  w.console.warn('[오류] E-FR-01', 'x');
  r.code = sent.length === 3 && w.out.length === 2;                 // 에러코드 알림이 찍는 경고는 다시 안 보낸다(원래 출력은 된다)
  w.console.warn('매 프레임 경고'); w.console.warn('매 프레임 경고');
  const n1 = sent.length; t += M.SAME_MS + 1; w.console.warn('매 프레임 경고');
  r.same = n1 === 4 && sent.length === 5;
  const w2 = fakeWin(); let calls = 0;
  M.install(w2, () => { calls++; w2.console.error('보내다 난 오류'); }, () => 0);
  w2.console.error('처음');
  r.loop = calls === 1;
  return r;
}

/* 사용자 이름 가리기 — 화면 쪽 스택(빗금 반대 · 한글 퍼센트) · 대소문자 · 맥 · 리눅스 */
function behaveMask(hmSrc){
  const { maskHome } = loadPlain(hmSrc), r = {};
  const enc = encodeURI('홍길동');
  const lines = [
    maskHome('at file:///C:/Users/' + enc + '/AppData/Local/Programs/together-working/resources/app.asar/app/parts/app.js:12:3', HOME),
    maskHome('at C:\\Users\\홍길동\\AppData\\x.js', HOME),
    maskHome('c:\\users\\홍길동\\appdata', HOME),
    maskHome('file:///C:/Users/john/AppData/x.js', 'C:\\Users\\john'),
    maskHome('file:///Users/%EA%B9%80/Library/x.js', '/Users/김'),
    maskHome('/home/kim/.config/x', '/home/kim'),
    maskHome('C:/Users/other/x — 다른 사람 폴더', HOME),
  ];
  r.none = lines.every((l) => !/홍길동|john|kim|김|other/i.test(l) && !l.includes(enc) && !l.includes('%EA%B9%80'));
  r.keep = /app\.asar\/app\/parts\/app\.js:12:3$/.test(lines[0]) && /~/.test(lines[0]);
  r.empty = maskHome(null, '') === '' && maskHome('그냥 글', '') === '그냥 글';
  /* 사용자 폴더가 아닌 경로는 그대로 — Firebase 경고의 /users/<uid> · 주소 안의 /home · /users */
  const keep = ['set at /users/AbC123uid/profile failed: permission_denied', 'https://together-working.com/home/page', 'GET https://api.github.com/users/grk-cmd failed', 'https://x.com/c:/Users/y'];
  r.notPath = keep.slice(0, 3).every((l) => maskHome(l, HOME) === l);
  r.fileMac = maskHome('file:///Users/%EA%B9%80/x', '') === 'file://~/x';   // file: 의 «e:» 를 드라이브로 보지 않는다
  return r;
}

say('── 0. 사용자 이름 가리기(home-mask.js — error-log · update-diag 공용)');
const h = behaveMask(HM);
chk(h.none, '★ 화면 쪽 스택(file:/// · 빗금 반대 · 한글 퍼센트) · 대소문자 · 맥 · 리눅스 · 다른 사용자 폴더 — 이름이 안 남는다');
chk(h.keep, '  이름 뒤 경로(파일 · 줄)는 남긴다');
chk(h.empty, '  빈 값 · 홈 없음');
chk(h.notPath, '★ 사용자 폴더가 아닌 경로는 그대로 — Firebase /users/<uid> 경고 · 주소 안의 /home · /users(«어느 경로가 막혔나» 를 남긴다)');
chk(h.fileMac, '  file:/// 맥 경로 — «file:» 를 드라이브 글자로 안 본다');

say('── 1. main 쪽 error-log.js');
const a = behaveLog(LOG);
chk(a.shape, '★ 한 줄 모양 — [시각] [앱 판] [종류] 출처 · 내용 (줄바꿈은 ⏎)');
chk(a.home, '★ 홈 폴더(사용자 이름)를 ~ 로');
chk(a.kind, '  모르는 종류는 ERROR');
chk(a.max, '  한 줄 길이 상한');
chk(a.storm, '★ 같은 오류가 몰아치면 10분 안에 3번까지만');
chk(a.more, '  10분이 지나 다시 적을 때 «같은 오류 n번 더» 를 붙인다');
chk(a.rotate, '  256KB 를 넘으면 .1 로 밀고 새 파일');
chk(a.swallow, '  쓰기 실패는 삼킨다(앱이 멈추지 않게)');
chk(a.minute, '★ 매번 글이 다른 경고가 몰아쳐도 1분에 120줄까지 · 다음에 «n줄 건너뜀»');

say('── 2. 화면 쪽 error-report.js');
const b = behaveRep(REP);
chk(b.installed, '  창 하나에 한 번만 건다');
chk(b.err, '★ 잡히지 않은 오류 — 파일:줄 · 스택');
chk(b.rej, '★ 처리 안 된 Promise 거절');
chk(b.con, '★ console.error — 원래 출력은 그대로 · 인자는 한 줄로');
chk(b.code, '  에러코드 알림이 찍는 console.warn(«[오류] E-…») 은 다시 보내지 않는다');
chk(b.same, '  같은 줄은 10초 안에 한 번만 보낸다');
chk(b.loop, '  보내다 난 오류가 되돌아 들어오지 않는다');

say('── 3. 배선');
const mainOk = (m) => /const _errorLog = createErrorLog\(\{ fs, path, dir: \(\) => app\.getPath\('userData'\), version: app\.getVersion\(\), home: require\('os'\)\.homedir\(\) \}\);/.test(m)
  && /process\.on\('uncaughtExceptionMonitor', \(err, origin\) => \{ _errorLog\.write\('CRASH', 'main ' \+ origin, err\); \}\);/.test(m)
  && !/process\.on\('uncaughtException',/.test(m);
chk(mainOk(MAIN), "★ main — 오류 기록을 만들고 uncaughtExceptionMonitor 로 적기만 한다(원래 처리는 그대로 · uncaughtException 을 새로 안 건다)");
chk(/_errorLog\.write\('CRASH', '렌더러 종료'/.test(MAIN) && /_errorLog\.write\('ERROR', '화면 로드 실패'/.test(MAIN) && /_errorLog\.write\(\(\(d && d\.type\) \|\| '\?'\) \+ ' 종료'|_errorLog\.write\('CRASH', \(\(d && d\.type\)/.test(MAIN) && /_errorLog\.write\('ERROR', '업데이트', e\)/.test(MAIN),
  '  렌더러 종료 · 화면 로드 실패 · 프로세스 종료 · 업데이트 오류도 적는다');
const ipcOk = (m) => /const RENDERER_ERROR_KINDS = \['ERROR', 'WARN', 'CODE'\];/.test(m)
  && /ipcMain\.on\('companion:errorLog', \(e, p\) => \{\n\s*if\(!mainWindow \|\| mainWindow\.isDestroyed\(\) \|\| e\.sender !== mainWindow\.webContents\) return;\n\s*if\(!p \|\| typeof p !== 'object' \|\| !RENDERER_ERROR_KINDS\.includes\(p\.kind\)\) return;/.test(m);
chk(ipcOk(MAIN), '★ IPC — 메인 창이 보낸 것만 · 렌더러가 보낼 수 있는 종류(ERROR · WARN · CODE)만(CRASH 는 main 만)');
chk(/errorLog\(p\) \{[\s\S]{0,200}ipcRenderer\.send\('companion:errorLog'/.test(PRE), '  preload — companion.errorLog');
const htmlOk = (h) => { const i = h.indexOf('<script src="parts/shared/error-report.js">'), j = h.indexOf('<script src="vendor/three/three.min.js">'); return i > 0 && j > i && !/<script\b[^>]*src=/.test(h.slice(0, i)); };
chk(htmlOk(HTML), '  html — 다른 스크립트보다 먼저 싣는다');
const codesOk = (c) => /diag: \(line\)=>\{ if\(window\.companion && window\.companion\.errorLog\) window\.companion\.errorLog\(\{ kind: 'CODE', src: '에러코드', msg: line \}\); \}/.test(c) && !/diagNote/.test(c.slice(c.indexOf('createErrorNotice({')));
chk(codesOk(CODES), '★ 에러코드 알림은 진단 기록이 아니라 오류 기록(CODE)으로');
chk(/"error-log\.js"/.test(PKG) && /"home-mask\.js"/.test(PKG), '설치 목록(package.json files)에 error-log.js · home-mask.js — 빠지면 설치본이 켜지지 않는다');

say('── 4. 깨 보기');
chk(!behaveLog(LOG.replace('s = maskHome(s, home);', '')).home, '홈 가리기를 빼면 위 1절 «~» 가 빨강');
chk(!behaveMask(HM.replace("  for(const f of forms(home)) out = out.replace(new RegExp(esc(f) + AFTER, 'gi'), '~');\n", '').replace("return out.replace(WIN_USER_RE, '~').replace(POSIX_USER_RE, '~');", 'return out;')).none, '퍼센트 · 빗금 모양 가리기를 빼면 위 0절 ★ 가 빨강');
chk(!behaveMask(HM.replace("'(?<![\\\\w.\\\\-])/(?:Users|home)/' + SEG, 'g'", "'/(?:Users|home)/' + SEG, 'gi'")).notPath, '맥 · 리눅스 모양을 대소문자 무시 · 앞 글자 조건 없이 보면 위 0절 «그대로» 가 빨강');
chk(!behaveLog(LOG.replace('if(r.n >= REPEAT_MAX){ r.skipped++; return false; }', '')).storm, '몰아칠 때 거르기를 빼면 위 1절 «3번까지만» 이 빨강');
chk(!behaveRep(REP.replace("if(typeof args[0] === 'string' && args[0].indexOf(CODE_PREFIX) === 0) return;", '')).code, '에러코드 경고 건너뛰기를 빼면 위 2절이 빨강');
chk(!behaveRep(REP.replace('if(busy) return;', '')).loop, '되돌아 들어오기 막기를 빼면 위 2절이 빨강');
chk(!mainOk(MAIN.replace("process.on('uncaughtExceptionMonitor'", "process.on('uncaughtException'")), 'uncaughtException 을 걸면(원래 오류 창이 사라짐) 위 3절 ★ 가 빨강');
chk(!ipcOk(MAIN.replace("const RENDERER_ERROR_KINDS = ['ERROR', 'WARN', 'CODE'];", "const RENDERER_ERROR_KINDS = ['ERROR', 'WARN', 'CODE', 'CRASH'];")), '렌더러가 CRASH 를 보낼 수 있게 하면 위 3절이 빨강');
chk(!codesOk(CODES.replace("window.companion.errorLog({ kind: 'CODE', src: '에러코드', msg: line })", 'window.companion.diagNote(line)')), '에러코드를 진단 기록으로 되돌리면 위 3절이 빨강');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

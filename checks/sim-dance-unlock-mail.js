/* sim-dance-unlock-mail.js — 💃 새 춤 해금 우편
   · Lv.150 을 찍으면 /150 안내가 수령함으로 간다.
   · **보낸 것이 확인된 뒤에만** '알림 완료'로 기록한다 — 실패한 안내는 다음 기회에 다시 온다.
   · 이미 보낸 것은 다시 보내지 않는다.
   실행: node sim-dance-unlock-mail.js  (app.js · smoke.js 와 같은 폴더에서) */
'use strict';
const fs = require('fs'), vm = require('vm');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
const cut = smokeSrc.indexOf('/* ── 실행');
smokeSrc = smokeSrc.slice(0, cut).split('\n')
  .filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

globalThis.setTimeout = (fn)=>0;
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};

/* localStorage 흉내 — 진짜 기억을 가진 것으로 갈아끼운다(원본 stub 은 값을 안 남길 수 있다) */
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
  clear: () => store.clear(),
};

const probe = `
;globalThis.__P = {
  moves: DANCE_MOVES,
  notify: lv=>_notifyDanceUnlocks(lv),
  pending: lv=>_danceUnlockPending(lv).map(d=>d.cmd),
  KEY: DANCE_NOTIFIED_KEY,
  FIXKEY: DANCE_REPAIR_KEY,
  setInbox: (box, ready)=>{ _myInbox = box || {}; _myInboxReady = !!ready; },
  mailExists: def=>_danceMailExists(def),
  moveOf: cmd=>DANCE_MOVES.find(d=>d.cmd===cmd),
  setFocus: sec=>{ _focusTotalSec = sec; },
  setAdmin: v=>{ isAdmin = v; },
  level: ()=>getFocusLevel(),
};`;

const say = console.log; console.log = ()=>{}; console.warn = ()=>{};
try { vm.runInThisContext(fs.readFileSync('app.js', 'utf8') + probe, { filename: 'app.js' }); }
catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e).toString().split('\n').slice(0,5).join('\n')); process.exit(1); }
console.log = say;

const P = globalThis.__P;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const flush = () => new Promise(r => process.nextTick(() => process.nextTick(r)));
const marked = () => { try{ return JSON.parse(localStorage.getItem(P.KEY) || '[]'); }catch(_){ return []; } };

/* 수령함 흉내 — mode 로 서버 반응을 바꾼다 */
let mail = [], mode = 'ok';
function installApi(){
  const api = {
    sendInboxMessage: (uid, kind, title, body)=>{
      if(mode === 'throw') return Promise.reject(new Error('permission_denied'));
      if(mode === 'deny')  return Promise.resolve({ ok:false });
      mail.push({ uid, kind, title, body });
      return Promise.resolve({ ok:true });
    },
  };
  globalThis.window.firebaseAPI = api; globalThis.firebaseAPI = api;
}
function removeApi(){ globalThis.window.firebaseAPI = null; globalThis.firebaseAPI = null; }
globalThis.window = globalThis.window || globalThis;

const HOUR = 3600;
const reset = ()=>{ store.clear(); mail = []; mode = 'ok'; };

(async function run(){

say('\n── 1. Lv.150 을 찍으면 /150 안내가 온다');
{
  reset(); installApi(); P.setAdmin(false);
  P.setFocus(149 * HOUR);
  chk(P.level() === 150, '집중 149시간 = Lv.150');
  chk(P.pending(150).join(',') === '80,150', '아직 안 보낸 안내가 둘 (80,150)');
  P.notify(150); await flush();
  chk(mail.length === 2, '우편 두 통이 나갔다 (실제: ' + mail.length + '통)');
  const m150 = mail.find(x => x.body.indexOf('/150') >= 0);
  chk(!!m150, '/150 안내가 들어 있다');
  chk(!!m150 && m150.title.indexOf('새 춤 해금') >= 0, '제목은 새 춤 해금');
  chk(!!m150 && m150.body.indexOf('묘기 회전') >= 0, '춤 이름이 표에서 그대로 온다');
  chk(!!m150 && m150.kind === 'reward', '보상함으로 간다');
  chk(marked().sort().join(',') === '150,80', '두 춤 모두 알림 완료로 기록된다');
}

say('\n── 2. 이미 보낸 것은 다시 보내지 않는다');
{
  mail = [];
  P.notify(150); await flush();
  chk(mail.length === 0, '같은 레벨로 또 불러도 조용하다');
  chk(P.pending(150).length === 0, '남은 안내가 없다');
}

say('\n── 3. ★ 못 보냈으면 기록하지 않는다 (다음 기회에 다시 온다)');
{
  reset(); installApi(); mode = 'deny';
  P.setFocus(149 * HOUR);
  P.notify(150); await flush();
  chk(mail.length === 0, '서버가 거부하면 우편은 안 간다');
  chk(marked().length === 0, '★ 거부당한 안내를 완료로 찍지 않는다');
  mode = 'ok';
  P.notify(150); await flush();
  chk(mail.length === 2, '다음 기회에 두 통 모두 다시 나간다');
  chk(marked().length === 2, '이번엔 기록된다');
}

say('\n── 4. ★ 로그인 전이면 아무것도 남기지 않는다');
{
  reset(); removeApi();
  P.setFocus(149 * HOUR);
  P.notify(150); await flush();
  chk(marked().length === 0, '★ 보낼 수단이 없을 때 완료로 찍지 않는다');
  chk(P.pending(150).length === 2, '안내가 그대로 대기한다');
  installApi();
  P.notify(150); await flush();
  chk(mail.length === 2, '로그인 뒤에 밀린 안내가 따라온다');
}

say('\n── 5. 예외가 나도 마찬가지다');
{
  reset(); installApi(); mode = 'throw';
  P.setFocus(149 * HOUR);
  P.notify(150); await flush();
  chk(marked().length === 0, '쓰기가 튕겨도 완료로 찍지 않는다');
  mode = 'ok';
  P.notify(150); await flush();
  chk(mail.length === 2, '다시 시도해서 도착한다');
}

say('\n── 6. 레벨이 모자라면 안 온다');
{
  reset(); installApi();
  P.setFocus(79 * HOUR);
  chk(P.level() === 80, 'Lv.80');
  P.notify(80); await flush();
  chk(mail.length === 1 && mail[0].body.indexOf('/80') >= 0, '살랑살랑 안내만 온다');
  chk(P.pending(80).length === 0 && P.pending(150).length === 1, '/150 은 아직 대기 상태');
  P.setFocus(149 * HOUR); mail = [];
  P.notify(150); await flush();
  chk(mail.length === 1 && mail[0].body.indexOf('/150') >= 0, '레벨을 찍으면 그때 온다');
}

say('\n── 7. 관리자라고 미리 오지는 않는다');
{
  reset(); installApi(); P.setAdmin(true);
  P.setFocus(0);
  chk(P.level() === 1, 'Lv.1 관리자');
  P.notify(P.level()); await flush();
  chk(mail.length === 0, '해금은 되어도 달성 보상 우편은 안 온다');
  P.setAdmin(false);
}

say('\n── 8. 🩹 기록은 \'보냄\'인데 수령함에 없는 경우 (Lv.180 인데 /150 안내가 없다)');
{
  reset(); installApi();
  P.setFocus(179 * HOUR);
  chk(P.level() === 180, 'Lv.180');
  localStorage.setItem(P.KEY, JSON.stringify(['80','150']));   // 옛 코드가 보내기 전에 찍어 둔 기록
  P.setInbox({ m1: { tag:'reward', title:'💃 새 춤 해금!', body:"Lv.80 달성! 투게더룸 채팅에 '/80'를 입력하면" } }, true);
  chk(P.mailExists(P.moveOf('80')) === true, '/80 안내는 수령함에 실제로 있다');
  chk(P.mailExists(P.moveOf('150')) === false, '/150 안내는 없다');
  chk(P.pending(180).join(',') === '150', '★ 없는 것만 다시 보낼 대상이 된다');
  P.notify(180); await flush();
  chk(mail.length === 1 && mail[0].body.indexOf('/150') >= 0, '★ /150 안내가 뒤늦게 도착한다');
  chk(mail.every(m => m.body.indexOf('/80') < 0), '이미 있는 /80 은 다시 안 보낸다');
}

say('\n── 9. 구제는 명령당 한 번뿐');
{
  /* 받은 뒤 사용자가 /150 안내만 지웠다고 치자 (/80 은 그대로 둔다 —
     그쪽은 아직 구제 기록이 없어서, 같이 지우면 그건 '첫 구제'라 한 번은 다시 가는 게 맞다) */
  P.setInbox({ m1: { tag:'reward', title:'💃 새 춤 해금!', body:"Lv.80 달성! 투게더룸 채팅에 '/80'를 입력하면" } }, true);
  mail = [];
  P.notify(180); await flush();
  chk(mail.length === 0, '★ 직접 지운 사람에게 매번 다시 보내지 않는다');
  chk(P.pending(180).length === 0, '구제 목록에서도 빠진다');
  chk(JSON.parse(localStorage.getItem(P.FIXKEY) || '[]').indexOf('150') >= 0, '구제 기록이 남는다');
}

say('\n── 10. 수령함이 아직 안 왔으면 판단하지 않는다');
{
  reset(); installApi();
  P.setFocus(179 * HOUR);
  localStorage.setItem(P.KEY, JSON.stringify(['80','150']));
  P.setInbox({}, false);             // 구독 전 — 빈 객체이지만 '비었다'는 뜻이 아니다
  chk(P.pending(180).length === 0, '★ 빈 수령함을 근거로 중복 발송하지 않는다');
  P.notify(180); await flush();
  chk(mail.length === 0, '아무것도 안 나간다');
  P.setInbox({}, true);              // 도착 — 정말로 비어 있었다
  P.notify(180); await flush();
  chk(mail.length === 2, '그때 두 통 모두 따라온다');
}

say(fail ? '\n✗ 실패 ' + fail + '건' : '\n✓ 전부 통과');
})();

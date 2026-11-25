/* ═══ 🖼 sim-own-image.js — 내 그림을 Storage 내 폴더에 바로 올리기 (0.14 · tw-docs design/12-storage-owner.md) ═══
   [왜] 마이홈 · 디데이 카드 · 박수 · 말랑이 그림은 0.14 부터 서버(POST /v2/me/images)를 거치지 않고 앱이 Storage 에 올린다.
     Storage 규칙은 «경로의 코드 = 이 로그인의 코드» 일 때만 받고, 서버는 받은 주소의 폴더 · 이름 머리(mh · dday · clap · mallang)를 본다.
     이름이 어긋나면 규칙이나 서버가 거절해 그림이 안 올라가므로 실제로 불러서 경로 · 실패를 본다.
   ・1절: pathOf — 쓰임마다 이름 머리 · 형식마다 확장자 · 모르는 쓰임 · 형식 · 코드 · id 는 null
   ・2절: upload — 내 코드 · 새 id · 바이트 그대로 put · 주소를 돌려줌 · 코드 없음 NO_USER · put 실패 · 빈 주소 IMAGE_UPLOAD · 10초 안에 안 끝나면 cancel · IMAGE_UPLOAD(TIMEOUT)
   ・3절: 배선 — html 에서 provider · app.js 보다 먼저 · smoke PRELOAD · 네 provider 가 서버 그림 endpoint 를 안 부른다 · app.js 가 넘긴다 · firebase-init putOwnFile
   ・4절: mutation test
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  OWN: pick(at('own-image.js', 'shared')),
  MH: pick(at('myhome-api.js', 'myhome')),
  GIFT: pick(at('gift-api.js', 'myhome')),
  SCH: pick(at('schedule-api.js', 'myhome')),
  GB: pick(at('guestbook-api.js', 'myhome')),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwOwnImage; };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const rej = async (p) => { try{ await p; return null; }catch(e){ return e || {}; } };
// 끝나지 않는 약속을 기다리다 검사가 조용히 멈추지 않게 — ms 안에 안 끝나면 'HANG'
const within = (p, ms) => Promise.race([p, new Promise((r) => { setTimeout(() => r('HANG'), ms); })]);

async function judge(S){
  const M = load(S.OWN);
  say('── 1. 경로');
  chk(M.pathOf('myhome', 'uabc12345', 'id-1', 'image/png') === 'users/uabc12345/mh_id-1.png', 'myhome → users/{코드}/mh_{id}.png(서버 MyHomeImage · 규칙 mh_ 8MB 와 같은 이름)');
  chk(M.pathOf('dday', 'uabc12345', 'id-1', 'image/jpeg') === 'users/uabc12345/dday_id-1.jpg', 'dday → dday_{id}.jpg(jpeg 는 jpg)');
  chk(M.pathOf('clap', 'uabc12345', 'id-1', 'image/webp') === 'users/uabc12345/clap_id-1.webp', 'clap → clap_{id}.webp');
  chk(M.pathOf('mallang', 'uabc12345', 'id-1', 'image/png') === 'users/uabc12345/mallang_id-1.png', 'mallang → mallang_{id}.png');
  for(const [what, args] of [['모르는 쓰임', ['away', 'u1', 'i', 'image/png']], ['gif', ['myhome', 'u1', 'i', 'image/gif']], ['빈 코드', ['myhome', '', 'i', 'image/png']],
    ['코드에 / ', ['myhome', 'u1/../u2', 'i', 'image/png']], ['id 에 /', ['myhome', 'u1', 'a/b', 'image/png']], ['프로토타입 이름', ['toString', 'u1', 'i', 'image/png']]]) chk(M.pathOf(...args) === null, '  ' + what + ' → null');

  say('── 2. 올리기');
  const puts = [];
  const realLater = (fn, ms) => { const h = setTimeout(fn, ms); return () => clearTimeout(h); };
  const okPut = (p, b, t) => { puts.push({ p, b, t }); return { done: Promise.resolve('https://firebasestorage.googleapis.com/v0/b/x/o/' + encodeURIComponent(p) + '?alt=media&token=t'), cancel: () => {} }; };
  const failPut = (e) => () => ({ done: Promise.reject(e), cancel: () => {} });
  let curOwner = 'UID-A';
  const mk = (o) => M.createOwnImage(Object.assign({ myCode: () => 'uabc12345', newId: () => 'n-1', put: okPut, later: realLater, owner: () => curOwner }, o || {}));
  const bytes = new Uint8Array([137, 80, 78, 71]);
  const url = await mk().upload('mallang', { type: 'image/png', bytes });
  chk(puts.length === 1 && puts[0].p === 'users/uabc12345/mallang_n-1.png' && puts[0].b === bytes && puts[0].t === 'image/png' && /mallang_n-1\.png/.test(url), '내 코드 · 새 id · 바이트 그대로 · 형식 그대로 put → 다운로드 주소');
  let n = 0;
  const two = mk({ newId: () => 'n' + (++n) });
  await two.upload('myhome', { type: 'image/png', bytes }); await two.upload('myhome', { type: 'image/png', bytes });
  chk(puts[1].p !== puts[2].p, '  올릴 때마다 새 이름(1년 캐시 — 덮으면 옛 그림이 보인다)');
  puts.length = 0;
  const noCode = await rej(mk({ myCode: () => null }).upload('myhome', { type: 'image/png', bytes }));
  chk(noCode && noCode.code === 'NO_USER' && puts.length === 0, '코드가 없으면 NO_USER · put 0');
  const badKind = await rej(mk().upload('away', { type: 'image/png', bytes }));
  chk(badKind && badKind.code === 'IMAGE_UPLOAD' && puts.length === 0, '모르는 쓰임 · 형식은 IMAGE_UPLOAD · put 0');
  const denied = await rej(mk({ put: failPut(Object.assign(new Error('403'), { code: 'storage/unauthorized' })) }).upload('clap', { type: 'image/png', bytes }));
  chk(denied && denied.code === 'IMAGE_UPLOAD' && denied.cause && denied.cause.code === 'storage/unauthorized', 'Storage 거절은 IMAGE_UPLOAD(원인은 cause 에)');
  {   // 앞 계정 화면에서 고른 그림 — 경로의 코드는 지금 계정 것이라 규칙이 못 막는다. 읽은 토큰 주인과 견준다
    const n0 = puts.length;
    chk(!!(await mk().upload('myhome', { type: 'image/png', bytes }, { expectOwner: 'UID-A' })) && puts.length === n0 + 1, '읽은 토큰 주인 = 지금 로그인 → 올린다');
    curOwner = 'UID-B';
    const oc = await rej(mk().upload('myhome', { type: 'image/png', bytes }, { expectOwner: 'UID-A' }));
    chk(oc && oc.code === 'OWNER_CHANGED' && puts.length === n0 + 1, '계정이 바뀌었으면 OWNER_CHANGED · put 0(새 계정 폴더로 가지 않는다)');
    curOwner = null;
    const out = await rej(mk().upload('myhome', { type: 'image/png', bytes }, { expectOwner: 'UID-A' }));
    chk(out && out.code === 'OWNER_CHANGED' && puts.length === n0 + 1, '  로그아웃(지금 로그인 없음)도 OWNER_CHANGED · put 0');
    curOwner = 'UID-A';
  }
  const empty = await rej(mk({ put: () => ({ done: Promise.resolve(''), cancel: () => {} }) }).upload('dday', { type: 'image/png', bytes }));
  chk(empty && empty.code === 'IMAGE_UPLOAD', '빈 주소도 IMAGE_UPLOAD');
  {   // 망이 끊겨 put 이 끝나지 않는다 — 시계를 바꿔 끼워 상한에서 끊기는지 본다
    let fire = null, ms = 0, stopped = 0, cancelled = 0;
    const hang = mk({ put: () => ({ done: new Promise(() => {}), cancel: () => { cancelled++; } }), later: (fn, t) => { fire = fn; ms = t; return () => { stopped++; }; } });
    const pending = rej(hang.upload('mallang', { type: 'image/png', bytes }));
    await Promise.resolve();
    chk(typeof fire === 'function' && ms === M.TIMEOUT_MS && M.TIMEOUT_MS === 10000, '올리기마다 10초 시계를 건다(0.13 서버 올리기 WRITE_TIMEOUT_MS 와 같다)');
    if(fire) fire();
    const e = await within(pending, 500);
    chk(e && e.code === 'IMAGE_UPLOAD' && e.cause && e.cause.code === 'TIMEOUT' && cancelled === 1, '  10초 안에 안 끝나면 cancel() 하고 IMAGE_UPLOAD(cause TIMEOUT) — «올리는 중» 이 풀린다');
    const quick = mk({ later: (fn, t) => () => { stopped++; } });
    stopped = 0;
    await quick.upload('myhome', { type: 'image/png', bytes });
    chk(stopped === 1, '  끝나면 시계를 푼다');
    const t0 = Date.now();
    const real = await within(rej(M.createOwnImage({ myCode: () => 'u1abc', newId: () => 'n', put: () => ({ done: new Promise(() => {}), cancel: () => {} }), later: (fn) => realLater(fn, 50) }).upload('dday', { type: 'image/png', bytes })), 2000);
    chk(real && real.code === 'IMAGE_UPLOAD' && Date.now() - t0 < 2000, '  진짜 타이머로도 상한에서 끝난다(50ms 로 줄여 봄)');
  }

  say('── 3. 배선');
  const tag = (f) => S.HTML.indexOf('<script src="parts/' + f + '"></script>');
  const iOwn = tag('shared/own-image.js');
  chk(iOwn > 0 && ['myhome/myhome-api.js', 'myhome/gift-api.js', 'myhome/schedule-api.js', 'myhome/guestbook-api.js', 'app.js'].every((f) => tag(f) < 0 || iOwn < tag(f)), 'html — own-image.js 가 네 provider · app.js 보다 먼저');
  chk(/PRELOAD\.push\([^)]*'own-image\.js'/.test(S.SMOKE), 'smoke PRELOAD 에 있다');
  for(const [k, kind] of [['MH', 'myhome'], ['GIFT', 'mallang'], ['SCH', 'dday'], ['GB', 'clap']]){
    const src = strip(S[k]);
    const call = new RegExp("ownImage\\.upload\\('" + kind + "', img, (o|\\{ expectOwner: owner \\})\\)");
    chk(!/\/v2\/me\/images/.test(src) && call.test(src), k + ' — 서버 그림 endpoint 를 안 부르고 own-image 의 ' + kind + ' 로 · 읽은 토큰 주인을 실어 올린다');
  }
  const app = strip(S.APP);
  chk(/const ownImageMod = TwOwnImage\.createOwnImage\(\{ myCode: \(\)=>getMyUserId\(\)/.test(app) && /owner: \(\)=>firebaseAPI\.authCurrentUid\(\) \}\);/.test(app) && /later: \(fn, ms\)=>\{ const t = setTimeout\(fn, ms\); return \(\)=>clearTimeout\(t\); \}/.test(app) && (app.match(/ownImage: ownImageMod/g) || []).length === 5, 'app.js 가 내 코드 · 시계로 만들어 다섯 provider 에 넘긴다');
  chk(/putOwnFile\(path, bytes, contentType\)\{\s*const r = sref\(storage, path\);\s*const task = uploadBytesResumable\(r, bytes, \{ cacheControl: STORAGE_CACHE, contentType \}\);\s*return \{ done: task\.then\(\(\) => getDownloadURL\(r\)\), cancel: \(\) => task\.cancel\(\) \};/.test(S.FI),
    'firebase-init putOwnFile — 그 경로(빈 uid 안전망 sref)에 resumable 로 올리고 { done(주소까지), cancel } 을 돌려준다');
  chk(!/maxUploadRetryTime|maxOperationRetryTime/.test(strip(S.FI)), '  공용 Storage 다시 하기 시간은 안 바꾼다(방 얼굴 · GLB 도 쓴다)');
}

async function runAll(){
  await judge(SRC0);
  say('── 4. mutation test');
  const breaks = [
    ['myhome 머리를 틀림', SRC0.OWN.replace("myhome: 'mh'", "myhome: 'myhome'"), 'mh_'],
    ['jpeg 확장자를 jpeg 로', SRC0.OWN.replace("'image/jpeg': 'jpg'", "'image/jpeg': 'jpeg'"), 'jpg'],
    ['코드 검사를 뺌', SRC0.OWN.replace("!SAFE.test(String(userCode || ''))", 'false'), '코드'],
    ['id 를 늘 같게', SRC0.OWN.replace('pathOf(kind, code, newId(), img.type)', "pathOf(kind, code, 'same', img.type)"), '새 이름'],
    ['put 실패를 삼킴', SRC0.OWN.replace("catch(e){ const err = codeError('IMAGE_UPLOAD', '그림을 올리지 못했어요'); err.cause = e; throw err; }", "catch(e){ url = 'https://x'; }"), 'Storage 거절'],
    ['시간 상한을 안 검', SRC0.OWN.replace("const job = put(path, bytes, type);", "const job = put(path, bytes, type); return job.done;"), '10초'],
    ['끊을 때 cancel 을 안 부름', SRC0.OWN.replace("try{ job.cancel(); }catch(_){}", ''), 'cancel'],
    ['상한을 늘림', SRC0.OWN.replace('const TIMEOUT_MS = 10000;', 'const TIMEOUT_MS = 600000;'), '10초'],
    ['계정이 바뀌어도 올림', SRC0.OWN.replace("if(expectOwner && owner() !== expectOwner) throw codeError('OWNER_CHANGED', '로그인한 사람이 바뀌어 올리지 않았어요');", ''), 'OWNER_CHANGED'],
    ['코드 없을 때도 올림', SRC0.OWN.replace("if(!code) throw codeError('NO_USER', '내 코드가 없어 그림을 올릴 수 없어요');", ''), 'NO_USER'],
  ];
  for(const [name, src, what] of breaks){
    if(src === SRC0.OWN){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0;
    try{ await judge(Object.assign({}, SRC0, { OWN: src })); }catch(_){ qfail++; }
    quiet = false;
    chk(qfail > 0, 'mutation test — ' + name + ' → 빨강(' + what + ')');
  }
  console.log(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
  process.exit(fail ? 1 : 0);
}
runAll();

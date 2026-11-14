/* ═══ 🖼 sim-image-bytes.js — data: 그림 → 올릴 바이트 (0.13 앱 묶음 D2-0) ═══
   [왜] 말랑이 · 일정 카드 · 박수 그림 올리기가 같은 «data: 풀기 · 종류 · 빈 그림 · 크기» 판정을 세 벌 들고 있던 것을 shared/image-bytes.js 한 곳으로 모았다.
     올리는 바이트가 어긋나면 서버가 거절하거나 깨진 그림이 올라가므로 실제로 불러서 판정한다.
   ・1절: parseDataUrl — 바이트가 그대로 나온다 · 형식이 아니면 null · base64 가 깨지면 null · 종류 글자 모양
   ・2절: inspect — 허용 종류 · 빈 그림 · 상한 바로 아래 · 상한 · 상한 위 · 상한 안 줌
   ・3절: 배선 — html 에서 app.js 보다 먼저 · smoke PRELOAD · 세 provider 에 data: 풀기 사본이 없다(atob 0) · app.js 가 TwImageBytes 를 넘긴다
   ・4절: 일부러 깨 보기
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
  IMG: pick(at('image-bytes.js', 'shared')),
  GIFT: pick(at('gift-api.js', 'myhome')),
  SCH: pick(at('schedule-api.js', 'myhome')),
  GB: pick(at('guestbook-api.js', 'myhome')),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwImageBytes; };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const url = (type, n, fill) => 'data:' + type + ';base64,' + Buffer.alloc(n, fill === undefined ? 7 : fill).toString('base64');
const TYPES = ['image/png', 'image/webp'];

function judge(S){
  let M = null;
  try{ M = load(S.IMG); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  if(!M || typeof M.inspect !== 'function' || typeof M.parseDataUrl !== 'function'){ chk(false, 'window.TwImageBytes 가 없다'); return; }

  say('── 1. 풀기');
  {
    const raw = Buffer.from([0, 1, 2, 250, 251, 255, 128, 10]);
    const r = M.parseDataUrl('data:image/png;base64,' + raw.toString('base64'));
    chk(!!r && r.type === 'image/png' && r.bytes instanceof Uint8Array && Buffer.from(r.bytes).equals(raw), '바이트가 그대로 나온다(0 · 128 · 255 포함) · 종류 image/png');
    chk(M.parseDataUrl('data:image/jpeg;base64,') && M.parseDataUrl('data:image/jpeg;base64,').bytes.length === 0, '빈 그림도 풀린다(길이 0 — 거르는 건 inspect)');
    for(const [what, u] of [['https 주소', 'https://x/y.png'], ['base64 아님', 'data:image/png,abc'], ['종류 없음', 'data:;base64,AAAA'], ['글 아님', null], ['숫자', 12], ['글자 깨짐', 'data:image/png;base64,@@@@'], ['길이가 모자란 base64', 'data:image/png;base64,A'], ['종류 대문자', 'data:IMAGE/PNG;base64,AAAA']])
      chk(M.parseDataUrl(u) === null, what + ' → null');
    chk(M.parseDataUrl('data:image/svg+xml;base64,AAAA').type === 'image/svg+xml', '종류 글자에 + · . 가 들어가도 읽는다(허용 판정은 inspect 몫)');
  }

  say('── 2. 판정 inspect');
  {
    const o = (max) => ({ types: TYPES, maxBytes: max });
    const a = M.inspect(url('image/png', 10), o(10));
    chk(a.ok === true && a.type === 'image/png' && a.bytes.length === 10, '상한과 같은 크기는 통과(경계) — { ok, type, bytes }');
    const b = M.inspect(url('image/png', 11), o(10));
    chk(b.ok === false && b.why === 'large' && !('bytes' in b), '상한 위 → large · 바이트를 내주지 않는다');
    chk(M.inspect(url('image/png', 9), o(10)).ok === true, '상한 바로 아래 → 통과');
    const e = M.inspect('data:image/png;base64,', o(10));
    chk(e.ok === false && e.why === 'empty', '빈 그림 → empty');
    const j = M.inspect(url('image/jpeg', 5), o(10));
    chk(j.ok === false && j.why === 'format', '허용 안 한 종류(jpeg) → format');
    chk(M.inspect(url('image/jpeg', 5), { types: ['image/jpeg'], maxBytes: 10 }).ok === true, '같은 그림도 부르는 쪽이 jpeg 를 허용하면 통과(종류는 부르는 쪽 몫)');
    chk(M.inspect('https://x/y.png', o(10)).why === 'format' && M.inspect(undefined, o(10)).why === 'format', '데이터 주소 아님 · 없음 → format');
    chk(M.inspect(url('image/png', 3), { types: TYPES }).ok === true, '상한을 안 주면 크기는 보지 않는다');
    chk(M.inspect(url('image/png', 3)).why === 'format', '종류 목록을 안 주면 아무것도 통과시키지 않는다');
    chk(M.inspect('data:image/png;base64,', { types: TYPES, maxBytes: 10 }).why === 'empty' && M.inspect(url('image/jpeg', 11), o(10)).why === 'format',
      '종류가 틀리면 크기보다 먼저 format');
  }

  say('── 3. 배선');
  {
    const h = S.HTML, i = h.indexOf('<script src="parts/shared/image-bytes.js"></script>'), a = h.indexOf('<script src="parts/app.js"></script>');
    const sch = h.indexOf('<script src="parts/myhome/schedule-api.js"></script>');
    chk(i > 0 && i < sch && i < a, 'html — image-bytes.js 가 provider · app.js 보다 먼저');
    chk(/PRELOAD\.push\('image-bytes\.js'\)/.test(S.SMOKE), 'smoke PRELOAD 에 image-bytes.js');
    for(const [n, src] of [['gift-api', S.GIFT], ['schedule-api', S.SCH], ['guestbook-api', S.GB]]){
      const code = strip(src);
      chk(!/\batob\b|parseDataUrl/.test(code) && /imageBytes\.inspect\(/.test(code), n + ' — data: 풀기 사본 없음(atob · parseDataUrl 0) · imageBytes.inspect 를 부른다');
    }
    const app = strip(S.APP);
    chk(/createScheduleApi\(\{[^}]*imageBytes: TwImageBytes/.test(app) && /createGiftApi\(\{[^}]*imageBytes: TwImageBytes/.test(app) && /createGuestbookApi\(\{[^}]*imageBytes: TwImageBytes/.test(app),
      'app.js 가 세 provider 에 TwImageBytes 를 넘긴다');
    chk(!/firebase|localStorage|fetch\(/.test(strip(S.IMG)), 'image-bytes.js 는 순수 — 부르는 곳 없음');
  }
}

judge(SRC0);

say('── 4. 일부러 깨 보기');
const BREAKS = [
  ['IMG', "img.bytes.length > o.maxBytes", "false", '상한 비교를 뺌'],
  ['IMG', "img.bytes.length > o.maxBytes", "img.bytes.length >= o.maxBytes", '상한과 같은 크기를 거절함'],
  ['IMG', "if(img.bytes.length === 0) return", "if(false) return", '빈 그림을 통과시킴'],
  ['IMG', "o.types.indexOf(img.type) < 0", "false", '종류를 안 봄'],
  ['IMG', "bytes[i] = bin.charCodeAt(i);", "bytes[i] = bin.charCodeAt(i) & 127;", '바이트를 깎음'],
  ['IMG', "catch(_){ return null; }", "catch(_){ return { type: m[1], bytes: new Uint8Array(0) }; }", '깨진 base64 를 빈 그림으로'],
  ['IMG', "$/.exec(typeof u", "/.exec(typeof u", '글 끝 모양을 안 봄'],
  ['HTML', '<script src="parts/shared/image-bytes.js"></script>', '', 'html 에 안 실음'],
  ['SMOKE', "PRELOAD.push('image-bytes.js');", "", 'smoke 에 안 실음'],
  ['GIFT', "imageBytes.inspect(", "inspectOld(", 'provider 가 공용 판정을 안 부름'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ judge(S); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

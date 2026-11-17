/* sim-person-name.js — 🏷️ 사람 이름을 화면 글로(shared/person-name.js) · 받는 쪽은 자리표시를 만들지 않는다
   실행:  node sim-person-name.js   (person-name.js · friends-api.js · room-invite-rt.js · desk-companion-prototype.html · smoke.js 가 있는 폴더에서)
   ★ 왜 이 검사가 있는가 — 이름의 주인은 서버 계정이다(이름 없음 = null). 받는 쪽마다 placeholder 를 따로 고르거나
     이 PC · 서버에 적지 않게, «이름 없음» 은 그리는 순간에만 — 이 파일 한 곳. 사용자가 저장한 «나» 는 진짜 이름이다.
   ・1절: shown — 이름 · 공백 · null · 빈 글 · 글이 아닌 값 · «알 수 없음»(서버가 모르는 사람)은 그대로
   ・2절: 받는 쪽 — 친구 명함 · 방 초대가 이름 없는 사람을 '' 로 들고(placeholder 없음) 화면이 «이름 없음» 으로 그린다
   ・3절: mutation test · 4절: 배선(html · smoke 순서 · 렌더러에 옛 placeholder 가 안 남음) */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'checks/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('person-name.js') || read('shared/person-name.js'),
  FAPI = read('friends-api.js') || read('friends/friends-api.js'),
  INV = read('room-invite-rt.js') || read('room/room-invite-rt.js'),
  HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !FAPI || !INV || !HTML || !SMOKE) { say('  ? 원본 못 찾음 — person-name.js · friends-api.js · room-invite-rt.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }

const load = (src, name) => { const w = { TwRtHub: { store: { onMessage(){}, send: () => true, request: async () => null, isReady: () => false } } }; new Function('window', 'module', src)(w, undefined); return w[name]; };

function behave(src, fapi, inv){
  const r = []; const t = (ok, m) => r.push([!!ok, m]);
  const N = load(src, 'TwPersonName');
  t(N && typeof N.shown === 'function' && N.NO_NAME === '이름 없음', '싣기만 하면 window.TwPersonName · 이름 없음 글은 «이름 없음»');
  t(N.shown('민수') === '민수' && N.shown('  민수 ') === '민수', '★ 이름이 있으면 그 이름(앞뒤 공백은 걷음)');
  t(N.shown(null) === '이름 없음' && N.shown(undefined) === '이름 없음', '★ null · 필드 없음 → «이름 없음»');
  t(N.shown('') === '이름 없음' && N.shown('   ') === '이름 없음', '★ 빈 글 · 공백뿐 → «이름 없음»');
  t(N.shown(0) === '이름 없음' && N.shown({}) === '이름 없음' && N.shown(false) === '이름 없음', '  글이 아닌 값 → «이름 없음»(숫자 · 객체를 이름으로 그리지 않는다)');
  t(N.shown('나') === '나' && N.shown(' 나 ') === '나', '★ 사용자가 저장한 «나» 는 진짜 이름 — 그대로 «나»');
  t(N.shown('알 수 없음') === '알 수 없음', '  서버가 모르는 사람(«알 수 없음»)은 그대로 — 앱이 따로 고르지 않는다');
  t(N.shown('<b>나비</b>') === '<b>나비</b>', '  씻지 않는다(HTML 에 넣을 땐 TwSafeHtml.text 몫 · 두 번 씻으면 &lt; 가 글자로 보인다)');
  t(Object.isFrozen(N), '  고칠 수 없는 객체');

  /* 친구 명함 — 이름 없는 친구는 '' 그대로 */
  const F = load(fapi, 'TwFriendsApi');
  const p0 = F.profileOf({ name: '', level: 3, cyc: null, clv: null, starC: null });
  const p1 = F.profileOf({ name: '나비', level: 3 });
  t(p0.name === '' && p1.name === '나비' && N.shown(p0.name) === '이름 없음', '★ 친구 명함 — 이름이 없으면 \'\' 그대로(placeholder 없음) · 그릴 때 «이름 없음»');

  /* 방 초대 — 서버가 이름 없는 보낸 사람을 빈 글로 준다 */
  const I = load(inv, 'TwRoomInviteRt');
  const hs = {}; let got = null;
  const hub = { onMessage: (t2, f) => { hs[t2] = f; }, send: () => true, request: async () => null, isReady: () => true };
  const inv0 = I.createRoomInviteRt({ hub });
  inv0.onInvites((v) => { got = v; });
  hs.roomInvited({ t: 'roomInvited', from: 'uA', fromName: '', room: 'PLAY-1', ts: 5 });
  hs.roomInvited({ t: 'roomInvited', from: 'uB', fromName: '두부', room: 'PLAY-2', ts: 6 });
  hs.roomInvited({ t: 'roomInvited', from: 'uC', room: 'PLAY-3', ts: 7 });
  t(got && got.uA.fromName === '' && got.uB.fromName === '두부' && got.uC.fromName === '' && N.shown(got.uA.fromName) === '이름 없음',
    '★ 방 초대 — 이름 없는 보낸 사람은 \'\' 로 든다(«친구» placeholder 없음) · 그릴 때 «이름 없음»');
  return r;
}

say('── 1 · 2. 이름 그리기 · 받는 쪽');
behave(MOD, FAPI, INV).forEach(([ok, m]) => chk(ok, m));

say('── 3. mutation test — 하나라도 못 잡으면 빨강');
const breaks = [
  ['이름 없음을 빈 글로 그림', 'm', (s) => s.replace("return s || NO_NAME;", "return s;")],
  ['공백을 안 걷음', 'm', (s) => s.replace("name.trim()", "name")],
  ['placeholder 를 «나» 로', 'm', (s) => s.replace("const NO_NAME = '이름 없음';", "const NO_NAME = '나';")],
  ['저장한 «나» 를 이름 없음으로', 'm', (s) => s.replace("return s || NO_NAME;", "return (s && s !== '나') ? s : NO_NAME;")],
  ['글이 아닌 값도 이름으로', 'm', (s) => s.replace("(typeof name === 'string') ? name.trim() : ''", "String(name == null ? '' : name).trim()")],
  ['친구 명함에 자리표시를 다시 만듦', 'f', (s) => s.replace("return { name: card.name, level", "return { name: card.name || '(이름 없음)', level")],
  ['방 초대에 «친구» 자리표시를 다시 만듦', 'i', (s) => s.replace("fromName: (typeof m.fromName === 'string') ? m.fromName : ''", "fromName: (typeof m.fromName === 'string' && m.fromName) ? m.fromName : '친구'")],
];
for (const [name, which, f] of breaks) {
  const m = which === 'm' ? f(MOD) : MOD, fa = which === 'f' ? f(FAPI) : FAPI, iv = which === 'i' ? f(INV) : INV;
  const changed = m !== MOD || fa !== FAPI || iv !== INV;
  let red; try { red = behave(m, fa, iv).some(([ok]) => !ok); } catch (_) { red = true; }
  chk(changed && red, name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

say('── 4. 배선');
const iN = HTML.indexOf('<script src="parts/shared/person-name.js">'), iApp = HTML.indexOf('<script src="parts/app.js"');
/* TwPersonName 을 부르는 렌더러 파일 — 모두 person-name.js 뒤에 실려야 한다(앞이면 첫 그리기에서 «정의 안 됨») */
const PARTS = (() => { for (const c of ['parts', 'app/parts']) if (fs.existsSync(c)) return c; return null; })();
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : (e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
const files = PARTS ? walk(PARTS) : [];
const users = files.filter((f) => !/person-name\.js$/.test(f) && /\bTwPersonName\.shown\(/.test(fs.readFileSync(f, 'utf8')));
chk(iN > 0 && (iApp < 0 || iN < iApp), 'html — person-name.js 를 app.js 보다 먼저');
const late = users.map((f) => path.basename(f)).filter((b) => { const i = HTML.search(new RegExp('<script[^>]*src="parts/[^"]*/' + b.replace('.', '\\.') + '"')); return i >= 0 && i < iN; });
chk(users.length >= 15 && late.length === 0, '★ 이름을 그리는 모듈 ' + users.length + '개 — 모두 person-name.js 뒤에 싣는다' + (late.length ? ' · 앞: ' + late.join(', ') : ''));
const sN = SMOKE.indexOf("PRELOAD.push('person-name.js');");
chk(sN > 0, 'smoke PRELOAD — person-name.js');
/* 이름 대신 쓰는 placeholder 가 렌더러에 다시 생기지 않는다 — 이름 없음 글은 person-name.js 한 곳이 정한다 */
const OLD = /(?<!bone)\.(name|friendName|fromName|senderName)\s*\|\|\s*'(이름 없음|\(이름 없음\)|나|친구|손님|누군가|참가자|요청|\?)'/;
const left = files.filter((f) => OLD.test(fs.readFileSync(f, 'utf8'))).map((f) => path.basename(f));
chk(files.length > 50 && left.length === 0, '★ 렌더러에 «이름 || \'(이름 없음)\' · \'친구\' · \'손님\' · \'?\'» 자리표시가 없다' + (left.length ? ' — ' + left.join(', ') : ''));

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass + ' — 이름이 없으면 그릴 때만 «이름 없음»'));
process.exit(fail ? 1 : 0);

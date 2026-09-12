/* sim-room-clock.js — 🕒 멤버 생존 판정이 **내 PC 시계에 휘둘리지 않는가**
   실행: node sim-room-clock.js   (firebase-init.js 와 같은 폴더에서)

   ★ 무엇을 지키는가
     제보: "시크릿룸에 초대받아 들어갔는데 **나만** 아무도 안 보인다. 남들은 나를 본다.
            채팅창 멤버 목록에도 나 혼자. 가끔 그런다."
     정체: 생존 판정이 `내PC시계 - 상대의서버시각 < 문턱` 이었다. 두 시계를 빼고 있었으므로
           내 시계가 문턱만큼만 앞서면 **살아 있는 사람 전원이 유령**이 된다.
           내 노드는 서버가 찍으니 남들 화면에선 멀쩡하다 — 그래서 비대칭이고,
           시계는 저절로 드리프트하니 "가끔"이다.
     대책: 기준 시각을 **스냅샷 안의 서버 값(내 노드의 lastSeen)** 으로 바꿨다.
           서버시각 ↔ 서버시각 비교라 로컬 시계가 몇 시간 틀려도 결과가 같다.

   ⚠️ 이 파일은 `_roomClockNow` 와 문턱만 본다. RTDB·네트워크는 보지 않는다.
     여기서 통과했다고 제보가 끝났다는 뜻이 아니다 — `friends` 가 비는 갈래는 넷이고
     이 수정이 지우는 것은 그중 '시계' 하나다(나머지는 진단 로그가 가른다). */
'use strict';
const fs = require('fs'), vm = require('vm');

let fail = 0;
const say = console.log;
const chk = (ok, m) => { if(!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + m); };

const src = fs.readFileSync('firebase-init.js', 'utf8');

/* 순수 헬퍼 두 개만 떼어 온다 — firebase SDK 를 안 부르는 구간이다. */
const from = src.indexOf('function _roomClockNow');
const to   = src.indexOf('\n  }', src.indexOf('function _roomOccupants')) + 4;
if(from < 0 || to < 4){ say('✗ _roomClockNow / _roomOccupants 를 못 찾음'); process.exit(1); }

/* 문턱은 소스에서 직접 읽는다 — 여기 숫자를 손으로 적어 두면 본문만 바뀌었을 때 검사가 거짓말을 한다. */
const mStale = src.match(/const now = _roomClockNow\(_raw, memberId\); const STALE_MS = (\d+)\*1000;/);
if(!mStale){ say('✗ 멤버 필터에서 _roomClockNow / STALE_MS 를 못 찾음 — 기준 시각이 되돌려졌는지 확인할 것'); process.exit(1); }
const STALE_MS = parseInt(mStale[1], 10) * 1000;

let LOCAL_SKEW = 0;          // 내 PC 시계가 서버보다 앞선 양(ms)
const SERVER_NOW = 1_800_000_000_000;
const ctx = {
  Date: { now: () => SERVER_NOW + LOCAL_SKEW },
  _svTimeOffset: 0,
};
vm.createContext(ctx);
vm.runInContext(
  'const _svNow = () => Date.now() + _svTimeOffset;\n' + src.slice(from, to) +
  ';globalThis.__G = { clock: _roomClockNow, occupants: _roomOccupants };',
  ctx, { filename: 'room-clock.js' });
const G = ctx.__G;

/* 서버가 찍은 스냅샷 하나 — 전원 방금 하트비트를 보냈다(=전부 살아 있다). */
const HB = 30 * 1000;
function snapshot(myAge, otherAges){
  const raw = { _meta: { host: 'x' }, chatLog: { a: 1 } };
  raw['mMe'] = { name: '나', state: 'idle', lastSeen: SERVER_NOW - myAge };
  otherAges.forEach((a, i) => { raw['mF' + i] = { name: '친구' + i, state: 'idle', lastSeen: SERVER_NOW - a }; });
  return raw;
}
/* 실제 필터와 **같은 식**으로 통과 인원을 센다. */
function passCount(raw){
  const now = G.clock(raw, 'mMe');
  let n = 0;
  for(const id in raw){
    if(id === 'mMe' || id.charAt(0) === '_' || id === 'chatLog') continue;
    const m = raw[id];
    if(m && m.lastSeen && (now - m.lastSeen) < STALE_MS) n++;
  }
  return n;
}

say('── 0. 전제');
{
  say('    문턱 ' + (STALE_MS/1000) + '초 · 하트비트 30초');
  chk(STALE_MS >= 90*1000 + HB, '★ 문턱이 (유실허용 90초 + 하트비트 지연 30초) 이상이다 — ' +
      '기준값 자체가 최대 30초 과거라 90 이면 멀쩡한 사람이 주기마다 깜빡인다');
  chk(STALE_MS <= 5*60*1000, '지나치게 넉넉하지 않다 — 유령이 오래 남으면 같은 사람이 여럿으로 보인다');
}

say('\n── 1. ★ 내 시계가 아무리 틀려도 결과가 같은가 (이 사안의 본체)');
{
  const raw = snapshot(5*1000, [3*1000, 10*1000, 25*1000]);   // 넷 다 살아 있다
  const base = passCount(raw);
  chk(base === 3, '시계가 맞을 때 친구 3명이 보인다');
  for(const skewMin of [1, 2, 5, 30, 60, 24*60]){
    LOCAL_SKEW = skewMin * 60 * 1000;
    chk(passCount(raw) === 3, '내 시계가 ' + skewMin + '분 **앞설** 때도 3명 — 예전 코드면 여기서 0명');
  }
  for(const skewMin of [1, 5, 60]){
    LOCAL_SKEW = -skewMin * 60 * 1000;
    chk(passCount(raw) === 3, '내 시계가 ' + skewMin + '분 **뒤처질** 때도 3명');
  }
  LOCAL_SKEW = 0;
}

say('\n── 2. 유령은 여전히 걸러지는가 (안전망을 없앤 게 아니다)');
{
  const raw = snapshot(5*1000, [3*1000, STALE_MS + 60*1000]);   // 한 명은 확실히 죽었다
  chk(passCount(raw) === 1, '문턱을 넘긴 노드는 제외된다');
  LOCAL_SKEW = 60*60*1000;
  chk(passCount(raw) === 1, '★ 내 시계가 1시간 틀려도 판정이 흔들리지 않는다(유령 판정도 서버 기준)');
  LOCAL_SKEW = 0;
  const raw2 = snapshot(5*1000, [3*1000]);
  raw2.mF0.lastSeen = null;                     // lastSeen 이 아예 없는 옛 잔재
  chk(passCount(raw2) === 0, 'lastSeen 이 없는 항목은 그대로 유령 취급');
}

say('\n── 3. 내 노드를 못 구할 때의 폴백');
{
  const raw = snapshot(5*1000, [3*1000]);
  delete raw.mMe;                               // 첫 스냅샷에 내 노드가 아직 없는 경우
  LOCAL_SKEW = 0;
  chk(passCount(raw) === 1, '내 노드가 없으면 _svNow 로 물러난다 — 시계가 맞으면 예전과 동일');
  chk(G.clock(raw, 'mMe') === SERVER_NOW, '폴백 값이 로컬 시계다(예전 동작 그대로)');
  const raw3 = snapshot(5*1000, [3*1000]);
  raw3.mMe.lastSeen = { '.sv': 'timestamp' };   // 아직 해결되지 않은 sentinel
  chk(G.clock(raw3, 'mMe') === SERVER_NOW, '숫자가 아닌 lastSeen 은 기준으로 쓰지 않는다');
  LOCAL_SKEW = 0;
}

say('\n── 4. 예약 키를 멤버로 세지 않는가 (진단 로그의 오발동 방지)');
{
  const raw = snapshot(5*1000, [3*1000, 4*1000]);
  chk(G.occupants(raw, 'mMe') === 2, '_meta·chatLog·나 를 뺀 인원만 센다 — ' + G.occupants(raw, 'mMe') + '명');
  chk(G.occupants({ _meta:{}, chatLog:{}, mMe:{} }, 'mMe') === 0, '나 혼자면 0명 (진단 로그가 안 뜬다)');
}

say('\n── 5. 되돌림 방지 — 소스에 기준이 남아 있는가');
{
  chk(/_roomClockNow\(_raw, memberId\)/.test(src), '★ 멤버 필터가 _roomClockNow 를 쓴다(로컬 시계로 되돌아가지 않았다)');
  chk(/_now0 = _roomClockNow\(/.test(src), '첫 스냅샷 청소도 같은 기준을 쓴다');
  const bare = (src.match(/const now = Date\.now\(\); const STALE/g) || []);
  chk(bare.length === 0, '★ 생 Date.now() 로 생존 판정하는 자리가 남아 있지 않다' +
      (bare.length ? ' — ' + bare.length + '곳' : ''));
}

say(fail ? '\n✗ 실패 ' + fail + '건' : '\n✓ 전부 통과');
process.exit(fail ? 1 : 0);

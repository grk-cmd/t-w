/* ═══ 🔫 sim-fly-roulette.js — 러시안룰렛 (2026-09-23 · handoff-2026-09-21-features §1) ═══════════════════════
   [무엇을 지키나] 상태칩 ▼ 메뉴 💃 아래 🔫. 누른 사람만 주사위 둘 · 하나라도 1이면 **본인이** 날아간다(11/36).
   ・1절: 배선 — 버튼이 💃 바로 아래 · 채널에 따라 숨기지 않는다 · 클릭은 _rollRoulette 한 곳.
   ・2절: 정적 — 날리기는 pokeSelf('fly:') 로만(throwFlyAt · Presence.poke 안 씀) · 레벨 게이트 없음 · 채널 2 차단 줄 없음 ·
          내 화면에서 먼저 startFlight 안 함(방송 규약).
   ・3절: 떼어 와 돌림 — 회사원 모드 토스트·무반응 · 1 없음 = 안 날아감 · 1 있음 = pokeSelf 한 번 · 워킹룸 기록 없음 ·
          투게더룸 기록 한 줄 · 혼자 = applyRemoteFly 직접 · 쉬는 중 · 연타.
   ・4절: 투게더룸 🎲 도 룰렛 (2026-09-23 요청) — 1이면 같은 한 곳(_selfFlyAfterDice)으로 날아감 · 굴리기는 안 막음 ·
          못 나는 때(회사원 · 쉬는 중 · canFly)는 주사위만 · 기록 문장은 날든 안 날든 원래 🎲 문장 그대로(«날아갔어요» 꼬리 없음 · 2026-09-23 요청).
   [실행] app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const grabFn = (name) => { const i = SRC.indexOf('function ' + name + '('); if(i < 0) return ''; let k = SRC.indexOf('{', i), d = 0; for(; k < SRC.length; k++){ if(SRC[k] === '{') d++; else if(SRC[k] === '}' && --d === 0) return SRC.slice(i, k + 1); } return ''; };

say('── 1. 배선');
{
  chk(/id="myDanceBtn"[^\n]*\n(?:\s*<!--[^\n]*-->\n)?\s*<button id="myRouletteBtn"/.test(HTML), '🔫 버튼이 💃 춤추기 바로 아래');
  /* ⚠️ [2026-09-23 요청] 버튼은 투게더룸(채널 2)에서 숨긴다 — 거기선 대화창 🎲 가 같은 일을 한다.
     💃 춤추기와 **같은 자리**에서 같은 방식으로 숨겨야 한다(메뉴 여는 곳 한 곳). */
  const iMore = SRC.indexOf("const danceBtn = document.getElementById('myDanceBtn');");
  const around = SRC.slice(iMore, iMore + 700);
  chk(/rouletteBtn\.style\.display = \(window\._activeChannel === 2\) \? 'none' : ''/.test(around)
      && /danceBtn\.style\.display = \(window\._activeChannel === 2\) \? 'none' : ''/.test(around), '투게더룸에서는 버튼을 숨긴다(💃 와 같은 자리)');
  const i = SRC.lastIndexOf("getElementById('myRouletteBtn')");
  chk(i > 0 && /_rollRoulette\(\)/.test(SRC.slice(i, i + 400)), '클릭은 _rollRoulette 한 곳으로');
}

say('── 2. 정적');
const FN = grabFn('_rollRoulette');
const body = strip(FN);
const FLY = grabFn('_selfFlyAfterDice'), READY = grabFn('_selfFlyReady'), DICE = grabFn('_rollDice');
const flyBody = strip(FLY);
{
  chk(!!FN, '_rollRoulette 가 있다');
  chk(!!FLY && /_selfFlyAfterDice\(\)/.test(body), '날리기는 공용 _selfFlyAfterDice 한 곳');
  chk(/pokeSelf\('fly:'\s*\+\s*seed\)/.test(flyBody), '그 한 곳은 pokeSelf(\'fly:\'+시드)');
  chk(!/throwFlyAt|Presence\.poke\(/.test(body + flyBody), 'throwFlyAt · Presence.poke(남 겨누기) 안 씀');
  chk(!/FLY_MIN_LEVEL|getFocusLevel/.test(body), '레벨 게이트 없음');
  chk(!/_activeChannel\s*!==\s*2\)\s*return/.test(body), '채널 2 차단 줄 없음(_rollDice 와 다름)');
  chk(!/startFlight\(/.test(body + flyBody), '방에서는 내 화면에서 먼저 돌리지 않는다(startFlight 직접 호출 없음)');
  chk(/officeMode/.test(body.split('Math.random')[0]), '회사원 모드 판정이 주사위보다 먼저');
}

say('── 3. 떼어 와 돌림');
function run(o){
  const log = { toast: [], bubble: [], chat: [], chatLog: [], pokeSelf: [], remoteFly: [] };
  const timers = [];
  const rnd = (o.rolls || [0.5, 0.5]).slice();
  const M = Object.create(Math); M.random = () => rnd.length ? rnd.shift() : 0.5;
  const me = { isMe: true };
  const env = {
    officeMode: !!o.office, window: { _activeChannel: o.ch == null ? 1 : o.ch, firebaseAPI: { sendChatLog: (room, m) => log.chatLog.push(m.text) } },
    toast: (t) => log.toast.push(t), findMySeat: () => me,
    showChatBubble: (s, t) => log.bubble.push(t),
    getMyUserId: () => 'u1',
    firebaseAPI: { sendChatLog: (room, m) => log.chatLog.push(m.text) },
    Presence: { active: () => !!o.room, roomCode: () => o.room ? 'R1' : null, sendChat: (t) => log.chat.push(t), pokeSelf: (t) => log.pokeSelf.push(t) },
    getDisplayName: () => '나', _flyChatLog: (t) => log.chatLog.push(t),
    canFly: () => o.cantFly ? { ok: false, why: '이미 날아가는 중이에요' } : { ok: true },
    flySeed: () => 42, applyRemoteFly: (s, v) => log.remoteFly.push(v),
    setTimeout: (f) => timers.push(f), Date: { now: () => o.now || 100000 }, Math: M,
    _myFlyCoolUntil: o.cool || 0, _rouletteAt: o.last || 0, ROULETTE_COOL_MS: 3000, ROULETTE_FLY_DELAY_MS: 700,
  };
  const keys = Object.keys(env);
  new Function(...keys, READY + '\n' + FLY + '\n' + (o.fn || FN) + '\n' + (o.call || '_rollRoulette') + '();')(...keys.map(k => env[k]));
  timers.forEach(f => f());
  return log;
}
{
  let r = run({ office: true, room: true, rolls: [0, 0] });
  chk(r.toast.length === 1 && /회사원/.test(r.toast[0]) && !r.bubble.length && !r.pokeSelf.length && !r.chat.length, '회사원 모드: 토스트 하나 · 굴리지도 날리지도 않음');
  r = run({ room: true, ch: 1, rolls: [0.5, 0.9] });            // 4 · 6
  chk(r.bubble[0] === '[dice:4][dice:6]' && r.chat[0] === '[dice:4][dice:6]', '말풍선 + 방 전송(워킹룸 포함)');
  chk(!r.pokeSelf.length && !r.remoteFly.length, '1 없음 → 안 날아감');
  chk(!r.chatLog.length, '워킹룸(채널 1) → 대화 기록 없음');
  r = run({ room: true, ch: 1, rolls: [0.5, 0.01] });           // 4 · 1
  chk(r.pokeSelf.length === 1 && r.pokeSelf[0] === 'fly:42' && !r.remoteFly.length, '1 있음 → pokeSelf(\'fly:시드\') 한 번 · 로컬 직접 재생 없음');
  r = run({ room: true, ch: 2, rolls: [0.01, 0.01] });          // 1 · 1
  chk(r.chatLog.length === 1 && /님이 룰렛/.test(r.chatLog[0]) && !/날아갔|살아남/.test(r.chatLog[0]), '투게더룸 → 기록 한 줄(«님이» · 결과 꼬리 없음)');
  r = run({ room: true, ch: 2, rolls: [0.5, 0.5] });
  chk(r.chatLog.length === 1 && !/날아갔|살아남/.test(r.chatLog[0]), '투게더룸 · 1 없음도 같은 모양 한 줄');
  r = run({ room: false, ch: 0, rolls: [0.01, 0.5] });
  chk(r.remoteFly.length === 1 && r.remoteFly[0] === '42' && !r.pokeSelf.length && !r.chat.length, '혼자 → applyRemoteFly 직접(방송 없음)');
  r = run({ room: true, cool: 150000, rolls: [0, 0] });
  chk(!r.bubble.length && !r.pokeSelf.length && /쉬는/.test(r.toast[0] || ''), '쉬는 시간 → 안내만');
  r = run({ room: true, last: 99000, rolls: [0, 0] });
  chk(!r.bubble.length && r.toast.length === 1, '3초 연타 → 안내만');
  r = run({ room: true, cantFly: true, rolls: [0, 0] });
  chk(!r.bubble.length && r.toast[0] === '이미 날아가는 중이에요', '못 나는 상태 → canFly 사유');
  /* 확률 — 36칸 전수 */
  let hits = 0; for(let a = 1; a <= 6; a++) for(let b = 1; b <= 6; b++) if(a === 1 || b === 1) hits++;
  chk(hits === 11 && /n1 === 1 \|\| n2 === 1/.test(body), '판정 = 하나라도 1 (11/36)');
}

say('── 4. 투게더룸 🎲 도 룰렛');
{
  chk(!!DICE && /_selfFlyAfterDice\(\)/.test(strip(DICE)) && /n1 === 1 \|\| n2 === 1/.test(strip(DICE)), '_rollDice 가 하나라도 1이면 같은 한 곳으로 날린다');
  chk(/officeMode/.test(strip(READY)) && /_myFlyCoolUntil/.test(strip(READY)) && /canFly\(/.test(strip(READY)) && !/toast/.test(strip(READY)), '_selfFlyReady = 회사원 · 쉬는 중 · canFly, 토스트 없음');
  const D = (o) => { const w = Object.assign({ fn: DICE, call: '_rollDice', ch: 2, room: true }, o); return run(w); };
  let r = D({ rolls: [0.01, 0.5] });
  chk(r.bubble[0] === '[dice:1][dice:4]' && r.pokeSelf.length === 1 && r.pokeSelf[0] === 'fly:42', '1 있음 → 주사위 + pokeSelf 한 번');
  chk(r.chatLog.length === 1 && /님이 주사위 \[dice:1\]\[dice:4\] 가 나왔습니다\.$/.test(r.chatLog[0]), '기록: 원래 🎲 문장 그대로(«날아갔어요» 꼬리 없음)');
  r = D({ rolls: [0.5, 0.9] });
  chk(!r.pokeSelf.length && r.chatLog.length === 1 && !/날아갔어요/.test(r.chatLog[0]), '1 없음 → 원래 🎲 그대로');
  r = D({ office: true, rolls: [0.01, 0.01] });
  chk(r.bubble.length === 1 && !r.pokeSelf.length && !r.toast.length && !/날아갔어요/.test(r.chatLog[0] || ''), '회사원 모드 → 주사위만 · 조용히 안 날아감');
  r = D({ cool: 150000, rolls: [0.01, 0.01] });
  chk(r.bubble.length === 1 && !r.pokeSelf.length && !/날아갔어요/.test(r.chatLog[0] || ''), '쉬는 중 → 주사위만');
  r = D({ cantFly: true, rolls: [0.01, 0.01] });
  chk(r.bubble.length === 1 && !r.pokeSelf.length, 'canFly 불가 → 주사위만');
  r = D({ ch: 1, rolls: [0.01, 0.01] });
  chk(!r.bubble.length && !r.pokeSelf.length, '투게더룸이 아니면 🎲 자체가 안 돈다(기존 게이트 그대로)');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

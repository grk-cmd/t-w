/* ═══ 📊 sim-focus-show.js — 오늘 기록 전시 (2026-09-23 · handoff-2026-09-21-features §3 · 🕒 를 눌러 켜고 끔) ═══════════
   [무엇을 지키나] 포커스 기록창 첫 줄 🕒(#focusLogShowClock)를 누르면 방에 «🕒 오늘 H:MM» 를 보여준다.
   ・1절: 마크업 · 배선 — 🕒 가 첫 줄에 id 로 · 클릭 한 곳 · 켜짐 기억(tw.focusShow) · 회사원 모드 전환이 즉시 거둔다.
   ・2절: 값 — 초 없음(H:MM) · 이모지 칸 비움(캐릭터 앞에 안 뜨게) · 12자 · 회사원 모드 = null · 1분에 한 번 · 거둘 때는 바로.
   ・3절: 배관 — 새 필드 없음(_statusOut 이 userStatus 'custom' + customStatus 로) · 상태가 있으면 상태가 이긴다 ·
          입장 페이로드도 같은 통로 · 내 화면 거울(statusConfFor)은 상태가 없을 때만.
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
const CODE = strip(SRC);

say('── 1. 마크업 · 배선');
{
  const r1 = HTML.slice(HTML.indexOf('id="focusLogRow1"'), HTML.indexOf('id="focusLogRow2"'));
  chk(/<span class="flt-clock" id="focusLogShowClock"[^>]*role="button"/.test(r1), '🕒 가 첫 줄(현재/누적 기록)에 #focusLogShowClock · role=button');
  chk(!/focusLogShowClock/.test(HTML.slice(HTML.indexOf('id="focusLogRow2"'), HTML.indexOf('id="focusLogBtns"'))), '둘째 줄(오늘 기록) 🕒 는 그대로');
  chk(/#focusLogShowClock\.on\{[^}]*#ffffcc/.test(HTML), '켜짐 = 크림색(말풍선과 같은 색)');
  chk((CODE.match(/getElementById\('focusLogShowClock'\)/g) || []).length === 2, '🕒 를 잡는 곳은 배선 · UI 갱신 둘뿐');
  chk(/const FOCUS_SHOW_KEY = 'tw\.focusShow';/.test(CODE) && /_lsSet\(FOCUS_SHOW_KEY/.test(CODE), '켜짐 기억 tw.focusShow(_lsSet)');
  chk(/const FOCUS_SHOW_MS  = 60 \* 1000;/.test(CODE) && /setInterval\(\(\)=>_focusShowPush\(false\), 15000\)/.test(CODE), '1분 갱신 · 15초 틱(1분을 넘겨 늦지 않게)');
  const iOff = CODE.indexOf("getElementById('progOfficeModeToggle').onclick");
  chk(iOff > 0 && /_focusShowPush\(true\)/.test(CODE.slice(iOff, iOff + 200)), '회사원 모드 전환이 즉시 다시 보낸다(켜면 거둠)');
}

say('── 2. 값');
const env = { officeMode: false, now: 1e9, sec: 0, sent: [] };
const T = new Function('env', `
  let focusShowOn = false, _focusShowSentAt = 0, _focusShowSent = null;
  const FOCUS_SHOW_MS = 60 * 1000;
  const Date = { now: () => env.now };
  const _rolloverFocusToday = () => env.sec;
  const Presence = { setFocusShow: (c) => env.sent.push(c) };
  ${grabFn('_focusShowText')}
  ${grabFn('_focusShowConf').replace('typeof officeMode', "typeof env.officeMode").replace(/&& officeMode\)/, '&& env.officeMode)')}
  ${grabFn('_focusShowPush')}
  return { set:(v)=>{ focusShowOn=v; }, text:_focusShowText, conf:_focusShowConf, push:_focusShowPush };
`)(env);
{
  chk(T.text(3*3600 + 20*60 + 41) === '오늘 3:20' && T.text(12*3600 + 5*60) === '오늘 12:05', 'H:MM · 초 없음');
  chk(T.text(99*3600 + 59*60 + 59).length <= 12, '가장 긴 값도 customStatus.text ≤ 12 안');
  chk(T.conf() === null, '꺼짐 → null');
  T.set(true); env.sec = 3600;
  /* ⚠️ [고침 · 2026-09-23] 이모지 칸은 **비운다** — 넣으면 커스텀 상태 배관을 타고 캐릭터 앞(책상 위)에도 뜬다(제보). */
  chk(T.conf() && T.conf().emo === '' && T.conf().text === '오늘 1:00', '켜짐 → {이모지 없음, 오늘 1:00}');
  env.officeMode = true; chk(T.conf() === null, '회사원 모드 → null(보내지 않음)'); env.officeMode = false;
  T.push(true); chk(env.sent.length === 1 && env.sent[0].text === '오늘 1:00', '켜는 순간 바로 보냄');
  env.sec = 3600 + 120; env.now += 20 * 1000; T.push(false);
  chk(env.sent.length === 1, '1분 안에는 값이 바뀌어도 안 보냄');
  env.now += 60 * 1000; T.push(false);
  chk(env.sent.length === 2 && env.sent[1].text === '오늘 1:02', '1분이 지나면 새 값(요청 · 처음엔 5분)');
  env.officeMode = true; T.push(false);
  chk(env.sent.length === 3 && env.sent[2] === null, '거둘 때(회사원 모드)는 1분을 안 기다림');
  T.push(false); chk(env.sent.length === 3, '이미 거둔 뒤에는 다시 안 보냄');
}

say('── 3. 배관');
{
  const so = strip(grabFn('_statusOut'));
  chk(/if\(!myUserStatus && myFocusShow\) return \{ userStatus:'custom', customStatus:myFocusShow \}/.test(so), '상태가 없을 때만 custom 칸으로 싣는다(상태 우선)');
  const out = new Function('u', 'f', 'c', 'let myUserStatus=u, myFocusShow=f, myCustomStatus=c;' + grabFn('_statusOut') + ' return _statusOut();');
  const F = { emo: '🕒', text: '오늘 3:20' }, C = { emo: '✨', text: '마감 중' };
  let r = out(null, F, C); chk(r.userStatus === 'custom' && r.customStatus === F, '상태 없음 → 기록');
  r = out('custom', F, C); chk(r.userStatus === 'custom' && r.customStatus === C, '커스텀 상태 켜짐 → 그 문구가 이긴다');
  r = out('away', F, C); chk(r.userStatus === 'away', '자리비움 등 다른 상태도 이긴다');
  r = out(null, null, C); chk(r.userStatus === null && r.customStatus === C, '꺼짐 → 예전 그대로');
  chk(/function _basePayload\(\)\{ const _st=_statusOut\(\);/.test(CODE) && /userStatus:_st0\.userStatus,customStatus:_st0\.customStatus/.test(CODE), '평소 페이로드 · 입장 페이로드 둘 다 같은 통로');
  chk(!/focusShow\s*:/.test(strip(grabFn('_basePayload') || CODE.slice(CODE.indexOf('function _basePayload'), CODE.indexOf('function _basePayload') + 400))), '새 필드 없음(focusShow 키를 싣지 않는다)');
  const sc = strip(grabFn('statusConfFor'));
  chk(/if\(!us\)\{[\s\S]*!seat\.remote && \(seat\.isMe \|\| seat === _mine\)[\s\S]*_focusShowMine\(\)/.test(sc), '내 화면 거울은 상태가 없을 때 · 내 좌석만(자리추가로 바뀐 판 포함)');
  /* ⚠️ [고침 · 2026-09-23] 거울에 방 조건을 걸지 않는다 — 혼자 있는 화면에서 🕒 를 눌러도 보여야 한다(제보). */
  chk(!/Presence\.active/.test(strip(grabFn('_focusShowMine'))) && /_focusShowSent \|\| _focusShowConf\(\)/.test(strip(grabFn('_focusShowMine'))), '거울은 방이 없어도 보인다(보낸 값 · 없으면 보낼 값)');
  chk(/userStatus\) toast\('🕒 켰어요/.test(CODE), '상태가 켜져 있으면 켤 때 그 사실을 알려 준다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

/* weekly-challenge.js — 👑 달성표(주간 달성 · 주중 월~금 / 주말 토·일 트랙) — 규칙 · 기록 · 보상 지급 · 서버 동기화 + 화면(서랍)
   app.js 의 두 구역(«👑 달성표 — 주간 규칙 · 기록» · «👑 달성표 — 화면»)을 그대로 옮긴 모듈이다(앱 FSD 2번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.

   ★ 아래 본문은 app.js 에 있던 글 그대로다 — 들여쓰기도 바꾸지 않았다(옮기기 전 줄과 견주어 볼 수 있게).
     바뀐 것은 셋뿐이다.
       · appMode → appMode() · _gachaBonus → gachaBonus()
         두 값은 app.js 가 나중에 다시 대입하는 let 이라(실행 화면 전환 · 가챠 동기화) 값이 아니라 읽는 함수로 받는다.
       · CHAL_KEY 는 deps.storageKey — 계정 전환 지움 목록(ACCOUNT_LOCAL_KEYS)이 같은 이름을 쓰므로 정의는 app.js 에 남겼다.
   ★ 다른 구역이 다시 대입하던 상태는 함수로 바꾼다 — chalRec · _chalDirty(로그아웃 지우기) → resetMemory(),
     _chalKeyPlatform(활성 앱 판정 _applyActiveAppState) → setKeyPlatform(v).
   ★ createWeeklyChallenge 는 app.js 의 원래 자리에서 부른다. 만들 때 바로 도는 것(localStorage 읽기 · 부팅 동기화 4.4초 타이머 ·
     20초 tick · beforeunload · 버튼 연결 bindChal)이 예전과 같은 순서 · 같은 때에 돈다.
   ⚠️ firebaseAPI · companion · localStorage · document 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwWeeklyChallenge — 크로미움 내장 전역과 겹치는 이름(Scheduler 같은)을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-weekly-challenge.js — 주 · 요일 셈 · 보상 문구 · 판정 · 선지급 · 정산 · 화면 · app.js 배선. */
(function(){

function createWeeklyChallenge(deps){
const getMyUserId = deps.getMyUserId;
const toast = deps.toast;
const escHtml = deps.escHtml;
const formatHMS = deps.formatHMS;
const _premiumOn = deps.premiumOn;              // ⚠️ isPremium 을 직접 읽지 않는다(TDZ) — app.js 의 _premiumOn
const _dayShifted = deps.dayShifted;            // 🌅 하루가 오전 6시에 바뀐다
const _focusDayStr = deps.focusDayStr;
const DAY_START_HOUR = deps.dayStartHour;
const _setGachaBonusLocal = deps.setGachaBonusLocal;
const renderGachaInv = deps.renderGachaInv;
const gachaBonus = deps.gachaBonus;             // 🎰 보너스 뽑기 수 — app.js 의 _gachaBonus(다시 대입되는 let)
const appMode = deps.appMode;                   // 'run' | … — app.js 의 appMode(다시 대입되는 let)

/* ═══════════════════════════════════════════════════════════════════════════════
   👑 달성표 — 주간 달성 시스템 (주중 페이즈 · 주말 페이즈)
   ───────────────────────────────────────────────────────────────────────────────
   한 주가 **두 트랙**으로 나뉜다. 둘은 겹치지 않고 이어 달린다.
     · 주중(wd) 월~금 5칸 — 월 06:00 시작 ~ 토 06:00 마감·정산
     · 주말(we) 토~일 2칸 — 토 06:00 시작 ~ 월 06:00 마감·정산
     ★ 하루 경계는 `_dayShifted()`(오전 6시) 하나가 정한다 — 요일·주·마감이 전부 거기서 나온다.
     ★ 진행 중인 트랙은 **언제나 하나뿐이다.** 그래서 week/kind/cfg/days/today 를 두 벌 두지 않고
       `phase` 한 글자로 구분해 같은 칸을 돌려 쓴다. 끝난 트랙은 arcWd/arcWe 에 박제된다
       (되돌아보기용 — 정산 팝업 하나 뜨고 기록이 사라지면 뭘 며칠 지켰는지 볼 방법이 없다).

   보상 — 한 주 최대 4회
     · 주중  2일 → 1회 · 4일 → 2회.   **3일째를 채우는 순간 1회를 먼저 준다(선지급).**
     · 주말  1일 → 1회 · 2일 → 2회.   **1일째를 채우는 순간 1회를 먼저 준다(선지급).**
     ⚠️ 주중 임계는 안 바꿨다(여전히 2일부터 1회다). 선지급은 **받는 양이 아니라 받는 시각**만
       옮긴다. 원래 3일째는 보상표에서 아무 일도 안 일어나는 죽은 칸이었고, 거기에 이유를 준 것이다.

   ⚠️⚠️ **선지급은 이중지급 위험이 정산보다 훨씬 크다.** 정산은 토·월 오전 6시 한 순간이라
     두 기기가 겹칠 일이 드물었지만, 선지급은 "평일 낮에 목표를 채우는 순간"이다 —
     회사 PC 와 집 PC 를 같이 켜두면 흔히 겹친다. chalRec 은 ts 최신 승 통째 덮어쓰기라,
     선지급 표식(chalRec.early)이 없는 기기가 나중에 저장하면 그 표식이 지워지고 한 번 더 준다.
     그래서 **진짜 방어는 서버에 있다** — firebaseAPI.addChalBonus(uid, n, tag) 가
     users/{uid}/chalPaidTags/{tag} 를 먼저 잡는다. 여기 chalRec.early 는 20초 tick 마다
     서버를 때리지 않기 위한 **1차 필터일 뿐**이다.
     ⚠️ 뽑기는 한 번 나가면 회수 경로가 없다. 이 두 겹을 한 겹으로 줄이지 말 것.

   프리미엄 전용. 게이트 세 곳: ① 버튼 클릭 ② 🔁반복 알림 ③ 보상 지급(선지급·정산 둘 다).

   ★ 저장 정책은 **가챠 쪽(ts 최신 승)** 을 베꼈다 — focus/totalSec 의 max+증분이 아니다.
     주간 상태는 눈금이 아니라 "지금 어떤 주를 어떤 조건으로 하고 있는가"라는 한 덩어리라서,
     두 기기 값을 합치면 (월은 A기기 조건, 화는 B기기 조건 같은) 말이 안 되는 주가 만들어진다.
   ★ 초는 로컬에만 쌓는다. 서버 쓰기는 **판정이 실제로 바뀌는 순간**과 런처 복귀뿐이다.
     🎯집중의 누적 초를 매번 올리면 하루 수천 write 가 된다.
   ⚠️ _focusTotalSec(평생 누적)을 재사용하지 않는다. 그 값은 서버 max 병합이라 다른 기기 값이
     내려와 갑자기 늘어난다 — 그걸로 오늘을 재면 안 켠 기기의 시간으로 저절로 달성된다.
   ═══════════════════════════════════════════════════════════════════════════ */
const CHAL_KEY = deps.storageKey;   // 'tw.chal' — 정의는 app.js(계정 전환 지움 목록 ACCOUNT_LOCAL_KEYS 가 같이 쓴다)
/* 페이즈 표 — 요일 라벨 · 칸 수 · 보상 임계 · 선지급 지점이 전부 여기 한 곳에서 나온다.
   ⚠️ 요일 라벨이나 칸 수를 다른 곳에 또 적지 말 것. days[] 길이와 라벨 길이가 갈리면
     표가 조용히 어긋나고(빈 칸·undefined 요일), 어느 쪽이 진짜인지 알 방법이 없어진다. */
const CHAL_PHASE = {
  wd: { key:'wd', name:'주중', label:['월','화','수','목','금'], n:5,
        need1:2, need2:4, early:3, dueLabel:'토요일 아침' },
  we: { key:'we', name:'주말', label:['토','일'],                n:2,
        need1:1, need2:2, early:1, dueLabel:'월요일 아침' },
};
const CHAL_KIND_LABEL = { focus:'🎯 집중', repeat:'🔁 반복', rule:'📋 규칙' };
const CHAL_RULE_MAX = 10;          // 📋규칙 한 요일당 최대 줄 수
const CHAL_TICK_MS  = 20*1000;     // 자정 경계·알림·판정을 훑는 주기
/* days[] 값의 뜻 — 화면 칸 하나에 대응한다.
     1 달성(✓) · 0 오늘 진행 중(●) · -1 아직 안 온 날(·) · -2 실패(✗) · -3 이 주에 안 세는 날(·) */
const CHAL_D_OK = 1, CHAL_D_NOW = 0, CHAL_D_WAIT = -1, CHAL_D_FAIL = -2, CHAL_D_SKIP = -3;

/* 오늘이 속한 페이즈. 월~금이면 'wd', 토·일이면 'we'. */
function _chalPhaseOf(when){ const w = _dayShifted(when).getDay(); return (w >= 1 && w <= 5) ? 'wd' : 'we'; }
function _chalPh(key){ return CHAL_PHASE[key] || CHAL_PHASE.wd; }

/* ISO 주 번호 — '2026-W33'. 월요일이 주의 첫날이다.
   ★ 주말 트랙도 **같은 주 문자열**을 쓴다 — ISO 주는 월요일에 바뀌므로 토·일은 직전 월~금과
     같은 이름이다. 그래서 "이번 주의 주중"과 "이번 주의 주말"이 한 이름으로 묶인다.
     중복 지급을 막는 표식만 페이즈별로 갈라 둔다(paid/paidWe · skip/skipWe · early 는 키에 페이즈 포함).
   ⚠️ 연말연시에 12/31 과 1/1 이 같은 주가 되는 경우가 있어서 연도는 '그 주의 목요일' 기준으로 잡는다.
     단순히 getFullYear() 를 쓰면 한 주가 두 이름으로 갈려 주가 중간에 끊긴다. */
function _chalWeekStr(when){
  const t = _dayShifted(when);   // 🌅 하루가 오전 6시에 바뀐다 — 요일·주 경계가 여기서 따라온다
  t.setHours(0,0,0,0);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));   // 그 주의 목요일로 이동
  const jan4 = new Date(t.getFullYear(), 0, 4);
  const wk = 1 + Math.round(((t - jan4)/86400000 - 3 + ((jan4.getDay()+6)%7)) / 7);
  return t.getFullYear() + '-W' + String(wk).padStart(2,'0');
}
/* 그 페이즈 안에서 오늘이 몇 번째 칸인가. 페이즈가 다르면 -1 (= 이 트랙에 오늘은 없다).
   ⚠️ ph 를 생략하면 **오늘 기준**으로 고른다. 진행 중인 트랙을 다룰 때는 반드시 chalRec.phase 를
     넘길 것 — 토요일 아침에 주중 트랙을 닫는 자리에서 생략하면 주말 칸 번호(0)가 나와
     월요일 칸을 덮어쓴다. */
function _chalDayIdx(when, ph){
  const w = _dayShifted(when).getDay();
  const p = ph || _chalPhaseOf(when);
  if(p === 'wd') return (w >= 1 && w <= 5) ? w - 1 : -1;
  return w === 6 ? 0 : (w === 0 ? 1 : -1);      // 토=0 · 일=1
}
/* 오늘이 끝나는 시각 — 자정이 아니라 **다음 오전 6시**다(🔁반복의 "오늘 안에 n번 채울 수 있나" 판정에 쓴다).
   ⚠️ 이미 6시를 지났으면 내일 6시다. setHours(24,…) 로 두면 6시간 일찍 닫혀 알림 간격이 잘못 계산된다. */
function _chalMidnightMs(){
  const d = new Date(); d.setHours(DAY_START_HOUR,0,0,0);
  if(d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}
function _chalMonday(when){
  const d = _dayShifted(when); d.setHours(0,0,0,0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
/* 그 페이즈가 덮는 날짜 범위 — 주중은 월~금, 주말은 토~일.
   ⚠️ 지나간 트랙에는 쓰지 말 것(오늘 기준 월요일에서 세므로 다른 주를 가리킨다).
     박제(arcWd/arcWe)는 정산 시점에 이 값을 문자열로 받아 두고 그걸 그대로 보여준다. */
function _chalRangeLabel(phKey){
  const mon = _chalMonday();
  const off = (phKey === 'we') ? [5, 6] : [0, 4];
  const a = new Date(mon), b = new Date(mon);
  a.setDate(a.getDate() + off[0]); b.setDate(b.getDate() + off[1]);
  return (a.getMonth()+1) + '/' + a.getDate() + ' ~ ' + (b.getMonth()+1) + '/' + b.getDate();
}

function _chalBlank(){
  return {
    ts:0,
    phase:'wd',         // 지금 달리고 있는 트랙 — 'wd'(월~금) | 'we'(토·일)
    week:'', kind:'', cfg:null, pendingCfg:null,
    days:null,          // [5] 또는 [2] — 위 CHAL_D_* 값. 길이는 phase 가 정한다
    today:null,         // {date, sec, done, checks:{}, anchor, fail}
    auto:false,         // 다음 주 주중에도 같은 조건으로 자동 시작
    autoWe:false,       // ★ 주말 자동은 **따로** 켠다 — 하나로 묶으면 평일 조건이 주말에도 자동으로
                        //   켜져서, 쉬려던 사람에게 실패 도장이 찍힌다
    last:null,          // {kind, cfg} — 주중 자동 시작이 되살릴 지난 조건
    lastWe:null,        // {kind, cfg} — 주말 쪽
    paid:'',            // 정산을 끝낸 주(주중) — 중복 지급 방지
    paidWe:'',          // 정산을 끝낸 주(주말)
    skip:'', skipWe:'', // 이 주에는 자동 시작하지 않는다(포기한 주)
    early:'',           // 선지급을 끝낸 '주-페이즈' 키 (예: '2026-W35-wd') — 1차 필터일 뿐이다
    due:null,           // 아직 서버가 확인해 주지 않은 지급 대기줄 [{tag, n, ts}, …]
    arcWd:null,         // 끝난 주중 트랙 박제 {week, kind, cfg, days, s, tickets, range}
    arcWe:null,         // 끝난 주말 트랙 박제
    paused:false,       // 라이선스가 풀려 판정을 멈춘 상태
  };
}
let chalRec = _chalBlank();
let _chalDirty = false, _chalSyncing = false, _chalPopOpen = false, _chalPrevMode = null;
/* 세그먼트로 지금 **보고 있는** 페이즈. null = 진행 중인 트랙(라이브).
   ⚠️ chalRec 에 넣지 않는다 — 화면을 넘길 때마다 ts 가 찍혀 서버 쓰기와 기기 간 핑퐁이 생긴다.
     이건 저장할 상태가 아니라 지금 이 창의 시선이다. */
let _chalView = null;
try{
  const _v = JSON.parse(localStorage.getItem(CHAL_KEY) || 'null');
  if(_v && typeof _v === 'object') chalRec = Object.assign(_chalBlank(), _v);
}catch(_){}
/* 옛 저장에는 phase 가 없다 — 주중으로 읽는다. (주말 트랙이 없던 시절의 기록은 전부 월~금이다) */
if(!CHAL_PHASE[chalRec.phase]) chalRec.phase = 'wd';

/* touch=true → 이 기기가 방금 바꿨다고 시각을 새로 찍는다.
   touch=숫자 → 서버에서 받아온 시각을 그대로 물려받는다. 새로 찍으면 방금 받은 걸 도로 올리는 핑퐁이 된다.
   (가챠 _saveGachaLocal 과 같은 장치다 — 그쪽 주석 참고) */
function _chalSave(touch){
  if(touch === true) chalRec.ts = Date.now();
  else if(typeof touch === 'number' && touch > 0) chalRec.ts = touch;
  _chalDirty = false;
  try{ localStorage.setItem(CHAL_KEY, JSON.stringify(chalRec)); }catch(_){}
}
function _chalActive(){ return !!(chalRec.week && chalRec.kind); }
function _chalCurPh(){ return _chalPh(chalRec.phase); }
/* 지금 "살아 있는" 페이즈 — 트랙이 돌고 있으면 그 트랙, 아니면 오늘이 속한 쪽. */
function _chalLivePhase(){ return _chalActive() ? chalRec.phase : _chalPhaseOf(); }
function _chalDoneCount(){ return (chalRec.days || []).filter(v => v === CHAL_D_OK).length; }
// 오늘 포함 아직 판정이 안 끝난 날 수 — 보상 문구의 r
function _chalLeftCount(){ return (chalRec.days || []).filter(v => v === CHAL_D_NOW || v === CHAL_D_WAIT).length; }
/* 그 페이즈에서 s일을 지켰을 때 **그 트랙에서 받게 되는 총 횟수**. 선지급분이 이 안에 포함된다. */
function _chalTicketsFor(s, phKey){ const p = _chalPh(phKey); return s >= p.need2 ? 2 : (s >= p.need1 ? 1 : 0); }
/* 선지급 표식 키 — 주와 페이즈를 함께 잡는다. 서버 chalPaidTags 의 키이기도 하다.
   ⚠️ RTDB 키에는 '.', '/', '#', '$', '[', ']' 를 넣을 수 없다. '-' 로만 잇는다. */
function _chalEarlyKey(wk, phKey){ return String(wk || '') + '-' + String(phKey || 'wd'); }
function _chalEarlyDone(){ return !!chalRec.week && chalRec.early === _chalEarlyKey(chalRec.week, chalRec.phase); }

/* 오늘 목표를 채웠는가 — 종류마다 기준이 다르다.
   ⚠️ 여기서 보는 값은 전부 chalRec.today 다. cfg 는 '오늘 판정에 쓰이는 값'이라 수정해도
     자정 전까지는 안 바뀐다(pendingCfg 로 미뤄둔다). */
function _chalTodayMet(){
  const c = chalRec.cfg || {}, t = chalRec.today || {};
  if(chalRec.kind === 'focus')  return (t.sec | 0) >= (c.hours | 0) * 3600;
  if(chalRec.kind === 'repeat') return (t.done | 0) >= (c.times | 0);
  if(chalRec.kind === 'rule'){
    const idx = _chalDayIdx(undefined, chalRec.phase); if(idx < 0) return false;
    const items = _chalRuleItems(c, idx);
    if(!items.length) return false;
    const ck = t.checks || {};
    return items.every((_, i) => !!ck[i]);
  }
  return false;
}
function _chalRuleItems(cfg, dayIdx){
  const rows = ((cfg && cfg.rules) || [])[dayIdx] || [];
  return rows.map(x => String(x || '').trim()).filter(Boolean).slice(0, CHAL_RULE_MAX);
}

/* ── 하루/트랙의 경계 ──────────────────────────────────────────────────────
   ★ 자정 롤오버와 트랙 정산을 **한 함수에서** 처리한다. 앱을 며칠 꺼뒀다 켠 경우까지
     같은 경로로 흘러야 "월요일에 켰더니 지난주가 아직 진행 중"이 안 생긴다.
   ⚠️ 앱이 꺼져 있던 날은 판정할 근거가 없으므로 실패로 닫는다. 이게 유일하게 맞는 선택이다 —
     달성으로 쳐주면 앱을 꺼두는 게 이득이 되고, 안 세면 트랙이 영영 안 끝난다. */
function _chalCloseElapsedDays(mark, weekOver){
  const days = chalRec.days || [], ph = _chalCurPh();
  const prevIdx = _chalDayIdx(chalRec.today && chalRec.today.dateMs || Date.now(), chalRec.phase);
  if(prevIdx >= 0 && days[prevIdx] === CHAL_D_NOW) days[prevIdx] = mark ? CHAL_D_OK : CHAL_D_FAIL;
  /* ★ 트랙이 끝났으면 이 days[] 안에 '오늘' 칸이 없다 — 지나간 트랙의 표이기 때문이다.
     ⚠️ 여기서 오늘 요일로 NOW 를 다시 찍으면, 다음 주 월요일에 처음 켠 사람의 지난주 월요일 ✓ 가
       NOW 로 덮여 달성 일수가 하루 줄고 보상이 2회→1회로 깎인다(sim-dalseong §6 이 잡은 사고).
     ⚠️ _chalDayIdx 에 chalRec.phase 를 넘기는 것도 같은 이유다 — 토요일 아침에 주중 트랙을
       닫으면서 오늘 기준으로 칸을 고르면 주말 칸 번호(0)가 나와 월요일 칸을 덮어쓴다. */
  const nowIdx = weekOver ? -1 : _chalDayIdx(undefined, chalRec.phase);
  const end = nowIdx < 0 ? ph.n : nowIdx;                    // 트랙이 끝났으면 마지막 칸까지 전부 닫는다
  const fill = chalRec.paused ? CHAL_D_SKIP : CHAL_D_FAIL;   // 라이선스가 풀려 멈춰 있던 날은 안 센다
  for(let i = 0; i < end; i++) if(days[i] === CHAL_D_WAIT || days[i] === CHAL_D_NOW) days[i] = fill;
  if(nowIdx >= 0 && days[nowIdx] !== CHAL_D_SKIP) days[nowIdx] = CHAL_D_NOW;
}
function _chalNewDay(){
  const c = chalRec.pendingCfg;
  if(c){ chalRec.cfg = c; chalRec.pendingCfg = null; }   // [수정]한 값은 여기서 처음 적용된다
  chalRec.today = { date:_focusDayStr(), dateMs:Date.now(), sec:0, done:0, checks:{}, anchor:0, fail:false };
}
function _chalEndWeek(){
  chalRec.week = ''; chalRec.kind = ''; chalRec.cfg = null; chalRec.pendingCfg = null;
  chalRec.days = null; chalRec.today = null; chalRec.paused = false;
}

/* ── 🎰 지급 대기줄 ────────────────────────────────────────────────────────────
   [왜 있는가] 예전에는 서버 쓰기가 실패하면 **로컬에만 얹고 끝냈다.** 그 값은 다음 가챠
     동기화에서 서버 값으로 덮이므로, 유저 입장에서는 뽑기가 잠깐 생겼다가 조용히 사라진다.
     tag 방어가 들어오면서 이 구멍이 훨씬 잘 열리게 됐다 — **규칙 파일에 chalPaidTags 블록이
     없으면 tag 쓰기가 통째로 거부되어**, 선지급뿐 아니라 정산 지급까지 전부 그 경로로 샌다.
     (앱 빌드가 규칙보다 먼저 나가면 실제로 벌어진다.)
   [지금] 지급하려던 것을 먼저 대기줄에 적어 두고, **서버가 확인해 줄 때까지 지운다.**
     tag 가 같으므로 몇 번을 다시 시도해도 서버가 dup 으로 막는다 — 재시도가 이중지급이 되지 않는다.
   ⚠️ 로컬 폴백은 **로그인 자체가 없을 때만** 남긴다. 그때는 기기가 하나뿐이라 이중지급 위험도
     없고, 대기줄에 넣어 봐야 영영 안 빠진다. */
const CHAL_DUE_RETRY_MS = 60*1000;   // 실패한 지급을 다시 두드리는 간격
const CHAL_DUE_MAX = 4;              // 한 주에 나갈 수 있는 지급이 넷(주중2·주말2)이라 그만큼만 쌓는다
function _chalDueList(){ return Array.isArray(chalRec.due) ? chalRec.due.filter(d => d && d.tag) : []; }
function _chalPushDue(tag, n){
  const list = _chalDueList().filter(d => d.tag !== tag);
  list.push({ tag:String(tag), n:n | 0, ts:0 });
  chalRec.due = list.slice(-CHAL_DUE_MAX);
  _chalSave(true);
}
function _chalDropDue(tag){
  const before = _chalDueList();
  const list = before.filter(d => d.tag !== tag);
  if(list.length !== before.length){ chalRec.due = list.length ? list : null; _chalSave(true); }
}
/* 20초 tick 이 부른다 — 맨 앞 하나만, 1분에 한 번만 두드린다.
   ⚠️ 여러 개를 한 tick 에 몰아 보내지 않는다. 서버가 죽어 있으면 그만큼 헛쓰기가 곱해진다. */
async function _chalRetryDue(){
  const d = _chalDueList()[0];
  if(!d) return;
  if(Date.now() - (d.ts || 0) < CHAL_DUE_RETRY_MS) return;
  d.ts = Date.now(); _chalSave();
  const got = await _chalPayTickets(d.n, d.tag);
  if(got > 0) try{ toast('🎰 밀렸던 뽑기 ' + got + '회가 들어왔어요'); }catch(_){}
}

/* 🎰 보상 지급 한 곳 — **선지급과 정산이 같은 문을 쓴다.**
     tag 가 붙으면 서버가 users/{uid}/chalPaidTags/{tag} 를 먼저 잡아, 다른 기기가 이미 준 트랙이면
     두 번째 호출이 dup 으로 물러난다(firebase-init.js addChalBonus).
   ⚠️ 서버 표식을 **지급보다 먼저** 찍는다 — 순서를 뒤집으면 "주고 나서 죽었을 때" 표식이 없어
     한 번 더 나간다. 뽑기는 회수 경로가 없으므로 못 주고 끝나는 쪽이 덜 나쁘다.
   ⚠️ 실패하면 **아무것도 얹지 않는다.** 부르는 쪽이 대기줄에 적어 두었으므로 다음에 다시 온다.
     여기서 로컬에 얹으면 그 값이 동기화에 덮이면서 사라지고, 대기줄이 또 주면 이번엔 정말 두 번이 된다.
   반환: 실제로 얹은 횟수(0 이면 아무 일도 안 일어났다). */
async function _chalPayTickets(n, tag){
  const add = Math.max(0, n | 0);
  if(add <= 0) return 0;
  if(!_premiumOn()) return 0;          // ⚠️ 게이트 ③ — 단, 이미 준 것은 회수하지 않는다
  const done = (v) => { _setGachaBonusLocal(v); try{ if(typeof renderGachaInv === 'function') renderGachaInv(); }catch(_){} };
  /* 로그인이 없으면 서버가 아예 없다 = 기기가 하나뿐이다. 예전처럼 로컬에만 얹고 끝낸다. */
  if(!(window.firebaseAPI && firebaseAPI.addChalBonus)){
    done(gachaBonus() + add); _chalDropDue(tag || ''); return add;
  }
  try{
    const r = await firebaseAPI.addChalBonus(getMyUserId(), add, tag || '');
    if(r && r.ok){
      _chalDropDue(tag || '');         // 서버가 확인해 줬다(줬든, 이미 줬든) — 대기줄에서 뺀다
      if(r.dup) return 0;              // 다른 기기가 이미 준 트랙이다 — 조용히 물러난다
      done(r.bonus != null ? r.bonus : (gachaBonus() + add));
      return add;
    }
  }catch(_){}
  console.warn('[달성표] 보상 서버 반영 실패 — 대기줄에 남겨 다시 시도한다', tag || '');
  return 0;
}

/* 🎁 선지급 — 주중은 3일째, 주말은 1일째를 채우는 순간 1회가 그 자리에서 나간다.
   ⚠️ chalRec.early 를 **await 앞에서** 찍는다. 20초 tick 이 await 사이에 한 번 더 들어오면
     같은 트랙으로 두 번 부르게 되는데, 그때 서버 tag 가 막아주긴 하지만 토스트가 두 번 뜬다. */
async function _chalMaybeEarlyPay(){
  if(!_chalActive() || chalRec.paused) return;
  const ph = _chalCurPh();
  if(_chalDoneCount() < ph.early) return;
  const key = _chalEarlyKey(chalRec.week, chalRec.phase);
  if(chalRec.early === key) return;
  chalRec.early = key;
  /* ⚠️ 대기줄에 **먼저** 적는다. 지급이 실패해도 early 표식은 그대로 두는데(안 그러면 tick 마다
     서버를 두드린다), 그러면 대기줄 말고는 이 1회를 다시 시도할 길이 없다. */
  _chalPushDue(key, 1);
  const got = await _chalPayTickets(1, key);
  try{ syncChalToServer('early'); }catch(_){}
  if(got > 0) try{ toast('🎰 뽑기 1회를 받았어요 — 파츠 보관함(T)에서 뽑을 수 있어요'); }catch(_){}
  try{ _chalRender(); }catch(_){}
}

/* 트랙 정산 — 주중은 토요일 06:00, 주말은 월요일 06:00(또는 그 뒤에 처음 켠 시점).
   남은 보상은 여기서 딱 한 번 나간다 — **선지급으로 이미 나간 1회는 빼고** 준다. */
async function _chalSettle(){
  const wk = chalRec.week, s = _chalDoneCount(), kind = chalRec.kind, cfg = chalRec.cfg;
  const phKey = chalRec.phase, we = (phKey === 'we');
  const paidField = we ? 'paidWe' : 'paid';
  const already = (chalRec[paidField] === wk);
  const early = (chalRec.early === _chalEarlyKey(wk, phKey)) ? 1 : 0;
  const total = _chalTicketsFor(s, phKey);
  const rest  = Math.max(0, total - early);
  const days  = (chalRec.days || []).slice();
  chalRec[paidField] = wk;
  if(kind){ if(we) chalRec.lastWe = { kind, cfg }; else chalRec.last = { kind, cfg }; }
  /* 되돌아보기용 박제 — range 를 **여기서** 문자열로 굳힌다. 나중에 오늘 날짜로 다시 계산하면
     다음 주 월요일에 지난 주말 기록이 이번 주 날짜로 보인다. */
  chalRec[we ? 'arcWe' : 'arcWd'] = { week:wk, kind:kind, cfg:cfg, days:days, s:s, tickets:total, range:_chalRangeLabel(phKey) };
  _chalEndWeek();
  _chalSave(true);
  if(already) return;                                   // 이미 정산한 트랙 — 두 번 주지 않는다
  /* ⚠️ 정산은 paid 표식 때문에 **다시 오지 않는다.** 지급이 실패했을 때 되찾을 길은 대기줄뿐이다. */
  const stag = _chalEarlyKey(wk, phKey) + '-s';
  if(rest > 0) _chalPushDue(stag, rest);
  await _chalPayTickets(rest, stag);
  _chalShowSettlePopup(s, total, early, phKey, days);
  try{ syncChalToServer('settle'); }catch(_){}
}

/* 자동 시작 — 트랙 첫날 06:00 이 이상적이지만 **앱이 꺼져 있으면 그 시각에 못 켜진다.**
   그래서 "이 트랙을 아직 시작 안 했고 자동이 켜져 있으면 지금 시작"으로 구현하고,
   실제로 며칠이 잡혔는지를 토스트로 알려준다(수요일에 처음 켜면 수·목·금 3일짜리다).
   ⚠️ 주중/주말 스위치는 따로다 — 하나로 묶으면 평일 조건이 주말에 자동으로 켜진다. */
function _chalMaybeAutoStart(){
  if(_chalActive()) return;
  if(!_premiumOn()) return;
  const phKey = _chalPhaseOf(), we = (phKey === 'we'), ph = _chalPh(phKey);
  const auto = we ? chalRec.autoWe : chalRec.auto;
  const last = we ? chalRec.lastWe : chalRec.last;
  if(!auto || !last) return;
  const wk = _chalWeekStr(), idx = _chalDayIdx(undefined, phKey);
  if(idx < 0) return;
  if((we ? chalRec.paidWe : chalRec.paid) === wk) return;   // 이 트랙은 이미 정산이 끝났다
  if((we ? chalRec.skipWe : chalRec.skip) === wk) return;   // 포기한 트랙
  _chalStart(last.kind, last.cfg, true, phKey);
  const names = ph.label.slice(idx).join('·');
  try{ toast('지난 ' + ph.name + ' 조건으로 자동 시작했어요 (' + names + ' ' + (ph.n - idx) + '일)'); }catch(_){}
}

function _chalStart(kind, cfg, auto, phKey){
  const p = CHAL_PHASE[phKey] ? phKey : _chalPhaseOf(), ph = _chalPh(p);
  const idx = _chalDayIdx(undefined, p);
  if(idx < 0) return false;
  chalRec.phase = p;
  chalRec.week = _chalWeekStr();
  chalRec.kind = kind;
  chalRec.cfg  = cfg;
  chalRec.pendingCfg = null;
  if(p === 'we') chalRec.autoWe = !!auto; else chalRec.auto = !!auto;
  chalRec.paused = false;
  /* 칸 수는 페이즈가 정한다 — [0,1,2,3,4] 를 손으로 적어두면 주말 표가 5칸으로 만들어진다. */
  chalRec.days = [];
  for(let i = 0; i < ph.n; i++) chalRec.days.push(i < idx ? CHAL_D_SKIP : (i === idx ? CHAL_D_NOW : CHAL_D_WAIT));
  _chalNewDay();
  _chalView = null;
  _chalSave(true);
  try{ syncChalToServer('start'); }catch(_){}
  return true;
}
function _chalGiveUp(){
  const we = (chalRec.phase === 'we');
  // 포기한 트랙에는 자동 시작이 다시 켜지 않는다
  if(we) chalRec.skipWe = chalRec.week; else chalRec.skip = chalRec.week;
  if(chalRec.kind){
    if(we) chalRec.lastWe = { kind:chalRec.kind, cfg:chalRec.cfg };
    else   chalRec.last   = { kind:chalRec.kind, cfg:chalRec.cfg };
  }
  /* ⚠️ chalRec.early 는 지우지 않는다 — 포기하고 같은 주에 다시 시작해서 임계를 또 넘겨도
     이미 받은 1회를 한 번 더 주면 안 된다. 서버 tag 도 같은 키라 어차피 dup 으로 막힌다. */
  _chalEndWeek();
  _chalSave(true);
  try{ syncChalToServer('giveup'); }catch(_){}
}

/* 20초마다 · 부팅 시 · 창을 열 때 훑는다. 경계 판정은 전부 여기 모여 있다. */
function _chalTick(){
  /* 라이선스가 풀린 동안은 **아무것도 지우지 않고 멈춘다.** 다시 등록하면 그 사이 날들은
     실패가 아니라 '안 센 날'로 닫힌다(_chalCloseElapsedDays 의 fill). */
  if(!_premiumOn()){
    if(_chalActive() && !chalRec.paused){ chalRec.paused = true; _chalSave(); }
    return;
  }
  /* ⚠️ 대기줄은 **트랙이 없을 때도** 두드린다. 정산 지급이 실패한 경우가 정확히 이 상태다
     (정산이 트랙을 닫고 나가므로, 여기서 안 돌리면 그 뽑기는 영영 안 온다). */
  try{ _chalRetryDue(); }catch(_){}
  if(!_chalActive()){ _chalMaybeAutoStart(); _chalRender(); return; }

  const wk = _chalWeekStr(), phNow = _chalPhaseOf();
  const idx = _chalDayIdx(undefined, chalRec.phase);
  /* 트랙이 끝났다 = 페이즈가 넘어갔거나(토 06:00 · 월 06:00) 주가 통째로 바뀌었다.
     ★ **실제 마감 신호는 페이즈 전환**이다 — ISO 주 문자열은 월요일에야 바뀌므로 그것만 보면
       주중 트랙이 토요일 아침에 안 닫히고 월요일까지 밀린다. 두 조건은 짝이다.
     ⚠️ 주가 바뀌는 조건도 같이 봐야 한다. 주말 트랙은 월요일 06:00 에 페이즈와 주가 동시에
       바뀌고, 앱을 한 주 통째로 꺼뒀다 켠 경우엔 페이즈가 같은 채로 주만 바뀐다. */
  const weekOver = (chalRec.week !== wk) || (chalRec.phase !== phNow);
  const dayOver  = !chalRec.today || chalRec.today.date !== _focusDayStr();

  if(weekOver){
    _chalCloseElapsedDays(dayOver ? false : _chalTodayMet(), true);
    _chalSettle();
    _chalView = null;
    _chalRender();
    return;
  }
  if(dayOver){
    _chalCloseElapsedDays(chalRec.today ? _chalTodayMet() : false, false);
    _chalNewDay();
    chalRec.paused = false;
    _chalSave(true);
    try{ syncChalToServer('rollover'); }catch(_){}
  }else if(chalRec.paused){
    chalRec.paused = false; _chalSave();
  }

  // 오늘 칸 갱신 — 달성한 순간이 곧 쓰기 시점이다(초마다 쓰지 않는다).
  const days = chalRec.days || [];
  const met = _chalTodayMet();
  if(idx >= 0 && met && days[idx] !== CHAL_D_OK){
    days[idx] = CHAL_D_OK;
    _chalSave(true);
    try{ syncChalToServer('day-done'); }catch(_){}
    try{ toast('👑 오늘 달성! ' + _chalDoneCount() + '일째'); }catch(_){}
  }
  /* 🎁 선지급 — 칸이 막 ✓ 로 바뀐 **직후**에 본다. 비동기라 이 tick 을 붙잡지 않는다. */
  try{ _chalMaybeEarlyPay(); }catch(_){}
  try{ _chalRetryDue(); }catch(_){}    // 서버가 못 받아준 지급을 다시 두드린다(1분 간격)
  _chalRepeatTick();
  if(_chalDirty) _chalSave();      // 🎯집중 초는 여기서 한 번에 내려 쓴다
  _chalRender();
}

/* 🔑 판정 키 — main.js 의 keysOf 와 **같은 규칙**이다(main.js 'focusKeyOf/keysOf' 주석 참고).
   ⚠️ 두 벌이 있는 이유: 여기는 렌더러라 main.js 를 require 할 수 없고, 새 IPC 채널을 파면
     preload 를 고쳐야 한다(sim-ghost-cache-sync.js 의 preload 무수정 규칙).
     ⇒ **한쪽만 고치면 안 된다.** 규칙을 바꿀 땐 반드시 두 파일을 같이 고칠 것.
       sim-sysinput.js 6절이 두 벌이 같은 모양인지 지킨다.
   ★ 승격이 'win:' 고정인 이유도 main.js 와 같다 — key 없는 저장물은 Windows 것뿐이다. */
function _chalKeysOf(rec){
  if(!rec) return [];
  if(Array.isArray(rec.keys)) return rec.keys.filter(Boolean);
  if(rec.key)  return [rec.key];
  if(rec.exe)  return ['win:' + String(rec.exe).toLowerCase()];
  if(rec.name) return ['win:' + String(rec.name).toLowerCase()];
  return [];
}
/* 이 기기의 플랫폼 접두사. main 이 보내주는 활성 상태에서 배운다 — 렌더러가 스스로 OS 를
   판단하지 않는다(그러면 두 곳이 서로 다른 답을 낼 수 있다). 아직 못 받았으면 null. */
let _chalKeyPlatform = null;
/* 달성 조건이 **다른 플랫폼에서 등록된 것**인가. 조용히 안 세는 대신 화면에 말해 주기 위한 표식.
   ⚠️ 이 값이 true 인데 아무 말도 안 하면, 이 작업 전과 증상이 똑같아진다(0초씩 쌓이다 만다). */
let _chalKeyForeign = false;

/* 🎯집중 — _applyActiveAppState(500ms 폴링)에서 dt 를 그대로 받아 쌓는다. */
function _chalFocusTick(state, dt){
  if(!_chalActive() || chalRec.kind !== 'focus' || chalRec.paused) return;
  const c = chalRec.cfg || {};
  const want = _chalKeysOf(c);
  if(!want.length) return;
  /* 조건이 이 기기에서 만들어진 것이 아니면 셀 수 없다 — 그걸 여기서 표식으로 남긴다.
     (예: Windows 에서 'win:chrome.exe' 로 걸어둔 조건을 mac 에서 열었을 때) */
  if(_chalKeyPlatform){
    _chalKeyForeign = !want.some(k => String(k).split(':')[0] === _chalKeyPlatform);
    if(_chalKeyForeign) return;
  }
  const now = state && state.key
    ? state.key
    : (state && state.exeName ? 'win:' + String(state.exeName).toLowerCase() : '');  // 구버전 main 대비
  /* 🕰️ [2026-09-30] `keyAlt` = 활성 창의 **옛 규칙 키**(main.js legacyKeyOf). mac 0.9.7~0.10.0 은 키를
       `mac:google chrome.app` 모양으로 서버(cfg.key)에 저장했다. 규칙을 번들 id 로 바로잡으면서 그 조건이
       조용히 0초로 멎지 않게, 둘 중 하나가 맞으면 센다. 저장된 cfg 는 안 건드린다(저장은 하나).
     ⚠️ 옛 main 은 keyAlt 를 안 보낸다 — 없으면 예전과 똑같이 now 하나로만 본다. */
  const alt = state && state.keyAlt ? String(state.keyAlt) : '';
  if(!now || !(want.includes(now) || (alt && want.includes(alt)))) return;
  const t = chalRec.today;
  if(!t || t.date !== _focusDayStr()) return;   // 오전 6시를 넘겼다 — _chalTick 이 정리할 때까지 안 쌓는다
  t.sec = (t.sec || 0) + dt;
  _chalDirty = true;
}

/* 🔁반복 — 알림 시각 계산과 '오늘은 못 채운다' 확정. */
function _chalRepeatTick(){
  if(chalRec.kind !== 'repeat') return;
  const t = chalRec.today, c = chalRec.cfg || {};
  if(!t || t.fail) return;
  if((t.done | 0) >= (c.times | 0)) return;
  const runNow = (typeof appMode !== 'undefined' && appMode() === 'run');
  /* 실행 화면에 **들어간 시점**부터 간격을 다시 잰다 — 부팅 시점이 아니다.
     꺼져 있는 동안 지나간 알림은 버린다(밀린 알림이 한꺼번에 쏟아지지 않게). */
  /* ⚠️ `모드가 run 으로 바뀌는 순간`만 보면 안 된다 — 이미 실행 화면인 채로 달성표를 열어
     🔁반복을 시작하면 전환이 한 번도 안 일어나서 anchor 가 0 으로 남고, **알림이 영영 안 뜬다.**
     (실기기에서 가장 흔한 시작 경로가 정확히 이것이다) 그래서 anchor 가 비어 있어도 잡는다. */
  if(runNow && (_chalPrevMode !== 'run' || !t.anchor)){ t.anchor = Date.now(); _chalDirty = true; }
  _chalPrevMode = runNow ? 'run' : 'other';
  if(!runNow || !t.anchor) return;

  const gapMs = Math.max(1, c.gap | 0) * 3600000;
  const need  = (c.times | 0) - (t.done | 0);
  const nextDue = t.anchor + gapMs;
  /* ⚠️ 남은 시간으로 목표 횟수를 채울 수 없는 게 확정되면 그 자리에서 알린다.
     안 그러면 성실히 두 번 누르고 자정에 실패를 통보받는다. */
  if(nextDue + (need - 1) * gapMs > _chalMidnightMs()){
    t.fail = true; _chalSave(true);
    const days = chalRec.days || [], idx = _chalDayIdx(undefined, chalRec.phase);
    if(idx >= 0 && days[idx] === CHAL_D_NOW) days[idx] = CHAL_D_FAIL;
    try{ toast('오늘은 시간이 모자라요 — 내일 다시'); }catch(_){}
    try{ syncChalToServer('repeat-fail'); }catch(_){}
    return;
  }
  if(Date.now() >= nextDue && !_chalPopOpen && _premiumOn()) _chalShowRepeatPopup();   // 게이트 ②
}

/* ── 팝업 두 개 — 기존 방 초대 팝업과 같은 배관(app-popup-ov)을 쓴다.
   ⚠️ app-popup-ov 클래스가 있어야 마우스 통과 화이트리스트(app.js 의 closest 목록)에 걸린다.
      빼면 실행 화면에서 클릭이 팝업을 뚫고 뒤로 나간다(audit 검사 2 와 같은 사고). */
function _chalPopup(titleHtml, bodyHtml, buttons){
  const ov = document.createElement('div');
  ov.className = 'app-popup-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9600;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;';
  const box = document.createElement('div');
  box.style.cssText = 'width:300px;background:var(--win-face);border:2px solid;'
    + 'border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);'
    + 'border-radius:var(--win-radius-el);box-shadow:4px 4px 0 rgba(0,0,0,.35);';
  box.innerHTML =
    '<div style="background:linear-gradient(90deg, var(--win-title-a), var(--win-title-b));color:#fff;padding:5px 8px;font-size:12px;font-weight:bold;">' + titleHtml + '</div>'
    + '<div style="padding:16px 14px;color:var(--ink);font-size:12px;line-height:1.7;">' + bodyHtml + '</div>'
    + '<div style="display:flex;gap:6px;padding:0 14px 14px;justify-content:flex-end;">'
    + buttons.map(b => '<button class="lc-btn' + (b.ghost ? ' ghost' : '') + '" data-a="' + b.a + '" style="min-width:70px;">' + b.t + '</button>').join('')
    + '</div>';
  ov.appendChild(box); document.body.appendChild(ov);
  _chalPopOpen = true;
  return new Promise(res => {
    box.querySelectorAll('[data-a]').forEach(el => {
      el.onclick = () => { try{ ov.remove(); }catch(_){} _chalPopOpen = false; res(el.getAttribute('data-a')); };
    });
  });
}
function _chalShowRepeatPopup(){
  const t = chalRec.today, c = chalRec.cfg || {};
  const body = '<b>' + escHtml(c.text || '할 일') + '</b>를 해야 해요!'
    + '<div style="font-size:10px;color:var(--ink-soft);margin-top:6px;">오늘 ' + (t.done|0) + ' / ' + (c.times|0) + '회 · 다음 알림 ' + (c.gap|0) + '시간 뒤</div>';
  _chalPopup('🔁 반복 알림', body, [{a:'ok',t:'했다'},{a:'no',t:'미룬다',ghost:true}]).then(a => {
    const tt = chalRec.today; if(!tt) return;
    if(a === 'ok') tt.done = (tt.done | 0) + 1;
    tt.anchor = Date.now();          // 눌렀든 미뤘든 여기서부터 다시 잰다
    _chalSave(true);
    try{ syncChalToServer('repeat'); }catch(_){}
    _chalTick();
  });
}
/* ⚠️ days 를 **인자로 받는다.** _chalSettle 이 _chalEndWeek() 로 chalRec.days 를 이미 비운 뒤에
   이 팝업을 부르므로, 여기서 chalRec 을 다시 읽으면 지킨 요일이 언제나 빈칸으로 나온다. */
function _chalShowSettlePopup(s, total, early, phKey, days){
  const ph = _chalPh(phKey);
  const names = (days || []).map((v,i) => v === CHAL_D_OK ? ph.label[i] : null).filter(Boolean).join('·');
  const sub = (txt) => '<div style="font-size:10px;color:var(--ink-soft);margin-top:6px;">' + txt + '</div>';
  const rest = Math.max(0, (total | 0) - (early | 0));
  let line;
  if((total | 0) <= 0)  line = '이번 ' + ph.name + '은 보상을 못 받았어요.' + sub(ph.need1 + '일 이상 달성하면 뽑기 1회예요');
  else if(rest > 0)     line = '<b>가챠 뽑기 ' + rest + '회</b>를 받았어요.'
                             + sub(early ? ('먼저 받은 1회까지 이번 ' + ph.name + ' 합계 ' + total + '회예요') : '파츠 보관함(T)에서 뽑을 수 있어요');
  else                  line = '보상 <b>' + total + '회</b>는 이미 받았어요.' + sub('파츠 보관함(T)에서 뽑을 수 있어요');
  const body = (names ? (names + ' ') : '') + '<b>' + s + '일</b>을 지켰어요.<br>' + line;
  _chalPopup('🏅 이번 ' + ph.name + ' 달성표', body, [{a:'ok',t:'확인'}]);
}

/* ── 서버 동기화 — 가챠와 같은 정책(ts 최신 승, 통째로 덮어쓰기) ─────────────── */
async function syncChalToServer(reason, mode){
  if(_chalSyncing) return;
  if(!(window.firebaseAPI && firebaseAPI.loadChal && firebaseAPI.saveChal)) return;
  const uid = (typeof getMyUserId === 'function') ? getMyUserId() : null;
  if(!uid) return;
  _chalSyncing = true;
  try{
    const srv = await firebaseAPI.loadChal(uid);
    if(srv === null) return;                 // ⚠️ 읽기 실패 — 아무것도 안 한다. 빈 값으로 덮으면 그 주가 날아간다.
    const sTs = Number(srv && srv.ts) || 0;      // ⚠️ |0 금지 — ms 시각이 음수로 잘린다(가챠 쪽 주석 참고)
    const sHas = !!(srv && srv.ts);
    const _adopt = ()=>{
      chalRec = Object.assign(_chalBlank(), srv);
      _chalSave(sTs || Date.now());          // ★ 받아온 시각을 그대로 물려받는다(핑퐁 방지)
      _chalRender();
    };
    const _push = async ()=>{
      if(!chalRec.ts) _chalSave(true);
      await firebaseAPI.saveChal(uid, chalRec);
    };
    if(mode === 'pull'){ if(sHas) _adopt(); else await _push(); return; }
    const myTs = Number(chalRec.ts) || 0;
    if(sTs > myTs)              _adopt();
    else if(myTs > sTs)         await _push();
    else if(!sHas && myTs)      await _push();
    /* 보상 합계는 chal 과 다른 노드에 있으므로 읽기가 한 번 더 든다.
       판정이 바뀔 때마다 읽을 이유는 없다 — 값이 변하는 건 정산 때뿐이다. */
    if(reason === 'boot' || reason === 'launcher' || reason === 'settle'){
      try{
        if(firebaseAPI.loadChalBonus){
          const b = await firebaseAPI.loadChalBonus(uid);
          if(b !== null) _setGachaBonusLocal(b);      // null = 읽기 실패 — 로컬 값을 지킨다
        }
      }catch(_){}
    }
  }catch(e){ console.warn('[달성표] 동기화 실패', e); }
  finally{ _chalSyncing = false; }
}
setTimeout(()=>{ try{ syncChalToServer('boot').then(()=>_chalTick()); }catch(_){} }, 4400);
setInterval(()=>{ try{ _chalTick(); }catch(_){} }, CHAL_TICK_MS);
window.addEventListener('beforeunload', ()=>{ try{ if(_chalDirty) _chalSave(); }catch(_){} });

/* ═══ 👑 달성표 — 화면 ═══════════════════════════════════════════════════════
   서랍 하나에 화면 셋이 갈아 끼워진다: 종류 고르기(#chalPick) → 설정(#chalSetup) → 진행 중(#chalRun).
   ⚠️ 설정 화면은 _chalRender() 가 다시 그리지 않는다 — 20초 tick 이 입력 중인 칸을 덮어쓰면
     글자를 치는 도중에 내용이 사라진다. 설정은 열 때와 값이 바뀔 때만 그린다. */
let _chalDraft = null;      // {kind, phase, cfg, auto, editing} — 설정 화면이 떠 있는 동안만 존재
let _chalRuleDay = 0;       // 📋규칙 설정에서 지금 보고 있는 칸(주중 0=월 · 주말 0=토)
/* ⚙ 설정(F1) → 포커싱 어플 슬롯 목록의 사본. 🎯집중은 **여기 등록된 것 중에서만** 고를 수 있다.
   ★ 왜 사본을 두는가 — 종류 고르기 화면에서 "🎯집중은 지금 고를 수 없다"를 미리 보여주려면
     그릴 때마다 값이 필요한데, _chalRenderPick 은 20초 tick 마다 불린다. 매번 IPC 를 때릴 이유가 없다.
   ⚠️ null 은 "아직 안 물어봤다"이고 [] 는 "물어봤는데 없다"이다. 둘을 합치면, 앱을 켜자마자
     열었을 때 등록해 둔 사람에게도 "등록해 주세요"가 잠깐 뜬다. */
let _chalFocusApps = null;
async function _chalRefreshFocusApps(){
  try{
    if(window.companion && companion.getFocusApps){
      const list = (await companion.getFocusApps()) || [];
      _chalFocusApps = list.filter(Boolean);
    }else _chalFocusApps = [];
  }catch(_){ _chalFocusApps = []; }
  try{ if(!_chalDraft && !_chalActive()) _chalRenderPick(); }catch(_){}
  return _chalFocusApps;
}
const _chalEl = id => document.getElementById(id);

function _chalOpen(on){
  const win = _chalEl('focusLogWin'); if(!win) return;
  win.classList.toggle('chal-on', !!on);
  if(on) win.classList.remove('pomo-on');   // 🍅 뽀모 서랍과 같은 자리 — 하나만 연다
  /* 열 때마다 다시 읽는다 — 사람들은 "달성표 → 아, 등록부터 해야겠네 → F1 → 다시 달성표" 순서로 온다.
     캐시만 믿으면 방금 등록하고 왔는데도 여전히 못 고른다고 나온다. */
  /* 열 때는 언제나 **지금 트랙**을 보여준다 — 지난번에 기록을 보다 닫았다고 해서
     다음에 열 때까지 박제 화면이 남아 있으면 "오늘 것이 안 뜬다"로 읽힌다. */
  if(on){ _chalView = null; _chalRefreshFocusApps(); _chalTick(); }
  try{ if(typeof window._focusLogClamp === 'function') window._focusLogClamp(); }catch(_){}
}
function _chalIsOpen(){ const w = _chalEl('focusLogWin'); return !!(w && w.classList.contains('chal-on')); }

/* 보상 문구 — 위에서부터 처음 걸리는 가지 하나만 쓴다. s = 달성 일수 · r = 아직 안 끝난 날 수.
   ★ 선지급(주중 3일 · 주말 1일)이 이미 나갔는지에 따라 같은 s 라도 말이 달라진다:
     "확정"은 아직 손에 없는 것이고 "받았어요"는 보관함에 이미 들어간 것이다. 둘을 섞으면 안 된다. */
function _chalRewardLine(s, r, phKey){
  const ph = _chalPh(phKey);
  const got = (s >= ph.early);                 // 선지급 1회가 이미 나갔다
  const n1 = ph.need1, n2 = ph.need2, due = ph.dueLabel;
  const sub = (txt) => ' <span class="chal-sub">' + txt + '</span>';
  if(s >= n2) return { t:'<b>뽑기 2회</b> 확정!' + (got ? sub('1회는 받았고, 남은 1회는 ' + due + '에') : ''), dim:false };
  if(s + r >= n2) return { t:'앞으로 <b>' + (n2 - s) + '번만 더</b> 달성하면 최대 <b>뽑기 2회</b>를 얻을 수 있어요!'
      + (got ? sub('1회는 이미 받았어요') : ''), dim:false };
  if(got) return { t:'<b>뽑기 1회를 받았어요</b>' + sub('이번 ' + ph.name + ' 2회는 어려워요'), dim:false };
  if(s >= n1) return { t:'<b>뽑기 1회</b> 확정 · ' + due + '에 드려요'
      + (s + r >= ph.early ? sub((ph.early - s) + '번만 더 하면 기다리지 않고 바로 받아요') : ''), dim:false };
  if(s + r >= n1) return { t:'앞으로 <b>' + (n1 - s) + '번만 더</b> 달성하면 <b>뽑기 1회</b>를 얻을 수 있어요!', dim:false };
  return { t:'이번 ' + ph.name + ' 보상은 어려워요', dim:true };
}
/* 트랙 중간 시작 안내 — 시작 요일에 따라 남는 날과 최대 보상이 달라진다.
   ⚠️ 주중 수요일 시작은 3일이라 **다 달성해도 4일에 못 미쳐 1회가 최대**다. 다만 그 1회는
     3일째를 채우는 순간 선지급되므로, 기다리지 않고 금요일에 손에 들어온다.
   ⚠️ 배열 길이는 그 페이즈의 칸 수와 같아야 한다(주중 5 · 주말 2). */
const CHAL_START_MSG = {
  wd: [
    '두 번까지 실패해도 <b>뽑기 2회</b>를 받을 수 있어요.',
    '한 번만 실패해도 보상은 <b>뽑기 1회</b>예요. 세 번 달성하면 그 자리에서 바로 받아요.',
    '<b>다 달성해도 보상은 뽑기 1회</b>예요. 대신 셋째 날을 채우는 순간 바로 받아요.',
    '<b>이틀 다 달성해야 겨우 뽑기 1회</b>예요. 그 1회는 토요일 아침에 드려요.',
    '<b>이번 주중은 보상을 받을 수 없어요.</b> 내일부터 주말 달성표를 시작할 수 있어요.',
  ],
  we: [
    '하루만 달성해도 <b>뽑기 1회</b>를 그 자리에서 받아요. 이틀 다 하면 <b>2회</b>예요.',
    '오늘 하루만 세요. 달성하면 <b>뽑기 1회</b>를 그 자리에서 받아요.',
  ],
};

function _chalRender(){
  const drawer = _chalEl('chalDrawer'); if(!drawer) return;
  const pick = _chalEl('chalPick'), setup = _chalEl('chalSetup'), run = _chalEl('chalRun'), arc = _chalEl('chalArc');
  if(!pick || !setup || !run) return;
  const inSetup = !!_chalDraft;
  /* 세그먼트로 다른 페이즈를 보고 있으면 그건 **박제된 기록**이다 — 진행 중 화면이 아니다.
     ⚠️ 설정 화면에서는 세그먼트를 통째로 숨긴다. 도중에 넘기면 입력하던 draft 가 그대로 날아간다. */
  const viewing = (!inSetup && _chalView && _chalView !== _chalLivePhase()) ? _chalView : null;
  const inRun = !inSetup && !viewing && _chalActive();
  pick.style.display  = (!inSetup && !viewing && !inRun) ? 'block' : 'none';
  setup.style.display = inSetup ? 'block' : 'none';
  run.style.display   = inRun ? 'block' : 'none';
  if(arc) arc.style.display = viewing ? 'block' : 'none';
  _chalRenderSeg(inSetup, viewing);
  if(inSetup) return;                 // 설정 화면은 여기서 다시 그리지 않는다(위 주석)
  if(viewing) _chalRenderArc(viewing);
  else if(inRun) _chalRenderRun();
  else _chalRenderPick();
}

/* 페이즈 세그먼트 — 지금 트랙과 지나간 트랙을 오간다. 라벨에 '기록'이 붙은 쪽이 박제다. */
function _chalRenderSeg(hide, viewing){
  const seg = _chalEl('chalPhaseSeg'); if(!seg) return;
  seg.style.display = hide ? 'none' : 'flex';
  if(hide) return;
  const live = _chalLivePhase(), cur = viewing || live;
  const bWd = _chalEl('chalPhWd'), bWe = _chalEl('chalPhWe');
  if(bWd){ bWd.classList.toggle('on', cur === 'wd'); bWd.textContent = '주중 · 월~금' + (live === 'wd' ? '' : ' 기록'); }
  if(bWe){ bWe.classList.toggle('on', cur === 'we'); bWe.textContent = '주말 · 토·일' + (live === 'we' ? '' : ' 기록'); }
}

/* 지나간 트랙 — 표와 결과만 보여주는 **읽기 전용** 화면이다. [수정]·[포기하기]가 없다.
   ⚠️ 정산 팝업은 한 번 닫으면 끝이라, 이 화면이 없으면 "이번 주에 뭘 며칠 지켰더라"를
     확인할 방법이 앱 어디에도 없다. */
function _chalRenderArc(phKey){
  const ph = _chalPh(phKey), a = chalRec[phKey === 'we' ? 'arcWe' : 'arcWd'];
  const head = _chalEl('chalArcHead'), wk = _chalEl('chalArcWeek'), sum = _chalEl('chalArcSum');
  if(!a){
    if(head) head.textContent = '지난 ' + ph.name + ' 기록';
    if(wk) wk.innerHTML = '';
    if(sum) sum.innerHTML = '아직 ' + ph.name + ' 달성표 기록이 없어요.';
    return;
  }
  const days = a.days || [];
  if(head) head.textContent = (a.range || a.week || '') + ' · ' + ph.name;
  if(wk){
    wk.innerHTML = days.map((v, i) => {
      const cls = v === CHAL_D_OK ? ' ok' : (v === CHAL_D_FAIL ? ' no' : '');
      const mark = v === CHAL_D_OK ? '✓' : (v === CHAL_D_FAIL ? '✗' : '·');
      return '<div class="chal-day"><div class="dn">' + ph.label[i]
        + '</div><div class="chal-cell' + cls + '">' + mark + '</div></div>';
    }).join('');
  }
  if(sum) sum.innerHTML = '<b>' + (a.s | 0) + '일</b> 달성 · ' + _chalCfgLabel(a.kind, a.cfg)
    + '<br>보상 <b>가챠 뽑기 ' + (a.tickets | 0) + '회</b>';
}

function _chalRenderPick(){
  const phKey = _chalPhaseOf(), ph = _chalPh(phKey), we = (phKey === 'we');
  const idx = _chalDayIdx(undefined, phKey);
  const autoBtn = _chalEl('chalAutoBtn'), autoLine = _chalEl('chalAutoLine'), warn = _chalEl('chalStartWarn');
  const lbl = _chalEl('chalPickLabel'), hint = _chalEl('chalPickHint');
  const last = we ? chalRec.lastWe : chalRec.last, auto = we ? chalRec.autoWe : chalRec.auto;
  if(lbl) lbl.textContent = '무엇을 ' + ph.n + '일 동안 이어갈까요';
  if(hint) hint.textContent = '이번 ' + ph.name + '에 하나만 골라요. 고른 종류는 '
    + ph.label[ph.n - 1] + '요일까지 이어지고, 바꾸려면 포기하고 다시 시작해야 해요.';
  if(autoBtn){
    const can = !!last;
    autoBtn.disabled = !can;
    autoBtn.classList.toggle('off', !(can && auto));
    autoBtn.textContent = (can && auto) ? '자동 ✓' : '자동';
    /* ⚠️ 주중/주말 스위치가 따로라 title 도 따라 바뀌어야 한다 — 안 그러면 주말 화면에서
       "매주 월요일에" 라고 적힌 버튼이 주말 자동을 켠다. */
    autoBtn.title = '지난 ' + ph.name + ' 조건으로 매주 ' + ph.label[0] + '요일에 자동 시작';
  }
  if(autoLine){
    if(auto && last){
      autoLine.style.display = 'block';
      autoLine.innerHTML = '매주 ' + ph.label[0] + '요일에 <b>' + _chalCfgLabel(last.kind, last.cfg)
        + '</b>으로 알아서 시작해요. 끄려면 [자동]을 누르세요.';
    }else autoLine.style.display = 'none';
  }
  /* 🎯집중은 포커싱 어플이 하나도 없으면 고를 수 없다 — 잴 대상이 없기 때문이다.
     ⚠️ 카드를 감추지 않는다. 없어진 줄 알고 찾다가 포기한다. 흐리게 두고 이유를 붙인다. */
  const kf = _chalEl('chalKindFocus'), kfw = _chalEl('chalKindFocusWhy');
  const noApps = (_chalFocusApps !== null && _chalFocusApps.length === 0);
  if(kf) kf.classList.toggle('off', noApps);
  if(kfw) kfw.style.display = noApps ? 'block' : 'none';
  if(warn){
    const msgs = CHAL_START_MSG[phKey] || [];
    if(idx > 0){
      warn.style.display = 'block';
      warn.innerHTML = '오늘은 ' + ph.label[idx] + '요일이라 이번 ' + ph.name + '은 <b>' + (ph.n - idx) + '일('
        + ph.label.slice(idx).join('·') + ')</b>만 세요. ' + (msgs[idx] || '');
    }else if(idx === 0 && we){
      warn.style.display = 'block';           // 주말은 첫날부터 규칙이 다르니 늘 한 줄 붙인다
      warn.innerHTML = msgs[0] || '';
    }else warn.style.display = 'none';
  }
}
function _chalCfgLabel(kind, cfg){
  const c = cfg || {};
  if(kind === 'focus')  return '🎯 ' + escHtml(String(c.exe || c.label || '앱').replace(/\.exe$/i, '')) + ' ' + (c.hours|0) + '시간';
  if(kind === 'repeat') return '🔁 ' + escHtml(c.text || '할 일') + ' 하루 ' + (c.times|0) + '회';
  if(kind === 'rule')   return '📋 요일별 체크표';
  return '';
}

function _chalRenderRun(){
  const phKey = chalRec.phase, ph = _chalCurPh();
  const idx = _chalDayIdx(undefined, phKey), days = chalRec.days || [], t = chalRec.today || {}, c = chalRec.cfg || {};
  const s = _chalDoneCount(), r = _chalLeftCount();
  const auto = (phKey === 'we') ? chalRec.autoWe : chalRec.auto;
  const range = _chalEl('chalRunRange'), cnt = _chalEl('chalRunCount');
  if(range) range.innerHTML = '이번 ' + ph.name + ' · ' + _chalRangeLabel(phKey) + (auto ? '<span class="chal-badge">자동</span>' : '');
  if(cnt) cnt.textContent = s + '일 달성';

  const wk = _chalEl('chalWeek');
  if(wk){
    /* 🎰 선지급 표식은 요일이 아니라 **몇 번째 ✓ 인가**에 붙는다 — 월요일을 놓치고 화·수·목을
       채운 사람에게 수요일 칸(요일로 세면 셋째)에 붙이면 그 칸은 아직 두 번째다. 세면서 붙인다. */
    const payAt = _chalEarlyDone() ? ph.early : 0;
    let okSeen = 0;
    wk.innerHTML = days.map((v, i) => {
      const cls = v === CHAL_D_OK ? ' ok' : v === CHAL_D_FAIL ? ' no' : (v === CHAL_D_NOW ? ' now' : '');
      const mark = v === CHAL_D_OK ? '✓' : v === CHAL_D_FAIL ? '✗' : (v === CHAL_D_NOW ? '●' : '·');
      if(v === CHAL_D_OK) okSeen++;
      const pay = (payAt && v === CHAL_D_OK && okSeen === payAt) ? '<i class="chal-pay">1</i>' : '';
      return '<div class="chal-day' + (i === idx ? ' now' : '') + '"><div class="dn">' + ph.label[i]
        + '</div><div class="chal-cell' + cls + '">' + mark + pay + '</div></div>';
    }).join('');
  }

  const box = _chalEl('chalToday');
  if(box){
    if(chalRec.kind === 'focus'){
      const goal = Math.max(1, (c.hours|0)) * 3600, cur = Math.min(goal, t.sec || 0);
      box.innerHTML = '<div class="t1">🎯 ' + escHtml(c.label || c.exe || '앱') + ' · 하루 ' + (c.hours|0) + '시간</div>'
        + '<div class="t2">오늘 ' + formatHMS(t.sec || 0) + ' / ' + formatHMS(goal) + '</div>'
        + '<div class="chal-bar"><i style="width:' + Math.round(cur / goal * 100) + '%"></i></div>';
    }else if(chalRec.kind === 'repeat'){
      const n = c.times | 0, d = Math.min(n, t.done | 0);
      const left = t.fail ? '오늘은 시간이 모자라요 — 내일 다시'
        : (d >= n ? '오늘 다 했어요!' : '다음 알림 ' + (c.gap|0) + '시간 간격');
      box.innerHTML = '<div class="t1">🔁 ' + escHtml(c.text || '할 일') + '</div>'
        + '<div class="t2">오늘 ' + d + ' / ' + n + '회 · ' + left + '</div>'
        + '<div class="chal-dots">' + '✓'.repeat(d) + '○'.repeat(Math.max(0, n - d)) + '</div>';
    }else{
      const items = idx < 0 ? [] : _chalRuleItems(c, idx);
      const ck = t.checks || {};
      box.innerHTML = '<div class="t1">📋 오늘 ' + items.filter((_, i) => ck[i]).length + ' / ' + items.length + '</div>'
        + '<div class="chal-todolist" id="chalTodayChecks">'
        + items.map((x, i) => '<div data-i="' + i + '"' + (ck[i] ? ' class="done"' : '') + '>' + (ck[i] ? '☑' : '☐') + ' ' + escHtml(x) + '</div>').join('')
        + '</div>';
    }
  }
  const pend = _chalEl('chalPendNote');
  if(pend) pend.style.display = chalRec.pendingCfg ? 'block' : 'none';
  const rw = _chalEl('chalReward');
  if(rw){ const line = _chalRewardLine(s, r, phKey); rw.innerHTML = line.t; rw.classList.toggle('dim', line.dim); }
}

/* ── 설정 화면 ────────────────────────────────────────────────────────────── */
function _chalDefaultCfg(kind, phKey){
  if(kind === 'focus')  return { exe:'', label:'', hours:4 };
  if(kind === 'repeat') return { text:'', times:3, gap:2 };
  /* 📋규칙은 **그 페이즈의 칸 수만큼** 줄을 만든다 — 주말에 5칸을 만들면 화면에 없는 요일이 셋
     생기고, [시작] 검사가 그 빈 요일에 걸려 영영 시작이 안 된다(원인이 화면에 안 보인다). */
  const n = _chalPh(phKey).n, rules = [];
  for(let i = 0; i < n; i++) rules.push([]);
  return { rules:rules };
}
function _chalOpenSetup(kind, editing){
  const phKey = editing ? chalRec.phase : _chalPhaseOf();
  const base = editing ? (chalRec.pendingCfg || chalRec.cfg) : null;
  const auto = (phKey === 'we') ? chalRec.autoWe : chalRec.auto;
  _chalDraft = {
    kind: kind,
    phase: phKey,
    cfg: JSON.parse(JSON.stringify(base || _chalDefaultCfg(kind, phKey))),
    auto: !!auto,
    editing: !!editing,
  };
  /* 옛 저장(주말 개념이 없던 시절)이나 [자동]으로 되살린 조건은 rules 길이가 안 맞을 수 있다.
     ⚠️ 여기서 칸 수에 맞춰 두지 않으면 주말 화면이 rules[2..4] 를 못 그리고, 반대로 주중에서는
       없는 요일을 비어 있다고 판정해 [시작]이 막힌다. */
  if(kind === 'rule'){
    const n = _chalPh(phKey).n, rs = _chalDraft.cfg.rules || [];
    _chalDraft.cfg.rules = [];
    for(let i = 0; i < n; i++) _chalDraft.cfg.rules.push(Array.isArray(rs[i]) ? rs[i] : []);
  }
  _chalRuleDay = Math.max(0, _chalDayIdx(undefined, phKey));
  _chalRenderSetup();
  _chalRender();
}
/* force=true 면 **입력 중인 칸까지** 값을 다시 써 넣는다.
   ⚠️ 평소(force 없음)에는 포커스가 있는 칸을 건드리지 않는다 — 타이핑하는 도중에 덮어쓰면
     글자가 사라지거나 커서가 맨 뒤로 튄다. ▲▼ 를 눌렀을 때와 blur 때만 force 로 부른다. */
function _chalRenderSetup(force){
  if(!_chalDraft) return;
  const k = _chalDraft.kind, c = _chalDraft.cfg;
  const show = (id, on) => { const e = _chalEl(id); if(e) e.style.display = on ? 'block' : 'none'; };
  show('chalSetFocus',  k === 'focus');
  show('chalSetRepeat', k === 'repeat');
  show('chalSetRule',   k === 'rule');
  const startBtn = _chalEl('chalStartBtn');
  if(startBtn) startBtn.textContent = _chalDraft.editing ? '저장' : '시작';
  const chk = _chalEl('chalAutoChk');
  if(chk){ const i = chk.querySelector('i'); if(i) i.textContent = _chalDraft.auto ? '✓' : ''; }

  if(k === 'focus'){
    const app = _chalEl('chalFocusApp'), hrs = _chalEl('chalFocusHours'), hint = _chalEl('chalFocusHint');
    /* 판정 키에서 보이는 이름을 뽑는다 — 'win:chrome.exe' → 'chrome'.
       옛 판본에서 창 제목이 label 로 저장된 사람도 여기서 같은 이름으로 보인다.
       (서버에 저장된 cfg 는 안 건드린다. 판정은 key 로만 하므로 표시만 맞추면 된다) */
    const k0 = (_chalKeysOf(c)[0] || '');
    /* 🍎 [2026-09-30] mac 키는 이제 번들 id(`mac:com.google.chrome`)라 키에서 뽑으면 사람이 못 읽는다.
         mac 은 고를 때 함께 저장한 표시 이름(cfg.label = 'Google Chrome')을 먼저 쓴다.
         옛 키(`google chrome.app`)는 label 이 없을 때만 키에서 뽑고 `.app` 을 뗀다. win 은 그대로다. */
    const shown = k0
      ? ((/^mac:/.test(k0) && c.label) ? String(c.label) : k0.replace(/^[a-z]+:/, '').replace(/\.(exe|app)$/i, ''))
      : (c.label || '');
    if(app) app.textContent = shown || '아직 안 골랐어요';
    _chalPutNum(hrs, c.hours, force);
    /* ★ 다른 플랫폼에서 등록한 조건이면 **말해 준다.** 여기서 침묵하면 시간이 0초씩 쌓이다 마는데
         에러도 안 나서, 사용자는 달성표가 고장 난 줄로만 안다(이 작업이 없애려던 증상 그대로). */
    const foreign = !!(k0 && _chalKeyPlatform && k0.split(':')[0] !== _chalKeyPlatform);
    if(hint) hint.textContent = foreign
      ? '이 조건은 다른 기기(' + k0.split(':')[0] + ')에서 등록한 거예요. 여기서는 셀 수 없으니 앱을 다시 골라 주세요.'
      : '다음 날 오전 6시가 되기 전까지 ' + (c.hours|0) + '시간을 채워 달성하세요!';
  }else if(k === 'repeat'){
    const tx = _chalEl('chalRepeatText'), tm = _chalEl('chalRepeatTimes'), gp = _chalEl('chalRepeatGap'), hint = _chalEl('chalRepeatHint');
    if(tx && document.activeElement !== tx) tx.value = c.text || '';
    _chalPutNum(tm, c.times, force);
    _chalPutNum(gp, c.gap, force);
    if(hint) hint.textContent = '실행 화면에 들어간 때부터 ' + (c.gap|0) + '시간마다 물어봐요. [했다]를 ' + (c.times|0) + '번 눌러야 그날 달성이에요.';
  }else{
    /* 요일 탭을 **여기서 만든다** — HTML 에 월~금 다섯 개를 박아두면 주말 설정에서
       수·목·금 탭이 남아 없는 칸을 편집하게 된다. 클릭은 컨테이너에 위임돼 있다. */
    const days = _chalEl('chalRuleDays');
    const lab = _chalPh(_chalDraft.phase).label;
    if(days) days.innerHTML = lab.map((d, i) => '<button class="chal-wday' + (i === _chalRuleDay ? ' on' : '')
      + '" type="button" data-d="' + i + '">' + d + '</button>').join('');
    _chalRenderRuleList();
  }
}
/* ── 숫자 칸(시간·회·간격) — ▲▼ 와 직접 입력 둘 다 ──────────────────────────
   ⚠️ **타이핑 도중에는 범위로 자르지 않는다.** 1~12 인 칸에서 '12'를 치려면 먼저 '1'을 쳐야 하는데
     그 순간 잘라 버리면 두 번째 글자를 칠 수 없다. 그래서 입력 중에는 숫자만 걸러 두고,
     포커스가 빠질 때(blur)·Enter·[시작] 에서 범위로 맞춘다.
   ⚠️ 다 지운 빈 칸도 허용한다 — 지우고 새로 치는 게 정상 조작이다. 비운 채로 나가면
     blur 에서 **원래 값으로 되돌린다**(0 으로 떨어뜨리지 않는다). */
function _chalPutNum(el, v, force){
  if(!el) return;
  if(!force && document.activeElement === el) return;   // 입력 중인 칸은 안 건드린다
  el.value = String(v | 0);
}
function _chalClampNum(raw, lo, hi, fallback){
  const n = parseInt(String(raw == null ? '' : raw).replace(/[^0-9]/g, ''), 10);
  if(!isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}
function _chalBindNum(id, get, set, lo, hi){
  const el = _chalEl(id); if(!el) return;
  el.addEventListener('input', ()=>{
    if(!_chalDraft) return;
    const raw = el.value.replace(/[^0-9]/g, '').slice(0, 2);   // 붙여넣기로 들어온 글자도 걸러낸다
    if(raw !== el.value) el.value = raw;
    if(raw === '') return;                                     // 다 지운 상태는 그대로 둔다
    const n = parseInt(raw, 10);
    if(n >= lo && n <= hi){ set(n); _chalRenderSetup(); }       // 범위 안일 때만 안내 문구를 따라 갱신
  });
  el.addEventListener('blur', ()=>{
    if(!_chalDraft) return;
    set(_chalClampNum(el.value, lo, hi, get() || lo));
    _chalRenderSetup(true);
  });
  el.addEventListener('keydown', e=>{
    if(!_chalDraft) return;
    if(e.key === 'Enter'){ e.preventDefault(); el.blur(); return; }
    // ▲▼ 버튼과 같은 조작을 키보드로도 — 숫자 칸에서 방향키는 이게 자연스럽다
    if(e.key === 'ArrowUp' || e.key === 'ArrowDown'){
      e.preventDefault();
      set(Math.max(lo, Math.min(hi, (get() | 0) + (e.key === 'ArrowUp' ? 1 : -1))));
      _chalRenderSetup(true);
    }
  });
}
function _chalRenderRuleList(){
  const box = _chalEl('chalRuleList'); if(!box || !_chalDraft) return;
  const rows = (_chalDraft.cfg.rules[_chalRuleDay] || []);
  /* 📋규칙은 **오늘 요일 탭만** 잠근다 — 오늘 판정에 쓰이는 값이라서다. 나머지 요일은 자유롭게 고친다. */
  const locked = _chalDraft.editing && _chalRuleDay === _chalDayIdx(undefined, _chalDraft.phase);
  box.innerHTML = rows.map((x, i) =>
      /* `escHtml` 이 `"` 까지 막으므로 뒤에 붙어 있던 `.replace(/"/g,'&quot;')` 는 지웠다 —
         옛 헬퍼가 `"` 를 안 막는 걸 전제로 덧붙인 자리였다. 남겨도 찾을 `"` 가 없어 무해하지만,
         "여기는 따로 챙겨야 한다"는 잘못된 신호를 남긴다. */
      '<div class="li"><input type="text" maxlength="24" data-i="' + i + '" value="' + escHtml(x) + '"'
      + (locked ? ' disabled' : '') + '><span class="del" data-del="' + i + '">' + (locked ? '' : '✕') + '</span></div>').join('')
    + (locked ? '<div class="add" style="cursor:default;">오늘 것은 내일부터 바꿀 수 있어요</div>'
              : (rows.length < CHAL_RULE_MAX ? '<div class="add" data-add="1">＋</div>' : ''));
}

/* ── 바인딩 ──────────────────────────────────────────────────────────────── */
(function bindChal(){
  const btn = _chalEl('chalBtn'); if(!btn) return;
  const on = (id, fn) => { const e = _chalEl(id); if(e) e.onclick = fn; };

  btn.onclick = () => {
    /* ⚠️ 게이트 ① — isPremium 을 직접 읽으면 TDZ 로 앱이 통째로 안 켜진다. 반드시 _premiumOn(). */
    if(!_premiumOn()){ try{ toast('👑 달성표는 프리미엄 전용이에요'); }catch(_){} return; }
    if(_chalIsOpen()){ _chalOpen(false); return; }
    _chalDraft = null;
    _chalOpen(true);
  };

  on('chalKindFocus',  async ()=>{
    /* 목록을 아직 안 읽었으면 여기서 읽고 판단한다 — 캐시가 비었다고 무조건 막으면
       열자마자 누른 사람이 억울하게 걸린다. */
    const list = (_chalFocusApps === null) ? await _chalRefreshFocusApps() : _chalFocusApps;
    if(!list.length){
      try{ toast('⚙ 설정(F1)의 포커싱 어플에 프로그램을 먼저 등록해 주세요'); }catch(_){}
      _chalRenderPick();
      return;
    }
    _chalOpenSetup('focus');
  });
  on('chalKindRepeat', ()=> _chalOpenSetup('repeat'));
  on('chalKindRule',   ()=> _chalOpenSetup('rule'));
  on('chalAutoBtn', ()=>{
    /* ⚠️ 지금 화면에 보이는 페이즈의 스위치를 켠다. 하나로 묶으면 평일 조건이 주말에도
       자동으로 켜져서, 쉬려던 사람에게 실패 도장이 찍힌다. */
    const we = (_chalPhaseOf() === 'we');
    if(!(we ? chalRec.lastWe : chalRec.last)) return;
    if(we) chalRec.autoWe = !chalRec.autoWe; else chalRec.auto = !chalRec.auto;
    _chalSave(true);
    try{ syncChalToServer('auto'); }catch(_){}
    _chalRenderPick();
  });
  /* 페이즈 세그먼트 — 지금 트랙과 같은 쪽을 누르면 라이브로 돌아온다. */
  const segGo = (p) => {
    _chalView = (p === _chalLivePhase()) ? null : p;
    _chalRender();
    try{ if(typeof window._focusLogClamp === 'function') window._focusLogClamp(); }catch(_){}
  };
  on('chalPhWd', ()=> segGo('wd'));
  on('chalPhWe', ()=> segGo('we'));
  on('chalAutoChk', ()=>{ if(!_chalDraft) return; _chalDraft.auto = !_chalDraft.auto; _chalRenderSetup(); });
  on('chalBackBtn', ()=>{ _chalDraft = null; _chalRender(); _chalOpen(true); });

  // 🎯집중 — 앱 고르기. 목록은 companion 이 들고 있다(포커싱 어플 슬롯).
  on('chalFocusPick', async ()=>{
    const box = _chalEl('chalFocusList'); if(!box || !_chalDraft) return;
    if(box.style.display === 'block'){ box.style.display = 'none'; return; }
    const list = await _chalRefreshFocusApps();
    box.style.display = 'block';
    box.innerHTML = list.length
      ? list.map(a => {
          /* ★ **F1 설정과 같은 문법**으로 보여준다 — 굵은 글씨는 `.exe` 를 뗀 실행파일 이름,
               그 아래 작은 글씨가 창 제목이다(설정의 슬롯 표시도, 창 목록 고르기도 그렇다).
             ⚠️ 예전엔 창 제목을 주 이름으로 썼다. 창 제목에는 열어 둔 문서 이름이 붙어 그때그때
               바뀌므로, 같은 앱이 설정에서와 다른 이름으로 보였다 —
               "이름이 이상해서 딴 프로그램인 줄 알았다"는 제보가 여기서 나왔다. */
          const label = String(a.name || '').replace(/\.exe$/i, '');
          /* 지역 헬퍼 `attr` 을 지우고 escHtml 을 직접 쓴다 — 그 헬퍼는
               `escHtml` + `"` 덧붙임이었는데 이제 escHtml 하나로 같은 일이 끝난다. */
          return '<div class="li pick" data-key="' + escHtml(String(a.key || '')) + '" data-exe="' + escHtml(a.name) + '" data-label="' + escHtml(label) + '">'
            + '<b>' + escHtml(label) + '</b>'
            + (a.title ? '<span class="sub">' + escHtml(a.title) + '</span>' : '')
            + '</div>';
        }).join('')
      : '<div class="add" style="cursor:default;">⚙ 설정(F1)의 포커싱 어플에 프로그램을 먼저 등록해 주세요</div>';
    box.querySelectorAll('[data-exe]').forEach(el => {
      el.onclick = () => {
        if(!_chalDraft) return;
        /* ⚠️ 슬롯 **번호**를 저장하면 안 된다. 다른 슬롯을 해제하면 뒤 슬롯이 앞으로 당겨져서
           (main.js companion:clearFocusApp) 감시 대상이 조용히 다른 앱으로 바뀐다. 판정 키로 잡는다. */
        const exe = String(el.getAttribute('data-exe') || '').toLowerCase();
        _chalDraft.cfg.key = String(el.getAttribute('data-key') || '') || ('win:' + exe);
        /* ★ `exe` 는 이제 **판정에 안 쓴다** — 판정은 cfg.key 하나다(_chalKeysOf).
           그런데도 계속 써 넣는 이유: chalRec 은 서버(Firebase)로 동기화돼서 **아직 옛 판본을
           쓰는 기기**가 같은 기록을 읽는다. 거기서 cfg.exe 가 비면 그 기기의 달성이
           조용히 0초로 멎는다 — 이 작업이 없애려는 바로 그 증상이다.
           ⇒ key 에서 **파생되는 값**이지 두 번째 진실이 아니다. 새 코드는 이걸 읽지 않는다.
           ⚠️ 옛 판본이 전부 사라지면 이 줄을 지울 것. 그때까지는 남는다. */
        _chalDraft.cfg.exe = exe;
        /* ⚠️ label 을 el.textContent 로 줍지 말 것 — 줄 안에 exe 이름(.sub)이 같이 들어 있어서
           "메모장Memo" 처럼 붙은 이름이 저장된다. data-label 로 따로 받는다. */
        _chalDraft.cfg.label = el.getAttribute('data-label') || _chalDraft.cfg.exe;
        box.style.display = 'none';
        _chalRenderSetup();
      };
    });
  });
  const spin = (id, get, set, lo, hi) => on(id, ()=>{ if(!_chalDraft) return; set(Math.max(lo, Math.min(hi, get() + (id.endsWith('Up') ? 1 : -1)))); _chalRenderSetup(true); });
  spin('chalFocusUp',      ()=>_chalDraft.cfg.hours|0, v=>_chalDraft.cfg.hours=v, 1, 12);
  spin('chalFocusDn',      ()=>_chalDraft.cfg.hours|0, v=>_chalDraft.cfg.hours=v, 1, 12);
  spin('chalRepeatTimesUp',()=>_chalDraft.cfg.times|0, v=>_chalDraft.cfg.times=v, 1, 10);
  spin('chalRepeatTimesDn',()=>_chalDraft.cfg.times|0, v=>_chalDraft.cfg.times=v, 1, 10);
  spin('chalRepeatGapUp',  ()=>_chalDraft.cfg.gap|0,   v=>_chalDraft.cfg.gap=v,   1, 8);
  spin('chalRepeatGapDn',  ()=>_chalDraft.cfg.gap|0,   v=>_chalDraft.cfg.gap=v,   1, 8);
  // 같은 값을 ▲▼ 와 타이핑 양쪽으로 고칠 수 있게 한다. 범위는 위 spin 과 반드시 같아야 한다.
  _chalBindNum('chalFocusHours', ()=>_chalDraft.cfg.hours|0, v=>_chalDraft.cfg.hours=v, 1, 12);
  _chalBindNum('chalRepeatTimes',()=>_chalDraft.cfg.times|0, v=>_chalDraft.cfg.times=v, 1, 10);
  _chalBindNum('chalRepeatGap',  ()=>_chalDraft.cfg.gap|0,   v=>_chalDraft.cfg.gap=v,   1, 8);
  const rt = _chalEl('chalRepeatText');
  if(rt) rt.addEventListener('input', ()=>{ if(_chalDraft) _chalDraft.cfg.text = rt.value; });

  /* ⚠️ 요일 탭은 _chalRenderSetup 이 매번 다시 만든다(페이즈마다 개수가 다르다).
     그래서 버튼마다 onclick 을 걸면 다시 그린 순간 전부 죽는다 — 컨테이너에 위임한다. */
  const rd = _chalEl('chalRuleDays');
  if(rd) rd.addEventListener('click', e => {
    if(!_chalDraft) return;
    const b = e.target.closest && e.target.closest('[data-d]'); if(!b) return;
    _chalRuleDay = +b.getAttribute('data-d');
    _chalRenderSetup();
  });
  const rl = _chalEl('chalRuleList');
  if(rl){
    rl.addEventListener('click', e=>{
      if(!_chalDraft) return;
      const rows = _chalDraft.cfg.rules[_chalRuleDay] || (_chalDraft.cfg.rules[_chalRuleDay] = []);
      const del = e.target.getAttribute && e.target.getAttribute('data-del');
      if(del != null){ rows.splice(+del, 1); _chalRenderRuleList(); return; }
      if(e.target.getAttribute && e.target.getAttribute('data-add')){ if(rows.length < CHAL_RULE_MAX){ rows.push(''); _chalRenderRuleList(); } }
    });
    rl.addEventListener('input', e=>{
      if(!_chalDraft) return;
      const i = e.target.getAttribute && e.target.getAttribute('data-i');
      if(i != null) (_chalDraft.cfg.rules[_chalRuleDay] || [])[+i] = e.target.value;
    });
  }

  on('chalStartBtn', ()=>{
    if(!_chalDraft) return;
    const k = _chalDraft.kind, c = _chalDraft.cfg;
    /* ⚠️ 마지막 안전망 — 숫자 칸을 비우거나 범위 밖으로 둔 채 바로 [시작]을 누르는 경로가 있다.
       (칸을 비우고 곧장 버튼을 누르면 blur 보정이 늦게 걸리거나 아예 안 걸리는 브라우저가 있다)
       여기서 한 번 더 맞춰 두면 hours=0 짜리 주가 서버로 올라가는 일이 없다. */
    if(k === 'focus')  c.hours = _chalClampNum(c.hours, 1, 12, 4);
    if(k === 'repeat'){ c.times = _chalClampNum(c.times, 1, 10, 3); c.gap = _chalClampNum(c.gap, 1, 8, 2); }
    if(k === 'focus' && !c.exe){ try{ toast('잴 앱을 먼저 골라 주세요'); }catch(_){} return; }
    if(k === 'repeat' && !String(c.text || '').trim()){ try{ toast('지킬 일을 적어 주세요'); }catch(_){} return; }
    if(k === 'repeat') c.text = String(c.text).trim();
    if(k === 'rule'){
      /* 세는 요일 중 비어 있는 날이 있으면 시작을 막는다 — 빈 요일은 체크할 것이 없어서
         영영 달성이 안 되고, 그날은 아무것도 안 했는데 ✗ 로 닫힌다. */
      const ph = _chalPh(_chalDraft.phase);
      const from = _chalDraft.editing ? 0 : Math.max(0, _chalDayIdx(undefined, _chalDraft.phase));
      for(let i = from; i < ph.n; i++){
        if(!_chalRuleItems(c, i).length){ try{ toast(ph.label[i] + '요일 체크표가 비어 있어요'); }catch(_){} return; }
      }
      c.rules = c.rules.map(rows => (rows || []).map(x => String(x || '').trim()).filter(Boolean).slice(0, CHAL_RULE_MAX));
    }
    if(_chalDraft.editing){
      /* [수정]은 **다음 날 것부터** 적용한다. 오늘 판정에 쓰이는 값을 그 자리에서 바꾸면
         이미 지나간 시간의 기준이 뒤바뀐다(4시간 채우던 중에 8시간으로 바꾸는 식). */
      chalRec.pendingCfg = c;
      if(chalRec.phase === 'we') chalRec.autoWe = _chalDraft.auto; else chalRec.auto = _chalDraft.auto;
      _chalSave(true);
      try{ syncChalToServer('edit'); }catch(_){}
      try{ toast('수정한 내용은 내일부터 적용돼요'); }catch(_){}
    }else{
      /* 설정 화면을 열어둔 채 날이 바뀌어 페이즈가 넘어가면 draft 의 페이즈가 오늘과 어긋난다.
         그 상태로 시작하면 칸 번호가 -1 이라 조용히 아무 일도 안 일어난다 — 이유를 알려준다. */
      if(_chalDraft.phase !== _chalPhaseOf()){
        try{ toast('날이 바뀌었어요 — 달성표를 닫았다 다시 열어 주세요'); }catch(_){}
        _chalDraft = null; _chalTick(); return;
      }
      if(_chalDayIdx(undefined, _chalDraft.phase) < 0){ try{ toast('지금은 시작할 수 없어요'); }catch(_){} return; }
      _chalStart(k, c, _chalDraft.auto, _chalDraft.phase);
    }
    _chalDraft = null;
    _chalTick();
    try{ if(typeof window._focusLogClamp === 'function') window._focusLogClamp(); }catch(_){}
  });

  on('chalEditBtn', ()=>{ if(_chalActive()) _chalOpenSetup(chalRec.kind, true); });
  on('chalGiveupBtn', ()=>{
    if(!_chalActive()) return;
    /* ⚠️ 포기는 반드시 한 번 묻는다 — 되돌릴 수 없다. */
    _chalPopup('👑 달성표 포기', '이번 ' + _chalCurPh().name + ' 달성 기록이 사라지고 남은 보상도 없어져요.'
      + '<br><span style="font-size:10px;color:var(--ink-soft);">이미 받은 뽑기는 그대로예요.</span><br>정말 포기할까요?',
      [{a:'ok',t:'포기하기'},{a:'no',t:'취소',ghost:true}]).then(a=>{
      if(a !== 'ok') return;
      _chalGiveUp(); _chalDraft = null; _chalTick();
    });
  });

  // 📋규칙 진행 화면 — 오늘 항목 체크. 판정이 바뀌는 순간이라 여기서 서버에 쓴다.
  const todayBox = _chalEl('chalToday');
  if(todayBox) todayBox.addEventListener('click', e=>{
    if(!_chalActive() || chalRec.kind !== 'rule' || chalRec.paused) return;
    const row = e.target.closest && e.target.closest('[data-i]'); if(!row) return;
    const i = +row.getAttribute('data-i');
    const t = chalRec.today; if(!t) return;
    t.checks = t.checks || {};
    t.checks[i] = !t.checks[i];
    _chalSave(true);
    try{ syncChalToServer('check'); }catch(_){}
    _chalTick();
  });
})();

return {
  syncChalToServer,                       // 런처 복귀('launcher') · 로그아웃 직전('logout')
  open: _chalOpen,                        // 🍅 뽀모 서랍을 열면 open(false) — 둘 중 하나만
  isOpen: _chalIsOpen,
  focusTick: _chalFocusTick,              // _applyActiveAppState(500ms) — 🎯집중 초
  setKeyPlatform(v){ _chalKeyPlatform = v; },   // 활성 앱 상태가 알려 주는 이 기기 플랫폼('win' · 'mac')
  resetMemory(){ chalRec = _chalBlank(); _chalDirty = false; },   // 로그아웃 지우기 — 메모리도 빈 기기 값으로
  /* 화면 없이 검사하는 셈 · 상태 — sim-weekly-challenge.js */
  calc: { phaseOf:_chalPhaseOf, weekStr:_chalWeekStr, dayIdx:_chalDayIdx, ticketsFor:_chalTicketsFor,
          earlyKey:_chalEarlyKey, ruleItems:_chalRuleItems, rewardLine:_chalRewardLine, cfgLabel:_chalCfgLabel,
          keysOf:_chalKeysOf, clampNum:_chalClampNum, todayMet:_chalTodayMet },
  tick: _chalTick,
  state: ()=>chalRec,
};
}

const api = { createWeeklyChallenge };
if(typeof window !== 'undefined') window.TwWeeklyChallenge = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

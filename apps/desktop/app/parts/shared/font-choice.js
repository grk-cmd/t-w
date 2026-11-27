/* font-choice.js — 🔤 창 글꼴 고르기 규칙 — 고른 값 → 글꼴 목록(CSS) · 저장 모양 씻기 · PC 글꼴 이름 씻기
   순수 모듈(DOM · localStorage 없음) — font-ui.js 가 읽는다. window.TwFontChoice.
   ★ 바꾸는 곳은 창 안 글씨 토큰 둘(--win-font · --tw-font-legacy)뿐 — 머리 위 말풍선 · 이름표(--tw-font-classic)는 그대로다.
   ★ 고른 값: 'base'(기본 — 바꾸지 않음) · 'dotum' · 'nanum' · 'pc:<글꼴 이름>'(👑 프리미엄 — 내 PC 글꼴).
     그 글꼴이 없는 PC 에서는 뒤에 붙은 기본 목록으로 떨어진다(맑은 고딕 · 맥 Apple SD Gothic Neo).
   검사: checks/sim-font-choice.js */
(function(){

const BASE_TAIL = "Tahoma,'Malgun Gothic','Apple SD Gothic Neo',sans-serif";
/* 고를 수 있는 셋 — [값, 이름, 앞에 붙일 글꼴(없으면 기본 그대로)] */
const OPTIONS = [
  ['base', '기본', ''],
  ['dotum', '돋움', "'Dotum','돋움'"],
  ['nanum', '나눔고딕', "'NanumGothic','Nanum Gothic','나눔고딕'"],
];
const PC_PREFIX = 'pc:';
const NAME_MAX = 60;

/* PC 글꼴 이름 — CSS 글자 안에 들어가므로 따옴표 · 역슬래시 · 줄바꿈 · ; { } < > 를 버린다(이름이 그런 글자를 쓸 일은 없다) */
function cleanFamily(name){
  return String(name == null ? '' : name).replace(/[\u0000-\u001f'"\\;{}<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}
/* 저장본 → 쓸 수 있는 값만(모르는 값 · 빈 PC 이름은 'base') */
function norm(v){
  const s = String(v == null ? '' : v);
  if(s.startsWith(PC_PREFIX)){ const f = cleanFamily(s.slice(PC_PREFIX.length)); return f ? PC_PREFIX + f : 'base'; }
  return OPTIONS.some(o => o[0] === s) ? s : 'base';
}
const isPc = (v) => norm(v).startsWith(PC_PREFIX);
const pcName = (v) => (isPc(v) ? norm(v).slice(PC_PREFIX.length) : '');
function label(v){
  const n = norm(v);
  if(isPc(n)) return pcName(n);
  return (OPTIONS.find(o => o[0] === n) || OPTIONS[0])[1];
}
/* 고른 값 → 창 글씨 토큰에 넣을 글꼴 목록. 'base' 는 null(토큰을 건드리지 않는다) */
function cssFor(v){
  const n = norm(v);
  if(n === 'base') return null;
  const head = isPc(n) ? "'" + pcName(n) + "'" : OPTIONS.find(o => o[0] === n)[2];
  return head + ',' + BASE_TAIL;
}
const TOKENS = ['--win-font', '--tw-font-legacy'];

const api = { OPTIONS, PC_PREFIX, TOKENS, BASE_TAIL, cleanFamily, norm, isPc, pcName, label, cssFor };
if(typeof window !== 'undefined') window.TwFontChoice = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

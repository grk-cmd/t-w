/* sim-xmas-letter.js — 🎄 마니또 편지 창(parts/xmas/xmas-letter.js · 일회성)을 가짜 화면 · 가짜 서버로 돌려 본다
   실행: node checks/run.js sim-xmas-letter
   ・1절 단추 — 쓰는 기간 [편지 쓰기 (n/1)] · 25일 0시부터 [편지 열람] · 1/6 0시(열람 끝)부터 숨김 · 창은 날짜로 쓰기 / 열람을 고른다
   ・2절 쓰기 — 맡긴 목록 · 마감 D-day · 운영자 확인 안내(html) · 처음이면 바로 편지지 · 새 편지(빈 칸) · 고치기(같은 칸) · 거두기 · 한 통을 맡기면 더 못 씀(상한을 낮추기 전 편지가 여럿이어도 보이고 · 고치고 · 거둔다)
   ・3절 반송 — 사유 표시 · [다시 쓰기] 는 그 글로 편지지를 펴고 빈 칸에 맡기며 fromReturned 로 반송 칸을 실어 보낸다(따로 지우지 않음) · [지우기]
   ・4절 쓰기 실패 — 마감(closed) · 로그인(auth) · 다른 PC 가 먼저(conflict — 다시 읽음) · 서버 바쁨(aborted) 은 안내 · 그 밖은 E-XMAS-05 · 불러오기 실패 E-XMAS-04 · 로그인 안 됨은 안내(오류 코드 없음)
   ・5절 열람 — 봉투 · 열기(글은 textContent) · 추천곡 바 · 읽음(이 PC) · 빨간 점 · ← 다른 편지 · 신고(g-) · 이벤트 끝 뒤 신고는 안내로 막힘 · 받은 편지 없음
   ・6절 받은 편지 한 번 읽기(빨간 점) — 부를 때만 읽고 다시 묻지 않음(폴링 없음 · 타이머 없음) · 실패는 조용히 · 세션 reset 이 점 · 창을 비우고 늦은 답은 버림 · «배달하는 중» 창 다시 그리기 ·
     짝 짓기 전(matched=false)은 «배달하는 중» · 날짜는 schedule()
   ・7절 닫기 · Esc · 저장소가 던져도 · mutation test */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (c) => c.find(p => fs.existsSync(p));
const LP = find(['xmas-letter.js', 'parts/xmas/xmas-letter.js', 'app/parts/xmas/xmas-letter.js', 'apps/desktop/app/parts/xmas/xmas-letter.js']);
const RP = find(['xmas-rules.js', 'parts/xmas/xmas-rules.js', 'app/parts/xmas/xmas-rules.js', 'apps/desktop/app/parts/xmas/xmas-rules.js']);
const HP = find(['desk-companion-prototype.html', 'app/desk-companion-prototype.html', 'apps/desktop/app/desk-companion-prototype.html']);
if (!LP || !RP || !HP) { say('  ? 원본 못 찾음 — xmas-letter.js · xmas-rules.js · desk-companion-prototype.html'); process.exit(2); }
const L = require(path.resolve(LP));
const R = require(path.resolve(RP));
const SRC = fs.readFileSync(LP, 'utf8');
const HTML = fs.readFileSync(HP, 'utf8');
const IDS = [...new Set([...SRC.matchAll(/\$\('([A-Za-z]+)'\)/g)].map(m => m[1]))];

function el(tag, id){
  const cls = new Set();
  const e = { tagName: String(tag || 'div').toUpperCase(), id, hidden: false, value: '', disabled: false, className: '', type: '', children: [], onclick: null, ls: {},
    get textContent(){ return e._t !== undefined ? e._t : e.children.map(c => c.textContent).join(''); },
    set textContent(v){ e._t = String(v); e.children = []; },
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) },
    appendChild: (c) => { e._t = undefined; e.children.push(c); return c; },
    addEventListener: (t, f) => { e.ls[t] = f; }, focus: () => {} };
  return e;
}
const DAY = 86400000;
const WRITE_NOW = R.LETTER_DEADLINE_MS - 9.5 * DAY;   // 12/15 낮(한국)
function world(opts){
  const o = opts || {};
  const els = {}; IDS.forEach(i => { els[i] = el('div', i); });
  ['xmasLwState', 'xmasLwWrite', 'xmasLwGot', 'xmasLwEdit', 'xmasLwRep', 'xmasLwOpened', 'xmasLwNone', 'xmasLwNewRow', 'xmasLwCancel'].forEach(i => { els[i].hidden = true; });
  const doc = { getElementById: (i) => els[i] || null, createElement: (t) => el(t) };
  const S = { now: o.now == null ? WRITE_NOW : o.now, toasts: [], errs: [], escs: [], dots: [], store: {} };
  const D = { letters: o.letters || null, returned: o.returned || null, got: o.got || null };
  const N = { calls: [], fail: o.fail || {}, ret: o.ret || {}, uid: 'uid' in o ? o.uid : 'authMe00001' };
  const net = {
    me: () => N.uid,
    myLetters: async () => { N.calls.push('my'); return N.fail.my ? { ok: false, code: N.fail.my } : { ok: true, letters: D.letters, returned: D.returned }; },
    got: async () => { if (!N.uid) return { ok: false, code: 'auth' }; N.calls.push('got'); if (N.hold) await N.hold; return N.fail.got ? { ok: false, code: N.fail.got } : { ok: true, got: D.got, matched: o.matched !== false }; },
    saveLetter: async (lid, text, song, fromReturned) => { N.calls.push('save:' + lid + (fromReturned ? '<' + fromReturned : '')); N.last = { lid, text, song, fromReturned }; if (N.saveHold) await N.saveHold; if (N.ret.save) return N.ret.save;
      D.letters = Object.assign({}, D.letters, { [lid]: { text, version: 1, song: song || undefined } });
      if (fromReturned){ D.returned = Object.assign({}, D.returned); delete D.returned[fromReturned]; }   // 서버가 같은 트랜잭션에서 지운다
      return { ok: true, version: 1 }; },
    removeLetter: async (lid) => { N.calls.push('remove:' + lid); if (N.ret.remove) return N.ret.remove; D.letters = Object.assign({}, D.letters); delete D.letters[lid]; return { ok: true }; },
    clearReturned: async (lid) => { N.calls.push('clearRet:' + lid); if (N.clearHold) await N.clearHold; if (N.ret.clear) return N.ret.clear; D.returned = Object.assign({}, D.returned); delete D.returned[lid]; return { ok: true }; },
    reportLetter: async (n) => { N.calls.push('report:' + n); return N.ret.report || { ok: true }; },
  };
  const bars = [];
  const song = { stops: 0, bar: (box, op) => { const b = { box, op, sets: [], set: (s) => b.sets.push(s), get: () => b.sets[b.sets.length - 1] || null }; bars.push(b); return b; }, stop(){ this.stops++; } };
  const storage = o.badStore ? { getItem(){ throw new Error('x'); }, setItem(){ throw new Error('x'); } }
    : { getItem: (k) => (k in S.store ? S.store[k] : null), setItem: (k, v) => { S.store[k] = String(v); } };   // 값으로 넘긴다(app.js 가 localStorage 를 그대로)
  const api = (o.mod || L).createXmasLetter({ doc, rules: R, net: () => net, song, serverNow: () => S.now, schedule: () => S.sched || R.SCHEDULE, toast: (m) => S.toasts.push(m), notifyError: (c) => S.errs.push(c),
    escRegisterWindow: (x) => S.escs.push(x), storage, onDot: (on) => S.dots.push(on) });
  return { api, els, S, D, N, song, bars };
}
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0)); };
const btn = (row, label) => row.children.find(c => c.tagName === 'BUTTON' && c.textContent === label);
const rows = (box) => box.children;
const SONG = { id: 'abcdefghijk', title: '캐럴' };

(async () => {
say('── 1절 단추 · 날짜');
{
  const w = world({ letters: { l1: { text: '하나', ts: 1 }, l3: { text: '셋', ts: 3 } } });
  await w.api.refresh();
  chk(w.els.xmasLetterBtn.textContent === '편지 쓰기 (2/1)' && !w.els.xmasLetterBtn.hidden && w.N.calls.join() === 'my', '쓰는 기간 — 편지함을 한 번 읽고 [편지 쓰기 (맡긴 수/1)] — 상한 전에 맡긴 두 통도 센다');
  w.S.now = R.LETTER_DEADLINE_MS; w.N.calls.length = 0; await w.api.refresh();
  chk(w.els.xmasLetterBtn.textContent === '편지 열람' && !w.N.calls.length, '25일 0시부터 [편지 열람] — 편지함은 안 읽는다');
  w.S.now = R.EVENT_END_MS; w.api.paintBtn();
  chk(!w.els.xmasLetterBtn.hidden && w.els.xmasLetterBtn.textContent === '편지 열람', '1월 1일 0시(이벤트 끝)에도 [편지 열람] — 1/5 까지');
  w.S.now = R.LETTERS_VIEW_UNTIL_MS; w.api.paintBtn();
  chk(w.els.xmasLetterBtn.hidden, '열람 끝(1/6 0시)부터 숨김');
  chk(/부적절한 내용이 없는지 운영자가 확인해요\. 받는 사람에게는 끝까지 익명이에요\./.test(HTML) && /From\. 익명의 산타/.test(HTML) && /To\. 누군가에게/.test(HTML), 'html — 운영자 확인 한 줄 안내 · 편지지 «To. 누군가에게 / From. 익명의 산타»');
}

say('── 2절 쓰기');
{
  const w = world();
  w.els.xmasLetterBtn.onclick(); await settle();
  chk(w.els.xmasLetter.classList.contains('on') && !w.els.xmasLwWrite.hidden && w.els.xmasLwGot.hidden && w.els.xmasLwT.textContent === '✉️ 마니또 편지 쓰기', '창 — 쓰는 기간이면 쓰기 화면');
  chk(w.els.xmasLwDday.textContent === '마감까지 D-9 · 12월 24일 23:59' && w.els.xmasLwCnt.textContent === '0/1', '마감 D-day · 0/1');
  chk(!w.els.xmasLwEdit.hidden && w.els.xmasLwCancel.hidden && w.els.xmasLwNewRow.hidden, '처음(맡긴 편지 없음)엔 바로 편지지 · 취소 없음');
  w.els.xmasLwText.value = '  올해 고마웠어요\n내년에도  '; w.els.xmasLwText.ls.input();
  chk(!w.els.xmasLwKeep.disabled && w.els.xmasLwN.textContent === String(w.els.xmasLwText.value.length), '글을 쓰면 [편지 맡기기] · 글자 수');
  w.bars[0].op.onChange(SONG);
  await w.els.xmasLwKeep.onclick(); await settle();
  chk(w.N.last.lid === 'l1' && w.N.last.text === '올해 고마웠어요\n내년에도' && w.N.last.song === SONG, '맡기기 — 빈 칸(l1) · 다듬은 글 · 추천곡');
  chk(/맡겼어요/.test(w.S.toasts.pop()) && w.N.calls.slice(-1)[0] === 'my' && w.els.xmasLwEdit.hidden && w.els.xmasLwCnt.textContent === '1/1' && rows(w.els.xmasLwList).length === 1, '  ↳ 다시 읽어 목록 1통 · 편지지 접힘 · 1/1');
  chk(w.els.xmasLwNewRow.hidden, '★ 한 통을 맡기면 [＋ 새 편지 쓰기] 가 없다(한 사람 한 통)');
  const nSave = w.N.calls.length;
  w.els.xmasLwNew.onclick();
  chk(/1통까지/.test(w.S.toasts.pop() || '') && w.els.xmasLwEdit.hidden && w.N.calls.length === nSave, '  ↳ 새로 쓰기를 눌러도 막고 안내 · 서버에 보내지 않는다');
  const r1 = rows(w.els.xmasLwList)[0];
  chk(/^맡긴 편지 · 올해 고마웠어요$/.test(r1.children[0].textContent), '목록 — «맡긴 편지» · 첫 줄만');
  btn(r1, '고치기').onclick();
  chk(w.els.xmasLwText.value === '올해 고마웠어요\n내년에도' && w.bars[0].sets.slice(-1)[0].id === SONG.id, '고치기 — 그 글 · 그 곡으로 편지지');
  w.els.xmasLwText.value = '고친 글'; w.els.xmasLwText.ls.input(); await w.els.xmasLwKeep.onclick(); await settle();
  chk(w.N.last.lid === 'l1' && w.N.last.text === '고친 글', '  ↳ 같은 칸(l1)에');
  await btn(rows(w.els.xmasLwList)[0], '거두기').onclick(); await settle();
  chk(w.N.calls.includes('remove:l1') && /거뒀어요/.test(w.S.toasts.pop()) && rows(w.els.xmasLwList).length === 0 && !w.els.xmasLwEdit.hidden, '거두기 — 칸을 비우면 다시 쓸 수 있다(편지지가 펴짐)');
  /* 상한을 낮추기 전에 맡긴 편지가 여럿(서버 칸은 다섯) — 다 보이고 · 고치고 · 거둘 수 있다 · 새로는 못 쓴다 */
  const wf = world({ letters: { l2: { text: '둘째 칸', ts: 2 }, l4: { text: '넷째 칸', ts: 4 } } });
  wf.api.open(); await settle();
  chk(rows(wf.els.xmasLwList).length === 2 && wf.els.xmasLwNewRow.hidden && wf.els.xmasLwCnt.textContent === '2/1' && /^1번째 편지 · 둘째 칸$/.test(rows(wf.els.xmasLwList)[0].children[0].textContent),
    '★ 상한 전에 맡긴 두 통 — 둘 다 보인다(몇 번째) · [＋ 새 편지 쓰기] 숨김');
  await btn(rows(wf.els.xmasLwList)[1], '거두기').onclick(); await settle();
  chk(wf.N.calls.includes('remove:l4') && rows(wf.els.xmasLwList).length === 1 && wf.els.xmasLwNewRow.hidden, '  ↳ 하나를 거둬도 한 통이 남아 새로는 못 쓴다');
}

say('── 3절 반송');
{
  const w = world({ returned: { l2: { reason: 'privacy', text: '내 번호는 010', ts: 5, song: SONG } } });
  w.api.open(); await settle();
  const rr = rows(w.els.xmasLwRet)[0];
  chk(rr && /^반송됨 · 내 번호는 010$/.test(rr.children[0].textContent) && /사유: 개인정보 · 고쳐서 다시 써 주세요/.test(rr.children[1].textContent), '반송 — 첫 줄 · «사유: 개인정보 · 고쳐서 다시 써 주세요»');
  chk(w.els.xmasLwEdit.hidden, '반송이 있으면 편지지를 저절로 펴지 않는다(먼저 사유를 본다)');
  btn(rr, '다시 쓰기').onclick();
  chk(w.els.xmasLwText.value === '내 번호는 010' && w.bars[0].sets.slice(-1)[0].id === SONG.id, '[다시 쓰기] — 반송된 글 · 곡으로 편지지');
  w.els.xmasLwText.value = '번호 뺐어요'; w.els.xmasLwText.ls.input(); await w.els.xmasLwKeep.onclick(); await settle();
  chk(w.N.calls.includes('save:l1<l2') && !w.N.calls.some(c => c.startsWith('clearRet')), '  ↳ 빈 칸(l1)에 맡기며 fromReturned 로 반송 칸을 싣는다 — 반송 표시를 따로 지우지 않는다(서버가 같은 트랜잭션에서)');
  chk(!rows(w.els.xmasLwRet).length && rows(w.els.xmasLwList).length === 1, '  ↳ 반송 줄이 사라지고 맡긴 목록 1통');
  /* 반송 뒤 새 편지를 이미 맡겼으면(한 통) 반송된 글을 다시 쓸 수 없다 — 먼저 맡긴 편지를 거두거나 반송 줄을 지운다 */
  const wb = world({ letters: { l1: { text: '새로 맡긴 편지', ts: 9 } }, returned: { l2: { reason: 'spam', text: '옛 글', ts: 5 } } });
  wb.api.open(); await settle();
  const nb = wb.N.calls.length;
  btn(rows(wb.els.xmasLwRet)[0], '다시 쓰기').onclick();
  chk(/1통까지/.test(wb.S.toasts.pop() || '') && wb.els.xmasLwEdit.hidden && wb.N.calls.length === nb, '★ 맡긴 편지가 있으면 반송된 글 [다시 쓰기] 는 안내로 막는다(두 통이 되지 않게)');
  const w2 = world({ returned: { l3: { reason: 'etc', note: '도배', text: 'ㅋㅋㅋ' } } });
  w2.api.open(); await settle();
  chk(/기타 — 도배/.test(rows(w2.els.xmasLwRet)[0].children[1].textContent), '기타 사유는 적은 말까지');
  await btn(rows(w2.els.xmasLwRet)[0], '지우기').onclick(); await settle();
  chk(w2.N.calls.includes('clearRet:l3') && !rows(w2.els.xmasLwRet).length && !w2.els.xmasLwEdit.hidden, '[지우기] — 표시만 치운다(다 비면 편지지가 펴진다)');
  { const wd = world({ returned: { l3: { reason: 'spam', text: '광고' } } }); wd.api.open(); await settle();
    let rel; wd.N.clearHold = new Promise((r) => { rel = r; });
    const b = btn(rows(wd.els.xmasLwRet)[0], '지우기');
    const p1 = b.onclick(); b.onclick(); rel(); await p1; await settle();
    chk(wd.N.calls.filter(c => c.startsWith('clearRet')).length === 1, '[지우기] 를 지우는 중에 또 눌러도 한 번만 보낸다');
    const wa = world({ returned: { l3: { reason: 'spam', text: '광고' } }, ret: { clear: { ok: false, code: 'auth' } } }); wa.api.open(); await settle();
    await btn(rows(wa.els.xmasLwRet)[0], '지우기').onclick(); await settle();
    chk(/로그인한 뒤 편지/.test(wa.S.toasts.join()) && !wa.S.errs.length, '[지우기] 실패 auth — 쓰기 실패와 같은 안내(오류 번호 아님)'); }
  const w3 = world({ returned: { l1: { reason: 'abuse', text: '나쁜 말' } } });
  w3.api.open(); await settle(); btn(rows(w3.els.xmasLwRet)[0], '다시 쓰기').onclick();
  w3.N.ret.save = { ok: false, code: 'write' };
  w3.els.xmasLwText.ls.input(); await w3.els.xmasLwKeep.onclick(); await settle();
  chk(!w3.N.calls.some(c => c.startsWith('clearRet')) && w3.S.errs.join() === 'E-XMAS-05' && rows(w3.els.xmasLwRet).length === 1, '  ↳ 맡기기 실패면 반송 표시가 남는다 · E-XMAS-05');
}

say('── 4절 쓰기 실패 · 불러오기 실패');
{
  for (const [code, re, err] of [['closed', /마감이 지났어요/, ''], ['auth', /로그인한 뒤 편지/, ''], ['aborted', /잠시 뒤 다시/, ''], ['write', null, 'E-XMAS-05']]) {
    const w = world({ ret: { save: { ok: false, code } } }); w.api.open(); await settle();
    w.els.xmasLwText.value = '안녕'; w.els.xmasLwText.ls.input(); await w.els.xmasLwKeep.onclick(); await settle();
    chk((re ? re.test(w.S.toasts.pop() || '') : true) && w.S.errs.join() === err && !w.els.xmasLwEdit.hidden, '맡기기 실패 ' + code + ' — ' + (err || '안내') + ' · 쓰던 편지지는 그대로');
  }
  { const w = world({ letters: { l1: { text: '하나', version: 3 } }, ret: { save: { ok: false, code: 'conflict' } } }); w.api.open(); await settle();
    btn(rows(w.els.xmasLwList)[0], '고치기').onclick(); w.els.xmasLwText.value = '고침'; w.els.xmasLwText.ls.input();
    const before = w.N.calls.filter(c => c === 'my').length;
    await w.els.xmasLwKeep.onclick(); await settle();
    chk(/다른 PC 에서 먼저/.test(w.S.toasts.join()) && !w.S.errs.length && w.N.calls.filter(c => c === 'my').length === before + 1 && w.els.xmasLwEdit.hidden,
      '맡기기 실패 conflict(다른 PC 가 먼저 고침) — 안내 · 편지함을 다시 읽고 편지지를 닫는다(덮어쓰지 않음)'); }
  const wr = world({ letters: { l1: { text: 'x' } }, ret: { remove: { ok: false, code: 'write' } } }); wr.api.open(); await settle();
  await btn(rows(wr.els.xmasLwList)[0], '거두기').onclick();
  chk(wr.S.errs.join() === 'E-XMAS-05', '거두기 실패 — E-XMAS-05');
  const wl = world({ fail: { my: 'read' } }); wl.api.open(); await settle();
  chk(wl.S.errs.join() === 'E-XMAS-04' && /불러오지 못했어요/.test(wl.els.xmasLwState.textContent) && wl.els.xmasLwWrite.hidden, '불러오기 실패 — E-XMAS-04 · 빈 목록으로 그리지 않는다');
  const wa = world({ fail: { my: 'auth' } }); wa.api.open(); await settle();
  chk(!wa.S.errs.length && /로그인한 뒤/.test(wa.els.xmasLwState.textContent), '로그인 안 됨 — 안내(오류 코드 없음)');
}

say('── 5절 열람');
{
  const got = { 1: { text: '<b>메리</b> 크리스마스', song: SONG }, 2: { text: '두 번째 편지' } };
  const w = world({ now: R.LETTER_DEADLINE_MS + 1000, got });
  w.api.open(); await settle();
  chk(!w.els.xmasLwGot.hidden && w.els.xmasLwWrite.hidden && w.els.xmasLwT.textContent === '✉️ 받은 편지' && rows(w.els.xmasLwEnvs).length === 2 && w.els.xmasLwGotCnt.textContent === '2통', '25일 — 받은 편지 봉투 2통');
  chk(w.S.dots.slice(-1)[0] === true, '안 읽은 편지 — 빨간 점');
  rows(w.els.xmasLwEnvs)[0].onclick();
  chk(w.els.xmasLwGotText.textContent === '<b>메리</b> 크리스마스' && !w.els.xmasLwOpened.hidden && w.els.xmasLwEnvBox.hidden, '열기 — 남이 쓴 글은 글자 그대로(textContent)');
  chk(w.bars[1].sets.slice(-1)[0].id === SONG.id && !w.els.xmasLwGotSongRow.hidden && w.bars[1].op.editable !== true, '추천곡 바(((o 없음)');
  chk(w.S.store['tw.xmasGotRead.authMe00001'] === '1' && w.S.dots.slice(-1)[0] === true, '읽음은 이 PC 에(계정마다) · 한 통 남아 점은 그대로');
  w.els.xmasLwBack.onclick();
  chk(!w.els.xmasLwEnvBox.hidden && w.els.xmasLwOpened.hidden && w.bars[1].sets.slice(-1)[0] === null && /읽음/.test(rows(w.els.xmasLwEnvs)[0].textContent), '← 다른 편지 — 봉투로 · 곡 내림 · «읽음»');
  rows(w.els.xmasLwEnvs)[1].onclick();
  chk(w.els.xmasLwGotSongRow.hidden && w.S.dots.slice(-1)[0] === false, '곡 없는 편지는 바를 숨김 · 다 읽으면 점 지움');
  w.els.xmasLwReport.onclick(); chk(!w.els.xmasLwRep.hidden, '🚩 신고 — 확인창');
  await w.els.xmasLwRepYes.onclick();
  chk(w.N.calls.includes('report:2') && /신고했어요/.test(w.S.toasts.pop()), '  ↳ 연 편지 번호로 신고');
  for (const [code, re, err] of [['dup', /이미 신고한 편지/, ''], ['auth', /로그인한 뒤 신고/, ''], ['failed-precondition', /이벤트가 끝나 신고할 수 없어요/, ''], ['gone', /이미 없는 편지예요/, ''], ['report', null, 'E-XMAS-06'], ['aborted', null, 'E-XMAS-06']]) {
    const wx = world({ now: R.LETTER_DEADLINE_MS + 1000, got, ret: { report: { ok: false, code } } }); wx.api.open(); await settle();
    rows(wx.els.xmasLwEnvs)[0].onclick(); await wx.els.xmasLwRepYes.onclick();
    chk((re ? re.test(wx.S.toasts.pop() || '') : true) && wx.S.errs.join() === err, '신고 실패 ' + code + ' — ' + (err || '안내'));
  }
  { // 이벤트 끝(1/1 0시) 뒤 — 받은 편지는 보이고 신고는 안내로 막힌다(오류 번호 · 요청 없음)
    const endCase = async (mod) => {
      const we = world({ now: R.EVENT_END_MS, got, mod }); we.api.open(); await settle();
      rows(we.els.xmasLwEnvs)[0].onclick();
      const viewed = we.els.xmasLwGotText.textContent === got[1].text;
      we.els.xmasLwReport.onclick();
      const blocked = we.els.xmasLwRep.hidden && /이벤트가 끝나 신고할 수 없어요/.test(we.S.toasts.pop() || '');
      const wl = world({ now: R.EVENT_END_MS - 1000, got, mod }); wl.api.open(); await settle();
      rows(wl.els.xmasLwEnvs)[0].onclick(); wl.els.xmasLwReport.onclick();
      wl.S.now = R.EVENT_END_MS; await wl.els.xmasLwRepYes.onclick();   // 확인창을 연 채 끝을 넘김
      const late = /이벤트가 끝나 신고할 수 없어요/.test(wl.S.toasts.pop() || '');
      return { viewed, blocked, late, calls: we.N.calls.concat(wl.N.calls).filter(c => c.startsWith('report')).length, errs: we.S.errs.length + wl.S.errs.length };
    };
    const r = await endCase(null);
    chk(r.viewed && r.blocked && r.late && !r.calls && !r.errs, '이벤트 끝 뒤 — 받은 편지는 열리고 · 신고는 안내로 막힌다(확인창을 연 채 넘겨도) · 요청 0 · 오류 번호 없음');
    const bad = {}; new Function('window', 'module', SRC.split('if (!rules.eventOn(serverNow(), schedule())){ toast(REPORT_ENDED); return; }').join(''))(bad, undefined);
    const rb = await endCase(bad.TwXmasLetter);
    chk(!(rb.blocked && rb.late && !rb.calls), 'mutation test — 끝 검사를 빼면 위 검사가 빨강(신고가 서버로 나간다)');
  }
  const wn = world({ now: R.LETTER_DEADLINE_MS + 1000, got: null }); wn.api.open(); await settle();
  chk(!wn.els.xmasLwNone.hidden && wn.els.xmasLwEnvBox.hidden, '받은 편지 없음 — «올해는 받은 편지가 없어요»');
  const wg = world({ now: R.LETTER_DEADLINE_MS + 1000, fail: { got: 'read' } }); wg.api.open(); await settle();
  chk(wg.S.errs.join() === 'E-XMAS-04' && wg.els.xmasLwNone.hidden, '못 불러옴 — E-XMAS-04 · «없어요» 로 그리지 않는다');
}

say('── 6절 받은 편지 한 번 읽기(빨간 점) — 폴링 없음');
{
  const w = world({ now: R.LETTER_DEADLINE_MS + 30000 });
  await w.api.checkGot();
  chk(w.N.calls.join() === 'got', '부르면 한 번 읽는다(알림을 본 창이 부른다)');
  w.api.paintBtn(); w.api.refresh(); await settle();
  chk(w.N.calls.join() === 'got', '  ↳ 단추 그리기 · 창 아래 단추 새로 고침은 받은 편지를 읽지 않는다');
  chk(!/setInterval|setTimeout|GOT_RETRY/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')), '  ↳ 편지 모듈에 타이머 · 다시 묻기가 없다(폴링 지움)');
  w.D.got = { 1: { text: '도착' } }; await w.api.checkGot();
  chk(w.N.calls.length === 2 && w.S.dots.slice(-1)[0] === true && w.els.xmasLetterBtn.classList.contains('xm-dot'), '읽어서 있으면 빨간 점([편지 열람] 에도)');
  const we = world({ now: R.LETTER_DEADLINE_MS + 1000, fail: { got: 'read' } }); await we.api.checkGot();
  chk(we.N.calls.length === 1 && !we.S.dots.includes(true) && !we.S.errs.length, '실패는 조용히(«없음» 으로 굳히지 않음 — 다음 알림 · 창 열기에 다시)');
  /* 계정 바뀜 — 세션 reset(app.js 가 session.onReset 에 건다)이 창 · 점 · 받은 편지를 비우고, 그 사이 늦게 온 답은 버린다 */
  const switchCases = async (mod) => {
    const wf = world({ now: R.LETTER_DEADLINE_MS + 1000, got: { 1: { text: 'A 의 편지' } }, mod });
    await wf.api.checkGot(); const aDot = wf.S.dots.slice(-1)[0] === true && wf.els.xmasLetterBtn.classList.contains('xm-dot');
    wf.api.open(); await settle();
    wf.api.reset();
    const cleared = aDot && wf.S.dots.slice(-1)[0] === false && !wf.els.xmasLetterBtn.classList.contains('xm-dot') && !wf.api.isOpen();
    const wl = world({ now: R.LETTER_DEADLINE_MS + 1000, got: { 1: { text: 'A 의 편지' } }, mod });
    let rel; wl.N.hold = new Promise((r) => { rel = r; });
    const p = wl.api.checkGot(); await settle();
    wl.api.reset(); rel(); const ok = await p; wl.api.paintBtn();
    const lateDropped = ok === false && !wl.S.dots.includes(true) && !wl.els.xmasLetterBtn.classList.contains('xm-dot');
    return { cleared, lateDropped };
  };
  const sc = await switchCases(null);
  chk(sc.cleared, '★ 세션 reset — 앞 계정 빨간 점 · [편지 열람] 점을 지우고 창을 닫는다');
  chk(sc.lateDropped, '★ 앞 계정으로 읽는 사이 reset 되면 늦게 온 답(앞 계정 편지)을 그리지 않는다 · 못 읽음(false)');
  const mut = (from, to) => { const b = {}; const src = SRC.split(from).join(to); new Function('window', 'module', src)(b, undefined); return src === SRC ? null : b.TwXmasLetter; };
  const m1 = mut('    deps.onDot(false);\n    paintBtn();\n  }\n\n  return {', '  }\n\n  return {');
  const m2 = mut('if (my !== gen) return false;', '');
  chk(m1 && !(await switchCases(m1)).cleared, 'mutation test — reset 이 점을 안 지우면 위 «점을 지운다» 가 빨강');
  chk(m2 && !(await switchCases(m2)).lateDropped, 'mutation test — 늦게 온 답의 세션을 안 보면 위 «늦게 온 답은 버린다» 가 빨강');
  { // «배달하는 중» 으로 열어 둔 창 — 알림 뒤 checkGot 이 읽으면 다시 그린다
    const wo = world({ now: R.LETTER_DEADLINE_MS + 1000, matched: false }); wo.api.open(); await settle();
    const before = /배달하는 중/.test(wo.els.xmasLwState.textContent);
    wo.D.got = { 1: { text: '도착했어요' } };
    const ok = await wo.api.checkGot();
    chk(before && ok && !wo.els.xmasLwGot.hidden && rows(wo.els.xmasLwEnvs).length === 1 && !/배달하는 중/.test(wo.els.xmasLwState.textContent), '★ «배달하는 중» 으로 열어 둔 창 — checkGot 이 읽으면 봉투로 다시 그린다');
    const m3 = mut("if (isOpen() && viewing === 'got' && openedN == null) drawGot(r.matched);", '');
    const wo2 = world({ now: R.LETTER_DEADLINE_MS + 1000, matched: false, mod: m3 }); wo2.api.open(); await settle();
    wo2.D.got = { 1: { text: '도착했어요' } }; await wo2.api.checkGot();
    chk(m3 && /배달하는 중/.test(wo2.els.xmasLwState.textContent), 'mutation test — 다시 그리기를 빼면 위 검사가 빨강(창이 «배달하는 중» 에 머문다)');
  }
  const wr = world({ now: R.LETTER_DEADLINE_MS + 1000, got: { 1: { text: 'x' } } }); wr.S.store['tw.xmasGotRead.authMe00001'] = '1';
  await wr.api.checkGot(); chk(wr.S.dots.slice(-1)[0] === false, '이미 읽은 편지뿐이면 점 없음');
  const wm = world({ now: R.LETTER_DEADLINE_MS + 1000, matched: false }); wm.api.open(); await settle();
  chk(/배달하는 중/.test(wm.els.xmasLwState.textContent) && wm.els.xmasLwGot.hidden && wm.N.calls.filter(c => c === 'got').length === 1, '마감 뒤 짝 짓기 전(matched=false) — «배달하는 중» · 한 번만 읽는다');
  await settle(); chk(wm.N.calls.filter(c => c === 'got').length === 1, '  ↳ 다시 묻지 않는다');
  const wn = world({ now: R.LETTER_DEADLINE_MS + 1000, matched: true }); wn.api.open(); await settle();
  chk(!wn.els.xmasLwNone.hidden && !/배달하는 중/.test(wn.els.xmasLwState.textContent), '짝 지은 뒤 받은 편지가 없으면 «받은 편지 없음»');
  const wv = world({ now: R.LETTER_DEADLINE_MS - 1000 }); wv.S.sched = Object.freeze({ letterDeadline: R.LETTER_DEADLINE_MS - 5000, eventEnd: R.EVENT_END_MS, lettersViewUntil: R.LETTERS_VIEW_UNTIL_MS });
  wv.api.paintBtn();
  chk(wv.els.xmasLetterBtn.textContent === '편지 열람', '날짜는 schedule()(서버 값)으로 — 처음 값보다 이른 마감이면 그때부터 [편지 열람]');
}

say('── 6-2절 세션 reset 뒤 늦은 쓰기 답');
{
  const late = async (mod) => {
    const w = world({ mod }); w.api.open(); await settle();
    let rel; const hold = new Promise((r) => { rel = r; });
    w.els.xmasLwText.value = '안녕'; w.els.xmasLwText.ls.input();
    w.N.saveHold = hold;
    const p = w.els.xmasLwKeep.onclick(); await settle();
    w.api.reset(); w.N.calls.length = 0; w.S.toasts.length = 0; rel(); await p; await settle();
    return { calls: w.N.calls.join(), toasts: w.S.toasts.join() };
  };
  const r = await late(null);
  chk(r.calls === '' && !/맡겼어요/.test(r.toasts), '★ 맡기기가 걸린 사이 reset — 늦은 답 뒤 편지함을 다시 읽지 않고 «맡겼어요» 도 안 띄운다(새 계정으로 요청 0)');
  const bad = {}; new Function('window', 'module', SRC.split('    if (g !== gen) return;   // 그 사이 세션이 끝났다 — 앞 계정 답으로 그리거나 다시 읽지 않는다\n').join(''))(bad, undefined);
  const rb = await late(bad.TwXmasLetter);
  chk(rb.calls !== '' || /맡겼어요/.test(rb.toasts), 'mutation test — 세션 검사를 빼면 위 검사가 빨강');
}

say('── 7절 닫기 · Esc · 저장소');
{
  const w = world(); w.api.open(); await settle();
  chk(w.S.escs.length === 1 && w.S.escs[0].key === 'xmasLetter' && w.S.escs[0].isOpen(), 'Esc 스택에 xmasLetter(트리 창보다 먼저 닫힌다)');
  w.els.xmasLwX.onclick();
  chk(!w.els.xmasLetter.classList.contains('on') && w.song.stops === 1, '✕ — 닫고 추천곡을 멈춘다');
  const wb = world({ now: R.LETTER_DEADLINE_MS + 1000, got: { 1: { text: 'x' } }, badStore: true }); wb.api.open(); await settle();
  rows(wb.els.xmasLwEnvs)[0].onclick();
  chk(wb.els.xmasLwGotText.textContent === 'x', '저장소가 던져도 열람은 된다(읽음 표시만 못 남김)');
  const wt = world({ now: R.LETTERS_VIEW_UNTIL_MS }); wt.api.open(); await settle();
  chk(!wt.els.xmasLetter.classList.contains('on'), '열람 끝 뒤엔 열자마자 닫힌다');
  let threw = false; try { L.createXmasLetter({ doc: { getElementById: () => null } }); } catch (e) { threw = /xmasLetter/.test(e.message); }
  chk(threw, '마크업이 없으면 이름을 대고 던진다');
  chk(!/innerHTML/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')), '편지 모듈에 innerHTML 없음');
  // mutation test — 반송을 다시 쓸 때 «반송 칸 번호» 에 그대로 쓰면, 그새 그 칸에 새 편지를 맡겼을 때 덮어쓴다
  const wk = world({ letters: { l1: { text: '새로 맡긴 편지' } }, returned: { l1: { reason: 'spam', text: '옛 글' } } });
  wk.api.open(); await settle(); btn(rows(wk.els.xmasLwRet)[0], '다시 쓰기').onclick(); wk.els.xmasLwText.ls.input(); await wk.els.xmasLwKeep.onclick(); await settle();
  chk(!wk.N.calls.some(c => c.startsWith('save:')), '반송 칸(l1)에 새 편지가 있으면 다시 쓰기로 덮어쓰지 않는다(맡긴 편지가 있어 막힌다)');

}

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

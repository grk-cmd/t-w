/*
 * 방 안 정보 칸 — 제목 줄 · [방 설정](방장만 · 제목 · 공개 바꾸기) 검사 — 모듈을 그대로 불러 돌린다(가짜 DOM).
 * 1. room-settings.js 의 보일 제목(displayTitle) · 공개 안내  2. room-info-ui.js 그리기(방 밖 · 방 서버 · 방장 / 손님 · 금칙어 · 글로만)
 * 3. 바꾸기(열기 · 저장 · 금칙어 · 길이 · 시크릿룸 · 실패 · 연타 · 그새 방장이 바뀜)  4. 배선(html · app.js · room-entry · firebase-init · 로비 카드)  5. 깨 보기
 * 설계: docs/ROOM_LOBBY.md 5.1 · 5.2
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const need = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } };
const BW_SRC = need('banned-words.js'), RS_SRC = need('room-settings.js'), UI_SRC = need('room-info-ui.js');
const HTML = need('desk-companion-prototype.html'), APP = need('app.js'), RE = need('room-entry.js'), FI = need('firebase-init.js'), M_SRC = need('room-lobby-model.js');
const classic = (src, name, extra) => { const w = Object.assign({}, extra || {}); new Function('window', src)(w); return w[name]; };
const BW = classic(BW_SRC, 'TwBannedWords');
const RS = classic(RS_SRC, 'TwRoomSettings');
const tick = () => new Promise((r) => setTimeout(r, 0));

function takeFn(src, head){
  const i = src.indexOf(head);
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0) return src.slice(i, j + 1); }
  }
  return null;
}

/* 가짜 DOM — 이 칸이 쓰는 만큼만. innerHTML 을 쓰면 던진다(남이 쓴 제목은 글로만) */
function mkDom(){
  const els = {};
  const el = (id) => els[id] || (els[id] = { id, hidden: ['riBox', 'riEdit', 'riPanel'].includes(id), disabled: false, checked: false, value: '', textContent: '', title: '',
    focused: 0, focus(){ this.focused++; }, className: '',
    get innerHTML(){ throw new Error('innerHTML 금지'); }, set innerHTML(v){ throw new Error('innerHTML 금지'); },
    classList: { _s: new Set(), toggle(c, on){ on ? this._s.add(c) : this._s.delete(c); }, contains(c){ return this._s.has(c); } } });
  return { doc: { getElementById: el }, el };
}

function mkUi(o, src){
  const { doc, el } = mkDom();
  global.document = doc;
  const st = Object.assign({ me: 'u1', code: 'COZY-AB12', meta: { host: 'u1', title: '마감방', hostName: '도토리', open: true }, banned: [], save: async () => ({ ok: true }) }, o || {});
  const log = { saves: [], errors: [] };
  const UI = classic(src || UI_SRC, 'TwRoomInfoUi');
  const ui = UI.createRoomInfoUi({
    roomSettings: RS, bannedWords: BW, rcStore: () => ({ bannedWords: () => st.banned }),
    // 방장 · 시크릿룸 판정은 app.js 가 채팅 잠금(chat-lock.js _chatIsHost · _chatIsSecretRoom)을 넘긴다 — 여기선 같은 모양으로
    isHost: () => !!(st.meta && st.me && st.meta.host === st.me), isSecretRoom: () => /^SCRT-/.test(st.code || ''), roomCode: () => st.code, meta: () => st.meta,
    saveInfo: async (room, info) => { log.saves.push([room, info]); return st.save(room, info); },
    notifyError: (c) => log.errors.push(c),
  });
  return { ui, el, st, log };
}

(async () => {
  say('── 1. room-settings.js — 보일 제목 · 공개 안내');
  {
    const d = (t, hn, b) => RS.displayTitle(t, hn, b, b ? BW : undefined);
    chk(d('마감방', '도토리').text === '마감방' && !d('마감방', '도토리').isDefault, '제목이 있으면 그 제목');
    chk(d('', '도토리').text === '도토리 님의 방' && d('', '도토리').isDefault && d('  ', ' 도토리 ').text === '도토리 님의 방', '  빈 제목(공백만 포함) → «닉네임 님의 방»');
    chk(d(undefined, '').text === '이름 없는 방' && d(null, null).isDefault, '  닉네임도 없으면 «이름 없는 방»');
    chk(d('바보방', '도토리', ['바보']).text === '도토리 님의 방' && d('바보방', '도토리', ['바보']).isDefault, '★ 금칙어에 걸린 제목은 기본값으로(방 안은 _meta 를 그대로 받으니 여기서 거른다)');
    chk(d('바보방', '도토리').text === '바보방', '  목록을 안 주면 거르지 않는다(로비 사본은 서버 함수가 이미 거름)');
    chk(typeof RS.OPEN_HINT.on === 'string' && typeof RS.OPEN_HINT.off === 'string' && Object.isFrozen(RS.OPEN_HINT), '«방 목록에 공개» 안내 한 벌');
  }

  say('── 2. 그리기');
  let t = mkUi();
  t.ui.paint();
  chk(!t.el('riBox').hidden && t.el('riTitle').textContent === '마감방' && !t.el('riTitle').classList.contains('dim') && !t.el('riEdit').hidden, '방장 — 제목 줄 · [방 설정] 이 보인다');
  t = mkUi({ me: 'u2' }); t.ui.paint();
  chk(!t.el('riBox').hidden && t.el('riEdit').hidden, '★ 손님 — 제목만 보이고 [방 설정] 은 숨는다');
  t = mkUi({ me: null }); t.ui.paint();
  chk(t.el('riEdit').hidden, '  내 코드를 모르면 방장으로 안 본다');
  t = mkUi({ code: null }); t.ui.paint();
  chk(t.el('riBox').hidden, '방 밖이면 줄째 숨는다');
  t = mkUi({ meta: null }); t.ui.paint();
  chk(t.el('riBox').hidden, '  meta 를 아직 못 받았으면 숨는다');
  chk(!/isServerRoom/.test(UI_SRC), '★ 방 서버 방도 같은 칸 — 저장 길(서버 meta · Firebase _meta)은 app.js 의 saveInfo 가 고른다');
  t = mkUi({ meta: { host: 'u1', title: '', hostName: '도토리' } }); t.ui.paint();
  chk(t.el('riTitle').textContent === '도토리 님의 방' && t.el('riTitle').classList.contains('dim'), '  빈 제목은 기본값 · 흐리게');
  t = mkUi({ meta: { host: 'u1', title: '바보들의 방', hostName: '도토리' }, banned: ['바보'] }); t.ui.paint();
  chk(t.el('riTitle').textContent === '도토리 님의 방', '★ 금칙어 제목은 방 안에서도 기본값으로');
  t = mkUi({ meta: { host: 'u2', title: '<img src=x onerror=alert(1)>', hostName: '' } }); t.ui.paint();
  chk(t.el('riTitle').textContent === '<img src=x onerror=alert(1)>', '★ 남이 쓴 제목은 글로만(innerHTML 을 쓰면 가짜 DOM 이 던진다)');

  say('── 3. 바꾸기');
  t = mkUi(); t.ui.paint();
  t.el('riEdit').onclick();
  chk(!t.el('riPanel').hidden && t.el('riTitleIn').value === '마감방' && t.el('riOpen').checked && !t.el('riOpenRow').hidden && t.el('riTitleCount').textContent === '3/20', '[방 설정] → 지금 제목 · 공개로 칸이 열린다');
  chk(t.el('riOpenHint').textContent === RS.OPEN_HINT.on, '  공개 안내는 방 만들기 창과 같은 글');
  t.el('riTitleIn').value = '  새 제목  '; t.el('riOpen').checked = false;
  await t.el('riSave').onclick(); await tick();
  chk(t.log.saves.length === 1 && t.log.saves[0][0] === 'COZY-AB12' && t.log.saves[0][1].title === '새 제목' && t.log.saves[0][1].open === false && t.el('riPanel').hidden, '★ 저장 — 제목(앞뒤 공백 걷음) · 공개를 그 방에 쓰고 칸을 닫는다');
  t.el('riEdit').onclick(); t.el('riTitleIn').value = '';
  await t.el('riSave').onclick();
  chk(t.log.saves[1][1].title === '', '  빈 제목도 저장(칸을 지워 기본값으로)');
  t = mkUi({ banned: ['바보'] }); t.ui.paint(); t.el('riEdit').onclick();
  t.el('riTitleIn').value = '바보방';
  await t.el('riSave').onclick();
  chk(t.log.saves.length === 0 && t.el('riTitleErr').textContent === RS.TITLE_ERROR_TEXT.banned && !t.el('riPanel').hidden, '★ 금칙어 — 저장하지 않고 칸 아래에 문구(토스트 · 오류 번호 아님)');
  t.el('riTitleIn').oninput();
  chk(t.el('riTitleErr').textContent === '', '  고치기 시작하면 문구가 지워진다');
  t.el('riTitleIn').value = 'ㄱ'.repeat(21);
  await t.el('riSave').onclick();
  chk(t.log.saves.length === 0 && t.el('riTitleErr').textContent === RS.TITLE_ERROR_TEXT.long, '  21자는 «20자까지»');
  t = mkUi({ code: 'SCRT-AB12' }); t.ui.paint(); t.el('riEdit').onclick();
  t.el('riTitleIn').value = '우리 방';
  await t.el('riSave').onclick();
  chk(t.el('riOpenRow').hidden && !('open' in t.log.saves[0][1]), '★ 시크릿룸 — 공개 칸이 없고 공개는 쓰지 않는다(목록에 원래 안 나옴)');
  t = mkUi({ save: async () => ({ ok: false }) }); t.ui.paint(); t.el('riEdit').onclick();
  await t.el('riSave').onclick();
  chk(t.log.errors.join() === 'E-ROOM-04' && !t.el('riPanel').hidden && !t.el('riSave').disabled, '★ 저장 실패 → E-ROOM-04 · 칸은 그대로(다시 누를 수 있게)');
  t = mkUi({ save: async () => { throw new Error('net'); } }); t.ui.paint(); t.el('riEdit').onclick();
  await t.el('riSave').onclick();
  chk(t.log.errors.join() === 'E-ROOM-04', '  던져도 같은 길');
  for(const [code, text] of [['title', RS.TITLE_ERROR_TEXT.banned], ['forbidden', '지금 방장만 바꿀 수 있어요']]){
    t = mkUi({ save: async () => ({ ok: false, code }) }); t.ui.paint(); t.el('riEdit').onclick();
    await t.el('riSave').onclick();
    chk(!t.log.errors.length && t.el('riTitleErr').textContent === text && !t.el('riPanel').hidden, '★ 방 서버 거절(' + code + ') → 칸 아래 글 · 오류 번호 아님 · 칸은 그대로');
  }
  let release;
  t = mkUi({ save: () => new Promise((r) => { release = () => r({ ok: true }); }) }); t.ui.paint(); t.el('riEdit').onclick();
  t.el('riSave').onclick(); t.el('riSave').onclick();
  chk(t.log.saves.length === 1 && t.el('riSave').disabled, '  저장 중 연타는 한 번만');
  release(); await tick();
  t = mkUi(); t.ui.paint(); t.el('riEdit').onclick();
  t.st.meta = { host: 'u2', title: '마감방', hostName: '말랑' }; t.ui.paint();
  chk(t.el('riPanel').hidden && t.el('riEdit').hidden, '★ 그새 방장이 넘어가면(승계) 열린 칸이 닫히고 버튼이 사라진다');
  t = mkUi(); t.ui.paint(); t.el('riEdit').onclick();
  t.st.meta = { host: 'u2' };
  await t.el('riSave').onclick();
  chk(t.log.saves.length === 0, '  다시 그리기 전에 눌러도 방장이 아니면 쓰지 않는다');
  t = mkUi({ me: 'u2' }); t.ui.paint(); t.el('riEdit').onclick();
  chk(t.el('riPanel').hidden, '  손님은 버튼을 눌러도(숨김을 우회해도) 칸이 안 열린다');
  t = mkUi(); t.ui.paint(); t.el('riEdit').onclick(); t.el('riEdit').onclick();
  chk(t.el('riPanel').hidden, '  [방 설정] 을 다시 누르면 닫힌다');
  delete global.document;

  say('── 4. 배선');
  const pos = (f) => HTML.indexOf('<script src="parts/' + f + '"');
  chk(pos('shared/banned-words.js') > 0 && pos('room/room-settings.js') > pos('shared/banned-words.js') && pos('room/room-info-ui.js') > pos('room/room-settings.js') && pos('app.js') > pos('room/room-info-ui.js'), 'html: banned-words → room-settings → room-info-ui → app.js');
  chk(['riBox', 'riTitle', 'riEdit', 'riPanel', 'riTitleIn', 'riTitleCount', 'riTitleErr', 'riOpenRow', 'riOpen', 'riOpenHint', 'riCancel', 'riSave'].every((id) => HTML.includes('id="' + id + '"'))
    && HTML.indexOf('id="riBox"') > HTML.indexOf('id="inviteActive"'), '  방 안 정보 칸(#inviteActive) 안에 칸이 다 있다');
  const iUi = APP.indexOf('const roomInfoUi = TwRoomInfoUi.createRoomInfoUi({'), iRe = APP.indexOf('const roomEntryMod = TwRoomEntry.createRoomEntry({');
  {
    const RSt = classic(need('room-state.js'), 'TwRoomState');
    chk(RSt.isHost({ host: 'u1' }, 'u1') && !RSt.isHost({ host: 'u1' }, 'u2') && !RSt.isHost({ host: 'u1' }, null) && !RSt.isHost(null, 'u1') && !RSt.isHost({}, undefined),
      'room-state.js 방장 판정 — 내 코드를 모르거나 meta 가 없으면 아니다');
    chk(RSt.isSecretCode('SCRT-AB12') && !RSt.isSecretCode('COZY-AB12') && !RSt.isSecretCode(null) && !RSt.isSecretCode('xSCRT-1'), '  시크릿룸 코드 판정');
    const CL = need('chat-lock.js');
    chk(/isHost: \(\)=>TwRoomState\.isHost\(window\._roomMetaCache, getMyUserId\(\)\)/.test(APP) && /isSecretRoom: \(\)=>TwRoomState\.isSecretCode\(/.test(APP)
      && /roomState\.isHost\(window\._roomMetaCache, getMyUserId\(\)\)/.test(CL) && /roomState\.isSecretCode\(_chatRoomCode\(\)\)/.test(CL) && /roomState: TwRoomState,/.test(APP) && !/isSecretCode/.test(RS_SRC),
      '★ 방장 · 시크릿룸 판정은 채팅 잠금과 같은 한 곳(room-state.js)을 부른다 — 다시 쓰지 않음 · 서로 부르지 않아 순환 없음');
  }
  chk(iUi > 0 && iRe > iUi && /paintRoomInfo: \(\)=>roomInfoUi\.paint\(\),/.test(APP) && /saveInfo: \(room, info\)=>\(Presence\.serverProvider\(\) \? Presence\.serverProvider\(\)\.setMeta\(info\) : window\.firebaseAPI\.setRoomInfo\(room, info\)\),/.test(APP), 'app.js: 방 입장 모듈보다 먼저 만들고 paint 를 넘긴다 · 저장은 방 서버 방이면 서버 meta · 아니면 firebaseAPI.setRoomInfo');
  const paintCalls = (RE.match(/\b_roomChanged\(\);/g) || []).length;   // «방이 바뀜» 알림이 paintRoomInfo 를 부른다(같이 듣기도 같은 알림)
  chk(paintCalls === 3 && /function _roomChanged\(\)\{ paintRoomInfo\(\);/.test(RE) && /function refreshInviteUI\(\)\{[\s\S]*?_roomChanged\(\);[\s\S]*?\n\}/.test(RE), 'room-entry: 들어감 · 나감(refreshInviteUI) · Firebase meta · 방 서버 meta 세 곳에서 다시 그린다 (' + paintCalls + ')');
  {
    const fn = takeFn(FI, 'async setRoomInfo(room, info){');
    const writes = [], touched = [];
    const set = fn && new Function('update', 'ref', 'db', '_touchRoomIndex', 'return { ' + fn + ' };')((r, v) => { writes.push([r, v]); return Promise.resolve(); }, (d, p) => p, null, (r) => touched.push(r));
    const a = set && await set.setRoomInfo('COZY-AB12', { title: '새 제목', open: false });
    const b = set && await set.setRoomInfo('COZY-AB12', { title: '' });
    const c = set && await set.setRoomInfo('', { title: 'x' });
    chk(a && a.ok && writes[0][0] === 'rooms/COZY-AB12/_meta' && JSON.stringify(writes[0][1]) === '{"title":"새 제목","open":false}', '★ firebase-init setRoomInfo — _meta 에 update · 제목 · 공개 두 칸만');
    chk(b && b.ok && JSON.stringify(writes[1][1]) === '{"title":null}' && c && !c.ok && writes.length === 2, '  빈 제목은 칸 지움(null) · open 이 없으면 안 씀 · 방 코드가 없으면 안 씀');
    chk(touched.join() === 'COZY-AB12,COZY-AB12', '★ 저장하면 방 요약(roomIndex)을 바로 갱신 — 공개를 켜면 로비 · 랜덤 참여가 다음 하트비트를 안 기다린다');
    const ft = [];
    const failing = fn && new Function('update', 'ref', 'db', '_touchRoomIndex', 'return { ' + fn + ' };')(() => Promise.reject(new Error('denied')), (d, p) => p, null, (r) => ft.push(r));
    chk(failing && !(await failing.setRoomInfo('COZY-AB12', { title: 'x' })).ok && ft.length === 0, '  쓰기가 거부되면 { ok:false } · 요약도 안 건드림');
  }
  {
    const M = classic(M_SRC, 'TwRoomLobbyModel', { TwRoomSettings: RS });
    const c = M.cardOf('WORK-AA11', { t: '', n: 1, hn: '도토리' }, 10);
    chk(c.title === RS.displayTitle('', '도토리').text && c.titleIsDefault && /displayTitle\(r\.t, hn\)/.test(M_SRC), '로비 카드 제목도 같은 규칙(room-settings displayTitle)');
  }

  say('── 5. 깨 보기');
  {
    const noHost = UI_SRC.replace('$(\'riEdit\').hidden = !host;', '$(\'riEdit\').hidden = false;');
    const b1 = mkUi({ me: 'u2' }, noHost); b1.ui.paint();
    chk(noHost !== UI_SRC && !b1.el('riEdit').hidden, '방장 확인을 빼면 2절 «손님은 버튼이 숨는다» 가 빨강');
    const noBan = classic(RS_SRC.replace('if(title && !(bw && banned && bw.hasBannedWord(title, banned)))', 'if(title)'), 'TwRoomSettings');
    chk(noBan.displayTitle('바보방', '도토리', ['바보'], BW).text === '바보방', '금칙어 거르기를 빼면 1절 «금칙어 제목은 기본값» 이 빨강');
    const noSecret = UI_SRC.replace("if(!isSecretRoom()) info.open = $('riOpen').checked;", "info.open = $('riOpen').checked;");
    const b3 = mkUi({ code: 'SCRT-AB12' }, noSecret); b3.ui.paint(); b3.el('riEdit').onclick();
    await b3.el('riSave').onclick();
    chk(noSecret !== UI_SRC && ('open' in b3.log.saves[0][1]), '시크릿룸 거르기를 빼면 3절 «공개는 쓰지 않는다» 가 빨강');
    const noWhy = UI_SRC.replace('const why = res && SERVER_REFUSED_TEXT[res.code];', 'const why = null;');
    const b4 = mkUi({ save: async () => ({ ok: false, code: 'title' }) }, noWhy); b4.ui.paint(); b4.el('riEdit').onclick();
    await b4.el('riSave').onclick();
    chk(noWhy !== UI_SRC && b4.log.errors.join() === 'E-ROOM-04', '서버 거절 글을 빼면 3절 «칸 아래 글» 이 빨강');
    delete global.document;
  }

  say('');
  say('통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();

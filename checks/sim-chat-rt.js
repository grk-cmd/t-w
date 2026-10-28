/* sim-chat-rt.js — 💬 대화 포트(chat/chat-rt.js) 검사 — 가짜 연결(hub) · 가짜 API 로 그대로 돌린다
   ・1절: 줄 모양 — 서버 줄 → 앱 줄(uid · ts ms · 탭 앱 id · CLEAR → sys clr) · 모양이 틀리면 버림
   ・2절: 보내기 — chatSay{ requestId · tab S1 · text } · chatSaid 로 끝남 · 못 받으면 같은 requestId 로 한 번 더 · 거절 code · 방 밖이면 안 보냄 · 게임(주사위 탭 · 날리기는 탭 없음)
   ・3절: 지난 기록 — since 없으면 최근 쪽 · 있으면 ISO 시각으로 쪽 넘김(hasMore) · 받는 동안 온 줄도 · 못 받아도 onReady · 끊으면 안 부름
   ・4절: 방장 지우기 — chatClear{ tab } · 지우기 표시 줄이 오면 ok · CHAT_NOT_HOST 거절
   ・5절: 최근 줄 구독(안 읽은 수) · 내 이모티콘(slots → 칸 표 · PUT · DELETE)
   ・6절: 배선(html 차례 · firebase-init 이 대화 기록을 이 포트에 잇는다) · 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  CR: pick(at('chat-rt.js', 'chat')),
  RT: pick(at('room-rt.js', 'room')),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const loadCls = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };
/* 안 끝나는 약속(깨 본 판)은 200ms 뒤 '__hang' — node 가 조용히 빠지지 않게 */
const within = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r('__hang'), 200))]);
const tick = async () => { for(let i = 0; i < 20; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };

function mk(S, o){
  o = o || {};
  const R = loadCls(S.RT), C = loadCls(S.CR);
  const fns = {}, sent = [], gets = [], puts = [], dels = [], timers = [];
  const hub = { onMessage(t, fn){ (fns[t] = fns[t] || []).push(fn); }, send(m){ if(o.offline) return false; sent.push(m); return true; }, isReady: () => true };
  const emit = (m) => (fns[m.t] || []).forEach((f) => f(m));
  const api = {
    get: async (path, opts) => { gets.push([path, opts]); const h = o.get; if(typeof h === 'function') return h(path); if(h === undefined) throw Object.assign(new Error('down'), { kind: 'unavailable' }); return h; },
    put: async (path, body) => { puts.push([path, body]); if(o.putFail) throw Object.assign(new Error('x'), { code: o.putFail }); return null; },
    del: async (path) => { dels.push(path); return null; },
  };
  let room = o.room === undefined ? 'PLAY-AB12' : o.room, rid = 0;
  const c = C.createChatRt({ hub, api, roomCode: () => room, historyTabOf: R.historyTabOf, tabFromWire: R.tabFromWire, newRequestId: () => 'req-' + String(++rid).padStart(4, '0'),
    setTimeout: (f, ms) => { const h = { f, ms }; timers.push(h); return h; }, clearTimeout: (h) => { const i = timers.indexOf(h); if(i >= 0) timers.splice(i, 1); }, log: { warn(){} } });
  const fire = () => { const t = timers.shift(); if(t) t.f(); };
  return { C, R, c, emit, sent, gets, puts, dels, timers, fire, setRoom: (r) => { room = r; } };
}
const LINE = (id, o) => Object.assign({ id, tab: 'GENERAL', kind: 'TEXT', userCode: 'u2', name: '친구', text: '안녕', ts: '2026-10-29T01:00:00.000Z' }, o || {});

async function judge(S){
  say('── 1. 줄 모양');
  try{
    const e = mk(S);
    const m = e.C.lineFromWire(LINE('a1', { tab: 'S2', ts: '2026-10-29T01:00:00.000Z' }), e.R.tabFromWire);
    chk(m && m.id === 'a1' && m.uid === 'u2' && m.name === '친구' && m.ts === Date.parse('2026-10-29T01:00:00.000Z') && m.tab === 's2' && !m.sys, '서버 줄 → { id, uid(=userCode), name, text, ts(ms), tab(s2) }');
    const c = e.C.lineFromWire(LINE('c1', { kind: 'CLEAR', userCode: undefined, ts: 5 }), e.R.tabFromWire);
    chk(c && c.sys === 'clr' && c.uid === null && c.ts === 5 && c.tab === 'general', '  CLEAR → sys clr(지우기 표시 줄) · ts 숫자 그대로 · #일반');
    chk(e.C.lineFromWire({ tab: 'GENERAL' }, e.R.tabFromWire) === null && e.C.lineFromWire(null, e.R.tabFromWire) === null, '  id 없는 줄은 버린다');
  }catch(err){ chk(false, '1절 던짐 — ' + err.message); }

  say('── 2. 보내기');
  try{
    let e = mk(S);
    const p = e.c.sendText('PLAY-AB12', '안녕', 's1');
    const m = e.sent[0];
    chk(m && m.t === 'chatSay' && m.tab === 'S1' && m.text === '안녕' && /^[A-Za-z0-9_-]{8,64}$/.test(m.requestId), 'chatSay{ requestId · tab S1 · text }');
    e.emit({ t: 'chatSaid', requestId: m.requestId, line: LINE('L1', { userCode: 'u1', tab: 'S1', ts: 77 }) });
    const r = await within(p);
    chk(r && r.ok && r.id === 'L1' && r.ts === 77, '  chatSaid → { ok, id, ts }');
    e = mk(S);
    const p2 = e.c.sendText('PLAY-AB12', '다시', 'general');
    e.fire(); await tick();
    chk(e.sent.length === 2 && e.sent[1].requestId === e.sent[0].requestId && !('tab' in e.sent[0] && e.sent[0].tab !== 'GENERAL'), '★ chatSaid 를 못 받으면 같은 requestId 로 한 번 더(서버가 처음 줄을 돌려준다)');
    e.fire(); const r2 = await within(p2);
    chk(r2 && r2.ok === false && r2.code === 'timeout' && e.sent.length === 2, '  두 번 다 못 받으면 timeout — 끝없이 다시 보내지 않는다');
    e = mk(S);
    const p3 = e.c.sendText('PLAY-AB12', '글', 'general');
    e.emit({ t: 'error', code: 'CHAT_OFF', ref: 'chatSay', requestId: e.sent[0].requestId });
    const r3 = await within(p3);
    chk(r3 && r3.ok === false && r3.code === 'CHAT_OFF', '  거절은 { ok:false, code }(CHAT_OFF 등)');
    e = mk(S);
    const r4 = await e.c.sendText('WORK-ZZZZ', '다른 방', 'general');
    chk(r4.ok === false && r4.code === 'notInRoom' && e.sent.length === 0, '  지금 방이 아니면 보내지 않는다');
    e = mk(S, { offline: true });
    const r5 = await e.c.sendText('PLAY-AB12', '끊김', 'general');
    chk(r5.ok === false && r5.code === 'notReady', '  연결이 없으면 notReady');
    e = mk(S);
    e.c.sendGame('PLAY-AB12', { dice: [1, 6] }, 's2'); e.c.sendGame('PLAY-AB12', { fly: 'u9' }, 's2');
    chk(JSON.stringify(e.sent[0].game) === '{"dice":[1,6]}' && e.sent[0].tab === 'S2' && !e.sent[0].text && e.sent[1].game.fly === 'u9' && !('tab' in e.sent[1]),
      '게임 줄 — 주사위는 지금 탭 · 날리기는 탭 없이(서버가 #일반) · 문장은 서버가 만든다');
  }catch(err){ chk(false, '2절 던짐 — ' + err.message); }

  say('── 3. 지난 기록');
  try{
    let e = mk(S, { get: { lines: [LINE('a1', { ts: 1000 }), LINE('a2', { ts: 2000 })], hasMore: false } });
    const got = []; let ready = 0;
    const off = e.c.subscribeSince('PLAY-AB12', 's1', null, (m) => got.push(m.id), () => ready++);
    await tick();
    chk(/\/v1\/rooms\/PLAY-AB12\/chats\?tab=S1&limit=100$/.test(e.gets[0][0]) && e.gets[0][1].auth === true && got.join() === 'a1,a2' && ready === 1, 'since 없음 → 최근 쪽(tab=S1 · limit) · 줄마다 onMsg · 끝나면 onReady 한 번');
    e.emit({ t: 'chatLine', line: LINE('a3', { tab: 'S1', ts: 3000 }) });
    e.emit({ t: 'chatLine', line: LINE('x9', { tab: 'GENERAL', ts: 3000 }) });
    chk(got.join() === 'a1,a2,a3', '  그 뒤 그 탭의 chatLine 만 이어 받는다');
    off(); e.emit({ t: 'chatLine', line: LINE('a4', { tab: 'S1' }) });
    chk(got.length === 3, '  끊으면 안 부른다');
    let n = 0;
    e = mk(S, { get: (path) => { n++; return n === 1 ? { lines: [LINE('b1', { ts: 5000 }), LINE('b2', { ts: 6000 })], hasMore: true } : { lines: [LINE('b3', { ts: 7000 })], hasMore: false }; } });
    const got2 = [];
    e.c.subscribeSince('PLAY-AB12', 'general', 4000, (m) => got2.push(m.id), () => {});
    await tick();
    chk(e.gets.length === 2 && e.gets[0][0].indexOf('since=' + encodeURIComponent(new Date(4000).toISOString())) > 0 && e.gets[1][0].indexOf('since=' + encodeURIComponent(new Date(6000).toISOString())) > 0 && got2.join() === 'b1,b2,b3',
      '★ since → ISO 시각 · hasMore 면 마지막 줄 시각으로 다음 쪽');
    e = mk(S);
    let r6 = 0; const got3 = [];
    e.c.subscribeSince('PLAY-AB12', 'general', null, (m) => got3.push(m.id), () => r6++);
    await tick();
    chk(r6 === 1 && got3.length === 0, '  못 받아도 onReady — 화면이 «불러오는 중» 에 갇히지 않는다');
    e = mk(S, { room: 'PLAY-AB12', get: { lines: [], hasMore: false } });
    e.emit({ t: 'chatSaid', requestId: 'zzzzzzzz', line: LINE('s1', { tab: 'GENERAL' }) });
    const got4 = []; e.c.subscribeSince('PLAY-AB12', 'general', null, (m) => got4.push(m.id), () => {}); await tick();
    e.emit({ t: 'chatLine', line: LINE('s2', { tab: 'GENERAL' }) });
    chk(got4.join() === 's2', '  구독 전에 지나간 줄은 다시 안 넘긴다(기록은 GET 으로)');
  }catch(err){ chk(false, '3절 던짐 — ' + err.message); }

  say('── 4. 방장 지우기');
  try{
    let e = mk(S);
    const p = e.c.clear('PLAY-AB12', 's2');
    chk(e.sent[0] && e.sent[0].t === 'chatClear' && e.sent[0].tab === 'S2', 'chatClear{ tab S2 }');
    e.emit({ t: 'chatLine', line: LINE('c1', { kind: 'CLEAR', tab: 'S2' }) });
    chk((await within(p)).ok === true, '  지우기 표시 줄이 오면 ok(앱이 표시 줄을 따로 쓰지 않는다)');
    e = mk(S);
    const p2 = e.c.clear('PLAY-AB12', 'general');
    e.emit({ t: 'error', code: 'CHAT_NOT_HOST', ref: 'chatClear' });
    const r = await within(p2);
    chk(r.ok === false && r.code === 'CHAT_NOT_HOST', '  방장이 아니면 { ok:false, code:CHAT_NOT_HOST }');
  }catch(err){ chk(false, '4절 던짐 — ' + err.message); }

  say('── 5. 최근 줄 · 이모티콘');
  try{
    let e = mk(S, { get: { lines: [LINE('a1', { ts: 1 }), LINE('a2', { ts: 2 })], hasMore: false } });
    const seen = [];
    e.c.subscribeLog('PLAY-AB12', (l) => seen.push(l.map((m) => m.id).join()), 2, 'general');
    await tick();
    e.emit({ t: 'chatLine', line: LINE('a3', { ts: 3 }) });
    chk(e.gets[0][0].indexOf('limit=2') > 0 && seen[0] === 'a1,a2' && seen[1] === 'a2,a3', '최근 n 줄 목록 — 새 줄이 오면 앞을 밀어낸다(안 읽은 수 세기)');
    e = mk(S, { get: { slots: [{ slot: 0, cmd: 'ㅋㅋ', imageUrl: 'https://x/0.png', animated: false }, { slot: 3, cmd: 'gif', imageUrl: 'https://x/3.gif', animated: true }, { slot: 'x' }] } });
    const em = await e.c.getEmojis();
    chk(em[0].cmd === 'ㅋㅋ' && em[0].url === 'https://x/0.png' && em[3].gif === true && Object.keys(em).length === 2 && e.gets[0][0] === '/v1/me/emojis', '★ GET /v1/me/emojis 의 slots → { 칸: { cmd, url, gif } }(대화창이 읽던 모양)');
    const pr = await e.c.putEmoji(2, 'ㅎㅎ', 'https://x/2.png');
    await e.c.deleteEmoji(3);
    chk(pr.ok && e.puts[0][0] === '/v1/me/emojis/2' && JSON.stringify(e.puts[0][1]) === '{"cmd":"ㅎㅎ","imageUrl":"https://x/2.png"}' && e.dels[0] === '/v1/me/emojis/3', '  PUT /v1/me/emojis/{칸} { cmd, imageUrl } · DELETE');
    e = mk(S, { putFail: 'CHAT_EMOJI_IMAGE_INVALID' });
    const pf = await e.c.putEmoji(1, 'a', 'u');
    chk(pf.ok === false && pf.code === 'CHAT_EMOJI_IMAGE_INVALID', '  거절은 { ok:false, code }');
    chk(JSON.stringify(await mk(S).c.getEmojis()) === '{}', '  못 받으면 빈 표');
  }catch(err){ chk(false, '5절 던짐 — ' + err.message); }

  say('── 6. 배선');
  const h = S.HTML, i = (f) => h.indexOf('<script src="parts/' + f + '"></script>');
  chk(i('chat/chat-rt.js') > i('room/room-rt.js') && i('chat/chat-rt.js') > i('shared/api-client.js') && i('chat/chat-rt.js') > i('shared/request-id.js') && i('app.js') > i('chat/chat-rt.js'), 'html — room-rt · api-client · request-id → chat-rt → app.js');
  chk(/subscribeSince: \(room, tab, since, onMsg, onReady\) => window\.TwChatRt\.store\.subscribeSince\(/.test(S.FI) && /clearLog: \(room, tab\) => window\.TwChatRt\.store\.clear\(room, tab\)/.test(S.FI)
    && !/sendChatLog|subscribeChatLog|subscribeChatSince|clearChatLog|_chatTab\//.test(S.FI), 'firebase-init — 대화 기록을 이 포트에 잇는다 · Firebase 대화 길(chatLog · _chatTab)이 없다');
}

(async () => {
await judge(SRC0);
say('── 7. 일부러 깨 보기');
const BREAKS = [
  ['CR', "        timer = tSet(() => { if(tries < SAY_TRIES) attempt(); else w.done({ ok: false, code: 'timeout' }); }, SAY_WAIT_MS);", "        timer = tSet(() => { w.done({ ok: false, code: 'timeout' }); }, SAY_WAIT_MS);", '못 받으면 다시 안 보냄'],
  ['CR', "            at = p.lines[p.lines.length - 1].ts;", "            at = since;", '쪽 넘김이 같은 자리를 다시 받음'],
  ['CR', "  if(line.kind === 'CLEAR') m.sys = CLEAR_SYS;", "", '지우기 표시 줄을 모름'],
  ['CR', "    if(game && game.dice) body.tab = deps.historyTabOf(appTab);   // 날리기는 늘 #일반(서버)", "    body.tab = deps.historyTabOf(appTab);", '날리기에도 탭'],
  ['CR', "      for(const e of ((d && Array.isArray(d.slots)) ? d.slots : [])){", "      for(const e of ((d && Array.isArray(d.emojis)) ? d.emojis : [])){", '이모티콘 칸 이름이 서버와 다름'],
  ['HTML', '<script src="parts/chat/chat-rt.js"></script>', '', 'html 에 안 실음'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ await judge(S); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));
console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

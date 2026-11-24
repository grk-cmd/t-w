/* ═══ 🎁 sim-mallang-sent.js — 보낸 말랑이 확인(B-1015-1) ═══════════════════════════════
   ・1절: 규칙(mallang-sent.js) — 기록 모양 씻기 · 최근 순서 · 30개 넘는 옛 기록 · 같은 친구에게 같은 그림을 보낸 적 · mutation test
   ・2절: 서버 규칙 — users/$uid/mallangSent 는 주인만 · 규칙식을 실제로 굴려 앱이 만드는 기록은 통과 · 코드 모양 · Storage 밖 · 모르는 칸 · 길이 초과는 거절 · mutation test
   ・보내기 화면(«보냄» 표시 · 다시 보낼 때 묻기)과 선물함 «보낸 선물» 서브탭은 0.13 합치기에서 걷었다 — 서버가 보낸 기록을 받으면(#1103) 화면과 그 시험을 되살린다
   [실행] node checks/run.js mallang-sent */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (names) => { for(const d of [__dirname, process.cwd()]) for(const n of names){ const p = path.join(d, n); if(fs.existsSync(p)) return p; } return null; };
const read = (names) => { const p = find(names); return p ? fs.readFileSync(p, 'utf8') : null; };
const P_MS = find(['mallang-sent.js', 'parts/myhome/mallang-sent.js']);
const SRC = {
  mallang: read(['mallang.js', 'parts/myhome/mallang.js']), inbox: read(['myhome-inbox.js', 'parts/myhome/myhome-inbox.js']),
  rules: read(['firebase-database-rules.json', 'firebase/firebase-database-rules.json']), fb: read(['firebase-init.js', 'parts/firebase-init.js']),
  html: read(['desk-companion-prototype.html']),
};
if(!P_MS || Object.values(SRC).some(v => v == null)){ say('  ? 원본 못 찾음 — mallang-sent.js · ' + Object.keys(SRC).filter(k => SRC[k] == null).join(' · ')); process.exit(2); }
const MS = require(P_MS);
const MS_SRC = fs.readFileSync(P_MS, 'utf8');
const ST = 'https://firebasestorage.googleapis.com/v0/b/x/o/';
const U = 'uabcdef1234';

say('── 1. 규칙');
chk(JSON.stringify(MS.record({ to: U, toName: '  민트 ', src: ST + 'a', img: ST + 'g', ts: 5, msg: ' 안녕 ' })) === JSON.stringify({ to: U, src: ST + 'a', ts: 5, toName: '민트', img: ST + 'g', msg: '안녕' }),
  '기록 모양 — to · src · ts + 이름 · 그림 · 메시지(앞뒤 빈칸 뗌)');
chk(MS.record({ to: 'evil', src: ST + 'a', ts: 5 }) === null && MS.record({ to: U, src: 'https://evil.com/a.png', ts: 5 }) === null && MS.record({ to: U, src: ST + 'a', ts: 0 }) === null
  && !('img' in MS.record({ to: U, src: ST + 'a', img: 'data:x', ts: 1 })), '★ 친구 코드 · 그림 주소(Storage 만) · 시각이 안 맞으면 남기지 않는다 — 사본 주소가 이상하면 그림만 뺀다');
chk(MS.record({ to: U, src: ST, ts: 1, toName: 'x'.repeat(30), msg: 'y'.repeat(80) }).toName.length === 20 && MS.record({ to: U, src: ST, ts: 1, msg: 'y'.repeat(80) }).msg.length === 50, '이름 20자 · 메시지 50자(서버 규칙과 같다)');
const many = {}; for(let i = 1; i <= 33; i++) many['g' + i] = { to: U, src: ST + (i % 3), ts: i };
many.bad = { to: 'x' };
chk(MS.list(many).length === 33 && MS.list(many)[0].id === 'g33' && MS.list(null).length === 0, '최근 것부터 · 깨진 줄은 뺀다 · 없음은 빈 목록');
chk(JSON.stringify(MS.overflow(many)) === '["g3","g2","g1"]' && MS.overflow({}).length === 0 && MS.SENT_MAX === 30, '★ 30개를 넘는 옛 기록 셋 — 보낸 뒤 지울 것');
chk(MS.lastTo(many, U, ST + '1').id === 'g31' && MS.lastTo(many, 'uzzzzzzzz9', ST + '1') === null && MS.lastTo(null, U, ST + '1') === null && MS.lastTo(many, U, '') === null,
  '★ 같은 친구 · 같은 그림의 가장 최근 기록 · 다른 친구 · 못 읽음(null)은 없음');
{ const broke = MS_SRC.replace('return list(obj).find(r => r.to === to && r.src === src) || null;', 'return list(obj).find(r => r.src === src) || null;');
  const m = { exports: {} }; new Function('module', 'window', broke)(m, undefined);
  chk(broke !== MS_SRC && m.exports.lastTo(many, 'uzzzzzzzz9', ST + '1') !== null, '  mutation test — 친구를 안 가르면 다른 친구에게 보낸 그림도 «보냄» 이 된다'); }

say('── 2. 서버 규칙');
{
  const R = JSON.parse(SRC.rules).rules.users.$userId.mallangSent || {}, g = R.$giftId || {};
  chk(R['.validate'] === 'newData.hasChildren()' && /userAuth/.test(R['.write'] || '') && /hasChildren\(\['to', 'src', 'ts'\]\)/.test(g['.validate'] || '') && /\[uU\]\[0-9a-zA-Z\]\{8,40\}/.test((g.to || {})['.validate'] || ''),
    '주인만 쓰기 · 노드 통째 글자 거절 · to · src · ts 가 있어야 · to 는 친구 코드 모양');
  chk(['src', 'img'].every(k => /beginsWith\('https:\/\/firebasestorage\.googleapis\.com\/'\)/.test((g[k] || {})['.validate'] || '')) && /<= 20/.test((g.toName || {})['.validate'] || '')
    && /<= 50/.test((g.msg || {})['.validate'] || '') && (g.$other || {})['.validate'] === false, '그림 주소는 Storage 만 · 이름 20 · 메시지 50 · 다른 칸 거절');
  /* ★ 규칙식을 실제로 굴린다 — 앱이 만드는 기록(record)이 통과하고, 거절돼야 할 것이 거절되는지(«규칙을 실제 모양으로 시험» — 같은 말랑이 경로에서 난 사고) */
  const toJs = (src) => String(src || 'false')
    .replace(/\$giftId\.matches\(/g, 'RX(k, ').replace(/\$giftId\.beginsWith\(/g, 'k.startsWith(').replace(/\$giftId\.endsWith\(/g, 'k.endsWith(')
    .replace(/newData\.hasChildren\((\[[^\]]*\])\)/g, '$1.every(c => v && typeof v === "object" && c in v)')
    .replace(/newData\.isString\(\)/g, "(typeof v === 'string')").replace(/newData\.isNumber\(\)/g, "(typeof v === 'number')")
    .replace(/newData\.val\(\)\.matches\(/g, 'RX(v, ').replace(/newData\.val\(\)\.beginsWith\(/g, 'v.startsWith(').replace(/newData\.val\(\)/g, 'v');
  const fnOf = (src) => { const f = new Function('RX', 'k', 'v', 'return (' + toJs(src) + ');'); return (k, v) => { try{ return !!f((x, re) => re.test(x), k, v); }catch(_){ return false; } }; };
  const rulePass = (rules, id, rec) => {
    const gg = rules.$giftId || {};
    if(!fnOf(gg['.validate'])(id, rec)) return false;
    return Object.keys(rec).every(c => (c in gg && c !== '$other') ? fnOf(gg[c]['.validate'])(id, rec[c]) : ((gg.$other || {})['.validate'] !== false));
  };
  const longest = MS.record({ to: U, toName: '가'.repeat(30), src: ST + 'a', img: ST + 'g', ts: Date.now(), msg: '나'.repeat(80) });
  const bare = MS.record({ to: U, src: ST + 'a', ts: 1 });
  chk(rulePass(R, '-Nabc_1', longest) && rulePass(R, '-Nabc_2', bare), '★ 앱이 만드는 기록은 규칙을 통과한다(이름 20 · 메시지 50 경계 · 그림 · 이름 없는 기록)');
  const bad = [['친구 코드 모양 틀림', { to: 'evil', src: ST + 'a', ts: 1 }], ['Storage 밖 그림', { to: U, src: 'https://evil.com/a', ts: 1 }],
    ['모르는 칸', { to: U, src: ST + 'a', ts: 1, x: 1 }], ['시각 0', { to: U, src: ST + 'a', ts: 0 }], ['src 없음', { to: U, ts: 1 }],
    ['이름 21자', { to: U, src: ST + 'a', ts: 1, toName: 'x'.repeat(21) }], ['메시지 51자', { to: U, src: ST + 'a', ts: 1, msg: 'x'.repeat(51) }]];
  const leaked = bad.filter(([, r]) => rulePass(R, '-Nabc_3', r)).map(([n]) => n);
  chk(!leaked.length && !rulePass(R, 'null', bare) && !rulePass(R, ' x', bare), '거절 — 코드 모양 · Storage 밖 · 모르는 칸 · 시각 0 · src 없음 · 길이 초과 · 사고 키' + (leaked.length ? ' — 통과해 버림: ' + leaked.join(', ') : ''));
  { const R2 = JSON.parse(JSON.stringify(R)); delete R2.$giftId.$other;
    chk(rulePass(R2, '-Nabc_4', { to: U, src: ST + 'a', ts: 1, x: 1 }), '  mutation test — 규칙에서 «다른 칸 거절» 을 빼면 모르는 칸이 통과한다(위 거절 줄이 빨강)'); }
  /* 🚧 0.13 은 Firebase DB 쓰기를 잠갔다 — 보낸 말랑이 기록은 서버 길이 생길 때까지 잇지 않는다(서버 작업 요청 이슈). 규칙 · 기록 모양(위)은 서버 이관의 기준으로 남긴다 */
  chk(!/MallangSent/.test(SRC.fb) && !/firebaseAPI\.(get|add)MallangSent/.test(SRC.mallang + SRC.inbox), 'firebase-init.js 에 보낸 말랑이 통로가 없고(0.13) · 말랑이 · 수령함이 그 통로를 부르지 않는다(서버 이관 대기)');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

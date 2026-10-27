/* sim-group-invite.js — 🎟️ 여러 명이 쓰는 초대 코드(app/parts/account/group-invite.js)
   실행: node sim-group-invite.js  (group-invite.js · firebase-init.js · firebase-database-rules.json 과 같은 폴더에서)

   [무엇을 보는가] 모듈을 그대로 불러 가짜 서버로 돌린다. 가짜 서버는 규칙(groupInvites · groupInviteUses · groupInviteTokens)이
     받는 것만 받는다 — usedCount 는 +1 만 · 그 번호 칸 · 색인이 같이 와야 · 인원 · 마감 · 중지. 실제 규칙 판정은
     firebase/scripts/rules-emu-check.js(에뮬레이터)가 본다.
   1. 마감 판정(closedReason) 경계값  2. 한 사람 · 재시도 · 다 참 · 마감 · 중지 · 없는 코드  3. 몰렸을 때 — 인원만큼만 들어온다
   4. 마무리(uid 기록 · 남의 토큰)  5. firebase-init 연결 — 한 명짜리에 없을 때만 넘기고, 가입 칸 · 카운터는 한 번  6. 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const need = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } };
const GI_SRC = need('group-invite.js'), FI = need('firebase-init.js');
const load = (src) => new Function(src.replace(/^export function /mg, 'function ') + '\nreturn { createGroupInvite, closedReason };')();
const GI = load(GI_SRC);

const CODE = 'GRUP-AB12-CD34';
const NOW = 1_800_000_000_000;
const tok = (i) => 't' + String(i).padStart(16, '0');
const denied = () => Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' });

/* 규칙이 받는 것만 받는 가짜 서버. get 은 다음 틱에 돌려줘서 여러 기기가 같은 값을 읽고 부딪히게 한다. */
function makeServer(seed, o = {}){
  const T = JSON.parse(JSON.stringify(seed || {}));
  const log = { updates: 0, denied: 0 };
  const at = (p) => p.split('/').reduce((x, k) => (x == null ? undefined : x[k]), T);
  const put = (p, v) => { const ks = p.split('/'); let x = T; ks.slice(0, -1).forEach(k => { x[k] = x[k] || {}; x = x[k]; }); x[ks.at(-1)] = v; };
  const tick = () => new Promise((r) => setTimeout(r, 1));   // 한 번 오가는 데 1ms — 아래 쉬기는 진짜의 1/10(0~40ms)
  const api = {
    db: {},
    ref: (_d, p) => ({ path: p || '' }),
    get: async (r) => { await tick(); const v = at(r.path); const c = v === undefined ? null : JSON.parse(JSON.stringify(v)); return { val: () => c, exists: () => c !== null }; },
    runTransaction: async (r, fn) => { const cur = at(r.path); const nv = fn(cur === undefined ? null : JSON.parse(JSON.stringify(cur))); if(nv === undefined) return { committed: false, snapshot: { val: () => cur } }; put(r.path, nv); return { committed: true, snapshot: { val: () => nv } }; },
    update: async (r, v) => {
      await tick();
      log.updates++;
      if(o.offline) throw new Error('network down');
      if(r.path === ''){
        const keys = Object.keys(v);
        const cnt = keys.filter(k => /^groupInvites\/[^/]+\/usedCount$/.test(k));
        for(const k of cnt){
          const code = k.split('/')[1], head = at('groupInvites/' + code), n = v[k];
          const ok = head && n === head.usedCount + 1 && n <= head.maxUses && !head.stoppedAt && !(typeof head.expiresAt === 'number' && head.expiresAt <= (o.serverNow || o.now || NOW))
            && at(`groupInviteUses/${code}/${n}`) === undefined && v[`groupInviteUses/${code}/${n}`]
            && v[`groupInviteTokens/${code}/${v[`groupInviteUses/${code}/${n}`].token}`] === n
            && at(`groupInviteTokens/${code}/${v[`groupInviteUses/${code}/${n}`].token}`) === undefined
            && keys.length === 3;
          if(!ok){ log.denied++; throw denied(); }
        }
        for(const k of keys) put(k, v[k]);
        return;
      }
      if(/^groupInviteUses\/[^/]+\/\d+$/.test(r.path) && 'uid' in v){
        const slot = at(r.path);
        if(!slot || slot.uid || o.uidDenied){ log.denied++; throw denied(); }
      }
      put(r.path, Object.assign({}, at(r.path) || {}, v));
    },
  };
  const gi = (src) => (src || GI).createGroupInvite({ db: api.db, ref: api.ref, get: api.get, update: api.update, now: () => o.now || NOW, wait: (ms) => new Promise((r) => setTimeout(r, ms / 10)) });
  return { T, api, log, gi };
}
const head = (x) => Object.assign({ issuedBy: 'admin', createdAt: 1, maxUses: 3, usedCount: 0 }, x);
const seed = (x) => ({ groupInvites: { [CODE]: head(x) } });

(async () => {
  say('【1】 마감 판정 — 경계값');
  {
    const c = GI.closedReason;
    chk(c(head({ usedCount: 2 }), NOW) === null, '3명 중 2명 → 열림');
    chk(/다 찬/.test(c(head({ usedCount: 3 }), NOW)), '3명 중 3명 → 다 참');
    chk(/다 찬/.test(c(head({ usedCount: 4 }), NOW)), '넘친 값(4/3)도 다 참');
    chk(/다 찬/.test(c(head({ maxUses: undefined }), NOW)), '인원 칸이 없으면 닫힘(열어 두지 않음)');
    chk(c(head({ expiresAt: NOW + 1 }), NOW) === null, '마감 1ms 전 → 열림');
    chk(/기간이 지난/.test(c(head({ expiresAt: NOW }), NOW)), '마감 시각 그때 → 닫힘(규칙 expiresAt > now 와 같게)');
    chk(/중지된/.test(c(head({ stoppedAt: 5, usedCount: 0 }), NOW)), '중지 → 닫힘(인원이 남아도)');
    chk(c(head({ expiresAt: undefined }), NOW) === null, '마감 없음 → 인원만 본다');
  }

  say('\n【2】 한 사람 · 재시도 · 닫힌 코드');
  {
    const S = makeServer(seed());
    const g = S.gi();
    const r1 = await g.redeem(CODE, tok(1));
    chk(r1.ok && r1.issuedBy === 'admin', '첫 사람 → ok · issuedBy');
    chk(S.T.groupInvites[CODE].usedCount === 1 && S.T.groupInviteUses[CODE][1].token === tok(1) && S.T.groupInviteTokens[CODE][tok(1)] === 1, '숫자 1 · 1번 칸 · 색인 한 묶음');
    chk(typeof S.T.groupInviteUses[CODE][1].at === 'number', '칸에 들어온 시각');
    const r2 = await g.redeem(CODE, tok(1));
    chk(r2.ok && S.T.groupInvites[CODE].usedCount === 1, '같은 기기 재시도 → 통과 · 숫자는 그대로');
    chk(!JSON.stringify(S.T).includes('"users"') && !S.T.stats, 'users/ · stats/ 에 안 쓴다(가입 마무리 몫)');
  }
  {
    const S = makeServer(seed({ usedCount: 3 }));
    S.T.groupInviteTokens = { [CODE]: { [tok(9)]: 3 } };
    const g = S.gi();
    const full = await g.redeem(CODE, tok(1));
    chk(!full.ok && /다 찬/.test(full.reason) && S.log.updates === 0, '다 찬 코드 → 거절 · 쓰기 0');
    const again = await g.redeem(CODE, tok(9));
    chk(again.ok, '다 찬 뒤에도 이미 들어온 기기의 재시도는 통과(가입 도중 끊긴 판)');
  }
  {
    const S = makeServer(seed({ expiresAt: NOW - 1 }));
    const r = await S.gi().redeem(CODE, tok(1));
    chk(!r.ok && /기간이 지난/.test(r.reason) && S.log.updates === 0, '마감 지난 코드 → 거절 · 쓰기 0');
  }
  {
    const S = makeServer(seed({ stoppedAt: 1 }));
    const r = await S.gi().redeem(CODE, tok(1));
    chk(!r.ok && /중지된/.test(r.reason), '중지된 코드 → 거절');
  }
  {
    const S = makeServer({});
    const r = await S.gi().redeem(CODE, tok(1));
    chk(!r.ok && /존재하지 않는/.test(r.reason), '없는 코드 → «존재하지 않는 초대 코드»');
  }
  {
    const S = makeServer(seed(), { offline: true });
    let threw = null; try{ await S.gi().redeem(CODE, tok(1)); }catch(e){ threw = e; }
    chk(threw && /network/.test(threw.message), '거절이 아닌 오류(네트워크)는 다시 하지 않고 위로 — firebase-init 이 «네트워크 오류» 로');
  }
  {
    // 읽은 뒤 관리자가 중지 — 부딪혀 다시 읽으면 중지를 본다
    const S = makeServer(seed());
    const get0 = S.api.get;
    S.api.get = async (r) => { const v = await get0(r); if(/^groupInvites\//.test(r.path)) S.T.groupInvites[CODE].stoppedAt = 9; return v; };
    const r = await S.gi().redeem(CODE, tok(1));
    chk(!r.ok && /중지된/.test(r.reason) && S.log.denied === 1, '읽은 뒤 중지됨 → 서버가 거절 · 다시 읽고 «중지된»');
  }
  {
    // 기기 시계가 늦어 앱은 «열림» 인데 서버 시각으로는 마감이 지난 판
    const S = makeServer(seed({ expiresAt: NOW + 1000 }), { serverNow: NOW + 2000 });
    const r = await S.gi().redeem(CODE, tok(1));
    chk(!r.ok && /기간이 지난/.test(r.reason) && S.log.denied === 1, '기기 시계가 늦음 → 서버가 거절 · 숫자가 그대로라 다시 하지 않고 «기간이 지난»');
  }
  {
    // 마감 없는 코드인데 숫자가 그대로인 거절(규칙이 막은 다른 까닭) — 엉뚱한 «몰려» 대신 바로 끝
    const S = makeServer(seed());
    const g = GI.createGroupInvite({ db: {}, ref: S.api.ref, get: S.api.get, update: async () => { throw denied(); }, now: () => NOW, wait: async () => {} });
    const r = await g.redeem(CODE, tok(1));
    chk(!r.ok && /사용할 수 없어요/.test(r.reason), '부딪힘이 아닌 거절 → 한 번에 «사용할 수 없어요»');
  }

  say('\n【3】 몰렸을 때 — 인원만큼만');
  {
    const S = makeServer(seed({ maxUses: 25 }));
    const g = S.gi();
    const rs = await Promise.all(Array.from({ length: 30 }, (_, i) => g.redeem(CODE, tok(i + 1))));   // 다 같이 같은 머리를 읽는다
    const ok = rs.filter(r => r.ok).length, full = rs.filter(r => !r.ok && /다 찬/.test(r.reason)).length;
    chk(ok === 25 && full === 5, `30명이 한꺼번에 · 인원 25 → 들어옴 ${ok} · 다 참 ${full}`);
    const slots = Object.keys(S.T.groupInviteUses[CODE]).map(Number).sort((a, b) => a - b);
    chk(S.T.groupInvites[CODE].usedCount === 25 && slots.length === 25 && slots[0] === 1 && slots[24] === 25, '숫자 25 · 칸 1~25 빈틈 없음');
    const toks = new Set(slots.map(n => S.T.groupInviteUses[CODE][n].token));
    chk(toks.size === 25 && [...toks].every(t => S.T.groupInviteTokens[CODE][t] >= 1), '칸마다 다른 기기 · 색인이 칸을 가리킴');
    chk(S.log.denied > 0, `부딪힌 쓰기는 서버가 거절했다(거절 ${S.log.denied}번)`);
  }
  {
    // 늘 부딪히면 끝없이 돌지 않는다
    // 다시 읽을 때마다 남이 한 자리씩 가져간 판
    const S = makeServer(seed({ maxUses: 100 }));
    let n = 0;
    const get = async (r) => { if(/^groupInvites\//.test(r.path)) S.T.groupInvites[CODE].usedCount++; return S.api.get(r); };
    const g = GI.createGroupInvite({ db: {}, ref: S.api.ref, get, update: async () => { n++; throw denied(); }, now: () => NOW, wait: async () => {} });
    const r = await g.redeem(CODE, tok(1));
    chk(!r.ok && /몰려/.test(r.reason) && n > 1 && n <= 20, `늘 남에게 밀리면 ${n}번 뒤 «사람이 몰려» 로 끝난다`);
  }

  say('\n【4】 마무리 — uid 기록');
  {
    const S = makeServer(seed());
    const g = S.gi();
    await g.redeem(CODE, tok(1));
    const f = await g.finish(CODE, tok(1), 'unewuser0001');
    chk(f.ok && f.issuedBy === 'admin' && S.T.groupInviteUses[CODE][1].uid === 'unewuser0001', '내 칸에 uid · issuedBy 돌려줌');
    const f2 = await g.finish(CODE, tok(1), 'unewuser0001');
    chk(f2.ok, '다시 불러도 ok(이미 적힌 uid 는 규칙이 막지만 가입은 끝낸다)');
    const bad = await g.finish(CODE, tok(7), 'unewuser0002');
    chk(!bad.ok && !Object.values(S.T.groupInviteUses[CODE]).some(s => s.uid === 'unewuser0002'), '들어온 적 없는 토큰 → 실패 · 아무 칸도 안 바뀜');
    const gone = await g.finish('GRUP-ZZZZ-ZZZZ', tok(1), 'unewuser0001');
    chk(!gone.ok, '코드가 지워졌으면 실패(토큰은 남아 다음 부팅에 다시)');
  }
  {
    const S = makeServer(seed(), { uidDenied: true });
    const g = S.gi();
    await g.redeem(CODE, tok(1));
    const f = await g.finish(CODE, tok(1), 'unewuser0001');
    chk(f.ok && !S.T.groupInviteUses[CODE][1].uid, 'uid 쓰기가 거절돼도(로그인 전) 가입은 끝낸다');
  }

  say('\n【5】 firebase-init 연결');
  {
    const a = FI.indexOf('    async redeemInvite('), b = FI.indexOf('    // 초대장 발급 — 유저는 invitesLeft를 1 차감');
    chk(a > 0 && b > a, 'redeemInvite ~ issueInvite 앞을 떼어 올 수 있다');
    chk(/import \{ createGroupInvite \} from "\.\/account\/group-invite\.js";/.test(FI) && /const _groupInvite = createGroupInvite\(\{ db, ref, get, update \}\);/.test(FI), '모듈을 들여와 db · ref · get · update 로 만든다');
    const methods = FI.slice(a, b);
    const run = (seedData) => {
      const S = makeServer(seedData);
      const o = (new Function('db', 'ref', 'get', 'runTransaction', 'update', '_groupInvite', 'return ({\n' + methods + '\n});'))(S.api.db, S.api.ref, S.api.get, S.api.runTransaction, S.api.update, S.gi());
      return { S, o };
    };
    {
      const { S, o } = run(Object.assign(seed(), { stats: { userCount: 10 } }));
      const r = await o.redeemInvite(CODE, tok(1));
      chk(r.ok && r.issuedBy === 'admin' && S.T.groupInvites[CODE].usedCount === 1, '한 명짜리에 없는 코드 → 여러 명짜리로 소진');
      chk(!S.T.invites, 'invites/ 에는 아무것도 안 만든다');
      const f = await o.finishInviteSignup(CODE, tok(1), 'unewuser0001');
      const iv = S.T.users && S.T.users.unewuser0001 && S.T.users.unewuser0001.invite;
      chk(f.ok && iv && iv.invitesLeft === 0 && iv.invitedBy === 'admin' && S.T.stats.userCount === 11, '마무리 → 0장 · invitedBy admin · 가입 수 +1');
      const f2 = await o.finishInviteSignup(CODE, tok(1), 'unewuser0001');
      chk(f2.ok && S.T.stats.userCount === 11, '두 번 불러도 가입 수는 한 번');
      const bad = await o.finishInviteSignup(CODE, tok(5), 'unewuser0005');
      chk(!bad.ok && !(S.T.users || {}).unewuser0005, '남의 토큰으로 마무리 → 실패 · 가입 칸 없음');
    }
    {
      // 같은 이름이 양쪽에 있으면 한 명짜리가 먼저(예전 코드 그대로)
      const { S, o } = run(Object.assign(seed(), { invites: { [CODE]: { issuedBy: 'uissuer0001', createdAt: 1 } } }));
      const r = await o.redeemInvite(CODE, tok(1));
      chk(r.ok && r.issuedBy === 'uissuer0001' && S.T.groupInvites[CODE].usedCount === 0, '한 명짜리 코드가 있으면 그쪽만 쓴다');
    }
    {
      const { o } = run({});
      const r = await o.redeemInvite('INVT-ZZZZ-ZZZZ', tok(1));
      chk(!r.ok && /존재하지 않는/.test(r.reason), '어디에도 없는 코드 → «존재하지 않는 초대 코드»');
    }
  }

  say('\n【5-2】 규칙 — 같은 이름의 한 명짜리로 덮지 못한다');
  {
    // 앱은 invites/{code} 를 먼저 본다 — 누가 같은 이름의 한 명짜리를 만들면 여러 명 코드 전체가 «이미 사용된» 이 된다.
    // 서버 판정은 firebase/scripts/rules-emu-check.js(에뮬레이터)가 보고, 여기서는 그 조건이 규칙에서 빠지지 않았는지만 본다.
    const R = JSON.parse(need('firebase-database-rules.json')).rules;
    chk(String(R.invites.$code['.validate']).includes("!root.child('groupInvites/'+$code).exists()"), 'invites/$code 는 같은 이름의 groupInvites 가 있으면 거절');
  }

  say('\n【6】 깨 보기');
  {
    const broken = load(GI_SRC.replace("const why = closedReason(v, now());", 'const why = null;'));
    const S = makeServer(seed({ usedCount: 3 }));
    const r = await S.gi(broken).redeem(CODE, tok(1));
    chk(!r.ok && S.log.denied > 0, '마감 판정을 빼도 서버가 받지 않는다(규칙이 마지막 막) — 앱은 «몰려» 로 끝남');
    const broken2 = load(GI_SRC.replace("if(await readSlot(code, token) != null)", 'if(false)'));
    const S2 = makeServer(seed());
    const g = S2.gi(broken2);
    await g.redeem(CODE, tok(1));
    const again = await g.redeem(CODE, tok(1));
    chk(!again.ok && S2.T.groupInvites[CODE].usedCount === 1, '재시도 색인 확인을 빼면 같은 기기의 재시도가 떨어진다(원본은 2절에서 통과) — 서버는 색인 덮어쓰기를 막아 숫자는 그대로');
    const broken3 = load(GI_SRC.replace('if(!isDenied(e)) throw e;', 'throw e;'));
    const S3 = makeServer(seed({ maxUses: 5 }));
    const g3 = S3.gi(broken3);
    const rs = await Promise.all(Array.from({ length: 5 }, (_, i) => g3.redeem(CODE, tok(i + 1)).catch(() => ({ ok: false }))));
    chk(rs.filter(r => r.ok).length < 5, '부딪힘 다시 하기를 빼면 자리가 남는데도 떨어진다 — 3절이 이것을 잡는다');
  }

  say(`\n통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

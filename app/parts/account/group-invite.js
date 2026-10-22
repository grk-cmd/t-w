/*
 * 여러 명이 쓰는 초대 코드 — 관리자가 웹 관리자에서 «n명까지 · 마감 날짜» 로 만든다. 일반 사용자 코드(invites/{code})는 한 명씩 그대로다.
 * firebase-init 의 redeemInvite · finishInviteSignup 이 invites/{code} 에 없는 코드일 때만 여기로 넘긴다.
 *
 * 모양(규칙 groupInvites · groupInviteUses · groupInviteTokens):
 *   groupInvites/{code}              = { issuedBy, createdAt, maxUses, usedCount, expiresAt?, stoppedAt?, note? }
 *   groupInviteUses/{code}/{n}       = { token, at, uid? }   n 번째로 들어온 기기 — uid 는 가입이 끝난 뒤
 *   groupInviteTokens/{code}/{token} = n                     같은 기기의 재시도를 찾는 색인
 * 한 사람 = usedCount +1 · 칸 n · 색인 셋을 한 묶음 update 로 쓴다. 규칙이 셋이 맞물릴 때만 받아서 인원을 넘길 수 없다.
 * 두 기기가 같은 n 을 잡으면 늦은 쪽이 거절(permission_denied)되고, 조금 쉬었다 새로 읽어 다음 n 으로 다시 한다
 * (쉬는 시간을 흩뜨려야 몰린 기기들이 같은 순간에 또 부딪히지 않는다). 다시 읽었는데 숫자가 그대로면 남과 부딪힌 게 아니라
 * 서버가 막은 것(마감은 서버 시각으로 본다 — 기기 시계가 늦은 판)이라 다시 하지 않는다.
 */
const TRIES = 12;
const WAIT_MAX_MS = 400;

export function closedReason(head, now){
  if(head.stoppedAt) return '중지된 초대 코드예요';
  if(typeof head.expiresAt === 'number' && head.expiresAt <= now) return '기간이 지난 초대 코드예요';
  if(!(head.usedCount < head.maxUses)) return '인원이 다 찬 초대 코드예요';
  return null;
}

function isDenied(e){
  return !!e && e.code === 'PERMISSION_DENIED';
}

/**
 * @param {{ db: object, ref: (db: object, path?: string) => object, get: (ref: object) => Promise<{ val: () => any }>,
 *   update: (ref: object, value: object) => Promise<void>, now?: () => number, wait?: (ms: number) => Promise<void> }} deps
 *   now · wait 는 테스트용 — 기본 Date.now · setTimeout
 */
export function createGroupInvite(deps){
  const { db, ref, get, update } = deps;
  const now = deps.now || (() => Date.now());
  const wait = deps.wait || ((ms) => new Promise((r) => setTimeout(r, ms)));

  const readHead = async (code) => (await get(ref(db, `groupInvites/${code}`))).val();
  const readSlot = async (code, token) => {
    const n = (await get(ref(db, `groupInviteTokens/${code}/${token}`))).val();
    return typeof n === 'number' ? n : null;
  };

  async function redeem(code, token){
    const head = await readHead(code);
    if(!head) return { ok:false, reason:'존재하지 않는 초대 코드예요' };
    // 이미 들어온 기기의 재시도(가입 도중 끊긴 판)는 마감 · 인원과 상관없이 통과
    if(await readSlot(code, token) != null) return { ok:true, issuedBy: head.issuedBy || null };
    let v = head;
    for(let i = 0; i < TRIES; i++){
      if(!v) return { ok:false, reason:'존재하지 않는 초대 코드예요' };
      const why = closedReason(v, now());
      if(why) return { ok:false, reason: why };
      const n = (v.usedCount || 0) + 1;
      try{
        await update(ref(db), {
          [`groupInvites/${code}/usedCount`]: n,
          [`groupInviteUses/${code}/${n}`]: { token, at: now() },
          [`groupInviteTokens/${code}/${token}`]: n,
        });
        return { ok:true, issuedBy: v.issuedBy || null };
      }catch(e){
        if(!isDenied(e)) throw e;
      }
      await wait(Math.random() * WAIT_MAX_MS);
      v = await readHead(code);
      if(v && (v.usedCount || 0) === n - 1 && !closedReason(v, now()))
        return { ok:false, reason: typeof v.expiresAt === 'number' ? '기간이 지난 초대 코드예요' : '초대 코드를 사용할 수 없어요' };
    }
    return { ok:false, reason:'사람이 몰려 초대 코드를 쓰지 못했어요 — 잠시 뒤 다시 시도해 주세요' };
  }

  /* uid 를 칸에 적는 건 관리자 화면용 기록이라 실패해도 가입은 끝낸다(로그인 전이면 규칙이 막는다). */
  async function finish(code, token, userId){
    const head = await readHead(code);
    if(!head) return { ok:false, reason:'초대 코드 기록을 바꾸지 못했어요' };
    const n = await readSlot(code, token);
    if(n == null) return { ok:false, reason:'초대 코드 기록을 바꾸지 못했어요' };
    try{ await update(ref(db, `groupInviteUses/${code}/${n}`), { uid: userId }); }catch(_){}
    return { ok:true, issuedBy: head.issuedBy || null };
  }

  return { redeem, finish };
}

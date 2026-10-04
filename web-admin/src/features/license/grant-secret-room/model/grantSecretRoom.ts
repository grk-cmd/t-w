import { sendInboxMessage, type InboxMessage } from '@/entities/inbox';
import {
  expireSecretRoom,
  formatDay,
  genSecretCode,
  getSecretRoomPub,
  getUserSecretRoom,
  hasConfusingChars,
  isUserId,
  issueSecretRoom,
  overwriteWarning,
  parseMonths,
  parseWantCode,
  periodText,
  planExpiry,
  SECRET_PREFIX,
  setUserSecretRoom,
  staleReason,
  type ExpiryMode,
} from '@/entities/secret-room';
import { findUserByFriendCode, getUserFriendCode, getUserLastSeen, getUserName } from '@/entities/user';
import { isPermissionDenied, type Db } from '@/shared/api';

const AUTO_CODE_TRIES = 5;

export interface SecretGrantInput {
  /** 친구코드(뒤 4자리 가능) 또는 유저 코드(u…). */
  target: string;
  /** 원하는 코드 4자리 — 비우면 자동. */
  want: string;
  /** 개월 수 — 비우면 영구. */
  months: string;
}

export interface SecretGrantPlan {
  uid: string;
  name: string;
  code: string;
  months: number;
  expMs: number;
  mode: ExpiryMode;
  confusing: boolean;
  /** 비어 있지 않으면 한 번 더 확인받고 보낸다. */
  warnings: string[];
}

export type PrepareResult = { ok: true; plan: SecretGrantPlan } | { ok: false; error: string };

/**
 * 발급 전 확인 — 읽기만 한다(열쇠가 필요 없다). 앱이 «한 번 경고하고 같은 버튼을 다시 누르면 진행» 하던 두 게이트
 * (오래된 계정 · 이미 발급된 코드)를 warnings 로 돌려준다.
 */
export async function prepareSecretGrant(
  db: Db,
  input: SecretGrantInput,
  now: number = Date.now(),
  genCode: () => string = genSecretCode,
): Promise<PrepareResult> {
  const raw = input.target.trim();
  if (!raw) return { ok: false, error: '친구코드 또는 유저 코드를 입력해 주세요' };
  const months = parseMonths(input.months);
  if (!months.ok) return months;
  const wanted = parseWantCode(input.want);
  if (!wanted.ok) return wanted;

  // 유저 코드를 직접 받으면 friendCodes 를 거치지 않는다 — 계정 이전으로 코드가 옛 uid 를 가리킬 때 우회하는 길이다.
  const direct = isUserId(raw);
  let uid = raw;
  let friendCode = '';
  if (!direct) {
    const user = await findUserByFriendCode(db, raw).catch(() => null);
    if (!user) return { ok: false, error: '해당 친구코드를 가진 유저를 찾을 수 없어요' };
    uid = user.uid;
    friendCode = user.code;
  }
  const name = (await getUserName(db, uid)) ?? '';
  const who = `${uid}${name ? ` (${name})` : ''}`;
  const warnings: string[] = [];

  // 유저 코드를 직접 넣은 경우는 관리자가 후원자에게 확인한 값이라 묻지 않는다.
  if (!direct) {
    const [lastSeen, mirror] = await Promise.all([getUserLastSeen(db, uid), getUserFriendCode(db, uid)]);
    const reason = staleReason(lastSeen, mirror, friendCode, now);
    if (reason)
      warnings.push(
        `이 친구코드는 ${who} 를 가리키는데, ${reason}. 계정 이전으로 코드가 어긋난 계정일 수 있어요 — ` +
          '후원자에게 유저 코드(u…)를 받아 넣는 편이 안전해요.',
      );
  }

  let code = '';
  let prev = null;
  if (wanted.want) {
    code = SECRET_PREFIX + wanted.want;
    prev = await getSecretRoomPub(db, code);
    if (prev?.owner) warnings.push(overwriteWarning(code, prev, uid, months.months, now));
  } else {
    for (let i = 0; i < AUTO_CODE_TRIES && !code; i++) {
      const candidate = genCode();
      if (!(await getSecretRoomPub(db, candidate))?.owner) code = candidate;
    }
    if (!code) return { ok: false, error: '코드 생성에 실패했어요 — 다시 시도해 주세요' };
  }

  const { expMs, mode } = planExpiry(prev, uid, months.months, now);
  return {
    ok: true,
    plan: {
      uid,
      name,
      code,
      months: months.months,
      expMs,
      mode,
      confusing: hasConfusingChars(wanted.want),
      warnings,
    },
  };
}

export function secretRoomMessage(code: string, expMs: number, expiredOld: string): InboxMessage {
  const until = expMs ? `${formatDay(expMs)} 까지` : '언제든';
  return {
    tag: 'reward',
    title: '🔒 시크릿룸이 열렸어요',
    body:
      `후원 감사합니다! 아래 코드로 ${until} 내 전용 투게더룸에 들어갈 수 있어요.\n\n${code}\n\n` +
      '[방 만들기 / 참여] 창의 SCRT- 칸에 뒤 4자리를 넣으면 입장돼요.\n' +
      '친구에게 코드를 알려주면 같이 쓸 수 있고, 내가 나가도 방은 그대로 유지돼요.' +
      (expMs
        ? `\n\n이용 기간은 ${formatDay(expMs)} 까지예요. 그 뒤로는 이 코드로 입장할 수 없어요. ` +
          '만료 7일 전부터는 입장할 때 안내가 떠요.'
        : '') +
      // 받는 앱은 내 시크릿룸 코드를 세션당 한 번만 읽어 둔다 — 다시 켜야 새 코드로 바뀐다.
      (expiredOld
        ? `\n\n예전 코드 ${expiredOld} 로는 이제 입장할 수 없어요. 앱을 다시 켜면 참여 화면에 새 코드가 자동으로 떠요.`
        : ''),
  };
}

export type GrantResult =
  | { ok: false; denied: boolean }
  | {
      ok: true;
      code: string;
      period: string;
      sent: boolean;
      linked: boolean;
      expiredOld: string;
      expireFailed: string;
    };

/**
 * 발급 — 앱과 같은 순서: 새 코드 쓰기 → 옛 코드 만료 → 사용자 칸에 코드 기록 → 수령함.
 * 한 묶음으로 보내지 않는다. 새 코드가 써진 뒤의 단계는 실패해도 되돌리지 않고 결과에 알린다
 * (사용자 칸은 규칙상 관리자가 못 쓰는 경우가 있고, 그때도 발급은 유효하다).
 */
export async function grantSecretRoom(
  db: Db,
  plan: SecretGrantPlan,
  key: string,
  now: number = Date.now(),
): Promise<GrantResult> {
  try {
    await issueSecretRoom(db, plan.code, { uid: plan.uid, name: plan.name }, key, plan.expMs, now);
  } catch (error) {
    return { ok: false, denied: isPermissionDenied(error) };
  }

  // 코드를 바꿔 주면 옛 코드가 살아남아 시크릿룸이 둘이 된다. 사용자 칸을 덮기 전에 옛 코드를 읽어 둔다.
  let expiredOld = '';
  let expireFailed = '';
  try {
    const old = await getUserSecretRoom(db, plan.uid);
    // 같은 코드면 연장이다. 그새 다른 사람에게 재발급된 옛 코드는 남의 방이라 손대지 않는다.
    if (old && old !== plan.code && (await getSecretRoomPub(db, old))?.owner === plan.uid) {
      try {
        if (await expireSecretRoom(db, old, key, now)) expiredOld = old;
        else expireFailed = old;
      } catch {
        expireFailed = old;
      }
    }
  } catch {
    expireFailed = '?';
  }

  const linked = await setUserSecretRoom(db, plan.uid, plan.code);
  let sent = false;
  try {
    await sendInboxMessage(db, plan.uid, secretRoomMessage(plan.code, plan.expMs, expiredOld));
    sent = true;
  } catch {
    sent = false;
  }
  return {
    ok: true,
    code: plan.code,
    period: periodText(plan.months, plan.expMs, plan.mode),
    sent,
    linked,
    expiredOld,
    expireFailed,
  };
}

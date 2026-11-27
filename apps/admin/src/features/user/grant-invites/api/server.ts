// API 판 — 한 사람 · 전체: `POST /v2/admin/invite-quotas/grants { requestId, target(사용자코드 | "all"), n }`,
// 고른 사람들(≤100): `{ requestId, targets, n }` → 줄마다 `{ id, ok, code?, left? }`. 회수는 `POST …/revocations { target | targets }`(요청 번호 없음).
// 결과의 대상 수 · 건너뛴 수 · 거둔 장 수는 서버가 센 `targeted` · `skipped` · `taken` 을 그대로 쓴다(웹이 줄을 세지 않는다).
// 한 명짜리 코드 n 개: `POST /v2/admin/invites { requestId, maxUses: 1, count: n }` → `{ code, codes }`. 여러 명 코드: 같은 길에 `{ requestId, maxUses, expiresAt?, memo? }`,
// 중지 · 다시 열기: `PATCH /v2/admin/invites/{code} { version, paused }` — 번호는 목록이 읽은 줄에 실려 오고 그 사이 다른 관리자가 고쳤으면 409 → `conflict`.
// 기록 · 남은 장수 계산과 지급 장수 · 코드 개수 · 인원 상한 · 메모 길이 판정은 서버가 한다 — 값은 그대로 보내고 400 은 서버 문구로 띄운다.
import { type GroupInvite, type GroupInviteDraft } from '@/entities/invite';
import {
  adminPath,
  perApi,
  PortError,
  portCall,
  wireArray,
  wireBool,
  wireError,
  wireNullableString,
  wireNumber,
  wireObject,
  wireOmittable,
  wireString,
  type Api,
} from '@/shared/api';
import { BULK_SEND_MAX, chunks, createPayloadRequestId } from '@/shared/lib';
import type {
  GrantAllResult,
  GrantInvitesResult,
  InviteTarget,
  RevokeAllResult,
} from '../model/grantInvites';
import type { GrantInvitesPort, RunOpts } from './port';

const INVITES = adminPath('/invites');
const QUOTAS = adminPath('/invite-quotas');
const USER_STATS = adminPath('/users/stats');

/** 안 바뀐 까닭 — 둘 다 «건너뜀»(초대 칸이 없거나 이미 그 값)이다. 그 밖의 글자는 약속과 다른 응답. */
const SKIP_CODES = ['USER_NOT_FOUND', 'NO_CHANGE'];

/**
 * `{ changed, invitesLeft?, results?, targeted, skipped, taken? }` — `invitesLeft` 는 한 사람 대상일 때만 오고 없는 사람이면 칸이 없다.
 * `targeted`(대상 수) · `skipped`(대상 중 안 바뀐 수) · `taken`(회수로 거둔 장 수 — 지급이면 없음)은 서버가 센 값을 그대로 쓴다.
 */
function toChanged(w: unknown) {
  const o = wireObject(w, '초대권 결과');
  const count = (field: string) => wireOmittable(o, field, (v) => wireNumber(v, `초대권 결과의 ${field}`));
  return {
    changed: wireNumber(o.changed, '초대권 결과의 changed'),
    left: count('invitesLeft'),
    rows: wireOmittable(o, 'results', (v) => wireArray(v, '초대권 결과의 results')),
    targeted: count('targeted'),
    skipped: count('skipped'),
    taken: count('taken'),
  };
}

/** 회수 결과의 수 — 회수는 요청 번호가 없어 늘 새로 세므로 세 칸이 다 있어야 한다. */
function revokeCounts(r: ReturnType<typeof toChanged>) {
  if (r.targeted === null) throw wireError('초대권 결과의 targeted', '숫자(대상 수)');
  if (r.skipped === null) throw wireError('초대권 결과의 skipped', '숫자(건너뛴 수)');
  if (r.taken === null) throw wireError('초대권 결과의 taken', '숫자(거둔 장 수)');
  return { targeted: r.targeted, skipped: r.skipped, taken: r.taken };
}

/** 묶음마다 받은 수를 더한다 — 하나라도 모르면(null) 합도 모름. */
const addKnown = (sum: number | null, n: number | null) => (sum === null || n === null ? null : sum + n);

/** 고른 사람 한 줄 — 안 된 줄은 까닭 `code` 가 있다. */
function toRow(w: unknown): { id: string; ok: boolean } {
  const o = wireObject(w, '초대권 결과 줄');
  const id = wireString(o.id, '초대권 결과 줄의 id');
  const ok = wireBool(o.ok, '초대권 결과 줄의 ok');
  const code = wireOmittable(o, 'code', (v) => wireNullableString(v, '초대권 결과 줄의 code'));
  if (ok && code !== null) throw wireError('초대권 결과 줄의 code', '된 줄에는 없음');
  if (!ok && (code === null || !SKIP_CODES.includes(code)))
    throw wireError('초대권 결과 줄의 code', SKIP_CODES.join(' · '));
  return { id, ok };
}

/** 중간 묶음이 실패했을 때 — 앞 묶음은 이미 서버에 반영됐으니 «n명 됨 · m명 안 됨» 으로 알린다. */
function partial(error: unknown, done: number, left: number, what: string): PortError {
  const cause = error instanceof PortError ? error : new PortError('unreachable', String(error));
  return new PortError(
    cause.kind,
    `${done}명 ${what} · ${left}명 안 됨 (${cause.message})`,
    cause.code,
    cause.items,
  );
}

function build(api: Api | null): GrantInvitesPort {
  const once = createPayloadRequestId();

  /** 고른 사람들 한 묶음의 결과 — 보낸 사람과 줄이 어긋나면 약속과 다른 응답. 수는 서버가 센 칸을 쓴다. */
  function readPicked(answer: unknown, sent: readonly string[]) {
    const changed = toChanged(answer);
    if (changed.rows === null) throw wireError('초대권 결과의 results', '줄마다 결과');
    const parsed = changed.rows.map(toRow);
    if (parsed.length !== sent.length || parsed.some((r, i) => r.id !== sent[i]))
      throw wireError('초대권 결과의 results', '보낸 사람 순서대로 한 줄씩');
    return changed;
  }

  return {
    async grantOne(uid, count) {
      const body = { target: uid, n: count };
      const r = toChanged(
        await portCall(
          api,
          (a) =>
            once(body, (requestId) =>
              a.send<unknown>('POST', `${QUOTAS}/grants`, { body: { requestId, ...body } }),
            ),
          '지급하지 못했어요',
        ),
      );
      if (r.changed === 1) {
        if (r.left === null) throw wireError('초대권 결과의 invitesLeft', '숫자(바꾼 뒤 남은 장)');
        return { ok: true, after: r.left } satisfies GrantInvitesResult;
      }
      if (r.changed !== 0) throw wireError('초대권 결과의 changed', '한 사람이라 0 또는 1');
      // 바뀐 게 없다 — 남은 장수를 못 읽는 사람은 초대 칸이 없고, 읽히면 이미 상한이다.
      return r.left === null ? { ok: false, reason: 'no-invite' } : { ok: false, reason: 'full' };
    },

    // «전체» 대상 = 가입한 사람 전부 = 사용자 통계의 total.
    countAll: () =>
      portCall(
        api,
        async (a) =>
          wireNumber(
            wireObject(await a.get<unknown>(USER_STATS), '사용자 통계').total,
            '사용자 통계의 total',
          ),
        '대상 수를 읽지 못했어요',
      ),

    async grant(target, count, opts: RunOpts = {}) {
      if (target.kind === 'all') {
        const body = { target: 'all', n: count };
        const r = toChanged(
          await portCall(
            api,
            (a) =>
              once(body, (requestId) =>
                a.send<unknown>('POST', `${QUOTAS}/grants`, { body: { requestId, ...body } }),
              ),
            '전체 지급을 하지 못했어요',
          ),
        );
        // 그 칸이 생기기 전에 적힌 요청 기록을 같은 요청 번호로 다시 받으면 대상 · 건너뜀 수가 없다(null = 모름).
        return { total: r.targeted, granted: r.changed, skipped: r.skipped, failed: 0, stopped: false };
      }
      const result: GrantAllResult = {
        total: target.uids.length,
        granted: 0,
        skipped: 0,
        failed: 0,
        stopped: false,
      };
      let done = 0;
      opts.onProgress?.(0, target.uids.length);
      for (const targets of chunks(target.uids, BULK_SEND_MAX)) {
        if (opts.shouldStop?.()) {
          result.stopped = true;
          break;
        }
        const body = { targets, n: count };
        try {
          const r = readPicked(
            await portCall(
              api,
              (a) =>
                once(body, (requestId) =>
                  a.send<unknown>('POST', `${QUOTAS}/grants`, { body: { requestId, ...body } }),
                ),
              '지급하지 못했어요',
            ),
            targets,
          );
          result.granted += r.changed;
          result.skipped = addKnown(result.skipped, r.skipped);
        } catch (error) {
          throw partial(error, result.granted, target.uids.length - done, '지급');
        }
        done += targets.length;
        opts.onProgress?.(done, target.uids.length);
      }
      return result;
    },

    async revoke(target: InviteTarget, opts: RunOpts = {}) {
      if (target.kind === 'all') {
        const r = toChanged(
          await portCall(
            api,
            (a) => a.send<unknown>('POST', `${QUOTAS}/revocations`, { body: { target: 'all' } }),
            '전체 회수를 하지 못했어요',
          ),
        );
        const { targeted, skipped, taken } = revokeCounts(r);
        return { total: targeted, revoked: r.changed, taken, skipped, failed: 0, stopped: false };
      }
      const result: RevokeAllResult = {
        total: target.uids.length,
        revoked: 0,
        taken: 0,
        skipped: 0,
        failed: 0,
        stopped: false,
      };
      let done = 0;
      opts.onProgress?.(0, target.uids.length);
      for (const targets of chunks(target.uids, BULK_SEND_MAX)) {
        if (opts.shouldStop?.()) {
          result.stopped = true;
          break;
        }
        try {
          const r = readPicked(
            await portCall(
              api,
              (a) => a.send<unknown>('POST', `${QUOTAS}/revocations`, { body: { targets } }),
              '회수하지 못했어요',
            ),
            targets,
          );
          const counts = revokeCounts(r);
          result.revoked += r.changed;
          result.skipped += counts.skipped;
          result.taken += counts.taken;
        } catch (error) {
          throw partial(error, result.revoked, target.uids.length - done, '회수');
        }
        done += targets.length;
        opts.onProgress?.(done, target.uids.length);
      }
      return result;
    },

    async createCodes(n, onCode) {
      const body = { maxUses: 1, count: n };
      const answer = wireObject(
        await portCall(
          api,
          (a) =>
            once(body, (requestId) => a.send<unknown>('POST', INVITES, { body: { requestId, ...body } })),
          '코드를 만들지 못했어요',
        ),
        '초대 코드 결과',
      );
      const codes = wireArray(answer.codes, '초대 코드 결과의 codes').map((c) => wireString(c, '초대 코드'));
      if (codes.length !== n) throw wireError('초대 코드 결과의 codes', `${n}개`);
      for (const code of codes) onCode?.(code);
      return codes;
    },

    async createGroup(draft: GroupInviteDraft) {
      const memo = draft.note.trim();
      const body = {
        maxUses: draft.maxUses,
        ...(draft.expiresAt !== null ? { expiresAt: new Date(draft.expiresAt).toISOString() } : {}),
        ...(memo ? { memo } : {}),
      };
      const answer = wireObject(
        await portCall(
          api,
          (a) =>
            once(body, (requestId) => a.send<unknown>('POST', INVITES, { body: { requestId, ...body } })),
          '코드를 만들지 못했어요',
        ),
        '초대 코드 결과',
      );
      return wireString(answer.code, '초대 코드 결과의 code');
    },

    async setGroupStopped(invite: GroupInvite, stop: boolean) {
      // 번호는 API 판 목록이 늘 싣는다. 없으면 이 판의 읽기를 거치지 않은 줄이라 코드 실수다.
      if (invite.version === undefined)
        throw new PortError('invalid', `읽은 코드에 번호가 없어요 (${invite.code})`);
      const version = invite.version;
      await portCall(
        api,
        (a) =>
          a.send('PATCH', `${INVITES}/${encodeURIComponent(invite.code)}`, {
            body: { version, paused: stop },
          }),
        '바꾸지 못했어요',
      );
    },
  };
}

/** `api` 마다 하나 — 같은 내용을 다시 보낼 때만 같은 요청 번호를 쓰는 기억만 든다. */
export const createServerGrantInvitesPort = perApi(build);

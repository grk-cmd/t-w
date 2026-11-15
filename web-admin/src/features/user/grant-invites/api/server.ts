// API 판 — 한 사람 · 전체: `POST /v2/admin/invite-quotas/grants { requestId, target(사용자코드 | "all"), n }`,
// 고른 사람들(≤100): `{ requestId, targets, n }` → 줄마다 `{ id, ok, code?, left? }`. 회수는 `POST …/revocations { target | targets }`(요청 번호 없음).
// 한 명짜리 코드 n 개: `POST /v2/admin/invites { requestId, maxUses: 1, count: n }` → `{ code, codes }`. 여러 명 코드: 같은 길에 `{ requestId, maxUses, expiresAt?, memo? }`,
// 중지 · 다시 열기: `PATCH /v2/admin/invites/{code} { version, paused }` — 번호는 목록이 읽은 줄에 실려 오고 그 사이 다른 관리자가 고쳤으면 409 → `conflict`.
// 기록 · 남은 장수 계산은 서버가 한다.
import {
  GROUP_INVITE_NOTE_MAX,
  INVITE_CODE_MAX,
  isGrantCount,
  isGroupMaxUses,
  type GroupInvite,
  type GroupInviteDraft,
} from '@/entities/invite';
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
import { createPayloadRequestId } from '@/shared/lib';
import type {
  GrantAllResult,
  GrantInvitesResult,
  InviteTarget,
  RevokeAllResult,
} from '../model/grantInvites';
import type { GrantInvitesPort, RunOpts } from './port';

const INVITES = adminPath('/invites');
const QUOTAS = adminPath('/invite-quotas');
/** 고른 사람들을 한 번에 보내는 상한(서버 `targets` 1~100). */
const PICK_MAX = 100;

/** 안 바뀐 까닭 — 둘 다 «건너뜀»(초대 칸이 없거나 이미 그 값)이다. 그 밖의 글자는 약속과 다른 응답. */
const SKIP_CODES = ['USER_NOT_FOUND', 'NO_CHANGE'];

/** `{ changed, invitesLeft? }` — `invitesLeft` 는 한 사람 대상일 때만 오고 없는 사람이면 칸이 없다. */
function toChanged(w: unknown) {
  const o = wireObject(w, '초대권 결과');
  return {
    changed: wireNumber(o.changed, '초대권 결과의 changed'),
    left: wireOmittable(o, 'invitesLeft', (v) => wireNumber(v, '초대권 결과의 invitesLeft')),
    rows: wireOmittable(o, 'results', (v) => wireArray(v, '초대권 결과의 results')),
  };
}

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

function chunks<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
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

  /** 고른 사람들 한 묶음의 결과 — 보낸 사람과 줄이 어긋나면 약속과 다른 응답. */
  function readPicked(answer: unknown, sent: readonly string[]) {
    const { rows } = toChanged(answer);
    if (rows === null) throw wireError('초대권 결과의 results', '줄마다 결과');
    const parsed = rows.map(toRow);
    if (parsed.length !== sent.length || parsed.some((r, i) => r.id !== sent[i]))
      throw wireError('초대권 결과의 results', '보낸 사람 순서대로 한 줄씩');
    return parsed;
  }

  return {
    async grantOne(uid, count) {
      if (!isGrantCount(count)) throw new Error(`지급 장수가 범위를 벗어났어요: ${count}`);
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

    // 서버가 «전체» 를 처리할 때 센다 — 미리 읽는 대상이 없다.
    countAll: async () => null,

    async grant(target, count, opts: RunOpts = {}) {
      if (!isGrantCount(count)) throw new Error(`지급 장수가 범위를 벗어났어요: ${count}`);
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
        return { total: null, granted: r.changed, skipped: null, failed: 0, stopped: false };
      }
      const result: GrantAllResult = {
        total: target.uids.length,
        granted: 0,
        skipped: 0,
        failed: 0,
        stopped: false,
      };
      let done = 0;
      let skipped = 0;
      opts.onProgress?.(0, target.uids.length);
      for (const targets of chunks(target.uids, PICK_MAX)) {
        if (opts.shouldStop?.()) {
          result.stopped = true;
          break;
        }
        const body = { targets, n: count };
        try {
          const rows = readPicked(
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
          for (const row of rows) {
            if (row.ok) result.granted += 1;
            else skipped += 1;
          }
        } catch (error) {
          throw partial(error, result.granted, target.uids.length - done, '지급');
        }
        done += targets.length;
        opts.onProgress?.(done, target.uids.length);
      }
      result.skipped = skipped;
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
        return { total: null, revoked: r.changed, taken: null, skipped: null, failed: 0, stopped: false };
      }
      const result: RevokeAllResult = {
        total: target.uids.length,
        revoked: 0,
        taken: null,
        skipped: 0,
        failed: 0,
        stopped: false,
      };
      let done = 0;
      let skipped = 0;
      opts.onProgress?.(0, target.uids.length);
      for (const targets of chunks(target.uids, PICK_MAX)) {
        if (opts.shouldStop?.()) {
          result.stopped = true;
          break;
        }
        try {
          const rows = readPicked(
            await portCall(
              api,
              (a) => a.send<unknown>('POST', `${QUOTAS}/revocations`, { body: { targets } }),
              '회수하지 못했어요',
            ),
            targets,
          );
          for (const row of rows) {
            if (row.ok) result.revoked += 1;
            else skipped += 1;
          }
        } catch (error) {
          throw partial(error, result.revoked, target.uids.length - done, '회수');
        }
        done += targets.length;
        opts.onProgress?.(done, target.uids.length);
      }
      result.skipped = skipped;
      return result;
    },

    async createCodes(n, onCode) {
      if (!Number.isInteger(n) || n < 1 || n > INVITE_CODE_MAX)
        throw new Error(`만들 개수가 범위를 벗어났어요: ${n}`);
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
      if (!isGroupMaxUses(draft.maxUses)) throw new Error(`인원이 범위를 벗어났어요: ${draft.maxUses}`);
      const memo = draft.note.trim().slice(0, GROUP_INVITE_NOTE_MAX);
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

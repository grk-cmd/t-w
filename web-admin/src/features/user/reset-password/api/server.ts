// API 판 — `POST /v2/admin/users/{userCode}/password-reset { memo }` → `{ tempPassword }`.
// 메모 길이(1~60) · 구글 전용 계정 같은 판정은 서버가 한다. 응답은 `no-store` — 이 창에서 한 번만 보인다.
import { adminPath, perApi, portCall, wireObject, wireString, type Api } from '@/shared/api';
import type { ResetPasswordPort } from './port';

function build(api: Api | null): ResetPasswordPort {
  return {
    run: (code, memo) =>
      portCall(
        api,
        async (a) => {
          const body = wireObject(
            await a.send<unknown>(
              'POST',
              adminPath(`/users/${encodeURIComponent(code.trim())}/password-reset`),
              {
                body: { memo },
              },
            ),
            '임시 비밀번호',
          );
          return {
            ok: true as const,
            kind: null,
            code: code.trim(),
            friendCode: null,
            name: null,
            tempPassword: wireString(body.tempPassword, '임시 비밀번호의 tempPassword'),
            logId: null,
          };
        },
        '비밀번호를 초기화하지 못했어요',
      ),
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerResetPasswordPort = perApi(build);

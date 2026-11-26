// API 판 — `GET /v2/admin/users/{userCode}/deletion-preview` · `POST …/deletion { memo }`(202 — 받은 양).
// `{userCode}` 자리에 친구코드도 받는다(서버). 메모 길이 · 관리자 대상 같은 판정은 서버가 한다.
import {
  adminPath,
  perApi,
  portCall,
  wireArray,
  wireBool,
  wireNullableNumber,
  wireNullableString,
  wireNumber,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import type { ServerDeleteAccepted, ServerDeletePreview } from '../model/serverDelete';
import type { DeleteAccountServerPort } from './port';

const userPath = (code: string) => adminPath(`/users/${encodeURIComponent(code.trim())}`);

export function toServerDeletePreview(w: unknown): ServerDeletePreview {
  const o = wireObject(w, '삭제 미리 보기');
  const onlineRaw = o.online;
  return {
    userCode: wireString(o.userCode, '삭제 미리 보기의 userCode'),
    name: wireNullableString(o.name, '삭제 미리 보기의 name'),
    friendCode: wireString(o.friendCode, '삭제 미리 보기의 friendCode'),
    items: wireNumber(o.items, '삭제 미리 보기의 items'),
    files: wireNullableNumber(o.files, '삭제 미리 보기의 files'),
    byContext: wireArray(o.byContext, '삭제 미리 보기의 byContext').map((c, i) => {
      const line = wireObject(c, `삭제 미리 보기의 byContext ${i + 1}번째`);
      return {
        context: wireString(line.context, `삭제 미리 보기의 byContext ${i + 1}번째의 context`),
        count: wireNumber(line.count, `삭제 미리 보기의 byContext ${i + 1}번째의 count`),
      };
    }),
    hasLogin: wireBool(o.hasLogin, '삭제 미리 보기의 hasLogin'),
    online: onlineRaw === null ? null : wireBool(onlineRaw, '삭제 미리 보기의 online'),
    loginProviders: wireArray(o.loginProviders, '삭제 미리 보기의 loginProviders').map((p) =>
      wireString(p, '삭제 미리 보기의 loginProviders 줄'),
    ),
    kept: wireArray(o.kept, '삭제 미리 보기의 kept').map((k, i) => {
      const line = wireObject(k, `삭제 미리 보기의 kept ${i + 1}번째`);
      return {
        label: wireString(line.label, `삭제 미리 보기의 kept ${i + 1}번째의 label`),
        why: wireString(line.why, `삭제 미리 보기의 kept ${i + 1}번째의 why`),
      };
    }),
  };
}

export function toServerDeleteAccepted(w: unknown): ServerDeleteAccepted {
  const o = wireObject(w, '삭제 접수');
  return {
    items: wireNumber(o.items, '삭제 접수의 items'),
    files: wireNullableNumber(o.files, '삭제 접수의 files'),
  };
}

function build(api: Api | null): DeleteAccountServerPort {
  return {
    kind: 'server',
    preview: (code) =>
      portCall(
        api,
        async (a) => toServerDeletePreview(await a.get<unknown>(`${userPath(code)}/deletion-preview`)),
        '삭제 미리 보기를 불러오지 못했어요',
      ),
    run: (userCode, memo) =>
      portCall(
        api,
        async (a) =>
          toServerDeleteAccepted(
            await a.send<unknown>('POST', `${userPath(userCode)}/deletion`, { body: { memo } }),
          ),
        '계정 삭제를 보내지 못했어요',
      ),
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerDeleteAccountPort = perApi(build);

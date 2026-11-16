// API 판 — `PATCH /v2/admin/bugs/{number} { version, status }`. 번호는 화면이 읽은 글에 실려 오고, 그 사이 다른 곳이 고쳤으면 409 → `conflict`.
// 어떤 상태로 바꿀 수 있는가는 서버가 판정한다 — 값은 그대로 보내고 400 은 서버 문구로 띄운다.
import { serverStatus } from '@/entities/bug-board';
import { adminPath, perApi, PortError, portCall, type Api } from '@/shared/api';
import type { ChangeStatusPort } from './port';

function build(api: Api | null): ChangeStatusPort {
  return {
    async change(item, status, label) {
      // 번호는 API 판 상세가 늘 싣는다. 없으면 이 판의 읽기를 거치지 않은 글이라 코드 실수다.
      if (item.version === undefined) throw new PortError('invalid', `읽은 글에 번호가 없어요 (${item.id})`);
      const version = item.version;
      await portCall(
        api,
        (a) =>
          a.send('PATCH', adminPath(`/bugs/${encodeURIComponent(item.id)}`), {
            body: { version, status: serverStatus(status) },
          }),
        `${label} 상태를 바꾸지 못했어요`,
      );
    },
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerChangeStatusPort = perApi(build);

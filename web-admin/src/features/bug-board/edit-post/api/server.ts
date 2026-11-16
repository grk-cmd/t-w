// API 판 — `PATCH /v2/admin/bugs/{number} { version, title?, body?, category?, visibility? }` — 안 실은 칸은 그대로(고친 칸만 싣는다).
// 번호는 화면이 읽은 글에 실려 오고, 그 사이 다른 곳이 고쳤으면 409 → `conflict`. 공개 → 비공개면 공개 답변도 서버가 비공개로 옮긴다.
// 글자 수 · 공지는 공개만 같은 판정은 서버가 한다 — 값은 그대로 보내고 400 은 서버 문구로 띄운다.
import { serverCategory, serverVisibility } from '@/entities/bug-board';
import { adminPath, perApi, PortError, portCall, type Api } from '@/shared/api';
import type { EditPostPort } from './port';

function build(api: Api | null): EditPostPort {
  return {
    // 서버가 판정한다.
    check: () => null,

    async edit(item, content, input, label) {
      // 번호는 API 판 상세가 늘 싣는다. 없으면 이 판의 읽기를 거치지 않은 글이라 코드 실수다.
      if (item.version === undefined) throw new PortError('invalid', `읽은 글에 번호가 없어요 (${item.id})`);
      const version = item.version;
      const title = input.title.trim();
      const text = input.body.trim();
      const body = {
        version,
        ...(title !== content?.title ? { title } : {}),
        ...(text !== content?.body ? { body: text } : {}),
        ...(input.cat !== item.cat ? { category: serverCategory(input.cat) } : {}),
        ...(input.vis !== item.vis ? { visibility: serverVisibility(input.vis) } : {}),
      };
      await portCall(
        api,
        (a) => a.send('PATCH', adminPath(`/bugs/${encodeURIComponent(item.id)}`), { body }),
        `${label} 제보를 고치지 못했어요`,
      );
      return { ok: true };
    },
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerEditPostPort = perApi(build);

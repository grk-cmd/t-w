// API 판 — 제보 상태 바꾸기 `PATCH /v2/admin/bugs/{number} { version, status }`. 상태 바꾸기 단추와 할 일 완료가 같이 쓴다.
// 번호(`version`)는 화면이 읽은 글에 실려 오고, 그 사이 다른 곳이 고쳤으면 409 → `conflict`. 어떤 상태로 바꿀 수 있는가는 서버가 판정한다 — 값은 그대로 보내고 400 은 서버 문구로 띄운다.
import { adminPath, PortError, portCall, type Api } from '@/shared/api';
import { serverStatus, type BugItem, type BugStatus } from '../model/bugBoard';

export async function changeBugStatus(
  api: Api | null,
  item: BugItem,
  status: BugStatus,
  label: string,
): Promise<void> {
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
}

// API 판 — 문제없음: `POST /v2/admin/reports/dismissals { targets }` → 줄마다 `{ id, ok, code? }`(한 명도 같은 길에 한 줄로),
// 그림 내리기: `POST /v2/admin/reports/{target}/take-down { awayImageUrl: 보던 주소 }` — 그림 칸 · 파일은 서버가 지운다.
// 지금 그림과 다르면 409 `REPORT_IMAGE_CHANGED`. 요청 본문에 요청 번호 칸이 없다(같은 신고를 다시 닫아도 결과가 같다).
// 고른 사람 수 · 주소 길이 판정은 서버가 한다 — 값은 그대로 보내고 400 은 서버 문구로 띄운다.
import {
  adminPath,
  isPortError,
  perApi,
  PortError,
  portCall,
  rowCodeText,
  wireArray,
  wireBool,
  wireError,
  wireNullableString,
  wireObject,
  wireOmittable,
  wireString,
  type Api,
} from '@/shared/api';
import type { ModerateReportPort } from './port';

const BASE = adminPath('/reports');
const IMAGE_CHANGED = 'REPORT_IMAGE_CHANGED';

/** 줄 하나 — 안 된 줄은 까닭 `code` 가 있고, 된 줄에는 없다. */
function toRow(w: unknown): { id: string; ok: boolean; code: string | null } {
  const o = wireObject(w, '신고 처리 결과 줄');
  const id = wireString(o.id, '신고 처리 결과 줄의 id');
  const ok = wireBool(o.ok, '신고 처리 결과 줄의 ok');
  const code = wireOmittable(o, 'code', (v) => wireNullableString(v, '신고 처리 결과 줄의 code'));
  if (ok && code !== null) throw wireError('신고 처리 결과 줄의 code', '된 줄에는 없음');
  if (!ok && code === null) throw wireError('신고 처리 결과 줄의 code', '안 된 줄의 까닭');
  return { id, ok, code };
}

function build(api: Api | null): ModerateReportPort {
  /** 보낸 사람 순서대로 한 줄씩 — 어긋나면 약속과 다른 응답. */
  async function dismissals(targets: readonly string[]) {
    const rows = wireArray(
      await portCall(
        api,
        (a) => a.send<unknown>('POST', `${BASE}/dismissals`, { body: { targets } }),
        '비우지 못했어요',
      ),
      '신고 처리 결과',
    ).map(toRow);
    if (rows.length !== targets.length || rows.some((r, i) => r.id !== targets[i]))
      throw wireError('신고 처리 결과', '보낸 사람 순서대로 한 줄씩');
    return rows;
  }

  return {
    async takeDown(target, shownUrl) {
      try {
        await portCall(
          api,
          (a) =>
            a.send('POST', `${BASE}/${encodeURIComponent(target)}/take-down`, {
              body: { awayImageUrl: shownUrl },
            }),
          '내리지 못했어요',
        );
      } catch (error) {
        if (isPortError(error, 'conflict') && error.code === IMAGE_CHANGED)
          return { ok: false, reason: 'changed', refreshList: true };
        throw error;
      }
      return { ok: true, fileDeleted: null };
    },

    async dismiss(target) {
      const [row] = await dismissals([target]);
      if (!row.ok) throw new PortError('invalid', rowCodeText(row.code ?? ''), row.code ?? '');
    },

    async dismissMany(targets) {
      const rows = await dismissals(targets);
      return {
        dismissed: rows.filter((r) => r.ok).map((r) => r.id),
        failed: rows.filter((r) => !r.ok).map((r) => r.id),
      };
    },
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerModerateReportPort = perApi(build);

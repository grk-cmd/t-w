// API 판 — 미리 보기 `POST /v2/admin/licenses/preview { friendCodes ≤500 }` → 줄마다 `{ friendCode, found, name?, hasValidLicense }`(쓰는 것 없음),
// 발급 `POST /v2/admin/licenses { requestId, reissue, grants ≤500 }` → 줄마다 결과. 통째 목록은 받지 않는다 —
// «이미 받음» 은 미리 보기의 `hasValidLicense` 로 가른다.
import { GRANTS_MAX, postGrants, type LicenseGrant } from '@/entities/license';
import {
  adminPath,
  perApi,
  portCall,
  rowCodeText,
  wireArray,
  wireBool,
  wireError,
  wireNullableString,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import { createPayloadRequestId } from '@/shared/lib';
import { CODE_RE, isActionable, normalizeCode, rowNote, type BaseStatus, type PlanRow } from '../model/rows';
import type { BulkGrantPort } from './port';

const PREVIEW = adminPath('/licenses/preview');

interface Preview {
  code: string;
  found: boolean;
  name: string | null;
  hasLicense: boolean;
}

/** 미리 보기 한 줄 — 없는 사람이면 `name` 이 오지 않는다(문서가 약속한 모양). */
function toPreview(w: unknown, index: number): Preview {
  const at = `미리 보기 ${index + 1}번째 줄의`;
  const o = wireObject(w, `미리 보기 ${index + 1}번째 줄`);
  const found = wireBool(o.found, `${at} found`);
  return {
    code: wireString(o.friendCode, `${at} friendCode`),
    found,
    name: found ? wireNullableString(o.name, `${at} name`) : null,
    hasLicense: wireBool(o.hasValidLicense, `${at} hasValidLicense`),
  };
}

function build(api: Api | null): BulkGrantPort {
  const once = createPayloadRequestId();

  return {
    // 판정은 행에 실린 `hasLicense` 로 한다 — 따로 받아 둘 표가 없다.
    issued: async () => (row) => row.hasLicense === true,

    async lookup(data, onProgress) {
      const codes = [...new Set(data.map((d) => normalizeCode(d.code)).filter((k) => k && CODE_RE.test(k)))];
      const found = new Map<string, Preview>();
      onProgress?.(0, codes.length);
      for (let i = 0; i < codes.length; i += GRANTS_MAX) {
        const chunk = codes.slice(i, i + GRANTS_MAX);
        const rows = await portCall(
          api,
          async (a) =>
            wireArray(
              await a.send<unknown>('POST', PREVIEW, { body: { friendCodes: chunk } }),
              '미리 보기',
            ).map(toPreview),
          '받는 사람을 확인하지 못했어요',
        );
        if (rows.length !== chunk.length) throw wireError('미리 보기', `${chunk.length}줄`);
        chunk.forEach((code, j) => found.set(code, rows[j]));
        onProgress?.(Math.min(i + chunk.length, codes.length), codes.length);
      }

      return data.map((d): PlanRow => {
        const k = normalizeCode(d.code);
        const hit = k ? found.get(k) : undefined;
        let base: BaseStatus = 'key';
        if (k) base = !CODE_RE.test(k) ? 'badcode' : hit?.found ? 'send' : 'nouser';
        const user = hit?.found ? hit : null;
        return {
          line: d.line,
          cells: d.cells,
          raw: d.code,
          memo: d.memo,
          code: user?.code ?? '',
          uid: null,
          name: user?.name ?? null,
          hasLicense: user?.hasLicense ?? false,
          // 결과 파일을 다시 올렸을 때 키가 이미 나간 행은 또 만들지 않는다.
          base: d.hasKey ? 'haskey' : base,
          st: d.hasKey ? 'haskey' : base,
        };
      });
    },

    async run(rows, options, onProgress) {
      const todo = rows.filter(isActionable);
      if (!todo.length) return rows;
      const grants: LicenseGrant[] = todo.map((r) =>
        r.st === 'send' ? { friendCode: r.code, note: rowNote(r) } : { note: rowNote(r) },
      );
      const payload = { grants, reissue: options.reissue };
      onProgress?.(0, todo.length);
      const outcomes = await once(payload, (requestId) =>
        postGrants(api, requestId, grants, options.reissue),
      );
      onProgress?.(todo.length, todo.length);
      let next = 0;
      return rows.map((row): PlanRow => {
        if (!isActionable(row)) return row;
        const outcome = outcomes[next++];
        if (outcome.ok) return { ...row, key: outcome.key, res: row.st === 'send' ? 'ok' : 'okkey' };
        return { ...row, res: 'fail', why: rowCodeText(outcome.code) };
      });
    },
  };
}

export const createServerBulkGrantPort = perApi(build);

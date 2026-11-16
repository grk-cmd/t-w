// API 판 — 대상은 할 일 목록에서 완료 · 출시된 것의 제보 번호를 모아 `GET /v2/bugs/{number}` 로 지금 상태를 읽는다(그새 지워진 글은 `BUG_NOT_FOUND` → 건너뜀).
// 반영은 `POST /v2/admin/bugs/release-fixes { requestId, release, items:[{ number, seenLastAnswerAt?, text? }] }` → `{ fixed, skipped }` — 전부 되거나 전부 안 된다.
// 본 «마지막 답변 시각» 은 읽은 글자 그대로 싣고 보내기 전에 다시 읽어 맞추지 않는다. 그 사이 다른 관리자가 답했으면 409 → `conflict`(화면이 제보를 다시 받는다).
// 답변 틀은 설정 키 `bug.releaseAnswerTemplate` — 읽은 번호로 저장하고, 반영이 된 뒤 «기본 템플릿으로 저장» 은 요청 하나를 더 보낸다(실패해도 반영은 그대로 — 그 까닭을 결과에 싣는다).
// 틀 · 답변 길이 판정은 서버가 한다 — 값은 그대로 보내고 400 은 서버 문구로 띄운다.
import { createServerTodoPort } from '@/entities/admin/todo';
import { BUG_STATUSES, type BugStatus } from '@/entities/bug-board';
import {
  isPortError,
  opsConfigClient,
  perApi,
  portCall,
  wireArray,
  wireBool,
  wireError,
  wireNullableString,
  wireObject,
  wireString,
  wireTime,
  adminPath,
  type Api,
  type Versioned,
} from '@/shared/api';
import { createPayloadRequestId } from '@/shared/lib';
import {
  fillTemplate,
  fixTargets,
  releasedReports,
  tplVars,
  type ApplyOptions,
  type ApplyResult,
  type FixBug,
  type FixTarget,
} from '../model/applyRelease';
import type { ReleaseTemplate } from '../model/releaseTpl';
import type { ApplyReleasePort } from './port';

const BUGS = '/v2/bugs';
const RELEASE_FIXES = adminPath('/bugs/release-fixes');
const TEMPLATE_KEY = 'bug.releaseAnswerTemplate';

/** 서버 글 한 건 → 반영에 쓰는 칸. `number` 가 글 번호이고 화면 주소 · 제보 연결의 열쇠다. */
export function toFixBug(w: unknown): { item: FixBug; lastAnswerAt: string | null } {
  const o = wireObject(w, '제보');
  const number = wireString(o.number, '제보의 number');
  const what = (field: string) => `제보 ${number} 의 ${field}`;
  const status = wireString(o.status, what('status')).toLowerCase();
  if (!BUG_STATUSES.includes(status as BugStatus)) throw wireError(what('status'), BUG_STATUSES.join(' · '));
  const visibility = wireString(o.visibility, what('visibility'));
  if (visibility !== 'PUBLIC' && visibility !== 'PRIVATE')
    throw wireError(what('visibility'), 'PUBLIC · PRIVATE');
  const lastAnswerAt = wireNullableString(o.lastAnswerAt, what('lastAnswerAt'));
  if (lastAnswerAt !== null) wireTime(lastAnswerAt, what('lastAnswerAt'));
  return {
    item: {
      id: number,
      no: number,
      vis: visibility === 'PUBLIC' ? 'pub' : 'prv',
      status: status as BugStatus,
      title: wireString(o.title, what('title')),
      ts: wireTime(o.createdAt, what('createdAt')),
    },
    lastAnswerAt,
  };
}

function build(api: Api | null): ApplyReleasePort {
  const once = createPayloadRequestId();
  const todos = createServerTodoPort(api);
  const config = opsConfigClient(api);

  /** 지금 글 — 그새 지워졌으면 null(`BUG_NOT_FOUND`), 못 읽으면 던진다. */
  async function readBug(number: string) {
    try {
      return toFixBug(
        await portCall(
          api,
          (a) => a.get<unknown>(`${BUGS}/${encodeURIComponent(number)}`),
          '제보를 불러오지 못했어요',
        ),
      );
    } catch (error) {
      if (isPortError(error, 'notFound') && error.code === 'BUG_NOT_FOUND') return null;
      throw error;
    }
  }

  async function template(): Promise<Versioned<ReleaseTemplate>> {
    const s = await config.read(TEMPLATE_KEY);
    const effective = wireString(s.effective, '답변 틀');
    const fallback = wireString(s.default, '답변 틀의 기본 문구');
    return {
      // 저장한 값이 없으면 지금 먹는 값이 기본 문구다(서버 약속).
      value: { saved: effective === fallback ? null : effective, fallback },
      version: s.version,
      raw: { effective: s.effective, defaults: s.default },
    };
  }

  async function saveTemplate(from: Versioned<ReleaseTemplate>, tpl: string | null): Promise<void> {
    if (tpl === null) await config.clear(TEMPLATE_KEY, from.version);
    else await config.write(TEMPLATE_KEY, from.version, tpl);
  }

  async function apply(targets: readonly FixTarget[], opts: ApplyOptions): Promise<ApplyResult> {
    if (opts.saveTpl && !opts.templateFrom)
      throw new Error('틀을 저장하려면 읽은 틀(templateFrom)이 필요해요');
    const texts = targets.map((t) => (opts.answer ? fillTemplate(opts.template, tplVars(t), Infinity) : ''));
    if (opts.answer && texts.some((x) => !x))
      return {
        ok: false,
        reason: '채우고 나면 빈 답변이 되는 제보가 있어요 — 템플릿에 {title} 말고 글을 넣어 주세요',
      };
    if (!targets.length) return { ok: true, applied: 0, skipped: 0, notified: 0 };

    const body = {
      release: opts.latest,
      items: targets.map((t, i) => ({
        number: t.rid,
        ...(t.seenLastAnswerAt ? { seenLastAnswerAt: t.seenLastAnswerAt } : {}),
        ...(opts.answer ? { text: texts[i] } : {}),
      })),
    };
    const answer = wireObject(
      await portCall(
        api,
        (a) =>
          once(body, (requestId) => a.send<unknown>('POST', RELEASE_FIXES, { body: { requestId, ...body } })),
        '반영하지 못했어요',
      ),
      '릴리스 반영 결과',
    );
    const fixed = wireArray(answer.fixed, '릴리스 반영 결과의 fixed').map((row) => {
      const o = wireObject(row, '릴리스 반영 결과의 fixed 줄');
      wireString(o.number, '릴리스 반영 결과의 fixed 줄의 number');
      return wireBool(o.answered, '릴리스 반영 결과의 fixed 줄의 answered');
    });
    const skipped = wireArray(answer.skipped, '릴리스 반영 결과의 skipped').map((row) => {
      const o = wireObject(row, '릴리스 반영 결과의 skipped 줄');
      wireString(o.number, '릴리스 반영 결과의 skipped 줄의 number');
      wireString(o.status, '릴리스 반영 결과의 skipped 줄의 status');
    });
    const result: Extract<ApplyResult, { ok: true }> = {
      ok: true,
      applied: fixed.length,
      skipped: skipped.length,
      notified: fixed.filter(Boolean).length,
    };
    if (opts.saveTpl && opts.templateFrom) {
      try {
        await saveTemplate(opts.templateFrom, opts.template);
      } catch (error) {
        // 반영은 이미 됐다 — 틀만 못 저장한 일을 결과에 실어 알린다.
        result.templateError = error instanceof Error ? error.message : String(error);
      }
    }
    return result;
  }

  return {
    check: () => null,
    fill: (tpl, vars) => fillTemplate(tpl, vars, Infinity),
    template: () => template(),
    saveTemplate,
    async preview(latest) {
      const fixes = releasedReports(await todos.list(), latest);
      const bugs = await Promise.all(fixes.map((f) => readBug(f.rid)));
      const found = fixTargets(fixes, new Map(fixes.map((f, i) => [f.rid, bugs[i]?.item ?? null])));
      const seen = new Map(fixes.map((f, i) => [f.rid, bugs[i]?.lastAnswerAt ?? null]));
      return found.map((t) => ({ ...t, seenLastAnswerAt: seen.get(t.rid) ?? null }));
    },
    apply,
  };
}

/** `api` 마다 하나 — 다시 보낼 요청 번호를 들고 있다(`resetPortState` 가 비운다). */
export const createServerApplyReleasePort = perApi(build);

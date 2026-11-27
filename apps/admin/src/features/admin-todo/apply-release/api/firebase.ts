// Firebase 판 — 지금 코드 그대로: 제보 줄을 쓰기 직전에 다시 읽어 상태 · 답변 · 알림 · 작업 기록을 한 db.commit 으로 쓴다.
import { listTodos } from '@/entities/admin/todo';
import {
  answerId,
  answerWrite,
  BUG_NOTICE_TITLE,
  BUG_STATUS,
  getBugItem,
  isOpen,
  statusWrite,
} from '@/entities/bug-board';
import { inboxMessageWrite } from '@/entities/inbox';
import { auditEntry, unversioned, type Db } from '@/shared/api';
import {
  checkTemplate,
  fillTemplate,
  fixNoticeBody,
  fixTargets,
  releasedReports,
  RELEASE_TPL_DEFAULT,
  tplVars,
  type ApplyOptions,
  type ApplyResult,
  type FixTarget,
} from '../model/applyRelease';
import { RELEASE_TPL_PATH } from '../model/releaseTpl';
import type { ApplyReleasePort } from './port';

/** 저장된 템플릿 — 없거나 모양이 틀리면 null(기본 문구). */
export async function getReleaseTpl(db: Db): Promise<string | null> {
  const v = await db.get<unknown>(RELEASE_TPL_PATH);
  return typeof v === 'string' && v.trim() ? v : null;
}

/** 저장(null 이면 지워서 기본 문구로) + 작업 기록 한 줄. 템플릿은 비밀이 아니라 기록에 앞부분을 남긴다. */
export function releaseTplWrite(db: Db, tpl: string | null): Record<string, unknown> {
  const value = tpl === null ? null : tpl.trim();
  return {
    [RELEASE_TPL_PATH]: value,
    ...auditEntry(
      db,
      'todo.releaseTpl',
      value === null ? '기본 문구로 되돌림' : '템플릿 저장',
      value ?? undefined,
    ),
  };
}

export function saveReleaseTpl(db: Db, tpl: string | null): Promise<void> {
  return db.commit(releaseTplWrite(db, tpl));
}

/** 확인 창에 보일 목록 — 할 일은 새로 받고, 제보는 걸린 것만 줄 하나씩 읽는다(목록 통째로 받지 않는다). */
export async function previewReleaseFixes(db: Db, latest: string): Promise<FixTarget[]> {
  const fixes = releasedReports(await listTodos(db), latest);
  const items = await Promise.all(fixes.map((f) => getBugItem(db, f.rid)));
  return fixTargets(fixes, new Map(fixes.map((f, i) => [f.rid, items[i]])));
}

/**
 * 반영 — 제보 줄을 쓰기 직전에 다시 읽어(그새 바뀌었으면 건너뜀 · ansN 은 최신 기준) 상태 · 답변 · 알림 · 작업 기록을
 * 한 묶음으로. 하나라도 막히면 아무것도 남지 않는다.
 * 작업 기록은 제보마다 손으로 바꿀 때와 같은 줄(bug.answer · bug.status) + 반영 한 줄(todo.applyRelease).
 * 대상은 제보 번호(없으면 id) — 비공개 글 제목은 남기지 않는다.
 */
export async function applyReleaseFixes(
  db: Db,
  targets: readonly FixTarget[],
  opts: ApplyOptions,
): Promise<ApplyResult> {
  if (opts.answer || opts.saveTpl) {
    const bad = checkTemplate(opts.template);
    if (bad) return { ok: false, reason: bad };
  }
  const fresh = await Promise.all(targets.map((t) => getBugItem(db, t.item.id)));
  const live = targets.flatMap((t, i) => {
    const item = fresh[i];
    return item && isOpen(item.status) ? [{ ...t, item }] : [];
  });
  const texts = live.map((t) => (opts.answer ? fillTemplate(opts.template, tplVars(t)) : ''));
  if (opts.answer && texts.some((x) => !x))
    return {
      ok: false,
      reason: '채우고 나면 빈 답변이 되는 제보가 있어요 — 템플릿에 {title} 말고 글을 넣어 주세요',
    };
  if (!live.length) return { ok: true, applied: 0, skipped: targets.length, notified: 0 };

  const updates: Record<string, unknown> = {};
  let notified = 0;
  live.forEach((t, i) => {
    const { item } = t;
    const label = item.no ?? item.id;
    if (opts.answer) {
      const notify = item.code
        ? inboxMessageWrite(item.code, {
            tag: 'bug',
            title: BUG_NOTICE_TITLE,
            body: fixNoticeBody(item, t.release),
            bugId: item.id,
          })
        : {};
      if (item.code) notified++;
      const detail = `${item.vis === 'pub' ? '공개' : '비공개'} 답변 · ${BUG_STATUS.fixed} · ${t.release} 릴리스 반영${item.code ? '' : ' · 알림 없음'}`;
      Object.assign(
        updates,
        answerWrite(item, { text: texts[i], vis: item.vis, status: 'fixed' }, answerId(), db.now()),
        notify,
        auditEntry(db, 'bug.answer', label, detail),
      );
    } else {
      const detail = `${BUG_STATUS[item.status]} → ${BUG_STATUS.fixed} · ${t.release} 릴리스 반영`;
      Object.assign(updates, statusWrite(item, 'fixed'), auditEntry(db, 'bug.status', label, detail));
    }
  });
  const summary = `제보 ${live.length}건 수정 완료${opts.answer ? ` · 답변 · 알림 ${notified}건` : ' · 답변 없음'}`;
  Object.assign(
    updates,
    opts.saveTpl ? releaseTplWrite(db, opts.template) : {},
    auditEntry(db, 'todo.applyRelease', `${opts.latest} 릴리스 반영`, summary),
  );
  await db.commit(updates);
  return { ok: true, applied: live.length, skipped: targets.length - live.length, notified };
}

export function createFirebaseApplyReleasePort(db: Db): ApplyReleasePort {
  return {
    check: checkTemplate,
    fill: (tpl, vars) => fillTemplate(tpl, vars),
    template: async () => unversioned({ saved: await getReleaseTpl(db), fallback: RELEASE_TPL_DEFAULT }),
    saveTemplate: (_from, tpl) => saveReleaseTpl(db, tpl),
    preview: (latest) => previewReleaseFixes(db, latest),
    apply: (targets, opts) => applyReleaseFixes(db, targets, opts),
  };
}

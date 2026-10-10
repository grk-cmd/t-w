import { compareRelease, listTodos, releaseState, type Todo } from '@/entities/admin/todo';
import {
  answerId,
  answerNoticeBody,
  answerWrite,
  BUG_ANS_MAX,
  BUG_NOTICE_TITLE,
  BUG_STATUS,
  getBugItem,
  isOpen,
  statusWrite,
  type BugItem,
} from '@/entities/bug-board';
import { inboxMessageWrite } from '@/entities/inbox';
import { auditEntry, type Db } from '@/shared/api';
import { releaseTplWrite } from './releaseTpl';

/*
 * 🏷 릴리스 반영 — 완료 · 출시된(최신 공개 릴리스 이하) 할 일에 걸린 제보를 한꺼번에 «수정 완료» 로.
 * 손으로 상태를 바꾸거나 답변할 때와 같은 쓰기(statusWrite · answerWrite)를 제보마다 모아 한 db.commit 으로 보낸다.
 */

/** 제보 하나와 그 제보를 고친 할 일 — 여러 할 일에 걸렸으면 가장 먼저 나간 버전. */
export interface ReleaseFix {
  rid: string;
  release: string;
  /** 할 일 제목 — 템플릿 {todo}. */
  todo: string;
}

export interface FixTarget extends ReleaseFix {
  item: BugItem;
}

/** 완료 + 버전이 latest 이하인 할 일의 제보 — 겹치면 하나로(낮은 버전). 버전이 없거나 출시 전이면 뺀다. */
export function releasedReports(todos: readonly Todo[], latest: string | null | undefined): ReleaseFix[] {
  const out = new Map<string, ReleaseFix>();
  for (const t of todos) {
    if (t.status !== 'done' || releaseState(t.release, latest) !== 'released') continue;
    for (const rid of t.reports) {
      const prev = out.get(rid);
      if (!prev || compareRelease(t.release, prev.release) < 0)
        out.set(rid, { rid, release: t.release, todo: t.title });
    }
  }
  return [...out.values()];
}

/** 아직 미해결(접수 · 확인 중)인 제보만 — 수정 완료 · 재현 안 됨 · 지워진 글은 건드리지 않는다. 오래된 글부터. */
export function fixTargets(
  fixes: readonly ReleaseFix[],
  items: ReadonlyMap<string, BugItem | null>,
): FixTarget[] {
  return fixes
    .flatMap((f) => {
      const item = items.get(f.rid);
      return item && isOpen(item.status) ? [{ ...f, item }] : [];
    })
    .sort((a, b) => a.item.ts - b.item.ts || (a.rid < b.rid ? -1 : 1));
}

/** 확인 창에 보일 목록 — 할 일은 새로 받고, 제보는 걸린 것만 줄 하나씩 읽는다(목록 통째로 받지 않는다). */
export async function previewReleaseFixes(db: Db, latest: string): Promise<FixTarget[]> {
  const fixes = releasedReports(await listTodos(db), latest);
  const items = await Promise.all(fixes.map((f) => getBugItem(db, f.rid)));
  return fixTargets(fixes, new Map(fixes.map((f, i) => [f.rid, items[i]])));
}

export const RELEASE_TPL_DEFAULT = '{version} 에서 수정되어 릴리스되었습니다. 앱을 업데이트해 주세요 🙏';
// 채운 답변이 들어갈 칸(bugBoard/ans) 상한과 같다 — 규칙 config/releaseAnswerTpl 도 1000자.
export const RELEASE_TPL_MAX = BUG_ANS_MAX;
export const RELEASE_TPL_VARS = [
  { key: '{version}', label: '고친 버전' },
  { key: '{title}', label: '제보 제목 — 공개 글만, 비공개 글은 빈칸' },
  { key: '{todo}', label: '할 일 제목' },
] as const;

export interface TplVars {
  version: string;
  title: string;
  todo: string;
}

/** 비공개 글 제목은 넣지 않는다 — 답변은 비공개로 가더라도 화면 · 기록 어디에도 새지 않게 처음부터 뺀다. */
export const tplVars = (t: Pick<FixTarget, 'release' | 'todo' | 'item'>): TplVars => ({
  version: t.release,
  title: t.item.vis === 'pub' ? (t.item.title ?? '') : '',
  todo: t.todo,
});

/** 템플릿 → 답변 글. 빈 변수로 생긴 겹친 빈칸은 하나로. */
export function fillTemplate(tpl: string, v: TplVars): string {
  return tpl
    .replace(/\{(version|title|todo)\}/g, (_, k: keyof TplVars) => v[k])
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, RELEASE_TPL_MAX);
}

/** 템플릿 입력 확인 — 문제없으면 null. */
export function checkTemplate(tpl: string): string | null {
  const t = tpl.trim();
  if (!t) return '템플릿 내용 필요';
  if (t.length > RELEASE_TPL_MAX) return `템플릿은 ${RELEASE_TPL_MAX}자까지`;
  return null;
}

export interface ApplyOptions {
  /** 최신 공개 릴리스 — 기록에만. */
  latest: string;
  /** 답변 달기 — 켜면 답변 경로가 우편함 알림까지 보낸다(알림만 따로 보내지 않는다). */
  answer: boolean;
  template: string;
  /** 이번 템플릿을 기본(config/releaseAnswerTpl)으로도 저장. */
  saveTpl?: boolean;
}

export type ApplyResult =
  { ok: true; applied: number; skipped: number; notified: number } | { ok: false; reason: string };

/** 알림 본문 — 답변 알림과 같은 머리(비공개 글은 고정 문구) + 고친 버전. */
export const fixNoticeBody = (item: Pick<BugItem, 'vis' | 'title'>, release: string) =>
  `${answerNoticeBody(item.vis, item.title, false)}\n${release} 에서 고쳐졌어요`;

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

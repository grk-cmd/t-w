import { useState } from 'react';
import { BugNoText, useBugNo } from '@/entities/bug-board';
import { useReleaseDownloads } from '@/entities/release';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useModalDialog, useToast } from '@/shared/ui';
import {
  checkTemplate,
  fillTemplate,
  RELEASE_TPL_DEFAULT,
  RELEASE_TPL_MAX,
  RELEASE_TPL_VARS,
  tplVars,
  type ApplyResult,
  type FixTarget,
} from '../model/applyRelease';
import { useApplyRelease, usePreviewRelease } from '../model/useApplyRelease';
import styles from './ApplyRelease.module.css';

/** 한 줄 — 번호 · 공개 글은 제목, 비공개 글은 제목 없이. */
function FixRow({ t }: { t: FixTarget }) {
  const no = useBugNo(t.item);
  return (
    <li>
      <a href={`#/bugs/${t.item.id}`}>
        <BugNoText value={no} />
      </a>{' '}
      {t.item.vis === 'pub' ? t.item.title : <span className="soft">🔒 비공개 글</span>}
      <small className="soft">
        {' '}
        ← {t.todo} · {t.release}
      </small>
    </li>
  );
}

function doneMessage(r: Extract<ApplyResult, { ok: true }>, answer: boolean): string {
  if (!r.applied) return '반영할 제보 없음 — 그새 다른 관리자가 바꿨어요';
  const head = `제보 ${r.applied}건 수정 완료` + (answer ? ` · 답변 ${r.applied} · 알림 ${r.notified}` : '');
  return r.skipped ? `${head} · ${r.skipped}건은 그새 바뀌어 건너뜀` : head;
}

function Body({
  targets,
  saved,
  latest,
  onDone,
}: {
  targets: FixTarget[];
  saved: string | null;
  latest: string;
  onDone: () => void;
}) {
  const env = useEnv();
  const toast = useToast();
  const apply = useApplyRelease();
  const [answer, setAnswer] = useState(true);
  const [tpl, setTpl] = useState(saved ?? RELEASE_TPL_DEFAULT);
  const [saveTpl, setSaveTpl] = useState(false);
  const first = targets[0];
  const bad = answer || saveTpl ? checkTemplate(tpl) : null;

  const run = () => {
    if (bad) return toast(bad);
    apply.mutate(
      { targets, opts: { latest, answer, template: tpl, saveTpl } },
      {
        onSuccess: (r) => {
          if (!r.ok) return toast(r.reason);
          toast(doneMessage(r, answer));
          onDone();
        },
        onError: (e) => toast(errorMessage(e, '릴리스 반영 실패')),
      },
    );
  };

  return (
    <>
      <p>
        최신 공개 릴리스 <b>{latest}</b> 이하로 완료된 할 일에 걸린 미해결 제보 <b>{targets.length}건</b>을
        «수정 완료» 로 바꿔요.
      </p>
      <ul className={styles.rows}>
        {targets.map((t) => (
          <FixRow key={t.rid} t={t} />
        ))}
      </ul>
      <label className={styles.check}>
        <input type="checkbox" checked={answer} onChange={(e) => setAnswer(e.target.checked)} />
        답변 달기 — 제보자 우편함에도 알림이 가요 (끄면 상태만 바꾸고 알림 없음)
      </label>
      {answer && (
        <div className={styles.tpl}>
          <textarea
            rows={3}
            maxLength={RELEASE_TPL_MAX}
            aria-label="이번 답변 템플릿"
            value={tpl}
            onChange={(e) => setTpl(e.target.value)}
          />
          <small className="soft">
            {RELEASE_TPL_VARS.map((v) => `${v.key} ${v.label}`).join(' · ')} — 공개 글엔 공개 답변, 비공개
            글엔 비공개 답변으로 달려요
          </small>
          {first && (
            <p className={styles.preview}>
              <small className="soft">미리 보기 (첫 제보)</small>
              <br />
              {fillTemplate(tpl, tplVars(first)) || <span className="warn">빈 답변</span>}
            </p>
          )}
          <label className={styles.check}>
            <input type="checkbox" checked={saveTpl} onChange={(e) => setSaveTpl(e.target.checked)} />이
            템플릿을 기본으로 저장 (다른 관리자도 같이 써요)
          </label>
        </div>
      )}
      {bad && <p className="msg err">{bad}</p>}
      <div className={styles.foot}>
        <button type="button" className="btn primary" disabled={apply.isPending || !!bad} onClick={run}>
          {apply.isPending ? '반영 중…' : withProdMark(env, `${targets.length}건 반영`)}
        </button>
      </div>
    </>
  );
}

/** 🏷 릴리스 반영 — GitHub 최신 공개 릴리스(다운로드 · 배지와 같은 캐시)를 기준으로. 모르면 못 누른다. */
export function ApplyReleaseButton() {
  const toast = useToast();
  const releases = useReleaseDownloads();
  const latest = releases.data?.[0]?.version;
  const preview = usePreviewRelease();
  const [open, setOpen] = useState<{ targets: FixTarget[]; tpl: string | null; latest: string } | null>(null);
  const close = () => setOpen(null);
  const { dialogProps } = useModalDialog({ open: !!open, onClose: close });

  const onClick = () => {
    if (!latest) return;
    preview.mutate(latest, {
      onSuccess: ({ targets, tpl }) => {
        if (!targets.length) return toast('반영할 제보 없음');
        setOpen({ targets, tpl, latest });
      },
      onError: (e) => toast(errorMessage(e, '반영할 제보 불러오기 실패')),
    });
  };

  return (
    <>
      <button
        type="button"
        className="btn"
        disabled={!latest || preview.isPending}
        title={
          latest
            ? `최신 공개 릴리스 ${latest}`
            : releases.isLoading
              ? 'GitHub 릴리스 확인 중'
              : 'GitHub 최신 릴리스를 몰라요'
        }
        onClick={onClick}
      >
        {preview.isPending ? '확인 중…' : '🏷 릴리스 반영'}
      </button>
      <dialog {...dialogProps} className={styles.dialog} aria-label="릴리스 반영">
        <div className={styles.head}>
          <h2>🏷 릴리스 반영</h2>
          <button type="button" className="btn" onClick={close}>
            닫기
          </button>
        </div>
        {open && <Body targets={open.targets} saved={open.tpl} latest={open.latest} onDone={close} />}
      </dialog>
    </>
  );
}

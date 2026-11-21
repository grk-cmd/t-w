import { useState } from 'react';
import {
  BUG_DEFAULT_NOTICE,
  BUG_LINK_MAX,
  BUG_NOTICE_MAX,
  checkBugReport,
  useBugReport,
  useRefreshBugReport,
} from '@/entities/bug-report';
import { errorMessage, formatDate } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useSaveBugReport } from '../model/useSaveBugReport';
import styles from './BugReportCard.module.css';

interface Draft {
  notice: string;
  link: string;
}

export function BugReportCard() {
  const toast = useToast();
  const { data: report, error } = useBugReport();
  const refresh = useRefreshBugReport();
  const save = useSaveBugReport();
  // 저장된 적이 없으면 앱이 보여 주는 기본 글에서 시작한다.
  const [draft, setDraft] = useState<Draft | null>(null);
  const form = draft ?? {
    notice: report?.notice || BUG_DEFAULT_NOTICE,
    link: report?.link ?? '',
  };
  const edit = (patch: Partial<Draft>) => setDraft({ ...form, ...patch });

  const onSave = () => {
    const problem = checkBugReport(form.notice, form.link);
    if (problem) return toast(problem);
    save.mutate(form, {
      onSuccess: () => {
        setDraft(null);
        toast('버그 제보 공지를 저장했어요');
      },
      onError: (e) => toast(errorMessage(e, '저장하지 못했어요')),
    });
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>🐞 버그 제보 탭 문구</h2>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setDraft(null);
            refresh();
          }}
        >
          새로고침
        </button>
      </div>
      <p className="meta">
        {error && errorMessage(error, '현재 값을 불러오지 못했어요')}
        {!error && report === undefined && '불러오는 중…'}
        {report === null && '저장된 값 없음 · 기본 글 · [제보하기] 꺼짐'}
        {report &&
          `마지막 저장 · ${formatDate(report.ts)}${report.link ? '' : ' · 링크 없음 · [제보하기] 꺼짐'}`}
      </p>
      <textarea
        className={styles.textarea}
        rows={5}
        maxLength={BUG_NOTICE_MAX}
        placeholder="공지"
        value={form.notice}
        onChange={(e) => edit({ notice: e.target.value })}
      />
      <div className="field">
        <input
          type="text"
          maxLength={BUG_LINK_MAX}
          placeholder="제보 링크 (https)"
          title="비우면 [제보하기] 가 꺼져요"
          value={form.link}
          onChange={(e) => edit({ link: e.target.value })}
        />
        <button type="button" className="btn primary" disabled={save.isPending} onClick={onSave}>
          {save.isPending ? '저장 중…' : '저장'}
        </button>
      </div>
    </section>
  );
}

import { useState } from 'react';
import {
  checkUpdateNotice,
  NOTICE_BODY_MAX,
  NOTICE_TITLE_MAX,
  useRefreshUpdateNotice,
  useUpdateNotice,
} from '@/entities/update-notice';
import { errorMessage, formatDate } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useClearUpdateNotice, usePublishUpdateNotice } from '../model/useUpdateNotice';
import styles from './UpdateNoticeCard.module.css';

interface Draft {
  title: string;
  body: string;
}

export function UpdateNoticeCard() {
  const toast = useToast();
  const { data: notice, error } = useUpdateNotice();
  const refresh = useRefreshUpdateNotice();
  const publish = usePublishUpdateNotice();
  const clear = useClearUpdateNotice();
  // 손대기 전에는 지금 발행된 내용을 그대로 보여 준다.
  const [draft, setDraft] = useState<Draft | null>(null);
  const form = draft ?? { title: notice?.title ?? '', body: notice?.body ?? '' };
  const edit = (patch: Partial<Draft>) => setDraft({ ...form, ...patch });

  const onPublish = () => {
    const problem = checkUpdateNotice(form.title, form.body);
    if (problem) return toast(problem);
    publish.mutate(form, {
      onSuccess: () => {
        setDraft(null);
        toast('발행했어요 — 사람들이 앱을 켤 때 팝업으로 떠요');
      },
      onError: (e) => toast(errorMessage(e, '발행하지 못했어요 — 다시 시도해 주세요')),
    });
  };

  const onClear = () => {
    if (!confirm('지금 업데이트 공지를 삭제할까요?')) return;
    clear.mutate(undefined, {
      onSuccess: () => {
        setDraft(null);
        toast('삭제했어요');
      },
      onError: (e) => toast(errorMessage(e, '삭제하지 못했어요')),
    });
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>📰 업데이트 공지</h2>
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
      <p className="soft">
        앱을 켤 때 한 번 팝업으로 떠요. 다시 발행하면 «다시 보지 않기» 를 누른 사람에게도 다시 떠요.
      </p>
      <p className="meta">
        {error && errorMessage(error, '현재 공지를 불러오지 못했어요')}
        {!error && notice === undefined && '불러오는 중…'}
        {notice === null && '발행된 공지가 없어요'}
        {notice && `지금 발행된 공지 · ${formatDate(notice.ts)}`}
      </p>
      <div className="field">
        <input
          type="text"
          maxLength={NOTICE_TITLE_MAX}
          placeholder={`제목 (${NOTICE_TITLE_MAX}자까지)`}
          value={form.title}
          onChange={(e) => edit({ title: e.target.value })}
        />
      </div>
      <textarea
        className={styles.textarea}
        rows={7}
        maxLength={NOTICE_BODY_MAX}
        placeholder="본문 — 주소를 넣으면 앱에서 눌러 열 수 있어요"
        value={form.body}
        onChange={(e) => edit({ body: e.target.value })}
      />
      <div className={styles.actions}>
        <small className="soft grow">
          {form.body.length} / {NOTICE_BODY_MAX}
        </small>
        <button type="button" className="btn danger" disabled={!notice || clear.isPending} onClick={onClear}>
          {clear.isPending ? '삭제 중…' : '삭제'}
        </button>
        <button type="button" className="btn primary" disabled={publish.isPending} onClick={onPublish}>
          {publish.isPending ? '발행 중…' : notice ? '고쳐서 다시 발행' : '발행'}
        </button>
      </div>
    </section>
  );
}

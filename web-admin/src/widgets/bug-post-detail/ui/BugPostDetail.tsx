import { useEffect, useRef } from 'react';
import { BUG_CATS, StatusChip, useBugPost, useShortNo, type BugPost } from '@/entities/bug-board';
import { AnswerForm } from '@/features/bug-board/answer-post';
import { StatusButtons } from '@/features/bug-board/change-status';
import { errorMessage, formatDate } from '@/shared/lib';
import styles from './BugPostDetail.module.css';

function Body({ post }: { post: BugPost }) {
  const { item, content, answers } = post;
  const no = useShortNo(item);

  return (
    <>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2>{content?.title || '(제목 없음)'}</h2>
          <p className="soft">
            <code className="key">{no}</code> · {item.name || '이름 없음'}{' '}
            <span className="key">{item.code}</span> · {formatDate(item.ts)}
          </p>
        </div>
      </div>
      <div className={styles.badges}>
        <StatusChip status={item.status} />
        <span className={styles.badge}>{BUG_CATS[item.cat] ?? item.cat}</span>
        <span className={styles.badge}>
          {item.notice ? '📌 공지' : item.vis === 'pub' ? '공개' : '🔒 비공개'}
        </span>
        {item.vis === 'pub' && <span className={styles.badge}>👍 {item.likeN ?? 0}</span>}
        <span className={styles.badge}>답변 {item.ansN ?? 0}</span>
      </div>

      <section className={styles.section}>
        <h3>내용</h3>
        {content ? (
          <>
            <p className={styles.text}>{content.body}</p>
            {content.env && <p className="soft">환경 · {content.env}</p>}
          </>
        ) : (
          <p className="soft">내용 없음</p>
        )}
      </section>

      <section className={styles.section}>
        <h3>상태 변경</h3>
        <StatusButtons item={item} label={no} />
      </section>

      <section className={styles.section}>
        <h3>답변 {answers.length}</h3>
        {answers.length === 0 && <p className="soft">답변 없음</p>}
        {answers.map((a) => (
          <div key={`${a.vis}-${a.id}`} className={styles.answer}>
            <small className="soft">
              {a.vis === 'pub' ? '공개' : '🔒 비공개'} · {formatDate(a.ts)}
            </small>
            <p className={styles.text}>{a.text}</p>
            {a.kakao && (
              <a href={a.kakao} target="_blank" rel="noreferrer">
                💬 {a.kakao}
              </a>
            )}
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <h3>답변 등록</h3>
        <AnswerForm key={item.id} item={item} label={no} />
      </section>
    </>
  );
}

/** 오른쪽 패널 — 내용 · 답변 · 상태 변경 · 답변 등록. 여는 동안만 그 글을 읽는다. */
export function BugPostDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { data, error, isLoading } = useBugPost(id);
  const open = !!id;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.panel}
      // 안쪽 확인 창 등의 close 는 받지 않는다 — 이 패널 자신의 것만.
      onClose={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.close}>
        <button type="button" className="btn" onClick={onClose}>
          닫기
        </button>
      </div>
      {open && isLoading && <p className={`soft ${styles.pad}`}>불러오는 중…</p>}
      {open && error && (
        <p className={`msg err ${styles.pad}`}>{errorMessage(error, '제보 불러오기 실패')}</p>
      )}
      {open && !isLoading && !error && data === null && <p className={`soft ${styles.pad}`}>글 없음</p>}
      {open && data && <Body post={data} />}
    </dialog>
  );
}

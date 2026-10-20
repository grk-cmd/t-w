import { useState } from 'react';
import {
  answerEditChanges,
  BUG_ANS_MAX,
  BUG_KAKAO_MAX,
  checkAnswer,
  type AnswerEditInput,
  type BugAnswer,
} from '@/entities/bug-board';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useEditAnswer } from '../model/useEditAnswer';
import styles from './EditAnswerForm.module.css';

/** 운영자 답변 고치기 — 내용 · 오픈카톡 링크만. 저장하거나 취소하면 onDone. */
export function EditAnswerForm({
  postId,
  answer,
  label,
  onDone,
}: {
  postId: string;
  answer: BugAnswer;
  label: string;
  onDone: () => void;
}) {
  const env = useEnv();
  const toast = useToast();
  const edit = useEditAnswer(postId, answer, label);
  const [text, setText] = useState(answer.text);
  const [kakao, setKakao] = useState(answer.kakao ?? '');

  const onSave = () => {
    const input: AnswerEditInput = { text, kakao };
    const bad = checkAnswer(input);
    if (bad) return toast(bad);
    const changes = answerEditChanges(answer, input);
    if (!changes.length) return toast('바뀐 것 없음');
    const ask = `${label} 답변을 고칠까요? (${changes.join(' · ')})\n글쓴이에게 알림은 다시 가지 않아요.`;
    if (!confirm(withProdMark(env, ask))) return;
    edit.mutate(input, {
      onSuccess: (r) => {
        if (!r.ok) return toast(r.reason);
        toast(`${label} 답변 수정됨`);
        onDone();
      },
      onError: (e) => toast(errorMessage(e, '답변 수정 실패')),
    });
  };

  return (
    <div className={styles.form}>
      <textarea
        className={styles.text}
        aria-label="답변 내용"
        rows={4}
        maxLength={BUG_ANS_MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <input
        type="text"
        aria-label="오픈카톡 링크"
        maxLength={BUG_KAKAO_MAX}
        placeholder="오픈카톡 링크 (선택) — https://open.kakao.com/…"
        value={kakao}
        onChange={(e) => setKakao(e.target.value)}
      />
      <div className={styles.actions}>
        <small className="soft">
          {text.trim().length}/{BUG_ANS_MAX}
        </small>
        <button type="button" className="btn" disabled={edit.isPending} onClick={onDone}>
          취소
        </button>
        <button type="button" className="btn primary" disabled={edit.isPending} onClick={onSave}>
          {edit.isPending ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
}

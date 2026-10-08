import { useState } from 'react';
import {
  BUG_ANS_MAX,
  BUG_KAKAO_MAX,
  BUG_STATUS,
  BUG_STATUSES,
  checkAnswer,
  type AnswerInput,
  type BugItem,
  type BugStatus,
  type BugVis,
} from '@/entities/bug-board';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useAnswerPost } from '../model/useAnswerPost';
import styles from './AnswerForm.module.css';

/** 답변 등록 — 글쓴이 우편함 알림까지 한 번에. 비공개 글엔 비공개 답변만. */
export function AnswerForm({ item, label }: { item: BugItem; label: string }) {
  const toast = useToast();
  const answer = useAnswerPost(item.id, label);
  const [text, setText] = useState('');
  const [kakao, setKakao] = useState('');
  const [vis, setVis] = useState<BugVis>(item.vis);
  const [status, setStatus] = useState<BugStatus | ''>('');
  const prvOnly = item.vis === 'prv';

  const onSubmit = () => {
    const input: AnswerInput = { text, kakao, vis: prvOnly ? 'prv' : vis, ...(status ? { status } : {}) };
    const bad = checkAnswer(input);
    if (bad) return toast(bad);
    answer.mutate(input, {
      onSuccess: (r) => {
        if (!r.ok) return toast(r.reason);
        setText('');
        setKakao('');
        setStatus('');
        toast('답변 등록 · 알림 발송');
      },
      onError: (e) => toast(errorMessage(e, '답변 등록 실패')),
    });
  };

  return (
    <div className={styles.form}>
      <textarea
        className={styles.text}
        rows={4}
        maxLength={BUG_ANS_MAX}
        placeholder="답변 내용"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <input
        type="text"
        maxLength={BUG_KAKAO_MAX}
        placeholder="오픈카톡 링크 (선택) — https://open.kakao.com/…"
        value={kakao}
        onChange={(e) => setKakao(e.target.value)}
      />
      <div className={styles.row}>
        <label>
          <input
            type="radio"
            name={`vis-${item.id}`}
            checked={!prvOnly && vis === 'pub'}
            disabled={prvOnly}
            onChange={() => setVis('pub')}
          />
          공개 답변
        </label>
        <label>
          <input
            type="radio"
            name={`vis-${item.id}`}
            checked={prvOnly || vis === 'prv'}
            onChange={() => setVis('prv')}
          />
          비공개 답변
        </label>
        {prvOnly && <small className="soft">비공개 글 — 비공개 답변만</small>}
        <select
          className={styles.status}
          aria-label="답변과 함께 바꿀 상태"
          value={status}
          onChange={(e) => setStatus(e.target.value as BugStatus | '')}
        >
          <option value="">상태 유지 ({BUG_STATUS[item.status]})</option>
          {BUG_STATUSES.filter((st) => st !== item.status).map((st) => (
            <option key={st} value={st}>
              → {BUG_STATUS[st]}
            </option>
          ))}
        </select>
        <button type="button" className="btn primary" disabled={answer.isPending} onClick={onSubmit}>
          {answer.isPending ? '등록 중…' : '답변 등록'}
        </button>
      </div>
    </div>
  );
}

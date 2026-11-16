import { useState } from 'react';
import {
  RETURN_NOTE_MAX,
  RETURN_REASONS,
  returnArgs,
  type AdminLetter,
  type ReturnReason,
} from '@/entities/seasonal/xmas-event';
import { callErrorMessage } from '@/shared/api';
import { useToast } from '@/shared/ui';
import { useReturnLetter } from '../model/useReturnLetter';
import styles from './ReturnLetter.module.css';

const REASONS = Object.keys(RETURN_REASONS) as ReturnReason[];

interface Props {
  letter: AdminLetter;
  /** 마감 1분 전부터는 함수가 거절한다 — 단추를 막고 까닭을 보인다. */
  closed: boolean;
}

/** [반송] → 사유 고르기(기타는 직접 적기) → 확인. 쓴 사람에게는 사유가 알림함 · 편지 창에 보인다. */
export function ReturnLetterButton({ letter, closed }: Props) {
  const toast = useToast();
  const ret = useReturnLetter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReturnReason>('abuse');
  const [note, setNote] = useState('');
  const args = returnArgs(letter, reason, note);

  const onSubmit = async () => {
    if (!args) return;
    if (
      !confirm(`이 편지를 «${RETURN_REASONS[reason]}» 사유로 반송할까요? 쓴 사람에게 사유가 알림으로 가요.`)
    )
      return;
    try {
      const r = await ret.mutateAsync(args);
      toast(
        r.notified
          ? '반송했어요 — 쓴 사람에게 알림을 보냈어요'
          : '반송했어요 (알림함이 없는 계정이라 알림은 못 보냈어요)',
      );
      setOpen(false);
    } catch (e) {
      toast(callErrorMessage(e, '반송하지 못했어요'));
    }
  };

  if (!open)
    return (
      <button
        type="button"
        className="btn danger"
        disabled={closed}
        title={closed ? '마감이 가까워 반송할 수 없어요' : undefined}
        onClick={() => setOpen(true)}
      >
        반송
      </button>
    );
  return (
    <div className={styles.form}>
      <select
        value={reason}
        aria-label="반송 사유"
        onChange={(e) => setReason(e.target.value as ReturnReason)}
      >
        {REASONS.map((r) => (
          <option key={r} value={r}>
            {RETURN_REASONS[r]}
          </option>
        ))}
      </select>
      {reason === 'etc' && (
        <input
          type="text"
          value={note}
          maxLength={RETURN_NOTE_MAX}
          placeholder="사유를 적어 주세요"
          aria-label="기타 사유"
          onChange={(e) => setNote(e.target.value)}
        />
      )}
      <button type="button" className="btn danger" disabled={!args || ret.isPending} onClick={onSubmit}>
        {ret.isPending ? '보내는 중…' : '반송하기'}
      </button>
      <button type="button" className="btn" disabled={ret.isPending} onClick={() => setOpen(false)}>
        취소
      </button>
    </div>
  );
}

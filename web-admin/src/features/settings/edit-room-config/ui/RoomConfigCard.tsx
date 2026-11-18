import { REMOTE_CONFIG_EDIT_LOCKED, REMOTE_CONFIG_LOCK_NOTE, ROOM_LIMITS_EDIT_LOCKED } from '@/shared/config';
import { useState, type FormEvent } from 'react';
import {
  CHANNEL_LABEL,
  ROOM_LIMIT_CHANNELS,
  ROOM_MAX_PEOPLE_DEFAULT,
  roomMaxPeopleOf,
  totalLimitOf,
  useRoomLimits,
  useRoomMaxPeople,
} from '@/entities/room';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import {
  APPLY_NOTE,
  checkRoomLimits,
  checkRoomMaxPeople,
  roomLimitsConfirmText,
  roomMaxPeopleConfirmText,
  useSaveRoomLimits,
  useSaveRoomMaxPeople,
  type RoomLimitInputs,
} from '../model/editRoomConfig';
import styles from './RoomConfigCard.module.css';

type Message = { text: string; error: boolean } | null;

// 채널별 전체 방 상한 — API 판은 서버 설정 키 `room.limits`, Firebase 판은 config/roomLimits.
function RoomLimitsForm() {
  const env = useEnv();
  const { data: from, error, isPending } = useRoomLimits();
  const saved = from?.value;
  const save = useSaveRoomLimits();
  const [draft, setDraft] = useState<RoomLimitInputs | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const inputs: RoomLimitInputs = draft ?? {
    workingroom: String(totalLimitOf(saved, 'workingroom') ?? ''),
    togetherroom: String(totalLimitOf(saved, 'togetherroom') ?? ''),
  };
  const defaults = saved?.defaults;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!from) return;
    const r = checkRoomLimits(saved, inputs);
    if (!r.ok) return setMessage({ text: r.error, error: true });
    if (!confirm(withProdMark(env, roomLimitsConfirmText(saved, r.next)))) return;
    save.mutate(
      { from, next: r.next },
      {
        onSuccess: () => {
          setDraft(null);
          setMessage({ text: `저장 · ${APPLY_NOTE}`, error: false });
        },
        onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
      },
    );
  };

  if (error) return <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>;
  return (
    <>
      <form className={styles.row} onSubmit={submit}>
        <b>전체 방 상한</b>
        {ROOM_LIMIT_CHANNELS.map((ch) => (
          <label key={ch} className={styles.field}>
            {CHANNEL_LABEL[ch]}
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              aria-label={`${CHANNEL_LABEL[ch]} 전체 방 상한`}
              disabled={isPending || ROOM_LIMITS_EDIT_LOCKED}
              value={isPending ? '' : inputs[ch]}
              onChange={(e) => setDraft({ ...inputs, [ch]: e.target.value })}
            />
            {!isPending && saved?.saved[ch] == null && <small className="soft">기본값</small>}
          </label>
        ))}
        <button
          type="submit"
          className="btn primary"
          disabled={isPending || save.isPending || !draft || ROOM_LIMITS_EDIT_LOCKED}
        >
          {save.isPending ? '저장 중…' : '저장'}
        </button>
        <small className={`soft ${styles.hint}`}>
          채널마다 열 수 있는 방 수(시크릿룸 제외) ·{' '}
          {defaults
            ? `서버 기본 ${CHANNEL_LABEL.workingroom} ${defaults.workingroom} · ${CHANNEL_LABEL.togetherroom} ${defaults.togetherroom}`
            : '값이 없으면 앱이 자기 기본값을 씀'}{' '}
          · 낮춰도 열린 방은 그대로 — 새 방만 막음.
        </small>
      </form>
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </>
  );
}

// 방 하나 정원 — config/roomMaxPeople.
function RoomMaxPeopleForm() {
  const env = useEnv();
  const { data: from, error, isPending } = useRoomMaxPeople();
  const saved = from?.value;
  const save = useSaveRoomMaxPeople();
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const value = draft ?? String(roomMaxPeopleOf(saved));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!from) return;
    const r = checkRoomMaxPeople(saved, value);
    if (!r.ok) return setMessage({ text: r.error, error: true });
    if (!confirm(withProdMark(env, roomMaxPeopleConfirmText(saved, r.next)))) return;
    save.mutate(
      { from, next: r.next },
      {
        onSuccess: () => {
          setDraft(null);
          setMessage({ text: `저장 · 정원 ${r.next}명 · ${APPLY_NOTE}`, error: false });
        },
        onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
      },
    );
  };

  if (error) return <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>;
  return (
    <>
      <form className={styles.row} onSubmit={submit}>
        <label htmlFor="roomMaxPeople">
          <b>방 정원</b>
        </label>
        <span className={styles.field}>
          <input
            id="roomMaxPeople"
            type="text"
            inputMode="numeric"
            maxLength={2}
            disabled={isPending || REMOTE_CONFIG_EDIT_LOCKED}
            value={isPending ? '' : value}
            onChange={(e) => setDraft(e.target.value)}
          />
          명
        </span>
        <button
          type="submit"
          className="btn primary"
          disabled={isPending || save.isPending || draft === null || REMOTE_CONFIG_EDIT_LOCKED}
        >
          {save.isPending ? '저장 중…' : '저장'}
        </button>
        <small className={`soft ${styles.hint}`}>
          {!isPending && saved === null && `서버 값 없음 → 기본 ${ROOM_MAX_PEOPLE_DEFAULT}명 · `}방 하나에
          들어올 수 있는 사람 수 · 낮춰도 이미 방에 있는 사람은 그대로
        </small>
      </form>
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </>
  );
}

export function RoomConfigCard() {
  return (
    <section className="card">
      <h2>방 상한 · 정원</h2>
      <RoomLimitsForm />
      {REMOTE_CONFIG_EDIT_LOCKED && <p className="soft">방 정원 — {REMOTE_CONFIG_LOCK_NOTE}</p>}
      <RoomMaxPeopleForm />
    </section>
  );
}

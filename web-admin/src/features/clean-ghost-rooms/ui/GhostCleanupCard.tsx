import { useMemo } from 'react';
import { ghostCodes, useRoomIndex, useServerNow } from '@/entities/room';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useCleanGhostRooms } from '../model/useCleanGhostRooms';
import styles from './GhostCleanupCard.module.css';

export function GhostCleanupCard() {
  const toast = useToast();
  const { data: index } = useRoomIndex();
  const now = useServerNow();
  const clean = useCleanGhostRooms();
  const targets = useMemo(() => (index && now !== null ? ghostCodes(index, now) : null), [index, now]);

  const onClean = () => {
    if (!targets?.length) return;
    if (
      !confirm(
        `유령 방 ${targets.length}개를 지울까요?\n\n${targets.join(', ')}\n\n(대화 기록도 함께 지워져요)`,
      )
    )
      return;
    clean.mutate(targets, {
      onSuccess: ({ removed, revived }) =>
        toast(
          `유령 방 ${removed.length}개를 정리했어요` +
            (revived.length ? ` · 그새 다시 살아난 ${revived.length}개는 남겼어요` : ''),
        ),
      onError: (e) => toast(errorMessage(e, '청소하지 못했어요 — 아무것도 지워지지 않았어요')),
    });
  };

  return (
    <section className="card">
      <h2>🧹 유령 방 청소</h2>
      <p className="soft">
        마지막 신호가 90초 넘게 끊긴 방을 지워요. 지우기 직전에 한 번 더 확인해서 그새 살아난 방은 남겨요.
      </p>
      {targets && targets.length > 0 && (
        <div className={styles.chips}>
          {targets.map((code) => (
            <code key={code} className={styles.chip}>
              {code}
            </code>
          ))}
        </div>
      )}
      <div className="field">
        <span className="soft grow">
          {targets === null
            ? '불러오는 중…'
            : targets.length
              ? `대상 ${targets.length}개`
              : '정리할 유령 방이 없어요'}
        </span>
        <button
          type="button"
          className="btn danger"
          disabled={!targets?.length || clean.isPending}
          onClick={onClean}
        >
          {clean.isPending ? '청소 중…' : '청소'}
        </button>
      </div>
      <p className="soft">
        <small>
          목록(roomIndex)에서 빠진 채 방 데이터만 남은 유령은 여기서 보이지 않아요 — 앱의 «🧹 유령 방 청소» 를
          써 주세요.
        </small>
      </p>
    </section>
  );
}

import { useMemo } from 'react';
import { ghostCodes, useRoomCodes, useRoomIndex, useRoomProbes, useServerNow } from '@/entities/room';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useCleanGhostRooms } from '../model/useCleanGhostRooms';
import styles from './GhostCleanupCard.module.css';

export function GhostCleanupCard() {
  const toast = useToast();
  const { data: index } = useRoomIndex();
  const { data: codes } = useRoomCodes();
  const { data: probes } = useRoomProbes(index, codes);
  const now = useServerNow();
  const clean = useCleanGhostRooms();
  // 고아 방은 멤버 신호를 읽어 본 뒤에야 판정할 수 있어 그때까지 기다린다.
  const targets = useMemo(
    () => (index && codes && probes && now !== null ? ghostCodes(index, now, { codes, probes }) : null),
    [index, codes, probes, now],
  );

  const onClean = () => {
    if (!targets?.length) return;
    if (
      !confirm(
        `유령 방 ${targets.length}개를 지울까요?\n\n${targets.join(', ')}\n\n대화 기록도 함께 지워져요.`,
      )
    )
      return;
    clean.mutate(targets, {
      onSuccess: ({ removed, revived }) =>
        toast(
          `유령 방 ${removed.length}개를 정리했어요` +
            (revived.length ? ` · 그새 다시 살아난 ${revived.length}개는 남겼어요` : ''),
        ),
      onError: (e) => toast(errorMessage(e, '청소하지 못했어요. 지운 방은 없어요')),
    });
  };

  return (
    <section className="card">
      <h2 title="마지막 신호가 90초 넘게 끊긴 방 · roomIndex 에 없는 방 포함 · 시크릿룸 제외">
        🧹 유령 방 청소
      </h2>
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
    </section>
  );
}

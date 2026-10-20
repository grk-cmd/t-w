import { useEffect, useState } from 'react';
import {
  announceRemaining,
  ANNOUNCE_TEXT_MAX,
  useAnnounce,
  useRefreshAnnounce,
  useServerTimeOffset,
} from '@/entities/notice/announce';
import { errorMessage, formatDate } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useClearAnnounce, usePublishAnnounce } from '../model/useAnnounce';
import styles from './AnnounceCard.module.css';

export function AnnounceCard() {
  const toast = useToast();
  const { data: announce, error } = useAnnounce();
  const { data: offset = 0 } = useServerTimeOffset();
  const refresh = useRefreshAnnounce();
  const publish = usePublishAnnounce();
  const clear = useClearAnnounce();
  const [text, setText] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const remaining = announceRemaining(announce ?? null, now + offset);
  const live = remaining > 0;

  // 떠 있는 동안만 1초마다 다시 그린다 — 다시 받지는 않는다.
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live]);

  const onSend = () => {
    const t = text.trim();
    if (!t) return toast('공지 문구를 입력해 주세요');
    publish.mutate(t, {
      onSuccess: () => {
        setText('');
        setNow(Date.now());
        toast('공지를 보냈어요 (1분간 표시)');
      },
      onError: (e) => toast(errorMessage(e, '보내지 못했어요')),
    });
  };

  const onClear = () => {
    if (!confirm('확성기 공지를 지금 끌까요?')) return;
    clear.mutate(undefined, {
      onSuccess: () => toast('공지를 껐어요'),
      onError: (e) => toast(errorMessage(e, '끄지 못했어요')),
    });
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>📣 확성기 공지</h2>
        <button type="button" className="btn" onClick={refresh}>
          새로고침
        </button>
      </div>
      <div className={styles.current}>
        {error && errorMessage(error, '현재 공지를 불러오지 못했어요')}
        {!error && announce === undefined && '불러오는 중…'}
        {announce === null && <span className="soft">보낸 공지가 없어요</span>}
        {announce && (
          <>
            <b className={live ? styles.live : 'soft'}>
              {live ? `지금 표시 중 · ${Math.ceil(remaining / 1000)}초 남음` : '끝남'}
            </b>
            <span className={styles.text}>{announce.text}</span>
            <small className="soft">{formatDate(announce.ts)}</small>
          </>
        )}
      </div>
      <div className="field">
        <input
          type="text"
          maxLength={ANNOUNCE_TEXT_MAX}
          placeholder="공지 문구"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && onSend()}
        />
        <button type="button" className="btn primary" disabled={publish.isPending} onClick={onSend}>
          {publish.isPending ? '보내는 중…' : '보내기'}
        </button>
        <button
          type="button"
          className="btn danger"
          disabled={!announce || clear.isPending}
          onClick={onClear}
        >
          {clear.isPending ? '끄는 중…' : '지금 끄기'}
        </button>
      </div>
    </section>
  );
}

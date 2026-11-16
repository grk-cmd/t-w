import {
  canReturn,
  shortUid,
  useLetterAuthors,
  useRefreshXmas,
  useUserLetters,
  useXmasServerNow,
  youtubeUrl,
} from '@/entities/seasonal/xmas-event';
import { ReturnLetterButton } from '@/features/xmas/return-letter';
import { errorMessage, formatDate, usePaging } from '@/shared/lib';
import { Pager } from '@/shared/ui';
import styles from './XmasLetterList.module.css';

// 한 사람의 편지함 — 쪽에 보이는 사람만 읽는다(편지 다섯 통 · 수 KB).
function AuthorLetters({ uid, closed }: { uid: string; closed: boolean }) {
  const { data, error, isLoading } = useUserLetters(uid);
  return (
    <div className={styles.author}>
      <div className={styles.who}>
        <code className="key" title={uid}>
          {shortUid(uid)}
        </code>
        <small className="soft">{data ? `${data.length}통` : isLoading ? '…' : ''}</small>
      </div>
      {error && <p className="msg err">{errorMessage(error, '편지를 불러오지 못했어요')}</p>}
      {data?.length === 0 && <p className="soft">맡긴 편지가 없어요(거뒀거나 반송됨)</p>}
      {data?.map((l) => (
        <div key={l.lid} className={`row ${styles.letter}`}>
          <div className={styles.body}>
            {/* 남이 쓴 글 — React 가 글자로 넣는다(HTML 로 읽지 않음) */}
            <p className={styles.text}>{l.text}</p>
            <small className="soft">
              {l.lid} · {formatDate(l.ts)}
              {l.song && (
                <>
                  {' · 🎵 '}
                  <a href={youtubeUrl(l.song)} target="_blank" rel="noreferrer">
                    {l.song.title || l.song.id}
                  </a>
                </>
              )}
            </small>
          </div>
          <div className={styles.actions}>
            <ReturnLetterButton letter={l} closed={closed} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 편지를 맡긴 사람 목록(키 이름만) → 쪽마다 그 사람들의 편지. */
export function XmasLetterList() {
  const authors = useLetterAuthors();
  const refresh = useRefreshXmas();
  const now = useXmasServerNow();
  const paging = usePaging(authors.data ?? [], 'xmasLetters');
  const closed = now == null || !canReturn(now);

  const onRefresh = () => {
    refresh.authors();
    for (const uid of paging.items) refresh.letters(uid);
  };

  return (
    <section className="card">
      <div className="card-head">
        <span className="soft grow">
          편지를 맡긴 사람{authors.data && ` · ${authors.data.length}명`} — 사람은 로그인 uid 로만 보여요
        </span>
        <button type="button" className="btn" onClick={onRefresh}>
          새로고침
        </button>
      </div>
      {now != null && !canReturn(now) && (
        <p className="msg">
          편지 마감(12월 24일 23:59)이 가까워 반송할 수 없어요. 맡긴 편지는 25일 0시에 전달돼요.
        </p>
      )}
      {authors.error && (
        <p className="msg err">{errorMessage(authors.error, '편지 목록을 불러오지 못했어요')}</p>
      )}
      {!authors.error && !authors.data && <p className="soft">불러오는 중…</p>}
      {authors.data?.length === 0 && <p className="soft">아직 맡긴 편지가 없어요</p>}
      {authors.data && authors.data.length > 0 && (
        <>
          <div className="list">
            {paging.items.map((uid) => (
              <AuthorLetters key={uid} uid={uid} closed={closed} />
            ))}
          </div>
          <Pager paging={paging} />
        </>
      )}
    </section>
  );
}

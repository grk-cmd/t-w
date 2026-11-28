import { newsFor, useSite, type SiteState } from '@/entities/site';
import { useI18n } from '@/shared/i18n';
import { Win } from '@/shared/ui';

/** 📰 소식 · 업데이트 창 — 관리자가 웹 관리자에서 쓴 글(언어마다 따로)을 서버 공개 길에서 읽는다.
    받는 중 · 못 받음(다시 시도) · 글 없음 · 글 목록을 가른다 — 못 받았을 때 «글 없음» 으로 보이지 않게 */
export function NewsSlot() {
  const { state, retry } = useSite();
  return <NewsView state={state} retry={retry} />;
}

/** 받은 상태를 그리기만 — 시험이 상태마다 그려 본다 */
export function NewsView({ state, retry }: { state: SiteState; retry: () => void }) {
  const { m, lang } = useI18n();
  const list = state.s === 'ready' ? newsFor(state.site.news, lang) : [];
  const day = new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <Win title={m.newsTitle} controls className="news">
      {state.s === 'ready' && list.length > 0 ? (
        <ul className="field news-list">
          {list.map((n) => (
            <li key={n.id}>
              <p className="news-head">
                {n.pinned && (
                  <span className="news-pin" role="img" aria-label={m.newsPinned}>
                    📌
                  </span>
                )}
                <b>{n.title[lang]}</b>
                <time dateTime={new Date(n.publishedAt).toISOString()}>{day.format(n.publishedAt)}</time>
              </p>
              {n.body[lang] && <p className="news-body">{n.body[lang]}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="field news-empty" aria-live="polite">
          {state.s === 'loading' && <p>{m.newsLoading}</p>}
          {state.s === 'failed' && (
            <p>
              {m.newsFailed}{' '}
              <button className="btn" type="button" onClick={retry}>
                {m.retry}
              </button>
            </p>
          )}
          {state.s === 'ready' && <p>{m.newsEmpty}</p>}
        </div>
      )}
    </Win>
  );
}

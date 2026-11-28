import { useState, type FormEvent } from 'react';
import {
  checkNewsDraft,
  emptyNewsDraft,
  newsToDraft,
  sameNews,
  SITE_BODY_MAX,
  SITE_LANG_LABEL,
  SITE_LANGS,
  SITE_TITLE_MAX,
  isSiteConflict,
  siteErrorMessage,
  useSiteNews,
  type SiteNews,
  type SiteNewsDraft,
} from '@/entities/homepage/site';
import { isPortError, useEnv, withProdMark } from '@/shared/api';
import { formatDate } from '@/shared/lib';
import { useSiteNewsEdit } from '../model/useSiteNewsEdit';
import styles from './SiteNewsCard.module.css';

type Message = { text: string; error: boolean } | null;
const CONFLICT =
  '다른 곳에서 먼저 고쳤거나 내렸어요 — 목록을 다시 불러왔어요. 글을 다시 [고치기] 로 열어 주세요';

/** 🌐 홈페이지(together-working.com) 📰 소식 창 글 — 언어마다 따로 쓴다. 그 언어 제목이 있는 글만 그 언어 페이지에 보인다 */
export function SiteNewsCard() {
  const env = useEnv();
  const { data: list, error, isPending } = useSiteNews();
  const edit = useSiteNewsEdit();
  /** 고치는 글(null 이면 새 글) */
  const [editing, setEditing] = useState<SiteNews | null>(null);
  const [draft, setDraft] = useState<SiteNewsDraft>(emptyNewsDraft);
  const [message, setMessage] = useState<Message>(null);
  const busy = edit.create.isPending || edit.update.isPending || edit.remove.isPending;

  const reset = () => {
    setEditing(null);
    setDraft(emptyNewsDraft());
  };
  /** 409 · 404 면 들고 있던 글(옛 판)로는 다시 저장할 수 없다 — 고치기를 끝내고 새로 열게 한다 */
  const fail = (err: unknown, fallback: string) => {
    const stale = isSiteConflict(err) || isPortError(err, 'notFound');
    if (stale) reset();
    setMessage({ text: stale ? CONFLICT : siteErrorMessage(err, fallback), error: true });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = checkNewsDraft(draft);
    if (!r.ok) return setMessage({ text: r.error, error: true });
    if (editing && sameNews(r.next, newsToDraft(editing)))
      return setMessage({ text: '바뀐 게 없어요', error: true });
    const verb = editing ? '고쳐요' : '올려요';
    if (
      !confirm(
        withProdMark(env, `홈페이지 소식을 ${verb} — 홈페이지에 바로 보여요.\n제목: ${r.next.title.ko}`),
      )
    )
      return;
    const done = {
      onSuccess: () => (reset(), setMessage({ text: editing ? '고쳤어요' : '올렸어요', error: false })),
    };
    if (editing)
      edit.update.mutate(
        { from: editing, draft: r.next },
        { ...done, onError: (err) => fail(err, '고치기 실패') },
      );
    else edit.create.mutate(r.next, { ...done, onError: (err) => fail(err, '올리기 실패') });
  };

  const remove = (n: SiteNews) => {
    if (!confirm(withProdMark(env, `이 소식을 내려요 — 홈페이지에서 사라져요.\n제목: ${n.title.ko}`))) return;
    edit.remove.mutate(n, {
      onSuccess: () => {
        if (editing?.id === n.id) reset();
        setMessage({ text: '내렸어요', error: false });
      },
      onError: (err) => fail(err, '내리기 실패'),
    });
  };

  const setText = (part: 'title' | 'body', lang: (typeof SITE_LANGS)[number], value: string) =>
    setDraft((d) => ({ ...d, [part]: { ...d[part], [lang]: value } }));

  return (
    <section className="card">
      <h2>🌐 홈페이지 소식</h2>
      <p className="soft">
        홈페이지 첫 화면 «📰 소식 · 업데이트» 창에 보여요. 언어마다 따로 써요 — 제목을 쓴 언어 페이지에만
        보이고, 언어마다 📌 고정 글 전부와 최신 5개까지 보여요.
      </p>
      {error ? (
        <p className="msg err">{siteErrorMessage(error, '불러오기 실패')}</p>
      ) : isPending ? (
        <p className="soft">불러오는 중…</p>
      ) : list && list.length === 0 ? (
        <p className="soft">올린 소식이 없어요.</p>
      ) : (
        <ul className={styles.list}>
          {list?.map((n) => (
            <li key={n.id} className={editing?.id === n.id ? styles.editing : undefined}>
              <span className={styles.title}>
                {n.pinned && <span aria-label="고정">📌 </span>}
                {n.title.ko}
              </span>
              <small className="soft">
                {SITE_LANGS.filter((l) => n.title[l])
                  .map((l) => SITE_LANG_LABEL[l])
                  .join(' · ')}{' '}
                · {formatDate(n.publishedAt)}
              </small>
              <span className={styles.actions}>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => (setEditing(n), setDraft(newsToDraft(n)), setMessage(null))}
                >
                  고치기
                </button>
                <button type="button" className="btn danger" disabled={busy} onClick={() => remove(n)}>
                  내리기
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className={styles.form}>
        <h3>{editing ? `고치기 — ${editing.title.ko}` : '새 소식'}</h3>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={draft.pinned}
            disabled={busy}
            onChange={(e) => setDraft((d) => ({ ...d, pinned: e.target.checked }))}
          />
          📌 맨 위에 고정
        </label>
        {SITE_LANGS.map((l) => (
          <fieldset key={l} className={styles.lang}>
            <legend>
              {SITE_LANG_LABEL[l]}
              {l === 'ko' ? ' (제목 꼭)' : ' (안 쓰면 그 언어 페이지엔 안 보여요)'}
            </legend>
            <input
              className={styles.input}
              maxLength={SITE_TITLE_MAX}
              placeholder={`제목 · ${SITE_TITLE_MAX}자까지`}
              aria-label={`${SITE_LANG_LABEL[l]} 제목`}
              value={draft.title[l]}
              disabled={busy}
              onChange={(e) => setText('title', l, e.target.value)}
            />
            <textarea
              className={styles.input}
              rows={3}
              maxLength={SITE_BODY_MAX}
              placeholder={`본문(선택) · ${SITE_BODY_MAX}자까지 · 줄바꿈 그대로 보여요`}
              aria-label={`${SITE_LANG_LABEL[l]} 본문`}
              value={draft.body[l]}
              disabled={busy}
              onChange={(e) => setText('body', l, e.target.value)}
            />
          </fieldset>
        ))}
        <div className={styles.row}>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? '저장 중…' : editing ? '고치기 저장' : '올리기'}
          </button>
          {editing && (
            <button type="button" className="btn" disabled={busy} onClick={() => (reset(), setMessage(null))}>
              고치기 그만
            </button>
          )}
        </div>
      </form>
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}

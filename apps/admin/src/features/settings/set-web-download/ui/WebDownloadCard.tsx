import { useState, type FormEvent } from 'react';
import { isRateLimited, useReleaseDownloads } from '@/entities/release';
import {
  checkDownload,
  downloadConfirmText,
  siteErrorMessage,
  useSiteDownload,
} from '@/entities/homepage/site';
import { isApiConflict, useEnv, withProdMark } from '@/shared/api';
import { useSaveWebDownload } from '../model/useSaveWebDownload';
import styles from './WebDownloadCard.module.css';

type Message = { text: string; error: boolean } | null;
const FILE_LABEL = { win: 'Windows', macArm64: 'macOS(Apple 실리콘)', macX64: 'macOS(Intel)' } as const;

/** 💾 홈페이지 내려받기 — 열면 누구나 홈페이지에서 고른 판의 설치 파일(GitHub 릴리스)을 받는다. 닫으면 «준비 중» */
export function WebDownloadCard() {
  const env = useEnv();
  const { data: saved, error, isPending } = useSiteDownload();
  const releases = useReleaseDownloads();
  // 고를 수 있는 판 = 정식 릴리스(초안 · 베타 제외) 최근 순. 목록을 못 받았으면 null — 판을 바꿀 수 없다(서버가 다시 확인한다)
  const versions = releases.data?.map((r) => r.version) ?? null;
  const save = useSaveWebDownload();
  const [draft, setDraft] = useState<{ open: boolean; version: string | null } | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const form =
    draft ?? (saved ? { open: saved.open, version: saved.version } : { open: false, version: null });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!saved) return;
    const r = checkDownload(saved, form, versions);
    if (!r.ok) return setMessage({ text: r.error, error: true });
    if (!confirm(withProdMark(env, downloadConfirmText(r.next)))) return;
    save.mutate(r.next, {
      onSuccess: (d) => {
        setDraft(null);
        setMessage({ text: d.open ? `열었어요 · 판 ${d.version}` : '닫았어요', error: false });
      },
      onError: (err) => {
        setDraft(null);
        setMessage({
          text: isApiConflict(err)
            ? '다른 곳에서 먼저 고쳤어요 — 지금 값을 다시 불러왔어요'
            : siteErrorMessage(err, '저장 실패'),
          error: true,
        });
      },
    });
  };

  const choices = versions ?? (form.version ? [form.version] : []);
  return (
    <section className="card">
      <h2>💾 홈페이지 내려받기</h2>
      <p className="soft">
        열면 홈페이지 «내려받기» 단추가 고른 판의 설치 파일(GitHub 릴리스)로 이어져요 — 초대 코드 없이도
        누구나 받을 수 있어요. 닫으면 «준비 중» 으로 돌아가요.
      </p>
      {error ? (
        <p className="msg err">{siteErrorMessage(error, '불러오기 실패')}</p>
      ) : (
        <form onSubmit={submit}>
          <div className={styles.row}>
            <label className={styles.field}>
              <input
                type="checkbox"
                checked={form.open}
                disabled={isPending || save.isPending}
                onChange={(e) => (setDraft({ ...form, open: e.target.checked }), setMessage(null))}
              />
              홈페이지 내려받기 열기
            </label>
            <label className={styles.field}>
              판
              <select
                value={form.version ?? ''}
                disabled={isPending || save.isPending || versions === null}
                onChange={(e) => (setDraft({ ...form, version: e.target.value || null }), setMessage(null))}
              >
                <option value="">고르기</option>
                {choices.map((v) => (
                  <option key={v} value={v}>
                    {v}
                    {v === versions?.[0] ? ' (최신)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn primary" disabled={isPending || save.isPending || !draft}>
              {save.isPending ? '저장 중…' : '저장'}
            </button>
          </div>
          {releases.error && (
            <p className="msg err">
              {isRateLimited(releases.error)
                ? 'GitHub 릴리스 목록을 잠시 못 받아요(시간당 횟수 넘김) — 판은 지금 값만 볼 수 있어요'
                : 'GitHub 릴리스 목록을 못 받았어요 — 판은 지금 값만 볼 수 있어요'}
            </p>
          )}
          {saved && (
            <p className={`soft ${styles.files}`}>
              지금: {saved.open ? `열림 · 판 ${saved.version}` : '닫힘'}
              {saved.open &&
                ` · 파일 ${(Object.keys(FILE_LABEL) as (keyof typeof FILE_LABEL)[])
                  .map((k) => `${FILE_LABEL[k]} ${saved.files[k] ? '있음' : '없음'}`)
                  .join(' · ')}`}
            </p>
          )}
        </form>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}

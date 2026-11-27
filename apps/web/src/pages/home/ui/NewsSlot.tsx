import { useI18n } from '@/shared/i18n';
import { Win } from '@/shared/ui';

/** 📰 소식 · 업데이트 창 자리 — 글을 어디서 가져올지(서버 · 관리자 편집) 정하기 전이라 빈 안내만 둔다. */
export function NewsSlot() {
  const { m } = useI18n();
  return (
    <Win title={m.newsTitle} controls className="news">
      <div className="field news-empty">
        <p>{m.newsEmpty}</p>
      </div>
    </Win>
  );
}

import { lazy, Suspense, useSyncExternalStore } from 'react';
import { useI18n } from '@/shared/i18n';
import { Win } from '@/shared/ui';

// 3D(three · 몸 모델)는 무겁다 — 첫 화면 글은 미리 그린 HTML 로 바로 나오고, 생성기 덩이는 브라우저에서 따로 받는다
const Creator = lazy(() => import('@/widgets/creator').then((mod) => ({ default: mod.Creator })));

const noop = () => () => {};

/** 캐릭터 만들기 — 미리 그린 HTML 에는 «불러오는 중» 자리만, 브라우저가 이어 붙은 뒤에 생성기를 싣는다 */
export function MakerIntro() {
  const { m } = useI18n();
  // 미리 그릴 때 · 이어 붙일 때는 false, 그 뒤 브라우저에서 true — 미리 그린 HTML 과 첫 화면이 어긋나지 않는다
  const client = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const wait = <p className="soon-msg">{m.creator.loading}</p>;
  return (
    <section className="section wrap" id="maker" aria-labelledby="maker-title">
      <div className="sec-head">
        <h2 id="maker-title">{m.makerTitle}</h2>
        <p>{m.makerLead}</p>
      </div>
      <Win title={m.makerWinTitle} controls className="maker">
        {client ? <Suspense fallback={wait}>{<Creator />}</Suspense> : wait}
      </Win>
    </section>
  );
}

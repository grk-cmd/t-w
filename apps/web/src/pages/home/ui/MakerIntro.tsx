import { useI18n } from '@/shared/i18n';
import { Win } from '@/shared/ui';

/** 캐릭터 만들기 자리 — 3D 생성기(#440)가 들어오기 전까지는 안내만 */
export function MakerIntro() {
  const { m } = useI18n();
  return (
    <section className="section wrap" id="maker" aria-labelledby="maker-title">
      <div className="sec-head">
        <h2 id="maker-title">{m.makerTitle}</h2>
        <p>{m.makerLead}</p>
      </div>
      <Win title={m.makerWinTitle} controls className="maker">
        <div className="soon field">
          <p>{m.makerSoon}</p>
          <p className="soon-sub">{m.makerSoonSub}</p>
        </div>
      </Win>
    </section>
  );
}

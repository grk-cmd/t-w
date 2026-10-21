import { HELP_URL } from '@/shared/config';
import { useI18n } from '@/shared/i18n';
import { Win } from '@/shared/ui';

/** 내려받기 — 설치 파일 주소는 서버가 확인한 뒤 준다(#430). 그 길이 생기기 전까지 단추는 눌리지 않게 둔다. */
export function DownloadPanel() {
  const { m } = useI18n();
  return (
    <section className="section wrap" id="download" aria-labelledby="dl-title">
      <div className="sec-head">
        <h2 id="dl-title">{m.dlTitle}</h2>
        <p>{m.dlLead}</p>
      </div>
      <div className="end">
        <Win title={m.dlWinTitle}>
          <div className="row">
            <button className="btn big default" type="button" disabled aria-describedby="dl-soon">
              {m.dlWindows}
            </button>
            <button className="btn big" type="button" disabled aria-describedby="dl-soon">
              {m.dlMac}
            </button>
          </div>
          <p className="hint" id="dl-soon">
            {m.dlSoon}
          </p>
          <dl className="spec">
            <dt>{m.specOs}</dt>
            <dd>{m.specOsValue}</dd>
            <dt>{m.specJoin}</dt>
            <dd>{m.specJoinValue}</dd>
          </dl>
        </Win>
        <Win title={m.talkWinTitle}>
          <p className="hint">{m.talkLead}</p>
          <div className="row">
            <a className="btn" href={HELP_URL} target="_blank" rel="noopener noreferrer">
              {m.navHelp}
            </a>
          </div>
        </Win>
      </div>
    </section>
  );
}

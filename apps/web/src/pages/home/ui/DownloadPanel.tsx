import { downloadReady, useSite, type SiteState } from '@/entities/site';
import { HELP_URL } from '@/shared/config';
import { useI18n } from '@/shared/i18n';
import { DownloadIcon, Win } from '@/shared/ui';

/** 내려받기 — 관리자가 웹 관리자에서 연 때만 설치 파일(우리 GitHub 릴리스)로 잇는다. 주소는 서버가 준다(#430).
    받는 중 · 못 받음 · 닫힘이면 단추는 눌리지 않는다 — 모르는 상태로 열지 않게 */
export function DownloadPanel() {
  const { state, retry } = useSite();
  return <DownloadView state={state} retry={retry} />;
}

/** 받은 상태를 그리기만 — 시험이 상태마다 그려 본다 */
export function DownloadView({ state, retry }: { state: SiteState; retry: () => void }) {
  const { m } = useI18n();
  const dl = state.s === 'ready' && downloadReady(state.site.download) ? state.site.download : null;
  return (
    <section className="section wrap" id="download" aria-labelledby="dl-title">
      <div className="sec-head">
        <h2 id="dl-title">{m.dlTitle}</h2>
      </div>
      <div className="end">
        <Win title={m.dlWinTitle}>
          {dl ? (
            <>
              <div className="row">
                {dl.files.win && (
                  <a className="btn big default" href={dl.files.win}>
                    <DownloadIcon />
                    {m.dlWindows}
                  </a>
                )}
                {dl.files.macArm64 && (
                  <a className="btn big" href={dl.files.macArm64}>
                    <DownloadIcon />
                    {m.dlMacArm}
                  </a>
                )}
                {dl.files.macX64 && (
                  <a className="btn big" href={dl.files.macX64}>
                    <DownloadIcon />
                    {m.dlMacIntel}
                  </a>
                )}
              </div>
              {dl.version && <p className="hint">{m.dlVersion(dl.version)}</p>}
            </>
          ) : (
            <>
              <div className="row">
                <button className="btn big default" type="button" disabled aria-describedby="dl-soon">
                  <DownloadIcon />
                  {m.dlWindows}
                </button>
                <button className="btn big" type="button" disabled aria-describedby="dl-soon">
                  <DownloadIcon />
                  {m.dlMac}
                </button>
              </div>
              <p className="hint" id="dl-soon" aria-live="polite">
                {state.s === 'loading' && m.dlChecking}
                {state.s === 'ready' && m.dlSoon}
                {state.s === 'failed' && (
                  <>
                    {m.dlFailed}{' '}
                    <button className="btn" type="button" onClick={retry}>
                      {m.retry}
                    </button>
                  </>
                )}
              </p>
            </>
          )}
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

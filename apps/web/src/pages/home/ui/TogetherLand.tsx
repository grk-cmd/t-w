import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@/shared/i18n';
import { Win } from '@/shared/ui';

/** 투게더랜드 떡밥 — 아직 못 여는 바탕화면 아이콘. 누르면 잠긴 문 경고창(진행 막대는 꾸밈이라 실제 진행률이 아니다). */
export function TogetherLand() {
  const { m } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="land" type="button" aria-label={m.landAria} onClick={() => setOpen(true)}>
        <span className="land-ic">
          <svg viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
            <rect x="1" y="12" width="14" height="3" fill="#3A7BD5" />
            <rect x="0" y="13" width="16" height="1" fill="#5B95E0" />
            <rect x="3" y="10" width="10" height="2" fill="#E8C77A" />
            <rect x="4" y="8" width="8" height="2" fill="#5DBB63" />
            <rect x="5" y="3" width="6" height="1" fill="#7A5AA6" />
            <rect x="6" y="4" width="4" height="4" fill="#FF9BB3" />
            <rect x="7" y="6" width="2" height="2" fill="#6B3F57" />
            <rect x="10" y="0" width="1" height="4" fill="#3A3A3A" />
            <rect x="11" y="0" width="3" height="2" fill="#FFD84D" />
          </svg>
          <span className="lock" aria-hidden="true">
            🔒
          </span>
        </span>
        <span className="land-name">{m.landName}</span>
      </button>
      {open && <LockedDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function LockedDialog({ onClose }: { onClose: () => void }) {
  const { m } = useI18n();
  const id = useId();
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dlg.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={dlg} className="dlg" aria-labelledby={`${id}-t`} onClose={onClose}>
      <Win title={<span id={`${id}-t`}>{m.landName}</span>}>
        <div className="land-dlg">
          <span className="warn" aria-hidden="true">
            ⚠️
          </span>
          <div>
            <p>
              <b>{m.landLocked}</b>
            </p>
            <p>{m.landSound}</p>
            <p className="land-bar" aria-label="TOGETHER LAND 38%">
              TOGETHER LAND ▓▓▓▓▓
              <span className="blink" aria-hidden="true">
                ▓
              </span>
              ░░░░░ 38%
            </p>
          </div>
        </div>
        <div className="row end-row">
          <button className="btn default" type="button" onClick={() => dlg.current?.close()}>
            {m.landOk}
          </button>
        </div>
      </Win>
    </dialog>
  );
}

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '@/shared/i18n';
import { Win } from '@/shared/ui';
import { makeCloneCode, type WebCharacter } from '../lib/make-code';
import { saveText } from '../lib/save-text';

/** 내려받는 파일 이름 — 영문만(한글 이름은 일부 브라우저가 «download» 로 바꿔 받는다) */
const CODE_FILE = 'together-working-character.txt';

type Phase =
  | { t: 'form'; error?: string }
  | { t: 'making' }
  | { t: 'done'; code: string; copied: boolean; saved: boolean };

/** «앱으로 가져가기» — 비밀번호 두 번 → 코드 → 복사. 비밀번호 · 코드는 화면에만(어디에도 저장 · 전송하지 않는다). */
export function ExportDialog({
  getCharacter,
  onClose,
}: {
  getCharacter: () => WebCharacter;
  onClose: () => void;
}) {
  const { m } = useI18n();
  const c = m.creator;
  const id = useId();
  const [phase, setPhase] = useState<Phase>({ t: 'form' });
  const dlg = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dlg.current;
    if (d && !d.open) d.showModal();
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const p1 = String(f.get('p1') ?? '');
    const p2 = String(f.get('p2') ?? '');
    if (p1 !== p2) return setPhase({ t: 'form', error: c.exportPassMismatch });
    setPhase({ t: 'making' });
    try {
      setPhase({ t: 'done', code: await makeCloneCode(getCharacter(), p1), copied: false, saved: false });
    } catch {
      setPhase({ t: 'form', error: c.exportFailed });
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setPhase((p) => (p.t === 'done' ? { ...p, copied: true } : p));
    } catch {
      // 복사가 막힌 브라우저 — 글 칸이 선택돼 있으니 직접 복사하면 된다
    }
  }

  return (
    <dialog ref={dlg} className="dlg" aria-labelledby={`${id}-t`} onClose={onClose}>
      <Win title={<span id={`${id}-t`}>{c.exportTitle}</span>}>
        {phase.t === 'done' ? (
          <>
            <label htmlFor={`${id}-code`}>{c.exportCode}</label>
            <textarea
              id={`${id}-code`}
              className="field code"
              readOnly
              value={phase.code}
              rows={5}
              onFocus={(e) => e.currentTarget.select()}
            />
            <p className="hint">{c.exportHow}</p>
            <div className="row end-row">
              <button className="btn default" type="button" onClick={() => copy(phase.code)}>
                {phase.copied ? c.exportCopied : c.exportCopy}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  saveText(CODE_FILE, phase.code);
                  setPhase({ ...phase, saved: true });
                }}
              >
                {phase.saved ? c.exportSaved : c.exportSave}
              </button>
              <button className="btn" type="button" onClick={() => dlg.current?.close()}>
                {c.close}
              </button>
            </div>
          </>
        ) : (
          <form className="stack" onSubmit={submit}>
            <label htmlFor={`${id}-p1`}>{c.exportPass}</label>
            <input id={`${id}-p1`} name="p1" type="password" required autoComplete="new-password" />
            <label htmlFor={`${id}-p2`}>{c.exportPass2}</label>
            <input id={`${id}-p2`} name="p2" type="password" required autoComplete="new-password" />
            <p className="hint">{c.exportPassHint}</p>
            {phase.t === 'form' && phase.error && (
              <p className="err" role="alert">
                {phase.error}
              </p>
            )}
            <div className="row end-row">
              <button className="btn default" type="submit" disabled={phase.t === 'making'}>
                {phase.t === 'making' ? c.exportMaking : c.exportMake}
              </button>
              <button className="btn" type="button" onClick={() => dlg.current?.close()}>
                {c.close}
              </button>
            </div>
          </form>
        )}
      </Win>
    </dialog>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CharacterPreview, loadCharKit, type CharKit } from '@/entities/character';
import {
  createFaceTextures,
  createPartImages,
  DEFAULT_SELECTION,
  dragTargetOf,
  FaceTexturePanel,
  fetchWebParts,
  MakerPanel,
  PartArtProvider,
  setRemoteParts,
  useMaker,
  type RemoteLoad,
  type Selection,
} from '@/features/character-maker';
import { ExportDialog, type WebCharacter } from '@/features/clone-code';
import { useI18n } from '@/shared/i18n';
import { loadImage } from '@/shared/lib/image';

type Load = { t: 'loading' } | { t: 'failed' } | { t: 'ready'; kit: CharKit };
type Expr = 'open' | 'closed';

const hasWebgl = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl');
  } catch {
    return false;
  }
};

/** 웹 캐릭터 만들기 — 3D 미리보기 · 고르기 판 · 앱으로 가져가기. 브라우저에서만 그린다(몸 모델 · WebGL). */
export function Creator() {
  const { m } = useI18n();
  const c = m.creator;
  const [load, setLoad] = useState<Load>({ t: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const webgl = useMemo(() => hasWebgl(), []);

  useEffect(() => {
    if (!webgl) return;
    let alive = true;
    loadCharKit().then(
      (kit) => alive && setLoad({ t: 'ready', kit }),
      () => alive && setLoad({ t: 'failed' }),
    );
    return () => {
      alive = false;
    };
  }, [webgl, attempt]);

  if (!webgl) return <p className="soon-msg">{c.noWebgl}</p>;
  if (load.t === 'loading') return <p className="soon-msg">{c.loading}</p>;
  if (load.t === 'failed')
    return (
      <div className="soon-msg">
        <p role="alert">{c.loadFailed}</p>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setLoad({ t: 'loading' });
            setAttempt((n) => n + 1);
          }}
        >
          {c.retry}
        </button>
      </div>
    );
  return <CreatorReady kit={load.kit} />;
}

function CreatorReady({ kit }: { kit: CharKit }) {
  const { m } = useI18n();
  const c = m.creator;
  const { state, canUndo, act, live, commit, undo, random, reset } = useMaker();
  const ops = useMemo(() => ({ act, live, commit }), [act, live, commit]);
  const [expr, setExpr] = useState<Expr>('open');
  const [sel, setSel] = useState<Selection>(DEFAULT_SELECTION);
  const [exporting, setExporting] = useState(false);
  const tex = useMemo(() => createFaceTextures(kit), [kit]);
  // 관리자가 올린 그림 파츠 — 목록이 오거나 그림이 하나 불러질 때마다 rev 가 늘어 다시 그린다. 서버에 닿지 못하면 빈 칸에 안내(load).
  const [rev, setRev] = useState(0);
  const [load, setLoad] = useState<RemoteLoad>('loading');
  const images = useMemo(() => createPartImages(() => setRev((n) => n + 1)), []);
  useEffect(() => {
    let alive = true;
    void fetchWebParts().then((r) => {
      if (!alive) return;
      // 화면은 «못 불러옴» 안내 — 서버를 연 뒤 원인을 알 수 있게 까닭도 남긴다
      if (r.t === 'failed') {
        setLoad('failed');
        return console.warn('[웹 생성기 파츠] 못 불러옴 —', r.why);
      }
      setRemoteParts(r.parts);
      setLoad('ready');
      setRev((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, []);
  const art = useMemo(() => ({ images, rev, load }), [images, rev, load]);
  // 붙인 그림은 dataURL → 그림으로 풀어 둔다 — 지금 dataURL 과 짝이 맞을 때만 쓴다(바뀐 직후 옛 그림이 남지 않게)
  const [decoded, setDecoded] = useState<{ url: string; img: HTMLImageElement } | null>(null);
  const imgUrl = state.img?.dataUrl ?? null;
  useEffect(() => {
    if (!imgUrl) return;
    let alive = true;
    loadImage(imgUrl).then(
      (img) => alive && setDecoded({ url: imgUrl, img }),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [imgUrl]);
  const image = decoded && decoded.url === imgUrl ? decoded.img : null;

  const look = useMemo(
    () => ({
      faceTexture: tex.display,
      paintFace: () => tex.render(state, expr, image, art.images),
      top: state.top,
      bot: state.bot,
    }),
    [tex, state, expr, image, art],
  );

  const getCharacter = useCallback(
    (): WebCharacter => ({
      skin: state.skin,
      face: tex.face,
      blink: tex.blink,
      top: state.top,
      bot: state.bot,
    }),
    [state.skin, state.top, state.bot, tex],
  );

  return (
    <PartArtProvider value={art}>
      <div className="maker-body">
        <div className="stage">
          <div className="view field">
            <div className="turn" role="group">
              {(['open', 'closed'] as const).map((e) => (
                <button
                  key={e}
                  className="btn"
                  type="button"
                  aria-pressed={expr === e}
                  onClick={() => setExpr(e)}
                >
                  {e === 'open' ? c.exprOpen : c.exprClosed}
                </button>
              ))}
            </div>
            <CharacterPreview kit={kit} look={look} label={c.previewLabel} />
          </div>
          <FaceTexturePanel
            s={state}
            target={dragTargetOf(sel)}
            onGrabAcc={(uid) => setSel((v) => ({ ...v, acc: uid }))}
            ops={ops}
            skinColor={kit.skinSwatches[state.skin] ?? '#f2d2bd'}
            image={image}
          />
          <div className="row">
            <button className="btn" type="button" onClick={random}>
              {c.random}
            </button>
            <button className="btn" type="button" onClick={undo} disabled={!canUndo}>
              {c.undo}
            </button>
            <button className="btn" type="button" onClick={reset}>
              {c.startOver}
            </button>
          </div>
        </div>
        <div className="side">
          <MakerPanel s={state} ops={ops} skinSwatches={kit.skinSwatches} sel={sel} onSel={setSel} />
          <button className="btn default export" type="button" onClick={() => setExporting(true)}>
            <b>{c.exportBtn}</b>
            <small>{c.exportSub}</small>
          </button>
        </div>
        {exporting && <ExportDialog getCharacter={getCharacter} onClose={() => setExporting(false)} />}
      </div>
    </PartArtProvider>
  );
}

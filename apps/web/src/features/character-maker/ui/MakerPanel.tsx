import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { useI18n, type Lang } from '@/shared/i18n';
import {
  BOT_COLORS,
  EYE_COLORS,
  LAYERS,
  LIMITS,
  PAIRED,
  TOP_COLORS,
  findItem,
  type LayerKind,
} from '../model/catalog';
import { SKIN_COUNT, type Action, type Adjust, type CreatorState, type Side } from '../model/state';
import { drawItemThumb } from '../lib/draw-front';
import { fileToFaceImage } from '../lib/load-image';

type Tab = 'skin' | LayerKind | 'image' | 'cloth';

/** 고르기 판이 상태를 바꾸는 길 — act 는 한 번에 한 기록, live 는 끄는 동안(놓을 때 commit 이 한 기록으로 쌓는다) */
export interface MakerActions {
  act: (a: Action) => void;
  live: (a: Action) => void;
  commit: () => void;
}
const TABS: readonly Tab[] = ['skin', 'eyes', 'brows', 'mouth', 'cheek', 'image', 'cloth'];

function ItemThumb({ kind, id, color }: { kind: LayerKind; id: string; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawItemThumb(ctx, findItem(kind, id).open(color), 44);
  }, [kind, id, color]);
  return <canvas ref={ref} width={44} height={44} aria-hidden="true" />;
}

function Swatches({
  label,
  colors,
  value,
  onPick,
  custom,
}: {
  label: string;
  colors: readonly string[];
  value: string;
  onPick: (c: string) => void;
  /** 색 고르개 — 끄는 동안 live, 닫으면 commit */
  custom?: { label: string; live: (c: string) => void; commit: () => void };
}) {
  return (
    <div className="swatches" role="group" aria-label={label}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className="sw"
          style={{ background: c }}
          aria-label={c}
          aria-pressed={value.toLowerCase() === c.toLowerCase()}
          onClick={() => onPick(c)}
        />
      ))}
      {custom && (
        <label className="sw-custom">
          <input
            type="color"
            value={value}
            onChange={(e) => custom.live(e.currentTarget.value)}
            onBlur={custom.commit}
          />
          {custom.label}
        </label>
      )}
    </div>
  );
}

function AdjustBox({ kind, s, ops }: { kind: LayerKind; s: CreatorState; ops: MakerActions }) {
  const { m } = useI18n();
  const c = m.creator;
  const base = useId();
  const paired = PAIRED[kind];
  const [side, setSide] = useState<Side>(paired ? 'L' : 'C');
  // 대칭이면 왼쪽 짝을 보고 고친다(오른쪽은 거울로 따라간다) — 보는 짝과 고치는 짝이 늘 같아야 한다
  const shown: Side = paired ? (s.sym ? 'L' : side) : 'C';
  const cur = s.adj[kind][shown];
  if (!cur) return null;
  const rows: [keyof Adjust, string, number][] = [
    ['x', c.adjX, 1],
    ['y', c.adjY, 1],
    ['s', c.adjS, 0.01],
    ['r', c.adjR, 1],
  ];
  return (
    <div className="adj">
      <div className="adj-head">
        <span className="group-l">{c.adjustLabel}</span>
        {paired && (
          <>
            <button
              className="btn"
              type="button"
              aria-pressed={s.sym}
              onClick={() => ops.act({ t: 'sym', on: !s.sym })}
            >
              {c.sym}
            </button>
            {!s.sym && (
              <span className="seg" role="group">
                <button
                  className="btn"
                  type="button"
                  aria-pressed={side === 'L'}
                  onClick={() => setSide('L')}
                >
                  {c.left}
                </button>
                <button
                  className="btn"
                  type="button"
                  aria-pressed={side === 'R'}
                  onClick={() => setSide('R')}
                >
                  {c.right}
                </button>
              </span>
            )}
          </>
        )}
        <button className="btn" type="button" onClick={() => ops.act({ t: 'resetAdjust', kind })}>
          {c.reset}
        </button>
      </div>
      {rows.map(([key, label, step]) => (
        <div className="sl" key={key}>
          <label htmlFor={`${base}-${key}`}>{label}</label>
          <input
            id={`${base}-${key}`}
            type="range"
            min={LIMITS[key][0]}
            max={LIMITS[key][1]}
            step={step}
            value={cur[key]}
            onChange={(e) =>
              ops.live({ t: 'adjust', kind, side: shown, key, value: Number(e.currentTarget.value) })
            }
            onPointerUp={ops.commit}
            onBlur={ops.commit}
          />
          <output>{key === 's' ? cur[key].toFixed(2) : Math.round(cur[key])}</output>
        </div>
      ))}
    </div>
  );
}

function ImageBox({ s, act }: { s: CreatorState; act: (a: Action) => void }) {
  const { m } = useI18n();
  const c = m.creator;
  const id = useId();
  const [bad, setBad] = useState(false);
  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    const url = await fileToFaceImage(f);
    setBad(!url);
    if (url) act({ t: 'image', img: { dataUrl: url, pos: s.img?.pos ?? 'under', on: s.img?.on ?? 'both' } });
  }
  const img = s.img;
  return (
    <div className="imgbox">
      <p className="hint">{c.imageHint}</p>
      <div className="row">
        <label className="btn" htmlFor={`${id}-file`}>
          {c.imagePick}
        </label>
        <input
          id={`${id}-file`}
          className="vh"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={pick}
        />
        {img && (
          <button className="btn" type="button" onClick={() => act({ t: 'image', img: null })}>
            {c.imageRemove}
          </button>
        )}
      </div>
      {bad && (
        <p className="err" role="alert">
          {c.imageBad}
        </p>
      )}
      {img && (
        <>
          <fieldset>
            <legend>{c.imagePos}</legend>
            {(['under', 'top'] as const).map((v) => (
              <label key={v}>
                <input
                  type="radio"
                  name={`${id}-pos`}
                  checked={img.pos === v}
                  onChange={() => act({ t: 'image', img: { ...img, pos: v } })}
                />{' '}
                {v === 'under' ? c.imageUnder : c.imageTop}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>{c.imageOn}</legend>
            {(['both', 'open', 'closed'] as const).map((v) => (
              <label key={v}>
                <input
                  type="radio"
                  name={`${id}-on`}
                  checked={img.on === v}
                  onChange={() => act({ t: 'image', img: { ...img, on: v } })}
                />{' '}
                {v === 'both' ? c.imageBoth : v === 'open' ? c.imageOpenOnly : c.imageClosedOnly}
              </label>
            ))}
          </fieldset>
        </>
      )}
    </div>
  );
}

const itemName = (lang: Lang, n: Record<Lang, string>) => n[lang];

/** 고르기 판 — 탭(피부 · 눈 · 눈썹 · 입 · 볼 · 내 그림 · 옷 색) */
export function MakerPanel({
  s,
  ops,
  skinSwatches,
}: {
  s: CreatorState;
  ops: MakerActions;
  /** 피부 번호 차례의 단추 색 */
  skinSwatches: readonly string[];
}) {
  const act = ops.act;
  const { lang, m } = useI18n();
  const c = m.creator;
  const base = useId();
  const [tab, setTab] = useState<Tab>('skin');
  const label: Record<Tab, string> = {
    skin: c.tabSkin,
    eyes: c.tabEyes,
    brows: c.tabBrows,
    mouth: c.tabMouth,
    cheek: c.tabCheek,
    image: c.tabImage,
    cloth: c.tabCloth,
  };
  return (
    <div className="picker">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`${base}-${t}`}
            aria-selected={tab === t}
            aria-controls={`${base}-panel`}
            onClick={() => setTab(t)}
          >
            {label[t]}
          </button>
        ))}
      </div>
      <div className="panel" role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${tab}`}>
        {tab === 'skin' && (
          <div className="swatches" role="group" aria-label={c.skinLabel}>
            {skinSwatches.slice(0, SKIN_COUNT).map((col, i) => (
              <button
                key={i}
                type="button"
                className="sw"
                style={{ background: col }}
                aria-label={`${c.skinLabel} ${i + 1}`}
                aria-pressed={s.skin === i}
                onClick={() => act({ t: 'skin', skin: i })}
              />
            ))}
          </div>
        )}
        {(tab === 'eyes' || tab === 'brows' || tab === 'mouth' || tab === 'cheek') && (
          <>
            <p className="group-l">{c.shapeLabel}</p>
            <div className="items" role="group" aria-label={c.shapeLabel}>
              {LAYERS[tab].map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="item"
                  aria-pressed={s[tab] === it.id}
                  onClick={() => act({ t: 'item', kind: tab, id: it.id })}
                >
                  <ItemThumb kind={tab} id={it.id} color={s.eyeColor} />
                  <span>{itemName(lang, it.name)}</span>
                </button>
              ))}
            </div>
            {tab === 'eyes' && (
              <>
                <p className="group-l">{c.colorLabel}</p>
                <Swatches
                  label={c.colorLabel}
                  colors={EYE_COLORS}
                  value={s.eyeColor}
                  onPick={(col) => act({ t: 'eyeColor', color: col })}
                />
              </>
            )}
            <AdjustBox key={tab} kind={tab} s={s} ops={ops} />
          </>
        )}
        {tab === 'image' && <ImageBox s={s} act={act} />}
        {tab === 'cloth' && (
          <>
            <p className="group-l">{c.topLabel}</p>
            <Swatches
              label={c.topLabel}
              colors={TOP_COLORS}
              value={s.top}
              custom={{
                label: c.customColor,
                live: (col) => ops.live({ t: 'cloth', part: 'top', color: col }),
                commit: ops.commit,
              }}
              onPick={(col) => act({ t: 'cloth', part: 'top', color: col })}
            />
            <p className="group-l">{c.botLabel}</p>
            <Swatches
              label={c.botLabel}
              colors={BOT_COLORS}
              value={s.bot}
              custom={{
                label: c.customColor,
                live: (col) => ops.live({ t: 'cloth', part: 'bot', color: col }),
                commit: ops.commit,
              }}
              onPick={(col) => act({ t: 'cloth', part: 'bot', color: col })}
            />
          </>
        )}
      </div>
    </div>
  );
}

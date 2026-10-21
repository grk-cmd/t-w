import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useI18n } from '@/shared/i18n';
import {
  ACCS,
  ACC_LIMITS,
  ACC_MAX,
  BOT_COLORS,
  EYE_COLORS,
  LAYERS,
  LIMITS,
  PAIRED,
  TOP_COLORS,
  findAcc,
  type AdjTarget,
  type LayerKind,
  type Shape,
} from '../model/catalog';
import {
  SKIN_COUNT,
  nextAccUid,
  type Acc,
  type Action,
  type Adjust,
  type CreatorState,
  type Range,
  type Side,
} from '../model/state';
import { drawItemThumb } from '../lib/draw-front';
import type { EyeNode, MakerTab, Selection } from '../model/tabs';
import { fileToFaceImage } from '../lib/load-image';

type Tab = MakerTab;

/** 고르기 판이 상태를 바꾸는 길 — act 는 한 번에 한 기록, live 는 끄는 동안(놓을 때 commit 이 한 기록으로 쌓는다) */
export interface MakerActions {
  act: (a: Action) => void;
  live: (a: Action) => void;
  commit: () => void;
}
const TABS: readonly Tab[] = ['skin', 'eyes', 'brows', 'mouth', 'cheek', 'acc', 'image', 'cloth'];
/** 눈 폴더 안 층 — 위에 그리는 것부터(레이어 판처럼) */
const EYE_TREE = ['eyeline', 'pupil', 'sclera'] as const;

function Thumb({ shapes }: { shapes: Shape[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawItemThumb(ctx, shapes, 44);
  }, [shapes]);
  return <canvas ref={ref} width={44} height={44} aria-hidden="true" />;
}

/** 그림 고르기 — 레이어 하나의 목록 */
function ItemGrid({ s, kind, act }: { s: CreatorState; kind: LayerKind; act: (a: Action) => void }) {
  const { lang, m } = useI18n();
  const c = m.creator;
  // 미리보기 그림은 색이 바뀔 때만 새로 — 그릴 때마다 새 배열이면 끄는 동안 칸마다 다시 그린다
  const color = s.pupilColor.L;
  const thumbs = useMemo(() => LAYERS[kind].map((it) => it.open(color)), [kind, color]);
  return (
    <>
      <p className="group-l">{c.shapeLabel}</p>
      <div className="items" role="group" aria-label={c.shapeLabel}>
        {LAYERS[kind].map((it, i) => (
          <button
            key={it.id}
            type="button"
            className="item"
            aria-pressed={s[kind] === it.id}
            onClick={() => act({ t: 'item', kind, id: it.id })}
          >
            <Thumb shapes={thumbs[i] ?? []} />
            <span>{it.name[lang]}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/** 자리 · 크기 · 회전 슬라이더 넷 — 끄는 동안 live, 손을 떼거나 칸을 벗어나면 commit */
function SliderRows({
  value,
  limits,
  onLive,
  commit,
}: {
  value: Adjust;
  limits: Record<keyof Adjust, Range>;
  onLive: (key: keyof Adjust, v: number) => void;
  commit: () => void;
}) {
  const { m } = useI18n();
  const c = m.creator;
  const base = useId();
  const rows: [keyof Adjust, string, number][] = [
    ['x', c.adjX, 1],
    ['y', c.adjY, 1],
    ['s', c.adjS, 0.01],
    ['r', c.adjR, 1],
  ];
  return (
    <>
      {rows.map(([key, label, step]) => (
        <div className="sl" key={key}>
          <label htmlFor={`${base}-${key}`}>{label}</label>
          <input
            id={`${base}-${key}`}
            type="range"
            min={limits[key][0]}
            max={limits[key][1]}
            step={step}
            value={value[key]}
            onChange={(e) => onLive(key, Number(e.currentTarget.value))}
            onPointerUp={commit}
            onBlur={commit}
          />
          <output>{key === 's' ? value[key].toFixed(2) : Math.round(value[key])}</output>
        </div>
      ))}
    </>
  );
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

function AdjustBox({ target, s, ops }: { target: AdjTarget; s: CreatorState; ops: MakerActions }) {
  const { m } = useI18n();
  const c = m.creator;
  const paired = PAIRED[target];
  const [side, setSide] = useState<Side>(paired ? 'L' : 'C');
  // 대칭이면 왼쪽 짝을 보고 고친다(오른쪽은 대칭으로 따라간다) — 보는 짝과 고치는 짝이 늘 같아야 한다
  const shown: Side = paired ? (s.sym ? 'L' : side) : 'C';
  const cur = s.adj[target][shown];
  if (!cur) return null;
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
        <button className="btn" type="button" onClick={() => ops.act({ t: 'resetAdjust', target })}>
          {c.reset}
        </button>
      </div>
      <SliderRows
        value={cur}
        limits={LIMITS}
        onLive={(key, value) => ops.live({ t: 'adjust', target, side: shown, key, value })}
        commit={ops.commit}
      />
    </div>
  );
}

/** 👁 눈 탭 — 눈 폴더(전체) 아래 아이라인 · 동공 · 흰자. 폴더를 고르면 셋이 함께, 층을 고르면 그 층만 폴더 안에서 */
function EyesBox({
  s,
  ops,
  node,
  onNode,
}: {
  s: CreatorState;
  ops: MakerActions;
  node: EyeNode;
  onNode: (n: EyeNode) => void;
}) {
  const { m } = useI18n();
  const c = m.creator;
  const partName: Record<(typeof EYE_TREE)[number], string> = {
    eyeline: c.eyeline,
    pupil: c.pupil,
    sclera: c.sclera,
  };
  return (
    <>
      <div className="eye-tree" role="tree" aria-label={c.tabEyes}>
        <button
          type="button"
          role="treeitem"
          className="node folder"
          aria-selected={node === 'eyes'}
          aria-expanded="true"
          onClick={() => onNode('eyes')}
        >
          <span aria-hidden="true">📁</span> {c.eyeFolder}
        </button>
        <div role="group">
          {EYE_TREE.map((p) => (
            <button
              key={p}
              type="button"
              role="treeitem"
              className="node child"
              aria-selected={node === p}
              onClick={() => onNode(p)}
            >
              {partName[p]}
            </button>
          ))}
        </div>
      </div>
      {node === 'eyes' ? (
        <p className="hint">{c.eyeFolderHint}</p>
      ) : (
        <ItemGrid s={s} kind={node} act={ops.act} />
      )}
      {node === 'pupil' && <PupilColors s={s} act={ops.act} />}
      <AdjustBox key={node} target={node} s={s} ops={ops} />
    </>
  );
}

/** 동공 색 — 오드아이를 켜면 왼쪽 · 오른쪽을 따로 */
function PupilColors({ s, act }: { s: CreatorState; act: (a: Action) => void }) {
  const { m } = useI18n();
  const c = m.creator;
  return (
    <>
      <div className="adj-head">
        <span className="group-l">{c.colorLabel}</span>
        <button
          className="btn"
          type="button"
          aria-pressed={s.oddEye}
          onClick={() => act({ t: 'oddEye', on: !s.oddEye })}
        >
          {c.oddEye}
        </button>
      </div>
      {s.oddEye ? (
        (['L', 'R'] as const).map((side) => (
          <div key={side}>
            <p className="sub-l">{side === 'L' ? c.left : c.right}</p>
            <Swatches
              label={`${c.colorLabel} — ${side === 'L' ? c.left : c.right}`}
              colors={EYE_COLORS}
              value={s.pupilColor[side]}
              onPick={(col) => act({ t: 'pupilColor', side, color: col })}
            />
          </div>
        ))
      ) : (
        <Swatches
          label={c.colorLabel}
          colors={EYE_COLORS}
          value={s.pupilColor.L}
          onPick={(col) => act({ t: 'pupilColor', side: 'L', color: col })}
        />
      )}
    </>
  );
}

/** ✨ 액세서리 — 최대 ACC_MAX 개 붙이고, 고른 것을 옮기거나 뗀다 */
function AccBox({
  s,
  ops,
  selected,
  onSelect,
}: {
  s: CreatorState;
  ops: MakerActions;
  selected: Acc | null;
  onSelect: (uid: number | null) => void;
}) {
  const { lang, m } = useI18n();
  const c = m.creator;
  const full = s.acc.length >= ACC_MAX;
  return (
    <>
      <p className="group-l">
        {c.accAdd} ({s.acc.length}/{ACC_MAX})
      </p>
      <div className="items" role="group" aria-label={c.accAdd}>
        {ACCS.map((it) => (
          <button
            key={it.id}
            type="button"
            className="item"
            disabled={full}
            onClick={() => {
              ops.act({ t: 'accAdd', id: it.id });
              onSelect(nextAccUid(s));
            }}
          >
            <Thumb shapes={it.shapes} />
            <span>{it.name[lang]}</span>
          </button>
        ))}
      </div>
      {full && <p className="hint">{c.accFull}</p>}
      <p className="group-l">{c.accList}</p>
      {s.acc.length === 0 ? (
        <p className="hint">{c.accEmpty}</p>
      ) : (
        <ul className="acc-list">
          {s.acc.map((a) => (
            <li key={a.uid}>
              <button
                type="button"
                className="btn"
                aria-pressed={selected?.uid === a.uid}
                onClick={() => onSelect(a.uid)}
              >
                {findAcc(a.id)?.name[lang] ?? a.id}
              </button>
              <button
                type="button"
                className="btn"
                aria-label={`${c.accRemove} — ${findAcc(a.id)?.name[lang] ?? a.id}`}
                onClick={() => {
                  ops.act({ t: 'accRemove', uid: a.uid });
                  if (selected?.uid === a.uid) onSelect(null);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <div className="adj">
          <div className="adj-head">
            <span className="group-l">{c.adjustLabel}</span>
          </div>
          <SliderRows
            value={selected.a}
            limits={ACC_LIMITS}
            onLive={(key, value) => ops.live({ t: 'accAdjust', uid: selected.uid, key, value })}
            commit={ops.commit}
          />
        </div>
      )}
    </>
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

/** 고르기 판 — 탭(피부 · 눈 · 눈썹 · 입 · 볼 · 액세서리 · 내 그림 · 옷 색) */
export function MakerPanel({
  s,
  ops,
  skinSwatches,
  sel,
  onSel,
}: {
  s: CreatorState;
  ops: MakerActions;
  /** 피부 번호 차례의 단추 색 */
  skinSwatches: readonly string[];
  /** 지금 고른 것(탭 · 눈 마디 · 액세서리) — 생성기가 들고 있다(텍스처 칸이 무엇을 끌지 안다) */
  sel: Selection;
  onSel: (sel: Selection) => void;
}) {
  const tab = sel.tab;
  const onTab = (t: MakerTab) => onSel({ ...sel, tab: t });
  const act = ops.act;
  const { m } = useI18n();
  const c = m.creator;
  const base = useId();
  const label: Record<Tab, string> = {
    skin: c.tabSkin,
    eyes: c.tabEyes,
    brows: c.tabBrows,
    mouth: c.tabMouth,
    cheek: c.tabCheek,
    acc: c.tabAcc,
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
            onClick={() => onTab(t)}
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
        {tab === 'eyes' && (
          <EyesBox s={s} ops={ops} node={sel.eyeNode} onNode={(n) => onSel({ ...sel, eyeNode: n })} />
        )}
        {(tab === 'brows' || tab === 'mouth' || tab === 'cheek') && (
          <>
            <ItemGrid s={s} kind={tab} act={act} />
            <AdjustBox key={tab} target={tab} s={s} ops={ops} />
          </>
        )}
        {tab === 'acc' && (
          <AccBox
            s={s}
            ops={ops}
            selected={s.acc.find((a) => a.uid === sel.acc) ?? null}
            onSelect={(uid) => onSel({ ...sel, acc: uid })}
          />
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

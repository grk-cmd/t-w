import { useState, type FormEvent } from 'react';
import {
  draftProblem,
  emptyDraft,
  imageProblem,
  movedIds,
  NoApiError,
  PART_LANGS,
  PART_NAME_MAX,
  PART_SIZE_MAX,
  SLOT_LABELS,
  toBase64,
  useWebParts,
  WEB_PART_SLOTS,
  webPartErrorMessage,
  type WebDecal,
  type WebPart,
  type WebPartDraft,
  type WebPartSlot,
} from '@/entities/web-creator/part';
import {
  useDeleteWebPart,
  useReorderWebParts,
  useSaveWebPart,
  useSetWebPartHidden,
} from '@/features/web-creator/manage-parts';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import styles from './WebPartEditor.module.css';

const LANG_LABEL = { ko: '한국어', en: 'English', ja: '日本語' } as const;

/** 고른 PNG — 미리보기 주소와 올릴 바이트 */
interface Picked {
  preview: string;
  bytes: Uint8Array;
}

async function readPng(file: File): Promise<Picked | string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const problem = imageProblem(bytes);
  if (problem) return problem;
  return { bytes, preview: `data:image/png;base64,${toBase64(bytes)}` };
}

/** 고칠 수 있는 세트(데칼 한 장) */
type EditablePart = WebPart & { decal: WebDecal };
const editable = (p: WebPart): p is EditablePart => p.decal !== null;

const toDraft = (p: EditablePart): WebPartDraft => ({
  slot: p.decal.slot,
  name: { ...p.name },
  w: p.decal.w,
  h: p.decal.h,
  hidden: p.hidden,
});

function PartForm({ part, onDone }: { part: EditablePart | null; onDone: () => void }) {
  const toast = useToast();
  const env = useEnv();
  const save = useSaveWebPart();
  const [draft, setDraft] = useState<WebPartDraft>(part ? toDraft(part) : emptyDraft());
  const [image, setImage] = useState<Picked | null>(null);
  const [closed, setClosed] = useState<Picked | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (patch: Partial<WebPartDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const pick = async (file: File | undefined, to: (p: Picked | null) => void) => {
    if (!file) return to(null);
    const r = await readPng(file);
    if (typeof r === 'string') {
      setProblem(r);
      return to(null);
    }
    setProblem(null);
    to(r);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = draftProblem(draft) ?? (!part && !image ? 'PNG 그림을 골라 주세요' : null);
    if (p) return setProblem(p);
    const what = part
      ? `«${draft.name.ko.trim()}» 을(를) 고칠까요?`
      : `«${draft.name.ko.trim()}» 을(를) 더할까요?`;
    if (!confirm(withProdMark(env, `${what} 홈페이지 캐릭터 만들기에 바로 보여요.`))) return;
    const trimmed = {
      ...draft,
      name: { ko: draft.name.ko.trim(), en: draft.name.en.trim(), ja: draft.name.ja.trim() },
    };
    try {
      await save.mutateAsync({
        part,
        draft: trimmed,
        image: image?.bytes,
        closedImage: closed?.bytes,
      });
      toast('저장했어요');
      onDone();
    } catch (err) {
      setProblem(webPartErrorMessage(err, '저장하지 못했어요'));
    }
  };

  const shown = image?.preview ?? part?.decal.src ?? null;
  // 아이라인이 아니면 감은눈 그림은 저장하지 않는다 — 미리보기도 감춘다
  const closedShown =
    draft.slot === 'eyeline'
      ? (closed?.preview ?? (part?.decal.slot === 'eyeline' ? part.decal.closedSrc : null))
      : null;
  return (
    <form className={styles.form} onSubmit={submit}>
      <label>
        자리
        <select value={draft.slot} onChange={(e) => set({ slot: e.target.value as WebPartSlot })}>
          {WEB_PART_SLOTS.map((s) => (
            <option key={s} value={s}>
              {SLOT_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      {PART_LANGS.map((l) => (
        <label key={l}>
          이름({LANG_LABEL[l]})
          <input
            type="text"
            maxLength={PART_NAME_MAX}
            value={draft.name[l]}
            onChange={(e) => set({ name: { ...draft.name, [l]: e.target.value } })}
          />
        </label>
      ))}
      <label>
        가로(얼굴 판 200 기준)
        <input
          type="number"
          min={1}
          max={PART_SIZE_MAX}
          step={0.5}
          value={draft.w}
          onChange={(e) => set({ w: e.target.valueAsNumber })}
        />
      </label>
      <label>
        세로
        <input
          type="number"
          min={1}
          max={PART_SIZE_MAX}
          step={0.5}
          value={draft.h}
          onChange={(e) => set({ h: e.target.valueAsNumber })}
        />
      </label>
      <label className={styles.check}>
        <input type="checkbox" checked={draft.hidden} onChange={(e) => set({ hidden: e.target.checked })} />
        숨기기(홈페이지에 안 보임)
      </label>
      <label>
        그림(PNG{part ? ' — 바꿀 때만' : ''})
        <input type="file" accept="image/png" onChange={(e) => void pick(e.target.files?.[0], setImage)} />
      </label>
      {draft.slot === 'eyeline' && (
        <label>
          감은눈 그림(PNG · 없으면 기본 감은 줄)
          <input type="file" accept="image/png" onChange={(e) => void pick(e.target.files?.[0], setClosed)} />
        </label>
      )}
      {shown && (
        <div className={styles.preview}>
          <img src={shown} alt="고른 그림 미리보기" />
          {closedShown && <img src={closedShown} alt="감은눈 그림 미리보기" />}
        </div>
      )}
      <div className={styles.actions}>
        <button type="submit" className="btn primary" disabled={save.isPending}>
          {save.isPending ? '저장 중…' : part ? '저장' : '더하기'}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          취소
        </button>
      </div>
      {problem && (
        <p className="note warn" role="alert">
          {problem}
        </p>
      )}
    </form>
  );
}

/** 웹 생성기 파츠 — 홈페이지 캐릭터 만들기에 기본 그림 뒤로 붙는 PNG 파츠(데칼 한 장짜리 세트)를 더하고 고친다(자체 서버 · #517) */
export function WebPartEditor() {
  const toast = useToast();
  const env = useEnv();
  const parts = useWebParts();
  const remove = useDeleteWebPart();
  const hide = useSetWebPartHidden();
  const reorder = useReorderWebParts();
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  const del = async (p: WebPart) => {
    if (
      !confirm(
        withProdMark(env, `«${p.name.ko}» 을(를) 지울까요? 이 그림을 고른 사람은 기본 그림으로 바뀌어요.`),
      )
    )
      return;
    try {
      await remove.mutateAsync(p.id);
      toast('지웠어요');
    } catch (err) {
      toast(webPartErrorMessage(err, '지우지 못했어요'));
    }
  };

  const toggleHidden = async (p: WebPart) => {
    try {
      await hide.mutateAsync({ id: p.id, hidden: !p.hidden });
      toast(p.hidden ? '보이게 했어요' : '숨겼어요');
    } catch (err) {
      toast(webPartErrorMessage(err, '바꾸지 못했어요'));
    }
  };

  const move = async (i: number, by: -1 | 1) => {
    const ids = parts.data && movedIds(parts.data, i, by);
    if (!ids) return;
    try {
      await reorder.mutateAsync(ids);
    } catch (err) {
      toast(webPartErrorMessage(err, '순서를 바꾸지 못했어요'));
    }
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>웹 생성기 파츠</h2>
        <span className="soft">{parts.data && `${parts.data.length}개`}</span>
        {editing === null && !parts.isError && (
          <button type="button" className="btn primary" onClick={() => setEditing('new')}>
            ＋ 새 파츠
          </button>
        )}
      </div>
      <p className={`soft ${styles.hint}`}>
        홈페이지 캐릭터 만들기에 기본 그림 뒤로, 이 목록 순서대로 붙어요. 그림은 PNG(512KB · 가로 · 세로
        1024px 까지) · 가운데를 레이어 자리에 맞춰 가로 × 세로 크기로 그려요(얼굴 판 한 변 200).
      </p>
      {editing === 'new' && <PartForm part={null} onDone={() => setEditing(null)} />}
      {parts.isPending && <p className="soft">불러오는 중…</p>}
      {parts.isError && (
        <p className="note warn" role="alert">
          {parts.error instanceof NoApiError
            ? parts.error.message
            : errorMessage(parts.error, '목록을 불러오지 못했어요')}
        </p>
      )}
      {parts.data && parts.data.length === 0 && <p className="soft">아직 올린 파츠가 없어요.</p>}
      {parts.data && parts.data.length > 0 && (
        <div className="list">
          {parts.data.map((p, i) =>
            editing === p.id && editable(p) ? (
              <PartForm key={p.id} part={p} onDone={() => setEditing(null)} />
            ) : (
              <div key={p.id} className={p.hidden ? `row ${styles.hidden}` : 'row'}>
                <span className={styles.thumb}>{p.thumb && <img src={p.thumb} alt="" />}</span>
                <span className="grow">
                  <b>{p.name.ko}</b>{' '}
                  <span className="soft">
                    {p.name.en} · {p.name.ja}
                  </span>
                  <br />
                  <small className="soft">
                    {p.decal
                      ? `${SLOT_LABELS[p.decal.slot]} · ${p.decal.w} × ${p.decal.h}`
                      : `여러 장 세트(데칼 ${p.decalCount}장) — 여기선 숨기기 · 지우기 · 순서만`}
                    {p.hidden && ' · 숨김'}
                  </small>
                </span>
                <button
                  type="button"
                  className="btn"
                  aria-label="앞으로"
                  onClick={() => void move(i, -1)}
                  disabled={reorder.isPending || i === 0}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label="뒤로"
                  onClick={() => void move(i, 1)}
                  disabled={reorder.isPending || i === parts.data.length - 1}
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setEditing(p.id)}
                  disabled={editing !== null || !p.decal}
                >
                  고치기
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void toggleHidden(p)}
                  disabled={hide.isPending}
                >
                  {p.hidden ? '보이기' : '숨기기'}
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => void del(p)}
                  disabled={remove.isPending}
                >
                  지우기
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

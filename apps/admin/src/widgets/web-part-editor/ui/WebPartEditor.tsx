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
  STATUS_LABELS,
  toBase64,
  useWebParts,
  WEB_PART_SLOTS,
  webPartErrorMessage,
  type ItemStatus,
  type WebPart,
  type WebPartDraft,
  type WebPartSlot,
  type WebPiece,
} from '@/entities/web-creator/part';
import {
  missingBuiltins,
  useImportBuiltins,
  useReorderWebParts,
  useSaveWebPart,
  useSetWebPartStatus,
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

/** 고칠 수 있는 상품(그림(얼굴) 조각 하나) */
type EditablePart = WebPart & { piece: WebPiece };
const editable = (p: WebPart): p is EditablePart => p.piece !== null;

const toDraft = (p: EditablePart): WebPartDraft => ({
  slot: p.piece.slot,
  name: { ...p.name },
  w: p.piece.w,
  h: p.piece.h,
});

/** 상태 버튼 — 지금 상태에서 갈 수 있는 곳과 묻는 말 */
const STATUS_ACTIONS: Record<ItemStatus, { to: ItemStatus; label: string; ask: string }[]> = {
  draft: [
    { to: 'active', label: '진열 시작', ask: '홈페이지 캐릭터 만들기에 보이게 할까요?' },
    { to: 'archived', label: '단종', ask: '단종할까요? 목록에서 빠지지만 이미 고른 캐릭터는 그대로예요.' },
  ],
  active: [
    { to: 'draft', label: '진열 내리기', ask: '초안으로 내릴까요? 홈페이지에서 안 보이게 돼요.' },
    { to: 'archived', label: '단종', ask: '단종할까요? 목록에서 빠지지만 이미 고른 캐릭터는 그대로예요.' },
  ],
  archived: [{ to: 'draft', label: '초안으로 되살리기', ask: '초안으로 되살릴까요?' }],
};

function PartForm({ part, onDone }: { part: EditablePart | null; onDone: () => void }) {
  const toast = useToast();
  const env = useEnv();
  const save = useSaveWebPart();
  const [draft, setDraft] = useState<WebPartDraft>(part ? toDraft(part) : emptyDraft());
  const [image, setImage] = useState<Picked | null>(null);
  const [closed, setClosed] = useState<Picked | null>(null);
  const [dropClosed, setDropClosed] = useState(false);
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
      ? `«${draft.name.ko.trim()}» 을(를) 고칠까요?${part.status === 'active' ? ' 홈페이지에 바로 보여요.' : ''}`
      : `«${draft.name.ko.trim()}» 을(를) 초안으로 더할까요? «진열 시작» 을 눌러야 홈페이지에 보여요.`;
    if (!confirm(withProdMark(env, what))) return;
    const trimmed = {
      ...draft,
      name: { ko: draft.name.ko.trim(), en: draft.name.en.trim(), ja: draft.name.ja.trim() },
    };
    try {
      await save.mutateAsync({
        part,
        draft: trimmed,
        image: image?.bytes,
        closedImage: closed ? closed.bytes : dropClosed ? null : undefined,
      });
      toast('저장했어요');
      onDone();
    } catch (err) {
      setProblem(webPartErrorMessage(err, '저장하지 못했어요'));
    }
  };

  const shown = image?.preview ?? part?.piece.src ?? null;
  const closedShown = closed?.preview ?? (dropClosed ? null : (part?.piece.closedSrc ?? null));
  const hasClosed = Boolean(part?.piece.closedSrc || part?.piece.closedImage);
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
      <label>
        그림(PNG{part ? ' — 바꿀 때만' : ''})
        <input type="file" accept="image/png" onChange={(e) => void pick(e.target.files?.[0], setImage)} />
      </label>
      <label>
        눈 감은 얼굴 그림(PNG · 선택 — 없으면 {draft.slot === 'eyeline' ? '기본 감은 줄' : '위 그림 그대로'})
        <input
          type="file"
          accept="image/png"
          onChange={(e) =>
            void pick(e.target.files?.[0], (p) => {
              setClosed(p);
              setDropClosed(false);
            })
          }
        />
      </label>
      {part && hasClosed && !closed && (
        <label className={styles.check}>
          <input type="checkbox" checked={dropClosed} onChange={(e) => setDropClosed(e.target.checked)} />
          지금 감은 얼굴 그림 빼기
        </label>
      )}
      {shown && (
        <div className={styles.preview}>
          <img src={shown} alt="고른 그림 미리보기" />
          {closedShown && <img src={closedShown} alt="눈 감은 얼굴 그림 미리보기" />}
        </div>
      )}
      <div className={styles.actions}>
        <button type="submit" className="btn primary" disabled={save.isPending}>
          {save.isPending ? '저장 중…' : part ? '저장' : '초안으로 더하기'}
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

/** 웹 생성기 파츠 — 홈페이지 캐릭터 만들기에 기본 그림 뒤로 붙는 PNG 파츠(조각 하나짜리 상품)를 더하고 고친다(자체 서버 · #517) */
export function WebPartEditor() {
  const toast = useToast();
  const env = useEnv();
  const [archived, setArchived] = useState(false);
  const parts = useWebParts(archived);
  // 기본 파츠가 남았는지는 단종까지 봐야 한다(단종한 것을 다시 올리지 않게) — 두 목록은 탭 상태와 따로 읽는다
  const live = useWebParts(false);
  const gone = useWebParts(true);
  const status = useSetWebPartStatus();
  const reorder = useReorderWebParts();
  const importer = useImportBuiltins();
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  const changeStatus = async (p: WebPart, to: ItemStatus, ask: string) => {
    if (!confirm(withProdMark(env, `«${p.name.ko}» — ${ask}`))) return;
    try {
      await status.mutateAsync({ id: p.id, status: to });
      toast(`${STATUS_LABELS[to]}(으)로 바꿨어요`);
    } catch (err) {
      toast(webPartErrorMessage(err, '바꾸지 못했어요'));
    }
  };

  const importBuiltins = async (count: number) => {
    const ask = `홈페이지 코드에 있던 기본 파츠 ${count}개를 서버에 초안으로 올릴까요? 올린 뒤 «진열 시작» 을 눌러야 홈페이지에 보여요.`;
    if (!confirm(withProdMark(env, ask))) return;
    try {
      const done = await importer.mutateAsync();
      toast(done ? `기본 파츠 ${done}개를 초안으로 올렸어요` : '이미 다 올라가 있어요');
    } catch (err) {
      toast(webPartErrorMessage(err, '기본 파츠를 다 올리지 못했어요 — 다시 누르면 남은 것만 올려요'));
    }
  };

  const builtinLeft =
    !archived && live.data && gone.data ? missingBuiltins([...live.data, ...gone.data]).length : 0;

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
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => {
              setArchived(e.target.checked);
              setEditing(null);
            }}
          />
          단종만 보기
        </label>
        {editing === null && !archived && !parts.isError && (
          <button type="button" className="btn primary" onClick={() => setEditing('new')}>
            ＋ 새 파츠
          </button>
        )}
      </div>
      <p className={`soft ${styles.hint}`}>
        «진열 중» 인 것만 홈페이지 캐릭터 만들기에 기본 그림 뒤로, 이 목록 순서대로 붙어요. 새 파츠는 초안으로
        들어가요. 그림은 PNG(512KB · 가로 · 세로 1024px 까지) · 가운데를 레이어 자리에 맞춰 가로 × 세로 크기로
        그려요(얼굴 판 한 변 200).
      </p>
      {builtinLeft > 0 && editing === null && (
        <p className={`note ${styles.builtin}`}>
          홈페이지 코드에 있던 기본 파츠 중 {builtinLeft}개가 아직 서버에 없어요(동공 · 처음 얼굴은 코드에
          남아요).{' '}
          <button
            type="button"
            className="btn"
            onClick={() => void importBuiltins(builtinLeft)}
            disabled={importer.isPending}
          >
            {importer.progress
              ? `올리는 중 ${importer.progress.done}/${importer.progress.total}`
              : '기본 파츠 가져오기'}
          </button>
        </p>
      )}
      {editing === 'new' && <PartForm part={null} onDone={() => setEditing(null)} />}
      {parts.isPending && <p className="soft">불러오는 중…</p>}
      {parts.isError && (
        <p className="note warn" role="alert">
          {parts.error instanceof NoApiError
            ? parts.error.message
            : errorMessage(parts.error, '목록을 불러오지 못했어요')}
        </p>
      )}
      {parts.data && parts.data.length === 0 && (
        <p className="soft">{archived ? '단종한 파츠가 없어요.' : '아직 올린 파츠가 없어요.'}</p>
      )}
      {parts.data && parts.data.length > 0 && (
        <div className="list">
          {parts.data.map((p, i) =>
            editing === p.id && editable(p) ? (
              <PartForm key={p.id} part={p} onDone={() => setEditing(null)} />
            ) : (
              <div key={p.id} className={p.status === 'active' ? 'row' : `row ${styles.dim}`}>
                <span className={styles.thumb}>{p.thumb && <img src={p.thumb} alt="" />}</span>
                <span className="grow">
                  <b>{p.name.ko}</b>{' '}
                  <span className="soft">
                    {p.name.en} · {p.name.ja}
                  </span>
                  <br />
                  <small className="soft">
                    {STATUS_LABELS[p.status]} ·{' '}
                    {p.piece
                      ? `${SLOT_LABELS[p.piece.slot]} · ${p.piece.w} × ${p.piece.h}`
                      : `조각 ${p.pieceCount}개 상품 — 여기선 상태 · 순서만`}
                  </small>
                </span>
                {!archived && (
                  <>
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
                      disabled={editing !== null || !p.piece}
                    >
                      고치기
                    </button>
                  </>
                )}
                {STATUS_ACTIONS[p.status].map((a) => (
                  <button
                    key={a.to}
                    type="button"
                    className={a.to === 'archived' ? 'btn danger' : 'btn'}
                    onClick={() => void changeStatus(p, a.to, a.ask)}
                    disabled={status.isPending}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

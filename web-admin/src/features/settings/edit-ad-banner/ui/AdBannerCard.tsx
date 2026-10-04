import { useState, type FormEvent } from 'react';
import {
  AD_SLOTS,
  buildSlides,
  isPreviewable,
  slideProblem,
  useAdBanner,
  useRefreshAdBanner,
  type AdSlide,
} from '@/entities/ad-banner';
import { errorMessage } from '@/shared/lib';
import { useSaveAdBanner } from '../model/useSaveAdBanner';
import styles from './AdBannerCard.module.css';

type Message = { text: string; error: boolean } | null;

function Preview({ img }: { img: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (!img.trim()) return <span className={styles.preview}>이미지 없음</span>;
  if (!isPreviewable(img)) return <span className={styles.preview}>https 주소만 미리 봐요</span>;
  if (broken === img) return <span className={styles.preview}>이미지를 불러오지 못했어요</span>;
  return (
    <span className={styles.preview}>
      <img src={img.trim()} alt="배너 미리보기" referrerPolicy="no-referrer" onError={() => setBroken(img)} />
    </span>
  );
}

function AdBannerForm({ saved }: { saved: AdSlide[] }) {
  const save = useSaveAdBanner();
  const [slots, setSlots] = useState<AdSlide[]>(() =>
    Array.from({ length: AD_SLOTS }, (_, i) => saved[i] ?? { img: '', link: '' }),
  );
  const [message, setMessage] = useState<Message>(null);

  const change = (i: number, field: keyof AdSlide, value: string) =>
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, [field]: value } : s)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const slides = buildSlides(slots);
    const problem = slides.map(slideProblem).find(Boolean);
    if (problem) {
      setMessage({ text: problem, error: true });
      return;
    }
    const ask = slides.length
      ? `배너 ${slides.length}장을 게시할까요? 모든 사용자의 런처에 바로 바뀌어요.`
      : '이미지가 하나도 없어요 — 모든 사용자에게서 배너를 숨길까요?';
    if (!confirm(ask)) return;
    save.mutate(slides, {
      onSuccess: () =>
        setMessage({
          text: slides.length ? `게시했어요 (${slides.length}장)` : '배너를 숨겼어요',
          error: false,
        }),
      onError: (err) => setMessage({ text: errorMessage(err, '저장하지 못했어요'), error: true }),
    });
  };

  return (
    <form onSubmit={submit}>
      {slots.map((slot, i) => (
        <div key={i} className={styles.slot}>
          <div className={styles.inputs}>
            <b>{i + 1}번째 장</b>
            <input
              type="text"
              inputMode="url"
              placeholder="이미지 주소 (https://…)"
              value={slot.img}
              onChange={(e) => change(i, 'img', e.target.value)}
            />
            <input
              type="text"
              inputMode="url"
              placeholder="누르면 열 링크 (비워도 돼요)"
              value={slot.link}
              onChange={(e) => change(i, 'link', e.target.value)}
            />
          </div>
          <Preview img={slot.img} />
        </div>
      ))}
      <div className="field">
        <button type="submit" className="btn primary" disabled={save.isPending}>
          {save.isPending ? '게시 중…' : '게시'}
        </button>
      </div>
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </form>
  );
}

export function AdBannerCard() {
  const { data, error } = useAdBanner();
  const refresh = useRefreshAdBanner();

  return (
    <section className="card">
      <div className="card-head">
        <h2>광고 배너</h2>
        <button type="button" className="btn" onClick={refresh}>
          새로고침
        </button>
      </div>
      <p className="soft">
        런처 아래에 {AD_SLOTS}장까지 돌아가며 보여요. 이미지가 빈 칸은 건너뛰고, 모두 비우면 배너가 숨겨져요.
      </p>
      {error && <p className="msg err">{errorMessage(error, '불러오지 못했어요')}</p>}
      {!error && !data && <p className="soft">불러오는 중…</p>}
      {/* 다시 받은 값으로 입력 칸을 새로 채운다 */}
      {data && <AdBannerForm key={JSON.stringify(data)} saved={data} />}
    </section>
  );
}

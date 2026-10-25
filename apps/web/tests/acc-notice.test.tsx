import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SELECTION,
  DEFAULT_STATE,
  MakerPanel,
  PartArtProvider,
  setRemoteParts,
  type RemoteLoad,
  type Selection,
} from '@/features/character-maker';
import { I18nProvider, messagesFor } from '@/shared/i18n';
import { API_ORIGIN } from '@/shared/config';

/* 기본 액세서리 · 동공 · 기본 아이라인은 서버로 옮겨 코드에 없다 — 고르기 칸이 비면 왜 비었는지 알린다 */
const ops = { act: () => {}, live: () => {}, commit: () => {} };
const render = (load: RemoteLoad, sel: Partial<Selection> = { tab: 'acc' }) =>
  renderToString(
    <I18nProvider lang="ko">
      <PartArtProvider value={{ images: () => null, rev: 0, load }}>
        <MakerPanel
          s={DEFAULT_STATE}
          ops={ops}
          skinSwatches={['#f2d2bd']}
          sel={{ ...DEFAULT_SELECTION, ...sel }}
          onSel={() => {}}
        />
      </PartArtProvider>
    </I18nProvider>,
  );
const c = messagesFor('ko').creator;

afterEach(() => setRemoteParts([]));

describe('액세서리 고르기 칸이 빌 때 안내', () => {
  it('받는 중 · 못 받음 · 받았는데 없음을 따로 알린다', () => {
    expect(render('loading')).toContain(c.accLoading);
    expect(render('failed')).toContain(c.accLoadFailed);
    expect(render('ready')).toContain(c.accNone);
  });

  it('고를 것이 있으면 안내하지 않는다', () => {
    setRemoteParts([
      {
        id: 'm',
        slot: 'acc',
        name: { ko: '점', en: 'Mole', ja: 'ほくろ' },
        src: `${API_ORIGIN}/v1/assets/h2m.png`,
        closedSrc: null,
        w: 6,
        h: 6,
      },
    ]);
    const html = render('ready');
    expect(html).toContain('점');
    for (const t of [c.accLoading, c.accLoadFailed, c.accNone]) expect(html).not.toContain(t);
  });
});

describe('동공 · 아이라인 고르기 칸이 «없음» 뿐일 때 안내', () => {
  const pupil = { tab: 'eyes', eyeNode: 'pupil' } as const;
  it('받는 중 · 못 받음 · 받았는데 없음을 따로 알린다 · 눈썹처럼 코드 그림이 있는 칸은 안내하지 않는다', () => {
    expect(render('loading', pupil)).toContain(c.shapeLoading);
    expect(render('failed', { tab: 'eyes', eyeNode: 'eyeline' })).toContain(c.shapeLoadFailed);
    expect(render('ready', pupil)).toContain(c.shapeNone);
    expect(render('failed', { tab: 'brows' })).not.toContain(c.shapeLoadFailed);
  });

  it('서버 동공이 있으면 안내하지 않고, 처음 얼굴(목록 맨 앞)이 눌려 있다', () => {
    setRemoteParts([
      {
        id: 'r',
        slot: 'pupil',
        name: { ko: '동그랑', en: 'Round', ja: 'まる' },
        src: `${API_ORIGIN}/v1/assets/h2r.png`,
        closedSrc: null,
        w: 16,
        h: 19,
      },
    ]);
    const html = render('ready', pupil);
    expect(html).not.toContain(c.shapeNone);
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*?동그랑/);
  });
});

import { decodeCloneCode } from '@tw/char-core';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CREATOR_XF, makeCloneCode, passwordOk } from '@/features/clone-code';

// 1×1 투명 PNG — 그림 자리를 채우는 가짜(앱은 이 주소를 그대로 캔버스에 그린다)
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const src = (u: string) => ({ toDataURL: () => u });

describe('makeCloneCode — 앱 «코드 입력하기» 가 읽는 모양', () => {
  const ch = { skin: 3, face: src(PNG), blink: src(PNG + '#b'), top: '#ff9bb3', bot: '#5c6b8a' };

  it('코어(앱과 같은 함수)로 되살리면 그대로 — 파츠 · 책상 칸은 없다', async () => {
    const code = await makeCloneCode(ch, 'tw1234');
    expect(code.startsWith('DCC1.')).toBe(true);
    const d = await decodeCloneCode(code, 'tw1234');
    expect(d).toMatchObject({
      type: 'creator',
      skin: 3,
      top: '#ff9bb3',
      bot: '#5c6b8a',
      face: PNG,
      blink: PNG + '#b',
    });
    for (const k of ['equippedParts', 'deskGlb', 'deskCatalogId', 'deskItems', 'isCommission', 'animal'])
      expect(d[k]).toBeUndefined();
  });

  it('비밀번호가 틀리면 못 연다 · 빈 비밀번호로는 안 만든다', async () => {
    const code = await makeCloneCode(ch, 'right');
    await expect(decodeCloneCode(code, 'wrong')).rejects.toBeTruthy();
    await expect(makeCloneCode(ch, '')).rejects.toThrow();
    expect(passwordOk('')).toBe(false);
    expect(passwordOk(' ')).toBe(true); // 앱과 같은 규칙 — 비어 있지만 않으면
  });

  it('크기 · 높이 · 돌림(xf)을 앱 생성기 처음 값으로 싣는다 — 없으면 앱이 1배로 띄워 훨씬 크다', async () => {
    const d = await decodeCloneCode(await makeCloneCode(ch, 'p'), 'p');
    expect(d.xf).toEqual({ s: 0.7, y: 0, z: 0, rot: 0, x: 0 });
  });

  it('그 값은 앱 생성기의 처음 값(creator-state.js cXform)과 같다', () => {
    const src = readFileSync(
      new URL('../../desktop/app/parts/creator/creator-state.js', import.meta.url),
      'utf8',
    );
    const m = /let cXform=\{s:([\d.]+),y:([\d.-]+),z:([\d.-]+),rot:([\d.-]+)\}/.exec(src);
    expect(m, 'creator-state.js 의 cXform 처음 값을 못 찾았다').not.toBeNull();
    expect({ s: +m![1]!, y: +m![2]!, z: +m![3]!, rot: +m![4]! }).toEqual({
      s: CREATOR_XF.s,
      y: CREATOR_XF.y,
      z: CREATOR_XF.z,
      rot: CREATOR_XF.rot,
    });
  });

  it('같은 캐릭터 · 비밀번호여도 코드는 매번 다르다(소금 · iv)', async () => {
    expect(await makeCloneCode(ch, 'a')).not.toBe(await makeCloneCode(ch, 'a'));
  });
});

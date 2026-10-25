// 홈페이지 기본 파츠(코드 안 도형)를 PNG 로 뽑아 웹 관리자 «기본 파츠 가져오기» 에 넣는다 — 한 번 쓰는 옮기기 도구.
// 동공 · «없음» · 처음 얼굴(기본값)은 코드에 남는다(사용자 결정) — 아래 MOVE 에 든 것만 뽑는다.
// 쓰는 법: 루트에서 `node apps/web/scripts/export-builtin-parts.mjs` (playwright 가 깔린 PC 에서 · 결과 PNG 는 저장소에 올린다)
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// playwright 는 저장소 의존성이 아니다(이 도구만 쓴다) — 깔린 것을 require 로 찾는다
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = join(here, '../../admin/src/features/web-creator/manage-parts/builtin');
/** 얼굴 판 한 단위에 몇 픽셀 — 그림이 커져도 흐려지지 않게 넉넉히(가장 큰 것도 1024px 아래) */
const PX = 8;

const MOVE = {
  highlight: ['double', 'big', 'star'],
  eyeline: ['thick', 'lash', 'smile', 'sleepy'],
  brows: ['thick', 'worry'],
  mouth: ['cat', 'open', 'flat', 'o'],
  cheek: ['lines', 'freckle'],
  acc: ['bandage', 'scar', 'scarline', 'mole', 'tear', 'star', 'heart', 'sweat'],
};

const bundled = await build({
  stdin: {
    contents: `export { findItem, findAcc } from './src/features/character-maker/model/catalog.ts';`,
    resolveDir: join(here, '..'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  alias: { '@': join(here, '../src') },
});
const tmp = join(here, '.export-catalog.mjs');
writeFileSync(tmp, bundled.outputFiles[0].text);
const { findItem, findAcc } = await import(tmp);
rmSync(tmp);

/** 도형 → SVG 조각(캔버스 그리기 draw-front.ts 와 같은 뜻 — 선은 둥근 끝 · 둥근 이음) */
function svgOf(shapes) {
  return shapes
    .map((sh) => {
      const paint = `fill="${sh.fill ?? 'none'}" stroke="${sh.stroke ?? 'none'}" stroke-width="${sh.w ?? 1}"`;
      if (sh.k === 'ellipse')
        return `<ellipse cx="${sh.cx ?? 0}" cy="${sh.cy ?? 0}" rx="${sh.rx}" ry="${sh.ry}" ${paint} opacity="${sh.alpha ?? 1}"/>`;
      return `<path d="${sh.d}" ${paint} stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');
}

const jobs = [];
for (const [slot, ids] of Object.entries(MOVE))
  for (const id of ids) {
    if (slot === 'acc') {
      const a = findAcc(id);
      jobs.push({ slot, id, name: a.name, open: a.shapes, closed: null });
      continue;
    }
    const it = findItem(slot, id);
    if (it.id !== id) throw new Error(`없는 기본 파츠: ${slot}/${id}`);
    // 아이라인은 감은 얼굴 그림이 늘 있다 — 기본 그림에 따로 없으면 지금 화면처럼 뜬 모양을 그대로(홈페이지는 없으면 기본 감은 줄을 그려 모양이 바뀐다)
    const closed = slot === 'eyeline' ? (it.closed ?? it.open('#000')) : null;
    jobs.push({ slot, id, name: it.name, open: it.open('#000'), closed });
  }

const browser = await chromium.launch();
const page = await browser.newPage();
/** 원점 가운데 · 위아래 좌우 같은 너비 상자(관리자 그림은 가운데를 자리에 맞춰 그린다) — 뜬 · 감은 그림이 같은 상자를 쓴다 */
async function halfBox(svgs) {
  return page.evaluate((list) => {
    let hx = 0;
    let hy = 0;
    for (const inner of list) {
      document.body.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><g>${inner}</g></svg>`;
      const g = document.querySelector('g');
      for (const el of g.children) {
        const b = el.getBBox();
        const pad =
          Number(el.getAttribute('stroke') === 'none' ? 0 : el.getAttribute('stroke-width')) / 2 + 0.5;
        hx = Math.max(hx, Math.abs(b.x - pad), Math.abs(b.x + b.width + pad));
        hy = Math.max(hy, Math.abs(b.y - pad), Math.abs(b.y + b.height + pad));
      }
    }
    return { hx: Math.ceil(hx), hy: Math.ceil(hy) };
  }, svgs);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const manifest = [];
for (const j of jobs) {
  const svgs = [svgOf(j.open), ...(j.closed ? [svgOf(j.closed)] : [])];
  const { hx, hy } = await halfBox(svgs);
  const w = hx * 2;
  const h = hy * 2;
  const shot = async (inner, file) => {
    await page.setViewportSize({ width: w * PX, height: h * PX });
    await page.setContent(
      `<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${w * PX}" height="${h * PX}" viewBox="${-hx} ${-hy} ${w} ${h}">${inner}</svg></body></html>`,
    );
    await page.locator('svg').screenshot({ path: join(OUT, file), omitBackground: true });
  };
  const file = `${j.slot}-${j.id}.png`;
  await shot(svgs[0], file);
  let closedFile = null;
  if (j.closed) {
    closedFile = `${j.slot}-${j.id}-closed.png`;
    await shot(svgs[1], closedFile);
  }
  manifest.push({ key: `${j.slot}/${j.id}`, slot: j.slot, name: j.name, w, h, file, closedFile });
}
await browser.close();
writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`뽑음: ${manifest.length}개 → ${OUT}`);

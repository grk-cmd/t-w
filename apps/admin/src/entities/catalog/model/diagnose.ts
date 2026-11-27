import { catalogPath, type CatalogWrite } from './catalog';
import type { CatalogKind, CatalogRecord } from './entry';

// 앱 analyzeCatalog · cleanupCatalogBase64(firebase-init.js)와 같은 기준. 앱은 parts · desks · items 만 보지만
// gachaParts 도 규칙상 glb base64 를 받을 수 있어 함께 본다.
export const DIAGNOSE_KINDS: readonly CatalogKind[] = ['parts', 'gachaParts', 'desks', 'items'];
export const HEAVY_CHARS = 2000; // 이보다 긴 문자열 필드를 «무거운 필드» 로 본다
export const TOP_N = 10;

export interface RecordSize {
  id: string;
  name: string;
  kb: number;
  /** «glb(812KB, base64)» 꼴. */
  heavy: string[];
}

export interface KindAnalysis {
  count: number;
  totalKB: number;
  base64Fields: number;
  top: RecordSize[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 항목마다 JSON 크기 — 모든 사용자가 앱을 켤 때 이만큼 내려받는다. */
export function analyzeKind(raw: Record<string, CatalogRecord>): KindAnalysis {
  let total = 0;
  let base64Fields = 0;
  const recs: RecordSize[] = Object.entries(raw).map(([id, r]) => {
    const rec = r ?? {};
    const size = JSON.stringify(rec).length;
    total += size;
    const heavy: string[] = [];
    for (const [k, v] of Object.entries(rec)) {
      if (typeof v !== 'string' || v.length <= HEAVY_CHARS) continue;
      const b64 = v.startsWith('data:');
      heavy.push(`${k}(${Math.round(v.length / 1024)}KB${b64 ? ', base64' : ''})`);
      if (b64) base64Fields++;
    }
    return { id, name: typeof rec.name === 'string' ? rec.name : '', kb: round1(size / 1024), heavy };
  });
  recs.sort((a, b) => b.kb - a.kb);
  return { count: recs.length, totalKB: round1(total / 1024), base64Fields, top: recs.slice(0, TOP_N) };
}

export interface CleanupTarget {
  kind: CatalogKind;
  id: string;
  /** 지울 glb 문자열 길이. */
  bytes: number;
}

export interface CleanupPlan {
  /** glbUrl 이 있어 DB 의 glb 만 지워도 되는 항목. */
  targets: CleanupTarget[];
  /** glb 가 있는데 glbUrl 이 없는 항목 — Storage 로 안 옮겨져 원본이 DB 뿐이라 절대 건드리지 않는다. */
  skipped: CleanupTarget[];
  /** glb 가 이미 없는 항목 수. */
  alreadyClean: number;
  bytes: number;
}

/** 앱 cleanupCatalogBase64(dryRun) 과 같은 판정. */
export function planBase64Cleanup(
  byKind: Partial<Record<CatalogKind, Record<string, CatalogRecord>>>,
): CleanupPlan {
  const plan: CleanupPlan = { targets: [], skipped: [], alreadyClean: 0, bytes: 0 };
  for (const kind of DIAGNOSE_KINDS) {
    for (const [id, r] of Object.entries(byKind[kind] ?? {})) {
      const rec = r ?? {};
      if (!rec.glb) {
        plan.alreadyClean++;
        continue;
      }
      const item = { kind, id, bytes: typeof rec.glb === 'string' ? rec.glb.length : 0 };
      if (typeof rec.glbUrl === 'string' && rec.glbUrl) {
        plan.targets.push(item);
        plan.bytes += item.bytes;
      } else {
        plan.skipped.push(item);
      }
    }
  }
  return plan;
}

/** glb 필드만 지운다 — 다른 필드는 그대로라 glbUrl 이 있으면 규칙 .validate 를 통과한다. */
export function base64CleanupWrite(targets: readonly CleanupTarget[]): CatalogWrite {
  return Object.fromEntries(targets.map((t) => [`${catalogPath(t.kind, t.id)}/glb`, null]));
}

export const toMB = (bytes: number) => (bytes / 1048576).toFixed(2);

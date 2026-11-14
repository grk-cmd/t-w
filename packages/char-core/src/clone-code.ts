/* 🔐 캐릭터 복제 코드 DCC1 — 'DCC1.' + base64(salt 16 · iv 12 · AES-GCM 암호문). 열쇠는 비밀번호에서 PBKDF2(SHA-256 · 150000회).
   ⚠️ 읽기 호환을 늘 지킨다 — 앱에서 만든 옛 코드를 새 코어가 읽어야 한다(tests/fixtures/dcc1-*.json).
   ⚠️ 앱 몫 칸(책상 · 아이템 · 커미션)은 해석하지 않고 그대로 싣고 되살린다 — 지우면 앱 저장본의 책상 · 커미션이 사라진다(#430 4절).
   그림 다루기(얼굴 캔버스 → 주소 · 주소 → 캔버스 · 동물 그림 줄이기)는 부르는 쪽이 한다. */

export const CLONE_CODE_PREFIX = 'DCC1.';
/** 동물 그림 6장을 이 크기로 줄여 싣는다. 얼굴 · 깜빡임은 크기 없이 그려지므로 줄이면 안 된다. */
export const CLONE_TEX_SIZE = 256;
const KDF_ITERATIONS = 150000;
const SALT_LEN = 16;
const IV_LEN = 12;

/** 캔버스처럼 PNG 주소를 내줄 수 있는 것 — 얼굴 · 깜빡임 그림. */
export interface DataUrlSource {
  toDataURL(type: 'image/png'): string;
}

/** 복제 코드에 싣는 캐릭터 — 앱 def 의 칸 이름 그대로. 모르는 칸은 싣지 않는다. */
export interface CloneDefIn {
  skin?: number;
  face: DataUrlSource;
  blink: DataUrlSource;
  top?: unknown;
  bot?: unknown;
  [field: string]: unknown;
}

/** 코드에서 되살린 캐릭터 — 얼굴 · 깜빡임은 PNG 주소(부르는 쪽이 캔버스로 그린다). */
export interface CloneDefOut {
  type: 'creator';
  skin: number;
  face: string;
  blink: string;
  top: unknown;
  bot: unknown;
  [field: string]: unknown;
}

export interface EncodeOptions {
  /** dataURL 그림을 size×size 로 줄인다. 실패하면 원본을 돌려준다. dataURL 이 아니면 그대로 · 없으면 null. */
  shrinkDataUrl(url: unknown, size: number): Promise<string | null>;
}

export function b64(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i] as number);
  return btoa(s);
}

export function unb64(str: string): Uint8Array {
  const s = atob(str);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

export async function deriveKey(pass: string, salt: Uint8Array): Promise<CryptoKey> {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    km,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

const ANIMAL_TEX = ['animalBody', 'animalEarPaintL', 'animalEarPaintR', 'animalBlink', 'animalEarBlinkL', 'animalEarBlinkR'] as const;
/** 사람 귀 그림은 주소만 — dataURL 은 코드가 너무 커진다. */
const urlOnly = (v: unknown): string | null => (typeof v === 'string' && !v.startsWith('data:') ? v : null);

/** def → 코드에 싣는 JSON 글. 칸 순서는 앱이 만들던 그대로다. */
export async function clonePayload(def: CloneDefIn, opts: EncodeOptions): Promise<string> {
  const tex = def.animal
    ? await Promise.all(ANIMAL_TEX.map((k) => opts.shrinkDataUrl(def[k], CLONE_TEX_SIZE)))
    : ANIMAL_TEX.map(() => null);
  const or = <T>(v: unknown, d: T) => v || d;
  return JSON.stringify({
    t: 'creator', skin: or(def.skin, 0), top: def.top, bot: def.bot, xf: or(def.xf, null), decor: or(def.decor, null),
    deskColor: or(def.deskColor, null), deskItems: or(def.deskItems, null), deskGlb: or(def.deskGlb, null),
    deskCatalogId: or(def.deskCatalogId, null), deskScale: or(def.deskScale, null), deskPos: or(def.deskPos, null),
    customItems: or(def.customItems, null), isCommission: or(def.isCommission, false), commName: or(def.commName, null), commGlb: or(def.commGlb, null),
    animal: or(def.animal, false), animalFace: or(def.animalFace, 0), animalScl: or(def.animalScl, null),
    animalEarL: or(def.animalEarL, null), animalEarR: or(def.animalEarR, null), animalEarAdj: or(def.animalEarAdj, null),
    animalBody: tex[0], animalEarPaintL: tex[1], animalEarPaintR: tex[2], animalBlink: tex[3], animalEarBlinkL: tex[4], animalEarBlinkR: tex[5],
    earL: or(def.earL, null), earR: or(def.earR, null), earAdj: or(def.earAdj, null), earPicL: urlOnly(def.earPicL), earPicR: urlOnly(def.earPicR),
    face: def.face.toDataURL('image/png'), blink: def.blink.toDataURL('image/png'),
  });
}

export async function encryptPayload(payload: string, pass: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(pass, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(payload)));
  const blob = new Uint8Array(SALT_LEN + IV_LEN + ct.length);
  blob.set(salt, 0);
  blob.set(iv, SALT_LEN);
  blob.set(ct, SALT_LEN + IV_LEN);
  return CLONE_CODE_PREFIX + b64(blob);
}

export async function encodeCloneCode(def: CloneDefIn, pass: string, opts: EncodeOptions): Promise<string> {
  return encryptPayload(await clonePayload(def, opts), pass);
}

/** 코드 → 실어 보낸 JSON. 'format'(DCC1 이 아님) · 'type'(캐릭터 코드가 아님) 오류 글은 앱이 그대로 가려 안내한다. */
export async function decryptPayload(code: unknown, pass: string): Promise<Record<string, unknown>> {
  if (typeof code !== 'string' || !code.startsWith(CLONE_CODE_PREFIX)) throw new Error('format');
  const blob = unb64(code.slice(CLONE_CODE_PREFIX.length).replace(/\s+/g, ''));
  const salt = blob.slice(0, SALT_LEN);
  const iv = blob.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const ct = blob.slice(SALT_LEN + IV_LEN);
  const key = await deriveKey(pass, salt);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  const o = JSON.parse(new TextDecoder().decode(pt)) as Record<string, unknown>;
  if (o.t !== 'creator') throw new Error('type');
  return o;
}

const DESK_FIELDS = ['xf', 'decor', 'deskColor', 'deskItems', 'deskGlb', 'deskCatalogId', 'deskScale', 'deskPos', 'customItems'] as const;
const EAR_FIELDS = ['earL', 'earR', 'earAdj', 'earPicL', 'earPicR'] as const;

/** 실어 보낸 JSON → def. 옛 코드에 없는 칸은 만들지 않는다(앱이 예전에 되살리던 모양 그대로). */
export function defFromPayload(o: Record<string, unknown>): CloneDefOut {
  const d: CloneDefOut = { type: 'creator', skin: (o.skin as number) || 0, face: o.face as string, blink: o.blink as string, top: o.top, bot: o.bot };
  for (const k of DESK_FIELDS) if (o[k]) d[k] = o[k];
  if (o.isCommission) {
    d.isCommission = true;
    d.commName = o.commName || null;
    d.commGlb = o.commGlb || null;
  }
  if (!o.animal) {
    for (const k of EAR_FIELDS) if (o[k]) d[k] = o[k];
  } else {
    d.animal = true;
    d.animalFace = o.animalFace || 0;
    for (const k of ['animalScl', 'animalEarL', 'animalEarR', 'animalEarAdj', 'animalBody', 'animalEarPaintL', 'animalEarPaintR', 'animalBlink'] as const) d[k] = o[k] || null;
    // 감은눈 귀는 옛 코드에 없다 — 표정 귀로 채워 예전과 같은 모양을 유지한다.
    d.animalEarBlinkL = o.animalEarBlinkL || o.animalEarPaintL || null;
    d.animalEarBlinkR = o.animalEarBlinkR || o.animalEarPaintR || null;
  }
  return d;
}

export async function decodeCloneCode(code: unknown, pass: string): Promise<CloneDefOut> {
  return defFromPayload(await decryptPayload(code, pass));
}

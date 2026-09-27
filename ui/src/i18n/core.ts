import type { Dict } from './types';

const NUM_RE = /\d[\d,]*(?:\.\d+)?/g;
// Slots: a quoted phrase collapses to "#" (quotes kept — extraction emits them this way);
// numbers collapse to '#'. Values are captured with the same alternation, quoted whole first.
const SLOT_VALUES_RE = /"[^"]*"|\d[\d,]*(?:\.\d+)?/g;

/** Normalize number/quoted-phrase slots to '#' and collapse whitespace — the key of dict.templates. */
export function skeleton(text: string): string {
  return text
    .replace(/"[^"]*"/g, '"#"')
    .replace(NUM_RE, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface LookupResult {
  translation: string;
  viaTemplate: boolean;
  skeletonKey?: string;
}

/** Two-level match (M2): exact first, then numeric-skeleton template. */
export function lookup(dict: Dict, raw: string): LookupResult | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const pre = raw.slice(0, raw.length - raw.trimStart().length);
  const post = raw.slice(raw.trimEnd().length);
  const compose = (t: string) => pre + t + post;

  const exactHit = dict.exact[trimmed];
  if (exactHit !== undefined) return { translation: compose(exactHit), viaTemplate: false };

  const sk = skeleton(trimmed);
  const tpl = dict.templates[sk];
  if (tpl !== undefined) {
    const values = (trimmed.match(SLOT_VALUES_RE) ?? []).map(v =>
      v.startsWith('"') ? v.slice(1, -1) : v
    );
    let ok = true;
    const filled = tpl.replace(/\{(\d+)\}/g, (_, i) => {
      const v = values[Number(i)];
      if (v === undefined) {
        ok = false;
        return '';
      }
      return v;
    });
    if (!ok) return null;
    return { translation: compose(filled), viaTemplate: true, skeletonKey: sk };
  }
  return null;
}

const SKIP_TAGS = new Set(['TEXTAREA', 'PRE', 'CODE', 'SCRIPT', 'STYLE', 'NOSCRIPT']);
// font-mono / whitespace-pre containers render logs and raw user data (ADR-0002 guards).
const SKIP_SELECTORS = ['[data-i18n-skip]', '[class*="font-mono"]', '[class*="whitespace-pre"]'];

export function shouldSkip(el: Element | null): boolean {
  let cur: Element | null = el;
  while (cur) {
    if (SKIP_TAGS.has(cur.tagName)) return true;
    for (const sel of SKIP_SELECTORS) {
      try {
        if (cur.matches(sel)) return true;
      } catch {
        /* invalid selector in odd environment — treat as non-match */
      }
    }
    cur = cur.parentElement;
  }
  return false;
}

export const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'alt', 'aria-label'] as const;

/** Cheap filter so pure numbers / paths do not get logged as misses. */
export function looksLikeUiText(s: string): boolean {
  return /[A-Za-z]{2}/.test(s);
}

/** Runtime data shapes that are never translatable UI copy (ADR-0002 user data). */
export function looksLikeData(t: string): boolean {
  return (/^[\d.,]+\s*(\/\s*[\d.,]+\s*)?[KMGT]?B$/i.test(t) || // sizes: '16.4 GB', '1.3 / 26 GB'
    /^[a-z0-9_]+$/.test(t) || // snake identifiers: 'alpha', 'inference_engine_gpu0'
    /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(t) || // hub repo paths: 'Tongyi-MAI/Z-Image'
    /^(NVIDIA|AMD|Intel)\b/.test(t)); // hardware vendor names
}

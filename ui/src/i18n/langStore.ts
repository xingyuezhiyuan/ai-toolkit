import type { Lang } from './types';

export const LANG_LS_KEY = 'aitk_lang';

const listeners = new Set<(l: Lang) => void>();
let current: Lang = 'en';

/** Server value is the truth; mirror is a load-time cache; detection only when neither exists (D2). */
export function detectInitial(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    const cached = window.localStorage.getItem(LANG_LS_KEY);
    if (cached === 'en' || cached === 'zh') return cached;
  } catch {
    /* private mode etc. */
  }
  const nav = (navigator.language || '').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang, persist = true): void {
  current = l;
  if (persist) {
    try {
      window.localStorage.setItem(LANG_LS_KEY, l);
    } catch {
      /* ignore */
    }
  }
  listeners.forEach(fn => fn(l));
}

export function subscribe(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function _resetForTests(initial?: Lang): void {
  current = initial ?? 'en';
  listeners.clear();
}

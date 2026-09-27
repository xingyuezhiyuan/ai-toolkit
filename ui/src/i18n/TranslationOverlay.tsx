'use client';

import { useEffect } from 'react';
import { watch, createStats } from './overlayEngine';
import { detectInitial, getLang, setLang, subscribe } from './langStore';
import zh from './data/zh';
import { apiClient } from '@/utils/api';

const stats = createStats();

declare global {
  interface Window {
    __i18nMisses?: string[];
    __i18nTemplateHits?: string[];
  }
}

export default function TranslationOverlay() {
  useEffect(() => {
    // D2: local mirror / browser detection wins until the server value arrives.
    setLang(detectInitial(), false);
    document.body.dataset.lang = getLang();
    const handle = watch(document.body, getLang, () => zh, stats);
    // Language flips do not mutate the DOM: request a synchronous re-apply (I2).
    const unsub = subscribe(() => {
      document.body.dataset.lang = getLang();
      handle.requestReapply();
    });
    // Server is the truth source (P1): pull once and correct.
    apiClient
      .get('/api/settings')
      .then(res => {
        const l = (res.data || {}).LANGUAGE;
        if (l === 'en' || l === 'zh') setLang(l, true);
      })
      .catch(() => {
        /* offline/auth errors: mirror + detection already applied */
      });
    // Audit hooks (V2).
    Object.defineProperty(window, '__i18nMisses', { get: () => [...stats.misses].sort() });
    Object.defineProperty(window, '__i18nTemplateHits', {
      get: () => [...stats.templateHits].sort(),
    });
    return () => {
      handle.stop();
      unsub();
    };
  }, []);
  return null;
}

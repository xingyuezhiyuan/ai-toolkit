// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getLang, setLang, subscribe, detectInitial, LANG_LS_KEY, _resetForTests } from '../langStore';

describe('langStore', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetForTests();
  });

  it('detectInitial falls back to navigator language when no mirror', () => {
    // jsdom default navigator.language === 'en-US'
    expect(detectInitial()).toBe('en');
  });

  it('detectInitial prefers the localStorage mirror', () => {
    localStorage.setItem(LANG_LS_KEY, 'zh');
    expect(detectInitial()).toBe('zh');
  });

  it('setLang persists mirror and notifies subscribers', () => {
    const seen: string[] = [];
    const unsub = subscribe(l => seen.push(l));
    setLang('zh');
    expect(getLang()).toBe('zh');
    expect(localStorage.getItem(LANG_LS_KEY)).toBe('zh');
    expect(seen).toEqual(['zh']);
    unsub();
    setLang('en');
    expect(seen).toEqual(['zh']); // unsubscribed
  });

  it('setLang(persist=false) does not touch mirror (first-visit detection must not write)', () => {
    setLang('zh', false);
    expect(getLang()).toBe('zh');
    expect(localStorage.getItem(LANG_LS_KEY)).toBeNull();
  });
});

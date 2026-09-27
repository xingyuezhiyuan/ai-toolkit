import type { Dict, Lang } from './types';
import { lookup, shouldSkip, looksLikeUiText, looksLikeData, skeleton, TRANSLATABLE_ATTRS } from './core';

export interface EngineStats {
  misses: Set<string>;
  templateHits: Set<string>;
}

export function createStats(): EngineStats {
  return { misses: new Set(), templateHits: new Set() };
}

const originals = new WeakMap<Text, string>();
const appliedText = new WeakMap<Text, string>();
const origAttrs = new WeakMap<Element, Record<string, string>>();
const appliedAttrs = new WeakMap<Element, Record<string, string>>();

function walkText(root: Node, cb: (n: Text) => void) {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Text | null;
  while ((n = tw.nextNode() as Text | null)) cb(n);
}

function recordMiss(stats: EngineStats, allow: Set<string>, orig: string) {
  const t = orig.trim();
  if (t && looksLikeUiText(t) && !looksLikeData(t) && !allow.has(t) && !allow.has(skeleton(t))) {
    stats.misses.add(t);
  }
}

/** Idempotent full pass over `root` for the target language. */
export function applyAll(root: HTMLElement, lang: Lang, dict: Dict, stats: EngineStats): void {
  const allow = new Set(dict.allowEnglish);

  walkText(root, node => {
    const host = node.parentElement;
    if (!host || shouldSkip(host)) return;
    const cur = node.textContent ?? '';
    // Staleness guard: trust our saved original only while the node still shows
    // exactly what we last wrote; anything else means React replaced the text.
    const orig = appliedText.get(node) === cur ? originals.get(node) ?? cur : cur;
    originals.set(node, orig);

    if (lang === 'en') {
      if (node.textContent !== orig) {
        node.textContent = orig;
      }
      appliedText.set(node, orig);
      return;
    }
    const hit = lookup(dict, orig);
    if (hit) {
      if (node.textContent !== hit.translation) {
        node.textContent = hit.translation;
        appliedText.set(node, hit.translation);
      }
      if (hit.viaTemplate && hit.skeletonKey) stats.templateHits.add(hit.skeletonKey);
    } else {
      recordMiss(stats, allow, orig);
    }
  });

  root.querySelectorAll('*').forEach(el => {
    if (shouldSkip(el)) return;
    let store: Record<string, string> | undefined = origAttrs.get(el);
    let seen: Record<string, string> | undefined = appliedAttrs.get(el);
    for (const attr of TRANSLATABLE_ATTRS) {
      const v = el.getAttribute(attr);
      if (v === null) continue;
      if (!store) {
        store = {};
        origAttrs.set(el, store);
      }
      if (!seen) {
        seen = {};
        appliedAttrs.set(el, seen);
      }
      // Staleness guard (mirrors the text path): an attribute we did not write is
      // a React/user update - adopt it as the new original instead of freezing it.
      if (seen[attr] !== v) store[attr] = v;
      const base = store[attr];
      if (lang === 'en') {
        if (v !== base) el.setAttribute(attr, base);
        seen[attr] = base;
        continue;
      }
      const hit = lookup(dict, base);
      const out = hit ? hit.translation : base;
      if (v !== out) el.setAttribute(attr, out);
      seen[attr] = out;
      if (hit) {
        if (hit.viaTemplate && hit.skeletonKey) stats.templateHits.add(hit.skeletonKey);
      } else {
        recordMiss(stats, allow, base);
      }
    }
  });
}

export interface WatchHandle {
  stop: () => void;
  /** Force a synchronous re-apply (language flipped outside the DOM). */
  requestReapply: () => void;
}

/** Observe mutations (debounced to rAF) and keep the subtree translated. */
export function watch(
  root: HTMLElement,
  getLang: () => Lang,
  getDict: () => Dict,
  stats: EngineStats
): WatchHandle {
  let queued = false;
  let applying = false;
  const applyNow = () => {
    applying = true;
    observer.takeRecords(); // drop our own mutations from this batch
    applyAll(root, getLang(), getDict(), stats);
    applying = false;
  };
  const observer = new MutationObserver(() => {
    if (applying || queued) return;
    queued = true;
    // setTimeout (not rAF): hidden/background tabs pause rAF; timers still fire (clamped).
    setTimeout(() => {
      if (!queued) return; // a synchronous requestReapply already handled the batch
      queued = false;
      applyNow();
    }, 32);
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRS],
  });
  applyAll(root, getLang(), getDict(), stats);
  return {
    stop: () => observer.disconnect(),
    requestReapply: () => {
      queued = false;
      applyNow();
    },
  };
}

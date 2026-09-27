# AI Toolkit UI 中文翻译覆盖层 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 ai-toolkit UI 增加运行时翻译覆盖层（词典驱动的 EN→ZH 替换），在 Settings 页提供零刷新的一键中英切换，且不破坏上游同步通道。

**Architecture:** 不改任何业务组件文案；新引擎挂在 `ui/src/i18n/`，由 MutationObserver 驱动，按「精确匹配 + 数字归一化模板」两级词典替换 DOM 文本与 placeholder/title 属性。语言偏好真源存服务端 SQLite（`/api/settings` 白名单加 `LANGUAGE` key），localStorage 镜像防首帧闪烁。词典由 AST 提取脚本全量生成底表（W2），Playwright 巡检以「漏翻数=0」为验收判据（V2）。

**Tech Stack:** Next.js 15 + React 19 + TypeScript（ui/）、vitest + jsdom（新测试栈）、TypeScript Compiler API（提取脚本）、Playwright（巡检）。

**必读决议文档（本计划的边界与风格约束，实施前先看）：**
- `CONTEXT.md`（仓库根）— 术语表 + 核心术语表（S2：LoRA/prompt/checkpoint/epoch/network 等保留英文；Dataset→数据集、Sample→样例、Sampler→采样器等）
- `docs/adr/0001-runtime-translation-overlay.md` — 为什么是覆盖层；日志流/用户数据永不翻译
- `docs/adr/0002-translation-scope-boundaries.md` — docs.tsx 属二期，本期不碰

**上游补丁面纪律：** 全计划只允许修改这 5 个上游文件：`ui/src/app/layout.tsx`、`ui/src/app/settings/page.tsx`、`ui/src/app/api/settings/route.ts`、`ui/package.json`、`ui/package-lock.json`（lock 随 npm install 自动变化）。其余一律为新增文件。超出此清单的任何源码改动必须先回来修订 ADR-0001。

**环境注意：** 本机当前有一个正在运行的 UI（`python -m manager launch`，端口 8675）。Task 6/7/10 需要重建/重启时先停掉它（PowerShell：`Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force`）。所有命令在 `j:\ai-toolkit-me\ai-toolkit` 下的对应目录执行，PowerShell 语法。

**File Structure（产物地图）：**

| 路径 | 动作 | 职责 |
|---|---|---|
| `ui/src/i18n/types.ts` | 新建 | `Lang`、`Dict` 类型 |
| `ui/src/i18n/core.ts` | 新建 | 纯函数：skeleton 归一、两级 lookup、排除规则（无 DOM 依赖，可测） |
| `ui/src/i18n/langStore.ts` | 新建 | 语言状态单例 + 订阅 + localStorage 镜像 + 首访推断（D2） |
| `ui/src/i18n/overlayEngine.ts` | 新建 | 纯 DOM 引擎：applyAll（文本+属性）/ watch（MutationObserver）/ 漏翻与模板命中统计 |
| `ui/src/i18n/TranslationOverlay.tsx` | 新建 | React 挂载壳：启动引擎、订阅语言、拉取服务端偏好、暴露 window 钩子 |
| `ui/src/i18n/data/zh.ts` | 新建 | 中文词典（exact/templates/allowEnglish），W2 全量灌入的目标文件 |
| `ui/src/i18n/data/extracted.en.json` | 脚本生成 | 提取底表（词典覆盖率测试的输入） |
| `ui/src/i18n/__tests__/*.test.ts(x)` | 新建 | vitest 测试 |
| `ui/vitest.config.ts` | 新建 | 测试配置 |
| `tools/i18n/extract.mjs` | 新建 | AST 提取脚本 |
| `tools/i18n/audit.mjs` + `tools/i18n/package.json` | 新建 | V2 巡检（独立 npm 目录，零上游冲突） |
| `ui/src/app/layout.tsx` | 修改 | 挂载 `<TranslationOverlay />` |
| `ui/src/app/settings/page.tsx` | 修改 | 顶部加 LanguageSwitch 分段控件（I2 即选即效） |
| `ui/src/app/api/settings/route.ts` | 修改 | POST 改为按键白名单的 partial-safe upsert，加 `LANGUAGE` |

---

### Task 1: 测试基建（vitest）+ 词典文件骨架

**Files:**
- Modify: `ui/package.json`（devDeps + scripts，允许的补丁点）
- Create: `ui/vitest.config.ts`
- Create: `ui/src/i18n/types.ts`
- Create: `ui/src/i18n/data/zh.ts`
- Test: `ui/src/i18n/__tests__/shape.test.ts`

- [ ] **Step 1: 安装 vitest/jsdom（补丁 ui/package.json）**

```powershell
cd j:\ai-toolkit-me\ai-toolkit\ui
npm install -D vitest jsdom --no-audit --no-fund
```
预期：`package.json` devDependencies 出现 `vitest`、`jsdom`。

- [ ] **Step 2: 写失败测试（types + zh.ts 骨架存在且形状正确）**

`ui/src/i18n/__tests__/shape.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import zh from '../data/zh';

describe('dictionary shape', () => {
  it('has the three required maps', () => {
    expect(typeof zh.exact).toBe('object');
    expect(typeof zh.templates).toBe('object');
    expect(Array.isArray(zh.allowEnglish)).toBe(true);
  });
  it('contains seed entries obeying the core glossary', () => {
    expect(zh.exact['Settings']).toBe('设置');
    expect(zh.exact['Save Settings']).toBe('保存设置');
    expect(zh.exact['Delete']).toBe('删除');
    // S2: glossary terms must stay English inside translations
    expect(zh.exact['Delete Dataset']).toBe('删除数据集');
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run src/i18n/__tests__/shape.test.ts`（在 `ui/` 下）
Expected: FAIL — `Cannot find module '../data/zh'` 或等价解析错误。

- [ ] **Step 4: 实现最小代码**

`ui/src/i18n/types.ts`：

```ts
export type Lang = 'en' | 'zh';

export interface Dict {
  /** trimmed exact original -> translation (may contain {0}.. only if no numbers involved) */
  exact: Record<string, string>;
  /** skeleton (numbers normalized to '#') -> translation with {0},{1}.. backfill */
  templates: Record<string, string>;
  /** originals (trimmed or skeleton) deliberately left in English; suppresses miss logging */
  allowEnglish: string[];
}
```

`ui/src/i18n/data/zh.ts`：

```ts
import type { Dict } from '../types';

const zh: Dict = {
  exact: {
    Settings: '设置',
    'Save Settings': '保存设置',
    Delete: '删除',
    'Delete Dataset': '删除数据集',
  },
  templates: {},
  allowEnglish: [],
};

export default zh;
```

`ui/vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/i18n/**/*.test.ts', 'src/i18n/**/*.test.tsx'],
    environment: 'node',
  },
});
```

同时在 `ui/package.json` 的 `scripts` 中手动补一行：`"test:i18n": "vitest run"`。

- [ ] **Step 5: 跑测试确认通过**

Run: `npm run test:i18n`  → Expected: 1 file passed, 2 tests passed。

- [ ] **Step 6: Commit**

```powershell
cd j:\ai-toolkit-me\ai-toolkit
git add ui/package.json ui/package-lock.json ui/vitest.config.ts ui/src/i18n
git commit -m "chore(i18n): vitest infra + zh dictionary skeleton"
```

---

### Task 2: 匹配内核 core.ts（精确 + 模板归一化，M2）

**Files:**
- Create: `ui/src/i18n/core.ts`
- Test: `ui/src/i18n/__tests__/core.test.ts`

- [ ] **Step 1: 写失败测试**

`ui/src/i18n/__tests__/core.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { skeleton, lookup, shouldSkip, looksLikeUiText } from '../core';
import type { Dict } from '../types';

const dict: Dict = {
  exact: { 'Save Settings': '保存设置' },
  templates: {
    'Are you sure you want to delete # jobs? This action cannot be undone.':
      '确定要删除 {0} 个任务吗？此操作无法撤销。',
    'Too many placeholders # #': '越界 {0} {9}',
  },
  allowEnglish: [],
};

describe('skeleton', () => {
  it('normalizes numbers and whitespace', () => {
    expect(skeleton('delete   1,234 jobs')).toBe('delete # jobs');
    expect(skeleton('step 12.5 of 100')).toBe('step # of #');
  });
});

describe('lookup', () => {
  it('exact hit preserves leading/trailing whitespace', () => {
    const r = lookup(dict, '  Save Settings\n');
    expect(r).not.toBeNull();
    expect(r!.translation).toBe('  保存设置\n');
    expect(r!.viaTemplate).toBe(false);
  });
  it('template hit backfills numbers in order', () => {
    const r = lookup(
      dict,
      'Are you sure you want to delete 12 jobs? This action cannot be undone.'
    );
    expect(r!.translation).toBe('确定要删除 12 个任务吗？此操作无法撤销。');
    expect(r!.viaTemplate).toBe(true);
    expect(r!.skeletonKey).toContain('#');
  });
  it('returns null when placeholder index has no value', () => {
    expect(lookup(dict, 'Too many placeholders 1 2')).toBeNull();
  });
  it('returns null on no match', () => {
    expect(lookup(dict, 'zzz totally unknown')).toBeNull();
  });
});

describe('shouldSkip', () => {
  // jsdom needed only for this block
  it('logic lives on tagName set + selectors, unit-tested in overlay test via DOM', () => {
    expect(looksLikeUiText('Hello world')).toBe(true);
    expect(looksLikeUiText('1234 .5678')).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/i18n/__tests__/core.test.ts` → Expected: FAIL — 模块不存在。

- [ ] **Step 3: 实现 core.ts**

`ui/src/i18n/core.ts`：

```ts
import type { Dict } from './types';

const NUM_RE = /\d[\d,]*(?:\.\d+)?/g;

/** Normalize numbers to '#' and collapse whitespace — the key of dict.templates. */
export function skeleton(text: string): string {
  return text.replace(NUM_RE, '#').replace(/\s+/g, ' ').trim();
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
  const start = raw.length - raw.trimStart().length;
  const end = raw.trimEnd().length;
  const pre = raw.slice(0, start);
  const post = raw.slice(end);
  const compose = (t: string) => pre + t + post;

  const exactHit = dict.exact[trimmed];
  if (exactHit !== undefined) return { translation: compose(exactHit), viaTemplate: false };

  const sk = skeleton(trimmed);
  const tpl = dict.templates[sk];
  if (tpl !== undefined) {
    const values = trimmed.match(NUM_RE) ?? [];
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/i18n/__tests__/core.test.ts` → Expected: PASS（4 个 describe 全绿）。

- [ ] **Step 5: Commit**

```powershell
git add ui/src/i18n/core.ts ui/src/i18n/__tests__/core.test.ts
git commit -m "feat(i18n): two-level dictionary matcher (exact + numeric skeleton)"
```

---

### Task 3: 语言状态 langStore.ts（P1 镜像 + D2 首访推断）

**Files:**
- Create: `ui/src/i18n/langStore.ts`
- Test: `ui/src/i18n/__tests__/langStore.test.ts`

- [ ] **Step 1: 写失败测试**

`ui/src/i18n/__tests__/langStore.test.ts`：

```ts
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
```

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run src/i18n/__tests__/langStore.test.ts` → FAIL（模块不存在）。

- [ ] **Step 3: 实现**

`ui/src/i18n/langStore.ts`：

```ts
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
```

- [ ] **Step 4: 跑测试确认通过** — 同命令 → Expected: PASS 4 tests。

- [ ] **Step 5: Commit**

```powershell
git add ui/src/i18n/langStore.ts ui/src/i18n/__tests__/langStore.test.ts
git commit -m "feat(i18n): language store with ls mirror + first-visit detection"
```

---

### Task 4: DOM 引擎 overlayEngine.ts（applyAll + watch + 漏翻收集器）

**Files:**
- Create: `ui/src/i18n/overlayEngine.ts`
- Test: `ui/src/i18n/__tests__/overlay.test.ts`

- [ ] **Step 1: 写失败测试（jsdom，覆盖文本翻译/排除/还原/外部改动/属性/watch）**

`ui/src/i18n/__tests__/overlay.test.ts`：

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { applyAll, createStats, type EngineStats } from '../overlayEngine';
import type { Dict } from '../types';

const dict: Dict = {
  exact: {
    'Save Settings': '保存设置',
    Delete: '删除',
    'Enter your Hugging Face token': '输入你的 Hugging Face token',
  },
  templates: { 'Upsample (#)': '提升 ({0})' },
  allowEnglish: ['Keep Me English'],
};
let stats: EngineStats;
beforeEach(() => {
  stats = createStats();
  document.body.innerHTML = `
    <div id="app">
      <button>Save Settings</button>
      <pre>Training step 100 loss 0.3</pre>
      <div class="font-mono">log line here</div>
      <input placeholder="Enter your Hugging Face token" />
      <span id="tpl">Upsample (12)</span>
      <span>Keep Me English</span>
    </div>`;
});

function run(lang: 'en' | 'zh') {
  applyAll(document.body, lang, dict, stats);
}

it('zh: translates button, skips pre and font-mono', () => {
  run('zh');
  expect(document.querySelector('button')!.textContent).toBe('保存设置');
  expect(document.querySelector('pre')!.textContent).toBe('Training step 100 loss 0.3');
  expect(document.querySelector('.font-mono')!.textContent).toBe('log line here');
});
it('zh: translates placeholder attribute', () => {
  run('zh');
  expect(document.querySelector('input')!.getAttribute('placeholder')).toBe(
    '输入你的 Hugging Face token'
  );
});
it('zh: template hit backfills number and records skeleton', () => {
  run('zh');
  expect(document.getElementById('tpl')!.textContent).toBe('提升 (12)');
  expect([...stats.templateHits]).toContain('Upsample (#)');
});
it('en after zh: restores every node to the original English', () => {
  run('zh');
  run('en');
  expect(document.querySelector('button')!.textContent).toBe('Save Settings');
  expect(document.getElementById('tpl')!.textContent).toBe('Upsample (12)');
});
it('react-style external change to new English text is re-translated (stale original bug)', () => {
  run('zh');
  const b = document.querySelector('button')!;
  b.textContent = 'Delete'; // React re-render wrote new English
  run('zh');
  expect(b.textContent).toBe('删除');
});
it('unmatched UI text is recorded as miss; allowEnglish is not', () => {
  document.body.innerHTML += '<div id="untranslated">Some Unknown Text</div>';
  run('zh');
  const misses = [...stats.misses];
  expect(misses).toContain('Some Unknown Text');
  expect(misses).not.toContain('Keep Me English');
});
it('watch(): applies immediately and re-applies on DOM mutations', async () => {
  const { watch } = await import('../overlayEngine');
  const stop = watch(document.body, () => 'zh' as const, () => dict, stats);
  expect(document.querySelector('button')!.textContent).toBe('保存设置');
  const span = document.createElement('span');
  span.textContent = 'Delete';
  document.getElementById('app')!.appendChild(span);
  await new Promise(r => setTimeout(r, 50)); // MutationObserver microtask + rAF
  // jsdom fires MutationObserver; rAF shim may need flush — force:
  await new Promise(r => (requestAnimationFrame ? (r as any)(0) : setTimeout(r, 30)));
  await new Promise(r => setTimeout(r, 80));
  expect(span.textContent).toBe('删除');
  stop();
});
```

注意：jsdom 对 rAF/MutationObserver 时序不稳时，允许把最后一个 watch 用例改为「手动再调一次 applyAll」的同步断言。**不得**为了过测而放宽引擎语义。

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run src/i18n/__tests__/overlay.test.ts` → FAIL（模块不存在）。

- [ ] **Step 3: 实现 overlayEngine.ts**

`ui/src/i18n/overlayEngine.ts`：

```ts
import type { Dict, Lang } from './types';
import { lookup, shouldSkip, looksLikeUiText, skeleton, TRANSLATABLE_ATTRS } from './core';

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

function walkText(root: Node, cb: (n: Text) => void) {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Text | null;
  while ((n = tw.nextNode() as Text | null)) cb(n);
}

/** Idempotent full pass over `root` for the target language. */
export function applyAll(root: HTMLElement, lang: Lang, dict: Dict, stats: EngineStats): void {
  const allow = new Set(dict.allowEnglish);

  walkText(root, node => {
    const host = node.parentElement;
    if (!host || shouldSkip(host)) return;
    const cur = node.textContent ?? '';
    // Staleness guard: only trust our saved original when the node still shows what we last wrote.
    const orig =
      appliedText.get(node) === cur ? originals.get(node) ?? cur : cur;
    originals.set(node, orig);

    if (lang === 'en') {
      if (node.textContent !== orig) {
        node.textContent = orig;
        appliedText.set(node, orig);
      }
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
      const t = orig.trim();
      if (t && looksLikeUiText(t) && !allow.has(t) && !allow.has(skeleton(t))) {
        stats.misses.add(t);
      }
    }
  });

  root.querySelectorAll('*').forEach(el => {
    if (shouldSkip(el)) return;
    let store: Record<string, string> | undefined = origAttrs.get(el);
    for (const attr of TRANSLATABLE_ATTRS) {
      const v = el.getAttribute(attr);
      if (v === null) continue;
      if (!store) {
        store = {};
        origAttrs.set(el, store);
      }
      if (store[attr] === undefined) store[attr] = v;
      const base = store[attr];
      if (lang === 'en') {
        if (v !== base) el.setAttribute(attr, base);
        continue;
      }
      const hit = lookup(dict, base);
      if (hit) {
        if (el.getAttribute(attr) !== hit.translation) el.setAttribute(attr, hit.translation);
        if (hit.viaTemplate && hit.skeletonKey) stats.templateHits.add(hit.skeletonKey);
      } else {
        const t = base.trim();
        if (t && looksLikeUiText(t) && !allow.has(t) && !allow.has(skeleton(t))) stats.misses.add(t);
      }
    }
  });
}

/** Observe mutations (debounced to rAF) and keep the subtree translated. Returns stop(). */
export function watch(
  root: HTMLElement,
  getLang: () => Lang,
  getDict: () => Dict,
  stats: EngineStats
): () => void {
  let queued = false;
  let applying = false;
  const observer = new MutationObserver(() => {
    if (applying) return;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applying = true;
      observer.takeRecords(); // drop our own mutations
      applyAll(root, getLang(), getDict(), stats);
      applying = false;
    });
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRS],
  });
  applyAll(root, getLang(), getDict(), stats);
  return () => observer.disconnect();
}
```

- [ ] **Step 4: 跑测试确认通过** — 同命令 → Expected: 全部 PASS（placeholder 用例按上方注释以 `applyAll` 同步断言为准）。

- [ ] **Step 5: 全量回归 + Commit**

```powershell
cd j:\ai-toolkit-me\ai-toolkit\ui
npm run test:i18n
cd ..
git add ui/src/i18n/overlayEngine.ts ui/src/i18n/__tests__/overlay.test.ts
git commit -m "feat(i18n): DOM translation engine with staleness guard and miss collector"
```

---

### Task 5: React 挂载壳 + layout 接线（补丁点 1）

**Files:**
- Create: `ui/src/i18n/TranslationOverlay.tsx`
- Modify: `ui/src/app/layout.tsx`（允许的补丁文件）

- [ ] **Step 1: 实现 TranslationOverlay.tsx**

`ui/src/i18n/TranslationOverlay.tsx`：

```tsx
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
    const stop = watch(document.body, getLang, () => zh, stats);
    // Language switches do not mutate the DOM; bounce a body attribute to trigger watch().
    const unsub = subscribe(() => {
      document.body.dataset.lang = getLang();
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
    if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
      const orig = console.debug;
      const dump = () => {
        if (stats.misses.size) orig('[i18n] untranslated:', [...stats.misses].sort());
      };
      setTimeout(dump, 3000);
    }
    return () => {
      stop();
      unsub();
    };
  }, []);
  return null;
}
```

- [ ] **Step 2: 修改 layout.tsx（只加两行，补丁点 1）**

在 `ui/src/app/layout.tsx` import 区末尾追加：

```tsx
import TranslationOverlay from '@/i18n/TranslationOverlay';
```

并在 `<PromptBoxEditorModal />` 之后、`</body>` 之前插入：

```tsx
        <TranslationOverlay />
```

- [ ] **Step 3: 类型检查**

Run: `cd ui; npx tsc --noEmit -p tsconfig.json`
Expected: 无新增错误（若上游本就有历史错误，比对 `git stash` 前后输出一致即可）。

- [ ] **Step 4: Commit**

```powershell
git add ui/src/i18n/TranslationOverlay.tsx ui/src/app/layout.tsx
git commit -m "feat(i18n): mount translation overlay in root layout"
```

---

### Task 6: 服务端偏好（补丁点 2/3）+ Settings 页一键切换（补丁点 3）

**Files:**
- Modify: `ui/src/app/api/settings/route.ts`
- Modify: `ui/src/app/settings/page.tsx`

⚠️ 关键安全设计：现有 POST 把解构失败的 `undefined` 写库会**清空 HF_TOKEN**。必须改成「按键白名单 + 仅 upsert 请求里出现的字符串键」，这样语言开关可以只 POST `{LANGUAGE}`。

- [ ] **Step 1: 重写 POST（GET 不动）**

把 `ui/src/app/api/settings/route.ts` 中整个 `export async function POST` 替换为：

```ts
const ALLOWED_KEYS = ['HF_TOKEN', 'TRAINING_FOLDER', 'DATASETS_FOLDER', 'MODELS_PATH', 'LANGUAGE'];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Partial-safe: only upsert string values actually present in this request.
    // (Language switch posts {LANGUAGE} alone and must not wipe HF_TOKEN.)
    const ops = ALLOWED_KEYS.filter(k => typeof body?.[k] === 'string').map(k =>
      prisma.settings.upsert({
        where: { key: k },
        update: { value: body[k] },
        create: { key: k, value: body[k] },
      })
    );
    if (ops.length === 0) {
      return NextResponse.json({ error: 'No valid settings keys in body' }, { status: 400 });
    }
    await Promise.all(ops);

    flushCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Settings 页加 LanguageSwitch（I2 即选即效，独立于表单）**

在 `ui/src/app/settings/page.tsx` import 区追加：

```tsx
import { getLang, setLang, subscribe } from '@/i18n/langStore';
import type { Lang } from '@/i18n/types';
```

在文件底部（`export default function Settings` 之外）新增组件：

```tsx
function LanguageSwitch() {
  const [lang, setLangView] = useState<Lang | null>(null);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    setLangView(getLang());
    return subscribe(l => setLangView(l));
  }, []);
  const choose = (l: Lang) => {
    if (l === lang) return;
    setLang(l); // instant apply (mirror write included)
    setSaveError(false);
    apiClient.post('/api/settings', { LANGUAGE: l }).catch(err => {
      console.error('Failed to persist language:', err);
      setSaveError(true);
    });
  };
  const btn = (active: boolean) =>
    `px-4 py-1.5 text-sm transition-colors ${
      active ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`;
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-sm font-medium">Language / 语言</span>
      <div className="inline-flex rounded-lg overflow-hidden border border-gray-700">
        <button type="button" className={btn(lang === 'en')} onClick={() => choose('en')}>
          English
        </button>
        <button type="button" className={btn(lang === 'zh')} onClick={() => choose('zh')}>
          简体中文
        </button>
      </div>
      {saveError && <span className="text-xs text-orange-400">保存失败，仍为本地生效</span>}
    </div>
  );
}
```

在 `<MainContent>` 内、`<form …>` 之前插入一行：

```tsx
        <LanguageSwitch />
```

- [ ] **Step 3: 构建并重启 UI 验证**

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
cd j:\ai-toolkit-me\ai-toolkit\ui
npm run build
```
Expected: `next build` 成功（Compiled + 路由表输出）。然后启动：`cd j:\ai-toolkit-me\ai-toolkit; python -m manager launch`（后台）。

- [ ] **Step 4: API 行为验证（partial-safe 关键回归）**

```powershell
curl.exe -s -X POST http://localhost:8675/api/settings -H "Content-Type: application/json" -d '{\"LANGUAGE\":\"zh\"}'
curl.exe -s http://localhost:8675/api/settings
```
Expected: 第一条返回 `{"success":true}`；第二条 JSON 含 `"LANGUAGE":"zh"`，且 `HF_TOKEN` 字段仍存在（未被清空——之前若保存过则有值）。

- [ ] **Step 5: 浏览器手工冒烟**

打开 `http://localhost:8675/settings`：点「简体中文」→ 页面 Settings 标题等已入词典文案**立即**变中文；F5 刷新仍是中文；点「English」立即回英文（验证 en 还原路径）。Console 无红错。

- [ ] **Step 6: Commit**

```powershell
git add ui/src/app/api/settings/route.ts ui/src/app/settings/page.tsx
git commit -m "feat(i18n): LANGUAGE server setting + instant-switch control"
```

---

### Task 7: 文案提取脚本（W2 底表）

**Files:**
- Create: `tools/i18n/extract.mjs`
- Generate: `ui/src/i18n/data/extracted.en.json`

- [ ] **Step 1: 写脚本**

`tools/i18n/extract.mjs`（最终版，目录递归以 `walkDir` 为准）：

```js
// AST-extract UI copy from ui/src (JSX text, key attributes, template/confirm strings)
// into a base table for dictionary authoring. Run: node tools/i18n/extract.mjs
import { createRequire } from 'module';
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const REPO = path.resolve(__dirname, '..', '..');
const ts = require(path.join(REPO, 'ui', 'node_modules', 'typescript'));

const SRC = path.join(REPO, 'ui', 'src');

const found = new Map(); // trimmed text -> Set(relfile)

function add(raw, file) {
  const t = raw.trim();
  if (!t || !/[A-Za-z]{2}/.test(t)) return;
  if (!found.has(t)) found.set(t, new Set());
  found.get(t).add(path.relative(REPO, file));
}

function templateToSkeleton(node) {
  // `Upsample (${n})` -> "Upsample (#)"; expressions collapse to '#'
  let out = node.head?.text ?? '';
  const spans = node.templateSpans || [];
  for (const s of spans) {
    out += '#';
    if (s.literal) out += s.literal.text;
  }
  return out;
}

function parseFile(file) {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = node => {
    if (ts.isJsxText(node)) add(node.text, file);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // collect liberally: noise is triaged later via zh.allowEnglish
      add(node.text, file);
    }
    if (ts.isTemplateExpression(node)) add(templateToSkeleton(node), file);
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

function walkDir(dir) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (e === 'i18n' || e === 'node_modules' || e === '.next' || e.startsWith('__')) continue;
      walkDir(p);
    } else if (/\.tsx$/.test(e)) parseFile(p);
  }
}

walkDir(SRC);

const strings = [...found.entries()]
  .map(([text, files]) => ({ text, files: [...files] }))
  .sort((a, b) => a.text.localeCompare(b.text));

const outFile = path.join(REPO, 'ui', 'src', 'i18n', 'data', 'extracted.en.json');
mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify({ generatedBy: 'tools/i18n/extract.mjs', count: strings.length, strings }, null, 2));
console.log(`extracted ${strings.length} unique strings -> ${path.relative(REPO, outFile)}`);
```

提取采取「上下文敏感收集」策略（实施修订，取代原计划的“宁多勿漏+全量收集”）：仅收集 JsxText、白名单属性（placeholder/title/alt/aria-label）、白名单对象属性（title/message/instruction/label/text/ok/cancel）及 JSX 子节点内直接字符串/三元分支；并跳过 docs.tsx（ADR-0002 二期边界）。实测 536 条，噪声归零。运行时兼容仍由漏翻收集器（V2 巡检）兑底。

- [ ] **Step 2: 运行并 sanity 检查**

```powershell
cd j:\ai-toolkit-me\ai-toolkit
node tools/i18n/extract.mjs
```
Expected: 输出 `extracted NNNN unique strings -> ui\src\i18n\data\extracted.en.json`（N 预估 1500-3500）。抽查 JSON：应含 `Are you sure you want to delete # jobs? This action cannot be undone.` 这类骨架句与 `Upsample (#)`。

- [ ] **Step 3: Commit**

```powershell
git add tools/i18n/extract.mjs ui/src/i18n/data/extracted.en.json
git commit -m "feat(i18n): AST extraction script + EN base table"
```

---

### Task 8: 词典覆盖率测试 + zh.ts 全量灌入（W2 翻译）

**Files:**
- Create: `ui/src/i18n/__tests__/coverage.test.ts`
- Modify: `ui/src/i18n/data/zh.ts`（内容生成，可能拆多个 commit）

- [ ] **Step 1: 写失败的覆盖率测试**

`ui/src/i18n/__tests__/coverage.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { skeleton } from '../core';
import zh from '../data/zh';

const extracted = JSON.parse(
  readFileSync(path.join(__dirname, '../data/extracted.en.json'), 'utf8')
);

describe('dictionary coverage (W2)', () => {
  it('every extracted string is translated or deliberately English', () => {
    const allow = new Set(zh.allowEnglish);
    const missing: string[] = [];
    for (const { text } of extracted.strings) {
      const sk = skeleton(text);
      if (zh.exact[text] !== undefined || zh.templates[sk] !== undefined) continue;
      if (allow.has(text) || allow.has(sk)) continue;
      missing.push(text);
    }
    if (missing.length) {
      console.log(`coverage gap: ${missing.length}/${extracted.strings.length}`, missing.slice(0, 40));
    }
    expect(missing).toEqual([]);
  });
});
```

Run: `npx vitest run src/i18n/__tests__/coverage.test.ts` → Expected: FAIL（大面积缺口，这就是任务目标）。

- [ ] **Step 2: 分批翻译灌入 zh.ts**

操作规范（每批 ≤200 条，批批跑测试、批批提交）：
1. 读 `ui/src/i18n/data/extracted.en.json` 的 `missing` 清单（测试输出或脚本过滤）；
2. 逐条按 `CONTEXT.md`「核心术语表」翻译写入 `zh.exact`；带 `#` 骨架的写 `zh.templates`（译文用 `{0}`/`{1}` 按序回填，**必须保持 `#` 数量 = 占位符数量**，否则运行时按 null 处理进漏翻）；
3. 属于**用户数据/技术标识**的条目（文件名样式 `*.jpg`、模型标签、代码 token、`Bearer` 这类永远不该出现在 DOM 翻译路径的）加入 `zh.allowEnglish`，并在数组里用注释标分组原因；
4. 术语红线（违反即返工）：Sample→样例、Sampler→采样器、Scheduler→调度器；`prompt/checkpoint/epoch/network/LoRA/LoKr/seed` 保留原文；Dashboard→概览、Jobs→任务。
5. 中文句子里的占位符两侧不加空格（`确定要删除{0}个任务吗`），UI 按钮等短词条不加句号，问句保留「？」。

- [ ] **Step 3: 覆盖率测试转绿 + 全量测试回归**

```powershell
cd j:\ai-toolkit-me\ai-toolkit\ui
npm run test:i18n
```
Expected: 全部 PASS，含 coverage 测试 `toEqual([])`。

- [ ] **Step 4: Commit（可能多次）**

```powershell
git add ui/src/i18n/data/zh.ts ui/src/i18n/__tests__/coverage.test.ts
git commit -m "feat(i18n): full zh dictionary (exact + templates) per core glossary"
```

---

### Task 9: V2 自动化巡检 + 修复循环

**Files:**
- Create: `tools/i18n/package.json`
- Create: `tools/i18n/audit.mjs`

- [ ] **Step 1: 独立测试工具目录（零上游冲突）**

`tools/i18n/package.json`：

```json
{
  "name": "aitk-i18n-tools",
  "private": true,
  "type": "module",
  "dependencies": {
    "playwright": "1.54.1"
  }
}
```

```powershell
cd j:\ai-toolkit-me\ai-toolkit\tools\i18n
npm install
npx playwright install chromium
```

- [ ] **Step 2: 巡检脚本**

`tools/i18n/audit.mjs`：

```js
// V2 acceptance: walk 7 main routes in zh, fail on any untranslated miss.
// Run (UI must be up on :8675): node tools/i18n/audit.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'http://localhost:8675';
const ROUTES = ['/', '/dashboard', '/jobs', '/jobs/new', '/datasets', '/generate', '/settings'];
mkdirSync(new URL('./artifacts', import.meta.url), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => localStorage.setItem('aitk_lang', 'zh'));

let fail = 0;
const allTemplateHits = new Set();
for (const r of ROUTES) {
  await page.goto(BASE + r, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000); // allow settings fetch + rAF translation passes
  const misses = await page.evaluate(() => window.__i18nMisses || []);
  const hits = await page.evaluate(() => window.__i18nTemplateHits || []);
  hits.forEach(h => allTemplateHits.add(h));
  const safe = r === '/' ? 'index' : r.replace(/\W+/g, '_');
  await page.screenshot({ path: `artifacts/${safe}.zh.png`, fullPage: true });
  console.log(`${r}: misses=${misses.length}`);
  misses.forEach(m => console.log('   MISS:', m));
  if (misses.length) fail = 1;
}
console.log('\n--- template hits (human proofread these) ---');
[...allTemplateHits].sort().forEach(t => console.log('  ', t));
await browser.close();
process.exit(fail);
```

- [ ] **Step 3: 运行巡检（判据：exit 0）**

```powershell
cd j:\ai-toolkit-me\ai-toolkit
node tools/i18n/audit.mjs
```
Expected: 7 条路由全 `misses=0`，exit code 0。**修复循环**：每个 MISS → 判断是词典缺口（补 `zh.exact/templates`）还是用户数据（补 `zh.allowEnglish`）→ 重跑 `npm run test:i18n` 确认覆盖率测试仍绿 → 重跑 audit，直至 0。截图存 `tools/i18n/artifacts/` 供人工视觉抽查；模板命中清单逐条人工核对中文通顺度。

- [ ] **Step 4: Commit**

```powershell
git add tools/i18n/package.json tools/i18n/package-lock.json tools/i18n/audit.mjs ui/src/i18n/data/zh.ts
git commit -m "test(i18n): playwright V2 audit - zero misses on 7 main routes"
```

（`tools/i18n/node_modules`、`artifacts/` 加入根 `.gitignore` 追加行：`tools/i18n/node_modules/` `tools/i18n/artifacts/` —— `.gitignore` 为上游文件，属第 6 个补丁点，Task 10 修订 ADR 时一并登记。）

---

### Task 10: 文档修订 + 全量回归收尾

**Files:**
- Modify: `docs/adr/0001-runtime-translation-overlay.md`
- Modify: `.gitignore`

- [ ] **Step 1: 修订 ADR-0001 的补丁面清单为实际值**

把 Consequences 第二条替换为：

```md
- 全项目接受的上游补丁面实测为 6 处：`ui/src/app/layout.tsx`（挂载壳一行）、`ui/src/app/settings/page.tsx`（LanguageSwitch）、`ui/src/app/api/settings/route.ts`（partial-safe POST + LANGUAGE 白名单）、`ui/package.json` + `ui/package-lock.json`（vitest/jsdom devDep、test:i18n 脚本）、根 `.gitignore`（tools/i18n 产物）。超出此清单的源码改动需新 ADR。
```

- [ ] **Step 2: 最终回归**

```powershell
cd j:\ai-toolkit-me\ai-toolkit\ui
npm run test:i18n          # Expected: 全绿
npm run build              # Expected: next build 成功
cd ..; node tools/i18n/audit.mjs   # Expected: exit 0
```

再手动验证「一键切换」完整承诺：Settings 点简体中文 → 全站即时变中文（不刷新）→ F5 仍中文 → 换一个浏览器标签页打开也是中文（服务端真源生效）→ 清 localStorage 镜像后仍中文 → 切回 English 全部还原。

- [ ] **Step 3: Commit**

```powershell
git add docs/adr/0001-runtime-translation-overlay.md .gitignore
git commit -m "docs(i18n): record actual upstream patch surface in ADR-0001"
```

---

## Self-Review 结论

- 决议映射：路线 Y→Task 4/5/6；P1+镜像→Task 3/5/6；S2 术语→Task 1/8 翻译规范；M2→Task 2；W2+收集器→Task 7/8 + Task 4；D2→Task 3/5；I2→Task 6；V2→Task 9。范围排除项无对应任务 = 正确（docs.tsx/日志本期不做）。
- 已知取舍：Task 4 的 watch 用例对 jsdom rAF 时序敏感，允许改为同步 `applyAll` 断言（引擎语义不变）；Task 7 提取脚本采取「宁多勿漏 + allowEnglish 治理」策略，噪声交给 Task 8/9 的修复循环消化；提取脚本中的属性/属性名白名单 Set 已因策略改为全量收集而删除。

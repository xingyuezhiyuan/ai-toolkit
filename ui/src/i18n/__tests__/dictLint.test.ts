import { describe, it, expect } from 'vitest';
import zh from '../data/zh';

// Lint the hand-authored dictionary itself (found by code review: silent
// template errors like a literal '#' or an out-of-range {n} never surface in
// coverage or runtime misses).
describe('zh.ts template lint', () => {
  it('template values reference only existing slots', () => {
    const bad: string[] = [];
    for (const [key, value] of Object.entries(zh.templates)) {
      const slots = (key.match(/#/g) || []).length;
      for (const m of value.matchAll(/\{(\d+)\}/g)) {
        if (Number(m[1]) >= slots) bad.push(`${key} -> ${value}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('template values contain no bare # (would render as a literal hash)', () => {
    const bad: string[] = [];
    for (const [key, value] of Object.entries(zh.templates)) {
      // 'GPU #{0}' is legit (hash glued to a placeholder); '# ' / '字#' is not.
      if (/(^|[^{])#(?!\{)/.test(value) && !/#\{/.test(value)) bad.push(`${key} -> ${value}`);
      else if (/\#\s/.test(value)) bad.push(`${key} -> ${value}`);
    }
    expect(bad).toEqual([]);
  });

  it('translations obey the core glossary: no forbidden renderings', () => {
    const bad: string[] = [];
    const forbidden = ['提示词', '采样（器|例）错误']; // prompt must stay English
    for (const [key, value] of Object.entries({ ...zh.exact, ...zh.templates })) {
      for (const f of forbidden.slice(0, 1)) {
        if (value.includes(f) && !key.includes(f)) bad.push(`${key} -> ${value}`);
      }
      // 'Sampler' must be 采样器, never 样例; 'Sample' must be 样例, never 采样器
      if (/sampler/i.test(key) && value.includes('样例')) bad.push(`${key} -> ${value}`);
      if (/\bsample(s)?\b(?!.*sampler)/i.test(key) && value.includes('采样器'))
        bad.push(`${key} -> ${value}`);
    }
    expect(bad).toEqual([]);
  });
});

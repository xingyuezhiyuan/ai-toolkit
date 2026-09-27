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
      console.log(
        `coverage gap: ${missing.length}/${extracted.strings.length}`,
        missing.slice(0, 40)
      );
    }
    expect(missing).toEqual([]);
  });
});

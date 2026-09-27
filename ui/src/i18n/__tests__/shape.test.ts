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

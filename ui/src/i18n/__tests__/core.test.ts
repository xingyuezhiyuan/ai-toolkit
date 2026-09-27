import { describe, it, expect } from 'vitest';
import { skeleton, lookup, looksLikeUiText, looksLikeData } from '../core';
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
  it('normalizes numbers, whitespace and quoted phrases', () => {
    expect(skeleton('delete   1,234 jobs')).toBe('delete # jobs');
    expect(skeleton('step 12.5 of 100')).toBe('step # of #');
    expect(skeleton('stop the job "flux 甜妹 12"?')).toBe('stop the job "#"?');
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
  it('quoted-phrase slot backfills without the surrounding quotes', () => {
    const qd: Dict = {
      exact: {},
      templates: { 'Delete "#" to free?': '删除「{0}」以释放空间？' },
      allowEnglish: [],
    };
    const r = lookup(qd, 'Delete "my dataset 3" to free?');
    expect(r!.translation).toBe('删除「my dataset 3」以释放空间？');
  });
});

describe('looksLikeUiText', () => {
  it('filters non-UI text', () => {
    expect(looksLikeUiText('Hello world')).toBe(true);
    expect(looksLikeUiText('1234 .5678')).toBe(false);
  });
});

describe('looksLikeData', () => {
  it('recognizes runtime data shapes that are never UI copy', () => {
    expect(looksLikeData('16.4 GB')).toBe(true);
    expect(looksLikeData('1.3 / 26 GB')).toBe(true);
    expect(looksLikeData('alpha')).toBe(true);
    expect(looksLikeData('inference_engine_gpu0')).toBe(true);
    expect(looksLikeData('Tongyi-MAI/Z-Image')).toBe(true);
    expect(looksLikeData('NVIDIA GeForce RTX 3090')).toBe(true);
    expect(looksLikeData('New Job')).toBe(false);
    expect(looksLikeData('Learning Rate')).toBe(false);
  });
});

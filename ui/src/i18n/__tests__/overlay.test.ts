// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { applyAll, watch, createStats, type EngineStats } from '../overlayEngine';
import type { Dict } from '../types';

const dict: Dict = {
  exact: {
    'Save Settings': '保存设置',
    Delete: '删除',
    'Enter your Hugging Face token': '输入你的 Hugging Face 令牌',
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

describe('applyAll', () => {
  it('zh translates button text, skips pre and font-mono subtrees', () => {
    run('zh');
    expect(document.querySelector('button')!.textContent).toBe('保存设置');
    expect(document.querySelector('pre')!.textContent).toBe('Training step 100 loss 0.3');
    expect(document.querySelector('.font-mono')!.textContent).toBe('log line here');
  });

  it('zh translates placeholder attributes', () => {
    run('zh');
    expect(document.querySelector('input')!.getAttribute('placeholder')).toBe(
      '输入你的 Hugging Face 令牌'
    );
  });

  it('zh template hit backfills the number and records the skeleton', () => {
    run('zh');
    expect(document.getElementById('tpl')!.textContent).toBe('提升 (12)');
    expect([...stats.templateHits]).toContain('Upsample (#)');
  });

  it('en after zh restores text nodes and attributes to original English', () => {
    run('zh');
    run('en');
    expect(document.querySelector('button')!.textContent).toBe('Save Settings');
    expect(document.getElementById('tpl')!.textContent).toBe('Upsample (12)');
    expect(document.querySelector('input')!.getAttribute('placeholder')).toBe(
      'Enter your Hugging Face token'
    );
  });

  it('re-translates when React overwrites a node with fresh English text', () => {
    run('zh');
    const b = document.querySelector('button')!;
    b.textContent = 'Delete'; // React re-render wrote new English
    run('zh');
    expect(b.textContent).toBe('删除');
  });

  it('records unmatched UI text as misses; allowEnglish never does', () => {
    const extra = document.createElement('div');
    extra.textContent = 'Some Unknown Text';
    document.getElementById('app')!.appendChild(extra);
    run('zh');
    const misses = [...stats.misses];
    expect(misses).toContain('Some Unknown Text');
    expect(misses).not.toContain('Keep Me English');
  });
});

describe('watch', () => {
  it('applies immediately and stops cleanly', () => {
    const handle = watch(document.body, () => 'zh', () => dict, stats);
    expect(document.querySelector('button')!.textContent).toBe('保存设置');
    // synchronous stand-in for MutationObserver-triggered re-apply (plan-sanctioned)
    const span = document.createElement('span');
    span.textContent = 'Delete';
    document.getElementById('app')!.appendChild(span);
    applyAll(document.body, 'zh', dict, stats);
    expect(span.textContent).toBe('删除');
    handle.stop();
  });

  it('requestReapply re-translates immediately after a language flip (instant toggle)', () => {
    let lang: 'en' | 'zh' = 'en';
    const handle = watch(document.body, () => lang, () => dict, stats);
    expect(document.querySelector('button')!.textContent).toBe('Save Settings');
    lang = 'zh'; // setLang() happened; DOM must update without refresh
    handle.requestReapply();
    expect(document.querySelector('button')!.textContent).toBe('保存设置');
    lang = 'en';
    handle.requestReapply();
    expect(document.querySelector('button')!.textContent).toBe('Save Settings');
    handle.stop();
  });
});
